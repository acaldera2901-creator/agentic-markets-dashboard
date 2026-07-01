// (#FORTUNEPLAY-LIVE-ODDS-1) Proietta la mappa FpMatch nel payload servito al FE.
// Degradazione pulita: senza slug/id validi → matchUrl = landing affiliate garantito
// (mediaroosters), prefilled=false. Nessuna card regredisce mai.
import type { FpMatch } from "./fortuneplay-live";
// buildFortuneplayMatchUrl (lib/fortuneplay-url.ts) resta pronto per quando FortunePlay
// fornirà il formato deep-link ufficiale; oggi non usato (vedi nota #FORTUNEPLAY-DEEPLINK-404).

export type FpOddsEntry = {
  id: number;
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
  // #FORTUNEPLAY-DEEPLINK-404: il deep-link pagina-partita NON è costruibile dal
  // feed pubblico — FortunePlay usa uno slug canonico (es. "...-m-<id>") aggiunto
  // dal frontend, assente da lista E dettaglio API → `/it/sports/{sport}/{slug}-{id}`
  // costruito dallo slug del feed dà 404 (verificato 2026-07-01, anche con segmento
  // sport). Finché FortunePlay non fornisce il formato ufficiale / un betslip-link
  // operatore, la CTA punta al landing affiliate (mediaroosters): affidabile +
  // attribuzione garantita. Le quote/mercati restano (via API per-id, indipendenti
  // dalla URL web). buildFortuneplayMatchUrl resta pronto per quando avremo il formato.
  const out: Record<string, FpOddsEntry> = {};
  for (const [key, m] of map) {
    out[key] = {
      id: m.id,
      homeKey: m.homeKey,
      awayKey: m.awayKey,
      oddsHome: m.oddsHome,
      oddsDraw: m.oddsDraw,
      oddsAway: m.oddsAway,
      totalLine: m.totalLine,
      totalOver: m.totalOver,
      totalUnder: m.totalUnder,
      matchUrl: cfg.landingUrl,
      prefilled: false,
    };
  }
  return out;
}
