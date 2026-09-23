// components/lobby/FieldTile.tsx — #RESTYLING-0921 round 7
//
// «Scegli il tuo campo»: quattro tile FOTOGRAFICHE grandi (333×245 nel
// riferimento, quattro su una riga), non la riga di iconcine del round 2-4. La
// differenza non è estetica: una foto d'azione dice «qui si gioca a questo» in
// un colpo d'occhio, un'icona da 48px no.
//
// Anatomia letta dal riferimento: numero+nome dello sport in alto a sinistra
// («01 / FOOTBALL»), pallina in alto a destra dentro un quadratino ruotato di
// −8° (la pallina contro-ruota di 8° e resta dritta), titolo Anton in basso, e
// sotto una riga «ESPLORA ↗». Le tile senza pipeline mostrano «IN ARRIVO» e
// non sono link — il conteggio resta un DATO, mai uno zero finto.
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

export type FieldTileProps = {
  sport: string;
  /** «01», «02»… nel riferimento precede il nome dello sport. */
  index: string;
  /** Il nome in alto, in piccolo (FOOTBALL, TENNIS…). */
  kicker: string;
  /** Il titolone in basso (CALCIO, TENNIS, BASKET…). */
  label: string;
  /** Pick disponibili oggi. null/undefined = nessuna pipeline → «Coming soon». */
  count?: number | null;
  exploreLabel?: string;
  comingSoonLabel?: string;
  icon?: ReactNode;
  image: { src: string; srcSm?: string };
  /** true → il titolo va in lime, come la tile Tennis del riferimento. */
  accent?: boolean;
  href?: string;
  onClick?: (ev: MouseEvent<HTMLElement>) => void;
  className?: string;
};

export function FieldTile({
  sport, index, kicker, label, count, exploreLabel = "Explore", comingSoonLabel = "Coming soon",
  icon, image, accent, href, onClick, className,
}: FieldTileProps) {
  const soon = count == null;
  const cls = ["br-field", className].filter(Boolean).join(" ");
  const body = (
    <>
      <img
        className="br-field__img"
        src={image.src}
        srcSet={image.srcSm ? `${image.srcSm} 420w, ${image.src} 800w` : undefined}
        sizes="(max-width: 780px) 50vw, 340px"
        width={800}
        height={600}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span className="br-field__scrim" aria-hidden="true" />
      <span className="br-field__kicker">{index} / {kicker}</span>
      {icon && <span className="br-field__icon" aria-hidden="true">{icon}</span>}
      <span className="br-field__name" data-accent={accent ? "true" : undefined}>{label}</span>
      {soon ? (
        <span className="br-field__soon">{comingSoonLabel}</span>
      ) : (
        <span className="br-field__go">{exploreLabel}<b aria-hidden="true">↗</b></span>
      )}
    </>
  );

  if (soon) {
    return <div className={cls} data-sport={sport} data-state="soon" aria-disabled="true">{body}</div>;
  }
  if (href) {
    return <Link href={href} className={cls} data-sport={sport} data-state="ready" onClick={onClick}>{body}</Link>;
  }
  return <button type="button" className={cls} data-sport={sport} data-state="ready" onClick={onClick}>{body}</button>;
}

/** La griglia delle tile: un <nav> nominato, così è un landmark saltabile. */
export function FieldTileGrid({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <nav className={["br-fields", className].filter(Boolean).join(" ")} aria-label={label}>
      {children}
    </nav>
  );
}
