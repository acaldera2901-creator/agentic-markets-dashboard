// #PRELAUNCH-AUDIT: gating per-tier dell'enrichment, single source of truth.
// I blocchi "deep" (form/xG/infortuni/venue/lambdas/mercati soft…) sono Pro-only
// (#PLANS-3TIER-1). Prima le chiavi vivevano inline solo in /api/predictions, mentre
// /api/data serializzava l'enrichment GREZZO a qualsiasi pagante (base incluso) →
// leak di feature Pro al tier Base. Ora la lista è condivisa e lo strip riusabile.

export const PREMIUM_ENRICHMENT_KEYS = [
  "pi_home", "pi_away",
  "xg_home", "xga_home", "xg_away", "xga_away", "npxg_home", "npxg_away",
  "ppda_home", "ppda_away",
  "injuries_home", "injuries_away",
  "weather",
  "api_pct_home", "api_pct_draw", "api_pct_away", "api_advice",
  "research",
  // World Cup enrichment (unified fallback rows): blocchi deep = paid-tier.
  "venue", "squad", "market", "lambdas",
  // Mercati marcatore (B-serve): blocco Pro-only.
  "goalscorer_markets",
  // Mercati soft (corner/cartellini/falli) — Pro-only (#SOFT-MARKETS).
  "soft",
] as const;

// Rimuove i blocchi Pro-only dall'enrichment quando l'utente NON è Pro. `isPaid`
// (base+) mantiene l'edge per-mercato in extra_markets; il free lo perde. Ritorna
// un NUOVO oggetto (non muta l'input). null-safe.
export function stripPremiumEnrichment<T extends Record<string, unknown> | null | undefined>(
  enrichment: T,
  isPro: boolean,
  isPaid: boolean
): T {
  if (!enrichment || isPro) return enrichment;
  const e: Record<string, unknown> = { ...(enrichment as Record<string, unknown>) };
  for (const k of PREMIUM_ENRICHMENT_KEYS) delete e[k];
  const em = e.extra_markets as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(em)) {
    e.extra_markets = em.map((market) => {
      const rest = { ...market };
      if (!isPaid) delete rest.edge;
      return rest;
    });
  }
  return e as T;
}
