// lib/v3c/time-ui.ts (#REDESIGN-V3C fixui · QA M2 / UX-AUDIT #8) — UN fuso in tutta
// l'interfaccia: l'ora locale del browser, con la sigla del fuso dichiarata una volta
// per vista (components/v3c/guide/TzNote). Il server e il primo render non conoscono il
// fuso (useLocalTimeZone → undefined) e scrivono UTC: la sigla allora dice «UTC», così
// il numero e la sua etichetta restano sempre coerenti. UTC esplicito resta SOLO
// dentro la ricevuta del registro (record-view.ts), che è un documento.
// Puro: niente React, testabile.

/** «5 Oct, 20:02» nel fuso dato (undefined = UTC), senza sigla: la sigla sta nella nota della vista. */
export function stampLocal(iso: string | null | undefined, timeZone: string | undefined, locale = "en-GB"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = timeZone ?? "UTC";
  const day = new Intl.DateTimeFormat(locale, { timeZone: tz, day: "numeric", month: "short" }).format(d);
  const hm = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${day}, ${hm}`;
}

/** «14:05» nel fuso dato (undefined = UTC). */
export function hmLocal(iso: string | null | undefined, timeZone: string | undefined, locale = "en-GB"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { timeZone: timeZone ?? "UTC", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** La sigla del fuso («CEST», «GMT+2», «UTC») all'istante `at`; undefined = UTC. */
export function tzAbbr(timeZone: string | undefined, locale = "en-GB", at: Date = new Date()): string {
  if (!timeZone || timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName");
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}
