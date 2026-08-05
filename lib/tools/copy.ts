// lib/tools/copy.ts (#TOOLS-HUB-0805)
// Unico accesso al testo dei tool. Le pagine non importano mai un dizionario di
// lingua direttamente: chiedono qui, e un locale sconosciuto ripiega sull'inglese
// invece di far esplodere il render.

import type { ToolLocale } from "./registry";
import type { ToolsCopy } from "./copy/types";
import en from "./copy/en";
import it from "./copy/it";
import es from "./copy/es";
import fr from "./copy/fr";
import de from "./copy/de";
import pt from "./copy/pt";
import nl from "./copy/nl";
import pl from "./copy/pl";
import tr from "./copy/tr";
import sv from "./copy/sv";
import ru from "./copy/ru";

export type { ToolsCopy, ToolCopy } from "./copy/types";

export const TOOLS_COPY: Partial<Record<ToolLocale, ToolsCopy>> & { en: ToolsCopy } = {
  en,
  it,
  es,
  fr,
  de,
  pt,
  nl,
  pl,
  tr,
  sv,
  ru,
};

export function getToolsCopy(locale: ToolLocale): ToolsCopy {
  return TOOLS_COPY[locale] ?? TOOLS_COPY.en;
}
