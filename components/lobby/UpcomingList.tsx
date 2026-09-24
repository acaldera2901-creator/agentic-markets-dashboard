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
import { IconLock } from "@/components/ui/icons";

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
  /** #UPCOMING-GATE-0924 — la riga sta FUORI dalla vetrina del piano di chi
   *  guarda: è il campo `locked` della proiezione d'accesso, lo stesso che
   *  chiude la card. Arriva dal chiamante, non si ricalcola qui. */
  locked?: boolean;
  href: string;
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
};

// #UPCOMING-GATE-0924 — LA RIGA CHIUSA DEVE VEDERSI CHE È CHIUSA.
//
// Fino a qui la lista rendeva ogni riga identica — stessa percentuale, stessa
// freccia, nessun segno del piano — mentre la STESSA partita, in card, portava
// il lucchetto su «Pick» e la CTA «Unlock full analysis». Due trattamenti per
// lo stesso dato nella stessa pagina: da anonimo il calendario sembrava tutto
// aperto, e chi paga non vedeva alcuna differenza.
//
// La regola non è nuova e non la decide questo componente: è quella della card
// (#RESTYLING-0921 round 2) — «il lucchetto copre la PICK, mai il numero: ciò
// che si paga è il LATO su cui scommettere, non la probabilità». Il server la
// applica già a monte: `lockedHeadline` (app/api/predictions/route.ts) manda la
// probabilità dell'esito di punta SENZA dire quale sia, quindi quel numero è
// pubblico per costruzione — nasconderlo qui mentre la card sopra lo mostra
// sarebbe un gate finto, si scrolla di due schermate e si legge lo stesso.
// Qui non c'è una colonna «Pick»: il lucchetto va dove la card lo metterebbe,
// cioè sull'etichetta sotto il numero e sull'affordance di apertura.
export function UpcomingList({ rows, vsLabel, modelLabel, lockedLabel, className }: {
  rows: UpcomingRow[];
  vsLabel: string;
  modelLabel: string;
  /** Etichetta della riga chiusa. La card scrive «Pro pick»: stessa parola. */
  lockedLabel: string;
  className?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className={["br-rows", className].filter(Boolean).join(" ")}>
      {rows.map((r) => (
        <Link
          key={r.key}
          href={r.href}
          className="br-row"
          data-locked={r.locked ? "true" : undefined}
          onClick={r.onClick}
        >
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
                {r.locked ? (
                  <small data-locked="true"><IconLock size={10} stroke={2} />{lockedLabel}</small>
                ) : (
                  <small>{modelLabel}</small>
                )}
              </>
            )}
          </span>
          <span className="br-row__go" aria-hidden="true">
            {r.locked ? <IconLock size={13} stroke={2} /> : "↗"}
          </span>
        </Link>
      ))}
    </div>
  );
}
