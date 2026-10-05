// lib/i18n/v3c-tools/index.ts (#REDESIGN-V3C F5)
// Unico accesso alle stringhe nuove delle pagine tool v3c. Inglese = fonte;
// italiano completo; le altre nove lingue ricadono sull'inglese ed è
// DICHIARATO qui (FALLBACK_TO_EN), non un caso: la traduzione completa è la
// fase F10 (chiavi elencate in docs/redesign/v3c-f5-i18n-keys.md).
import type { ToolLocale } from "@/lib/tools/registry";
import type { V3cToolsCopy } from "./types";
import en from "./en";
import it from "./it";

export type { V3cToolsCopy, V3cToolCopy } from "./types";

export const V3C_TOOLS_COPY: Partial<Record<ToolLocale, V3cToolsCopy>> & { en: V3cToolsCopy } = { en, it };

/** Le lingue che oggi leggono l'inglese sulle stringhe nuove (F10 le completa). */
export const FALLBACK_TO_EN: readonly ToolLocale[] = ["es", "fr", "de", "pt", "nl", "pl", "tr", "sv", "ru"];

export function getV3cToolsCopy(locale: ToolLocale): V3cToolsCopy {
  return V3C_TOOLS_COPY[locale] ?? V3C_TOOLS_COPY.en;
}

/** `true` se le stringhe nuove di questa lingua sono ancora in inglese. */
export function isFallbackLocale(locale: ToolLocale): boolean {
  return V3C_TOOLS_COPY[locale] == null;
}

/** Riempie i segnaposto `{nome}`. Un segnaposto senza valore resta visibile: meglio vederlo che perderlo. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
