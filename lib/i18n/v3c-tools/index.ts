// lib/i18n/v3c-tools/index.ts (#REDESIGN-V3C F5)
// Unico accesso alle stringhe nuove delle pagine tool v3c. Inglese = fonte;
// F10: tutte e 11 le lingue complete, un file per lingua (stesse chiavi
// dell'inglese, test di parità in copy.test.ts). FALLBACK_TO_EN resta come
// dichiarazione: una lingua aggiunta senza file ci finisce dentro.
import type { ToolLocale } from "@/lib/tools/registry";
import type { V3cToolsCopy } from "./types";
import en from "./en";
import it from "./it";
import de from "./de";
import es from "./es";
import fr from "./fr";
import nl from "./nl";
import pl from "./pl";
import pt from "./pt";
import ru from "./ru";
import sv from "./sv";
import tr from "./tr";

export type { V3cToolsCopy, V3cToolCopy } from "./types";

export const V3C_TOOLS_COPY: Partial<Record<ToolLocale, V3cToolsCopy>> & { en: V3cToolsCopy } = { en, it, de, es, fr, nl, pl, pt, ru, sv, tr };

/** Le lingue che leggono ancora l'inglese sulle stringhe nuove: nessuna dopo F10. */
export const FALLBACK_TO_EN: readonly ToolLocale[] = [];

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
