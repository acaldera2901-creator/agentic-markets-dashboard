// lib/tools/copy/types.ts (#TOOLS-HUB-0805)
// Forma del dizionario di una lingua. Il test lib/tools/copy.test.ts verifica che
// ogni lingua registrata la rispetti chiave per chiave: TypeScript garantisce la
// struttura, il test garantisce che non ci siano stringhe vuote o etichette
// inventate che non esistono in inglese.

import type { ToolSlug } from "../registry";

export type ToolCopy = {
  /** <title> della pagina. */
  metaTitle: string;
  /** <meta name="description">, 50–200 caratteri. */
  metaDescription: string;
  h1: string;
  /** Una riga sotto l'H1: cosa fa il tool. */
  lede: string;
  /** Etichette di input e output del calcolatore. Le chiavi sono le stesse in ogni lingua. */
  labels: Record<string, string>;
  formulaTitle: string;
  /** Righe della formula, mostrate in monospaziato. */
  formula: string[];
  explainerTitle: string;
  /** Paragrafi di spiegazione: è il contenuto che si classifica. */
  explainer: string[];
  faq: { q: string; a: string }[];
  /** Solo Kelly: varianza e rischio di rovina. */
  caveat?: string;
};

export type ToolsCopy = {
  hub: {
    metaTitle: string;
    metaDescription: string;
    h1: string;
    lede: string;
    cardCta: string;
    intro: string[];
  };
  common: {
    backLabel: string;
    ctaTitle: string;
    ctaBody: string;
    ctaButton: string;
    otherTools: string;
    langLabel: string;
    free: string;
    faqTitle: string;
    invalid: string;
  };
  tools: Record<ToolSlug, ToolCopy>;
};
