// lib/v3c/tokens.ts (#REDESIGN-V3C F1)
// I colori del design system v3c «Il banco», come valori — la stessa tabella
// che components/v3c/v3c.css scrive come custom property sotto
// [data-theme="v3c"]. Vivono qui per essere MISURATI (test di contrasto), non
// per essere usati inline: nel markup si usano solo le classi v3c-*.
//
// Ruoli fissi (DIRECTION-v3b): sky = mercato · evidenziatore lime = stima ·
// royal = azione · inchiostro = gap e testo · colori club = solo nella banda.
// Dove un valore coincide con un token --am-* esistente lo si dice nel
// commento; il CSS lo eredita con var(--am-*, fallback).

export const V3C_LIGHT = {
  paper: "#F3EDDC",
  paper2: "#E9E1CC",
  panel: "#FFFCF4",
  ink: "#14171C",
  ink2: "#4A515B",
  ink3: "#646C79",
  line: "#D8CFB6",
  line2: "#B9AE8F",
  navy: "#071329", // = --am-bg
  navy2: "#0D2343", // = --am-panel
  onNavy: "#EDEFF2", // = --am-text
  onNavy2: "#A8BDD6", // = --am-muted
  sky: "#0E6FA8",
  // lime «testo» (etichetta Estimate sul nastro, serie dei grafici). Il
  // prototipo aveva #4C7A00: MISURATO 4.39:1 su carta, sotto AA. Un gradino
  // più scuro fa 5.49:1 su paper e 6.26:1 su panel.
  lime: "#3F6A00",
  limeHl: "#C8FF00", // = --am-coral: il LED della fascia e l'evidenziatore
  limeMarkInk: "#14171C",
  royal: "#145AFF",
  royalInk: "#FFFFFF",
  royalT: "#144BD6", // royal come testo su carta
  live: "#B00020",
} as const;

export const V3C_DARK = {
  paper: "#071329", // = --am-bg
  paper2: "#0A1B35", // = --am-bg-2
  panel: "#0D2343", // = --am-panel
  ink: "#EDEFF2", // = --am-text
  ink2: "#A8BDD6", // = --am-muted
  ink3: "#8EA2BC",
  navy: "#112C53", // = --am-panel-2
  navy2: "#0D2343",
  onNavy: "#EDEFF2",
  onNavy2: "#A8BDD6",
  sky: "#81D9FF",
  lime: "#D3FE50",
  limeHl: "#C8FF00",
  limeMarkInk: "#D3FE50",
  royal: "#145AFF",
  royalInk: "#FFFFFF",
  royalT: "#6EA4FF",
  live: "#FFE818",
} as const;

// ── Contrasto WCAG 2.x ──────────────────────────────────────────────────────

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapporto di contrasto WCAG, sempre ≥ 1. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Un colore con alpha sopra uno sfondo opaco → l'esadecimale risultante. */
export function flatten(fgHex: string, alpha: number, bgHex: string): string {
  const f = hexToRgb(fgHex);
  const b = hexToRgb(bgHex);
  const mix = f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
  return "#" + mix.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}
