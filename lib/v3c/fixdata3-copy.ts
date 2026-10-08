// lib/v3c/fixdata3-copy.ts (#REDESIGN-V3C fixdata3) — the strings of R3 (QA-REPORT-3): a tennis market whose
// stored price is older than 6 h and that no partner book prices now. A file of its own so the parallel UI filone
// (fixui3) and this one never edit the same dictionary. Checked by lib/v3c/i18n-parity.test.ts. // REVIEW-NATIVE
import { v3cLang, type V3cLang } from "./copy";

export type Fixdata3Copy = {
  /** R3: the label of a market read from an old stored price (no book prices it now) */
  staleLabel: string;
  /** R3: the note under it, with the age «22 h» (fixq Q9: hours, not hh:mm) */
  staleNote: (age: string) => string;
  /** R3: the age of the price shown, «22 h» (fixq Q9: hours, not hh:mm) */
  priceAge: (age: string) => string;
};

const EN: Fixdata3Copy = {
  staleLabel: "Market only: price may be outdated",
  staleNote: (age) => `Last stored price, ${age} old. No partner book prices it now: no estimate or gap.`,
  priceAge: (age) => `Price age ${age}`,
};

const IT: Fixdata3Copy = {
  staleLabel: "Solo mercato: il prezzo potrebbe essere superato",
  staleNote: (age) => `Ultimo prezzo salvato, vecchio di ${age}. Nessun book partner lo quota ora: niente stima né gap.`,
  priceAge: (age) => `Età del prezzo ${age}`,
};

const DE: Fixdata3Copy = {
  staleLabel: "Nur Markt: Quote möglicherweise veraltet",
  staleNote: (age) => `Zuletzt gespeicherte Quote, ${age} alt. Kein Partner-Buchmacher bietet sie jetzt an: keine Schätzung, keine Differenz.`,
  priceAge: (age) => `Alter der Quote ${age}`,
};

const ES: Fixdata3Copy = {
  staleLabel: "Solo mercado: el precio puede estar desactualizado",
  staleNote: (age) => `Último precio guardado, de hace ${age}. Ninguna casa asociada lo ofrece ahora: sin estimación ni diferencia.`,
  priceAge: (age) => `Antigüedad del precio ${age}`,
};

const FR: Fixdata3Copy = {
  staleLabel: "Marché seul : la cote est peut-être périmée",
  staleNote: (age) => `Dernière cote enregistrée, il y a ${age}. Aucun bookmaker partenaire ne la propose : ni estimation ni écart.`,
  priceAge: (age) => `Âge de la cote ${age}`,
};

const NL: Fixdata3Copy = {
  staleLabel: "Alleen markt: prijs mogelijk verouderd",
  staleNote: (age) => `Laatst opgeslagen prijs, ${age} oud. Geen partnerbookmaker biedt hem nu aan: geen schatting of verschil.`,
  priceAge: (age) => `Leeftijd van de prijs ${age}`,
};

const PL: Fixdata3Copy = {
  staleLabel: "Tylko rynek: kurs może być nieaktualny",
  staleNote: (age) => `Ostatni zapisany kurs, sprzed ${age}. Żaden bukmacher partnerski go teraz nie oferuje: bez szacunku i różnicy.`,
  priceAge: (age) => `Wiek kursu ${age}`,
};

const PT: Fixdata3Copy = {
  staleLabel: "Só mercado: a odd pode estar desatualizada",
  staleNote: (age) => `Última odd guardada, de há ${age}. Nenhuma casa parceira a oferece agora: sem estimativa nem diferença.`,
  priceAge: (age) => `Idade da odd ${age}`,
};

const RU: Fixdata3Copy = {
  staleLabel: "Только рынок: цена может быть устаревшей",
  staleNote: (age) => `Последняя сохранённая цена, ${age} назад. Сейчас её не предлагает ни один букмекер-партнёр: без оценки и разницы.`,
  priceAge: (age) => `Возраст цены ${age}`,
};

const SV: Fixdata3Copy = {
  staleLabel: "Endast marknad: priset kan vara inaktuellt",
  staleNote: (age) => `Senast sparade pris, ${age} gammalt. Ingen partnerbookmaker erbjuder det nu: ingen uppskattning eller skillnad.`,
  priceAge: (age) => `Prisets ålder ${age}`,
};

const TR: Fixdata3Copy = {
  staleLabel: "Yalnızca piyasa: oran güncel olmayabilir",
  staleNote: (age) => `Son kaydedilen oran, ${age} önce. Şu an hiçbir partner bahis sitesi sunmuyor: tahmin ve fark yok.`,
  priceAge: (age) => `Oranın yaşı ${age}`,
};

export const FIXDATA3_COPY: Record<V3cLang, Fixdata3Copy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function fixdata3CopyFor(lang: string | null | undefined): Fixdata3Copy {
  return FIXDATA3_COPY[v3cLang(lang)];
}
