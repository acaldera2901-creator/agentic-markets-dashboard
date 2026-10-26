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
import { AFF_COPY, affLang, fill, type AffCopy } from "./copy";
import { shortDate } from "./format";
import { api } from "./api";
import { CommissionHistory, HowSteps, HowWePay, LedgerBlock, LinkBlock, Offer, PayoutHistory, Rules, TierBlock, WalletCard } from "./Blocks";
import { Skeleton } from "./ui";
import { WalletForm } from "./WalletForm";
import type { JoinInfo, MeResponse, Operations } from "./types";
import "./affiliate.css";

export type AffiliateSectionProps = {
  lang: string;
  /** Link ai Termini del programma: dal momento in cui sono pubblicati (terms_version presente). */
  termsHref?: string;
  onSignIn?: () => void;
  onRegister?: () => void;
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
type View = "dash" | "wallet" | "payouts" | "rejoin";

export function AffiliateSection({ lang, onSignIn, onRegister, termsHref = "/affiliates/terms", privacyHref = "/privacy" }: AffiliateSectionProps) {
  const l = affLang(lang);
  const c = AFF_COPY[l];
  const [phase, setPhase] = useState<Phase>({ k: "loading" });
  const [view, setView] = useState<View>("dash");
  const [flash, setFlash] = useState("");
  const [moreItems, setMoreItems] = useState<Enrolled["commissions"]["items"]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busyRemove, setBusyRemove] = useState(false);
  // #INVITE-AFFILIATE-UX-1022 (R5): flag operativi da /api/affiliate/me. null = risposta senza
  // `operations` (ignoto): i dettagli del saldo seguono solo lo stato dichiarato dal server.
  const [ops, setOps] = useState<Operations | null>(null);
  const setup = ops !== null && (!ops.payouts_enabled || !ops.accounting_ready);
  const mounted = useRef(true);
  // StrictMode (dev) monta, smonta e rimonta: il flag va riarmato a ogni mount
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    const res = await api<MeResponse>("/api/affiliate/me");
    if (!mounted.current) return;
    if (res.status === 401) return setPhase({ k: "anon" });
    if (!res.ok || !res.data) return setPhase({ k: "error" });
    const me = res.data;
    setOps(me.operations ?? null);
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
    setMoreError(false);
    const res = await api<MeResponse>(`/api/affiliate/me?cursor=${nextCursor}`);
    if (!mounted.current) return;
    setLoadingMore(false);
    // #AFFILIATE-COMPLETE-1023: a failed page said nothing; now it says so (the list stays).
    if (!(res.ok && res.data && res.data.enrolled)) setMoreError(true);
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

  // #AFFILIATE-COMPLETE-1023 — leave the program (Rules → neutral confirm). true = done.
  const leave = async (): Promise<boolean> => {
    const res = await api("/api/affiliate/leave", { method: "POST" });
    if (!res.ok) return false;
    setView("dash");
    void load();
    return true;
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
    // #INVITE-AFFILIATE-UX-1022 (M2/M3): da anonimo l'offerta è in chiaro — titolo, lede coi numeri,
    // la stessa colonna «in numeri» dell'iscrizione e il link ai Termini. La CTA piena è «crea un account
    // gratuito» (è il passo che manca a un affiliato nuovo); «Accedi» è la ghost. Niente muro.
    body = (
      <>
        <Head c={c} lede />
        <section className="aff-top" aria-label={c.state.anonTitle} data-testid="aff-anon">
          <div className="aff-link aff-anon">
            <h2 className="aff-h">{c.state.anonTitle}</h2>
            <p className="aff-muted">{c.state.anonBody}</p>
            <div className="aff-actions">
              {onRegister && <button type="button" className="aff-cta" onClick={onRegister}>{c.state.anonRegister}</button>}
              {onSignIn && <button type="button" className="aff-cta aff-cta--ghost" onClick={onSignIn}>{c.state.anonSignIn}</button>}
            </div>
            <p className="aff-terms"><a href={termsHref}>{c.state.anonTerms}</a> · <a href={privacyHref}>{c.rules.privacy}</a></p>
          </div>
          <Offer c={c} />
        </section>
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
    const left = !!me.affiliate.left_at;
    const items = [...me.commissions.items, ...moreItems];
    const link = typeof window !== "undefined" ? `${window.location.origin}/r/${me.affiliate.code}` : `/r/${me.affiliate.code}`;
    const rails = { coins: me.rails.coins as string[], networks: me.rails.networks as string[] };
    if (view === "wallet" && !readOnly) {
      const hasWallet = me.wallet.state !== "none";
      body = (
        <>
          <Head c={c} />
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
    } else if (view === "rejoin" && left && !readOnly) {
      // #AFFILIATE-COMPLETE-1023 — back in: same code (locked), the three ticks on the Terms in force.
      body = (
        <>
          <Head c={c} />
          <div><button type="button" className="aff-linkbtn" onClick={() => setView("dash")}>← {c.pay.back}</button></div>
          <Enroll
            c={c}
            join={{ open: true, enrolled: true, status: me.affiliate.status, terms_version: me.terms_current ?? null, code: me.affiliate.code, code_locked: true }}
            termsHref={termsHref}
            onDone={() => { setView("dash"); setPhase({ k: "loading" }); void load(); }}
            onTerms={() => { setView("dash"); setPhase({ k: "loading" }); void load(); }}
          />
        </>
      );
    } else if (view === "payouts") {
      body = (
        <>
          <Head c={c} />
          <div><button type="button" className="aff-linkbtn" onClick={() => setView("dash")}>← {c.pay.back}</button></div>
          <PayoutHistory c={c} lang={l} payouts={me.payouts} unavailable={false} full setup={setup} />
        </>
      );
    } else {
      body = (
        <>
          {/* #INVITE-LAYOUT-1022: da iscritto niente lede — è il pitch per chi deve ancora decidere;
              i numeri stanno in «Il tuo livello» e nelle regole. Il link è la prima cosa sotto il titolo. */}
          <Head c={c} />
          {me.affiliate.status === "suspended" && <div className="aff-banner" role="status"><p>{c.state.suspended}</p></div>}
          {me.affiliate.status === "terminated" && <div className="aff-banner" role="status"><p>{c.state.terminated}</p></div>}
          {left && (
            <div className="aff-banner" role="status" data-testid="aff-left">
              <div className="aff-banner-body">
                <p>{fill(c.state.left, { date: shortDate(me.affiliate.left_at, l) })}</p>
                {!readOnly && <div className="aff-actions"><button type="button" className="aff-cta aff-cta--ghost" onClick={() => { setFlash(""); setView("rejoin"); }}>{c.state.rejoin}</button></div>}
              </div>
            </div>
          )}
          {flash && <div className="aff-open" role="status"><span>{flash}</span></div>}
          {/* Left the program: the link no longer earns, so it is not offered (the banner says why). */}
          {!left && (
            <div className="aff-top">
              <LinkBlock c={c} code={me.affiliate.code} link={link} error={false} onRetry={() => void load()} />
              <HowSteps c={c} levels={!me.tier} />
            </div>
          )}
          <LedgerBlock c={c} lang={l} ledger={me.ledger} payouts={me.payouts} unavailable={false} setup={setup} />
          <TierBlock c={c} tier={me.tier ?? null} />
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
            <HowWePay c={c} setup={setup} />
          </div>
          <PayoutHistory c={c} lang={l} payouts={me.payouts} unavailable={false} full={false} onAll={() => setView("payouts")} setup={setup} />
          <CommissionHistory c={c} lang={l} items={items} hasMore={nextCursor != null} loadingMore={loadingMore} onMore={loadMore} unavailable={false} />
          {moreError && <p className="aff-err" role="alert" data-testid="aff-more-error">{c.state.errorBody}</p>}
          <Rules c={c} termsHref={termsHref} privacyHref={privacyHref} onLeave={!readOnly && !left ? leave : undefined} />
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

/** #INVITE-LAYOUT-1022 — il kicker è l'h1 del desk («Invita»), ridotto a etichetta dal CSS come per
 *  ClassicInvite: prima si leggeva «Invita» grande, «INVITA» piccolo e poi il titolo, con due h1 nel documento. */
function Head({ c, lede }: { c: AffCopy; lede?: boolean }) {
  return (
    <header className="aff-head">
      <h2 className="aff-headline">{c.head.title}</h2>
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
      {/* #INVITE-LAYOUT-1022 — colonna destra in tre registri: i numeri fissi (20% · 60 gg · 50 $),
          la scala dei rinnovi 7/10/15 come oggetto a sé, le tre regole fini.
          #INVITE-AFFILIATE-UX-1022 — è lo stesso blocco `Offer` che si vede da anonimo (M3), con le tre
          finestre da 60 giorni (M5): prima e dopo il login si legge lo stesso documento. */}
      <Offer c={c} />
    </section>
  );
}
