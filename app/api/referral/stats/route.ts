// /api/referral/stats — #REFERRAL-PANEL (item 3) + #REFERRAL-HARDENING (#4).
// Read-only conversion counter for the creator referral program decided in
// #PRICING-CREATORS-0706. Returns aggregates ONLY for the caller's OWN claimed
// referral_code (migration 013 + /api/referral/claim): the previous ?code=
// parameter let any logged-in user enumerate any creator's numbers — closed.
// No claimed code yet → 403 with an explicit reason so the panel can route the
// user to the claim step first. No PII, just two integers + the caller's code.
//
// #REFERRAL-V2-0808: `paid` (abbonati ATTIVI adesso) è sostituito da `paying`
// (pagamenti AVVENUTI). `paid` regrediva — un amico che paga e disdice usciva dal
// contatore e il pannello mostrava meno invitati dei premi già concessi.
// `signups` resta perché la UI lo mostra. Si aggiunge `tiers`, lo stato dei tre
// gradini, così il pannello può mostrare il progresso senza fare aritmetica.

import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { getSessionPlan } from "@/lib/auth";
import {
  INVITEE_BONUS_DAYS,
  REFERRAL_TIERS,
  countPayingInvitees,
  reachedTiers,
} from "@/lib/referral-rewards";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[referral/stats] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });

  const [me] = await dbQuery<{ referral_code: string | null }>(
    "SELECT referral_code FROM profiles WHERE identifier = $1",
    [ctx.identifier]
  );
  const code = (me?.referral_code ?? "").trim().toUpperCase();
  if (!code) {
    // Nessun codice claimato: niente numeri altrui da guardare (anti-enumerazione).
    return NextResponse.json({ error: "no referral code claimed" }, { status: 403 });
  }

  // Case-insensitive: /r/ uppercasa, ma referred_by può contenere codici
  // catturati prima della normalizzazione.
  const rows = await dbQuery<{ signups: number | string }>(
    `SELECT COUNT(*)::int AS signups
     FROM profiles
     WHERE UPPER(referred_by) = $1
       AND identifier <> $2`,
    [code, ctx.identifier]
  );
  const signups = Number(rows[0]?.signups) || 0;

  // Il conteggio dei paganti e lo stato dei gradini sono best-effort: la
  // migration 015 si applica a mano in Supabase, quindi questo codice può girare
  // prima che la tabella esista. In quel caso il pannello deve continuare a
  // mostrare link e iscritti invece di rispondere 500.
  let paying = 0;
  const grantedAt = new Map<number, string>();
  try {
    paying = await countPayingInvitees(code, ctx.identifier);
    const granted = await dbQuery<{ tier: number | string; granted_at: string | null }>(
      // tier > 0: il tier 0 è il bonus dell'INVITATO, non un gradino del programma.
      `SELECT tier, granted_at::text AS granted_at
         FROM referral_rewards
        WHERE identifier = $1 AND tier > 0`,
      [ctx.identifier]
    );
    for (const g of granted) {
      if (g.granted_at) grantedAt.set(Number(g.tier), g.granted_at);
    }
  } catch (e) {
    console.error("[referral/stats] conteggio dei gradini non disponibile:", String(e));
  }

  const reached = new Set(reachedTiers(paying));
  return NextResponse.json({
    code,
    signups,
    paying,
    // Quanti giorni riceve l'AMICO: il pannello lo dice a chi invita, ed è
    // l'argomento con cui convincerà l'amico.
    inviteeBonusDays: INVITEE_BONUS_DAYS,
    // `rewardDays`/`grantsRoom` viaggiano nella risposta perché il pannello è un
    // componente client: importare lib/referral-rewards lì trascinerebbe db e
    // plan-grant nel bundle. Così REFERRAL_TIERS resta l'unica fonte dei numeri.
    tiers: REFERRAL_TIERS.map((t) => ({
      tier: t.tier,
      reached: reached.has(t.tier),
      granted_at: grantedAt.get(t.tier) ?? null,
      rewardDays: t.rewardDays,
      grantsRoom: t.grantsRoom,
    })),
  });
}
