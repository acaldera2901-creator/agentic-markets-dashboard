import type { UpcomingMatch } from "./upcoming-matches";

type Sport = UpcomingMatch["sport"];
type Reading = { probability: number; source: "estimate" | "market"; computedAt?: string };

// The football prediction job runs every two hours (vercel.json).
const footballReadingMaxAgeMs = 2 * 60 * 60 * 1000;

function matchKey(home: unknown, away: unknown, startsAt: unknown) {
  if (typeof home !== "string" || typeof away !== "string" || typeof startsAt !== "string") return null;
  const timestamp = Date.parse(startsAt);
  const names = [home, away].map((name) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase());
  if (!names[0] || !names[1] || !Number.isFinite(timestamp)) return null;
  return JSON.stringify([...names, timestamp]);
}

export function fixtureReadingKey(match: UpcomingMatch) {
  return matchKey(match.home, match.away, match.startsAt);
}

/** Only use the public, locked headline. Multiple readings for the same fixture are ambiguous. */
export function publicMatchReadings(sport: Sport, payload: unknown, now = Date.now()) {
  const readings = new Map<string, Reading | null>();
  if (!payload || typeof payload !== "object") return readings;
  const data = payload as Record<string, unknown>;
  const football = sport === "football";
  const checkRowAge = football && data.source === "database";
  if (data.is_placeholder === true || (data.is_stale === true && !checkRowAge)) return readings;
  const rows = football ? data.predictions : data.matches;
  if (!Array.isArray(rows)) return readings;

  for (const entry of rows) {
    if (!entry || typeof entry !== "object" || entry.locked !== true) continue;
    const row = entry as Record<string, unknown>;
    const key = football
      ? matchKey(row.home_team, row.away_team, row.kickoff)
      : matchKey(row.player1, row.player2, row.scheduled);
    const probability = row.model_prob;
    if (!key || typeof probability !== "number" || !Number.isFinite(probability) || probability <= 0 || probability >= 1) continue;

    const source = football || row.probability_source === "model" ? "estimate"
      : row.probability_source === "market" ? "market" : null;
    if (!source) continue;

    const reading: Reading = { probability, source };
    if (checkRowAge) {
      if (typeof row.computed_at !== "string") continue;
      const age = now - Date.parse(row.computed_at);
      if (!Number.isFinite(age) || age < 0 || age > footballReadingMaxAgeMs) continue;
      reading.computedAt = row.computed_at;
    }
    readings.set(key, readings.has(key) ? null : reading);
  }
  return readings;
}

export async function fetchPublicMatchReadings(sport: Sport) {
  const endpoint = sport === "football" ? "predictions" : "tennis";
  try {
    const response = await fetch(`https://www.betredge.com/api/${endpoint}`, {
      credentials: "omit",
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) return publicMatchReadings(sport, await response.json());
  } catch {
    // The calendar stays available independently of the public probability feed.
  }
  return publicMatchReadings(sport, null);
}
