// Fonte unica di verità della vetrina partner (footer + pagina /partners).
// Solo routing affiliato in uscita — mai gestione fondi/scommesse. Gli URL
// sono importati dalle costanti già esistenti (niente duplicazione); slotsbonus
// è l'unica URL centralizzata qui (spostata dal footer). Tutti i partner sono
// gambling → il consumo è SEMPRE geo-gated fail-closed (vedi /api/geo-books).
import { CASEA_GEO_URLS, FORTUNEPLAY_BET_URL, LANDING_PARTNERS } from "@/lib/affiliate";
import { BOOKS } from "@/lib/betconstruct-books";

export type PartnerCategory = "sportsbook" | "casino";
export type Partner = {
  id: string;
  name: string;
  category: PartnerCategory;
  logo: string; // path in /public/logos
  url?: string; // landing affiliato unico (assente se il partner è geo-ristretto)
  // #PARTNERS-VELOBET-CASEA: partner con un link DIVERSO per paese e nessun link
  // neutro (Casea: solo NO/CH/FI) → compare SOLO in quei paesi, col suo link.
  // Chi renderizza usa `partnersFor(country)`, non `PARTNERS` grezzo.
  geoUrls?: Record<string, string>;
  featured?: boolean;
  // Forma del marchio: un emblema quadrato allo stesso cap d'altezza di un
  // wordmark orizzontale rende ~3x meno massa ottica → cap dedicato (CSS
  // .partner-logo-emblem). Serve solo dove la forma NON è un wordmark.
  logoShape?: "emblem";
};

// Partner già risolto per una geo: `url` c'è sempre → i componenti non devono
// gestire il caso "partner senza link".
export type ResolvedPartner = Partner & { url: string };

const YBETS_URL = BOOKS.find((b) => b.key === "ybets")?.landing ?? "https://ybetspromo.io/dputempxc";
const BETSCORE_URL = LANDING_PARTNERS.find((p) => p.name === "BetScore")?.url
  ?? "https://bsr.lynmonkel.com/?mid=381903_2215092";
const SLOTSBONUS_URL =
  "https://slotsbonus.bet/?utm_source=betredge&utm_medium=partner&utm_campaign=cross-referral";
// #PARTNER-FELICEBET (2026-07-29): affiliato della rete Bluewin Partners
// (bta=2961065). Solo landing di registrazione — 302 → felicebet<geo>.com col
// btag di attribuzione, nessun feed quote e nessun deep-link per evento.
// L'URL vive in LANDING_PARTNERS (come BetScore): qui si rilegge, non si duplica.
const FELICEBET_URL = LANDING_PARTNERS.find((p) => p.name === "FeliceBet")?.url
  ?? "https://go.bluewinpartners.com/visit/?bta=2961065&nci=5732";
// #PARTNERS-VELOBET-CASEA (2026-07-31): VeloBet ha un link unico (vive in
// LANDING_PARTNERS come gli altri solo-landing); Casea ha un link per paese e
// nessun neutro → qui si riusa la mappa CASEA_GEO_URLS, niente duplicazione.
const VELOBET_URL = LANDING_PARTNERS.find((p) => p.name === "VeloBet")?.url
  ?? "https://track.velobetpartners.com/visit/?bta=42786&nci=6119";
// #PARTNER-GGBET (2026-08-06): sportsbook esports-first. Come gli altri solo-landing
// l'URL vive in LANDING_PARTNERS (fonte unica) e qui si rilegge.
const GGBET_URL = LANDING_PARTNERS.find((p) => p.name === "GG.BET")?.url
  ?? "https://ggbetbestoffer.com/l/6a6ca2b84d683c219008f152?utm_source=Aff&utm_medium=267914&utm_campaign=seo&utm_content=bet&sub_id=betredge";
// #PARTNER-WILDZ-BEAZT (2026-09-02): due marchi della stessa rete affiliata
// (go.wildzaffiliates.com, bta=1000385 — il programma di Rootz Ltd, licenza MGA).
// Verificati con curl e col browser: nci=6056 → 302 su beazt.com/en/, nci=5345 →
// 302 su wildz.com/en/, entrambi col tag di attribuzione `aff=cxw-1000385_<n>`
// (n cambia a ogni visita: è il click-id della rete, non fa parte del link e non
// va fissato). Sono solo landing di registrazione — nessun feed quote, nessun
// deep-link per evento → NON stanno in LANDING_PARTNERS, cioè non compaiono nel
// menu "Piazza la scommessa": quello vuole un atterraggio sul prematch (VeloBet),
// questi atterrano sulla home del casinò. Come slotsbonus, l'URL vive qui perché
// questi partner esistono solo nella vetrina.
// `utm_campaign=betredge` sul link Wildz è quello consegnato dalla rete: verificato
// che il tracker NON lo propaga alla destinazione, si tiene comunque perché è il
// link firmato dal partner.
const BEAZT_URL = "https://go.wildzaffiliates.com/visit/?bta=1000385&nci=6056";
const WILDZ_URL = "https://go.wildzaffiliates.com/visit/?bta=1000385&nci=5345&utm_campaign=betredge";

// #PARTNERS-NO-FEATURED (2026-07-29, Andrea): tutti i partner sono partner —
// nessuno sportsbook va "in evidenza" sopra gli altri. Il flag `featured` resta
// nel tipo e la sezione nel componente restano: si riaccende mettendo
// `featured: true` su una riga, senza rimettere mano al layout.
export const PARTNERS: Partner[] = [
  { id: "fortuneplay", name: "FortunePlay", category: "sportsbook", logo: "/logos/fortuneplay.svg", url: FORTUNEPLAY_BET_URL, logoShape: "emblem" },
  { id: "ybets", name: "YBets", category: "sportsbook", logo: "/logos/ybets.svg", url: YBETS_URL },
  { id: "betscore", name: "BetScore", category: "sportsbook", logo: "/logos/betscore.svg", url: BETSCORE_URL },
  // logo raster fornito dal partner (164x88 transparent): stemma quasi quadrato → stesso cap emblema di FortunePlay
  { id: "felicebet", name: "FeliceBet", category: "sportsbook", logo: "/logos/felicebet.png", url: FELICEBET_URL, logoShape: "emblem" },
  // #PARTNER-GGBET: wordmark ufficiale estratto dal file 300×300 fornito dal partner
  // (sfondo nero piatto rimosso col flood-fill dai bordi, autocrop → 400×79, 5.1:1)
  // — la vetrina mette ogni logo su placca scura fissa, un quadrato pieno stonerebbe.
  // Nessun logoShape: 5.1:1 è un wordmark come VeloBet, non un emblema.
  { id: "ggbet", name: "GG.BET", category: "sportsbook", logo: "/logos/ggbet.png", url: GGBET_URL },
  { id: "slotsbonus", name: "slotsbonus", category: "casino", logo: "/logos/slotsbonus.svg", url: SLOTSBONUS_URL },
  // #PARTNERS-VELOBET-CASEA (2026-07-31). Categoria "casino" per entrambi (scelta
  // Andrea): VeloBet è casinò + sportsbook (il suo JSON-LD si chiama "Velobet
  // Casino") anche se il link affiliato atterra sul prematch sportsbook.
  // Loghi = wordmark ufficiali dai siti dei partner, ridimensionati (nessun
  // logoShape: 5.6:1 e 2.8:1 sono wordmark, non emblemi).
  { id: "velobet", name: "VeloBet", category: "casino", logo: "/logos/velobet.png", url: VELOBET_URL },
  // Nessun `url`: Casea vive solo dove il partner ci ha dato un link (NO/CH/FI).
  { id: "casea", name: "Casea", category: "casino", logo: "/logos/casea.png", geoUrls: CASEA_GEO_URLS },
  // #PARTNER-WILDZ-BEAZT: categoria "casino" per entrambi, come VeloBet — hanno
  // anche uno sportsbook, ma il link affiliato atterra sulla vetrina casinò.
  // Loghi = marchi ufficiali SVG dei partner (assets.rootz.com), monocromatici su
  // trasparente → leggibili sulla placca scura senza ritocchi. A wildz.svg è stato
  // aggiunto solo width/height intrinseci: il file della rete ha il solo viewBox e
  // il CSS della placca normalizza per altezza, che senza dimensioni non funziona.
  // Beazt è un wordmark 4.0:1 → cap standard (134×34, 4.568px², in linea con gli
  // altri). Il lockup Wildz è 2.1:1: al cap standard renderebbe 2.380px² contro i
  // 2.856-6.510px² di tutta la vetrina, cioè sembrerebbe il partner minore →
  // logoShape emblema come FortunePlay/FeliceBet (110×54 = 5.961px², misurato).
  { id: "beazt", name: "Beazt", category: "casino", logo: "/logos/beazt.svg", url: BEAZT_URL },
  { id: "wildz", name: "Wildz", category: "casino", logo: "/logos/wildz.svg", url: WILDZ_URL, logoShape: "emblem" },
];

// #PARTNERS-VELOBET-CASEA — UNICO modo di renderizzare la vetrina (pagina + footer):
// risolve il link per paese e SCARTA i partner che in quella geo non ce l'hanno.
// `country` arriva da /api/geo-books (server-side). FAIL-CLOSED: geo ignota ("")
// → i partner geo-ristretti non compaiono; gli altri restano invariati.
export function partnersFor(country: string | null | undefined): ResolvedPartner[] {
  const cc = (country ?? "").trim().toUpperCase();
  return PARTNERS.flatMap((p) => {
    const url = p.geoUrls ? (cc ? p.geoUrls[cc] : undefined) : p.url;
    return url ? [{ ...p, url }] : [];
  });
}

// #BET-DROPDOWN-1: il menu "Piazza la scommessa" nella scheda partita riceve i
// book per NOME (da lib/affiliate + lib/betconstruct-books, che non conoscono i
// loghi). Qui li risolviamo sul catalogo. Nome sconosciuto → null: la voce resta
// valida, senza logo, invece di rompersi o mostrare un'icona sbagliata.
export function partnerLogoByName(name: string): string | null {
  const key = name.trim().toLowerCase();
  return PARTNERS.find((p) => p.name.toLowerCase() === key)?.logo ?? null;
}

// #BET-MENU-ORDER (2026-08-06, Andrea) — ordine dei partner nel menu "Piazza la
// scommessa" della scheda prediction. È una scelta di presentazione, non dei dati:
// i book arrivano da fonti diverse (BetConstruct via `fp.books` + i solo-landing
// via landingPartnersFor) e nessuna delle due controlla l'ordine finale. Ordinare
// qui, al render, vale per tutte e 3 le superfici (football/tennis desk + World Cup)
// senza toccarne i call-site. Non tocca la vetrina /partners, che ha il suo ordine.
export const BET_MENU_ORDER = ["FortunePlay", "BetScore", "VeloBet", "FeliceBet", "GG.BET", "YBets"] as const;

// Chi non è nell'ordine (es. Casea, geo-ristretta) finisce in coda mantenendo
// l'ordine d'arrivo: un partner nuovo compare comunque, non sparisce.
export function sortBooksForMenu<T extends { name: string }>(books: T[]): T[] {
  const rank = (name: string) => {
    const i = BET_MENU_ORDER.findIndex((n) => n.toLowerCase() === name.trim().toLowerCase());
    return i === -1 ? BET_MENU_ORDER.length : i;
  };
  return [...books].sort((a, b) => rank(a.name) - rank(b.name));
}

export type PartnersLang = "it" | "en" | "es" | "fr" | "ru";

export function pickPartnersLang(lang: string): PartnersLang {
  return lang === "it" || lang === "es" || lang === "fr" || lang === "ru" ? lang : "en";
}

export const PARTNERS_COPY: Record<PartnersLang, {
  back: string; title: string; subtitle: string;
  featured: string; sportsbook: string; casino: string;
  visit: string; disclosure: string;
  unavailableTitle: string; unavailableBody: string; unavailableBack: string;
}> = {
  it: {
    back: "← BetRedge",
    title: "I nostri partner",
    subtitle: "Gli operatori dove puoi agire sulle analisi di BetRedge. BetRedge non accetta scommesse: questi sono partner terzi indipendenti.",
    featured: "In evidenza", sportsbook: "Sportsbook", casino: "Casino",
    visit: "Visita", disclosure: "18+ · I link ai partner sono affiliati commerciali · Gioca responsabilmente",
    unavailableTitle: "Non disponibile nella tua area",
    unavailableBody: "Questa sezione non è disponibile dalla tua posizione.",
    unavailableBack: "← Torna alla home",
  },
  en: {
    back: "← BetRedge",
    title: "Our partners",
    subtitle: "Where you can act on BetRedge's analysis. BetRedge takes no bets — these are independent third-party partners.",
    featured: "Featured", sportsbook: "Sportsbook", casino: "Casino",
    visit: "Visit", disclosure: "18+ · Partner links are commercial affiliates · Gamble responsibly",
    unavailableTitle: "Not available in your region",
    unavailableBody: "This section is not available from your location.",
    unavailableBack: "← Back to home",
  },
  es: {
    back: "← BetRedge",
    title: "Nuestros partners",
    subtitle: "Los operadores donde puedes actuar sobre el análisis de BetRedge. BetRedge no acepta apuestas: son partners externos independientes.",
    featured: "Destacado", sportsbook: "Sportsbook", casino: "Casino",
    visit: "Visitar", disclosure: "18+ · Los enlaces de partners son afiliados comerciales · Juega con responsabilidad",
    unavailableTitle: "No disponible en tu región",
    unavailableBody: "Esta sección no está disponible desde tu ubicación.",
    unavailableBack: "← Volver al inicio",
  },
  fr: {
    back: "← BetRedge",
    title: "Nos partenaires",
    subtitle: "Les opérateurs où agir sur les analyses de BetRedge. BetRedge n'accepte pas de paris : ce sont des partenaires tiers indépendants.",
    featured: "En vedette", sportsbook: "Sportsbook", casino: "Casino",
    visit: "Visiter", disclosure: "18+ · Les liens partenaires sont des affiliés commerciaux · Jouez de manière responsable",
    unavailableTitle: "Non disponible dans votre région",
    unavailableBody: "Cette section n'est pas disponible depuis votre position.",
    unavailableBack: "← Retour à l'accueil",
  },
  ru: {
    back: "← BetRedge",
    title: "Наши партнёры",
    subtitle: "Операторы, где можно применить аналитику BetRedge. BetRedge не принимает ставки — это независимые сторонние партнёры.",
    featured: "В центре внимания", sportsbook: "Букмекеры", casino: "Казино",
    visit: "Перейти", disclosure: "18+ · Партнёрские ссылки — коммерческие аффилиаты · Играйте ответственно",
    unavailableTitle: "Недоступно в вашем регионе",
    unavailableBody: "Этот раздел недоступен из вашего местоположения.",
    unavailableBack: "← На главную",
  },
};

export const PARTNER_TAGLINES: Record<string, Record<PartnersLang, string>> = {
  fortuneplay: {
    it: "Sportsbook con quote live, collegato direttamente dalle schede BetRedge.",
    en: "Sportsbook with live odds, linked straight from BetRedge cards.",
    es: "Sportsbook con cuotas en vivo, enlazado desde las fichas de BetRedge.",
    fr: "Sportsbook avec cotes en direct, lié depuis les fiches BetRedge.",
    ru: "Букмекер с live-коэффициентами, связан прямо с карточками BetRedge.",
  },
  ybets: {
    it: "Sportsbook della rete BetConstruct, ampia copertura di campionati.",
    en: "BetConstruct-network sportsbook with broad league coverage.",
    es: "Sportsbook de la red BetConstruct, amplia cobertura de ligas.",
    fr: "Sportsbook du réseau BetConstruct, large couverture de ligues.",
    ru: "Букмекер сети BetConstruct с широким охватом лиг.",
  },
  betscore: {
    it: "Sportsbook partner con registrazione rapida.",
    en: "Partner sportsbook with a quick sign-up.",
    es: "Sportsbook partner con registro rápido.",
    fr: "Sportsbook partenaire avec inscription rapide.",
    ru: "Партнёрский букмекер с быстрой регистрацией.",
  },
  felicebet: {
    it: "Sportsbook partner, registrazione diretta dalla vetrina.",
    en: "Partner sportsbook, sign up straight from the showcase.",
    es: "Sportsbook partner, registro directo desde la vitrina.",
    fr: "Sportsbook partenaire, inscription directe depuis la vitrine.",
    ru: "Партнёрский букмекер — регистрация прямо из витрины.",
  },
  // #PARTNER-GGBET: copy FTC-safe, nessun claim su bonus o quote (la loro landing li
  // pubblicizza, noi non li abbiamo verificati → non li dichiariamo).
  ggbet: {
    it: "Sportsbook con copertura esports, oltre agli sport tradizionali.",
    en: "Sportsbook covering esports alongside traditional sports.",
    es: "Sportsbook con cobertura de esports, además de deportes tradicionales.",
    fr: "Sportsbook couvrant l'esport, en plus des sports traditionnels.",
    ru: "Букмекер с киберспортом и традиционными видами спорта.",
  },
  // #PARTNERS-VELOBET-CASEA: copy FTC-safe, nessun claim su bonus (i loro siti li
  // pubblicizzano, noi non li abbiamo verificati → non li dichiariamo).
  velobet: {
    it: "Casino e sportsbook: slot, tavoli live e prematch.",
    en: "Casino and sportsbook: slots, live tables and prematch.",
    es: "Casino y sportsbook: slots, mesas en vivo y prematch.",
    fr: "Casino et sportsbook : machines, tables live et prématch.",
    ru: "Казино и букмекер: слоты, live-столы и прематч.",
  },
  casea: {
    it: "Casino online, registrazione localizzata sul tuo paese.",
    en: "Online casino with a sign-up localised to your country.",
    es: "Casino online con registro localizado en tu país.",
    fr: "Casino en ligne, inscription localisée pour votre pays.",
    ru: "Онлайн-казино с регистрацией на языке вашей страны.",
  },
  // #PARTNER-WILDZ-BEAZT: copy FTC-safe. Beazt dichiara casinò + sport sulla sua
  // stessa landing; su Wildz il link atterra sulla vetrina casinò (lo sportsbook
  // non c'è in ogni mercato) → non lo promettiamo. Nessun claim su bonus o quote.
  beazt: {
    it: "Casino e sportsbook: slot, tavoli live e sport in un unico conto.",
    en: "Casino and sportsbook: slots, live tables and sports in one account.",
    es: "Casino y sportsbook: slots, mesas en vivo y deportes en una sola cuenta.",
    fr: "Casino et sportsbook : machines, tables live et sport sur un seul compte.",
    ru: "Казино и букмекер: слоты, live-столы и спорт в одном аккаунте.",
  },
  wildz: {
    it: "Casino online: slot e tavoli live, con pagamenti rapidi.",
    en: "Online casino: slots and live tables, with fast payouts.",
    es: "Casino online: slots y mesas en vivo, con pagos rápidos.",
    fr: "Casino en ligne : machines et tables live, retraits rapides.",
    ru: "Онлайн-казино: слоты и live-столы, быстрые выплаты.",
  },
  slotsbonus: {
    it: "Portale di bonus e offerte casino.",
    en: "A portal of casino bonuses and offers.",
    es: "Portal de bonos y ofertas de casino.",
    fr: "Portail de bonus et offres de casino.",
    ru: "Портал казино-бонусов и предложений.",
  },
};
