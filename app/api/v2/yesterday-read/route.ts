import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { currentShowcaseDay } from "@/lib/access-projection";
import { pickYesterdayReads, shiftUtcDay, type YesterdayCandidateRow } from "@/lib/yesterday-read";

// #HOOK-A-LITE-0928 — «La lettura di ieri, con l'esito», per la Home anonima.
//
// ⚠️ SBLOCCA QUALCOSA CHE OGGI È BLOCCATO PER L'ANONIMO. La policy (06-09,
// 31/08) dice «anonimo non sblocca», e vale anche per lo storico settlato:
// /api/v2/history proietta ogni riga con rank Infinity per anonimo/free, pick
// e spiegazione compresi. Questa route serve INTERA — pick, probabilità,
// perché, esito — UNA riga settlata per sport, scelta con l'ordine della
// vetrina e cieca all'esito (lib/yesterday-read.ts). Niente valore live:
// partita finita, esito già pubblico. Il gate live e la proiezione per-tier
// (lib/access-projection.ts, /api/predictions, /api/tennis, /api/v2/history)
// non sono toccati — la route non legge nemmeno la sessione, di proposito:
// la risposta è identica per tutti, quindi è cacheable senza Vary: Cookie.
//
// Uno sport senza candidato nella finestra manca dall'array; con zero letture
// la Home non rende il blocco. Nessuna card inventata.

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 7;
const MAX_ROWS = 600;

export async function GET() {
  const today = currentShowcaseDay();
  const since = `${shiftUtcDay(today, -LOOKBACK_DAYS)}T00:00:00Z`;
  const until = `${today}T00:00:00Z`;

  // Stessi cancelli del track record (/api/v2/history): pubblicata, storica,
  // non demo, esito confermato da una fonte con flag esplicito (#SETTLE-0909),
  // e con una pick — le righe «nessun chiaro favorito» non sono letture.
  const rows = await dbQuery<YesterdayCandidateRow>(
    `SELECT id, sport, competition, league, home_team, away_team, market, pick,
            confidence_score, fair_odds, odds, edge_percent, explanation,
            result, starts_at, settled_at, notes, verification_state
     FROM unified_predictions
     WHERE is_historical = TRUE
       AND is_demo = FALSE
       AND published_at IS NOT NULL
       AND verification_state = 'verified'
       AND result IN ('won', 'lost', 'void')
       AND pick IS NOT NULL
       AND sport IN ('football', 'tennis')
       AND starts_at >= $1 AND starts_at < $2
     ORDER BY starts_at DESC, id DESC
     LIMIT $3`,
    [since, until, MAX_ROWS],
  );

  const reads = pickYesterdayReads(rows, { today, maxLookbackDays: LOOKBACK_DAYS });

  return NextResponse.json(
    { day: shiftUtcDay(today, -1), reads },
    {
      headers: {
        // Identica per ogni visitatore (nessuna sessione letta): la CDN può
        // tenerla. Cambia al più una volta al giorno, più i settlement che
        // arrivano a ondate (cron ogni 30'): 10 minuti bastano.
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    },
  );
}
