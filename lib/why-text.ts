// Frammenti di testo "Why" in lingua semplice, deterministici, 5 lingue.
// Puro e testabile (lib/why-text.test.ts). Usato dai builder Why di calcio/tennis/WC.

export type WhyLang = "it" | "en" | "es" | "fr" | "ru";
type L5<T> = { it: T; en: T; es: T; fr: T; ru: T };
const p5 = <T,>(lang: WhyLang, v: L5<T>): T => v[lang];
const pct = (v: number) => `${Math.round(v * 100)}%`;

// Forma a parole: "4 vittorie nelle ultime 5" se ≥3 vinte su ≤5 partite;
// altrimenti mood (buono / difficile / altalena). null se counts assenti.
export function formPhrase(c: { w: number; d: number; l: number } | null, lang: WhyLang): string | null {
  if (!c) return null;
  const played = c.w + c.d + c.l;
  if (played > 0 && played <= 5 && c.w >= 3) {
    return p5(lang, {
      it: `${c.w} vittorie nelle ultime ${played}`,
      en: `${c.w} wins in the last ${played}`,
      es: `${c.w} victorias en los últimos ${played}`,
      fr: `${c.w} victoires sur les ${played} derniers`,
      ru: `${c.w} побед в последних ${played}`,
    });
  }
  const good = c.w >= 3 || (c.w >= 2 && c.l === 0);
  const bad = c.l >= 3 || c.w === 0;
  if (good) return p5(lang, { it: "in un buon momento", en: "in good form", es: "en buen momento", fr: "en bonne forme", ru: "в хорошей форме" });
  if (bad) return p5(lang, { it: "in un periodo difficile", en: "going through a rough patch", es: "en un mal momento", fr: "dans une mauvaise passe", ru: "в трудном периоде" });
  return p5(lang, { it: "in forma altalenante", en: "in patchy form", es: "en forma irregular", fr: "en forme irrégulière", ru: "в нестабильной форме" });
}

// Frase gol: "partita da ~3 gol (2-3), Over 2.5 al 58%". over25 in 0..1 (null → no coda).
export function goalsPhrase(eg: number, bandLow: number, bandHigh: number, over25: number | null, lang: WhyLang): string {
  const band = bandLow === bandHigh ? `${bandLow}` : `${bandLow}-${bandHigh}`;
  const egR = Math.round(eg);
  const head = p5(lang, {
    it: `partita da ~${egR} gol (${band})`,
    en: `a ~${egR}-goal game (${band})`,
    es: `partido de ~${egR} goles (${band})`,
    fr: `un match à ~${egR} buts (${band})`,
    ru: `матч на ~${egR} гола (${band})`,
  });
  if (over25 == null) return head;
  const tail = p5(lang, {
    it: `, Over 2.5 al ${pct(over25)}`,
    en: `, Over 2.5 at ${pct(over25)}`,
    es: `, Over 2.5 al ${pct(over25)}`,
    fr: `, Over 2.5 à ${pct(over25)}`,
    ru: `, Тотал больше 2.5 — ${pct(over25)}`,
  });
  return head + tail;
}

// Frase marcatore: "occhio a Mbappé, primo candidato al gol (51%)".
export function scorerPhrase(name: string, pScores: number, lang: WhyLang): string {
  return p5(lang, {
    it: `occhio a ${name}, primo candidato al gol (${pct(pScores)})`,
    en: `watch ${name}, the top scorer pick (${pct(pScores)})`,
    es: `atención a ${name}, principal candidato al gol (${pct(pScores)})`,
    fr: `attention à ${name}, premier candidat au but (${pct(pScores)})`,
    ru: `следите за ${name} — первый кандидат на гол (${pct(pScores)})`,
  });
}

// Confidenza a parole.
export function confidenceWord(strong: boolean, smallSample: boolean, lang: WhyLang): string {
  if (smallSample) return p5(lang, {
    it: "più incertezza per il campione limitato",
    en: "more uncertainty given the small sample",
    es: "más incertidumbre por la muestra limitada",
    fr: "plus d'incertitude vu l'échantillon limité",
    ru: "больше неопределённости из-за малой выборки",
  });
  if (strong) return p5(lang, { it: "lettura solida", en: "a solid read", es: "lectura sólida", fr: "lecture solide", ru: "уверенное чтение" });
  return p5(lang, { it: "partita incerta", en: "an uncertain match", es: "partido incierto", fr: "match incertain", ru: "неопределённый матч" });
}
