// components/ui/SportChip.tsx — #RESTYLING-0921
// Categoria (sport): icona + parola, cornice sottile. È l'unica chip con bordo
// nella riga: la lega accanto è contesto e resta testo nudo (LeagueChip).
//
// #RESTYLING-0921 round 5 — l'icona è il RASTER della casa
// (/public/banners/sport-*-sm.png), lo stesso che il round 4 ha messo nelle
// sport-tile della Home e che Andrea ha approvato. Le SVG flat del round 3
// (IconSport) restavano solo qui, sui chip delle card e dei filtri: due
// linguaggi di icona per lo stesso sport nella stessa schermata.
// Fallback all'SVG per gli sport senza raster (mma, baseball, padel…): meglio
// un segno coerente che un'immagine mancante.
import { IconSport } from "@/components/ui/icons";

const LABEL: Record<string, string> = {
  football: "Football",
  tennis: "Tennis",
  worldcup: "World Cup",
  baseball: "Baseball",
  mma: "MMA",
};

/** Gli sport che hanno un raster in /public/banners/sport-<k>-sm.png. */
const RASTER = new Set(["football", "tennis", "basketball", "worldcup", "more"]);

export function sportLabel(sport: string): string {
  const key = sport.toLowerCase();
  return LABEL[key] ?? (key.charAt(0).toUpperCase() + key.slice(1));
}

export function SportChip({ sport, className }: { sport: string; className?: string }) {
  const key = sport.toLowerCase();
  return (
    <span className={["br-chip", className].filter(Boolean).join(" ")} data-kind="sport" data-sport={sport}>
      {RASTER.has(key) ? (
        // `alt=""`: il nome dello sport è scritto qui accanto.
        <img
          className="br-chip__ico"
          src={`/banners/sport-${key}-sm.png`}
          alt=""
          width={14}
          height={14}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <IconSport sport={sport} size={12} stroke={2} />
      )}
      {sportLabel(sport)}
    </span>
  );
}
