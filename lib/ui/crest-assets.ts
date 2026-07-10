// Mappa dei crest reali. Vuota in SP0: la fonte (licenza/asset pipeline) è
// una questione aperta risolta a monte. Popolare qui non cambia i consumer.
const CREST_MAP: Record<string, string> = {};

function key(team: string, sport: string): string {
  return `${sport.toLowerCase()}:${team.trim().toLowerCase()}`;
}

export function crestUrl(team: string | null, sport: string): string | null {
  if (!team) return null;
  return CREST_MAP[key(team, sport)] ?? null;
}
