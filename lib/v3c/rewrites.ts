// lib/v3c/rewrites.ts (#REDESIGN-V3C F3) — le rewrite del redesign, pure.
// Flag acceso: "/" → /v3c e "/predictions" → /v3c/predictions, in beforeFiles
// (le due pagine esistono nel filesystem: una rewrite afterFiles non le
// toccherebbe mai). La URL nel browser, il canonical e il JSON-LD restano
// quelli di oggi. Flag spento: nessuna rewrite, nessun cambiamento.
// Il flag si legge a BUILD (NEXT_PUBLIC_*): accenderlo richiede un deploy,
// spegnerlo anche — il rollback senza redeploy resta il `vercel rollback`.
// v3c-int: questa è l'UNICA lista di rewrite del redesign (F3+F4+F5+F6+pages);
// i redirect stanno in lib/v3c/redirects.ts.
import { envFlagOn } from "../redesign-flag";
import { V3C_PAGE_PATHS } from "./pages-routes";

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
      // pages: News/Books/Pro/Metodo/community/legali (elenco in lib/v3c/pages-routes.ts)
      ...V3C_PAGE_PATHS.map((p) => ({ source: p, destination: `/v3c${p}` })),
    ],
  };
}
