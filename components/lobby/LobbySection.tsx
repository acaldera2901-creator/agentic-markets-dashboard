// components/lobby/LobbySection.tsx — #RESTYLING-0921
//
// Una fascia della lobby: titolo, una riga di spiegazione, le card, e — se la
// fascia è un assaggio — il link per vederle tutte.
//
// La spiegazione non è decorazione. Il brief chiede che ogni schermata abbia
// UNA domanda dominante e che l'utente sappia sempre perché sta guardando
// quelle righe: «le partite dove il modello si discosta di più dal mercato» fa
// esattamente questo, e vale come metodologia dichiarata.
import type { ReactNode } from "react";

export function LobbySection({
  title,
  hint,
  count,
  action,
  children,
}: {
  title: string;
  hint?: string | null;
  /** Quante righe esistono davvero dietro l'assaggio (non quante se ne vedono). */
  count?: number | null;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="br-sec">
      <div className="br-sec__head">
        <div className="br-sec__titles">
          <h2 className="br-sec__title">
            {title}
            {count != null && <span className="br-sec__n">{count}</span>}
          </h2>
          {hint && <p className="br-sec__hint">{hint}</p>}
        </div>
        {action && <div className="br-sec__action">{action}</div>}
      </div>
      <div className="br-sec__grid">{children}</div>
    </section>
  );
}
