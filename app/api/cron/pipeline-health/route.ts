// app/api/cron/pipeline-health/route.ts — #PIPELINE-HEALTH-0924
//
// Nato da un guasto vero, trovato a occhio da Andrea il 24/09 e non da questo
// sistema: le big-5 europee (PL/SA/PD/BL1/FL1) erano ferme da 4 giorni — zero
// righe con `starts_at` futuro in `unified_predictions` — e Champions/World
// Cup da 13. Nessun allarme era partito. `lib/football-data.ts` (vedi
// #FIXTURES-SILENT-SKIP-0910) già logga un `console.warn` quando una lega
// torna HTTP non-200, ma un log su Vercel che nessuno legge non è un allarme.
// Uso `opsAlert` (già in `lib/ops-alert.ts`, già consumato da altri cron
// come shopify-reconcile): niente canale nuovo, quello che c'è già.
//
// ATTENZIONE — verificato il 24/09: `ALERT_WEBHOOK_URL` NON è configurata su
// Vercel production (né `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, se qualcuno
// pensasse di leggerle da qui). `opsAlert` senza quell'env degrada a solo
// `console.error` — quindi finché non si imposta `ALERT_WEBHOOK_URL` (o si fa
// puntare a un proxy Telegram), QUESTO cron e TUTTI gli altri che già usano
// opsAlert non avvisano nessuno, solo i log di Vercel. Non è un problema di
// QUESTO file: è un buco nell'infrastruttura di alert esistente, riportato ad
// Andrea a parte — impostare quella env è una scelta di credenziali/canale, non
// una riga di codice che un agente decide da solo.
//
// Perché "zero partite future entro N giorni" e non "ultimo aggiornamento
// più vecchio di N ore": un giro che non trova nulla di nuovo da aggiornare
// non necessariamente tocca `updated_at` delle righe esistenti, quindi quella
// soglia avrebbe falsi positivi ogni volta che il calendario è già stabile.
// "Nessuna partita futura" invece è inequivocabile per queste 5 leghe: hanno
// sempre un turno entro due settimane salvo una sosta internazionale, e
// un'unica sosta non azzera TUTTE e 5 insieme.
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { dbQuery } from "@/lib/db";
import { opsAlert } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Le 5 leghe domestiche del percorso football-data.org (LEAGUES in
// lib/football-data.ts, meno CL/EL/WC: quelle hanno pause vere e lunghe fra
// una giornata e l'altra — a gironi europei o fase finale — e genererebbero
// falsi allarmi legittimi).
const WATCHED_LEAGUES: Record<string, string> = {
  PL: "Premier League",
  SA: "Serie A",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
};

const HORIZON_DAYS = 14;

type LeagueRow = { league: string; upcoming: number; last_updated: string | null };

export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // #DB-INTERPOLATE-NOTE: `dbQuery` sostituisce $N con una stringa quotata,
  // non un vero parametro preparato (vedi `interpolate` in lib/db.ts) — un
  // array JS diventerebbe `'PL,SA,...'` (una sola stringa), non una lista SQL.
  // Le leghe sono una costante interna (non input utente): l'IN-list si
  // costruisce qui, letterale, senza passare da $N.
  const leagueList = Object.keys(WATCHED_LEAGUES).map((code) => `'${code}'`).join(", ");
  const rows = await dbQuery<LeagueRow>(
    `SELECT league,
            count(*) FILTER (WHERE starts_at > now() AND starts_at < now() + interval '${HORIZON_DAYS} days') AS upcoming,
            max(updated_at) AS last_updated
       FROM unified_predictions
      WHERE sport = 'football' AND league IN (${leagueList})
      GROUP BY league`
  );

  const byLeague = new Map((rows ?? []).map((r) => [r.league, r]));
  const stale = Object.keys(WATCHED_LEAGUES).filter((code) => {
    const row = byLeague.get(code);
    return !row || Number(row.upcoming) === 0;
  });

  if (stale.length > 0) {
    const lines = stale.map((code) => {
      const row = byLeague.get(code);
      const last = row?.last_updated ? new Date(row.last_updated).toISOString().slice(0, 16).replace("T", " ") : "mai";
      return `${WATCHED_LEAGUES[code]} (${code}) — 0 partite entro ${HORIZON_DAYS}gg, ultimo aggiornamento ${last} UTC`;
    });
    await opsAlert("pipeline-health/football-data-org", lines);
  }

  return NextResponse.json({ ok: true, checked: Object.keys(WATCHED_LEAGUES), stale });
}
