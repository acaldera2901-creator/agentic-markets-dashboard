// lib/v3c/fixui3-copy.ts (#REDESIGN-V3C fixui3) — the strings of the fourth round, QA-REPORT-3:
// R4 (tools: «Example» on the worked example, the neutral placeholder, the words of a preview line),
// L1 + B3 (/profilo and /invite with no account to reach in Fase 0). 11 languages, parity in
// lib/v3c/i18n-parity.test.ts. Terms from docs/redesign/i18n-glossary.md.
import type { PreviewWords } from "./tools";
import { v3cLang, type V3cLang } from "./copy";

export type Fixui3Copy = {
  /** the label over each tool page's worked example */
  example: string;
  /** «e.g.»: before the placeholder of an empty amount field («e.g. 10») and the money previews */
  eg: string;
  /** the words of a preview line: «2.15 at 48%», «400 on 1,000», «200 bets», «2% unit» */
  at: string;
  on: string;
  bets: string;
  unit: string;
  /** /profilo and /invite in Fase 0 */
  accountSoon: string;
  accountSoonBody: string;
};

const EN: Fixui3Copy = {
  example: "Example",
  eg: "e.g.",
  at: "at",
  on: "on",
  bets: "bets",
  unit: "unit",
  accountSoon: "Account: coming with Pro.",
  accountSoonBody: "Nothing on BetRedge needs an account today.",
};

const IT: Fixui3Copy = {
  example: "Esempio",
  eg: "es.",
  at: "a",
  on: "su",
  bets: "scommesse",
  unit: "unità",
  accountSoon: "Account: arriva con Pro.",
  accountSoonBody: "Oggi niente su BetRedge richiede un account.",
};

export const FIXUI3_COPY: Record<V3cLang, Fixui3Copy> = {
  en: EN,
  it: IT,
  de: { example: "Beispiel", eg: "z. B.", at: "bei", on: "auf", bets: "Wetten", unit: "Einheit", accountSoon: "Konto: kommt mit Pro.", accountSoonBody: "Heute braucht nichts auf BetRedge ein Konto." },
  es: { example: "Ejemplo", eg: "p. ej.", at: "a", on: "sobre", bets: "apuestas", unit: "unidad", accountSoon: "Cuenta: llega con Pro.", accountSoonBody: "Hoy nada en BetRedge necesita una cuenta." },
  fr: { example: "Exemple", eg: "ex.", at: "à", on: "sur", bets: "paris", unit: "unité", accountSoon: "Compte : arrive avec Pro.", accountSoonBody: "Aujourd’hui, rien sur BetRedge ne demande de compte." },
  nl: { example: "Voorbeeld", eg: "bijv.", at: "bij", on: "op", bets: "weddenschappen", unit: "eenheid", accountSoon: "Account: komt met Pro.", accountSoonBody: "Vandaag heeft niets op BetRedge een account nodig." },
  pl: { example: "Przykład", eg: "np.", at: "przy", on: "na", bets: "zakładów", unit: "jednostka", accountSoon: "Konto: pojawi się z Pro.", accountSoonBody: "Dziś nic na BetRedge nie wymaga konta." },
  pt: { example: "Exemplo", eg: "ex.", at: "a", on: "sobre", bets: "apostas", unit: "unidade", accountSoon: "Conta: chega com o Pro.", accountSoonBody: "Hoje nada no BetRedge precisa de conta." },
  ru: { example: "Пример", eg: "напр.", at: "при", on: "на", bets: "ставок", unit: "единица", accountSoon: "Аккаунт: появится вместе с Pro.", accountSoonBody: "Сегодня на BetRedge ничего не требует аккаунта." },
  sv: { example: "Exempel", eg: "t.ex.", at: "vid", on: "på", bets: "spel", unit: "enhet", accountSoon: "Konto: kommer med Pro.", accountSoonBody: "I dag kräver inget på BetRedge ett konto." },
  tr: { example: "Örnek", eg: "örn.", at: "ile", on: "üzerinden", bets: "bahis", unit: "birim", accountSoon: "Hesap: Pro ile geliyor.", accountSoonBody: "Bugün BetRedge'de hiçbir şey hesap gerektirmiyor." },
};

export function fixui3CopyFor(lang: string | null | undefined): Fixui3Copy {
  return FIXUI3_COPY[v3cLang(lang)];
}

/** The preview words of a language, for lib/v3c/tools `toolPreview` / `previewInput`. */
export function previewWordsFor(lang: string | null | undefined): PreviewWords {
  const c = fixui3CopyFor(lang);
  return { at: c.at, on: c.on, bets: c.bets, unit: c.unit, eg: c.eg };
}

/** The placeholder of an empty amount field: «e.g. 10» — a hint, never a value. */
export function amountPlaceholder(lang: string | null | undefined): string {
  return `${fixui3CopyFor(lang).eg} 10`;
}
