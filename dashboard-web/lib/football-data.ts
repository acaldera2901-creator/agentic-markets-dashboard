const BASE = "https://api.football-data.org/v4";

// Competitions available on the free tier
export const LEAGUES: Record<string, string> = {
  PL: "Premier League",
  SA: "Serie A",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  CL: "Champions League",
  EL: "Europa League",
};

function headers() {
  return { "X-Auth-Token": process.env.FOOTBALL_DATA_ORG_API_KEY ?? "" };
}

export interface FDMatch {
  id: string;
  utcDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  minute: number | null;
}

function normalize(m: Record<string, unknown>): FDMatch {
  const ft = (m.score as Record<string, Record<string, number | null>>)
    ?.fullTime ?? {};
  const minute = (m.minute as number | null | undefined) ?? null;
  return {
    id: String(m.id),
    utcDate: m.utcDate as string,
    homeTeam: (m.homeTeam as { name: string }).name,
    awayTeam: (m.awayTeam as { name: string }).name,
    homeGoals: ft.home ?? null,
    awayGoals: ft.away ?? null,
    status: m.status as string,
    minute,
  };
}

async function fetchMatches(
  code: string,
  params: Record<string, string>
): Promise<FDMatch[]> {
  if (!process.env.FOOTBALL_DATA_ORG_API_KEY) return [];
  const qs = new URLSearchParams(params).toString();
  try {
    const r = await fetch(`${BASE}/competitions/${code}/matches?${qs}`, {
      headers: headers(),
      // Next.js: no cache, always fresh
      cache: "no-store",
    });
    if (!r.ok) return [];
    const data = await r.json();
    return ((data.matches ?? []) as Record<string, unknown>[]).map(normalize);
  } catch {
    return [];
  }
}

export async function fetchHistory(code: string): Promise<FDMatch[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 365);
  const matches = await fetchMatches(code, {
    status: "FINISHED",
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10),
  });
  return matches.filter((m) => m.homeGoals !== null && m.awayGoals !== null);
}

export async function fetchFixtures(code: string): Promise<FDMatch[]> {
  const today = new Date();
  const to = new Date(today);
  to.setDate(to.getDate() + 32);
  return fetchMatches(code, {
    status: "SCHEDULED,TIMED",
    dateFrom: today.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  });
}

export async function fetchAllTodayMatches(): Promise<FDMatch[]> {
  if (!process.env.FOOTBALL_DATA_ORG_API_KEY) return [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const competitions = Object.keys(LEAGUES).join(",");
  const qs = new URLSearchParams({
    competitions,
    dateFrom: yesterday.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10),
  }).toString();
  try {
    const r = await fetch(`${BASE}/matches?${qs}`, { headers: headers(), cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return ((data.matches ?? []) as Record<string, unknown>[]).map(normalize);
  } catch { return []; }
}
