// components/lobby/LobbySection.tsx — #RESTYLING-0921
//
// Una fascia della lobby: titolo, una riga di spiegazione, le card, e — se la
// fascia è un assaggio — il link per vederle tutte.
//
// La spiegazione non è decorazione. Il brief chiede che ogni schermata abbia
// UNA domanda dominante e che l'utente sappia sempre perché sta guardando
// quelle righe: «le partite dove il modello si discosta di più dal mercato» fa
// esattamente questo, e vale come metodologia dichiarata.
import { useId, type ReactNode } from "react";

export function LobbySection({
  title,
  eyebrow,
  hint,
  count,
  action,
  plain,
  children,
}: {
  title: string;
  /** #RESTYLING-0921 round 7 — l'occhiello sopra il titolo («LE DISCIPLINE»,
   *  «IL CALENDARIO»): nel riferimento ogni sezione ne ha uno, e serve a dire
   *  di cosa parla il blocco prima ancora di leggerne il titolo. */
  eyebrow?: string;
  hint?: string | null;
  /** Quante righe esistono davvero dietro l'assaggio (non quante se ne vedono). */
  count?: number | null;
  action?: ReactNode;
  /** true → il corpo NON è la griglia di card ma un blocco libero (le tile
   *  fotografiche, i banner, la lista delle righe). */
  plain?: boolean;
  children: ReactNode;
}) {
  // Il titolo nomina la sezione: così ogni fascia è un landmark e chi naviga
  // con uno screen reader può saltare da «Top opportunities» a «Live now»
  // invece di attraversare tutte le card. Un <section> senza nome accessibile
  // non è un landmark e non compare nell'elenco delle regioni.
  const titleId = useId();
  return (
    <section className="br-sec" aria-labelledby={titleId}>
      <div className="br-sec__head">
        <div className="br-sec__titles">
          {eyebrow && <p className="br-sec__eyebrow">{eyebrow}</p>}
          <h2 className="br-sec__title" id={titleId}>
            {title}
            {count != null && <span className="br-sec__n">{count}</span>}
          </h2>
          {hint && <p className="br-sec__hint">{hint}</p>}
        </div>
        {action && <div className="br-sec__action">{action}</div>}
      </div>
      <div className={plain ? "br-sec__body" : "br-sec__grid"}>{children}</div>
    </section>
  );
}
