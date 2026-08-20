// #URL-PATHS-0810: ogni tab del desk ha un URL path proprio in inglese
// (/predictions, /history, …) al posto del deep-link legacy /app?tab=….
// Mappa unica condivisa da: middleware (redirect permanente dei link legacy,
// che vivono anche in email CRM già inviate), le route wrapper, e la Dashboard
// (risoluzione della tab dal pathname + sync della barra URL al cambio tab).

export const TAB_PATHS = {
  bets: "/predictions",
  history: "/history",
  plans: "/plans",
  leaderboard: "/leaderboard",
  "match-builder": "/match-builder",
  invita: "/invite",
} as const;

export type AppTab = keyof typeof TAB_PATHS;

// Alias dei deep-link legacy: "account" era una tab, ora è il dropdown e i suoi
// link atterrano su Plans (#UI-ACCOUNT-DROPDOWN-0623); "builder" non è mai stato
// in VALID_TABS ma la landing lo linkava (cadeva su bets: qui va al builder vero).
export const TAB_ALIASES: Record<string, AppTab> = {
  account: "plans",
  builder: "match-builder",
};

export const PATH_TO_TAB: Record<string, AppTab> = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as AppTab]),
);

export function normalizeTab(raw: string | null): AppTab | null {
  if (!raw) return null;
  // hasOwn: l'input è URL utente, chiavi ereditate ("constructor", …) non contano
  const requested = Object.hasOwn(TAB_ALIASES, raw) ? TAB_ALIASES[raw] : raw;
  return Object.hasOwn(TAB_PATHS, requested) ? (requested as AppTab) : null;
}
