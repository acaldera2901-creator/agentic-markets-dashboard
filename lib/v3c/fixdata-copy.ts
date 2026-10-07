// lib/v3c/fixdata-copy.ts (#REDESIGN-V3C fixdata) — the strings of the data/logic fixes
// (QA-REPORT v3c-final3: B1 B2 B5 A6 M4 L4), in the 11 languages. A file of its own so the
// parallel UI filone (fixui) and this one never edit the same dictionary. Terms from
// docs/redesign/i18n-glossary.md; checked by lib/v3c/i18n-parity.test.ts. // REVIEW-NATIVE
import { v3cLang, type V3cLang } from "./copy";

export type FixdataCopy = {
  /** B1: the group of matches that started and have no live score */
  startedGroup: string;
  startedNote: string;
  /** B1: the declared order of the board and of the home */
  order: string;
  homeOrder: string;
  /** B2: «price at 14:52» — the capture time in the visitor's zone; the zone is declared once per view (TzNote, final5) */
  priceAt: (time: string) => string;
  /** B5 */
  marketOnly: string;
  noValue: string;
  /** B5/M5: the Kelly of the match page, without a stake in € */
  kellyNote: string;
  bestBasis: (price: string, book: string) => string;
  /** A6 */
  ydayTooFew: string;
  ydayMin: (n: number) => string;
  ydayWL: string;
  /** M4 */
  toolErrEmpty: string;
  toolErrRange: (lo: string, hi: string) => string;
  toolErrInteger: string;
  /** L4 */
  gapRounding: string;
  /** B8: the sealed row of our tennis model (tempered Elo) and its gap against the book before the seal */
  sealedElo: string;
  sealedAt: (time: string) => string;
  marketAtSeal: (book: string, time: string) => string;
  sealedGapNote: string;
};

const EN: FixdataCopy = {
  startedGroup: "Started",
  startedNote: "Under way, no live score yet: pre-match numbers, no prices.",
  order: "Order: top leagues and ATP/WTA first, then by start time.",
  homeOrder: "Next matches: top leagues and ATP/WTA first, then by start time. Started ones are in Live.",
  priceAt: (time) => `price at ${time}`,
  marketOnly: "Market only: the model differs too much to show",
  noValue: "The model is far from the market here: no EV, Kelly or stake shown.",
  kellyNote: "Kelly needs your bankroll: set it in the tool. A fraction, not advice.",
  bestBasis: (price, book) => `EV and Kelly at the best price, ${price} at ${book}.`,
  ydayTooFew: "Too few matches for a score yet",
  ydayMin: (n) => `A score needs at least ${n} settled matches.`,
  ydayWL: "Won–lost, football",
  toolErrEmpty: "Type a number.",
  toolErrRange: (lo, hi) => `Use a value from ${lo} to ${hi}.`,
  toolErrInteger: "Type a whole number.",
  gapRounding: "The gap uses unrounded numbers, one decimal; the % are rounded.",
  sealedElo: "Our Elo, sealed",
  sealedAt: (time) => `sealed ${time}`,
  marketAtSeal: (book, time) => `market at seal, ${book} ${time}`,
  sealedGapNote: "Sealed Elo minus the book’s price before the seal: a difference of probabilities, not a profit.",
};

const IT: FixdataCopy = {
  startedGroup: "Iniziate",
  startedNote: "In corso, punteggio non ancora disponibile: numeri pre-partita, nessun prezzo.",
  order: "Ordine: prima i campionati top e ATP/WTA, poi per orario.",
  homeOrder: "Prossime partite: prima i campionati top e ATP/WTA, poi per orario. Quelle iniziate sono in Live.",
  priceAt: (time) => `prezzo delle ${time}`,
  marketOnly: "Solo mercato: il modello si discosta troppo per mostrarlo",
  noValue: "Qui il modello è lontano dal mercato: niente EV, Kelly né puntata.",
  kellyNote: "Il Kelly vuole il tuo bankroll: impostalo nello strumento. Una frazione, non un consiglio.",
  bestBasis: (price, book) => `EV e Kelly sul miglior prezzo, ${price} su ${book}.`,
  ydayTooFew: "Troppe poche partite per un punteggio",
  ydayMin: (n) => `Un punteggio richiede almeno ${n} partite chiuse.`,
  ydayWL: "Vinte–perse, calcio",
  toolErrEmpty: "Scrivi un numero.",
  toolErrRange: (lo, hi) => `Usa un valore da ${lo} a ${hi}.`,
  toolErrInteger: "Scrivi un numero intero.",
  gapRounding: "Il gap usa i numeri non arrotondati, un decimale; le % sono arrotondate.",
  sealedElo: "Il nostro Elo, sigillato",
  sealedAt: (time) => `sigillato ${time}`,
  marketAtSeal: (book, time) => `mercato al sigillo, ${book} ${time}`,
  sealedGapNote: "Elo sigillato meno il prezzo del book prima del sigillo: una differenza di probabilità, non un profitto.",
};

const DE: FixdataCopy = {
  startedGroup: "Begonnen",
  startedNote: "Läuft, noch kein Live-Stand: Zahlen vor dem Anstoß, keine Quoten.",
  order: "Reihenfolge: zuerst Top-Ligen und ATP/WTA, dann nach Uhrzeit.",
  homeOrder: "Nächste Spiele: zuerst Top-Ligen und ATP/WTA, dann nach Uhrzeit. Begonnene stehen unter Live.",
  priceAt: (time) => `Quote um ${time}`,
  marketOnly: "Nur Markt: das Modell weicht zu stark ab, um es zu zeigen",
  noValue: "Hier liegt das Modell weit vom Markt: kein EV, kein Kelly, kein Einsatz.",
  kellyNote: "Kelly braucht deine Bankroll: trag sie im Tool ein. Ein Anteil, keine Empfehlung.",
  bestBasis: (price, book) => `EV und Kelly zur besten Quote, ${price} bei ${book}.`,
  ydayTooFew: "Noch zu wenige Spiele für einen Wert",
  ydayMin: (n) => `Ein Wert braucht mindestens ${n} abgerechnete Spiele.`,
  ydayWL: "Gewonnen–verloren, Fußball",
  toolErrEmpty: "Gib eine Zahl ein.",
  toolErrRange: (lo, hi) => `Wert von ${lo} bis ${hi} verwenden.`,
  toolErrInteger: "Gib eine ganze Zahl ein.",
  gapRounding: "Der Abstand nutzt ungerundete Zahlen, eine Dezimalstelle; die % sind gerundet.",
  sealedElo: "Unser Elo, versiegelt",
  sealedAt: (time) => `versiegelt ${time}`,
  marketAtSeal: (book, time) => `Markt beim Siegel, ${book} ${time}`,
  sealedGapNote: "Versiegeltes Elo minus die Quote des Buchmachers vor dem Siegel: eine Differenz von Wahrscheinlichkeiten, kein Gewinn.",
};

const ES: FixdataCopy = {
  startedGroup: "Empezados",
  startedNote: "En juego, sin marcador en directo aún: cifras previas, sin cuotas.",
  order: "Orden: primero ligas top y ATP/WTA, luego por hora.",
  homeOrder: "Próximos partidos: primero ligas top y ATP/WTA, luego por hora. Los empezados están en En directo.",
  priceAt: (time) => `cuota a las ${time}`,
  marketOnly: "Solo mercado: el modelo se aleja demasiado para mostrarlo",
  noValue: "Aquí el modelo está lejos del mercado: sin EV, Kelly ni importe.",
  kellyNote: "Kelly necesita tu bankroll: indícalo en la herramienta. Una fracción, no un consejo.",
  bestBasis: (price, book) => `EV y Kelly con la mejor cuota, ${price} en ${book}.`,
  ydayTooFew: "Aún pocos partidos para una puntuación",
  ydayMin: (n) => `Una puntuación necesita al menos ${n} partidos cerrados.`,
  ydayWL: "Ganados–perdidos, fútbol",
  toolErrEmpty: "Escribe un número.",
  toolErrRange: (lo, hi) => `Usa un valor de ${lo} a ${hi}.`,
  toolErrInteger: "Escribe un número entero.",
  gapRounding: "La diferencia usa cifras sin redondear, un decimal; los % están redondeados.",
  sealedElo: "Nuestro Elo, sellado",
  sealedAt: (time) => `sellado ${time}`,
  marketAtSeal: (book, time) => `mercado al sellar, ${book} ${time}`,
  sealedGapNote: "Elo sellado menos la cuota de la casa antes del sello: una diferencia de probabilidades, no una ganancia.",
};

const FR: FixdataCopy = {
  startedGroup: "Commencés",
  startedNote: "En cours, pas encore de score en direct : chiffres d’avant-match, aucune cote.",
  order: "Ordre : d’abord les grands championnats et l’ATP/WTA, puis par horaire.",
  homeOrder: "Prochains matchs : d’abord les grands championnats et l’ATP/WTA, puis par horaire. Les matchs commencés sont dans En direct.",
  priceAt: (time) => `cote à ${time}`,
  marketOnly: "Marché seul : le modèle s’écarte trop pour être affiché",
  noValue: "Ici le modèle est loin du marché : ni EV, ni Kelly, ni mise affichés.",
  kellyNote: "Kelly demande votre bankroll : indiquez-la dans l’outil. Une fraction, pas un conseil.",
  bestBasis: (price, book) => `EV et Kelly à la meilleure cote, ${price} chez ${book}.`,
  ydayTooFew: "Encore trop peu de matchs pour un score",
  ydayMin: (n) => `Un score demande au moins ${n} matchs réglés.`,
  ydayWL: "Gagnés–perdus, football",
  toolErrEmpty: "Saisissez un nombre.",
  toolErrRange: (lo, hi) => `Utilisez une valeur de ${lo} à ${hi}.`,
  toolErrInteger: "Saisissez un nombre entier.",
  gapRounding: "L’écart utilise les chiffres non arrondis, une décimale ; les % sont arrondis.",
  sealedElo: "Notre Elo, scellé",
  sealedAt: (time) => `scellé ${time}`,
  marketAtSeal: (book, time) => `marché au sceau, ${book} ${time}`,
  sealedGapNote: "Elo scellé moins la cote du bookmaker avant le sceau : une différence de probabilités, pas un gain.",
};

const NL: FixdataCopy = {
  startedGroup: "Begonnen",
  startedNote: "Bezig, nog geen live stand: cijfers van voor de aftrap, geen odds.",
  order: "Volgorde: eerst topcompetities en ATP/WTA, dan op tijd.",
  homeOrder: "Volgende wedstrijden: eerst topcompetities en ATP/WTA, dan op tijd. Begonnen wedstrijden staan bij Live.",
  priceAt: (time) => `odd om ${time}`,
  marketOnly: "Alleen markt: het model wijkt te veel af om te tonen",
  noValue: "Hier ligt het model ver van de markt: geen EV, Kelly of inzet.",
  kellyNote: "Kelly heeft je bankroll nodig: vul die in de tool in. Een fractie, geen advies.",
  bestBasis: (price, book) => `EV en Kelly op de beste odds, ${price} bij ${book}.`,
  ydayTooFew: "Nog te weinig wedstrijden voor een score",
  ydayMin: (n) => `Een score vraagt minstens ${n} afgerekende wedstrijden.`,
  ydayWL: "Gewonnen–verloren, voetbal",
  toolErrEmpty: "Typ een getal.",
  toolErrRange: (lo, hi) => `Gebruik een waarde van ${lo} tot ${hi}.`,
  toolErrInteger: "Typ een geheel getal.",
  gapRounding: "Het verschil gebruikt onafgeronde getallen, één decimaal; de % zijn afgerond.",
  sealedElo: "Ons Elo, verzegeld",
  sealedAt: (time) => `verzegeld ${time}`,
  marketAtSeal: (book, time) => `markt bij zegel, ${book} ${time}`,
  sealedGapNote: "Verzegeld Elo min de odds van de bookmaker vóór het zegel: een verschil in kansen, geen winst.",
};

const PL: FixdataCopy = {
  startedGroup: "Rozpoczęte",
  startedNote: "Trwa, brak wyniku na żywo: liczby sprzed meczu, bez kursów.",
  order: "Kolejność: najpierw topowe ligi i ATP/WTA, potem według godziny.",
  homeOrder: "Najbliższe mecze: najpierw topowe ligi i ATP/WTA, potem według godziny. Rozpoczęte są w sekcji Na żywo.",
  priceAt: (time) => `kurs o ${time}`,
  marketOnly: "Tylko rynek: model odbiega za bardzo, by go pokazać",
  noValue: "Tu model jest daleko od rynku: bez EV, Kelly i stawki.",
  kellyNote: "Kelly potrzebuje twojego bankrolla: ustaw go w narzędziu. Ułamek, nie porada.",
  bestBasis: (price, book) => `EV i Kelly po najlepszym kursie, ${price} u ${book}.`,
  ydayTooFew: "Za mało meczów na wynik",
  ydayMin: (n) => `Wynik wymaga co najmniej ${n} rozliczonych meczów.`,
  ydayWL: "Wygrane–przegrane, piłka nożna",
  toolErrEmpty: "Wpisz liczbę.",
  toolErrRange: (lo, hi) => `Użyj wartości od ${lo} do ${hi}.`,
  toolErrInteger: "Wpisz liczbę całkowitą.",
  gapRounding: "Różnica liczona z nieokrąglonych liczb, jedno miejsce po przecinku; % są zaokrąglone.",
  sealedElo: "Nasze Elo, zapieczętowane",
  sealedAt: (time) => `zapieczętowane ${time}`,
  marketAtSeal: (book, time) => `rynek przy pieczęci, ${book} ${time}`,
  sealedGapNote: "Zapieczętowane Elo minus kurs bukmachera przed pieczęcią: różnica prawdopodobieństw, nie zysk.",
};

const PT: FixdataCopy = {
  startedGroup: "Começados",
  startedNote: "A decorrer, ainda sem resultado ao vivo: números pré-jogo, sem odds.",
  order: "Ordem: primeiro as ligas de topo e ATP/WTA, depois por hora.",
  homeOrder: "Próximos jogos: primeiro as ligas de topo e ATP/WTA, depois por hora. Os começados estão em Ao vivo.",
  priceAt: (time) => `odd às ${time}`,
  marketOnly: "Só mercado: o modelo afasta-se demasiado para o mostrar",
  noValue: "Aqui o modelo está longe do mercado: sem EV, Kelly nem montante.",
  kellyNote: "O Kelly precisa da tua banca: define-a na ferramenta. Uma fração, não um conselho.",
  bestBasis: (price, book) => `EV e Kelly na melhor odd, ${price} na ${book}.`,
  ydayTooFew: "Ainda poucos jogos para uma pontuação",
  ydayMin: (n) => `Uma pontuação precisa de pelo menos ${n} jogos fechados.`,
  ydayWL: "Ganhos–perdidos, futebol",
  toolErrEmpty: "Escreve um número.",
  toolErrRange: (lo, hi) => `Usa um valor de ${lo} a ${hi}.`,
  toolErrInteger: "Escreve um número inteiro.",
  gapRounding: "A diferença usa números sem arredondar, uma casa decimal; as % estão arredondadas.",
  sealedElo: "O nosso Elo, selado",
  sealedAt: (time) => `selado ${time}`,
  marketAtSeal: (book, time) => `mercado no selo, ${book} ${time}`,
  sealedGapNote: "Elo selado menos a odd da casa antes do selo: uma diferença de probabilidades, não um lucro.",
};

const RU: FixdataCopy = {
  startedGroup: "Начались",
  startedNote: "Идёт, счёта в реальном времени пока нет: данные до начала, без коэффициентов.",
  order: "Порядок: сначала топ-лиги и ATP/WTA, затем по времени.",
  homeOrder: "Ближайшие матчи: сначала топ-лиги и ATP/WTA, затем по времени. Начавшиеся — в разделе Live.",
  priceAt: (time) => `коэф. на ${time}`,
  marketOnly: "Только рынок: модель расходится слишком сильно, чтобы её показывать",
  noValue: "Здесь модель далека от рынка: без EV, Kelly и суммы ставки.",
  kellyNote: "Для Kelly нужен ваш банкролл: укажите его в инструменте. Доля, а не совет.",
  bestBasis: (price, book) => `EV и Kelly по лучшему коэффициенту, ${price} у ${book}.`,
  ydayTooFew: "Пока слишком мало матчей для оценки",
  ydayMin: (n) => `Для оценки нужно не менее ${n} рассчитанных матчей.`,
  ydayWL: "Выигрыши–проигрыши, футбол",
  toolErrEmpty: "Введите число.",
  toolErrRange: (lo, hi) => `Используйте значение от ${lo} до ${hi}.`,
  toolErrInteger: "Введите целое число.",
  gapRounding: "Разрыв считается по неокруглённым числам, один знак; % округлены.",
  sealedElo: "Наш Elo, зафиксирован",
  sealedAt: (time) => `зафиксирован ${time}`,
  marketAtSeal: (book, time) => `рынок при фиксации, ${book} ${time}`,
  sealedGapNote: "Зафиксированный Elo минус коэффициент букмекера до фиксации: разница вероятностей, а не прибыль.",
};

const SV: FixdataCopy = {
  startedGroup: "Startade",
  startedNote: "Pågår, inget liveresultat ännu: siffror före start, inga odds.",
  order: "Ordning: först toppligor och ATP/WTA, sedan efter tid.",
  homeOrder: "Nästa matcher: först toppligor och ATP/WTA, sedan efter tid. Startade finns under Live.",
  priceAt: (time) => `odds kl. ${time}`,
  marketOnly: "Bara marknad: modellen avviker för mycket för att visas",
  noValue: "Här ligger modellen långt från marknaden: ingen EV, Kelly eller insats.",
  kellyNote: "Kelly behöver din bankrulle: ange den i verktyget. En andel, inget råd.",
  bestBasis: (price, book) => `EV och Kelly på bästa odds, ${price} hos ${book}.`,
  ydayTooFew: "För få matcher för ett värde än",
  ydayMin: (n) => `Ett värde kräver minst ${n} avgjorda matcher.`,
  ydayWL: "Vunna–förlorade, fotboll",
  toolErrEmpty: "Skriv ett tal.",
  toolErrRange: (lo, hi) => `Använd ett värde från ${lo} till ${hi}.`,
  toolErrInteger: "Skriv ett heltal.",
  gapRounding: "Skillnaden använder oavrundade tal, en decimal; % är avrundade.",
  sealedElo: "Vår Elo, förseglad",
  sealedAt: (time) => `förseglad ${time}`,
  marketAtSeal: (book, time) => `marknad vid sigill, ${book} ${time}`,
  sealedGapNote: "Förseglad Elo minus spelbolagets odds före sigillet: en skillnad i sannolikhet, ingen vinst.",
};

const TR: FixdataCopy = {
  startedGroup: "Başladı",
  startedNote: "Devam ediyor, henüz canlı skor yok: maç öncesi rakamlar, oran yok.",
  order: "Sıra: önce üst ligler ve ATP/WTA, sonra saate göre.",
  homeOrder: "Sıradaki maçlar: önce üst ligler ve ATP/WTA, sonra saate göre. Başlayanlar Canlı bölümünde.",
  priceAt: (time) => `${time} oranı`,
  marketOnly: "Yalnızca piyasa: model göstermek için fazla sapıyor",
  noValue: "Burada model piyasadan uzak: EV, Kelly veya bahis tutarı yok.",
  kellyNote: "Kelly kasanı ister: araçta gir. Bir oran, tavsiye değil.",
  bestBasis: (price, book) => `EV ve Kelly en iyi oranla: ${price}, ${book}.`,
  ydayTooFew: "Puan için henüz çok az maç var",
  ydayMin: (n) => `Puan için en az ${n} sonuçlanmış maç gerekir.`,
  ydayWL: "Kazanılan–kaybedilen, futbol",
  toolErrEmpty: "Bir sayı yaz.",
  toolErrRange: (lo, hi) => `${lo} ile ${hi} arasında bir değer kullan.`,
  toolErrInteger: "Tam sayı yaz.",
  gapRounding: "Fark yuvarlanmamış sayılarla, tek ondalıkla hesaplanır; % değerleri yuvarlanmıştır.",
  sealedElo: "Elo’muz, mühürlü",
  sealedAt: (time) => `mühürlendi ${time}`,
  marketAtSeal: (book, time) => `mühürde piyasa, ${book} ${time}`,
  sealedGapNote: "Mühürlü Elo eksi mühürden önceki bahis sitesi oranı: olasılık farkı, kâr değil.",
};

export const FIXDATA_COPY: Record<V3cLang, FixdataCopy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function fixdataCopyFor(lang: string | null | undefined): FixdataCopy {
  return FIXDATA_COPY[v3cLang(lang)];
}
