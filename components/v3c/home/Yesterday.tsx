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
import { V3C_ROUTES } from "../V3cChrome";

export function Yesterday({ data }: { data: V3YesterdayResponse | null }) {
  const { lang, t } = useV3cCopy();
  const locale = lang === "it" ? "it-IT" : "en-GB";
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
  const fb = data.football;
  const tn = data.tennis;
  const settled = fb.won + fb.lost + tn.won + tn.lost;
  const expected = (fb.expected_wins ?? 0) + (tn.expected_wins ?? 0);
  const observed = fb.won + tn.won;
  const dayLabel = dayLong(`${data.day}T12:00:00Z`, "UTC", locale);
  const b = data.brier ?? null;
  return (
    <section className="v3c-yday" id="v3c-yday" aria-labelledby="v3c-yday-h">
      <div className="v3c-yd-strip">
        <div>
          <h2 className="v3c-lab" id="v3c-yday-h">
            {t.yday.lab(dayLabel)}
          </h2>
          <p className="v3c-small">{settled ? t.yday.stripBody : t.yday.noneHint}</p>
        </div>
        {settled ? (
          <dl className="v3c-yd-k">
            <div>
              <dt>{t.yday.settled}</dt>
              <dd className="v3c-num">
                {settled}
                {settled < 30 ? <small>{t.yday.limited}</small> : null}
              </dd>
            </div>
            <div>
              <dt>{t.yday.expectedFavour}</dt>
              <dd className="v3c-num">{expected.toFixed(1)}</dd>
            </div>
            <div>
              <dt>{t.yday.observed}</dt>
              <dd className="v3c-num">{observed}</dd>
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
    </section>
  );
}
