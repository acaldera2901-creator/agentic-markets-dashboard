// /api/affiliate/join — #AFFILIATE-V2-CRYPTO-1007 PR-5 (SPEC-ui §3.1, §12).
//
// GET  → cosa serve alla schermata d'iscrizione: se il programma è aperto, la
//        versione dei T&C in vigore, il codice dell'utente (se ne ha già uno).
// POST { code, terms_version, age, onerous_ack } → iscrizione gratuita.
//   · T&C, 18+ e accettazione SPECIFICA delle clausole onerose (artt. 1341-1342
//     c.c.) sono tre spunte distinte e tutte obbligatorie, ognuna col suo
//     timestamp; la versione deve essere quella in vigore.
//   · Il codice è `profiles.referral_code` (immutabile): se l'utente ne ha già
//     uno, il codice inviato deve essere quello; altrimenti lo si rivendica con
//     le stesse regole di /api/referral/claim. I link /r/CODE non cambiano.
//   · Il wallet NON si chiede qui (SPEC-ui §3.1).
// Chiuso con AFFILIATE_MODE=off (il default) o senza AFFILIATE_TERMS_VERSION.

import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute, dbQueryStrict } from "@/lib/db";
import { isInternalInviteCode } from "@/lib/internal-invite";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeRefCode } from "@/lib/referral-code";
import { affiliateMode, affiliateTermsVersion } from "@/lib/affiliate/config";
import { affiliateIdentifier, loadAffiliateBySession, recordAcceptance } from "@/lib/affiliate/account";
import { scheduleIpFingerprint } from "@/lib/affiliate/fingerprints";

export const dynamic = "force-dynamic";

function programOpen(): { open: boolean; termsVersion: string | null } {
  const termsVersion = affiliateTermsVersion();
  return { open: affiliateMode() !== "off" && termsVersion !== null, termsVersion };
}

async function session(req: Request) {
  try {
    return await getSessionPlan(req);
  } catch (e) {
    console.error("[affiliate/join] session lookup failed:", String(e));
    return null;
  }
}

async function profileCode(identifier: string): Promise<{ code: string | null; referredBy: string | null } | null> {
  const rows = await dbQueryStrict<{ referral_code: string | null; referred_by: string | null }>(
    "SELECT referral_code, referred_by FROM profiles WHERE identifier = $1 LIMIT 1",
    [identifier],
  );
  if (!rows[0]) return null;
  const code = (rows[0].referral_code ?? "").trim().toUpperCase();
  return { code: code || null, referredBy: rows[0].referred_by };
}

export async function GET(req: Request) {
  const ctx = await session(req);
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });
  try {
    const { open, termsVersion } = programOpen();
    const aff = await loadAffiliateBySession(ctx.identifier);
    const prof = await profileCode(ctx.identifier);
    return NextResponse.json({
      open,
      enrolled: Boolean(aff),
      status: aff?.status ?? null,
      terms_version: termsVersion,
      code: aff?.code ?? prof?.code ?? null,
      code_locked: Boolean(aff?.code ?? prof?.code),
    });
  } catch (e) {
    console.error("[affiliate/join] read failed:", String(e));
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  const ctx = await session(req);
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });

  if (rateLimit(`aff-join:${affiliateIdentifier(ctx.identifier)}`, 10, 3_600_000) || rateLimit(`aff-join-ip:${clientIp(req)}`, 30, 3_600_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const { open, termsVersion } = programOpen();
  if (affiliateMode() === "off") return NextResponse.json({ error: "program_closed" }, { status: 403 });
  if (!open || !termsVersion) return NextResponse.json({ error: "terms_not_published" }, { status: 503 });

  let body: { code?: unknown; terms_version?: unknown; age?: unknown; onerous_ack?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  // Tre spunte distinte, tutte `true` letterale: niente "1", niente "yes".
  if (body.age !== true) return NextResponse.json({ error: "age_required" }, { status: 400 });
  if (body.onerous_ack !== true) return NextResponse.json({ error: "onerous_ack_required" }, { status: 400 });
  if (body.terms_version !== termsVersion) {
    return NextResponse.json({ error: "terms_outdated", terms_version: termsVersion }, { status: 409 });
  }
  const code = normalizeRefCode(typeof body.code === "string" ? body.code : "");
  if (!code) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  if (isInternalInviteCode(code)) return NextResponse.json({ error: "code_reserved" }, { status: 409 });

  const identifier = affiliateIdentifier(ctx.identifier);
  try {
    const existing = await loadAffiliateBySession(ctx.identifier);
    if (existing) {
      if (existing.status === "terminated") return NextResponse.json({ error: "terminated" }, { status: 403 });
      if (existing.left_at) {
        // #AFFILIATE-COMPLETE-1023 — back after leaving: same code, fresh consent on the
        // Terms in force (the three ticks were just given), history kept.
        await recordAcceptance(existing.id, termsVersion, "rejoin");
        // One statement (atomic): close the absence (its payments stay excluded) and come back.
        await dbExecute(
          `WITH x AS (
             UPDATE affiliate_absences SET rejoined_at = NOW() WHERE affiliate_id = $1 AND rejoined_at IS NULL RETURNING 1)
           UPDATE affiliates
              SET left_at = NULL, terms_version = $2, terms_accepted_at = NOW(), age_confirmed_at = NOW(),
                  onerous_ack_at = NOW(), onerous_ack_version = $2, updated_at = NOW()
            WHERE id = $1 AND left_at IS NOT NULL`,
          [existing.id, termsVersion],
        );
        return NextResponse.json({ ok: true, enrolled: true, rejoined: true, code: existing.code, status: existing.status });
      }
      // Doppio click / ritorno: idempotente, nessun nuovo consenso registrato.
      return NextResponse.json({ ok: true, enrolled: true, already: true, code: existing.code, status: existing.status });
    }

    const prof = await profileCode(ctx.identifier);
    if (!prof) return NextResponse.json({ error: "profile not found" }, { status: 404 });

    if (prof.code) {
      // Codice immutabile: già distribuito nei link /r/CODE.
      if (prof.code !== code) return NextResponse.json({ error: "code_mismatch", code: prof.code }, { status: 409 });
    } else {
      // Stesse regole di /api/referral/claim: pre-check di cortesia, UPDATE con
      // guardia, verifica dopo la scrittura (exec_sql non dà il rowcount).
      const taken = await dbQueryStrict<{ n: number | string }>(
        "SELECT COUNT(*)::int AS n FROM profiles WHERE UPPER(referral_code) = $1",
        [code],
      );
      if (Number(taken[0]?.n ?? 0) > 0) return NextResponse.json({ error: "code_taken" }, { status: 409 });
      try {
        await dbExecute(
          "UPDATE profiles SET referral_code = $2, updated_at = NOW() WHERE identifier = $1 AND referral_code IS NULL",
          [ctx.identifier, code],
        );
      } catch (e) {
        console.error("[affiliate/join] code claim failed (unique race?):", String(e));
        return NextResponse.json({ error: "code_taken" }, { status: 409 });
      }
      const after = await profileCode(ctx.identifier);
      if (after?.code !== code) return NextResponse.json({ error: "code_taken" }, { status: 409 });
      if ((prof.referredBy ?? "").trim().toUpperCase() === code) {
        await dbExecute("UPDATE profiles SET referred_by = NULL WHERE identifier = $1", [ctx.identifier]);
      }
    }

    // Lo UNIQUE su identifier e code è il lock: chi perde la corsa non scrive.
    await dbExecute(
      `INSERT INTO affiliates
         (identifier, code, terms_version, terms_accepted_at, age_confirmed_at,
          onerous_ack_at, onerous_ack_version)
       VALUES ($1, $2, $3, NOW(), NOW(), NOW(), $3)
       ON CONFLICT DO NOTHING`,
      [identifier, code, termsVersion],
    );
    const created = await loadAffiliateBySession(ctx.identifier);
    if (!created) return NextResponse.json({ error: "code_taken" }, { status: 409 });
    await recordAcceptance(created.id, termsVersion, "join");
    // #AFFILIATE-FINGERPRINTS-1022 — l'IP dell'affiliato (HMAC), confrontato con
    // quello dei suoi referiti alla loro prima conversione.
    scheduleIpFingerprint(identifier, clientIp(req));
    return NextResponse.json({ ok: true, enrolled: true, code: created.code, status: created.status });
  } catch (e) {
    console.error("[affiliate/join] enrollment failed:", String(e));
    return NextResponse.json({ error: "enrollment failed" }, { status: 500 });
  }
}
