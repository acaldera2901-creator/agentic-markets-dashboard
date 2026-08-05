// lib/tools/copy.ts (#TOOLS-HUB-0805)
// Unico accesso al testo dei tool. Le pagine non importano mai un dizionario di
// lingua direttamente: chiedono qui, e un locale sconosciuto ripiega sull'inglese
// invece di far esplodere il render.

import type { ToolLocale } from "./registry";
import type { ToolsCopy } from "./copy/types";
import en from "./copy/en";

export type { ToolsCopy, ToolCopy } from "./copy/types";

export const TOOLS_COPY: Partial<Record<ToolLocale, ToolsCopy>> & { en: ToolsCopy } = {
  en,
};

export function getToolsCopy(locale: ToolLocale): ToolsCopy {
  return TOOLS_COPY[locale] ?? TOOLS_COPY.en;
}
