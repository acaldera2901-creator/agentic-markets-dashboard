// lib/events-write-gate.ts — #SESSIONI-1006 leva 1
//
// Misurato il 06/10 (docs/proposals/sessioni-1006.md §3, classe 1): 223
// page_view in 30 giorni senza header geo, a raffica, con `ref_host=localhost`
// e `utm=test123` — dev e preview che scrivevano sulla tabella `events` di
// PRODUZIONE, perche' DATABASE_URL e' lo stesso. Gonfiavano il denominatore
// della torre senza essere traffico.
//
// La regola: un CONTATORE di analytics si scrive solo dal deploy di
// produzione. Fuori produzione la route risponde come per un evento fuori
// allowlist, `{ok:true, ignored:true}`, e il client non se ne accorge.
//
// Vale per i contatori (browser analytics, `signup_geo_denied`, il contatore
// dei bot scartati). NON vale per i record che documentano un cambio di stato
// gia' avvenuto sul DB (paygate, weekly pick, audit admin, plan grant): se il
// cambio avviene, il suo record deve esserci, da qualunque ambiente arrivi.
//
// Override esplicito per i test e2e: TRACK_ALLOW_WRITE=1.

type Env = Record<string, string | undefined>;

export function analyticsWriteAllowed(env: Env = process.env): boolean {
  if (env.TRACK_ALLOW_WRITE === "1") return true;
  return env.VERCEL_ENV === "production";
}
