import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// #021 — live tennis scores for the board's live strip.
//
// Source: ESPN day scoreboard (the same real feed the Python pipeline uses for
// fixtures and settlement). Only matches currently in progress ("in" state),
// singles, main tour. No model numbers here — just real public scores — so the
// endpoint is unauthenticated by design.
//
// Curation mirror: keep in sync with config/settings.py
// TENNIS_TOURNAMENT_DENYLIST (#020) — the live strip must never surface a
// tournament the board itself refuses to show.
const TOURNAMENT_DENYLIST = [
  "itf", "challenger", "125", "memorial", "trofeo", "makarska",
  "puglie", "ilkley", "fontana",
];

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const LEAGUES = ["atp", "wta"] as const;

type LiveTennisMatch = {
  id: string;
  tournament: string;
  player1: string;
  player2: string;
  sets_p1: number[];
  sets_p2: number[];
  status_detail: string;
};

function fold(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function isDenied(tournament: string): boolean {
  const t = fold(tournament);
  return TOURNAMENT_DENYLIST.some((token) => t.includes(token));
}

function lineValues(competitor: Record<string, unknown>): number[] {
  const scores = (competitor?.linescores ?? []) as Array<{ value?: number }>;
  return scores
    .map((s) => Number(s?.value))
    .filter((v) => Number.isFinite(v));
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seen = new Set<string>();
  const matches: LiveTennisMatch[] = [];

  for (const league of LEAGUES) {
    try {
      const resp = await fetch(`${ESPN_BASE}/${league}/scoreboard?dates=${today}`, {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AgenticMarkets/1.0)" },
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const ev of data?.events ?? []) {
        const tournament: string = ev?.name ?? "";
        if (!tournament || isDenied(tournament)) continue;
        for (const g of ev?.groupings ?? []) {
          const gname: string = g?.grouping?.displayName ?? "";
          if (!gname.includes("Singles")) continue;
          for (const comp of g?.competitions ?? []) {
            const state = comp?.status?.type?.state;
            if (state !== "in") continue;
            const round: string = comp?.round?.displayName ?? "";
            if (fold(round).includes("qualifying")) continue;
            const id = String(comp?.id ?? "");
            if (!id || seen.has(id)) continue;
            const [c1, c2] = comp?.competitors ?? [];
            const p1 = c1?.athlete?.displayName;
            const p2 = c2?.athlete?.displayName;
            if (!p1 || !p2) continue;
            seen.add(id);
            matches.push({
              id,
              tournament,
              player1: p1,
              player2: p2,
              sets_p1: lineValues(c1),
              sets_p2: lineValues(c2),
              status_detail: comp?.status?.type?.detail ?? "Live",
            });
          }
        }
      }
    } catch {
      // fail-soft: one feed down must not blank the strip
    }
  }

  return NextResponse.json(
    { matches, updated: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" } }
  );
}
