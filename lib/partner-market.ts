// #COERENZA-1001 (d) — Andrea, 01/10: «sostituisci». Le righe tennis del feed
// partner (lib/partner-fixtures.ts) NON hanno un modello dietro: la
// probabilità è la quota del bookmaker senza margine (de-viggata), il torneo
// «Partner feed» non è un torneo e la superficie 'hard' è forzata. Qui si
// decide come si ETICHETTANO, in un posto solo: card, board, widget e API.
// I numeri non cambiano — cambia solo come si chiamano.

/** model_version scritto da lib/partner-fixtures.ts. */
export const PARTNER_MARKET_MODEL = "partner-market-v1";
/** tournament scritto da lib/partner-fixtures.ts (non è un torneo). */
export const PARTNER_FEED_TOURNAMENT = "Partner feed";

/** Da dove viene la probabilità mostrata: il nostro modello o il mercato. */
export type ProbabilitySource = "model" | "market";

export function probabilitySourceOf(modelVersion: string | null | undefined): ProbabilitySource {
  return modelVersion === PARTNER_MARKET_MODEL ? "market" : "model";
}

/** Il nome del torneo da MOSTRARE: «Partner feed» non lo è, quindi nessuno.
 *  Il dato resta invariato (il floor di surfacing lo legge per nome). */
export function displayTournament(tournament: string | null | undefined): string | null {
  const t = (tournament ?? "").trim();
  return !t || t === PARTNER_FEED_TOURNAMENT ? null : t;
}

/** L'etichetta della probabilità, accanto al numero. */
export function probabilityLabel(source: ProbabilitySource | null | undefined, lang: string = "en"): string {
  if (source !== "market") return "Our model"; // invariato: la card lo scrive così in ogni lingua
  const labels: Record<string, string> = {
    it: "Quota di mercato, senza margine",
    en: "Market price, margin removed",
    es: "Cuota de mercado, sin margen",
    fr: "Cote du marché, sans marge",
    ru: "Рыночная котировка без маржи",
  };
  return labels[lang] ?? labels.en;
}
