"use client";

import { useState } from "react";
import { crestUrl, isCrestHeadshot } from "@/lib/ui/crest-assets";
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
  const [failedSources, setFailedSources] = useState<Set<string>>(() => new Set());
  const markFailed = (source: string) => setFailedSources(previous => new Set(previous).add(source));
  if (url && !failedSources.has(url)) {
    // #CLASSIC-ASSET-1013 — le foto dei tennisti (TheSportsDB «cutout») sono a
    // figura intera su 160 px: a 44 px il volto misura 10 px, a 20 non esiste.
    // Il ritaglio sul volto lo fa il CSS (.br-crest-photo: tondo, foto al 200%
    // ancorata in alto), così un giocatore si riconosce come uno stemma.
    if (sport.trim().toLowerCase() === "tennis") {
      return (
        <span className={["br-crest-photo", className].filter(Boolean).join(" ")} style={{ width: size, height: size }} role="img" aria-label={team ?? ""}>
          <img src={url} alt="" style={isCrestHeadshot(url) ? { width: "100%", height: "100%" } : undefined} width={size} height={size} loading="lazy" decoding="async" onError={() => markFailed(url)} />
        </span>
      );
    }
    return <img src={url} alt={team ?? ""} width={size} height={size} className={className} loading="lazy" decoding="async" onError={() => markFailed(url)} />;
  }
  const totemSource = totem ? (size > 48 ? totem.src : totem.srcSm) : null;
  if (totemSource && !failedSources.has(totemSource)) {
    return (
      <img
        src={totemSource}
        alt={team ?? ""}
        width={size}
        height={size}
        className={className}
        loading="lazy"
        decoding="async"
        onError={() => markFailed(totemSource)}
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
