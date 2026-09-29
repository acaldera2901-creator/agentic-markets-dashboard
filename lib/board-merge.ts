// #NATIONS-BOARD-0929 — quali righe di unified_predictions entrano in board.
//
// Le righe delle nazionali (Python, tier paper) vivono SOLO in
// unified_predictions: la primaria match_predictions non le ha mai. Il fallback
// unified però serviva il non-WC solo in off-season (primaria vuota), quindi la
// Nations League (#NATIONS-LEAGUE-0826) non arrivava in board proprio nelle
// finestre in cui si gioca, cioè sempre con i campionati minori attivi.
// Misurato il 29/09: 62 UNL + 31 CNL pronte in unified, 58 righe club in
// primaria, 0 righe Nations servite.
//
// UNL/CNL si servono sempre, come la WC (#WC-DEDUP-1). Restano FUORI dal cap
// delle righe club: in una finestra internazionale 58 club + 93 Nations
// supererebbero BOARD_ROWS e il taglio (in ordine di concatenazione) le
// eliminerebbe di nuovo. FRIENDLY resta sul contratto off-season di prima
// (decisione separata, non inclusa qui).

export const ALWAYS_SERVED_NATIONS = new Set(["UNL", "CNL"]);

type Row = { league: string };

export function splitUnifiedFallback<T extends Row>(
  primaryNonWc: T[],
  fallbackRaw: T[]
): { fallbackWc: T[]; fallbackNations: T[]; fallbackNonWc: T[]; usingFallback: boolean } {
  const usingFallback = primaryNonWc.length === 0;
  return {
    fallbackWc: fallbackRaw.filter((p) => p.league === "WC"),
    fallbackNations: fallbackRaw.filter((p) => ALWAYS_SERVED_NATIONS.has(p.league)),
    fallbackNonWc: usingFallback
      ? fallbackRaw.filter((p) => p.league !== "WC" && !ALWAYS_SERVED_NATIONS.has(p.league))
      : [],
    usingFallback,
  };
}
