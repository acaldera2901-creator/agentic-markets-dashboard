// lib/v3c/final7-copy.ts (#REDESIGN-V3C final7) — the strings of R5 (QA-REPORT-3) and of the «Market only» check:
// a tennis match with NO market reads «No market» on the board and on its page (never «Market only», never a
// price time); a market that may be outdated is one message with its age; a football row under the 25 pp guard
// does not explain an estimate it does not show. A file of its own, checked by lib/v3c/i18n-parity.test.ts. // REVIEW-NATIVE
import { v3cLang, type V3cLang } from "./copy";

export type Final7Copy = {
  /** R5: the label of a tennis match no book prices (board row and match page, the same words) */
  noMarket: string;
  /** R5: the note under it */
  noMarketNote: string;
  /** R5: the label of a price that may be outdated, always with its age «22 h» (fixq Q9: hours, not hh:mm) */
  staleAged: (age: string) => string;
  /** football > 25 pp: why the number shown is the market (in place of the 70/30 explanation) */
  guardMarketBody: string;
};

const EN: Final7Copy = {
  noMarket: "No market",
  noMarketNote: "No book prices this match yet: no market, no estimate, no gap.",
  staleAged: (age) => `Market only: price may be outdated, ${age} old`,
  guardMarketBody: "Our model differs too much from the market to show: the number is the market, margin removed.",
};

const IT: Final7Copy = {
  noMarket: "Senza mercato",
  noMarketNote: "Nessun book quota ancora questa partita: niente mercato, stima né gap.",
  staleAged: (age) => `Solo mercato: il prezzo potrebbe essere superato, vecchio di ${age}`,
  guardMarketBody: "Il nostro modello si discosta troppo dal mercato per mostrarlo: il numero è il mercato, margine tolto.",
};

const DE: Final7Copy = {
  noMarket: "Kein Markt",
  noMarketNote: "Noch kein Buchmacher bietet dieses Spiel an: kein Markt, keine Schätzung, keine Differenz.",
  staleAged: (age) => `Nur Markt: Quote möglicherweise veraltet, ${age} alt`,
  guardMarketBody: "Unser Modell weicht zu stark vom Markt ab, um es zu zeigen: die Zahl ist der Markt, ohne Marge.",
};

const ES: Final7Copy = {
  noMarket: "Sin mercado",
  noMarketNote: "Ninguna casa ofrece aún este partido: sin mercado, estimación ni diferencia.",
  staleAged: (age) => `Solo mercado: el precio puede estar desactualizado, de hace ${age}`,
  guardMarketBody: "Nuestro modelo se aleja demasiado del mercado para mostrarlo: el número es el mercado, sin margen.",
};

const FR: Final7Copy = {
  noMarket: "Pas de marché",
  noMarketNote: "Aucun bookmaker ne propose encore ce match : ni marché, ni estimation, ni écart.",
  staleAged: (age) => `Marché seul : la cote est peut-être périmée, il y a ${age}`,
  guardMarketBody: "Notre modèle s’écarte trop du marché pour être affiché : le chiffre est le marché, marge retirée.",
};

const NL: Final7Copy = {
  noMarket: "Geen markt",
  noMarketNote: "Nog geen bookmaker biedt deze wedstrijd aan: geen markt, schatting of verschil.",
  staleAged: (age) => `Alleen markt: prijs mogelijk verouderd, ${age} oud`,
  guardMarketBody: "Ons model wijkt te veel af van de markt om te tonen: het getal is de markt, zonder marge.",
};

const PL: Final7Copy = {
  noMarket: "Brak rynku",
  noMarketNote: "Żaden bukmacher nie oferuje jeszcze tego meczu: bez rynku, szacunku i różnicy.",
  staleAged: (age) => `Tylko rynek: kurs może być nieaktualny, sprzed ${age}`,
  guardMarketBody: "Nasz model zbyt mocno odbiega od rynku, by go pokazać: liczba to rynek, bez marży.",
};

const PT: Final7Copy = {
  noMarket: "Sem mercado",
  noMarketNote: "Nenhuma casa oferece ainda este jogo: sem mercado, estimativa nem diferença.",
  staleAged: (age) => `Só mercado: a odd pode estar desatualizada, de há ${age}`,
  guardMarketBody: "O nosso modelo afasta-se demasiado do mercado para ser mostrado: o número é o mercado, sem margem.",
};

const RU: Final7Copy = {
  noMarket: "Нет рынка",
  noMarketNote: "Ни один букмекер пока не предлагает этот матч: нет рынка, оценки и разницы.",
  staleAged: (age) => `Только рынок: цена может быть устаревшей, ${age} назад`,
  guardMarketBody: "Наша модель слишком расходится с рынком, чтобы её показывать: число — это рынок, без маржи.",
};

const SV: Final7Copy = {
  noMarket: "Ingen marknad",
  noMarketNote: "Ingen bookmaker erbjuder matchen än: ingen marknad, uppskattning eller skillnad.",
  staleAged: (age) => `Endast marknad: priset kan vara inaktuellt, ${age} gammalt`,
  guardMarketBody: "Vår modell skiljer sig för mycket från marknaden för att visas: siffran är marknaden, utan marginal.",
};

const TR: Final7Copy = {
  noMarket: "Piyasa yok",
  noMarketNote: "Bu maçı henüz hiçbir bahis sitesi sunmuyor: piyasa, tahmin ve fark yok.",
  staleAged: (age) => `Yalnızca piyasa: oran güncel olmayabilir, ${age} önce`,
  guardMarketBody: "Modelimiz piyasadan gösterilemeyecek kadar farklı: sayı piyasanın kendisi, marj hariç.",
};

export const FINAL7_COPY: Record<V3cLang, Final7Copy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function final7CopyFor(lang: string | null | undefined): Final7Copy {
  return FINAL7_COPY[v3cLang(lang)];
}
