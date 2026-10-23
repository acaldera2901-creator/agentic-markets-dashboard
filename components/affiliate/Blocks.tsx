"use client";
// components/affiliate/Blocks.tsx — #AFFILIATE-V2-UI-1015
// I blocchi del pannello dell'affiliato (SPEC-ui §3.2, §3.5), tutti presentazionali:
// ricevono i dati già letti da /api/affiliate/me e non fanno rete (tranne «Mostra
// altre», che chiama il padre). Nessun numero è inventato: tutto viene dall'API.
import { useEffect, useRef, useState } from "react";
import type { AffCopy, AffLang } from "./copy";
import { fill } from "./copy";
import { coinAmount, dateTime, monthLabel, shortDate, shortHash, usd } from "./format";
import { cancelText, commissionChip, payoutChip } from "./status";
import { ExplorerLink, StateChip, useCopy } from "./ui";
import type { CommissionView, LedgerView, PayoutView, Payee, TierView, WalletView } from "./types";
// Modulo puro (nessun import): la scala di default, la stessa a cui pure.test lega la copy.
import { DEFAULT_TIERS } from "@/lib/affiliate/tiers";

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
        <div className="aff-ladder-wrap">
          <p className="aff-ladder-lead">{t.ladderLead}</p>
          <dl className="aff-terms-list aff-ladder" aria-label={t.ladderTitle}>
            <div data-on={tier.level === 0 ? "1" : "0"}><dd>{pct(tier.base_rate)}</dd><dt>{fill(t.ladderBase, { max: ladder[0].min - 1 })}</dt></div>
            {ladder.map((s, i) => (
              <div key={s.min} data-on={tier.level === i + 1 ? "1" : "0"}><dd>{pct(s.rate)}</dd><dt>{fill(t.ladderStep, { min: s.min })}</dt></div>
            ))}
          </dl>
        </div>
      )}
      <p className="aff-muted aff-small">{fill(t.note, { first: pct(tier.first_rate) })}</p>
      {/* #INVITE-LAYOUT-1022: la spiegazione dei livelli vive QUI, sotto la scala, apribile — non più
          ripetuta nella colonna «Come funziona» (era la stessa prosa due volte sopra la piega). */}
      <TierHow c={c} />
    </section>
  );
}

/** #INVITE-LAYOUT-1022 — prima dell'iscrizione non c'è un `tier` dal server: la scala 7/10/15 si mostra
 *  dalla DEFAULT_TIERS (stesso vincolo della copy, pure.test) con il tasso base della copy d'iscrizione. */
export function LadderPreview({ c }: { c: AffCopy }) {
  const t = c.tier;
  const e = c.enroll;
  // La frase d'iscrizione legata ai test («7% di ogni rinnovo dal 2° mese; 10% da 5…, 15% da 15») è il nome
  // accessibile della figura; a vista i numeri si leggono una volta sola, nelle celle.
  return (
    <div className="aff-ladder-wrap" data-testid="aff-ladder-preview">
      <p className="aff-ladder-lead">{t.ladderLead}</p>
      <dl className="aff-terms-list aff-ladder" aria-label={`${e.t2v} ${e.t2}`}>
        <div><dd>{e.t2v}</dd><dt>{fill(t.ladderBase, { max: DEFAULT_TIERS[0].min - 1 })}</dt></div>
        {DEFAULT_TIERS.map((s) => (
          <div key={s.min}><dd>{pct(s.rate)}</dd><dt>{fill(t.ladderStep, { min: s.min })}</dt></div>
        ))}
      </dl>
    </div>
  );
}

/** #INVITE-AFFILIATE-UX-1022 (M3/M5) — l'offerta in numeri, la stessa colonna da anonimo e in iscrizione:
 *  i tre numeri fissi (20% · 60 gg · 50 $), la scala 7/10/15, le regole fini, le tre finestre da 60 giorni
 *  (click → registrazione → pagamento, coerenti con referral-code.ts, ledger.ts e Termini §2/§4) e i livelli.
 *  Nessuna stima di guadagno: solo percentuali, giorni e soglia. */
export function Offer({ c }: { c: AffCopy }) {
  const e = c.enroll;
  return (
    <div className="aff-how" data-testid="aff-offer">
      <h2 className="aff-h">{e.howTitle}</h2>
      <dl className="aff-terms-list">
        <div><dd>{e.t1v}</dd><dt>{e.t1}</dt></div>
        <div><dd>{e.t3v}</dd><dt>{e.t3}</dt></div>
        <div><dd>{e.t4v}</dd><dt>{e.t4}</dt></div>
      </dl>
      <LadderPreview c={c} />
      <ul className="aff-fine">
        <li><strong>{e.f1t}</strong><span>{e.f1b}</span></li>
        <li><strong>{e.f2t}</strong><span>{e.f2b}</span></li>
        <li><strong>{e.f3t}</strong><span>{e.f3b}</span></li>
      </ul>
      <Windows c={c} />
      <TierHow c={c} />
    </div>
  );
}

/** Le tre finestre da 60 giorni: tre righe con lo stesso numero a sinistra, perché il numero è lo stesso
 *  e il lettore deve vedere che cambia il «da quando», non il «quanto». */
export function Windows({ c }: { c: AffCopy }) {
  const e = c.enroll;
  return (
    <div className="aff-windows" data-testid="aff-windows">
      <p className="aff-ladder-lead">{e.windowsT}</p>
      <ol className="aff-wins">
        {[[e.w1t, e.w1b], [e.w2t, e.w2b], [e.w3t, e.w3b]].map(([t, b]) => (
          <li key={t}><span className="aff-wn" aria-hidden="true">{e.t3v}</span><strong>{t}</strong><span className="aff-b">{b}</span></li>
        ))}
      </ol>
    </div>
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

/** `levels`: la spiegazione dei livelli qui SOLO quando il blocco «Il tuo livello» non c'è (risposta senza `tier`). */
export function HowSteps({ c, levels = false }: { c: AffCopy; levels?: boolean }) {
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
      {levels && <TierHow c={c} />}
    </section>
  );
}

/** #INVITE-TIERS-HOW-1022 — come funzionano i livelli (7/10/15), testo statico legato a DEFAULT_TIERS dal test.
 *  #INVITE-LAYOUT-1022 — è un `<details>`: la scala si vede sempre (sopra), la regola fine si apre quando serve.
 *  `textContent` include anche il contenuto chiuso, quindi i test sul testo restano validi. */
export function TierHow({ c }: { c: AffCopy }) {
  const v = c.levels;
  return (
    <details className="aff-levels" data-testid="aff-levels">
      <summary><h3 className="aff-h4">{v.title}</h3></summary>
      <ul className="aff-fine">
        <li><strong>{v.l1t}</strong><span>{v.l1b}</span></li>
        <li><strong>{v.l2t}</strong><span>{v.l2b}</span></li>
        <li><strong>{v.l3t}</strong><span>{v.l3b}</span></li>
      </ul>
      <p className="aff-muted aff-small">{v.example}</p>
    </details>
  );
}

// ── Commissioni (ledger) ─────────────────────────────────────────────────────

/** `setup` (#INVITE-AFFILIATE-UX-1022, R5): payout o contabilità non attivi → le frasi sui tempi cambiano. */
export function LedgerBlock({ c, lang, ledger, payouts, unavailable, setup = false }: { c: AffCopy; lang: AffLang; ledger: LedgerView | null; payouts: PayoutView[]; unavailable: boolean; setup?: boolean }) {
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
        <div className="aff-thr"><p className="aff-muted">{setup ? l.emptyNoteSetup : l.emptyNote}</p></div>
      ) : (
        <div className="aff-thr">
          <p>
            <strong>{usd(ledger.payable, lang)}</strong>{" "}
            {fill(below ? l.thr : l.thrOk, { min: minTxt })}
          </p>
          {below && (
            <div className="aff-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          )}
          <p className="aff-muted aff-small">{setup ? l.thrNoteSetup : fill(l.thrNote, { day: c.payDay })}</p>
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

export function HowWePay({ c, setup = false }: { c: AffCopy; setup?: boolean }) {
  const p = c.pay_how;
  return (
    <section className="aff-block" aria-labelledby="aff-t-how2">
      <h2 className="aff-h" id="aff-t-how2">{p.title}</h2>
      <ul className="aff-fine">
        <li><strong>{p.t1}</strong><span>{p.b1}</span></li>
        <li><strong>{p.t2}</strong><span>{p.b2}</span></li>
        <li><strong>{p.t3}</strong><span>{setup ? p.b3Setup : fill(p.b3, { day: c.payDay })}</span></li>
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

export function PayoutHistory({ c, lang, payouts, unavailable, full, onAll, setup = false }: {
  c: AffCopy; lang: AffLang; payouts: PayoutView[]; unavailable: boolean; full: boolean; onAll?: () => void; setup?: boolean;
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
          <p className="aff-muted">{setup ? c.pay.emptyBodySetup : c.pay.emptyBody}</p>
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

export function Rules({ c, termsHref, privacyHref, onLeave }: { c: AffCopy; termsHref: string | null; privacyHref: string; onLeave?: () => Promise<boolean> }) {
  const r = c.rules;
  return (
    <section className="aff-block aff-rules aff-quiet" aria-labelledby="aff-t-rul">
      <h2 className="aff-h" id="aff-t-rul">{r.title}</h2>
      <ul>
        {[r.r1, r.r2, r.r3, r.r4, r.r5, r.r6, r.r7].map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p className="aff-terms">
        {termsHref ? <a href={termsHref}>{r.terms}</a> : r.terms} · <a href={privacyHref}>{r.privacy}</a>
        {onLeave ? <> · <LeaveProgram c={c} onLeave={onLeave} /></> : <> · {r.leave}</>}
      </p>
    </section>
  );
}

/** #AFFILIATE-COMPLETE-1023 — «Lascia il programma» (SPEC-ui §3.2): one click, then a neutral
 *  two-button confirm that says what happens. No confirmshaming, the way back is as easy. */
function LeaveProgram({ c, onLeave }: { c: AffCopy; onLeave: () => Promise<boolean> }) {
  const r = c.rules;
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const reopenFocus = useRef(false);
  // Keyboard/screen-reader users keep their place (review Codex #6): focus moves into the
  // confirm when it opens and back to «Lascia il programma» when it is cancelled.
  useEffect(() => {
    if (ask) confirmRef.current?.focus();
    else if (reopenFocus.current) { trigger.current?.focus(); reopenFocus.current = false; }
  }, [ask]);
  if (!ask) return <button ref={trigger} type="button" className="aff-linkbtn" onClick={() => { setErr(false); setAsk(true); }}>{r.leaveCta}</button>;
  return (
    <span className="aff-confirm" role="alertdialog" aria-label={r.leaveCta} aria-describedby="aff-leave-ask" data-testid="aff-leave-confirm">
      <span className="block" id="aff-leave-ask">{r.leaveAsk}</span>
      {err && <span className="aff-err block" role="alert">{r.leaveError}</span>}
      <span className="aff-inline-actions">
        <button ref={confirmRef} type="button" className="aff-cta aff-cta--ghost" disabled={busy} onClick={async () => {
          setBusy(true);
          const ok = await onLeave();
          setBusy(false);
          if (!ok) setErr(true);
        }}>{r.leaveYes}</button>
        <button type="button" className="aff-cta aff-cta--ghost" disabled={busy} onClick={() => { reopenFocus.current = true; setAsk(false); }}>{r.leaveNo}</button>
      </span>
    </span>
  );
}
