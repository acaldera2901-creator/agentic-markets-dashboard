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
    cta: { href: "/app?tab=account", it: "Crea account gratis →", en: "Create free account →", es: "Crear cuenta gratis →", fr: "Créer un compte gratuit →", ru: "Создать бесплатный аккаунт →" },
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
    cta: { href: "/app?tab=account&plans=1", it: "Passa a Pro →", en: "Go Pro →", es: "Pasar a Pro →", fr: "Passer à Pro →", ru: "Перейти на Pro →" },
    image: { src: "/banners/stadium-crowd.jpg", overlay: "l" },
  },
  {
    id: "top-worldcup",
    slot: "desk-top",
    format: "leaderboard",
    audiences: ["premium"],
    glyphs: ["#g-trophy"],
    copy: {
      it: { eyebrow: "In evidenza", headline: "World Cup è", accent: "aperta", sub: "Le probabilità del modello su tutto il tabellone, aggiornate live." },
      en: { eyebrow: "Featured", headline: "World Cup is", accent: "live", sub: "Model probabilities across the whole bracket, updated live." },
      es: { eyebrow: "Destacados", headline: "El Mundial está", accent: "en directo", sub: "Las probabilidades del modelo en todo el cuadro, actualizadas en directo." },
      fr: { eyebrow: "À la une", headline: "La Coupe du Monde est", accent: "en direct", sub: "Les probabilités du modèle sur tout le tableau, mises à jour en direct." },
      ru: { eyebrow: "Избранное", headline: "Чемпионат мира", accent: "в прямом эфире", sub: "Вероятности модели по всей сетке, обновляются в реальном времени." },
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →", es: "Ir al Mundial →", fr: "Aller à la Coupe du Monde →", ru: "Перейти к ЧМ →" },
    image: { src: "/banners/stadium-night.jpg", overlay: "l" },
  },

  {
    id: "top-base",
    slot: "desk-top",
    format: "leaderboard",
    audiences: ["base"],
    glyphs: ["#g-rank", "#g-pick"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "Aggiungi gli agenti", accent: "automatici", sub: "Execution live, stake sizing e stop loss. Sali a Pro." },
      en: { eyebrow: "BetRedge Pro", headline: "Add the automatic", accent: "agents", sub: "Live execution, stake sizing and stop loss. Go Pro." },
      es: { eyebrow: "BetRedge Pro", headline: "Añade los agentes", accent: "automáticos", sub: "Ejecución en directo, stake sizing y stop loss. Sube a Pro." },
      fr: { eyebrow: "BetRedge Pro", headline: "Ajoute les agents", accent: "automatiques", sub: "Exécution en direct, stake sizing et stop loss. Passe à Pro." },
      ru: { eyebrow: "BetRedge Pro", headline: "Добавь автоматических", accent: "агентов", sub: "Исполнение в реальном времени, расчёт ставки и стоп-лосс. Перейди на Pro." },
    },
    cta: { href: "/app?tab=account&plans=1", it: "Sali a Pro →", en: "Upgrade to Pro →", es: "Subir a Pro →", fr: "Passer à Pro →", ru: "Повысить до Pro →" },
    image: { src: "/banners/football-pitch.jpg", overlay: "l" },
  },

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
    cta: { href: "/app?tab=account", it: "Esplora le pick →", en: "Explore the picks →", es: "Explorar las picks →", fr: "Explorer les picks →", ru: "Смотреть пики →" },
    image: { src: "/banners/football-action.jpg", overlay: "b" },
  },
  {
    id: "feed-worldcup",
    // #BANNERS-IN-GRID: rectangle → tile QUADRATO 1:1 impacchettato come una card
    // (default validato da Andrea). Il landscape 2-col cover-croppava il testo baked
    // del creativo; il quadrato è disegnato per il display near-square → nessun clip.
    slot: "desk-feed",
    format: "rectangle",
    audiences: ["base", "premium"],
    glyphs: ["#g-trophy", "#g-ball"],
    copy: {
      it: { eyebrow: "In evidenza · World Cup", headline: "World Cup,", accent: "match per match", sub: "Ogni partita del Mondiale letta dal modello, aggiornata live." },
      en: { eyebrow: "Featured · World Cup", headline: "World Cup,", accent: "match by match", sub: "Every World Cup game read by the model, updated live." },
      es: { eyebrow: "Destacados · Mundial", headline: "Mundial,", accent: "partido a partido", sub: "Cada partido del Mundial leído por el modelo, actualizado en directo." },
      fr: { eyebrow: "À la une · Coupe du Monde", headline: "Coupe du Monde,", accent: "match par match", sub: "Chaque match du Mondial lu par le modèle, mis à jour en direct." },
      ru: { eyebrow: "Избранное · ЧМ", headline: "Чемпионат мира,", accent: "матч за матчем", sub: "Каждый матч ЧМ прочитан моделью, обновляется в реальном времени." },
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →", es: "Ir al Mundial →", fr: "Aller à la Coupe du Monde →", ru: "Перейти к ЧМ →" },
    image: { src: "/banners/football-ball.jpg", overlay: "l" },
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
    cta: { href: "/app?tab=account", it: "Esplora il tennis →", en: "Explore tennis →", es: "Explorar el tenis →", fr: "Explorer le tennis →", ru: "Смотреть теннис →" },
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
    cta: { href: "/app?tab=account", it: "Inizia gratis →", en: "Start free →", es: "Empieza gratis →", fr: "Commence gratuitement →", ru: "Начать бесплатно →" },
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
    cta: { href: "/app?tab=account&plans=1", it: "Passa a Pro →", en: "Go Pro →", es: "Pasar a Pro →", fr: "Passer à Pro →", ru: "Перейти на Pro →" },
    image: { src: "/banners/stadium-crowd.jpg", overlay: "l" },
  },
  {
    id: "bottom-worldcup",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["premium"],
    glyphs: ["#g-trophy", "#g-ball", "#g-pick"],
    copy: {
      it: { eyebrow: "In evidenza · World Cup", headline: "Il tabellone completo, letto dal", accent: "modello", sub: "Probabilità su ogni match della World Cup, più i Creator Picks della community." },
      en: { eyebrow: "Featured · World Cup", headline: "The full bracket, read by the", accent: "model", sub: "Probabilities on every World Cup match, plus community Creator Picks." },
      es: { eyebrow: "Destacados · Mundial", headline: "El cuadro completo, leído por el", accent: "modelo", sub: "Probabilidades en cada partido del Mundial, más los Creator Picks de la comunidad." },
      fr: { eyebrow: "À la une · Coupe du Monde", headline: "Le tableau complet, lu par le", accent: "modèle", sub: "Probabilités sur chaque match du Mondial, plus les Creator Picks de la communauté." },
      ru: { eyebrow: "Избранное · ЧМ", headline: "Полная сетка, прочитанная", accent: "моделью", sub: "Вероятности по каждому матчу ЧМ, плюс Creator Picks от сообщества." },
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →", es: "Ir al Mundial →", fr: "Aller à la Coupe du Monde →", ru: "Перейти к ЧМ →" },
    image: { src: "/banners/football-pitch.jpg", overlay: "l" },
  },

  {
    id: "bottom-base",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["base"],
    glyphs: ["#g-rank", "#g-pick", "#g-trophy"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "Dal segnale all'", accent: "execution", sub: "Con Pro gli agenti piazzano per te: stake sizing, stop loss, portfolio live." },
      en: { eyebrow: "BetRedge Pro", headline: "From signal to", accent: "execution", sub: "With Pro the agents place for you: stake sizing, stop loss, live portfolio." },
      es: { eyebrow: "BetRedge Pro", headline: "De la señal a la", accent: "ejecución", sub: "Con Pro los agentes apuestan por ti: stake sizing, stop loss, portfolio en directo." },
      fr: { eyebrow: "BetRedge Pro", headline: "Du signal à l'", accent: "exécution", sub: "Avec Pro les agents misent pour toi : stake sizing, stop loss, portfolio en direct." },
      ru: { eyebrow: "BetRedge Pro", headline: "От сигнала к", accent: "исполнению", sub: "С Pro агенты ставят за тебя: расчёт ставки, стоп-лосс, портфель в реальном времени." },
    },
    cta: { href: "/app?tab=account&plans=1", it: "Sali a Pro →", en: "Upgrade to Pro →", es: "Subir a Pro →", fr: "Passer à Pro →", ru: "Повысить до Pro →" },
    image: { src: "/banners/stadium-crowd.jpg", overlay: "l" },
  },

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
    cta: { href: "/app?tab=account&plans=1", it: "Sblocca le pick →", en: "Unlock picks →", es: "Desbloquear picks →", fr: "Débloquer les picks →", ru: "Открыть пики →" },
  },
  {
    id: "rail-worldcup",
    slot: "desk-rail",
    format: "halfpage",
    audiences: ["base", "premium"],
    glyphs: ["#g-trophy", "#g-pick", "#g-ball"],
    copy: {
      it: { eyebrow: "In evidenza", headline: "World Cup,", accent: "letta dal modello.", sub: "Probabilità live su tutto il tabellone." },
      en: { eyebrow: "Featured", headline: "World Cup,", accent: "read by the model.", sub: "Live probabilities across the whole bracket." },
      es: { eyebrow: "Destacados", headline: "Mundial,", accent: "leído por el modelo.", sub: "Probabilidades en directo en todo el cuadro." },
      fr: { eyebrow: "À la une", headline: "Coupe du Monde,", accent: "lue par le modèle.", sub: "Probabilités en direct sur tout le tableau." },
      ru: { eyebrow: "Избранное", headline: "Чемпионат мира,", accent: "прочитан моделью.", sub: "Вероятности в реальном времени по всей сетке." },
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →", es: "Ir al Mundial →", fr: "Aller à la Coupe du Monde →", ru: "Перейти к ЧМ →" },
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
    cta: { href: "/app?tab=account&plans=1", it: "Sblocca tutto →", en: "Unlock all →", es: "Desbloquear todo →", fr: "Tout débloquer →", ru: "Открыть всё →" },
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
    cta: { href: "/app?tab=account", it: "Inizia gratis →", en: "Start free →", es: "Empieza gratis →", fr: "Commence gratuitement →", ru: "Начать бесплатно →" },
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
// (immagine intera 16:9 + tasto CTA sopra), come il carosello homepage — non
// più l'overlay foto+testo. La copy i18n è già dentro l'immagine; resta solo il
// CTA (per-slot, i18n) e il dismiss.
// FORMATO ABBINATO ALLA FORMA DELLO SLOT (decisione Andrea "formato giusto per slot"):
// slot larghi → 16:9 orizzontale · rectangle → 1:1 quadrato · halfpage/rail → 9:16 verticale.
const OLE_LANDSCAPE = [
  "/banners/creatives/ole-football-signal.jpg",
  "/banners/creatives/ole-multisport-onemodel.jpg",
  "/banners/creatives/ole-tennis-signal.jpg",
  "/banners/creatives/ole-multisport-edge.jpg",
  "/banners/creatives/ole-tennis-insight.jpg",
  "/banners/creatives/ole-multisport-readable.jpg",
];
const OLE_SQUARE = ["/banners/creatives/ole-square-1.jpg", "/banners/creatives/ole-square-2.jpg"];
const OLE_VERTICAL = ["/banners/creatives/ole-vertical-1.jpg", "/banners/creatives/ole-vertical-2.jpg"];

/** Creativo Ole per la campagna, del FORMATO adatto allo slot (aspect coerente →
 *  niente crop/gap/minuscoli). Match tematico sugli orizzontali + rotazione stabile. */
export function creativeFor(campaign: HouseCampaign): string {
  const id = campaign.id;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  if (campaign.format === "halfpage") return OLE_VERTICAL[h % OLE_VERTICAL.length];
  if (campaign.format === "rectangle") return OLE_SQUARE[h % OLE_SQUARE.length];
  // slot larghi (billboard / leaderboard): 16:9 tematico
  if (id.includes("creator")) return "/banners/creatives/ole-multisport-onemodel.jpg";
  if (id.includes("worldcup")) return "/banners/creatives/ole-multisport-edge.jpg";
  if (id.includes("tennis")) return "/banners/creatives/ole-tennis-signal.jpg";
  // feed-edge (pool calcio): landscape calcistico, non tennis — coerenza col contesto.
  if (id.includes("edge") || id.includes("football")) return "/banners/creatives/ole-football-signal.jpg";
  return OLE_LANDSCAPE[h % OLE_LANDSCAPE.length];
}
