"use client";
// components/affiliate/Blocks.tsx — #AFFILIATE-V2-UI-1015
// I blocchi del pannello dell'affiliato (SPEC-ui §3.2, §3.5), tutti presentazionali:
// ricevono i dati già letti da /api/affiliate/me e non fanno rete (tranne «Mostra
// altre», che chiama il padre). Nessun numero è inventato: tutto viene dall'API.
import type { AffCopy, AffLang } from "./copy";
import { fill } from "./copy";
import { coinAmount, dateTime, monthLabel, shortDate, shortHash, usd } from "./format";
import { cancelText, commissionChip, payoutChip } from "./status";
import { ExplorerLink, StateChip, useCopy } from "./ui";
import type { CommissionView, LedgerView, PayoutView, Payee, TierView, WalletView } from "./types";

const NETWORK_LABEL: Record<string, string> = { polygon: "Polygon", tron: "Tron" };

/** `50 $` (it) / `$50` (en): la soglia viene dalla config del server, non dalla copy. */
export function money0(n: number, lang: AffLang): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return lang === "it" ? `${v} $` : `$${v}`;
}

// ── Il tuo livello (#AFFILIATE-TIERS-1021) ────────────────────────────────────

/** `7%`, `12.5%`: percentuale dalla config del server, mai dalla copy. */
export function pct(rate: number): string {
  const v = Math.round(rate * 1000) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}

export function TierBlock({ c, tier }: { c: AffCopy; tier: TierView | null }) {
  const t = c.tier;
  if (!tier) return null;
  const count = tier.paying_referred === 1 ? t.count1 : fill(t.count, { n: tier.paying_referred });
  const ladder = tier.ladder;
  return (
    <section className="aff-block" aria-labelledby="aff-t-tier" data-testid="aff-tier">
      <div className="aff-block__head"><h2 className="aff-h" id="aff-t-tier">{t.title}</h2></div>
      <ol className="aff-flow">
        <li data-focus="1">
          <span className="aff-l">{tier.level === 0 ? t.level0 : fill(t.levelN, { n: tier.level })}</span>
          <span className="aff-v">{fill(t.rate, { rate: pct(tier.rate) })}</span>
          <span className="aff-n">{count}</span>
        </li>
        <li>
          <span className="aff-l">{t.nextTitle}</span>
          <span className="aff-v">{tier.next ? pct(tier.next.rate) : "—"}</span>
          <span className="aff-n">
            {ladder.length === 0 ? t.none : tier.next ? fill(t.next, { k: tier.next.min - tier.paying_referred, rate: pct(tier.next.rate) }) : t.top}
          </span>
        </li>
      </ol>
      {ladder.length > 0 && (
        <dl className="aff-terms-list" aria-label={t.ladderTitle}>
          <div><dd>{pct(tier.base_rate)}</dd><dt>{fill(t.ladderBase, { max: ladder[0].min - 1 })}</dt></div>
          {ladder.map((s) => (
            <div key={s.min}><dd>{pct(s.rate)}</dd><dt>{fill(t.ladderStep, { min: s.min })}</dt></div>
          ))}
        </dl>
      )}
      <p className="aff-muted aff-small">{fill(t.note, { first: pct(tier.first_rate) })}</p>
    </section>
  );
}

// ── Il tuo link ──────────────────────────────────────────────────────────────

export function LinkBlock({ c, code, link, error, onRetry }: { c: AffCopy; code: string | null; link: string; error: boolean; onRetry: () => void }) {
  const { msg, copy } = useCopy(c.link.copied, c.link.copyFailed);
  return (
    <section className="aff-link" aria-labelledby="aff-t-link">
      <h2 className="aff-h" id="aff-t-link">{c.link.title}</h2>
      {error && (
        <>
          <p className="aff-muted">{c.state.errorTitle} {c.state.errorBody}</p>
        </>
      )}
      {code && (
        <div className="aff-have">
          <div className="aff-copyrow">
            <input className="aff-input" readOnly value={link} aria-label={c.link.aria} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="aff-cta" onClick={() => copy(link)}>{c.link.copy}</button>
          </div>
          <p className="aff-muted" style={{ margin: 0 }}>
            {c.link.code} <strong style={{ letterSpacing: ".04em" }}>{code}</strong>
          </p>
          <p className="aff-muted aff-small aff-live" role="status" aria-live="polite">{msg}</p>
        </div>
      )}
      {error && (
        <div className="aff-actions">
          <button type="button" className="aff-cta aff-cta--ghost" onClick={onRetry}>{c.state.retry}</button>
        </div>
      )}
    </section>
  );
}

export function HowSteps({ c }: { c: AffCopy }) {
  return (
    <section className="aff-how" aria-labelledby="aff-t-how">
      <h2 className="aff-h" id="aff-t-how">{c.how.title}</h2>
      <ol className="aff-steps">
        {[[c.how.s1t, c.how.s1b], [c.how.s2t, c.how.s2b], [c.how.s3t, c.how.s3b]].map(([t, b], i) => (
          <li key={i}>
            <span className="aff-n" aria-hidden="true">{i + 1}</span>
            <strong>{t}</strong>
            <span className="aff-b">{b}</span>
          </li>
        ))}
      </ol>
      <TierHow c={c} />
    </section>
  );
}

/** #INVITE-TIERS-HOW-1022 — come funzionano i livelli (7/10/15), testo statico legato a DEFAULT_TIERS dal test. */
export function TierHow({ c }: { c: AffCopy }) {
  const v = c.levels;
  return (
    <div className="aff-levels" data-testid="aff-levels">
      <h3 className="aff-h">{v.title}</h3>
      <ul className="aff-fine">
        <li><strong>{v.l1t}</strong><span>{v.l1b}</span></li>
        <li><strong>{v.l2t}</strong><span>{v.l2b}</span></li>
        <li><strong>{v.l3t}</strong><span>{v.l3b}</span></li>
      </ul>
      <p className="aff-muted aff-small">{v.example}</p>
    </div>
  );
}

// ── Commissioni (ledger) ─────────────────────────────────────────────────────

export function LedgerBlock({ c, lang, ledger, payouts, unavailable }: { c: AffCopy; lang: AffLang; ledger: LedgerView | null; payouts: PayoutView[]; unavailable: boolean }) {
  const l = c.led;
  if (unavailable || !ledger) {
    return (
      <section className="aff-block" aria-labelledby="aff-t-led">
        <div className="aff-block__head"><h2 className="aff-h" id="aff-t-led">{l.title}</h2></div>
        <ol className="aff-flow aff-flow--lost">
          {[l.hold, l.payable, l.paid, l.void].map((t) => (
            <li key={t}><span className="aff-l">{t}</span><span className="aff-v">{l.unavailable}</span></li>
          ))}
        </ol>
      </section>
    );
  }
  const min = ledger.min_payout_usd;
  const minTxt = money0(min, lang);
  const paidPayouts = payouts.filter((p) => p.status === "paid");
  const lastPaid = paidPayouts.map((p) => p.paid_at).filter(Boolean).sort().pop() ?? null;
  const empty = ledger.count === 0 && payouts.length === 0;
  const paidNote =
    paidPayouts.length === 0
      ? l.paidNote
      : fill(paidPayouts.length === 1 ? l.paidNoteN : l.paidNoteNN, { n: paidPayouts.length, date: shortDate(lastPaid, lang) });
  const pct = min > 0 ? Math.max(0, Math.min(100, (ledger.payable / min) * 100)) : 100;
  const below = ledger.payable < min;

  return (
    <section className="aff-block" aria-labelledby="aff-t-led">
      <div className="aff-block__head"><h2 className="aff-h" id="aff-t-led">{l.title}</h2></div>
      <ol className="aff-flow">
        <li>
          <span className="aff-l">{l.hold}</span>
          <span className="aff-v">{usd(ledger.pending, lang)}</span>
          <span className="aff-n">
            {l.holdNote}
            {ledger.next_payable_after ? ` ${fill(l.holdNext, { date: shortDate(ledger.next_payable_after, lang) })}` : ""}
          </span>
        </li>
        <li data-focus="1">
          <span className="aff-l">{l.payable}</span>
          <span className="aff-v">{usd(ledger.payable, lang)}</span>
          <span className="aff-n">{fill(l.payableNote, { min: minTxt })}</span>
          {ledger.in_payout > 0 && <span className="aff-n">{fill(l.inPayout, { amt: usd(ledger.in_payout, lang) })}</span>}
          {ledger.to_recover < 0 && <span className="aff-n">{fill(l.toRecover, { amt: usd(ledger.to_recover, lang) })}</span>}
        </li>
        <li>
          <span className="aff-l">{l.paid}</span>
          <span className="aff-v">{usd(ledger.paid, lang)}</span>
          <span className="aff-n">{paidNote}</span>
        </li>
        <li data-void={ledger.reversed < 0 ? "1" : "0"}>
          <span className="aff-l">{l.void}</span>
          <span className="aff-v">{usd(ledger.reversed, lang)}</span>
          <span className="aff-n">{l.voidNote}</span>
        </li>
      </ol>
      {empty ? (
        <div className="aff-thr"><p className="aff-muted">{l.emptyNote}</p></div>
      ) : (
        <div className="aff-thr">
          <p>
            <strong>{usd(ledger.payable, lang)}</strong>{" "}
            {fill(below ? l.thr : l.thrOk, { min: minTxt })}
          </p>
          {below && (
            <div className="aff-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          )}
          <p className="aff-muted aff-small">{fill(l.thrNote, { day: c.payDay })}</p>
        </div>
      )}
    </section>
  );
}

// ── Wallet: card riassuntiva ─────────────────────────────────────────────────

export function WalletCard({ c, lang, wallet, payee, onAdd, onChange, soft }: {
  c: AffCopy; lang: AffLang; wallet: WalletView; payee: Payee; onAdd: () => void; onChange: () => void; soft: boolean;
}) {
  const w = c.wallet;
  const net = wallet.network ? NETWORK_LABEL[wallet.network] ?? wallet.network : null;
  const chips = (extra: React.ReactNode) => (
    <div className="aff-wline">
      <span className="aff-addr">{wallet.address_masked}</span>
      {net && <span className="aff-chip aff-net">{net}</span>}
      {wallet.coin && <span className="aff-chip">{wallet.coin}</span>}
      {extra}
    </div>
  );
  let country = payee.country ?? "";
  try { country = payee.country ? new Intl.DisplayNames([lang], { type: "region" }).of(payee.country) ?? payee.country : ""; } catch { /* resta il codice */ }
  const payeeLine = payee.name ? fill(w.payee, { name: payee.name, country }).replace(/ · \.$/, ".") : null;
  return (
    <section className="aff-block aff-wcard" aria-labelledby="aff-t-wal">
      <div className="aff-block__head">
        <h2 className="aff-h" id="aff-t-wal">{w.title}</h2>
        <span className="aff-net-label">{w.net}</span>
      </div>
      {wallet.state === "none" && (
        <div className="aff-wstate" data-s="none">
          <p><strong>{w.noneTitle}</strong></p>
          <p className="aff-muted">{soft ? w.noneSoft : w.noneBody}</p>
        </div>
      )}
      {wallet.state === "cooldown" && (
        <div className="aff-wstate" data-s="cooldown">
          {chips(<span className="aff-chip aff-dashed-amber">{fill(w.cooldownChip, { date: dateTime(wallet.usable_after, lang) })}</span>)}
          <p className="aff-muted">{w.cooldown}</p>
        </div>
      )}
      {wallet.state === "pending_screening" && (
        <div className="aff-wstate" data-s="cooldown">
          {chips(<span className="aff-chip aff-dashed-amber">{w.pendingChip}</span>)}
          <p className="aff-muted">{w.pending}</p>
        </div>
      )}
      {wallet.state === "active" && (
        <div className="aff-wstate" data-s="active">
          {chips(<span className="aff-chip aff-outline">{fill(w.activeChip, { date: shortDate(wallet.usable_after, lang) })}</span>)}
          <p className="aff-muted">{[payeeLine, w.fee].filter(Boolean).join(" ")}</p>
        </div>
      )}
      {wallet.state === "suspended" && (
        <div className="aff-wstate" data-s="blocked">
          {wallet.address_masked && chips(null)}
          <p><strong>{w.suspendedTitle}</strong></p>
          <p className="aff-muted">{w.suspendedBody}</p>
        </div>
      )}
      {wallet.state !== "suspended" && (
        <div className="aff-actions">
          {wallet.state === "none" ? (
            <button type="button" className="aff-cta aff-cta--ghost" onClick={onAdd}>{w.add}</button>
          ) : (
            <button type="button" className="aff-cta aff-cta--ghost" onClick={onChange}>{w.change}</button>
          )}
        </div>
      )}
    </section>
  );
}

export function HowWePay({ c }: { c: AffCopy }) {
  const p = c.pay_how;
  return (
    <section className="aff-block" aria-labelledby="aff-t-how2">
      <h2 className="aff-h" id="aff-t-how2">{p.title}</h2>
      <ul className="aff-fine">
        <li><strong>{p.t1}</strong><span>{p.b1}</span></li>
        <li><strong>{p.t2}</strong><span>{p.b2}</span></li>
        <li><strong>{p.t3}</strong><span>{fill(p.b3, { day: c.payDay })}</span></li>
        <li><strong>{p.t4}</strong><span>{p.b4}</span></li>
        <li><strong>{p.t5}</strong><span>{p.b5}</span></li>
      </ul>
    </section>
  );
}

// ── Storico pagamenti ────────────────────────────────────────────────────────

function PayoutRow({ p, c, lang }: { p: PayoutView; c: AffCopy; lang: AffLang }) {
  const chip = payoutChip(p.status, c);
  const net = NETWORK_LABEL[p.network] ?? p.network;
  const sub =
    p.status === "paid" && p.paid_at ? fill(c.pay.paidOn, { date: shortDate(p.paid_at, lang) })
    : p.status === "submitted" ? null
    : null;
  let received = "—";
  if (p.status === "paid" && p.amount_coin != null) received = `${coinAmount(p.amount_coin, lang)} ${p.coin} · ${net}`;
  else if (p.status === "submitted") received = c.pay.confirming;
  let tx: React.ReactNode = "—";
  if (p.status === "cancelled") tx = cancelText(p.cancel_code, c);
  else if (p.status === "created") tx = c.pay.txPending;
  else if (p.tx_hash && p.explorer_url) tx = <ExplorerLink href={p.explorer_url} text={shortHash(p.tx_hash)} sr={c.pay.explorerSr} />;
  return (
    <tr data-state={p.status}>
      <td data-k="month">
        {monthLabel(p.period_month, c.months)}
        {sub && <span className="aff-sub">{sub}</span>}
      </td>
      <td data-k="amount" className="aff-num"><strong>{usd(p.amount_usd, lang)}</strong></td>
      <td data-k="coin">{received}</td>
      <td data-k="state"><StateChip chip={chip} /></td>
      <td data-k="tx">{tx}</td>
    </tr>
  );
}

export function PayoutHistory({ c, lang, payouts, unavailable, full, onAll }: {
  c: AffCopy; lang: AffLang; payouts: PayoutView[]; unavailable: boolean; full: boolean; onAll?: () => void;
}) {
  const rows = full ? payouts : payouts.slice(0, 1);
  return (
    <section className="aff-block" aria-labelledby="aff-t-pay">
      <div className="aff-block__head"><h2 className="aff-h" id="aff-t-pay">{c.pay.title}</h2></div>
      {unavailable ? (
        <div className="aff-empty"><p className="aff-muted">{c.pay.unavailable}</p></div>
      ) : payouts.length === 0 ? (
        <div className="aff-empty">
          <p className="aff-t">{c.pay.empty}</p>
          <p className="aff-muted">{c.pay.emptyBody}</p>
        </div>
      ) : (
        <>
          <table className="aff-table">
            <thead>
              <tr>
                <th scope="col">{c.pay.colMonth}</th>
                <th scope="col" className="aff-num">{c.pay.colAmount}</th>
                <th scope="col">{c.pay.colReceived}</th>
                <th scope="col">{c.pay.colState}</th>
                <th scope="col">{c.pay.colTx}</th>
              </tr>
            </thead>
            <tbody>{rows.map((p) => <PayoutRow key={p.id} p={p} c={c} lang={lang} />)}</tbody>
          </table>
          <p className="aff-muted aff-small" style={{ marginTop: 12 }}>
            {c.pay.foot}
            {!full && onAll && (
              <>
                {" "}
                <button type="button" className="aff-linkbtn" onClick={onAll}>{c.pay.all}</button>
              </>
            )}
          </p>
        </>
      )}
      {full && (
        <>
          <h3 className="aff-h4" style={{ marginTop: 20 }}>{c.pay.legendTitle}</h3>
          <ul className="aff-legend" style={{ marginTop: 12 }}>
            {(["created", "submitted", "paid", "cancelled"] as const).map((s) => (
              <li key={s}>
                <StateChip chip={payoutChip(s, c)} />
                <span>{{ created: c.pay.lCreated, submitted: c.pay.lSubmitted, paid: c.pay.lPaid, cancelled: c.pay.lCancelled }[s]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ── Storico commissioni ──────────────────────────────────────────────────────

export function CommissionHistory({ c, lang, items, hasMore, loadingMore, onMore, unavailable }: {
  c: AffCopy; lang: AffLang; items: CommissionView[]; hasMore: boolean; loadingMore: boolean; onMore: () => void; unavailable: boolean;
}) {
  const label = (k: string) => (k === "first" ? c.com.first : k === "renewal" ? c.com.renewal : c.com.reversal);
  return (
    <section className="aff-block" aria-labelledby="aff-t-hist">
      <div className="aff-block__head"><h2 className="aff-h" id="aff-t-hist">{c.com.title}</h2></div>
      {unavailable ? (
        <div className="aff-empty"><p className="aff-muted">{c.com.unavailable}</p></div>
      ) : items.length === 0 ? (
        <div className="aff-empty">
          <p className="aff-t">{c.com.empty}</p>
          <p className="aff-muted">{c.com.emptyBody}</p>
        </div>
      ) : (
        <>
          <table className="aff-table">
            <thead>
              <tr>
                <th scope="col">{c.com.colWho}</th>
                <th scope="col">{c.com.colEvent}</th>
                <th scope="col">{c.com.colDate}</th>
                <th scope="col" className="aff-num">{c.com.colBase}</th>
                <th scope="col" className="aff-num">{c.com.colAmount}</th>
                <th scope="col">{c.com.colState}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const chip = commissionChip(r, c, lang);
                if (!chip) return null; // `shadow` & co: niente UI, niente etichette inventate
                const neg = r.amount_usd < 0;
                return (
                  <tr key={r.id} data-state={chip.state}>
                    <td data-k="who">{r.referred}</td>
                    <td data-k="event">{label(r.kind)}</td>
                    <td data-k="date">{shortDate(r.created_at, lang)}</td>
                    <td data-k="base" className="aff-num">{usd(r.base_usd, lang)}</td>
                    <td data-k="amount" className="aff-num">
                      <strong className={neg ? "aff-neg" : undefined} style={neg ? { textDecoration: "none" } : undefined}>{usd(r.amount_usd, lang)}</strong>
                    </td>
                    <td data-k="state"><StateChip chip={chip} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasMore && (
            <button type="button" className="aff-cta aff-cta--ghost aff-more" onClick={onMore} disabled={loadingMore}>
              {loadingMore ? c.com.moreBusy : c.com.more}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function Rules({ c, termsHref, privacyHref }: { c: AffCopy; termsHref: string | null; privacyHref: string }) {
  const r = c.rules;
  return (
    <section className="aff-block aff-rules aff-quiet" aria-labelledby="aff-t-rul">
      <h2 className="aff-h" id="aff-t-rul">{r.title}</h2>
      <ul>
        {[r.r1, r.r2, r.r3, r.r4, r.r5, r.r6, r.r7].map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p className="aff-terms">
        {termsHref ? <a href={termsHref}>{r.terms}</a> : r.terms} · <a href={privacyHref}>{r.privacy}</a> · {r.leave}
      </p>
    </section>
  );
}
