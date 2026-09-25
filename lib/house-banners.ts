// lib/house-banners.ts
// House banners (#HOUSE-BANNERS-1) — pubblicità PROPRIETARIA di BetRedge.
// Promuove piani/feature/eventi della piattaforma stessa: NON ad di terzi, NON
// affiliate sportsbook (quelli vivono in <AdBanner>, separato).
//
// Single source of truth dei contenuti: HOUSE_CAMPAIGNS. La selezione è
// puramente dichiarativa via pickCampaign(slot, audience) — nessuna logica di
// business qui dentro, solo dati + matching.
//
// Tono copy: probabilità / edge (Dixon-Coles + xG). Niente "vinci/guadagna
// garantito" — coerente con la linea non-gambling.

export type Lang = "it" | "en" | "es" | "fr" | "ru";

/** Chi sta guardando, segmentato per PACCHETTO (#HOUSE-PHOTO-1):
 *  anon = senza account · free = account gratis · base = piano Base pagato ·
 *  premium = piano Pro pagato. Così i banner si differenziano per pacchetto. */
export type HouseAudience = "anon" | "free" | "base" | "premium";

/** Dove vive il banner (determina formato e contesto). */
export type HouseSlot =
  | "desk-topbar"
  | "desk-top"
  | "desk-feed"
  | "desk-feed-tennis"
  | "desk-interstitial"
  | "desk-rail"
  | "desk-bottom"
  | "landing";

/** Forma visiva del banner. */
export type HouseFormat = "leaderboard" | "rectangle" | "billboard" | "halfpage";

// ── Dati reali (#HOUSE-BANNERS-2) ─────────────────────────────────────────────
// I banner ricchi (ticker/chip/mini-board) sono alimentati SOLO da dati veri del
// board. Nessun numero inventato. Se non ci sono dati → fallback sobrio.

/** Una riga matchup in input, neutra rispetto ai tipi del desk. */
export interface BannerMatchInput {
  sport: "football" | "tennis";
  name: string;        // "Inter–Milan" / "Sinner–Alcaraz"
  edge: number | null; // punti edge del modello (es. 6.2 = +6.2%)
}

/** Top edge risolto per il rendering (glifo già scelto). */
export interface BannerEdge {
  glyph: string;
  name: string;
  edge: number;
}

/** Pacchetto dati reali passato al componente. Tutti i campi opzionali:
 *  assenti → il banner degrada al fallback sobrio. */
export interface BannerData {
  topEdges: BannerEdge[];   // ordinati per edge desc
  eventsCount: number;      // eventi totali sul board
  withEdge: number;         // quanti con edge
  edgeAvgPct: number | null;// edge medio in punti (null se nessuno)
  hitRate: string | null;   // win rate storico (es. "62%"), null se assente
}

const SPORT_GLYPH: Record<BannerMatchInput["sport"], string> = {
  football: "#g-ball",
  tennis: "#g-racket",
};

/** Costruisce BannerData da input neutri. Puro, niente fetch.
 *  topN = quante righe nel ticker/mini-board (default 6). */
export function buildBannerData(
  matches: BannerMatchInput[],
  opts: { eventsCount: number; hitRate?: string | null; topN?: number },
): BannerData {
  const withEdgeRows = matches.filter(
    (m): m is BannerMatchInput & { edge: number } => typeof m.edge === "number" && m.edge > 0,
  );
  const sorted = [...withEdgeRows].sort((a, b) => b.edge - a.edge);
  const topEdges: BannerEdge[] = sorted.slice(0, opts.topN ?? 6).map((m) => ({
    glyph: SPORT_GLYPH[m.sport],
    name: m.name,
    edge: m.edge,
  }));
  const edgeAvgPct = withEdgeRows.length
    ? Math.round((withEdgeRows.reduce((s, m) => s + m.edge, 0) / withEdgeRows.length) * 10) / 10
    : null;
  return {
    topEdges,
    eventsCount: opts.eventsCount,
    withEdge: withEdgeRows.length,
    edgeAvgPct,
    hitRate: opts.hitRate ?? null,
  };
}

/** true se ci sono abbastanza dati per la versione ricca (ticker/mini-board). */
export function hasRichData(d?: BannerData | null): d is BannerData {
  return !!d && d.topEdges.length > 0;
}

export interface HouseCopy {
  eyebrow: string;
  headline: string;
  /** porzione finale dell'headline resa in coral (opzionale). */
  accent?: string;
  sub: string;
}

export interface HouseCampaign {
  id: string;
  slot: HouseSlot;
  format: HouseFormat;
  /** audience per cui la campagna è valida. */
  audiences: HouseAudience[];
  /** glifi sport mostrati (id <symbol> del SportGlyphSprite). */
  glyphs: string[];
  /** Copy per lingua. it/en obbligatorie; es/fr/ru opzionali → fallback en
   *  (vedi copyFor). Così le 5 lingue del desk sono coperte senza forzare
   *  ogni campagna a riempire tutti gli slot. */
  copy: { it: HouseCopy; en: HouseCopy } & Partial<Record<Lang, HouseCopy>>;
  /** CTA label per lingua: it/en obbligatorie, es/fr/ru opzionali → fallback en. */
  cta: { href: string; it: string; en: string } & Partial<Record<Lang, string>>;
  /** Foto di sfondo opzionale (#HOUSE-PHOTO-1). Se assente → rendering sobrio
   *  identico a prima. overlay: direzione gradiente coral (l=left, b=bottom, d=diagonal). */
  image?: { src: string; overlay?: "l" | "b" | "d" };
  /** Creativo FINITO del brand nuovo (#RESTYLING-0921), con headline, logo e CTA
   *  già cotti nei pixel. Se presente vince su creativeFor() e il tile diventa un
   *  solo <Link> con l'<img>: NIENTE footer con una seconda CTA, sarebbe doppia.
   *  `sm` è il derivato 560w per lo srcset (i master sono 1120w). */
  creative?: { src: string; sm: string };
}

// ── Campagne ────────────────────────────────────────────────────────────────
// Ordine = priorità: pickCampaign ritorna la PRIMA che combacia con (slot, audience).

export const HOUSE_CAMPAIGNS: HouseCampaign[] = [
  // ── DESK TOP (leaderboard) ──────────────────────────────────────────────
  {
    id: "top-anon",
    slot: "desk-top",
    format: "leaderboard",
    audiences: ["anon"],
    glyphs: ["#g-ball", "#g-racket"],
    copy: {
      it: { eyebrow: "Inizia gratis", headline: "L'edge su ogni", accent: "sport", sub: "Crea un account e prova il modello — calcio, tennis e altro." },
      en: { eyebrow: "Start free", headline: "The edge on every", accent: "sport", sub: "Create an account and try the model — football, tennis and more." },
      es: { eyebrow: "Empieza gratis", headline: "El edge en cada", accent: "deporte", sub: "Crea una cuenta y prueba el modelo — fútbol, tenis y más." },
      fr: { eyebrow: "Commence gratuitement", headline: "L'edge sur chaque", accent: "sport", sub: "Crée un compte et teste le modèle — football, tennis et plus." },
      ru: { eyebrow: "Начни бесплатно", headline: "Эдж в каждом", accent: "виде спорта", sub: "Создай аккаунт и попробуй модель — футбол, теннис и не только." },
    },
    cta: { href: "/plans", it: "Crea account gratis →", en: "Create free account →", es: "Crear cuenta gratis →", fr: "Créer un compte gratuit →", ru: "Создать бесплатный аккаунт →" },
    image: { src: "/banners/football-ball.jpg", overlay: "l" },
  },
  {
    id: "top-upgrade",
    slot: "desk-top",
    format: "leaderboard",
    audiences: ["free"],
    glyphs: ["#g-ball", "#g-racket"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "Sblocca l'edge su ogni", accent: "sport", sub: "Probabilità calibrate · calcio, tennis e altro · storico verificato." },
      en: { eyebrow: "BetRedge Pro", headline: "Unlock the edge on every", accent: "sport", sub: "Calibrated probabilities · football, tennis and more · verified track record." },
      es: { eyebrow: "BetRedge Pro", headline: "Desbloquea el edge en cada", accent: "deporte", sub: "Probabilidades calibradas · fútbol, tenis y más · historial verificado." },
      fr: { eyebrow: "BetRedge Pro", headline: "Débloque l'edge sur chaque", accent: "sport", sub: "Probabilités calibrées · football, tennis et plus · historique vérifié." },
      ru: { eyebrow: "BetRedge Pro", headline: "Открой эдж в каждом", accent: "виде спорта", sub: "Калиброванные вероятности · футбол, теннис и не только · проверенная история." },
    },
    cta: { href: "/plans", it: "Passa a Pro →", en: "Go Pro →", es: "Pasar a Pro →", fr: "Passer à Pro →", ru: "Перейти на Pro →" },
    image: { src: "/banners/stadium-crowd.jpg", overlay: "l" },
  },
  {
    id: "top-tools",
    slot: "desk-top",
    format: "leaderboard",
    audiences: ["premium"],
    glyphs: ["#g-desk"],
    copy: {
      it: { eyebrow: "In evidenza", headline: "Cinque calcolatori,", accent: "gratuiti", sub: "Quote, margine, EV e Kelly: i conti che fai prima di puntare, in una pagina." },
      en: { eyebrow: "Featured", headline: "Five calculators,", accent: "free", sub: "Odds, margin, EV and Kelly: the maths you run before a bet, on one page." },
      es: { eyebrow: "Featured", headline: "Cinco calculadoras,", accent: "gratis", sub: "Cuotas, margen, EV y Kelly: las cuentas previas a la apuesta, en una página." },
      fr: { eyebrow: "Featured", headline: "Cinq calculateurs,", accent: "gratuits", sub: "Cotes, marge, EV et Kelly : les calculs d'avant-pari, sur une page." },
      ru: { eyebrow: "Featured", headline: "Пять калькуляторов,", accent: "бесплатно", sub: "Коэффициенты, маржа, EV и Келли: расчёты до ставки на одной странице." },
    },
    cta: { href: "/tools", it: "Apri gli strumenti →", en: "Open the tools →", es: "Abrir las herramientas →", fr: "Ouvrir les outils →", ru: "Открыть инструменты →" },
    image: { src: "/banners/card-model.jpg", overlay: "l" },
  },

  // #LEGAL-NO-EXECUTION-0925 — campagna "top-base" rimossa (non riscritta:
  // era interamente costruita sulla promessa di esecuzione automatica).
  // Andrea, 25/09, per iscritto: «il sistema non è collegato ai conti e non
  // piazza scommesse». Review legale (legale-compliance) su un'analisi
  // psicologica commissionata da Andrea: la campagna prometteva agli utenti
  // Base, in 5 lingue, "agenti automatici" che fanno "execution live, stake
  // sizing e stop loss" — una funzione che non esiste. Verificato viva
  // (audiences:["base"], mostrata a chi ha già pagato), non codice morto.

  // ── DESK TOPBAR (billboard sopra la board, al posto del banner partner) — Creator Picks per tutti ──
  {
    id: "topbar-creators",
    slot: "desk-topbar",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-pick", "#g-rank", "#g-trophy"],
    copy: {
      it: { eyebrow: "Creator Picks", headline: "Segui i creator con", accent: "track record verificato", sub: "Schedine dei creator con storico verificato. Paper trading incluso." },
      en: { eyebrow: "Creator Picks", headline: "Follow creators with a", accent: "verified track record", sub: "Creator slips with a verified track record. Paper trading included." },
      es: { eyebrow: "Creator Picks", headline: "Sigue a creadores con", accent: "historial verificado", sub: "Boletos de creadores con historial verificado. Paper trading incluido." },
      fr: { eyebrow: "Creator Picks", headline: "Suis les créateurs avec un", accent: "historique vérifié", sub: "Tickets de créateurs avec historique vérifié. Paper trading inclus." },
      ru: { eyebrow: "Creator Picks", headline: "Следи за креаторами с", accent: "проверенной историей", sub: "Купоны креаторов с проверенной историей. Paper trading включён." },
    },
    cta: { href: "/community", it: "Scopri i creator →", en: "Discover creators →", es: "Descubre creadores →", fr: "Découvrir les créateurs →", ru: "Открыть креаторов →" },
    image: { src: "/banners/tennis-player.jpg", overlay: "l" },
  },

  // ── DESK FEED (foto, solo Pro: per anon/free il feed è offuscato) ──
  {
    id: "feed-edge",
    slot: "desk-feed",
    format: "rectangle",
    audiences: ["base", "premium"],
    glyphs: ["#g-ball", "#g-racket", "#g-trophy"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "L'edge su ogni", accent: "match", sub: "Probabilità calibrate su calcio, tennis e World Cup. Prima del mercato." },
      en: { eyebrow: "BetRedge Pro", headline: "The edge on every", accent: "match", sub: "Calibrated probabilities on football, tennis and the World Cup. Ahead of the market." },
      es: { eyebrow: "BetRedge Pro", headline: "El edge en cada", accent: "partido", sub: "Probabilidades calibradas en fútbol, tenis y el Mundial. Antes que el mercado." },
      fr: { eyebrow: "BetRedge Pro", headline: "L'edge sur chaque", accent: "match", sub: "Probabilités calibrées sur football, tennis et Coupe du Monde. Avant le marché." },
      ru: { eyebrow: "BetRedge Pro", headline: "Эдж в каждом", accent: "матче", sub: "Калиброванные вероятности по футболу, теннису и ЧМ. Раньше рынка." },
    },
    cta: { href: "/plans", it: "Esplora le pick →", en: "Explore the picks →", es: "Explorar las picks →", fr: "Explorer les picks →", ru: "Смотреть пики →" },
    image: { src: "/banners/football-action.jpg", overlay: "b" },
  },
  {
    id: "feed-tools",
    // #BANNERS-IN-GRID: rectangle → tile QUADRATO 1:1 impacchettato come una card
    // (default validato da Andrea). Il landscape 2-col cover-croppava il testo baked
    // del creativo; il quadrato è disegnato per il display near-square → nessun clip.
    slot: "desk-feed",
    format: "rectangle",
    audiences: ["base", "premium"],
    glyphs: ["#g-desk"],
    copy: {
      it: { eyebrow: "In evidenza · Strumenti", headline: "Toglie il margine", accent: "del book", sub: "Metti le quote di un mercato e leggi la linea equa che ci sta sotto." },
      en: { eyebrow: "Featured · Tools", headline: "Strip the book's", accent: "margin", sub: "Enter a market's prices and read the fair line hiding underneath." },
      es: { eyebrow: "Featured · Tools", headline: "Quita el margen", accent: "de la casa", sub: "Introduce las cuotas de un mercado y lee la línea justa que hay debajo." },
      fr: { eyebrow: "Featured · Tools", headline: "Retire la marge", accent: "du bookmaker", sub: "Saisis les cotes d'un marché et lis la ligne juste qui se cache dessous." },
      ru: { eyebrow: "Featured · Tools", headline: "Снимите маржу", accent: "букмекера", sub: "Введите цены рынка и прочитайте честную линию под ними." },
    },
    cta: { href: "/tools", it: "Apri gli strumenti →", en: "Open the tools →", es: "Abrir las herramientas →", fr: "Ouvrir les outils →", ru: "Открыть инструменты →" },
    image: { src: "/banners/card-track.jpg", overlay: "l" },
  },
  // #BANNERS-IN-GRID mix: due campagne desk-feed in più così ogni sezione
  // intercala DUE tile di FORMA diversa (landscape 16:9 + quadrato 1:1) senza
  // ripetere lo stesso creativo. La copy è cosmetica (alt/aria/CTA): il creativo
  // Ole ha già headline/logo/disclaimer baked. Parità di dichiarazione: idx pari
  // → pool calcio, idx dispari → pool tennis (vedi split in app/page.tsx).
  {
    id: "feed-picks", // calcio · slot #2 (quadrato) — id scelto per servire ole-square-2 (varietà vs quadrato tennis)
    slot: "desk-feed",
    format: "rectangle",
    audiences: ["base", "premium"],
    glyphs: ["#g-pick", "#g-rank", "#g-trophy"],
    copy: {
      it: { eyebrow: "Creator Picks", headline: "Le schedine con track record verificato", sub: "Segui i creator con storico verificato. Paper trading incluso." },
      en: { eyebrow: "Creator Picks", headline: "Slips with a verified track record", sub: "Follow creators with a verified track record. Paper trading included." },
      es: { eyebrow: "Creator Picks", headline: "Boletos con historial verificado", sub: "Sigue a creadores con historial verificado. Paper trading incluido." },
      fr: { eyebrow: "Creator Picks", headline: "Des tickets avec historique vérifié", sub: "Suis les créateurs avec historique vérifié. Paper trading inclus." },
      ru: { eyebrow: "Creator Picks", headline: "Купоны с проверенной историей", sub: "Следи за креаторами с проверенной историей. Paper trading включён." },
    },
    cta: { href: "/community", it: "Scopri i creator →", en: "Discover creators →", es: "Descubre creadores →", fr: "Découvrir les créateurs →", ru: "Открыть креаторов →" },
  },
  {
    id: "feed-tennis-model", // tennis · slot #2 (quadrato)
    slot: "desk-feed",
    format: "rectangle",
    audiences: ["base", "premium"],
    glyphs: ["#g-racket", "#g-tball", "#g-trophy"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "Il tennis letto dal modello, torneo per torneo", sub: "Probabilità calibrate su ogni superficie. Storico completo." },
      en: { eyebrow: "BetRedge Pro", headline: "Tennis read by the model, tournament by tournament", sub: "Calibrated probabilities on every surface. Full history." },
      es: { eyebrow: "BetRedge Pro", headline: "El tenis leído por el modelo, torneo a torneo", sub: "Probabilidades calibradas en cada superficie. Historial completo." },
      fr: { eyebrow: "BetRedge Pro", headline: "Le tennis lu par le modèle, tournoi par tournoi", sub: "Probabilités calibrées sur chaque surface. Historique complet." },
      ru: { eyebrow: "BetRedge Pro", headline: "Теннис прочитан моделью, турнир за турниром", sub: "Калиброванные вероятности на каждом покрытии. Полная история." },
    },
    cta: { href: "/plans", it: "Esplora il tennis →", en: "Explore tennis →", es: "Explorar el tenis →", fr: "Explorer le tennis →", ru: "Смотреть теннис →" },
  },

  // ── DESK FEED · creativi del brand nuovo (#RESTYLING-0921) ──────────────
  // Sono i 5 banner scelti da Andrea il 22/09 (mappa AD in
  // docs/reference/round5/NOTE-banner-andrea.md). Headline, logo, CTA e
  // «18+ · Play responsibly» sono cotti nell'immagine in inglese: `copy` e `cta`
  // qui servono solo ad `alt`/`aria-label` nelle 5 lingue, non si vedono.
  // Regola AD: un banner porta DOVE l'utente non è già — nessuno di questi punta
  // alla pagina che lo ospita.
  {
    id: "feed-best-bets",
    slot: "desk-feed",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-ball", "#g-racket"],
    copy: {
      it: { eyebrow: "Best Bets", headline: "Dove la probabilità del modello si stacca dal prezzo di mercato", sub: "Confronta probabilità del modello e del mercato." },
      en: { eyebrow: "Best Bets", headline: "Where the model's probability parts ways with the market price", sub: "Compare model and market probabilities." },
      es: { eyebrow: "Best Bets", headline: "Donde la probabilidad del modelo se separa del precio de mercado", sub: "Compara probabilidades del modelo y del mercado." },
      fr: { eyebrow: "Best Bets", headline: "Là où la probabilité du modèle s'écarte du prix du marché", sub: "Compare les probabilités du modèle et du marché." },
      ru: { eyebrow: "Best Bets", headline: "Там, где вероятность модели расходится с ценой рынка", sub: "Сравни вероятности модели и рынка." },
    },
    cta: { href: "/predictions", it: "Apri le Best Bets →", en: "Open Best Bets →", es: "Abrir Best Bets →", fr: "Ouvrir Best Bets →", ru: "Открыть Best Bets →" },
    creative: { src: "/banners/andrea-picks/best-bets.jpg", sm: "/banners/andrea-picks/best-bets-sm.jpg" },
  },
  {
    id: "feed-match-builder",
    slot: "desk-feed",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-ball", "#g-racket"],
    copy: {
      it: { eyebrow: "Match Builder", headline: "Costruisci la partita mercato per mercato", sub: "Esito, gol, cartellini e corner in un pannello solo." },
      en: { eyebrow: "Match Builder", headline: "Build the match market by market", sub: "Result, goals, cards and corners in one panel." },
      es: { eyebrow: "Match Builder", headline: "Construye el partido mercado a mercado", sub: "Resultado, goles, tarjetas y córners en un solo panel." },
      fr: { eyebrow: "Match Builder", headline: "Construis le match marché par marché", sub: "Résultat, buts, cartons et corners dans un seul panneau." },
      ru: { eyebrow: "Match Builder", headline: "Собери матч рынок за рынком", sub: "Исход, голы, карточки и угловые в одной панели." },
    },
    cta: { href: "/probability-view", it: "Apri il Match Builder →", en: "Open Match Builder →", es: "Abrir Match Builder →", fr: "Ouvrir Match Builder →", ru: "Открыть Match Builder →" },
    creative: { src: "/banners/andrea-picks/match-builder.jpg", sm: "/banners/andrea-picks/match-builder-sm.jpg" },
  },
  {
    id: "feed-free-tools",
    slot: "desk-feed",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-desk"],
    copy: {
      it: { eyebrow: "Strumenti gratuiti", headline: "I conti che fai prima di puntare, in una pagina", sub: "Quote, margine, EV e Kelly. Senza account." },
      en: { eyebrow: "Free tools", headline: "The maths you run before a bet, on one page", sub: "Odds, margin, EV and Kelly. No account needed." },
      es: { eyebrow: "Herramientas gratis", headline: "Las cuentas previas a la apuesta, en una página", sub: "Cuotas, margen, EV y Kelly. Sin cuenta." },
      fr: { eyebrow: "Outils gratuits", headline: "Les calculs d'avant-pari, sur une page", sub: "Cotes, marge, EV et Kelly. Sans compte." },
      ru: { eyebrow: "Бесплатные инструменты", headline: "Расчёты до ставки — на одной странице", sub: "Коэффициенты, маржа, EV и Келли. Без аккаунта." },
    },
    cta: { href: "/tools", it: "Apri gli strumenti →", en: "Explore free tools →", es: "Abrir las herramientas →", fr: "Ouvrir les outils →", ru: "Открыть инструменты →" },
    creative: { src: "/banners/andrea-picks/free-tools.jpg", sm: "/banners/andrea-picks/free-tools-sm.jpg" },
  },
  {
    id: "feed-track-record",
    slot: "desk-feed",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-rank"],
    copy: {
      it: { eyebrow: "Track record", headline: "Ogni pick che il modello ha chiuso, aperta alla lettura", sub: "Lo storico completo, vinte e perse." },
      en: { eyebrow: "Track record", headline: "Every pick the model has closed, open to read", sub: "The full history, wins and losses." },
      es: { eyebrow: "Track record", headline: "Cada pick que el modelo ha cerrado, abierta a la lectura", sub: "El historial completo, ganadas y perdidas." },
      fr: { eyebrow: "Track record", headline: "Chaque pick clôturée par le modèle, ouverte à la lecture", sub: "L'historique complet, gagnées et perdues." },
      ru: { eyebrow: "Track record", headline: "Каждая закрытая моделью ставка — открыта для чтения", sub: "Полная история, выигрыши и проигрыши." },
    },
    cta: { href: "/history", it: "Apri lo storico →", en: "Open the track record →", es: "Abrir el historial →", fr: "Ouvrir l'historique →", ru: "Открыть историю →" },
    creative: { src: "/banners/andrea-picks/track-record.jpg", sm: "/banners/andrea-picks/track-record-sm.jpg" },
  },
  {
    // Solo anon/free: la CTA cotta dice «Explore Pro», e a chi il Pro ce l'ha già
    // sarebbe una pubblicità di ciò che ha comprato.
    id: "feed-deep-analysis",
    slot: "desk-feed",
    format: "billboard",
    audiences: ["anon", "free"],
    glyphs: ["#g-ball", "#g-racket"],
    copy: {
      it: { eyebrow: "Deep Analysis", headline: "Il perché dietro ogni probabilità, non solo il numero", sub: "Forma, gol attesi e contesto, riga per riga." },
      en: { eyebrow: "Deep Analysis", headline: "The why behind every probability, not just the number", sub: "Form, expected goals and context, line by line." },
      es: { eyebrow: "Deep Analysis", headline: "El porqué detrás de cada probabilidad, no solo el número", sub: "Forma, goles esperados y contexto, línea a línea." },
      fr: { eyebrow: "Deep Analysis", headline: "Le pourquoi derrière chaque probabilité, pas seulement le chiffre", sub: "Forme, buts attendus et contexte, ligne par ligne." },
      ru: { eyebrow: "Deep Analysis", headline: "Почему за каждой вероятностью, а не только число", sub: "Форма, ожидаемые голы и контекст — строка за строкой." },
    },
    cta: { href: "/plans", it: "Scopri il Pro →", en: "Explore Pro →", es: "Descubrir Pro →", fr: "Découvrir Pro →", ru: "Узнать о Pro →" },
    creative: { src: "/banners/andrea-picks/deep-analysis-pro.jpg", sm: "/banners/andrea-picks/deep-analysis-pro-sm.jpg" },
  },
  // #RESTYLING-0921 round 12 — DUE CREATIVI PER LE GRIGLIE DI SCHEDE.
  //
  // Il board tennis renderizzava ZERO banner: `tennisFeed` filtra su
  // `campaignSport(c) === "tennis"` e nessuna delle cinque campagne sopra è
  // tennis (hanno entrambi i glifi, o nessuno dei due → "neutral", che finisce
  // nel feed calcio). Non era una scelta, era un buco.
  //
  // Le due qui sotto lo chiudono e insieme danno alle due griglie creativi
  // DIVERSI da quelli che la Home mostra in «Da approfondire» — che pesca i
  // primi due della lista. Il soggetto della foto decide il feed: la ragazza
  // col rovescio dell'EV Calculator sta nel tennis, il calciatore dell'Odds
  // Converter nel calcio. Entrambe portano DOVE l'utente non è (un tool),
  // che è la regola AD di sempre, e nessuna delle due alza la densità: il
  // cap per griglia resta due (`FEED_TILES_MAX`).
  {
    id: "feed-ev-calculator",
    slot: "desk-feed",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    // Solo racket: è ciò che manda la campagna nel feed TENNIS (campaignSport).
    glyphs: ["#g-racket"],
    copy: {
      it: { eyebrow: "EV Calculator", headline: "Misura il valore prima di puntare, non dopo", sub: "Confronta la tua probabilità con il prezzo." },
      en: { eyebrow: "EV Calculator", headline: "Measure the value before the bet, not after", sub: "Compare your probability with the price." },
      es: { eyebrow: "EV Calculator", headline: "Mide el valor antes de apostar, no después", sub: "Compara tu probabilidad con el precio." },
      fr: { eyebrow: "EV Calculator", headline: "Mesure la valeur avant le pari, pas après", sub: "Compare ta probabilité avec le prix." },
      ru: { eyebrow: "EV Calculator", headline: "Измерь ценность до ставки, а не после", sub: "Сравни свою вероятность с ценой." },
    },
    cta: { href: "/tools/ev-calculator", it: "Calcola l'EV →", en: "Calculate expected value →", es: "Calcular el EV →", fr: "Calculer l'EV →", ru: "Посчитать EV →" },
    creative: { src: "/banners/andrea-picks/ev-calculator.jpg", sm: "/banners/andrea-picks/ev-calculator-sm.jpg" },
  },
  {
    id: "feed-odds-converter",
    slot: "desk-feed",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-ball"],
    copy: {
      it: { eyebrow: "Odds Converter", headline: "Lo stesso prezzo in tre formati, e la probabilità implicita", sub: "Decimali, frazionarie, americane." },
      en: { eyebrow: "Odds Converter", headline: "One price in three formats, and the probability behind it", sub: "Decimal, fractional, American." },
      es: { eyebrow: "Odds Converter", headline: "Un precio en tres formatos, y la probabilidad implícita", sub: "Decimales, fraccionarias, americanas." },
      fr: { eyebrow: "Odds Converter", headline: "Un prix en trois formats, et la probabilité implicite", sub: "Décimales, fractionnaires, américaines." },
      ru: { eyebrow: "Odds Converter", headline: "Одна цена в трёх форматах и вероятность за ней", sub: "Десятичные, дробные, американские." },
    },
    cta: { href: "/tools/odds-converter", it: "Converti le quote →", en: "Convert your odds →", es: "Convertir las cuotas →", fr: "Convertir les cotes →", ru: "Конвертировать коэффициенты →" },
    creative: { src: "/banners/andrea-picks/odds-converter.jpg", sm: "/banners/andrea-picks/odds-converter-sm.jpg" },
  },

  // ── DESK BOTTOM (billboard) ─────────────────────────────────────────────
  {
    id: "bottom-anon",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["anon"],
    glyphs: ["#g-ball", "#g-racket", "#g-trophy"],
    copy: {
      it: { eyebrow: "Calcio · Tennis · World Cup", headline: "Un modello. Tutti gli sport.", accent: "Gratis.", sub: "Probabilità calibrate con edge. Crea un account e provalo, senza carta." },
      en: { eyebrow: "Football · Tennis · World Cup", headline: "One model. Every sport.", accent: "Free.", sub: "Calibrated probabilities with edge. Create an account and try it, no card." },
      es: { eyebrow: "Fútbol · Tenis · Mundial", headline: "Un modelo. Todos los deportes.", accent: "Gratis.", sub: "Probabilidades calibradas con edge. Crea una cuenta y pruébalo, sin tarjeta." },
      fr: { eyebrow: "Football · Tennis · Coupe du Monde", headline: "Un modèle. Tous les sports.", accent: "Gratuit.", sub: "Probabilités calibrées avec edge. Crée un compte et teste, sans carte." },
      ru: { eyebrow: "Футбол · Теннис · ЧМ", headline: "Одна модель. Все виды спорта.", accent: "Бесплатно.", sub: "Калиброванные вероятности с эджем. Создай аккаунт и попробуй, без карты." },
    },
    cta: { href: "/plans", it: "Inizia gratis →", en: "Start free →", es: "Empieza gratis →", fr: "Commence gratuitement →", ru: "Начать бесплатно →" },
    image: { src: "/banners/football-pitch.jpg", overlay: "l" },
  },
  {
    id: "bottom-upgrade",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["free"],
    glyphs: ["#g-ball", "#g-racket", "#g-trophy"],
    copy: {
      it: { eyebrow: "Calcio · Tennis · World Cup", headline: "Un modello che trova l'edge su", accent: "ogni sport", sub: "Probabilità calibrate, prima del mercato. Provalo gratis." },
      en: { eyebrow: "Football · Tennis · World Cup", headline: "One model that finds the edge on", accent: "every sport", sub: "Calibrated probabilities, ahead of the market. Try it free." },
      es: { eyebrow: "Fútbol · Tenis · Mundial", headline: "Un modelo que encuentra el edge en", accent: "cada deporte", sub: "Probabilidades calibradas, antes que el mercado. Pruébalo gratis." },
      fr: { eyebrow: "Football · Tennis · Coupe du Monde", headline: "Un modèle qui trouve l'edge sur", accent: "chaque sport", sub: "Probabilités calibrées, avant le marché. Teste-le gratuitement." },
      ru: { eyebrow: "Футбол · Теннис · ЧМ", headline: "Модель, которая находит эдж в", accent: "каждом спорте", sub: "Калиброванные вероятности, раньше рынка. Попробуй бесплатно." },
    },
    cta: { href: "/plans", it: "Passa a Pro →", en: "Go Pro →", es: "Pasar a Pro →", fr: "Passer à Pro →", ru: "Перейти на Pro →" },
    image: { src: "/banners/stadium-crowd.jpg", overlay: "l" },
  },
  {
    id: "bottom-tools",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["premium"],
    glyphs: ["#g-trophy", "#g-ball", "#g-pick"],
    copy: {
      it: { eyebrow: "Strumenti", headline: "Quanto puntare,", accent: "non solo cosa", sub: "Il criterio di Kelly dimensiona la puntata sul tuo bankroll e sul vantaggio reale." },
      en: { eyebrow: "Tools", headline: "How much to stake,", accent: "not just what", sub: "The Kelly criterion sizes the bet on your bankroll and your real edge." },
      es: { eyebrow: "Tools", headline: "Cuánto apostar,", accent: "no solo qué", sub: "El criterio de Kelly dimensiona la apuesta según tu bankroll y tu ventaja real." },
      fr: { eyebrow: "Tools", headline: "Combien miser,", accent: "pas seulement quoi", sub: "Le critère de Kelly dimensionne la mise sur ta bankroll et ton avantage réel." },
      ru: { eyebrow: "Tools", headline: "Сколько ставить,", accent: "а не только на что", sub: "Критерий Келли подбирает размер ставки под ваш банк и реальное преимущество." },
    },
    cta: { href: "/tools", it: "Apri gli strumenti →", en: "Open the tools →", es: "Abrir las herramientas →", fr: "Ouvrir les outils →", ru: "Открыть инструменты →" },
    image: { src: "/banners/card-plans.jpg", overlay: "l" },
  },

  // #LEGAL-NO-EXECUTION-0925 — campagna "bottom-base" rimossa, stesso motivo
  // di "top-base" sopra: "gli agenti piazzano per te" era la formulazione più
  // esplicita di tutta la copy — non riscritta apposta, era interamente
  // costruita su quella promessa.

  // ── DESK INTERSTITIAL (billboard) — solo Pro (foto): per anon il board è offuscato ──
  {
    id: "interstitial-creators",
    slot: "desk-interstitial",
    format: "billboard",
    audiences: ["base", "premium"],
    glyphs: ["#g-pick", "#g-rank", "#g-trophy"],
    copy: {
      it: { eyebrow: "Creator Picks", headline: "Le schedine con", accent: "track record verificato", sub: "Segui i creator con storico verificato. Paper trading incluso." },
      en: { eyebrow: "Creator Picks", headline: "Slips with a", accent: "verified track record", sub: "Follow creators with a verified track record. Paper trading included." },
      es: { eyebrow: "Creator Picks", headline: "Boletos con", accent: "historial verificado", sub: "Sigue a creadores con historial verificado. Paper trading incluido." },
      fr: { eyebrow: "Creator Picks", headline: "Des tickets avec", accent: "historique vérifié", sub: "Suis les créateurs avec historique vérifié. Paper trading inclus." },
      ru: { eyebrow: "Creator Picks", headline: "Купоны с", accent: "проверенной историей", sub: "Следи за креаторами с проверенной историей. Paper trading включён." },
    },
    cta: { href: "/community", it: "Scopri i creator →", en: "Discover creators →", es: "Descubre creadores →", fr: "Découvrir les créateurs →", ru: "Открыть креаторов →" },
    image: { src: "/banners/football-action.jpg", overlay: "d" },
  },

  // ── DESK RAIL (half page, sidebar) ──────────────────────────────────────
  {
    id: "rail-upgrade",
    slot: "desk-rail",
    format: "halfpage",
    audiences: ["anon", "free"],
    glyphs: ["#g-trophy", "#g-ball", "#g-racket"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "Calcio. Tennis. World Cup.", accent: "Un edge.", sub: "Probabilità calibrate su ogni disciplina." },
      en: { eyebrow: "BetRedge Pro", headline: "Football. Tennis. World Cup.", accent: "One edge.", sub: "Calibrated probabilities across every discipline." },
      es: { eyebrow: "BetRedge Pro", headline: "Fútbol. Tenis. Mundial.", accent: "Un edge.", sub: "Probabilidades calibradas en cada disciplina." },
      fr: { eyebrow: "BetRedge Pro", headline: "Football. Tennis. Coupe du Monde.", accent: "Un edge.", sub: "Probabilités calibrées sur chaque discipline." },
      ru: { eyebrow: "BetRedge Pro", headline: "Футбол. Теннис. ЧМ.", accent: "Один эдж.", sub: "Калиброванные вероятности в каждой дисциплине." },
    },
    cta: { href: "/plans", it: "Sblocca le pick →", en: "Unlock picks →", es: "Desbloquear picks →", fr: "Débloquer les picks →", ru: "Открыть пики →" },
  },
  {
    id: "rail-tools",
    slot: "desk-rail",
    format: "halfpage",
    audiences: ["base", "premium"],
    glyphs: ["#g-trophy", "#g-pick", "#g-ball"],
    copy: {
      it: { eyebrow: "Gratis", headline: "Convertitore", accent: "di quote", sub: "Decimali, frazionarie, americane e probabilità implicita." },
      en: { eyebrow: "Free", headline: "Odds", accent: "converter", sub: "Decimal, fractional, American and implied probability." },
      es: { eyebrow: "Free", headline: "Conversor", accent: "de cuotas", sub: "Decimales, fraccionarias, americanas y probabilidad implícita." },
      fr: { eyebrow: "Free", headline: "Convertisseur", accent: "de cotes", sub: "Décimales, fractionnaires, américaines et probabilité implicite." },
      ru: { eyebrow: "Free", headline: "Конвертер", accent: "коэффициентов", sub: "Десятичные, дробные, американские и подразумеваемая вероятность." },
    },
    cta: { href: "/tools", it: "Apri gli strumenti →", en: "Open the tools →", es: "Abrir las herramientas →", fr: "Ouvrir les outils →", ru: "Открыть инструменты →" },
  },

  // ── DESK FEED TENNIS (rectangle) ────────────────────────────────────────
  {
    id: "feed-tennis-upgrade",
    slot: "desk-feed-tennis",
    format: "rectangle",
    audiences: ["anon", "free"],
    glyphs: ["#g-racket", "#g-tball"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "Anche il tennis,", accent: "senza blur", sub: "Probabilità calibrate su ogni torneo. Storico completo." },
      en: { eyebrow: "BetRedge Pro", headline: "Tennis too,", accent: "unblurred", sub: "Calibrated probabilities on every tournament. Full history." },
      es: { eyebrow: "BetRedge Pro", headline: "El tenis también,", accent: "sin difuminar", sub: "Probabilidades calibradas en cada torneo. Historial completo." },
      fr: { eyebrow: "BetRedge Pro", headline: "Le tennis aussi,", accent: "sans flou", sub: "Probabilités calibrées sur chaque tournoi. Historique complet." },
      ru: { eyebrow: "BetRedge Pro", headline: "Теннис тоже,", accent: "без размытия", sub: "Калиброванные вероятности по каждому турниру. Полная история." },
    },
    cta: { href: "/plans", it: "Sblocca tutto →", en: "Unlock all →", es: "Desbloquear todo →", fr: "Tout débloquer →", ru: "Открыть всё →" },
  },
  {
    id: "feed-tennis-creators",
    slot: "desk-feed-tennis",
    format: "rectangle",
    audiences: ["base", "premium"],
    glyphs: ["#g-pick", "#g-racket"],
    copy: {
      it: { eyebrow: "Creator Picks", headline: "Le pick tennis dei", accent: "creator", sub: "Track record verificato, paper trading incluso." },
      en: { eyebrow: "Creator Picks", headline: "Tennis picks from", accent: "creators", sub: "Verified track record, paper trading included." },
      es: { eyebrow: "Creator Picks", headline: "Las picks de tenis de los", accent: "creadores", sub: "Historial verificado, paper trading incluido." },
      fr: { eyebrow: "Creator Picks", headline: "Les picks tennis des", accent: "créateurs", sub: "Historique vérifié, paper trading inclus." },
      ru: { eyebrow: "Creator Picks", headline: "Теннисные пики от", accent: "креаторов", sub: "Проверенная история, paper trading включён." },
    },
    cta: { href: "/community", it: "Scopri i creator →", en: "Discover creators →", es: "Descubre creadores →", fr: "Découvrir les créateurs →", ru: "Открыть креаторов →" },
  },

  // ── LANDING (billboard, brand/awareness) ────────────────────────────────
  {
    id: "landing-brand",
    slot: "landing",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-ball", "#g-racket", "#g-trophy"],
    copy: {
      it: { eyebrow: "Calcio · Tennis · World Cup", headline: "Un modello.", accent: "Tutti gli sport.", sub: "Probabilità calibrate con edge su ogni disciplina. Nessuna opinione da bar." },
      en: { eyebrow: "Football · Tennis · World Cup", headline: "One model.", accent: "Every sport.", sub: "Calibrated probabilities with an edge across every discipline. No bar-stool takes." },
      es: { eyebrow: "Fútbol · Tenis · Mundial", headline: "Un modelo.", accent: "Todos los deportes.", sub: "Probabilidades calibradas con edge en cada disciplina. Sin charlas de bar." },
      fr: { eyebrow: "Football · Tennis · Coupe du Monde", headline: "Un modèle.", accent: "Tous les sports.", sub: "Probabilités calibrées avec edge sur chaque discipline. Pas d'avis de comptoir." },
      ru: { eyebrow: "Футбол · Теннис · ЧМ", headline: "Одна модель.", accent: "Все виды спорта.", sub: "Калиброванные вероятности с эджем в каждой дисциплине. Без разговоров за барной стойкой." },
    },
    cta: { href: "/plans", it: "Inizia gratis →", en: "Start free →", es: "Empieza gratis →", fr: "Commence gratuitement →", ru: "Начать бесплатно →" },
    image: { src: "/banners/football-pitch.jpg", overlay: "l" },
  },
];

/** Deriva il pacchetto dal piano del profilo client (#HOUSE-PHOTO-1).
 *  premium/admin → premium · base → base · tutto il resto con profilo → free · nessun profilo → anon. */
export function audienceFromPlan(plan: string | null | undefined): HouseAudience {
  if (!plan) return "anon";
  if (plan === "premium" || plan === "admin_full") return "premium";
  if (plan === "base") return "base";
  return "free";
}

/** Prima campagna valida per (slot, audience), o null se nessuna → slot non mostrato. */
export function pickCampaign(slot: HouseSlot, audience: HouseAudience): HouseCampaign | null {
  return HOUSE_CAMPAIGNS.find((c) => c.slot === slot && c.audiences.includes(audience)) ?? null;
}

/** Tutte le campagne valide per (slot, audience), in ordine di priorità (#HOUSE-PHOTO-1).
 *  Usato per intercalare banner DIVERSI tra le card prediction (rotazione per indice). */
export function campaignsFor(slot: HouseSlot, audience: HouseAudience): HouseCampaign[] {
  return HOUSE_CAMPAIGNS.filter((c) => c.slot === slot && c.audiences.includes(audience));
}

/** Copy della campagna nella lingua richiesta, con fallback a en se la lingua
 *  non è tradotta per quella campagna. Copre le 5 lingue del desk. */
export function copyFor(campaign: HouseCampaign, lang: Lang): HouseCopy {
  return campaign.copy[lang] ?? campaign.copy.en;
}

/** Label CTA della campagna nella lingua richiesta, con fallback a en. */
export function ctaLabelFor(campaign: HouseCampaign, lang: Lang): string {
  return campaign.cta[lang] ?? campaign.cta.en;
}

// ── Creativi Ole (#HOUSE-OLE) ────────────────────────────────────────────────
// Decisione Andrea: i banner house in-app mostrano i CREATIVI FINITI di Ole
// (immagine intera + tasto CTA sopra), come il carosello homepage — non più
// l'overlay foto+testo. La copy i18n è già dentro l'immagine; resta solo il
// CTA (per-slot, i18n) e il dismiss.
// FORMATO ABBINATO ALLA FORMA DELLO SLOT: slot larghi → 16:9 orizzontale ·
// rectangle → 1:1 quadrato · halfpage/rail → 9:16 verticale.
// #BANNER-FEED-FIX-0708: i creativi sono COERENTI PER SPORT — mai un creativo
// calcistico nella sezione tennis (e viceversa). La scelta è guidata da
// campaignSport(), non da un hash cieco sul pool (era la causa del bug: un
// quadrato calcio/World Cup finiva nel feed tennis).
const OLE_TENNIS = [
  "/banners/creatives/ole-tennis-signal.jpg",
  "/banners/creatives/ole-tennis-insight.jpg",
];
const OLE_FOOTBALL = ["/banners/creatives/ole-football-signal.jpg"];
const OLE_MULTISPORT = [
  "/banners/creatives/ole-multisport-onemodel.jpg",
  "/banners/creatives/ole-multisport-edge.jpg",
  "/banners/creatives/ole-multisport-readable.jpg",
];
const OLE_SQUARE_TENNIS = "/banners/creatives/ole-square-1.jpg";   // WTA — soggetto tennis
const OLE_SQUARE_FOOTBALL = "/banners/creatives/ole-square-2.jpg"; // World Cup — soggetto calcio
const OLE_VERTICAL = ["/banners/creatives/ole-vertical-1.jpg", "/banners/creatives/ole-vertical-2.jpg"];

/** Sport di appartenenza di una campagna, per abbinare creativo E sezione feed.
 *  Deriva da id + glifi: tennis puro → "tennis"; calcio/World Cup → "football";
 *  multisport/creator (entrambi o nessuno) → "neutral". */
export function campaignSport(c: HouseCampaign): "football" | "tennis" | "neutral" {
  const id = c.id;
  if (id.includes("tennis")) return "tennis";
  if (id.includes("football") || id.includes("edge")) return "football";
  const g = c.glyphs.join(" ");
  const hasTennis = /#g-racket|#g-tball|#g-grass|#g-court/.test(g);
  const hasFootball = /#g-ball|#g-pitch/.test(g); // NB: #g-trophy è multisport → non conta come "solo calcio"
  if (hasTennis && !hasFootball) return "tennis";
  if (hasFootball && !hasTennis) return "football";
  return "neutral";
}

/** Creativo Ole per la campagna, del FORMATO adatto allo slot (aspect coerente →
 *  niente crop/gap/minuscoli) E coerente per SPORT con la sezione che lo ospita. */
export function creativeFor(campaign: HouseCampaign): string {
  // #RESTYLING-0921: un creativo dichiarato sulla campagna vince sulla rotazione
  // Ole, che è del brand vecchio. Nessun hash, nessun pool: questa campagna ha
  // la SUA immagine.
  if (campaign.creative) return campaign.creative.src;
  const id = campaign.id;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const sport = campaignSport(campaign);
  // Quadrato 1:1 (feed): tennis → creativo tennis · resto → creativo calcio.
  if (campaign.format === "rectangle") return sport === "tennis" ? OLE_SQUARE_TENNIS : OLE_SQUARE_FOOTBALL;
  // Verticale 9:16 (rail): creativi brand-neutri.
  if (campaign.format === "halfpage") return OLE_VERTICAL[h % OLE_VERTICAL.length];
  // Landscape 16:9 (slot larghi + feed calcio):
  if (id.includes("creator") || id.includes("picks")) return OLE_MULTISPORT[h % OLE_MULTISPORT.length];
  if (sport === "tennis") return OLE_TENNIS[h % OLE_TENNIS.length];
  if (sport === "football") return OLE_FOOTBALL[0];
  return OLE_MULTISPORT[h % OLE_MULTISPORT.length];
}
