// components/lobby/ProBand.tsx — #RESTYLING-0921 round 6
//
// La fascia orizzontale «BETREDGE PRO»: una riga sola, gradiente blu, che
// ricorre dopo ogni hero e porta ai piani.
//
// PERCHÉ ESISTE. Nel riferimento che Andrea ha fatto costruire con Sites
// (betredge-studio-0922) questa fascia compare dopo l'hero della Home E dopo
// l'hero di ogni sezione sport: è il modo in cui quel sito porta ai piani a
// pagamento senza interrompere la lettura. Da noi il passaggio a Pro viveva
// solo dentro il menu account e nelle CTA bloccate delle card — cioè si
// vedeva solo dopo aver sbattuto contro un muro. Qui è un invito che sta in
// pagina e non copre niente.
//
// PERCHÉ UN COMPONENTE E NON TRE COPIE. Va in almeno tre posti (Home,
// Calcio, Tennis) con lo stesso disegno e testo diverso. Tre `<div>` a mano
// sarebbero divergenti entro un round.
//
// PERCHÉ `br-proband` E NON `br-pro`. `.br-promo` è già la tile della
// multipla (AccumulatorPromoTile) e `br-pro` le assomiglia abbastanza da
// confondersi leggendo il CSS. Stessa lezione di `br-edge` → `br-edgeday`
// (app/design-system.css:1821).
//
// Tutto il testo arriva dal chiamante: questo componente non conosce né la
// lingua né il prezzo. `sub` è opzionale — su telefono è la prima cosa che
// si spegne, perché la headline da sola basta a dire di cosa si tratta.
import Link from "next/link";
import type { MouseEvent } from "react";
import { IconArrow } from "@/components/ui/icons";

export type ProBandProps = {
  /** L'etichetta a sinistra. Es. "BETREDGE PRO". */
  label: string;
  /** La promessa, in grassetto. Una frase breve. */
  headline: string;
  /** Il dettaglio, accanto alla headline. Omesso → niente. */
  sub?: string;
  cta: { label: string; href: string; onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void };
  className?: string;
};

export function ProBand({ label, headline, sub, cta, className }: ProBandProps) {
  return (
    <aside className={["br-proband", className].filter(Boolean).join(" ")} aria-label={label}>
      <span className="br-proband__label">{label}</span>
      <span className="br-proband__rule" aria-hidden />
      <p className="br-proband__copy">
        <b className="br-proband__head">{headline}</b>
        {sub && <span className="br-proband__sub">{sub}</span>}
      </p>
      <Link className="br-proband__cta" href={cta.href} onClick={cta.onClick}>
        {cta.label}
        <IconArrow size={15} />
      </Link>
    </aside>
  );
}
