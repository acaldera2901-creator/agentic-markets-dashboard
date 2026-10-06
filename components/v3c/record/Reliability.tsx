"use client";
// components/v3c/record/Reliability.tsx (#REDESIGN-V3C F6) — la sezione
// dedicata alla calibrazione (#calibration). Il grafico della v1 che Andrea ha
// apprezzato (serie collegate, punto grande quanto n) con le correzioni di
// v3b: intervalli 95% (Wilson) sulla stima, «limited sample» sotto n 30 come
// segno vuoto, etichette dirette a fine serie al posto della legenda.
// Colori a ruolo fisso: lime = la stima, sky = il mercato, inchiostro = diagonale.
import type { V3CalibrationResponse, V3ReliabilityBucket } from "@/lib/v3c/contracts";
import { LIMITED_SAMPLE_N } from "@/lib/v3c/contracts";
import { binLabel, dotRadius, drawable, int, pct1, signedPp } from "@/lib/v3c/record-view";
import { useRecordCopy } from "./useRecordCopy";

const W = 460;
const H = 440;
const L = 52;
const R = 16;
const T = 14;
const B = 46;
const sx = (p: number) => L + p * (W - L - R);
const sy = (p: number) => H - B - p * (H - T - B);
const TICKS = [0, 0.25, 0.5, 0.75, 1];

function line(bs: V3ReliabilityBucket[]): string {
  return bs.map((b, i) => `${i ? "L" : "M"}${sx(b.mean_predicted as number).toFixed(1)},${sy(b.observed as number).toFixed(1)}`).join(" ");
}

export function Reliability({ cal }: { cal: V3CalibrationResponse }) {
  const { t, locale } = useRecordCopy();
  const est = drawable(cal.football.estimate);
  const mkt = drawable(cal.football.market);
  const maxN = Math.max(1, ...est.map((b) => b.n));
  // the line joins only bins with n ≥ 30: a bin of 4 drawn as a vertex would steer the eye
  const solidE = est.filter((b) => b.n >= LIMITED_SAMPLE_N);
  const solidM = mkt.filter((b) => b.n >= LIMITED_SAMPLE_N);
  // direct labels in the empty half-planes: ours right of its last solid point, market left of a low one
  // (the last solid point sits under the limited bins' whiskers: label one near the middle instead)
  const lastE = solidE.find((b) => (b.mean_predicted as number) >= 0.5) ?? solidE.at(-1);
  const labM = solidM.find((b) => (b.mean_predicted as number) >= 0.25) ?? solidM.at(0);
  return (
    <section className="v3c-sec v3c-rec-cal" id="calibration" aria-labelledby="v3c-rec-cal-h">
      <div className="v3c-sec-h">
        <div>
          <h2 className="v3c-t-sec" id="v3c-rec-cal-h">
            {t.cal.title}
          </h2>
          <p className="v3c-explain">{t.cal.lede}</p>
        </div>
      </div>
      <div className="v3c-rec-cal-g">
        <figure className="v3c-rec-fig">
          <figcaption>
            <span className="v3c-lab">{t.cal.fig}</span>
            <span className="v3c-small">{t.cal.figSub(int(cal.football.n_pairs, locale), int(cal.football.n_matches, locale))}</span>
          </figcaption>
          {est.length ? (
            <svg className="v3c-rec-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.cal.aria}>
              {TICKS.map((v) => (
                <g key={v}>
                  <line className="v3c-rc-grid" x1={sx(v)} x2={sx(v)} y1={sy(0)} y2={sy(1)} />
                  <line className="v3c-rc-grid" x1={sx(0)} x2={sx(1)} y1={sy(v)} y2={sy(v)} />
                  <text x={sx(v)} y={sy(0) + 18} textAnchor="middle">
                    {Math.round(v * 100)}%
                  </text>
                  <text x={sx(0) - 8} y={sy(v) + 4} textAnchor="end">
                    {Math.round(v * 100)}%
                  </text>
                </g>
              ))}
              <line className="v3c-rc-diag" x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} />
              <line className="v3c-rc-diag" x1={sx(0.03)} x2={sx(0.09)} y1={sy(0.95)} y2={sy(0.95)} />
              <text className="v3c-rc-lbl-d" x={sx(0.11)} y={sy(0.95) + 4}>
                {t.cal.diag}
              </text>
              <text x={sx(0.5)} y={H - 6} textAnchor="middle" className="v3c-rc-ax">
                {t.cal.xAxis}
              </text>
              {solidM.length ? <path className="v3c-rc-ser-m" d={line(solidM)} /> : null}
              {mkt.map((b) => (
                <rect
                  key={`m${b.from}`}
                  className={b.n < LIMITED_SAMPLE_N ? "v3c-rc-dot-m v3c-rc-thin" : "v3c-rc-dot-m"}
                  x={sx(b.mean_predicted as number) - 3.5}
                  y={sy(b.observed as number) - 3.5}
                  width={7}
                  height={7}
                >
                  <title>{`${t.cal.market} · ${binLabel(b)} · ${pct1(b.observed, locale)} · n ${int(b.n, locale)}`}</title>
                </rect>
              ))}
              {solidE.length ? <path className="v3c-rc-ser-e" d={line(solidE)} /> : null}
              {est.map((b) =>
                b.ci95 ? (
                  <line key={`c${b.from}`} className="v3c-rc-ci" x1={sx(b.mean_predicted as number)} x2={sx(b.mean_predicted as number)} y1={sy(b.ci95.low)} y2={sy(b.ci95.high)} />
                ) : null,
              )}
              {est.map((b) => (
                <circle
                  key={`e${b.from}`}
                  className={b.n < LIMITED_SAMPLE_N ? "v3c-rc-dot-e v3c-rc-thin" : "v3c-rc-dot-e"}
                  cx={sx(b.mean_predicted as number)}
                  cy={sy(b.observed as number)}
                  r={dotRadius(b.n, maxN)}
                >
                  <title>{`${t.cal.ours} · ${binLabel(b)} · ${pct1(b.observed, locale)} · n ${int(b.n, locale)}`}</title>
                </circle>
              ))}
              {lastE ? (
                <text className="v3c-rc-lbl-e" x={sx(lastE.mean_predicted as number) + 14} y={sy(lastE.observed as number) + 22}>
                  {t.cal.ours}
                </text>
              ) : null}
              {labM ? (
                <text className="v3c-rc-lbl-m" x={sx(labM.mean_predicted as number) - 14} y={sy(labM.observed as number) - 14} textAnchor="end">
                  {t.cal.market}
                </text>
              ) : null}
            </svg>
          ) : (
            <p className="v3c-small">{t.receipts.empty}</p>
          )}
          <p className="v3c-fine v3c-rec-cap">{t.cal.caption}</p>
        </figure>
        <div>
          <h3 className="v3c-t-row v3c-rec-bins-h">{t.cal.binsTitle}</h3>
          <table className="v3c-rec-bins">
            <thead>
              <tr>
                <th className="v3c-lab" scope="col">
                  {t.cal.stated}
                </th>
                <th className="v3c-lab v3c-r" scope="col">
                  {t.cal.observed}
                </th>
                <th className="v3c-lab v3c-r" scope="col">
                  {t.cal.pm}
                </th>
                <th className="v3c-lab v3c-r" scope="col">
                  {t.cal.n}
                </th>
                <th className="v3c-lab v3c-r" scope="col">
                  {t.cal.gap}
                </th>
              </tr>
            </thead>
            <tbody>
              {est.map((b) => {
                const half = b.ci95 ? ((b.ci95.high - b.ci95.low) / 2) * 100 : null;
                const gap = ((b.observed as number) - (b.mean_predicted as number)) * 100;
                const thin = b.n < LIMITED_SAMPLE_N;
                return (
                  <tr key={b.from} className={thin ? "v3c-rec-thin" : undefined}>
                    <td>
                      {binLabel(b)}
                      {thin ? <em className="v3c-tag">{t.cal.limited}</em> : null}
                    </td>
                    <td className="v3c-r v3c-num">{pct1(b.observed, locale)}</td>
                    <td className="v3c-r v3c-small">{half == null ? "—" : half.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</td>
                    <td className="v3c-r">{int(b.n, locale)}</td>
                    <td className="v3c-r v3c-num">{signedPp(gap, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="v3c-fine v3c-rec-cap">{t.cal.binsNote}</p>
        </div>
      </div>
    </section>
  );
}
