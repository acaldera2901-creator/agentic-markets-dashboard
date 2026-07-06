// /api/referral/claim — #REFERRAL-HARDENING (mapping ufficiale codice→creator).
// POST { code } — il profilo loggato rivendica il SUO codice referral:
//   · un codice per profilo, IMMUTABILE una volta preso (409 se ne hai già uno);
//   · univoco tra tutti i profili (indice UNIQUE su UPPER, migration 013) —
//     first-come-first-served, 409 se già di qualcun altro;
//   · stessa regex del rail (/r/, register, lib/referral-code): [A-Z0-9_-]{2,20};
//   · anti self-referral (#REFERRAL-FLOW-CHECK #3): se il claimante risulta
//     "invitato" dal codice che sta rivendicando, l'attribuzione viene azzerata
//     (non puoi essere stato portato da te stesso — il contatore resta pulito).
// Il claim NON muove denaro: la revenue resta dietro lo switch per-creator del
// BackOffice (migration 012).

import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute, dbQuery } from "@/lib/db";
import { normalizeRefCode } from "@/lib/referral-code";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[referral/claim] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { code?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const code = normalizeRefCode(typeof body.code === "string" ? body.code : "");
  if (!code) return NextResponse.json({ error: "invalid code" }, { status: 400 });

  const [me] = await dbQuery<{ referral_code: string | null; referred_by: string | null }>(
    "SELECT referral_code, referred_by FROM profiles WHERE identifier = $1",
    [ctx.identifier]
  );
  if (!me) return NextResponse.json({ error: "profile not found" }, { status: 404 });
  if (me.referral_code) {
    // Immutabile: il codice è identità pubblica del creator (già distribuito
    // nei link) — cambiarlo orfanerebbe le attribuzioni passate.
    return NextResponse.json({ error: "code already claimed", code: me.referral_code }, { status: 409 });
  }

  // Pre-check di cortesia (l'indice UNIQUE della 013 resta il backstop vero
  // contro la race: se l'UPDATE sotto perde la corsa, fallisce e si risponde 409).
  const taken = await dbQuery<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM profiles WHERE UPPER(referral_code) = $1",
    [code]
  );
  if (Number(taken[0]?.n ?? 0) > 0) {
    return NextResponse.json({ error: "code taken" }, { status: 409 });
  }

  try {
    await dbExecute(
      "UPDATE profiles SET referral_code = $2, updated_at = NOW() WHERE identifier = $1 AND referral_code IS NULL",
      [ctx.identifier, code]
    );
  } catch (e) {
    console.error("[referral/claim] claim failed (unique race?):", String(e));
    return NextResponse.json({ error: "code taken" }, { status: 409 });
  }
  // Verifica post-write (exec_sql non riporta il rowcount): se il codice non
  // risulta sul MIO profilo, la corsa l'ha vinta qualcun altro.
  const [after] = await dbQuery<{ referral_code: string | null }>(
    "SELECT referral_code FROM profiles WHERE identifier = $1",
    [ctx.identifier]
  );
  if ((after?.referral_code ?? "").toUpperCase() !== code) {
    return NextResponse.json({ error: "code taken" }, { status: 409 });
  }

  // #3 anti self-referral: azzera l'attribuzione se "invitato" dal proprio codice.
  if ((me.referred_by ?? "").trim().toUpperCase() === code) {
    try {
      await dbExecute(
        "UPDATE profiles SET referred_by = NULL WHERE identifier = $1",
        [ctx.identifier]
      );
    } catch (e) {
      console.error("[referral/claim] self-referral clear failed:", String(e));
    }
  }

  return NextResponse.json({ ok: true, code });
}
