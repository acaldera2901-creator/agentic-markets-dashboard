import { crestUrl } from "@/lib/ui/crest-assets";
import { totemFor, type TotemAsset } from "@/lib/ui/totem-assets";

type Props = {
  team: string | null;
  sport: string;
  size?: number;
  className?: string;
  /** #RESTYLING-0921 round 4 — totem già risolto dal chiamante (`totemPair`),
   *  quando le due squadre della stessa partita devono avere badge diversi.
   *  Omesso: si ricava da `totemFor(team, sport)`. Vale solo nel ramo senza
   *  crest con licenza: `CREST_MAP` resta prioritaria. */
  totem?: TotemAsset | null;
};

// Tinta deterministica dal nome (hash → hue), saturazione/luminosità fisse.
function tint(team: string | null): string {
  if (!team) return "hsl(220 8% 40%)";
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) % 360;
  return `hsl(${h} 42% 42%)`;
}

export function Crest({ team, sport, size = 44, className, totem }: Props) {
  const url = crestUrl(team, sport);
  if (url) {
    return <img src={url} alt={team ?? ""} width={size} height={size} className={className} />;
  }
  // #RESTYLING-0921 round 4 — al posto dello scudo tinto proceduralmente, un
  // totem disegnato (lib/ui/totem-assets.ts). Il -sm è 48²: sopra quella
  // misura si passa al 128² per non stirarlo.
  const badge = totem === undefined ? totemFor(team, sport) : totem;
  if (badge) {
    return (
      <img
        src={size > 48 ? badge.src : badge.srcSm}
        alt={team ?? ""}
        width={size}
        height={size}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }
  // Senza nome squadra non c'è un totem deterministico da assegnare: resta lo
  // scudo neutro, che non promette un'identità che non abbiamo.
  return (
    <svg width={size} height={size * (44 / 40)} viewBox="0 0 40 44" className={className} aria-label={team ?? "squadra"} role="img">
      <path d="M20 2 4 8v14c0 10 7 16 16 20 9-4 16-10 16-20V8L20 2Z" fill={tint(team)} />
    </svg>
  );
}
