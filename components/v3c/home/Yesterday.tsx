"use client";
// components/v3c/home/Yesterday.tsx (#REDESIGN-V3C F3)
// «Ieri»: le pick sigillate partite ieri (UTC) e come sono finite (fidelity: la striscia del prototipo),
// PERSE, lette solo da pick_ledger + pick_settlement_current (/api/v3/yesterday).
// Interi, mai un tasso: vinte e perse accanto alla somma delle probabilità
// sigillate (quante le stime dovevano vincerne). Nessun ROI, CLV, hit-rate.
import type { V3YesterdayResponse } from "@/lib/v3c/contracts";
import { dayLong } from "@/lib/v3c/board-view";
import { useV3cCopy } from "@/lib/v3c/lang.client";
import "../fidelity.css";
import "../fixdata.css";
import { V3C_ROUTES } from "../V3cChrome";
import { v3cLocale } from "@/lib/v3c/copy";
import { pctInt } from "@/lib/v3c/board-view";
import type { V3DayPick } from "@/lib/v3c/contracts";
import { ResultPill, resultKindOf, scoreText } from "../ResultPill";
import { yesterdayHome } from "@/lib/v3c/yesterday";
import { fixdataCopyFor } from "@/lib/v3c/fixdata-copy";

/** ui2: quante righe restano aperte; le altre dietro «Show all N» (niente salto: chiuso al caricamento). */
const OPEN_ROWS = 6;

function pickLabel(p: V3DayPick, draw: string): string | null {
  if (!p.pick) return null;
  if (p.sport === "tennis") return p.pick;
  const k = p.pick.toUpperCase();
  return k === "HOME" ? p.home : k === "AWAY" ? p.away : k === "DRAW" ? draw : p.pick;
}

export function Yesterday({ data }: { data: V3YesterdayResponse | null }) {
  const { lang, t } = useV3cCopy();
  const locale = v3cLocale(lang);
  if (!data) {
    return (
      <section className="v3c-yday" id="v3c-yday" aria-labelledby="v3c-yday-h">
        <h2 className="v3c-t-sec" id="v3c-yday-h">
          {t.yday.title}
        </h2>
        <p className="v3c-small">{t.yday.unavailable}</p>
      </section>
    );
  }
  // fidelity: come il prototipo — una striscia di numeri: chiuse, attese a favore (Σ probabilità sigillate),
  // osservate, e il Brier della stima accanto a quello del mercato. Niente elenco di vinte/perse, niente tasso.
  // ui2 (Andrea, 07/10): sotto la striscia ogni partita con il suo esito W/L/V/in attesa. Mai un tasso.
  // fixdata A6: football only on the home (the tennis W/L is a count of favourites: Record only, with its note);
  // under n = 30 settled matches no Brier and no expected/observed — «too few matches», with the day's W/L
  const fc = fixdataCopyFor(lang);
  const h = yesterdayHome(data);
  const settled = h.wl.won + h.wl.lost;
  const dayLabel = dayLong(`${data.day}T12:00:00Z`, "UTC", locale);
  const b = h.score?.brier ?? null;
  return (
    <section className="v3c-yday" id="v3c-yday" aria-labelledby="v3c-yday-h">
      <div className="v3c-yd-strip">
        <div>
          <h2 className="v3c-lab" id="v3c-yday-h">
            {t.yday.lab(dayLabel)}
          </h2>
          {/* final5: the strip body explains expected/Brier, so it shows only with a score; tennis is in the Record */}
          {settled ? h.score ? <p className="v3c-small">{t.yday.stripBody}</p> : null : <p className="v3c-small">{t.yday.noneHint}</p>}
        </div>
        {settled && !h.score ? (
          <dl className="v3c-yd-k" data-yday="too-few">
            <div>
              <dt>{fc.ydayWL}</dt>
              <dd className="v3c-num">
                {h.wl.won}–{h.wl.lost}
              </dd>
            </div>
            <div className="v3c-yd-few">
              <dt>{fc.ydayTooFew}</dt>
              <dd className="v3c-small">{fc.ydayMin(h.min_n)}</dd>
            </div>
          </dl>
        ) : settled && h.score ? (
          <dl className="v3c-yd-k" data-yday="score">
            <div>
              <dt>{t.yday.settled}</dt>
              <dd className="v3c-num">{settled}</dd>
            </div>
            <div>
              <dt>{t.yday.expectedFavour}</dt>
              <dd className="v3c-num">{h.score.expected.toFixed(1)}</dd>
            </div>
            <div>
              <dt>{t.yday.observed}</dt>
              <dd className="v3c-num">{h.score.observed}</dd>
            </div>
            {b ? (
              <>
                <div>
                  <dt>{t.yday.brierEstimate}</dt>
                  <dd className="v3c-num">{b.estimate.toFixed(3)}</dd>
                </div>
                <div>
                  <dt>{t.yday.brierMarket(b.n)}</dt>
                  <dd className="v3c-num">{b.market.toFixed(3)}</dd>
                </div>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="v3c-t-row">{t.yday.none}</p>
        )}
        <a className="v3c-btn v3c-btn-line v3c-btn-s" href={V3C_ROUTES.record}>
          {t.yday.full}
        </a>
      </div>
      {data.picks.some((p) => p.sport === "football") ? <DayList picks={data.picks.filter((p) => p.sport === "football")} /> : null}
    </section>
  );
}

/** ui2: ogni partita di ieri con il suo esito — pill W/L/V/in attesa (W e L con lo stesso peso), risultato, pick e stima sigillata. */
function DayList({ picks }: { picks: V3DayPick[] }) {
  const { t } = useV3cCopy();
  const word = { won: t.yday.wonOne, lost: t.yday.lostOne, void: t.yday.voidOne, pending: t.yday.pending };
  const rows = [...picks].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const row = (p: V3DayPick, i: number) => {
    const kind = resultKindOf(p.result);
    const pick = pickLabel(p, t.board.draw);
    const score = scoreText(p.final_score);
    return (
      <li key={`${p.sport}|${p.home}|${p.away}|${p.kickoff}|${i}`} className="v3c-yd-row">
        <ResultPill kind={kind} word={word[kind]} />
        <span className="v3c-yd-m">
          <b>
            {p.home} — {p.away}
          </b>
          <small>{pick && p.p != null ? (p.sport === "tennis" ? t.yday.pickedTennis : t.yday.picked)(pick, pctInt(p.p)) : p.competition ?? (p.sport === "tennis" ? t.yday.tennis : t.yday.football)}</small>
        </span>
        <span className="v3c-score">{score ?? "—"}</span>
      </li>
    );
  };
  return (
    <div className="v3c-yd-day">
      <ol className="v3c-yd-rows">{rows.slice(0, OPEN_ROWS).map(row)}</ol>
      {rows.length > OPEN_ROWS ? (
        <details className="v3c-yd-all">
          <summary>{t.yday.showAll(rows.length)}</summary>
          <ol className="v3c-yd-rows">{rows.slice(OPEN_ROWS).map((p, i) => row(p, i + OPEN_ROWS))}</ol>
        </details>
      ) : null}
    </div>
  );
}
