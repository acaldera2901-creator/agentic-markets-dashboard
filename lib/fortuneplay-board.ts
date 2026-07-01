// (#FORTUNEPLAY-LIVE-ODDS-1) Proietta la mappa FpMatch nel payload servito al FE.
// Degradazione pulita: senza slug/id validi → matchUrl = landing affiliate garantito
// (mediaroosters), prefilled=false. Nessuna card regredisce mai.
import type { FpMatch } from "./fortuneplay-live";
import { buildFortuneplayMatchUrl } from "./fortuneplay-url";

export type FpOddsEntry = {
  homeKey: string;
  awayKey: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  totalLine: number | null;
  totalOver: number | null;
  totalUnder: number | null;
  matchUrl: string;
  prefilled: boolean;
};

export function boardToResponse(
  map: Map<string, FpMatch>,
  cfg: { baseUrl: string; locale: string; code?: string; landingUrl: string }
): Record<string, FpOddsEntry> {
  const out: Record<string, FpOddsEntry> = {};
  for (const [key, m] of map) {
    const deep =
      m.slug && m.id
        ? buildFortuneplayMatchUrl({
            baseUrl: cfg.baseUrl,
            locale: cfg.locale,
            slug: m.slug,
            id: m.id,
            code: cfg.code,
          })
        : null;
    out[key] = {
      homeKey: m.homeKey,
      awayKey: m.awayKey,
      oddsHome: m.oddsHome,
      oddsDraw: m.oddsDraw,
      oddsAway: m.oddsAway,
      totalLine: m.totalLine,
      totalOver: m.totalOver,
      totalUnder: m.totalUnder,
      matchUrl: deep ?? cfg.landingUrl,
      prefilled: Boolean(deep),
    };
  }
  return out;
}
