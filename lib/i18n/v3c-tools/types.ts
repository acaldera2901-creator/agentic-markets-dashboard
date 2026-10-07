// lib/i18n/v3c-tools/types.ts (#REDESIGN-V3C F5)
// Le stringhe NUOVE delle pagine tool v3c (hub «il banco» e pagina tool).
// Tutto ciò che la pagina già diceva (meta, h1 SEO, spiegazioni, esempi, FAQ)
// resta in lib/tools/copy — qui solo ciò che il redesign aggiunge. Ogni
// stringa a schermo sta sotto le 22 parole (gate e2e). I segnaposto sono
// `{nome}` e si riempiono con fmt() di index.ts.
import type { ToolSlug } from "@/lib/tools/registry";
import type { QuestionId } from "@/lib/v3c/tools";

export type V3cToolCopy = {
  name: string;
  /** La riga d'uso sotto il nome. */
  line: string;
  /** Etichette degli input, per chiave del motore. */
  inputs: Record<string, string>;
  /** Etichette dei risultati, per chiave del motore (con {var}). */
  results: Record<string, string>;
  /** La formula in una riga, in parole. */
  formula: string;
  /** L'intestazione della colonna «sul board di oggi», se il tool ne ha una. */
  column?: string;
  /** final6: an advisory line under the inputs (Kelly, bankroll: the bankroll is never assumed). */
  note?: string;
};

export type V3cToolsCopy = {
  nav: {
    board: string;
    tools: string;
    price: string;
    priceShort: string;
    record: string;
    books: string;
    news: string;
    pro: string;
    /** polish: la voce «Metodo» e «Prezzi» della barra unica */
    method: string;
    pricing: string;
    signIn: string;
    skip: string;
    primary: string;
    primaryMobile: string;
    brand: string;
    toPaper: string;
    toDark: string;
    language: string;
  };
  footer: {
    tagline: string;
    product: string;
    trust: string;
    booksCol: string;
    toolsLink: string;
    method: string;
    terms: string;
    privacy: string;
    responsible: string;
    notAdvice: string;
    blend: string;
    affiliates: string;
    /** polish: il piè di pagina unico */
    account: string;
    legal: string;
    helpTitle: string;
    helpLine: string;
  };
  hub: {
    tab: string;
    title: string;
    metaStrong: string;
    metaRest: string;
    searchLabel: string;
    searchPlaceholder: string;
    /** «{n} tools · examples from {match}» */
    count: string;
    /** «{n} of {total} tools match “{q}”» */
    countMatch: string;
    /** «No tool is called “{q}”…» */
    empty: string;
    toolsN: string;
    toolOne: string;
    notATool: string;
    lineQ: string;
    lineS: string;
    /** «{match} · price since opening» */
    lineRow: string;
    lineRowLine: string;
    priceCheck: string;
    priceCheckLine: string;
    explain: string;
    openBoard: string;
    sampleNote: string;
  };
  questions: Record<QuestionId, { q: string; s: string }>;
  tool: {
    /** «Tool · free · {q}» */
    tab: string;
    crumbs: string;
    /** «prefilled from {match} · {outcome} {price}» */
    prefilled: string;
    typeYours: string;
    sameMaths: string;
    /** «Lead outcome of each match · prices as of {asOf}» */
    leadAsOf: string;
    colMatch: string;
    colPrice: string;
    colEstimate: string;
    tapRow: string;
    pickLegs: string;
    pickLegsBody: string;
    sameRatio: string;
    sameRatioBody: string;
    openBoard: string;
    seeRecord: string;
    allTools: string;
    noStake: string;
    invalid: string;
    sample: string;
  };
  tools: Record<ToolSlug, V3cToolCopy>;
};
