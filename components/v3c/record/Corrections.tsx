"use client";
// components/v3c/record/Corrections.tsx (#REDESIGN-V3C F6)
// Le correzioni di esito, mostrate come correzioni: pick_settlement è
// append-only, una correzione è una revisione nuova con il suo motivo. Qui
// prima → dopo, il motivo in parole (il codice interno resta nel title) e il
// conteggio per motivo. Nessuna correzione è nascosta o fusa nel dato.
import type { V3Correction, V3CorrectionCause, V3CorrectionsSummary } from "@/lib/v3c/contracts";
import { int, stampUtc } from "@/lib/v3c/record-view";
import { useRecordCopy } from "./useRecordCopy";

/** The stored source codes, in words. «gemello» = the same fixture stored under another id. */
const SOURCE: Record<string, string> = { gemello: "twin fixture row", "espn-id": "ESPN", "espn-data-nomi": "ESPN", "football-data": "football-data.org" };

const CAUSES: V3CorrectionCause[] = ["late_result", "postponed", "no_pick_shown", "late_fill", "other"];

export function Corrections({ data }: { data: V3CorrectionsSummary | null }) {
  const { t, locale } = useRecordCopy();
  const verdict = (v: string) => t.corr.settle[v] ?? v;
  const reason = (c: V3Correction) =>
    c.cause === "late_result" ? t.corr.cause.late_result(c.source ? (SOURCE[c.source] ?? c.source) : "") : c.cause === "postponed" ? t.corr.cause.postponed(c.new_date ?? "") : t.corr.cause[c.cause]();
  const side = (res: string, score: string | null) => `${verdict(res)}${score ? ` ${score}` : ""}`;
  return (
    <section className="v3c-sec v3c-rec-corr" id="corrections" aria-labelledby="v3c-rec-co-h">
      <div className="v3c-sec-h">
        <div>
          <h2 className="v3c-t-sec" id="v3c-rec-co-h">
            {t.corr.title}
          </h2>
          {data ? <p className="v3c-explain">{t.corr.lede(int(data.total, locale))}</p> : null}
        </div>
      </div>
      {data == null ? (
        <p className="v3c-small">{t.corr.unavailable}</p>
      ) : data.total === 0 ? (
        <p className="v3c-small">{t.corr.none}</p>
      ) : (
        <>
          <ul className="v3c-rec-causes" aria-label={t.corr.byCause}>
            {CAUSES.filter((c) => data.by_cause[c] > 0).map((c) => (
              <li key={c}>
                <b className="v3c-num">{int(data.by_cause[c], locale)}</b>
                <span className="v3c-small">{c === "late_result" ? t.corr.cause.late_result("") : c === "postponed" ? t.corr.cause.postponed("") : t.corr.cause[c]()}</span>
              </li>
            ))}
          </ul>
          <div className="v3c-rec-scroll" tabIndex={0} aria-label={t.corr.title}>
            <table className="v3c-rec-table v3c-rec-co">
              <thead>
                <tr>
                  <th className="v3c-lab" scope="col">{t.corr.when}</th>
                  <th className="v3c-lab" scope="col">{t.corr.match}</th>
                  <th className="v3c-lab" scope="col">{t.corr.change}</th>
                  <th className="v3c-lab" scope="col">{t.corr.reason}</th>
                </tr>
              </thead>
              <tbody>
                {data.latest.map((c, i) => (
                  <tr key={`${c.home}|${c.away}|${c.kickoff}|${c.revision}|${i}`}>
                    <td className="v3c-small co-when">
                      <time dateTime={c.corrected_at}>{stampUtc(c.corrected_at, locale)}</time>
                    </td>
                    <td className="v3c-rec-m co-m">
                      {c.home} — {c.away}
                      <small>
                        {c.sport === "tennis" ? t.receipts.tennis : t.receipts.football} · {stampUtc(c.kickoff, locale)}
                      </small>
                    </td>
                    <td className="co-chg">
                      <s>{side(c.before, c.before_score)}</s> → <b>{side(c.after, c.after_score)}</b>
                    </td>
                    <td className="v3c-small co-why" title={c.reason_raw}>
                      {reason(c)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
