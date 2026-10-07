// lib/v3c/banner-copy.ts (#REDESIGN-V3C final3) — le parole dei banner colore (brand/README §3b),
// 11 lingue (glossario: docs/redesign/i18n-glossary.md). Titolo ≤ 8 parole, poi un link secondario.
// Nessuna stringa legale o di prezzo: niente REVIEW-NATIVE. Controllato da lib/v3c/i18n-parity.test.ts.
import { v3cLang } from "./copy";

type Line = { title: string; link: string };
type BannerCopy = { record: Line; learn: Line; calcio: Line; tennis: Line; live: Line; pro: Line };

const EN: BannerCopy = {
  record: { title: "Every read sealed before kick-off", link: "See the record" },
  learn: { title: "How a read is built, step by step", link: "How it works" },
  calcio: { title: "Football: model and market, weights declared", link: "Football on the board" },
  tennis: { title: "Tennis: the market price, read clearly", link: "Tennis on the board" },
  live: { title: "Matches in play, prices moving now", link: "See live matches" },
  pro: { title: "See what Pro adds", link: "Compare Free and Pro" },
};

const IT: BannerCopy = {
  record: { title: "Ogni lettura sigillata prima del fischio d’inizio", link: "Vedi il registro" },
  learn: { title: "Come nasce una lettura, passo per passo", link: "Come funziona" },
  calcio: { title: "Calcio: modello e mercato, pesi dichiarati", link: "Il calcio sulla board" },
  tennis: { title: "Tennis: il prezzo di mercato, letto chiaro", link: "Il tennis sulla board" },
  live: { title: "Partite in corso, quote in movimento", link: "Vedi le partite live" },
  pro: { title: "Scopri cosa aggiunge Pro", link: "Confronta Free e Pro" },
};

const DE: BannerCopy = {
  record: { title: "Jede Einschätzung vor dem Anstoß versiegelt", link: "Zum Register" },
  learn: { title: "Wie eine Einschätzung entsteht, Schritt für Schritt", link: "So funktioniert’s" },
  calcio: { title: "Fußball: Modell und Markt, Gewichte offengelegt", link: "Fußball auf dem Board" },
  tennis: { title: "Tennis: die Marktquote, klar gelesen", link: "Tennis auf dem Board" },
  live: { title: "Laufende Spiele, Quoten in Bewegung", link: "Live-Spiele ansehen" },
  pro: { title: "Sieh, was Pro ergänzt", link: "Free und Pro vergleichen" },
};

const ES: BannerCopy = {
  record: { title: "Cada lectura, sellada antes del inicio", link: "Ver el registro" },
  learn: { title: "Cómo se construye una lectura, paso a paso", link: "Cómo funciona" },
  calcio: { title: "Fútbol: modelo y mercado, pesos declarados", link: "El fútbol en el tablero" },
  tennis: { title: "Tenis: la cuota del mercado, leída con claridad", link: "El tenis en el tablero" },
  live: { title: "Partidos en juego, cuotas en movimiento", link: "Ver partidos en directo" },
  pro: { title: "Mira lo que añade Pro", link: "Compara Free y Pro" },
};

const FR: BannerCopy = {
  record: { title: "Chaque lecture scellée avant le coup d’envoi", link: "Voir le registre" },
  learn: { title: "Comment naît une lecture, étape par étape", link: "Comment ça marche" },
  calcio: { title: "Football : modèle et marché, poids déclarés", link: "Le football sur le tableau" },
  tennis: { title: "Tennis : la cote du marché, lue clairement", link: "Le tennis sur le tableau" },
  live: { title: "Matchs en cours, cotes en mouvement", link: "Voir les matchs en direct" },
  pro: { title: "Voyez ce que Pro ajoute", link: "Comparer Free et Pro" },
};

const NL: BannerCopy = {
  record: { title: "Elke lezing verzegeld vóór de aftrap", link: "Bekijk het register" },
  learn: { title: "Hoe een lezing ontstaat, stap voor stap", link: "Zo werkt het" },
  calcio: { title: "Voetbal: model en markt, gewichten benoemd", link: "Voetbal op het board" },
  tennis: { title: "Tennis: de marktodds, helder gelezen", link: "Tennis op het board" },
  live: { title: "Wedstrijden bezig, odds in beweging", link: "Bekijk live wedstrijden" },
  pro: { title: "Zie wat Pro toevoegt", link: "Vergelijk Free en Pro" },
};

const PL: BannerCopy = {
  record: { title: "Każda analiza zapieczętowana przed meczem", link: "Zobacz rejestr" },
  learn: { title: "Jak powstaje analiza, krok po kroku", link: "Jak to działa" },
  calcio: { title: "Piłka nożna: model i rynek, jawne wagi", link: "Piłka nożna na tablicy" },
  tennis: { title: "Tenis: kurs rynkowy, czytelnie podany", link: "Tenis na tablicy" },
  live: { title: "Mecze w toku, kursy w ruchu", link: "Zobacz mecze na żywo" },
  pro: { title: "Zobacz, co dodaje Pro", link: "Porównaj Free i Pro" },
};

const PT: BannerCopy = {
  record: { title: "Cada leitura selada antes do início", link: "Ver o registo" },
  learn: { title: "Como nasce uma leitura, passo a passo", link: "Como funciona" },
  calcio: { title: "Futebol: modelo e mercado, pesos declarados", link: "O futebol no board" },
  tennis: { title: "Ténis: a odd de mercado, lida com clareza", link: "O ténis no board" },
  live: { title: "Jogos a decorrer, odds em movimento", link: "Ver jogos ao vivo" },
  pro: { title: "Vê o que o Pro acrescenta", link: "Compara Free e Pro" },
};

const RU: BannerCopy = {
  record: { title: "Каждая оценка зафиксирована до матча", link: "Открыть реестр" },
  learn: { title: "Как строится оценка, шаг за шагом", link: "Как это работает" },
  calcio: { title: "Футбол: модель и рынок, веса открыты", link: "Футбол на панели" },
  tennis: { title: "Теннис: только рыночный коэффициент", link: "Теннис на панели" },
  live: { title: "Матчи идут, коэффициенты меняются", link: "Матчи в эфире" },
  pro: { title: "Узнайте, что добавляет Pro", link: "Сравнить Free и Pro" },
};

const SV: BannerCopy = {
  record: { title: "Varje bedömning förseglad före avspark", link: "Se registret" },
  learn: { title: "Hur en bedömning byggs, steg för steg", link: "Så fungerar det" },
  calcio: { title: "Fotboll: modell och marknad, vikter redovisade", link: "Fotboll på boarden" },
  tennis: { title: "Tennis: marknadens odds, tydligt lästa", link: "Tennis på boarden" },
  live: { title: "Matcher pågår, odds i rörelse", link: "Se livematcher" },
  pro: { title: "Se vad Pro lägger till", link: "Jämför Free och Pro" },
};

const TR: BannerCopy = {
  record: { title: "Her okuma başlamadan önce mühürlü", link: "Kayıt defterini gör" },
  learn: { title: "Bir okuma adım adım nasıl kurulur", link: "Nasıl çalışır" },
  calcio: { title: "Futbol: model ve piyasa, ağırlıklar açık", link: "Panoda futbol" },
  tennis: { title: "Tenis: piyasa oranı, açıkça okunur", link: "Panoda tenis" },
  live: { title: "Süren maçlar, hareket eden oranlar", link: "Canlı maçları gör" },
  pro: { title: "Pro’nun neler eklediğini gör", link: "Free ve Pro’yu karşılaştır" },
};

export const V3C_BANNER_COPY = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR } as const;
export type BannerTheme = keyof BannerCopy;

export function bannerCopyFor(lang: string | null | undefined): BannerCopy {
  return V3C_BANNER_COPY[v3cLang(lang)];
}
