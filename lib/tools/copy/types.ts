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
    /** #TOOLS-SAVE-0810 — la riga "salva questo calcolo" sotto il calcolatore.
     *  Sta in `common` e non in `tools` perché è la stessa in tutte e undici le
     *  pagine: undici traduzioni, non centoventuno. Non usa la chrome a 5 lingue
     *  (pick5) perché queste pagine SONO tradotte in undici: mostrare inglese su
     *  /de/tools sarebbe l'unico pezzo non tradotto della pagina. */
    saveCta: string;
    /** Il motivo per registrarsi: lo legge chi NON è loggato. */
    saveHintAnon: string;
    /** Conferma per chi è già loggato. Lo slot esiste in entrambi gli stati. */
    saveHintUser: string;
    savedTitle: string;
    saveError: string;
  };
  tools: Record<ToolSlug, ToolCopy>;
};
