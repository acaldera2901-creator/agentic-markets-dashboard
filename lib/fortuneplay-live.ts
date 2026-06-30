// lib/fortuneplay-live.ts
// Sorgente quote live FortunePlay/BetConstruct (#FORTUNEPLAY-LIVE-ODDS-1).
// Parse PER POSIZIONE (il `name` è localizzato). Odds = intero ÷ 1000.
import { teamPairKey } from "./team-pair-key";

export type FpMatch = {
  teamPairKey: string;
  sport: "soccer" | "tennis";
  slug: string;
  id: number;
  urnId: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  totalLine: number | null;
  totalOver: number | null;
  totalUnder: number | null;
};

const SPORTS = new Set(["soccer", "tennis"]);

function odds(raw: unknown): number | null {
  const v = Number(raw) / 1000;
  return Number.isFinite(v) && v > 1 ? v : null;
}

function parseMatchResult(market: any): [number | null, number | null, number | null] {
  const o = market?.outcomes ?? [];
  if (o.length >= 3) return [odds(o[0]?.odds), odds(o[1]?.odds), odds(o[2]?.odds)];
  if (o.length === 2) return [odds(o[0]?.odds), null, odds(o[1]?.odds)];
  return [null, null, null];
}

function parseTotals(market: any): [number | null, number | null, number | null] {
  const o = market?.outcomes ?? [];
  const spec: string = market?.specifier ?? "";
  if (o.length !== 2 || !spec.includes("hcp=")) return [null, null, null];
  let line: number | null = null;
  for (const part of spec.split("|")) {
    if (part.startsWith("hcp=")) {
      const n = Number(part.split("=")[1]);
      if (!Number.isFinite(n)) return [null, null, null];
      line = n;
      break;
    }
  }
  return [line, odds(o[0]?.odds), odds(o[1]?.odds)];
}

export function parseFortuneplayMatches(payload: unknown): FpMatch[] {
  const data: any[] = (payload as any)?.data ?? [];
  const out: FpMatch[] = [];
  for (const m of data) {
    const sport: string | undefined = m?.tournament?.sport?.key;
    if (!sport || !SPORTS.has(sport)) continue;
    const home: string = m?.competitors?.home?.name ?? "";
    const away: string = m?.competitors?.away?.name ?? "";
    if (!home || !away) continue;
    const [oh, od, oa] = parseMatchResult(m?.main_market);
    if (oh === null && oa === null) continue;
    const key = teamPairKey(sport as "soccer" | "tennis", home, away, m?.start_time ?? null);
    if (!key) continue;
    const [line, over, under] = parseTotals(m?.secondary_market);
    out.push({
      teamPairKey: key,
      sport: sport as "soccer" | "tennis",
      slug: String(m?.slug ?? ""),
      id: Number(m?.id),
      urnId: String(m?.urn_id ?? ""),
      oddsHome: oh, oddsDraw: od, oddsAway: oa,
      totalLine: line, totalOver: over, totalUnder: under,
    });
  }
  return out;
}

export function fpEdge(pPick: number, oddsDecimal: number | null): number | null {
  if (!oddsDecimal || oddsDecimal <= 1) return null;
  // Round to 10 decimal places to avoid floating-point drift (0.6*2.0-1 → 0.2).
  return Math.round((pPick * oddsDecimal - 1) * 1e10) / 1e10;
}
