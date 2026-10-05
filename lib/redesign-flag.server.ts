// lib/redesign-flag.server.ts (#REDESIGN-V3C F0)
// Lettura del flag lato server (Server Components, route handler). Usa
// `cookies()` di next/headers, che è async e rende dinamica la rotta che lo
// chiama: va bene per le rotte del redesign, che sono già per-richiesta.
import { cookies } from "next/headers";
import { REDESIGN_COOKIE, REDESIGN_ENV, resolveRedesign } from "./redesign-flag";

export async function isRedesignEnabled(): Promise<boolean> {
  const store = await cookies();
  return resolveRedesign(process.env[REDESIGN_ENV], store.get(REDESIGN_COOKIE)?.value);
}
