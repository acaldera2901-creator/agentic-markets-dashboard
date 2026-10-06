// components/v3c/match/LineChart.tsx (#REDESIGN-V3C F4)
// Il nastro intero della pagina partita: la quota di ogni book connesso a
// GRADINI (un prezzo cambia a scatti), un punto per ogni cattura vera, l'asse
// del tempo reale (prima cattura → ultima). La stima come prezzo equo è una
// linea lime da quando è stata calcolata. Notizie solo se il dato esiste.
// Nessuna interpolazione, nessuna curva, nessun punto di apertura inventato.
import type { LineEvent, TapeLine } from "@/lib/v3c/match-view";
import { priceAxis } from "@/lib/v3c/match-view";

type Props = {
  lines: readonly TapeLine[];
  /** quota equa della stima e da quando vale (ms); null = niente linea lime */
  fair: { price: number; from: number } | null;
  events: readonly LineEvent[];
  /** fidelity: il sigillo come evento annotato sull'asse del tempo (dato vero: pick_ledger.captured_at) */
  seal?: { t: number; label: string } | null;
  labels: { market: (book: string) => string; fair: string; opened: string; news: (time: string, label: string) => string; aria: string };
  bookName: (key: string) => string;
  timeLabel: (ms: number) => string;
  dayLabel: (ms: number) => string;
};

const W = 720;
const H = 270;
const L = 50;
const R = 150;
const T = 20;
const B = 34;

export function LineChart({ lines, fair, events, labels, bookName, timeLabel, dayLabel, seal = null }: Props) {
  const all = lines.flatMap((l) => l.points);
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const span = Math.max(t1 - t0, 1);
  const values = all.map((p) => p.v);
  if (fair) values.push(fair.price);
  const ax = priceAxis(values);
  const x = (t: number) => L + ((Math.min(Math.max(t, t0), t1) - t0) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - ax.lo) / (ax.hi - ax.lo)) * (H - T - B);
  // gradini: orizzontale fino alla cattura successiva, poi verticale
  const stepPath = (pts: TapeLine["points"]) =>
    pts.map((p, i) => (i === 0 ? `M${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}` : `H${x(p.t).toFixed(1)} V${y(p.v).toFixed(1)}`)).join(" ");
  const main = lines[0];
  const last = main.points[main.points.length - 1];
  const first = main.points[0];
  // tre etichette di tempo: prima cattura, metà, ultima
  const xt = [t0, t0 + span / 2, t1];
  const fairY = fair ? y(fair.price) : 0;
  // le due etichette a destra non si sovrappongono: la seconda scende o sale di 14 px
  const lblM = y(last.v) + 4;
  let lblE = fairY + 4;
  if (fair && Math.abs(lblM - lblE) < 14) {
    if (lblE >= lblM) lblE = lblM + 14;
    else lblE = lblM - 14;
  }
  return (
    <svg className="v3c-mt-chart v3c-draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.aria}>
      {ax.ticks.map((v) => (
        <g key={v}>
          <line className="gr" x1={L} x2={W - R} y1={y(v).toFixed(1)} y2={y(v).toFixed(1)} />
          <text x={L - 8} y={(y(v) + 4).toFixed(1)} textAnchor="end">
            {v.toFixed(2)}
          </text>
        </g>
      ))}
      <line className="ax" x1={L} x2={W - R} y1={H - B} y2={H - B} />
      {xt.map((t, i) => (
        <text key={i} x={x(t).toFixed(1)} y={H - 10} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
          {i === 1 ? dayLabel(t) : `${dayLabel(t)} ${timeLabel(t)}`}
        </text>
      ))}
      {events.map((e) =>
        e.t >= t0 && e.t <= t1 ? (
          <g key={e.t}>
            <line className="ev" x1={x(e.t).toFixed(1)} x2={x(e.t).toFixed(1)} y1={T} y2={H - B} />
            <text className="an" x={(x(e.t) - 6).toFixed(1)} y={T + 10} textAnchor="end">
              {labels.news(timeLabel(e.t), e.label)}
            </text>
          </g>
        ) : null,
      )}
      {seal && seal.t >= t0 && seal.t <= t1 ? (
        <g>
          <line className="ev" x1={x(seal.t).toFixed(1)} x2={x(seal.t).toFixed(1)} y1={T} y2={H - B} />
          <text className="an" x={(x(seal.t) + (x(seal.t) - L < 160 ? 6 : -6)).toFixed(1)} y={T + 10} textAnchor={x(seal.t) - L < 160 ? "start" : "end"}>
            {seal.label}
          </text>
        </g>
      ) : null}
      {fair ? (
        <>
          <line className="se" x1={x(Math.max(fair.from, t0)).toFixed(1)} x2={W - R} y1={fairY.toFixed(1)} y2={fairY.toFixed(1)} />
          <circle className="de" cx={x(Math.max(fair.from, t0)).toFixed(1)} cy={fairY.toFixed(1)} r="3.5" />
          <text className="le" x={W - R + 8} y={lblE.toFixed(1)}>
            {labels.fair}
          </text>
        </>
      ) : null}
      {lines.slice(1).map((l) => (
        <path key={l.bookmaker} className="sm2" d={stepPath(l.points)} />
      ))}
      <path className="sm" d={stepPath(main.points)} />
      {main.points.map((p) => (
        <circle key={p.t} className="cap" cx={x(p.t).toFixed(1)} cy={y(p.v).toFixed(1)} r="1.6" />
      ))}
      <circle className="cap" cx={x(last.t).toFixed(1)} cy={y(last.v).toFixed(1)} r="3.5" />
      <text className="lm" x={W - R + 8} y={lblM.toFixed(1)}>
        {labels.market(bookName(main.bookmaker))} {last.v.toFixed(2)}
      </text>
      <text className="lo" x={(x(first.t) + 4).toFixed(1)} y={Math.min(H - B - 6, y(first.v) + 16).toFixed(1)}>
        {labels.opened} {first.v.toFixed(2)}
      </text>
    </svg>
  );
}
