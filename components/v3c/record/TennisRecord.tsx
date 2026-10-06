"use client";
// components/v3c/record/TennisRecord.tsx (#REDESIGN-V3C F6)
// Il tennis a parte, con il suo n reale e la dicitura giusta: per lo più il
// numero sigillato È il mercato (temperato), non un nostro modello. Il
// confronto con il mercato esiste solo per i gruppi del nostro Elo e solo
// sulle righe con un prezzo dei book catturato prima del sigillo.
import type { V3CalibrationResponse, V3TennisRecordGroup } from "@/lib/v3c/contracts";
import { LIMITED_SAMPLE_N } from "@/lib/v3c/contracts";
import { brier4, dateUtc, int, signed4 } from "@/lib/v3c/record-view";
import { useRecordCopy } from "./useRecordCopy";

export function TennisRecord({ groups, calibration }: { groups: V3TennisRecordGroup[]; calibration: V3CalibrationResponse["tennis"] }) {
  const { t, locale } = useRecordCopy();
  if (!groups.length) return null;
  const kindLabel = (g: V3TennisRecordGroup) =>
    g.kind === "market_tempered" ? t.tennis.kindMarket : g.kind === "model_tempered" ? t.tennis.kindModelTempered : t.tennis.kindModel;
  const ours = calibration.models.filter((m) => m.is_our_model);
  const oursN = ours.reduce((a, m) => a + m.n, 0);
  const solid = Math.max(0, ...ours.map((m) => m.buckets.filter((b) => b.n >= LIMITED_SAMPLE_N).length));
  const sorted = [...groups].sort((a, b) => Number(b.is_our_model) - Number(a.is_our_model) || b.scored - a.scored);
  return (
    <section className="v3c-sec v3c-rec-tennis" aria-labelledby="v3c-rec-tn-h">
      <div className="v3c-sec-h">
        <div>
          <h2 className="v3c-t-sec" id="v3c-rec-tn-h">
            {t.tennis.title}
          </h2>
          <p className="v3c-explain">{t.tennis.lede}</p>
        </div>
      </div>
      <div className="v3c-rec-scroll">
        <table className="v3c-rec-table v3c-rec-tn">
          <thead>
            <tr>
              <th className="v3c-lab" scope="col">
                {t.tennis.what}
              </th>
              <th className="v3c-lab v3c-r" scope="col">
                {t.tennis.settled}
              </th>
              <th className="v3c-lab v3c-r" scope="col">
                {t.tennis.expected}
              </th>
              <th className="v3c-lab v3c-r" scope="col">
                {t.tennis.observed}
              </th>
              <th className="v3c-lab v3c-r" scope="col">
                {t.tennis.brier}
              </th>
              <th className="v3c-lab" scope="col">
                {t.tennis.vsMarket}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => (
              <tr key={`${g.model_version}|${g.kind}`} className={g.is_our_model ? "v3c-rec-ours" : undefined}>
                <td className="tn-k">
                  <span className="v3c-rec-tn-k">{kindLabel(g)}</span>
                  <small>
                    {g.model_version} · {dateUtc(g.since, locale)}
                    {g.limited_sample ? <em className="v3c-tag">{t.limited}</em> : null}
                  </small>
                </td>
                <td className="v3c-r v3c-num" data-l={t.tennis.settled}>{int(g.scored, locale)}</td>
                <td className="v3c-r" data-l={t.tennis.expected}>{g.expected_wins == null ? "—" : g.expected_wins.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</td>
                <td className="v3c-r v3c-num" data-l={t.tennis.observed}>{int(g.observed_wins, locale)}</td>
                <td className="v3c-r" data-l={t.tennis.brier}>{brier4(g.brier, locale)}</td>
                <td className="v3c-small tn-vs">
                  {!g.is_our_model ? (
                    t.tennis.isMarket
                  ) : g.n_paired > 0 ? (
                    <>
                      {t.tennis.paired(int(g.n_paired, locale), brier4(g.brier_paired, locale), brier4(g.brier_market, locale))}
                      {g.difference_ci95 ? <>, {t.tennis.pairedDiff(signed4(g.difference, locale), signed4(g.difference_ci95.low, locale), signed4(g.difference_ci95.high, locale))}</> : null}
                    </>
                  ) : (
                    t.tennis.noPaired
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="v3c-small v3c-rec-cap">
        {calibration.status === "sufficient" ? t.tennis.calSufficient : t.tennis.calInsufficient(int(oursN, locale), int(solid, locale))}
      </p>
      <p className="v3c-fine">{t.tennis.binary}</p>
    </section>
  );
}
