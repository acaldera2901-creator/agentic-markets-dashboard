"use client";
// components/v3c/record/Receipts.tsx (#REDESIGN-V3C F6)
// Le ricevute, vinte e perse con lo stesso peso d'inchiostro: sigillo UTC,
// esito letto, quota, mercato %, stima %, gap col segno, esito, impronta.
// Calcio: se nessuna pick è stata mostrata la riga legge l'esito più
// probabile della stima, e lo dice. Tennis: il gap c'è solo per il nostro Elo
// con un prezzo prima del sigillo; altrimenti si dice perché non c'è.
import Link from "next/link";
import type { V3Receipt } from "@/lib/v3c/contracts";
import type { ReceiptSport, ReceiptsPage } from "@/lib/v3c/record-data.server";
import { pctInt, price2 } from "@/lib/v3c/board-view";
import { shortFingerprint, signedPp, stampUtc } from "@/lib/v3c/record-view";
import { useRecordCopy } from "./useRecordCopy";

const SPORTS: ReceiptSport[] = ["football", "tennis", "all"];

function href(sport: ReceiptSport, page: number): string {
  const q = new URLSearchParams();
  if (sport !== "football") q.set("sport", sport);
  if (page > 0) q.set("page", String(page));
  const s = q.toString();
  return `/record${s ? `?${s}` : ""}#receipts`;
}

export function Receipts({ result, sport, page }: { result: ReceiptsPage | null; sport: ReceiptSport; page: number }) {
  const { t, locale } = useRecordCopy();
  const readLabel = (r: V3Receipt) => (r.sport === "tennis" ? r.read : r.read === "home" ? r.home : r.read === "away" ? r.away : t.receipts.draw);
  return (
    <section className="v3c-sec v3c-rec-receipts" id="receipts" aria-labelledby="v3c-rec-rc-h">
      <div className="v3c-sec-h">
        <h2 className="v3c-t-sec" id="v3c-rec-rc-h">
          {t.receipts.title}
        </h2>
        <nav className="v3c-chips" aria-label={t.receipts.filter}>
          {SPORTS.map((s) => (
            <Link key={s} className="v3c-chip" href={href(s, 0)} aria-current={s === sport ? "page" : undefined} scroll={false}>
              {t.receipts[s]}
            </Link>
          ))}
        </nav>
      </div>
      {result == null ? (
        <div className="v3c-error" role="alert">
          <p className="v3c-t-row">{t.state.errorTitle}</p>
          <p className="v3c-small">{t.state.errorBody}</p>
        </div>
      ) : result.rows.length === 0 ? (
        <div className="v3c-empty">
          <p className="v3c-small">{page > 0 || sport === "tennis" ? t.receipts.emptyFilter : t.receipts.empty}</p>
        </div>
      ) : (
        <>
          <div className="v3c-rec-scroll" tabIndex={0} aria-label={t.receipts.title}>
            <table className="v3c-rec-table v3c-rec-ledger">
              <thead>
                <tr>
                  <th className="v3c-lab" scope="col">{t.receipts.sealed}</th>
                  <th className="v3c-lab" scope="col">{t.receipts.match}</th>
                  <th className="v3c-lab" scope="col">{t.receipts.read}</th>
                  <th className="v3c-lab v3c-r" scope="col">{t.receipts.price}</th>
                  <th className="v3c-lab v3c-r" scope="col">{t.receipts.marketPct}</th>
                  <th className="v3c-lab v3c-r" scope="col">{t.receipts.estimatePct}</th>
                  <th className="v3c-lab v3c-r" scope="col">{t.receipts.gap}</th>
                  <th className="v3c-lab" scope="col">{t.receipts.result}</th>
                  <th className="v3c-lab" scope="col">{t.receipts.fingerprint}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={`${r.sport}|${r.source_id}|${r.model_version}`}>
                    <td className="v3c-small rc-seal" data-l={t.receipts.sealed}>
                      <time dateTime={r.sealed_at}>{stampUtc(r.sealed_at, locale)}</time>
                    </td>
                    <td className="v3c-rec-m rc-m">
                      {r.home} — {r.away}
                      <small>
                        {/* «Partner feed» is the ingest's placeholder, not a tournament */}
                        {r.competition && r.competition !== "Partner feed" ? r.competition : r.sport === "tennis" ? t.receipts.tennis : t.receipts.football} · {t.receipts.kickoff} {stampUtc(r.kickoff, locale)}
                      </small>
                    </td>
                    <td className="v3c-rec-read rc-read">
                      {readLabel(r)}
                      <small>{r.read_kind === "top" ? t.receipts.top : t.receipts.pick}</small>
                    </td>
                    <td className="v3c-r v3c-num rc-price" data-l={t.receipts.price}>{price2(r.price)}</td>
                    <td className="v3c-r v3c-num v3c-m rc-mk" data-l={t.receipts.marketPct}>{r.market_p == null ? "—" : pctInt(r.market_p)}</td>
                    <td className="v3c-r v3c-num rc-est" data-l={t.receipts.estimatePct}>
                      {/* the lime mark is the estimate's colour: a sealed number that IS the market does not get it */}
                      {r.gap_null_reason === "is_market" ? pctInt(r.estimate_p) : <mark>{pctInt(r.estimate_p)}</mark>}
                    </td>
                    <td className="v3c-r rc-gap" data-l={t.receipts.gap}>
                      {r.gap_pp == null ? (
                        <small>{r.gap_null_reason === "is_market" ? t.receipts.isMarket : t.receipts.noMarket}</small>
                      ) : (
                        <span className="v3c-num">{signedPp(r.gap_pp, locale)}</span>
                      )}
                    </td>
                    <td className={`v3c-rec-res v3c-rec-${r.verdict} rc-res`}>
                      {t.receipts.verdict[r.verdict]}
                      <small>
                        {r.final_score ?? ""}
                        {r.revision > 1 ? <em className="v3c-tag">{t.receipts.corrected}</em> : null}
                        {r.is_paper ? <em className="v3c-tag">{t.receipts.paper}</em> : null}
                      </small>
                    </td>
                    <td className="rc-hash" data-l={t.receipts.fingerprint}>
                      <code className="v3c-rec-hash" title={`${t.receipts.fullHash}: ${r.fingerprint}`}>
                        {shortFingerprint(r.fingerprint)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="v3c-rec-hint">{t.receipts.scroll}</p>
          <div className="v3c-rec-pager">
            {page > 0 ? (
              <Link className="v3c-btn v3c-btn-line v3c-btn-s" href={href(sport, page - 1)} scroll={false}>
                {t.receipts.newer}
              </Link>
            ) : null}
            <span className="v3c-small">{t.receipts.page(page + 1)}</span>
            {result.hasMore ? (
              <Link className="v3c-btn v3c-btn-line v3c-btn-s" href={href(sport, page + 1)} scroll={false}>
                {t.receipts.older}
              </Link>
            ) : null}
          </div>
        </>
      )}
      <p className="v3c-fine v3c-rec-cap">
        {t.receipts.recipe} {t.receipts.recipeNote} {t.receipts.noReturn}
      </p>
    </section>
  );
}
