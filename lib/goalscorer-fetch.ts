// #PLAYER-GOALSCORER — fetch I/O condiviso tra /api/predictions (board home) e
// /api/v2/predictions (board World Cup). Batch-fetch player_profiles eleggibili +
// player_odds per le partite della pagina e costruisce i mercati marcatore per
// match (logica pura in lib/goalscorer-serve). Fail-soft: dbQuery ritorna [] su
// tabelle assenti/errore, quindi finche` i dati player non sono live il blocco
// semplicemente non compare. Join: player_odds.match_id == matchId servito.
import { dbQuery } from "@/lib/db";
import {
  buildGoalscorerByMatch,
  groupProfilesByTeam,
  groupOddsByMatch,
  type GsPrediction,
  type ProfileRow,
  type OddRow,
} from "@/lib/goalscorer-serve";
import { type GoalscorerMarket } from "@/lib/goalscorer-model";

export async function fetchGoalscorerByMatch(
  preds: GsPrediction[]
): Promise<Map<string, GoalscorerMarket[]>> {
  const teams = Array.from(
    new Set(preds.flatMap((p) => [p.homeTeam, p.awayTeam]).filter(Boolean))
  );
  const matchIds = Array.from(new Set(preds.map((p) => p.matchId).filter(Boolean)));
  if (teams.length === 0 || matchIds.length === 0) return new Map();

  const teamPh = teams.map((_, i) => `$${i + 1}`).join(",");
  const matchPh = matchIds.map((_, i) => `$${i + 1}`).join(",");

  const [profileRows, oddRows] = await Promise.all([
    dbQuery<ProfileRow>(
      `SELECT player_id, name, team, goals_per90_season, minutes_share, tier
       FROM player_profiles
       WHERE eligible_for_player_markets = true AND team IN (${teamPh})`,
      teams
    ),
    dbQuery<OddRow>(
      `SELECT match_id, player_name, price, bookmaker
       FROM player_odds WHERE match_id IN (${matchPh})`,
      matchIds
    ),
  ]);
  if (profileRows.length === 0) return new Map();

  return buildGoalscorerByMatch(
    preds,
    groupProfilesByTeam(profileRows),
    groupOddsByMatch(oddRows)
  );
}
