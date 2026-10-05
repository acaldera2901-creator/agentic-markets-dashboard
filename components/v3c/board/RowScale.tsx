// components/v3c/board/RowScale.tsx (#REDESIGN-V3C F3)
// Il nastro della riga: mercato e stima come due punti su UNA scala comune a
// tutta la board (0–100%), con le etichette scritte sui punti. Scala comune e
// non finestra per riga: una finestra stretta farebbe sembrare enorme ogni gap
// (3 pp diventerebbero mezza riga). La precisione la porta il numero del gap,
// la scala dice dove sta la partita e quanto i due punti si toccano.
//
// Le etichette si allontanano l'una dall'altra (quella del valore più basso
// verso sinistra, l'altra verso destra), così non si sovrappongono mai anche
// quando i punti coincidono. Sky = mercato, lime = stima, tratteggio = gap.

type Props = {
  /** 0..1 o null (nessun mercato: si disegna solo la stima, o solo il mercato) */
  market: number | null;
  estimate: number | null;
  /** il testo accessibile, già nella lingua giusta */
  label: string;
  /** stima che È il prezzo del book (tennis partner-market): un punto sky solo */
  marketOnly?: boolean;
  className?: string;
};

const pos = (p: number) => Math.min(100, Math.max(0, p * 100));
const pct = (p: number) => `${Math.round(p * 100)}%`;

export function RowScale({ market, estimate, label, marketOnly = false, className }: Props) {
  const m = market == null ? null : pos(market);
  const e = estimate == null || marketOnly ? null : pos(estimate);
  const both = m != null && e != null;
  // chi sta a sinistra: a parità, il mercato (si legge da mercato a stima)
  const marketLeft = both ? (m as number) <= (e as number) : true;
  return (
    <span className={["v3c-rs", className].filter(Boolean).join(" ")} role="img" aria-label={label}>
      <span className="v3c-rs-t" aria-hidden="true">
        <u style={{ left: "0%" }} />
        <u style={{ left: "50%" }} />
        <u style={{ left: "100%" }} />
        {both ? <b style={{ left: `${Math.min(m as number, e as number)}%`, width: `${Math.abs((e as number) - (m as number))}%` }} /> : null}
        {m != null ? (
          <i className={["v3c-rs-m", marketLeft ? "v3c-rs-l" : "v3c-rs-r"].join(" ")} style={{ left: `${m}%` }}>
            <span>{pct(market as number)}</span>
          </i>
        ) : null}
        {e != null ? (
          <i className={["v3c-rs-e", marketLeft ? "v3c-rs-r" : "v3c-rs-l"].join(" ")} style={{ left: `${e}%` }}>
            <span>
              <mark>{pct(estimate as number)}</mark>
            </span>
          </i>
        ) : null}
        {marketOnly && market == null && estimate != null ? (
          <i className="v3c-rs-m v3c-rs-r" style={{ left: `${pos(estimate)}%` }}>
            <span>{pct(estimate)}</span>
          </i>
        ) : null}
      </span>
    </span>
  );
}
