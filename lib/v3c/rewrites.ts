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
    ],
  };
}
