// lib/v3c/fixdata2-copy.ts (#REDESIGN-V3C fixdata2) — the strings of the data/logic fixes of QA-REPORT-2
// (N3 N9 N11), in the 11 languages. A file of its own so the parallel UI filone (fixui2) and this one never
// edit the same dictionary. Terms from docs/redesign/i18n-glossary.md; checked by lib/v3c/i18n-parity.test.ts. // REVIEW-NATIVE
import { v3cLang, type V3cLang } from "./copy";

export type Fixdata2Copy = {
  /** N3: no market and no partner book price — the model alone is never shown as an estimate */
  modelOnly: string;
  modelOnlyNote: string;
  /** N3: the market read from the partner books' real prices (no stored market) */
  marketFromBooks: string;
  /** N3: the estimate's fair price is > 25% from the best real price */
  priceFar: string;
  /** N9: the sealed Elo of our tennis model, far from the market */
  sealedNoValue: string;
  sealedFar: string;
  /** N11: the match has started and a live score exists */
  startedLive: string;
  /** N9: a sealed tennis gap wider than 25 pp, in the record */
  recordModelFar: string;
};

const EN: Fixdata2Copy = {
  modelOnly: "Model only: no market to compare",
  modelOnlyNote: "No market price and no partner book to compare with: no estimate, fair price, EV or Kelly.",
  marketFromBooks: "Market from the partner books’ prices, margin removed",
  priceFar: "Our estimate is far from the best price: market only, no fair price.",
  sealedNoValue: "Our sealed Elo is far from the market here: no gap, no EV or Kelly.",
  sealedFar: "Market only: our sealed Elo differs too much from the market to show.",
  startedLive: "Under way, score above: pre-match numbers, no prices.",
  recordModelFar: "over 25 pp, not shown",
};

const IT: Fixdata2Copy = {
  modelOnly: "Solo modello: nessun mercato con cui confrontarlo",
  modelOnlyNote: "Nessun prezzo di mercato e nessun book partner con cui confrontarlo: niente stima, quota equa, EV né Kelly.",
  marketFromBooks: "Mercato dai prezzi dei book partner, margine tolto",
  priceFar: "La nostra stima è lontana dal miglior prezzo: solo mercato, nessuna quota equa.",
  sealedNoValue: "Qui il nostro Elo sigillato è lontano dal mercato: niente gap, EV né Kelly.",
  sealedFar: "Solo mercato: il nostro Elo sigillato si discosta troppo dal mercato per mostrarlo.",
  startedLive: "In corso, punteggio sopra: numeri pre-partita, nessun prezzo.",
  recordModelFar: "oltre 25 pp, non mostrato",
};

const DE: Fixdata2Copy = {
  modelOnly: "Nur Modell: kein Markt zum Vergleich",
  modelOnlyNote: "Kein Marktpreis und kein Partner-Buchmacher zum Vergleich: keine Schätzung, keine faire Quote, kein EV, kein Kelly.",
  marketFromBooks: "Markt aus den Quoten der Partner-Buchmacher, Marge entfernt",
  priceFar: "Unsere Schätzung liegt weit vom besten Preis: nur Markt, keine faire Quote.",
  sealedNoValue: "Unser versiegeltes Elo liegt hier weit vom Markt: kein Abstand, kein EV, kein Kelly.",
  sealedFar: "Nur Markt: unser versiegeltes Elo weicht zu stark vom Markt ab, um es zu zeigen.",
  startedLive: "Läuft, Spielstand oben: Zahlen vor dem Start, keine Preise.",
  recordModelFar: "über 25 pp, nicht gezeigt",
};

const ES: Fixdata2Copy = {
  modelOnly: "Solo modelo: no hay mercado con el que comparar",
  modelOnlyNote: "Sin precio de mercado ni casa asociada con la que comparar: sin estimación, cuota justa, EV ni Kelly.",
  marketFromBooks: "Mercado según los precios de las casas asociadas, sin margen",
  priceFar: "Nuestra estimación está lejos del mejor precio: solo mercado, sin cuota justa.",
  sealedNoValue: "Aquí nuestro Elo sellado está lejos del mercado: sin diferencia, EV ni Kelly.",
  sealedFar: "Solo mercado: nuestro Elo sellado se aleja demasiado del mercado para mostrarlo.",
  startedLive: "En juego, marcador arriba: números previos al partido, sin precios.",
  recordModelFar: "más de 25 pp, no se muestra",
};

const FR: Fixdata2Copy = {
  modelOnly: "Modèle seul : aucun marché pour comparer",
  modelOnlyNote: "Ni prix de marché ni bookmaker partenaire pour comparer : pas d’estimation, de cote juste, d’EV ni de Kelly.",
  marketFromBooks: "Marché tiré des cotes des bookmakers partenaires, marge retirée",
  priceFar: "Notre estimation est loin du meilleur prix : marché seul, pas de cote juste.",
  sealedNoValue: "Ici notre Elo scellé est loin du marché : pas d’écart, ni EV ni Kelly.",
  sealedFar: "Marché seul : notre Elo scellé s’écarte trop du marché pour être affiché.",
  startedLive: "En cours, score ci-dessus : chiffres d’avant-match, pas de prix.",
  recordModelFar: "plus de 25 pp, non affiché",
};

const NL: Fixdata2Copy = {
  modelOnly: "Alleen model: geen markt om mee te vergelijken",
  modelOnlyNote: "Geen marktprijs en geen partnerbookmaker om mee te vergelijken: geen schatting, eerlijke quotering, EV of Kelly.",
  marketFromBooks: "Markt uit de prijzen van de partnerbookmakers, marge eraf",
  priceFar: "Onze schatting ligt ver van de beste prijs: alleen markt, geen eerlijke quotering.",
  sealedNoValue: "Hier ligt onze verzegelde Elo ver van de markt: geen verschil, geen EV of Kelly.",
  sealedFar: "Alleen markt: onze verzegelde Elo wijkt te veel af van de markt om te tonen.",
  startedLive: "Bezig, stand hierboven: cijfers van vóór de wedstrijd, geen prijzen.",
  recordModelFar: "meer dan 25 pp, niet getoond",
};

const PL: Fixdata2Copy = {
  modelOnly: "Tylko model: brak rynku do porównania",
  modelOnlyNote: "Brak ceny rynkowej i bukmachera partnerskiego do porównania: bez szacunku, kursu uczciwego, EV i Kelly’ego.",
  marketFromBooks: "Rynek z kursów bukmacherów partnerskich, bez marży",
  priceFar: "Nasz szacunek jest daleko od najlepszej ceny: tylko rynek, bez kursu uczciwego.",
  sealedNoValue: "Tu nasze zapieczętowane Elo jest daleko od rynku: bez różnicy, EV i Kelly’ego.",
  sealedFar: "Tylko rynek: nasze zapieczętowane Elo za bardzo odbiega od rynku, by je pokazać.",
  startedLive: "W toku, wynik powyżej: liczby sprzed meczu, bez cen.",
  recordModelFar: "ponad 25 pp, nie pokazano",
};

const PT: Fixdata2Copy = {
  modelOnly: "Só modelo: nenhum mercado para comparar",
  modelOnlyNote: "Sem preço de mercado nem casa parceira para comparar: sem estimativa, odd justa, EV ou Kelly.",
  marketFromBooks: "Mercado a partir das odds das casas parceiras, sem margem",
  priceFar: "A nossa estimativa está longe do melhor preço: só mercado, sem odd justa.",
  sealedNoValue: "Aqui o nosso Elo selado está longe do mercado: sem diferença, EV ou Kelly.",
  sealedFar: "Só mercado: o nosso Elo selado afasta-se demasiado do mercado para ser mostrado.",
  startedLive: "Em curso, resultado acima: números pré-jogo, sem preços.",
  recordModelFar: "mais de 25 pp, não mostrado",
};

const RU: Fixdata2Copy = {
  modelOnly: "Только модель: нет рынка для сравнения",
  modelOnlyNote: "Нет рыночной цены и нет букмекера-партнёра для сравнения: без оценки, справедливой цены, EV и Келли.",
  marketFromBooks: "Рынок по ценам букмекеров-партнёров, маржа убрана",
  priceFar: "Наша оценка далека от лучшей цены: только рынок, без справедливой цены.",
  sealedNoValue: "Здесь наш запечатанный Elo далёк от рынка: без разницы, EV и Келли.",
  sealedFar: "Только рынок: наш запечатанный Elo слишком далёк от рынка, чтобы его показывать.",
  startedLive: "Идёт, счёт выше: доматчевые числа, без цен.",
  recordModelFar: "больше 25 п.п., не показано",
};

const SV: Fixdata2Copy = {
  modelOnly: "Endast modell: ingen marknad att jämföra med",
  modelOnlyNote: "Inget marknadspris och ingen partnerbookmaker att jämföra med: ingen uppskattning, rättvist odds, EV eller Kelly.",
  marketFromBooks: "Marknad från partnerbookmakernas odds, marginal borttagen",
  priceFar: "Vår uppskattning ligger långt från bästa priset: endast marknad, inget rättvist odds.",
  sealedNoValue: "Här ligger vår förseglade Elo långt från marknaden: ingen skillnad, ingen EV eller Kelly.",
  sealedFar: "Endast marknad: vår förseglade Elo avviker för mycket från marknaden för att visas.",
  startedLive: "Pågår, ställning ovan: siffror före matchen, inga priser.",
  recordModelFar: "över 25 pp, visas inte",
};

const TR: Fixdata2Copy = {
  modelOnly: "Yalnızca model: karşılaştırılacak piyasa yok",
  modelOnlyNote: "Piyasa fiyatı ve karşılaştırılacak partner bahis sitesi yok: tahmin, adil oran, EV ve Kelly yok.",
  marketFromBooks: "Piyasa, partner bahis sitelerinin oranlarından, marj çıkarılmış",
  priceFar: "Tahminimiz en iyi orandan uzak: yalnızca piyasa, adil oran yok.",
  sealedNoValue: "Burada mühürlü Elo’muz piyasadan uzak: fark, EV ve Kelly yok.",
  sealedFar: "Yalnızca piyasa: mühürlü Elo’muz göstermek için piyasadan fazla sapıyor.",
  startedLive: "Sürüyor, skor yukarıda: maç öncesi sayılar, fiyat yok.",
  recordModelFar: "25 pp üzeri, gösterilmiyor",
};

export const FIXDATA2_COPY: Record<V3cLang, Fixdata2Copy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function fixdata2CopyFor(lang: string | null | undefined): Fixdata2Copy {
  return FIXDATA2_COPY[v3cLang(lang)];
}
