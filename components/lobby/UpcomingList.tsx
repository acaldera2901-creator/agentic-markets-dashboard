// components/lobby/UpcomingList.tsx — #RESTYLING-0921 round 7
//
// «Prossimi match»: le stesse partite della lobby, ma in RIGHE compatte invece
// che in card a griglia. Nel riferimento è la vista con cui si scorre il
// calendario — cinque colonne (data/ora · squadre · torneo · percentuale del
// modello · freccia), separatore a 1px, nessuna riga verticale.
//
// Non sostituisce le card: è la vista alternativa, più densa, per chi vuole
// vedere venti partite invece di sei. Tutti i valori arrivano dal chiamante:
// questo componente non formatta date e non calcola probabilità.
import Link from "next/link";
import type { MouseEvent } from "react";

export type UpcomingRow = {
  key: string;
  /** Prima riga della colonna tempo (es. «26 SET»). */
  day: string;
  /** Seconda riga (es. «16:00»). Omessa → resta solo `day`. */
  time?: string | null;
  home: string;
  away: string;
  league: string;
  /** Probabilità del modello in punti percentuali. null → la colonna resta vuota. */
  modelPct: number | null;
  href: string;
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
};

export function UpcomingList({ rows, vsLabel, modelLabel, className }: {
  rows: UpcomingRow[];
  vsLabel: string;
  modelLabel: string;
  className?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className={["br-rows", className].filter(Boolean).join(" ")}>
      {rows.map((r) => (
        <Link key={r.key} href={r.href} className="br-row" onClick={r.onClick}>
          <span className="br-row__when">
            <span>{r.day}</span>
            {r.time && <span>{r.time}</span>}
          </span>
          <span className="br-row__teams">
            {r.home}<span className="br-row__vs">{vsLabel}</span>{r.away}
          </span>
          <span className="br-row__league">{r.league}</span>
          <span className="br-row__prob">
            {r.modelPct == null ? (
              <span className="br-row__prob-empty" aria-hidden="true">—</span>
            ) : (
              <>
                <b>{Math.round(r.modelPct)}%</b>
                <small>{modelLabel}</small>
              </>
            )}
          </span>
          <span className="br-row__go" aria-hidden="true">↗</span>
        </Link>
      ))}
    </div>
  );
}
