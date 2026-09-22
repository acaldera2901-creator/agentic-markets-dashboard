import { crestUrl } from "@/lib/ui/crest-assets";
import { crestInitials } from "@/lib/ui/crest-initials";
import { type TotemAsset } from "@/lib/ui/totem-assets";

type Props = {
  team: string | null;
  sport: string;
  size?: number;
  className?: string;
  /** #RESTYLING-0921 round 7 — casa o trasferta. NON è la squadra: il crest del
   *  riferimento distingue le due tinte per RUOLO, non per identità, così la
   *  riga si legge a colpo d'occhio e nessuna squadra deve avere un asset. */
  role?: "home" | "away";
  /** #RESTYLING-0921 round 4 — i totem illustrati. Dal round 7 non sono più il
   *  default (il riferimento non li ha) ma restano raggiungibili passandoli
   *  esplicitamente: il lavoro del round 4 non si butta, va in panchina. */
  totem?: TotemAsset | null;
};

export function Crest({ team, sport, size = 44, className, role = "home", totem }: Props) {
  const url = crestUrl(team, sport);
  if (url) {
    return <img src={url} alt={team ?? ""} width={size} height={size} className={className} />;
  }
  if (totem) {
    return (
      <img
        src={size > 48 ? totem.src : totem.srcSm}
        alt={team ?? ""}
        width={size}
        height={size}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }
  // #RESTYLING-0921 round 7 — il crest del riferimento: un quadratino di due
  // tinte (casa scura, trasferta chiara) con 1-3 iniziali. Zero asset, zero
  // richieste di rete, e funziona su un campionato che non abbiamo mai visto.
  return (
    <span
      className={["br-crest", className].filter(Boolean).join(" ")}
      data-role={role}
      data-sport={sport}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      role="img"
      aria-label={team ?? "squadra"}
    >
      <span aria-hidden="true">{crestInitials(team)}</span>
    </span>
  );
}
