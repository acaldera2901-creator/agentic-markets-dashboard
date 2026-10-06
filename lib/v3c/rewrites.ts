// lib/v3c/rewrites.ts (#REDESIGN-V3C F3) — le rewrite del redesign, pure.
// Flag acceso: "/" → /v3c e "/predictions" → /v3c/predictions, in beforeFiles
// (le due pagine esistono nel filesystem: una rewrite afterFiles non le
// toccherebbe mai). La URL nel browser, il canonical e il JSON-LD restano
// quelli di oggi. Flag spento: nessuna rewrite, nessun cambiamento.
// Il flag si legge a BUILD (NEXT_PUBLIC_*): accenderlo richiede un deploy,
// spegnerlo anche — il rollback senza redeploy resta il `vercel rollback`.
import { envFlagOn } from "../redesign-flag";

type Rewrite = { source: string; destination: string };

export function v3cRewrites(flag: string | undefined | null): { beforeFiles: Rewrite[] } | Rewrite[] {
  if (!envFlagOn(flag)) return [];
  return {
    beforeFiles: [
      { source: "/", destination: "/v3c" },
      { source: "/predictions", destination: "/v3c/predictions" },
      // F4: due URL NUOVI. Spento non esistono (404 di sempre); acceso servono le pagine v3c.
      { source: "/match/:id", destination: "/v3c/match/:id" },
      { source: "/price-check", destination: "/v3c/price-check" },
      // F6: /record non esiste nel filesystem — la rewrite serve la pagina v3c
      { source: "/record", destination: "/v3c/record" },
    ],
  };
}

type Redirect = { source: string; destination: string; permanent: true };

/**
 * F6: a flag acceso il registro vecchio (/history, che leggeva unified_predictions)
 * e la tab /risultati portano su /record con un 308 (permanent → Next risponde 308,
 * query conservata). Spento: lista vuota, /history resta quella di oggi.
 * SEO: /history aveva 0 impressioni in Search Console (audit 15/09: solo / e /privacy).
 */
export function v3cRedirects(flag: string | undefined | null): Redirect[] {
  if (!envFlagOn(flag)) return [];
  return [
    { source: "/history", destination: "/record", permanent: true },
    { source: "/risultati", destination: "/record", permanent: true },
  ];
}
