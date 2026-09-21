// components/lobby/SportCategoryTile.tsx — #RESTYLING-0921 round 2
//
// La riga «Football · Tennis · Basketball · …» di ref-01. Una tile = icona,
// nome dello sport, e il conteggio dei pick di oggi. Il conteggio è un DATO:
// se il chiamante non lo ha (sport senza pipeline), la tile lo dice — «Coming
// soon» — e smette di essere un link. Mai uno zero finto, mai un numero
// inventato (regola del round 1, vale anche qui).
//
// L'icona di default è il SportIcon a tratto in royal su un disco inset; il
// chiamante può passare `icon` (un raster on-palette, quando ne avremo uno —
// i sport-*-sm.png attuali hanno swoosh rossi fuori palette e non si usano).
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { SportIcon } from "@/components/ui/SportIcon";
import { GlyphArrow } from "@/components/ui/glyphs";

export type SportCategoryTileProps = {
  sport: string;
  label: string;
  /** Pick disponibili oggi. null/undefined = nessuna pipeline → «Coming soon». */
  count?: number | null;
  /** Testo del conteggio; {n} viene sostituito. Default «{n} picks today». */
  countLabel?: string;
  comingSoonLabel?: string;
  href?: string;
  onClick?: (ev: MouseEvent<HTMLElement>) => void;
  /** Sport selezionato (es. la view Football della lobby). */
  active?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function SportCategoryTile({
  sport, label, count, countLabel = "{n} picks today", comingSoonLabel = "Coming soon",
  href, onClick, active, icon, className,
}: SportCategoryTileProps) {
  const soon = count == null;
  const cls = ["br-tile", className].filter(Boolean).join(" ");
  const body = (
    <>
      <span className="br-tile__icon">{icon ?? <SportIcon sport={sport} size={20} />}</span>
      <span className="br-tile__text">
        <span className="br-tile__name">{label}</span>
        <span className="br-tile__meta">
          {soon ? comingSoonLabel : renderCount(countLabel, count)}
        </span>
      </span>
      {!soon && <GlyphArrow size={16} className="br-tile__go" />}
    </>
  );

  if (soon) {
    return <div className={cls} data-sport={sport} data-state="soon" aria-disabled="true">{body}</div>;
  }
  if (href) {
    return (
      <Link href={href} className={cls} data-sport={sport} data-state="ready" aria-current={active ? "true" : undefined} onClick={onClick}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} data-sport={sport} data-state="ready" aria-current={active ? "true" : undefined} onClick={onClick}>
      {body}
    </button>
  );
}

// «{n} picks today» → <b>45</b> picks today: il numero in grassetto è la leva
// che lo fa leggere come dato e non come prosa.
function renderCount(template: string, n: number): ReactNode {
  const [before, after] = template.split("{n}");
  if (after === undefined) return template;
  return (<>{before}<b>{n}</b>{after}</>);
}

/** La riga di tile: un <nav> nominato, così è un landmark saltabile. */
export function SportTileRow({ label = "Browse by sport", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <nav className={["br-tiles", className].filter(Boolean).join(" ")} aria-label={label}>
      {children}
    </nav>
  );
}
