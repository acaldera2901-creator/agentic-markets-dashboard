// lib/v3c/line-movement-service.ts (#REDESIGN-V3C F4)
// Il payload di GET /api/v3/match/[id]/line-movement, costruito in UN posto:
// la route lo serve in JSON, la pagina partita (/match/[id]) lo legge lato
// server senza un giro HTTP. Spostato qui da app/api/v3/match/[id]/line-movement
// senza cambiare una riga del contratto (v3.line_movement.2).
import { footballPairKey } from "./board";
import type { V3LineMovementResponse } from "./contracts";
import { ahSeries, partnerSeries } from "./line-movement";
import { fetchAhHistory, fetchMatchFixture, fetchPartnerHistory, fetchTennisFixture } from "./queries";
import { tennisMlSeries, tennisPairKey } from "./tennis";

/** Tennis ids are tennis_predictions.match_id («tennis:…»); everything else is football. */
export const isTennisId = (id: string) => id.startsWith("tennis:");

export type Fixture = { home: string; away: string; kickoff: string };

/** La partita esiste? Una query sola, indicizzata: serve alla pagina per decidere il 404 prima dello streaming. */
export async function fetchFixture(matchId: string): Promise<Fixture | null> {
  return isTennisId(matchId) ? fetchTennisFixture(matchId) : fetchMatchFixture(matchId);
}

/** null = partita sconosciuta. Gli errori del DB si propagano: il chiamante decide (503 / stato d'errore). */
export async function buildLineMovement(matchId: string, now: Date = new Date(), known?: Fixture | null): Promise<V3LineMovementResponse | null> {
  const isTennis = isTennisId(matchId);
  const fixture = known ?? (await fetchFixture(matchId));
  if (!fixture) return null;
  let key: string | null;
  let series;
  if (isTennis) {
    key = tennisPairKey({ id: matchId, player1: fixture.home, player2: fixture.away, kickoff: fixture.kickoff });
    series = tennisMlSeries(fixture, key ? await fetchPartnerHistory(key) : []);
  } else {
    key = footballPairKey(fixture);
    const [partner, ah] = key ? await Promise.all([fetchPartnerHistory(key), fetchAhHistory(key)]) : [[], []];
    series = [...partnerSeries(fixture, partner), ...ahSeries(fixture, ah)];
  }
  return {
    contract: "v3.line_movement.2",
    generated_at: now.toISOString(),
    match: {
      id: matchId,
      sport: isTennis ? "tennis" : "football",
      home: fixture.home,
      away: fixture.away,
      kickoff: new Date(fixture.kickoff).toISOString(),
      team_pair_key: key,
    },
    series,
    notes: [
      "Every stored capture is returned; nothing is interpolated or smoothed. The first point is the first capture we hold, not necessarily the book's opening price.",
      "coverage.median_interval_min is the measured capture frequency of each series.",
      "1X2 series: feed books only (partner_price_history). AH series: ah_odds_history, line quoted for the home side.",
      "Tennis (ML series): feed books only (partner_price_history), p1/p2 = our player1/player2, market_p de-vigged on the 2-way price. No AH for tennis.",
      series.length === 0 ? "No stored price history for this match." : "",
    ].filter(Boolean),
  };
}
