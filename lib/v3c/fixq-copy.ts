// lib/v3c/fixq-copy.ts (#REDESIGN-V3C fixq) — the strings of Q6 and Q9 (QA-REPORT-4):
// Q6 a sealed tennis row of OUR model (tempered Elo) is not «market-based» — the seal says what it is;
// Q9 why a tennis gap is missing, in words (it was the API's technical string, in English in every language).
// A file of its own, checked by lib/v3c/i18n-parity.test.ts. // REVIEW-NATIVE
import { v3cLang, type V3cLang } from "./copy";

export type FixqCopy = {
  /** Q6: the seal of a tennis row whose sealed number is our Elo (model_tempered), not the market */
  sealedWhyModel: (t: string) => string;
  /** Q9: sealed, but no partner price was stored just before the seal */
  gapNoSealMarket: string;
  /** Q9: not sealed yet */
  gapNotSealed: string;
  /** Q9: the number is the market itself (no model of ours) */
  gapIsMarket: string;
};

const EN: FixqCopy = {
  sealedWhyModel: (t) => `Entered the public ledger on ${t}, before the start. The sealed number is our Elo model.`,
  gapNoSealMarket: "No partner price was stored just before the seal, so there is no gap to show.",
  gapNotSealed: "Not sealed yet, so there is no gap to show.",
  gapIsMarket: "The number is the market price, margin removed: no gap against itself.",
};

const IT: FixqCopy = {
  sealedWhyModel: (t) => `Entrata nel registro pubblico il ${t}, prima dell’inizio. Il numero sigillato è il nostro modello Elo.`,
  gapNoSealMarket: "Nessun prezzo partner salvato poco prima del sigillo: nessun gap da mostrare.",
  gapNotSealed: "Non ancora sigillata: nessun gap da mostrare.",
  gapIsMarket: "Il numero è il prezzo di mercato, margine tolto: nessun gap con sé stesso.",
};

const DE: FixqCopy = {
  sealedWhyModel: (t) => `Am ${t} vor Beginn ins öffentliche Register eingetragen. Die versiegelte Zahl ist unser Elo-Modell.`,
  gapNoSealMarket: "Kurz vor der Versiegelung wurde keine Partnerquote gespeichert: keine Differenz zu zeigen.",
  gapNotSealed: "Noch nicht versiegelt: keine Differenz zu zeigen.",
  gapIsMarket: "Die Zahl ist die Marktquote ohne Marge: keine Differenz zu sich selbst.",
};

const ES: FixqCopy = {
  sealedWhyModel: (t) => `Entró en el registro público el ${t}, antes del inicio. El número sellado es nuestro modelo Elo.`,
  gapNoSealMarket: "No se guardó ninguna cuota de socios justo antes del sellado: no hay diferencia que mostrar.",
  gapNotSealed: "Aún sin sellar: no hay diferencia que mostrar.",
  gapIsMarket: "El número es la cuota de mercado sin margen: no hay diferencia consigo misma.",
};

const FR: FixqCopy = {
  sealedWhyModel: (t) => `Inscrit au registre public le ${t}, avant le début. Le chiffre scellé est notre modèle Elo.`,
  gapNoSealMarket: "Aucune cote partenaire enregistrée juste avant le scellé : pas d’écart à montrer.",
  gapNotSealed: "Pas encore scellé : pas d’écart à montrer.",
  gapIsMarket: "Le chiffre est la cote du marché, marge retirée : pas d’écart avec elle-même.",
};

const NL: FixqCopy = {
  sealedWhyModel: (t) => `Op ${t} vóór de start in het openbare register gezet. Het verzegelde getal is ons Elo-model.`,
  gapNoSealMarket: "Vlak voor het verzegelen is geen partnerprijs opgeslagen: geen verschil om te tonen.",
  gapNotSealed: "Nog niet verzegeld: geen verschil om te tonen.",
  gapIsMarket: "Het getal is de marktprijs zonder marge: geen verschil met zichzelf.",
};

const PL: FixqCopy = {
  sealedWhyModel: (t) => `Wpisany do publicznego rejestru ${t}, przed początkiem. Zapieczętowana liczba to nasz model Elo.`,
  gapNoSealMarket: "Tuż przed zapieczętowaniem nie zapisano kursu partnera: brak różnicy do pokazania.",
  gapNotSealed: "Jeszcze niezapieczętowany: brak różnicy do pokazania.",
  gapIsMarket: "Liczba to kurs rynkowy bez marży: brak różnicy z samym sobą.",
};

const PT: FixqCopy = {
  sealedWhyModel: (t) => `Entrou no registo público a ${t}, antes do início. O número selado é o nosso modelo Elo.`,
  gapNoSealMarket: "Nenhuma odd de parceiro guardada mesmo antes do selo: não há diferença a mostrar.",
  gapNotSealed: "Ainda não selado: não há diferença a mostrar.",
  gapIsMarket: "O número é a odd de mercado sem margem: não há diferença consigo mesma.",
};

const RU: FixqCopy = {
  sealedWhyModel: (t) => `Внесён в публичный реестр ${t}, до начала. Зафиксированное число — наша модель Elo.`,
  gapNoSealMarket: "Перед фиксацией не сохранён ни один коэффициент партнёров: разницы нет.",
  gapNotSealed: "Ещё не зафиксировано: разницы нет.",
  gapIsMarket: "Число — это рыночный коэффициент без маржи: разницы с самим собой нет.",
};

const SV: FixqCopy = {
  sealedWhyModel: (t) => `Fördes in i det öppna registret ${t}, före start. Den förseglade siffran är vår Elo-modell.`,
  gapNoSealMarket: "Inget partnerpris sparades strax före förseglingen: ingen skillnad att visa.",
  gapNotSealed: "Inte förseglad än: ingen skillnad att visa.",
  gapIsMarket: "Siffran är marknadens pris utan marginal: ingen skillnad mot sig själv.",
};

const TR: FixqCopy = {
  sealedWhyModel: (t) => `${t} tarihinde, başlamadan önce açık kayıt defterine girdi. Mühürlü sayı bizim Elo modelimizdir.`,
  gapNoSealMarket: "Mühürden hemen önce kaydedilmiş bir ortak oranı yok: gösterilecek fark yok.",
  gapNotSealed: "Henüz mühürlenmedi: gösterilecek fark yok.",
  gapIsMarket: "Sayı, marj hariç piyasa oranıdır: kendisiyle farkı yok.",
};

export const FIXQ_COPY: Record<V3cLang, FixqCopy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function fixqCopyFor(lang: string | null | undefined): FixqCopy {
  return FIXQ_COPY[v3cLang(lang)];
}

/**
 * Q9: the API's `gap_null_reason` of a tennis match (an English technical string) → words in the visitor's language.
 * `farText` is the sealed-Elo guard sentence already on the page (fixdata2 sealedFar). Unknown → the market sentence.
 */
export function tennisGapNote(reason: string | null | undefined, lang: string | null | undefined, farText: string): string {
  const c = fixqCopyFor(lang);
  const r = reason ?? "";
  if (r.startsWith("no FortunePlay") || r.includes("before the seal")) return c.gapNoSealMarket;
  if (r === "not sealed yet") return c.gapNotSealed;
  if (r.startsWith("the sealed Elo is")) return farText;
  return c.gapIsMarket;
}

/** Q6: a tennis row whose SEALED number is our tempered Elo (the seal says «our Elo model», not «market-based»). */
export function sealedOurs(m: { probability_kind?: string | null; sealed_at: string | null; sides: readonly { sealed_p: number | null }[] }): boolean {
  return m.probability_kind === "model_tempered" && m.sealed_at != null && m.sides.some((x) => x.sealed_p != null);
}
