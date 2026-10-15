"use client";
// components/affiliate/AffiliateSection.tsx — #AFFILIATE-V2-UI-1015
// Il pannello Affiliati v2 dell'utente (SPEC-ui §3). Montato dal desk SOLO con
// NEXT_PUBLIC_AFFILIATE_V2=1; con il flag spento questo modulo non entra nel
// percorso e il pannello attuale (ReferralPanel) resta identico.
//
// POV: un estratto conto con la ricevuta in mano. Un solo punto focale per
// schermata (il link in dash; l'indirizzo in conferma), una sola CTA lime. Nessuna
// barra a premi, nessun «ti mancano X $», nessuna stima di guadagno.
//
// Macchina della pagina (SPEC §2.4):
//   loading → anon (401) | closed (programma non aperto) | enroll | enrolled
//   error (5xx/rete) → «le commissioni non si perdono», MAI l'iscrizione su un
//   errore (lezione #REFERRAL-KPI-0808): un errore non diventa mai enrolled:false.
// Nessun dato inventato: tutto arriva da /api/affiliate/me e /join. Non esistono
// etichette «Esempio» qui: valgono solo per l'anteprima senza backend, che resta
// nel componente classic già esistente.
import { useCallback, useEffect, useRef, useState } from "react";
import { AFF_COPY, affLang, type AffCopy } from "./copy";
import { api } from "./api";
import { CommissionHistory, HowSteps, HowWePay, LedgerBlock, LinkBlock, PayoutHistory, Rules, WalletCard } from "./Blocks";
import { Skeleton } from "./ui";
import { WalletForm } from "./WalletForm";
import type { JoinInfo, MeResponse } from "./types";
import "./affiliate.css";

export type AffiliateSectionProps = {
  lang: string;
  /** Link ai Termini del programma: dal momento in cui sono pubblicati (terms_version presente). */
  termsHref?: string;
  privacyHref?: string;
};

type Enrolled = Extract<MeResponse, { enrolled: true }>;
type Phase =
  | { k: "loading" }
  | { k: "anon" }
  | { k: "closed" }
  | { k: "error" }
  | { k: "enroll"; join: JoinInfo }
  | { k: "enrolled"; me: Enrolled };
type View = "dash" | "wallet" | "payouts";

export function AffiliateSection({ lang, termsHref = "/terms", privacyHref = "/privacy" }: AffiliateSectionProps) {
  const l = affLang(lang);
  const c = AFF_COPY[l];
  const [phase, setPhase] = useState<Phase>({ k: "loading" });
  const [view, setView] = useState<View>("dash");
  const [flash, setFlash] = useState("");
  const [moreItems, setMoreItems] = useState<Enrolled["commissions"]["items"]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busyRemove, setBusyRemove] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    const res = await api<MeResponse>("/api/affiliate/me");
    if (!mounted.current) return;
    if (res.status === 401) return setPhase({ k: "anon" });
    if (!res.ok || !res.data) return setPhase({ k: "error" });
    const me = res.data;
    if (me.enrolled) {
      setMoreItems([]);
      setNextCursor(me.commissions.next_cursor);
      return setPhase({ k: "enrolled", me });
    }
    if (!me.open) return setPhase({ k: "closed" });
    // aperto e non iscritto: servono la versione dei Termini e il codice (se c'è già)
    const j = await api<JoinInfo>("/api/affiliate/join");
    if (!mounted.current) return;
    if (!j.ok || !j.data) return setPhase({ k: "error" });
    // terms_version mancante = stato «iscrizioni non aperte», non un form rotto
    if (!j.data.open || !j.data.terms_version) return setPhase({ k: "closed" });
    setPhase({ k: "enroll", join: j.data });
  }, []);

  useEffect(() => {
    // one-shot al mount; il padre non rilegge
    queueMicrotask(() => { void load(); });
  }, [load]);

  const loadMore = async () => {
    if (nextCursor == null || loadingMore) return;
    setLoadingMore(true);
    const res = await api<MeResponse>(`/api/affiliate/me?cursor=${nextCursor}`);
    if (!mounted.current) return;
    setLoadingMore(false);
    if (res.ok && res.data && res.data.enrolled) {
      setMoreItems((prev) => [...prev, ...(res.data as Enrolled).commissions.items]);
      setNextCursor((res.data as Enrolled).commissions.next_cursor);
    }
  };

  const removeWallet = async () => {
    setBusyRemove(true);
    const res = await api("/api/affiliate/wallet", { method: "DELETE" });
    setBusyRemove(false);
    setConfirmRemove(false);
    if (res.ok) {
      setFlash(c.wallet.removed);
      setView("dash");
      void load();
    } else {
      setFlash(c.walletErr.network);
    }
  };

  let body: React.ReactNode;
  if (phase.k === "loading") {
    body = (
      <>
        <Head c={c} />
        <div className="aff-link" aria-busy="true" aria-live="polite">
          <span className="aff-sr">{c.state.loading}</span>
          <Skeleton w="70%" />
          <Skeleton w="40%" />
          <Skeleton w="55%" h={48} />
        </div>
      </>
    );
  } else if (phase.k === "anon") {
    body = (
      <>
        <Head c={c} />
        <div className="aff-block"><h2 className="aff-h">{c.state.anonTitle}</h2><p className="aff-muted">{c.state.anonBody}</p></div>
      </>
    );
  } else if (phase.k === "closed") {
    body = (
      <>
        <Head c={c} />
        <div className="aff-block" role="status" data-testid="aff-closed">
          <h2 className="aff-h">{c.state.closedTitle}</h2>
          <p className="aff-muted">{c.state.closedBody}</p>
        </div>
      </>
    );
  } else if (phase.k === "error") {
    body = (
      <>
        <Head c={c} />
        <div className="aff-block" role="alert" data-testid="aff-error">
          <h2 className="aff-h">{c.state.errorTitle}</h2>
          <p className="aff-muted">{c.state.errorBody}</p>
          <div className="aff-actions">
            <button type="button" className="aff-cta aff-cta--ghost" onClick={() => { setPhase({ k: "loading" }); void load(); }}>{c.state.retry}</button>
          </div>
        </div>
      </>
    );
  } else if (phase.k === "enroll") {
    body = (
      <>
        <Head c={c} lede />
        <Enroll c={c} join={phase.join} termsHref={termsHref} onDone={() => { setPhase({ k: "loading" }); void load(); }} onTerms={(v) => setPhase({ k: "enroll", join: { ...phase.join, terms_version: v } })} />
        <Rules c={c} termsHref={termsHref} privacyHref={privacyHref} />
      </>
    );
  } else {
    const me = phase.me;
    const readOnly = me.affiliate.status !== "active";
    const items = [...me.commissions.items, ...moreItems];
    const link = typeof window !== "undefined" ? `${window.location.origin}/r/${me.affiliate.code}` : `/r/${me.affiliate.code}`;
    const rails = { coins: me.rails.coins as string[], networks: me.rails.networks as string[] };
    if (view === "wallet" && !readOnly) {
      const hasWallet = me.wallet.state !== "none";
      body = (
        <>
          <Head c={c} lede />
          <WalletForm
            c={c}
            lang={l}
            mode={hasWallet ? "change" : "add"}
            current={hasWallet ? { masked: me.wallet.address_masked ?? "", coin: me.wallet.coin, network: me.wallet.network } : null}
            initial={{ name: me.payee.name ?? "", country: me.payee.country ?? "" }}
            rails={rails}
            onCancel={() => { setView("dash"); setConfirmRemove(false); }}
            onRemove={hasWallet ? () => setConfirmRemove(true) : undefined}
            onSaved={({ cancelledPayouts }) => {
              setFlash(`${c.wallet.saved}${cancelledPayouts > 0 ? ` ${c.wallet.savedCancelled}` : ""}`);
              setView("dash");
              void load();
            }}
          />
          {confirmRemove && (
            <div className="aff-confirm" role="alertdialog" aria-label={c.wallet.remove}>
              <p>{c.wallet.removeAsk}</p>
              <div className="aff-inline-actions">
                <button type="button" className="aff-cta aff-cta--ghost" onClick={removeWallet} disabled={busyRemove}>{c.wallet.removeYes}</button>
                <button type="button" className="aff-cta aff-cta--ghost" onClick={() => setConfirmRemove(false)} disabled={busyRemove}>{c.wallet.removeNo}</button>
              </div>
            </div>
          )}
        </>
      );
    } else if (view === "payouts") {
      body = (
        <>
          <Head c={c} />
          <div><button type="button" className="aff-linkbtn" onClick={() => setView("dash")}>← {c.pay.back}</button></div>
          <PayoutHistory c={c} lang={l} payouts={me.payouts} unavailable={false} full />
        </>
      );
    } else {
      body = (
        <>
          <Head c={c} lede />
          {me.affiliate.status === "suspended" && <div className="aff-banner" role="status"><p>{c.state.suspended}</p></div>}
          {me.affiliate.status === "terminated" && <div className="aff-banner" role="status"><p>{c.state.terminated}</p></div>}
          {flash && <div className="aff-open" role="status"><span>{flash}</span></div>}
          <div className="aff-top">
            <LinkBlock c={c} code={me.affiliate.code} link={link} error={false} onRetry={() => void load()} />
            <HowSteps c={c} />
          </div>
          <LedgerBlock c={c} lang={l} ledger={me.ledger} payouts={me.payouts} unavailable={false} />
          <div className="aff-pair aff-w75">
            <WalletCard
              c={c}
              lang={l}
              wallet={me.wallet}
              payee={me.payee}
              soft={me.ledger.count === 0}
              onAdd={() => { setFlash(""); setView("wallet"); }}
              onChange={() => { setFlash(""); setView("wallet"); }}
            />
            <HowWePay c={c} />
          </div>
          <PayoutHistory c={c} lang={l} payouts={me.payouts} unavailable={false} full={false} onAll={() => setView("payouts")} />
          <CommissionHistory c={c} lang={l} items={items} hasMore={nextCursor != null} loadingMore={loadingMore} onMore={loadMore} unavailable={false} />
          <Rules c={c} termsHref={termsHref} privacyHref={privacyHref} />
        </>
      );
    }
  }

  return (
    <div className="aff-cli" data-testid="affiliate-section" lang={l}>
      {body}
    </div>
  );
}

function Head({ c, lede }: { c: AffCopy; lede?: boolean }) {
  return (
    <header className="aff-head">
      <p className="aff-kicker">{c.head.kicker}</p>
      <h1 className="aff-headline">{c.head.title}</h1>
      {lede && <p className="aff-lede">{c.head.lede}</p>}
    </header>
  );
}

// ── Iscrizione (SPEC §3.1) ───────────────────────────────────────────────────

const CODE_RE = /^[A-Z0-9_-]{2,20}$/;

function Enroll({ c, join, termsHref, onDone, onTerms }: {
  c: AffCopy; join: JoinInfo; termsHref: string; onDone: () => void; onTerms: (v: string) => void;
}) {
  const [code, setCode] = useState(join.code ?? "");
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [onerous, setOnerous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<keyof AffCopy["joinErr"] | null>(null);
  const normalized = code.trim().toUpperCase();
  const valid = CODE_RE.test(normalized);
  const ready = valid && age && terms && onerous && !busy;
  const e = c.enroll;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!ready || !join.terms_version) return;
    setBusy(true);
    setErr(null);
    const res = await api<{ error?: string; terms_version?: string }>("/api/affiliate/join", {
      method: "POST",
      body: JSON.stringify({ code: normalized, terms_version: join.terms_version, age: true, onerous_ack: true }),
    });
    setBusy(false);
    if (res.ok) return onDone();
    const k = res.data?.error ?? "";
    if (k === "terms_outdated" && res.data?.terms_version) {
      // Termini cambiati: le tre spunte non valgono più, si rileggono
      setAge(false); setTerms(false); setOnerous(false);
      onTerms(res.data.terms_version);
    }
    setErr(k in c.joinErr ? (k as keyof AffCopy["joinErr"]) : "generic");
  };

  const [tPre, tPost] = e.terms.split("{link}");
  return (
    <section className="aff-top" aria-label={e.title}>
      <form className="aff-link" onSubmit={submit} noValidate>
        <h2 className="aff-h">{e.title}</h2>
        <p className="aff-muted">{e.lead}</p>
        <div className="aff-fld">
          <label className="aff-label" htmlFor="aff-code">{join.code_locked ? e.codeLockedLabel : e.codeLabel}</label>
          <input
            id="aff-code"
            className="aff-input"
            value={code}
            onChange={(ev) => setCode(ev.target.value)}
            placeholder={e.codePlaceholder}
            maxLength={20}
            autoComplete="off"
            readOnly={join.code_locked}
            aria-describedby="aff-code-h"
            aria-invalid={code !== "" && !valid ? true : undefined}
            style={{ textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}
          />
          <p className="aff-muted aff-small" id="aff-code-h">{join.code_locked ? e.codeLockedHint : e.codeHint}</p>
        </div>
        <div className="aff-fld" style={{ gap: "var(--am-s-3)" }}>
          <label className="aff-chk"><input type="checkbox" checked={age} onChange={(ev) => setAge(ev.target.checked)} /><span className="aff-tx">{e.age} <span className="aff-req">{e.required}</span></span></label>
          <label className="aff-chk"><input type="checkbox" checked={terms} onChange={(ev) => setTerms(ev.target.checked)} /><span className="aff-tx">{tPre}<a href={termsHref} target="_blank" rel="noopener noreferrer">{e.termsLink}</a>{tPost} <span className="aff-req">{e.required}</span></span></label>
          <label className="aff-chk"><input type="checkbox" checked={onerous} onChange={(ev) => setOnerous(ev.target.checked)} /><span className="aff-tx">{e.onerous} <span className="aff-req">{e.required}</span></span></label>
        </div>
        <p className="aff-warn">{e.warn}</p>
        {err && <p className="aff-err" role="alert">{c.joinErr[err]}</p>}
        <div className="aff-actions"><button type="submit" className="aff-cta" disabled={!ready}>{busy ? e.busy : e.cta}</button></div>
        <p className="aff-muted aff-small">{e.ctaHint}</p>
      </form>
      <div className="aff-how">
        <h2 className="aff-h">{e.howTitle}</h2>
        <dl className="aff-terms-list">
          <div><dd>{e.t1v}</dd><dt>{e.t1}</dt></div>
          <div><dd>{e.t2v}</dd><dt>{e.t2}</dt></div>
          <div><dd>{e.t3v}</dd><dt>{e.t3}</dt></div>
          <div><dd>{e.t4v}</dd><dt>{e.t4}</dt></div>
        </dl>
        <ul className="aff-fine">
          <li><strong>{e.f1t}</strong><span>{e.f1b}</span></li>
          <li><strong>{e.f2t}</strong><span>{e.f2b}</span></li>
          <li><strong>{e.f3t}</strong><span>{e.f3b}</span></li>
        </ul>
      </div>
    </section>
  );
}
