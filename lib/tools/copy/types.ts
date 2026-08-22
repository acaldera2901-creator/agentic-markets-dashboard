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
  /** La frase da portarsi a casa: sta in evidenza sotto il calcolatore, prima del
   *  testo lungo. Chi legge solo questa ha già capito la pagina. */
  takeaway: string;
  /** Esempio numerico lavorato — ha preso il posto del blocco formula su TUTTE
   *  le pagine (richiesta Andrea, 2026-08-05: i simboli non li legge nessuno).
   *  I numeri sono identici in ogni lingua, si traducono solo le etichette. */
  example: {
    title: string;
    rows: { label: string; value: string }[];
    note: string;
  };
  explainerTitle: string;
  /** Paragrafi di spiegazione. Il PRIMO è reso più grande (attacco editoriale) e
   *  `**doppio asterisco**` marca le frasi chiave: senza appigli visivi un muro
   *  di testo grigio non lo legge nessuno. */
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
    /** Canale Telegram: la voce subordinata alla CTA di prodotto. È l'ingresso a
     *  basso attrito per il traffico organico freddo dei tool, che un account non
     *  lo apre: un tap, nessuna email. Il canale è in inglese, e ogni lingua che
     *  non è l'inglese lo dice — meglio dirlo prima del tap che dopo. */
    tgTitle: string;
    tgBody: string;
    tgButton: string;
  };
  tools: Record<ToolSlug, ToolCopy>;
};
