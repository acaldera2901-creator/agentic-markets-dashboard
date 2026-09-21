// components/lobby/AccumulatorPromoTile.tsx — #RESTYLING-0921 round 2
//
// La tile «Build your own accumulator» in coda alla riga degli sport
// (ref-01): occupa due colonne, ha il filo verde e porta al probability
// builder. È solo la superficie: `href` lo decide chi la monta (oggi la rotta
// è /probability-view, ma il nome delle rotte è una decisione con gate).
//
// Non è un'offerta e non ha un numero: un accumulatore costruito dal modello
// è uno strumento di lettura, non un «boost». Il copy lo dice (o non lo dice)
// — il componente non aggiunge urgenza.
import Link from "next/link";
import type { MouseEvent } from "react";
import { GlyphArrow, GlyphStack } from "@/components/ui/glyphs";

export type AccumulatorPromoTileProps = {
  title: string;
  subtitle?: string;
  href: string;
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
};

export function AccumulatorPromoTile({ title, subtitle, href, onClick, className }: AccumulatorPromoTileProps) {
  return (
    <Link href={href} className={["br-promo", className].filter(Boolean).join(" ")} onClick={onClick}>
      <span className="br-promo__icon"><GlyphStack size={22} /></span>
      <span className="br-promo__text">
        <span className="br-promo__title">{title}</span>
        {subtitle && <span className="br-promo__sub">{subtitle}</span>}
      </span>
      <GlyphArrow size={18} className="br-promo__go" />
    </Link>
  );
}
