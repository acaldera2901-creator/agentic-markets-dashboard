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

export type Lang = "it" | "en";

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
  copy: Record<Lang, HouseCopy>;
  cta: { href: string; it: string; en: string };
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
    },
    cta: { href: "/app?tab=account", it: "Crea account gratis →", en: "Create free account →" },
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
    },
    cta: { href: "/app?tab=account", it: "Passa a Pro →", en: "Go Pro →" },
    image: { src: "/banners/basket-court.jpg", overlay: "l" },
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
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →" },
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
    },
    cta: { href: "/app?tab=account", it: "Sali a Pro →", en: "Upgrade to Pro →" },
    image: { src: "/banners/basket-court.jpg", overlay: "l" },
  },

  // ── DESK TOPBAR (billboard sopra la board, al posto del banner partner) — Creator Picks per tutti ──
  {
    id: "topbar-creators",
    slot: "desk-topbar",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-pick", "#g-rank", "#g-trophy"],
    copy: {
      it: { eyebrow: "Creator Picks", headline: "Segui chi batte il", accent: "mercato", sub: "Schedine dei creator con track record verificato. Paper trading incluso." },
      en: { eyebrow: "Creator Picks", headline: "Follow who beats the", accent: "market", sub: "Creator slips with a verified track record. Paper trading included." },
    },
    cta: { href: "/community", it: "Scopri i creator →", en: "Discover creators →" },
    image: { src: "/banners/tennis-player.jpg", overlay: "l" },
  },

  // ── DESK FEED (foto, solo Pro: per anon/free il feed è offuscato) ──
  {
    id: "feed-edge",
    slot: "desk-feed",
    format: "rectangle",
    audiences: ["base", "premium"],
    glyphs: ["#g-ball", "#g-racket", "#g-court"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "L'edge su ogni", accent: "match", sub: "Probabilità calibrate su calcio, tennis e basket. Prima del mercato." },
      en: { eyebrow: "BetRedge Pro", headline: "The edge on every", accent: "match", sub: "Calibrated probabilities on football, tennis and basketball. Ahead of the market." },
    },
    cta: { href: "/app?tab=account", it: "Esplora le pick →", en: "Explore the picks →" },
    image: { src: "/banners/basket-player.jpg", overlay: "b" },
  },
  {
    id: "feed-worldcup",
    slot: "desk-feed",
    format: "billboard",
    audiences: ["base", "premium"],
    glyphs: ["#g-trophy", "#g-ball"],
    copy: {
      it: { eyebrow: "In evidenza · World Cup", headline: "World Cup,", accent: "match per match", sub: "Ogni partita del Mondiale letta dal modello, aggiornata live." },
      en: { eyebrow: "Featured · World Cup", headline: "World Cup,", accent: "match by match", sub: "Every World Cup game read by the model, updated live." },
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →" },
    image: { src: "/banners/football-ball.jpg", overlay: "l" },
  },

  // ── DESK BOTTOM (billboard) ─────────────────────────────────────────────
  {
    id: "bottom-anon",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["anon"],
    glyphs: ["#g-ball", "#g-racket", "#g-court", "#g-trophy"],
    copy: {
      it: { eyebrow: "Calcio · Tennis · Basket · World Cup", headline: "Un modello. Tutti gli sport.", accent: "Gratis.", sub: "Probabilità calibrate con edge. Crea un account e provalo, senza carta." },
      en: { eyebrow: "Football · Tennis · Basketball · World Cup", headline: "One model. Every sport.", accent: "Free.", sub: "Calibrated probabilities with edge. Create an account and try it, no card." },
    },
    cta: { href: "/app?tab=account", it: "Inizia gratis →", en: "Start free →" },
    image: { src: "/banners/football-pitch.jpg", overlay: "l" },
  },
  {
    id: "bottom-upgrade",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["free"],
    glyphs: ["#g-ball", "#g-racket", "#g-court", "#g-trophy"],
    copy: {
      it: { eyebrow: "Calcio · Tennis · Basket · World Cup", headline: "Un modello che trova l'edge su", accent: "ogni sport", sub: "Probabilità calibrate, prima del mercato. Provalo gratis." },
      en: { eyebrow: "Football · Tennis · Basketball · World Cup", headline: "One model that finds the edge on", accent: "every sport", sub: "Calibrated probabilities, ahead of the market. Try it free." },
    },
    cta: { href: "/app?tab=account", it: "Passa a Pro →", en: "Go Pro →" },
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
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →" },
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
    },
    cta: { href: "/app?tab=account", it: "Sali a Pro →", en: "Upgrade to Pro →" },
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
      it: { eyebrow: "Creator Picks", headline: "Le schedine che battono il", accent: "mercato", sub: "Segui i creator con track record verificato. Paper trading incluso." },
      en: { eyebrow: "Creator Picks", headline: "The slips that beat the", accent: "market", sub: "Follow creators with a verified track record. Paper trading included." },
    },
    cta: { href: "/community", it: "Scopri i creator →", en: "Discover creators →" },
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
      it: { eyebrow: "BetRedge Pro", headline: "Calcio. Tennis. Basket.", accent: "Un edge.", sub: "Probabilità calibrate su ogni disciplina." },
      en: { eyebrow: "BetRedge Pro", headline: "Football. Tennis. Basket.", accent: "One edge.", sub: "Calibrated probabilities across every discipline." },
    },
    cta: { href: "/app?tab=account", it: "Sblocca le pick →", en: "Unlock picks →" },
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
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →" },
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
    },
    cta: { href: "/app?tab=account", it: "Sblocca tutto →", en: "Unlock all →" },
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
    },
    cta: { href: "/community", it: "Scopri i creator →", en: "Discover creators →" },
  },

  // ── LANDING (billboard, brand/awareness) ────────────────────────────────
  {
    id: "landing-brand",
    slot: "landing",
    format: "billboard",
    audiences: ["anon", "free", "base", "premium"],
    glyphs: ["#g-ball", "#g-racket", "#g-court", "#g-trophy"],
    copy: {
      it: { eyebrow: "Calcio · Tennis · Basket · World Cup", headline: "Un modello.", accent: "Tutti gli sport.", sub: "Probabilità calibrate con edge su ogni disciplina. Nessuna opinione da bar." },
      en: { eyebrow: "Football · Tennis · Basketball · World Cup", headline: "One model.", accent: "Every sport.", sub: "Calibrated probabilities with an edge across every discipline. No bar-stool takes." },
    },
    cta: { href: "/app?tab=account", it: "Inizia gratis →", en: "Start free →" },
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
