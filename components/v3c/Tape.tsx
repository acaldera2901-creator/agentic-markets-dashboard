// components/v3c/Tape.tsx (#REDESIGN-V3C F1)
// Il tape: la quota di mercato a gradini (sky) e, dal momento del sigillo a
// ora, il prezzo-equivalente della stima (lime). Mai curve: un prezzo cambia a
// scatti, e il grafico lo dice. Con `draw` si disegna una volta sola
// (prefers-reduced-motion lo ferma: v3c.css).
export type TapePoint = { t: number; v: number }; // t 0–100 (apertura → ora), v quota

type Props = {
  points: readonly TapePoint[];
  /** Quota equa della stima (100 / stima%). */
  fair: number;
  /** Momento del sigillo sulla scala 0–100. */
  sealT: number;
  width?: number;
  height?: number;
  draw?: boolean;
  className?: string;
};

export function Tape({ points, fair, sealT, width = 72, height = 22, draw = false, className }: Props) {
  const pts = points.length ? points : [{ t: 0, v: fair }, { t: 100, v: fair }];
  const vs = pts.map((p) => p.v).concat([fair]);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < 0.06) {
    lo -= 0.03;
    hi += 0.03;
  }
  const pad = 2;
  const x = (t: number) => (t / 100) * (width - 1) + 0.5;
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo)) * (height - pad * 2);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className={["v3c-tape", draw ? "v3c-draw" : null, className].filter(Boolean).join(" ")} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <line className="v3c-fair" x1={x(sealT).toFixed(1)} x2={width} y1={y(fair).toFixed(1)} y2={y(fair).toFixed(1)} />
      <path d={d} />
      <circle className="v3c-now" cx={x(last.t).toFixed(1)} cy={y(last.v).toFixed(1)} r="2" />
    </svg>
  );
}
