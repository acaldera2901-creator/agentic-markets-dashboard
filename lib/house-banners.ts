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

/** Chi sta guardando, derivato dallo stato profilo esistente. */
export type HouseAudience = "anon" | "free" | "pro";

/** Dove vive il banner (determina formato e contesto). */
export type HouseSlot = "desk-top" | "desk-feed" | "desk-bottom" | "landing";

/** Forma visiva del banner. */
export type HouseFormat = "leaderboard" | "rectangle" | "billboard";

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
}

// ── Campagne ────────────────────────────────────────────────────────────────
// Ordine = priorità: pickCampaign ritorna la PRIMA che combacia con (slot, audience).

export const HOUSE_CAMPAIGNS: HouseCampaign[] = [
  // ── DESK TOP (leaderboard) ──────────────────────────────────────────────
  {
    id: "top-upgrade",
    slot: "desk-top",
    format: "leaderboard",
    audiences: ["anon", "free"],
    glyphs: ["#g-ball", "#g-racket"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "Sblocca l'edge su ogni", accent: "sport", sub: "Probabilità calibrate · calcio, tennis e altro · storico verificato." },
      en: { eyebrow: "BetRedge Pro", headline: "Unlock the edge on every", accent: "sport", sub: "Calibrated probabilities · football, tennis and more · verified track record." },
    },
    cta: { href: "/app?tab=account", it: "Passa a Pro →", en: "Go Pro →" },
  },
  {
    id: "top-worldcup",
    slot: "desk-top",
    format: "leaderboard",
    audiences: ["pro"],
    glyphs: ["#g-trophy"],
    copy: {
      it: { eyebrow: "In evidenza", headline: "World Cup è", accent: "aperta", sub: "Le probabilità del modello su tutto il tabellone, aggiornate live." },
      en: { eyebrow: "Featured", headline: "World Cup is", accent: "live", sub: "Model probabilities across the whole bracket, updated live." },
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →" },
  },

  // ── DESK FEED (rectangle) ───────────────────────────────────────────────
  {
    id: "feed-upgrade",
    slot: "desk-feed",
    format: "rectangle",
    audiences: ["anon", "free"],
    glyphs: ["#g-ball", "#g-racket", "#g-court", "#g-trophy"],
    copy: {
      it: { eyebrow: "BetRedge Pro", headline: "Tutte le prediction,", accent: "senza blur", sub: "Edge calcolato su ogni match. Storico completo e Creator Picks inclusi." },
      en: { eyebrow: "BetRedge Pro", headline: "Every prediction,", accent: "unblurred", sub: "Edge computed on every match. Full history and Creator Picks included." },
    },
    cta: { href: "/app?tab=account", it: "Sblocca tutto →", en: "Unlock all →" },
  },
  {
    id: "feed-creators",
    slot: "desk-feed",
    format: "rectangle",
    audiences: ["pro"],
    glyphs: ["#g-pick", "#g-rank"],
    copy: {
      it: { eyebrow: "Creator Picks", headline: "Segui chi batte il", accent: "mercato", sub: "Schedine dei creator con track record verificato. Paper trading incluso." },
      en: { eyebrow: "Creator Picks", headline: "Follow who beats the", accent: "market", sub: "Creator slips with a verified track record. Paper trading included." },
    },
    cta: { href: "/community", it: "Scopri i creator →", en: "Discover creators →" },
  },

  // ── DESK BOTTOM (billboard) ─────────────────────────────────────────────
  {
    id: "bottom-upgrade",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["anon", "free"],
    glyphs: ["#g-ball", "#g-racket", "#g-court", "#g-trophy"],
    copy: {
      it: { eyebrow: "Calcio · Tennis · Basket · World Cup", headline: "Un modello che trova l'edge su", accent: "ogni sport", sub: "Probabilità calibrate (Dixon-Coles + xG), prima del mercato. Provalo gratis." },
      en: { eyebrow: "Football · Tennis · Basketball · World Cup", headline: "One model that finds the edge on", accent: "every sport", sub: "Calibrated probabilities (Dixon-Coles + xG), ahead of the market. Try it free." },
    },
    cta: { href: "/app?tab=account", it: "Inizia gratis →", en: "Start free →" },
  },
  {
    id: "bottom-worldcup",
    slot: "desk-bottom",
    format: "billboard",
    audiences: ["pro"],
    glyphs: ["#g-trophy", "#g-ball", "#g-pick"],
    copy: {
      it: { eyebrow: "In evidenza · World Cup", headline: "Il tabellone completo, letto dal", accent: "modello", sub: "Probabilità su ogni match della World Cup, più i Creator Picks della community." },
      en: { eyebrow: "Featured · World Cup", headline: "The full bracket, read by the", accent: "model", sub: "Probabilities on every World Cup match, plus community Creator Picks." },
    },
    cta: { href: "/world-cup", it: "Vai alla World Cup →", en: "Go to World Cup →" },
  },

  // ── LANDING (billboard, brand/awareness) ────────────────────────────────
  {
    id: "landing-brand",
    slot: "landing",
    format: "billboard",
    audiences: ["anon", "free", "pro"],
    glyphs: ["#g-ball", "#g-racket", "#g-court", "#g-trophy"],
    copy: {
      it: { eyebrow: "Calcio · Tennis · Basket · World Cup", headline: "Un modello.", accent: "Tutti gli sport.", sub: "Probabilità calibrate con edge su ogni disciplina. Nessuna opinione da bar." },
      en: { eyebrow: "Football · Tennis · Basketball · World Cup", headline: "One model.", accent: "Every sport.", sub: "Calibrated probabilities with an edge across every discipline. No bar-stool takes." },
    },
    cta: { href: "/app?tab=account", it: "Inizia gratis →", en: "Start free →" },
  },
];

/** Deriva l'audience dallo stato profilo del desk. */
export function audienceFromState(s: { hasProfile: boolean; isPro: boolean }): HouseAudience {
  if (!s.hasProfile) return "anon";
  return s.isPro ? "pro" : "free";
}

/** Prima campagna valida per (slot, audience), o null se nessuna → slot non mostrato. */
export function pickCampaign(slot: HouseSlot, audience: HouseAudience): HouseCampaign | null {
  return HOUSE_CAMPAIGNS.find((c) => c.slot === slot && c.audiences.includes(audience)) ?? null;
}
