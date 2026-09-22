// lib/ui/totem-assets.ts — #RESTYLING-0921 round 4
//
// Badge originali per le prediction card al posto dello scudo tinto di Crest.tsx.
// Non sono crest reali (CREST_MAP resta la via per i loghi con licenza, se mai
// arriveranno): sono 12 totem disegnati apposta, uno stile solo (targa navy
// smussata a 45° + simbolo in un colore), generati con Codex e archiviati in
// /public/badges/totem-<nome>.png (128²) e -sm.png (48²).
//
// La mappa squadra → totem è deterministica per hash, come la tinta dello
// scudo che sostituisce: stessa squadra, stesso badge in ogni card e sessione.
// Due squadre della stessa partita non devono condividere il totem: chi
// compone la card passa `avoid` con il totem dell'avversaria.

export type TotemColor = "lime" | "sky" | "yellow" | "ivory";

export type Totem = {
  name: string;
  color: TotemColor;
  /** Colore del simbolo, utile per tinteggiare il testo accanto al badge. */
  hex: string;
};

// L'ordine è parte del contratto: cambiarlo cambia il badge di ogni squadra.
export const TOTEMS: readonly Totem[] = [
  { name: "bolt", color: "lime", hex: "#C8FF3D" },
  { name: "star", color: "lime", hex: "#C8FF3D" },
  { name: "oak", color: "lime", hex: "#C8FF3D" },
  { name: "wolf", color: "sky", hex: "#7FC4FF" },
  { name: "tower", color: "sky", hex: "#7FC4FF" },
  { name: "anchor", color: "sky", hex: "#7FC4FF" },
  { name: "wave", color: "yellow", hex: "#FFD84A" },
  { name: "comet", color: "yellow", hex: "#FFD84A" },
  { name: "eagle", color: "yellow", hex: "#FFD84A" },
  { name: "mountain", color: "ivory", hex: "#F5F2E9" },
  { name: "moon", color: "ivory", hex: "#F5F2E9" },
  { name: "diamond", color: "ivory", hex: "#F5F2E9" },
];

export type TotemAsset = Totem & { src: string; srcSm: string };

function key(team: string, sport: string): string {
  return `${sport.toLowerCase()}:${team.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

// FNV-1a a 32 bit: stabile fra runtime e piattaforme, a differenza di un
// `% 360` su charCode che qui non basterebbe a distribuire 12 classi.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function totemIndex(team: string, sport: string): number {
  return fnv1a(key(team, sport)) % TOTEMS.length;
}

function asset(t: Totem): TotemAsset {
  return { ...t, src: `/badges/totem-${t.name}.png`, srcSm: `/badges/totem-${t.name}-sm.png` };
}

/**
 * Totem di una squadra. `avoid` è il nome del totem già assegnato
 * all'avversaria: se coincide si passa al successivo, così le due card di una
 * partita non mostrano mai lo stesso badge.
 */
export function totemFor(
  team: string | null,
  sport: string,
  opts: { avoid?: string | null } = {},
): TotemAsset | null {
  if (!team || !team.trim()) return null;
  let i = totemIndex(team, sport);
  if (opts.avoid && TOTEMS[i].name === opts.avoid) i = (i + 1) % TOTEMS.length;
  return asset(TOTEMS[i]);
}

/** I due totem di una partita, già distinti fra loro. */
export function totemPair(
  home: string | null,
  away: string | null,
  sport: string,
): { home: TotemAsset | null; away: TotemAsset | null } {
  const h = totemFor(home, sport);
  const a = totemFor(away, sport, { avoid: h?.name });
  return { home: h, away: a };
}
