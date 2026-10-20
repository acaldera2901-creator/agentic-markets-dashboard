"use client";
// components/classic/ClassicInvite.tsx — #CLASSIC-INVITE-1014 · la tab Invita a flag acceso.
//
// POV: un estratto conto onesto, non una pagina di reclutamento. Chi invita
// vuole il suo link in un gesto e sapere com'è fatto il patto; non vuole essere
// motivato. Un solo punto focale (il pannello del link, l'unica CTA lime), le
// regole sempre in chiaro, nessuna barra a premi, nessun «ti mancano X».
//
// Due versioni, scelte dal desk con due flag di BUILD:
//   v2=false — link e statistiche referral reali con termini 20% / 7%.
//              Nessun saldo commissioni derivato dai vecchi premi.
//   v2=true  — l'ANTEPRIMA degli Affiliati v2 (NEXT_PUBLIC_AFFILIATE_V2=1, solo
//              Preview): il backend v2 non esiste, quindi ledger, wallet e storico
//              sono dati di ESEMPIO, marcati «Esempio» e sotto il banner
//              «Anteprima — programma in arrivo». Il wallet è disabilitato e non
//              raccoglie niente (nessun name, nessuno stato, nessun submit).
//
// API: solo quelle che ReferralPanel usa già, con la stessa semantica —
// GET /api/referral/stats (401 = non loggato, 403 = nessun codice, altro = stato
// ignoto) e POST /api/referral/claim. Nessuna chiamata nuova.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/track-event";
import { launchPromoLive } from "@/lib/launch-promo-client";
import { INVITE_SAMPLE, fillInvite, inviteCopy, type SampleState } from "@/lib/classic/invite-copy";
import "./classic-invite.css";
import {commissionCopy} from "@/lib/classic/commission-copy";

type TierStat = { tier: number; reached: boolean; granted_at: string | null; rewardDays: number | null; grantsRoom: boolean };
type Stats = { signups: number; paying: number; inviteeBonusDays: number; tiers: TierStat[] };
type Phase = "loading" | "anon" | "unclaimed" | "claimed" | "error";

export type ClassicInviteProps = {
  lang: string;
  /** NEXT_PUBLIC_AFFILIATE_V2 === "1", letto dal desk a build time */
  v2: boolean;
  onSignIn: () => void;
  onRegister: () => void;
};

const LOCALE: Record<string, string> = { en: "en-GB", it: "it-IT", es: "es-ES", fr: "fr-FR", ru: "ru-RU" };

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function parseStats(d: unknown): Stats {
  const o = (d ?? {}) as Record<string, unknown>;
  return {
    signups: Number(o.signups) || 0,
    paying: Number(o.paying) || 0,
    inviteeBonusDays: Number(o.inviteeBonusDays) || 0,
    tiers: Array.isArray(o.tiers)
      ? (o.tiers as Record<string, unknown>[]).map((t) => ({
          tier: Number(t?.tier) || 0,
          reached: t?.reached === true,
          granted_at: typeof t?.granted_at === "string" ? t.granted_at : null,
          // null = il premio non è tempo (la stanza): va riconosciuto prima di Number()
          rewardDays: typeof t?.rewardDays === "number" ? t.rewardDays : null,
          grantsRoom: t?.grantsRoom === true,
        }))
      : [],
  };
}

function Sample({ label }: { label: string }) {
  return <span className="cli-sample">{label}</span>;
}

export function ClassicInvite({ lang, v2, onSignIn, onRegister }: ClassicInviteProps) {
  const copy = inviteCopy(lang);
  const c = copy.common;
  const one = copy.v1;
  const terms = commissionCopy(lang);
  const two = copy.v2;
  const locale = LOCALE[lang.slice(0, 2)] ?? "en-GB";

  const [phase, setPhase] = useState<Phase>("loading");
  const [code, setCode] = useState("");
  const [claimedCode, setClaimedCode] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState(false);
  const [claimErr, setClaimErr] = useState<"taken" | "invalid" | "generic" | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const linkRef = useRef<HTMLInputElement>(null);
  const claimedRef = useRef<string | null>(null);

  const loadStats = () => {
    fetch("/api/referral/stats", { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          const k = typeof d?.code === "string" ? d.code : null;
          claimedRef.current = k;
          setClaimedCode(k);
          setStats(parseStats(d));
          setStatsErr(false);
          setPhase("claimed");
        } else if (r.status === 401) {
          // Non loggato: è uno stato, non un errore. Mai «Stats unavailable».
          setPhase("anon");
        } else if (r.status === 403) {
          setPhase("unclaimed");
        } else {
          // Stato ignoto: offrire il claim qui è dannoso (chi ha già un codice
          // prenderebbe un 409) — stessa regola di ReferralPanel #REFERRAL-KPI-0808.
          setStatsErr(true);
          setPhase(claimedRef.current ? "claimed" : "error");
        }
      })
      .catch(() => {
        setStatsErr(true);
        setPhase(claimedRef.current ? "claimed" : "error");
      });
  };
  useEffect(() => { loadStats(); }, []); // one-shot al mount, come ReferralPanel

  const normalized = code.trim().toUpperCase();
  const valid = /^[A-Z0-9_-]{2,20}$/.test(normalized);
  const link = claimedCode && typeof window !== "undefined" ? `${window.location.origin}/r/${claimedCode}` : "";

  const claim = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setClaimErr(null);
    try {
      const r = await fetch("/api/referral/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: normalized }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok || (r.status === 409 && d?.code)) {
        const k = String(d?.code ?? normalized);
        claimedRef.current = k;
        setClaimedCode(k);
        setPhase("claimed");
        loadStats();
        if (r.ok) trackEvent("referral_code_claimed"); // nessun codice nel meta: eventi anonimi
      } else if (r.status === 409) setClaimErr("taken");
      else if (r.status === 400) setClaimErr("invalid");
      else if (r.status === 401) setPhase("anon");
      else setClaimErr("generic");
    } catch {
      setClaimErr("generic");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
      trackEvent("referral_link_copied");
    } catch {
      // clipboard negata: il link resta lì, selezionato, da copiare a mano
      setCopyState("failed");
      linkRef.current?.select();
    }
    setTimeout(() => setCopyState("idle"), 2400);
  };

  // KPI reali — da /api/referral/stats. Loading «…», errore «—», zero resta zero.
  const kpi = (v: number | null, suffix = "") => (statsErr ? "—" : !stats ? "…" : v === null ? "—" : `${v}${suffix}`);
  const convPct = stats && stats.signups > 0 ? Math.round((stats.paying / stats.signups) * 100) : null;
  const fmtDate = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  };
  const stateLabel: Record<SampleState, string> = { hold: two.stHold, payable: two.stPayable, paid: two.stPaid, void: two.stVoid };

  const loggedIn = phase === "unclaimed" || phase === "claimed" || phase === "error";
  const steps = v2
    ? [[c.step1T, c.step1B], [two.step2T, two.step2B], [two.step3T, two.step3B]]
    : [[c.step1T, c.step1B], [terms.first, terms.firstBody], [terms.renewal, terms.renewalBody]];

  return (
    <div className="cli" id="client-invite" data-v2={v2 ? "1" : "0"}>
      <header className="cli-head">
        <h2 className="cli-headline">{c.headline}</h2>
        <p className="cli-lede">{v2 ? two.lede : terms.intro}</p>
      </header>

      {v2 && (
        <aside className="cli-preview" role="note" aria-labelledby="cli-preview-t">
          <p id="cli-preview-t" className="cli-preview__t">{two.previewTitle}</p>
          <p className="cli-preview__b">{two.previewBody}</p>
        </aside>
      )}

      <div className="cli-top">
        {/* ── il link: l'unico punto focale, l'unica CTA lime ─────────────── */}
        <section className="cli-link" aria-labelledby="cli-link-t" aria-busy={phase === "loading"}>
          <h3 id="cli-link-t" className="cli-h">{c.linkTitle}</h3>

          {phase === "loading" && <p className="cli-muted" role="status">{c.loading}</p>}

          {phase === "anon" && (
            <div className="cli-anon">
              <p className="cli-anon__t">{c.anonTitle}</p>
              <p className="cli-muted">{c.anonBody}</p>
              <div className="cli-actions">
                <button type="button" className="cli-cta" onClick={onRegister}>{c.anonCreate}</button>
                <button type="button" className="cli-cta cli-cta--ghost" onClick={onSignIn}>{c.anonSignIn}</button>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="cli-anon">
              <p className="cli-muted" role="status">{c.statsErr}</p>
              <div className="cli-actions">
                <button type="button" className="cli-cta cli-cta--ghost" onClick={() => { setStatsErr(false); setPhase("loading"); loadStats(); }}>
                  {c.retry}
                </button>
              </div>
            </div>
          )}

          {phase === "unclaimed" && (
            <form className="cli-claim" onSubmit={(e) => { e.preventDefault(); void claim(); }} noValidate>
              <label htmlFor="cli-code" className="cli-label">{c.codeLabel}</label>
              <input
                id="cli-code"
                type="text"
                className="cli-input cli-input--code"
                value={code}
                onChange={(e) => { setCode(e.target.value); setClaimErr(null); }}
                placeholder={c.placeholder}
                maxLength={20}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="cli-code-hint"
                aria-invalid={claimErr === "invalid" || claimErr === "taken" ? true : undefined}
              />
              <p id="cli-code-hint" className="cli-muted cli-small">{c.hint}</p>
              {claimErr && (
                <p className="cli-err" role="alert">
                  {claimErr === "taken" ? c.errTaken : claimErr === "invalid" ? c.errInvalid : c.errGeneric}
                </p>
              )}
              <button type="submit" className="cli-cta" disabled={!valid || busy}>{busy ? c.claimBusy : c.claimBtn}</button>
            </form>
          )}

          {phase === "claimed" && claimedCode && (
            <div className="cli-have">
              <label htmlFor="cli-url" className="cli-sr">{c.linkTitle}</label>
              <input id="cli-url" ref={linkRef} className="cli-input cli-url" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="cli-cta" onClick={copyLink}>
                {copyState === "copied" ? c.copied : copyState === "failed" ? c.copyFail : c.copy}
              </button>
              <p className="cli-sr" aria-live="polite">{copyState === "copied" ? c.copied : ""}</p>
              <p className="cli-code">
                <span className="cli-label">{c.yourCode}</span> <strong>{claimedCode}</strong>
              </p>
              {/* v1: cosa riceve l'amico, la frase che chi invita copia nel messaggio */}

              {statsErr && <p className="cli-muted cli-small" role="status">{c.statsErr}</p>}
            </div>
          )}
        </section>

        {/* ── come funziona: tre passi, numeri che leggono come numeri ─────── */}
        <section className="cli-how" aria-labelledby="cli-how-t">
          <h3 id="cli-how-t" className="cli-h">{c.howTitle}</h3>
          <ol className="cli-steps">
            {steps.map(([t, b], i) => (
              <li key={i}>
                <span className="cli-steps__n" aria-hidden="true">{i + 1}</span>
                <strong>{t}</strong>
                <span>{b}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ══ v1: il programma attuale, solo giorni di PRO ═══════════════════ */}
      {!v2 && phase === "claimed" && (
        <section className="cli-block" aria-labelledby="cli-kpi-t">
          <h3 id="cli-kpi-t" className="cli-h">{one.kpiTitle}</h3>
          <dl className="cli-kpis">
            <div><dt>{c.kSignups}</dt><dd>{kpi(stats?.signups ?? null)}</dd></div>
            <div><dt>{c.kPaying}</dt><dd>{kpi(stats?.paying ?? null)}</dd></div>
            <div><dt>{c.kConv}</dt><dd>{kpi(convPct, "%")}</dd></div>

          </dl>
          {!statsErr && stats?.signups === 0 && <p className="cli-muted">{c.zeroState}</p>}

        </section>
      )}

      {!v2 && loggedIn && (
        <div className="cli-foot">
          <p>{terms.note}</p>
          {launchPromoLive() && <p>{one.promo}</p>}
        </div>
      )}

      {/* ══ v2: l'anteprima Affiliati — reale solo ciò che l'API dà già ═══ */}
      {v2 && loggedIn && (
        <>
          <div className="cli-pair">
            <section className="cli-block" aria-labelledby="cli-funnel-t">
              <h3 id="cli-funnel-t" className="cli-h">{two.kpiTitle}</h3>
              <dl className="cli-kpis">
                <div><dt>{two.kClicks}</dt><dd>—</dd><dd className="cli-kpis__note">{two.kClicksNote}</dd></div>
                <div><dt>{c.kSignups}</dt><dd>{phase === "claimed" ? kpi(stats?.signups ?? null) : "—"}</dd></div>
                <div><dt>{c.kPaying}</dt><dd>{phase === "claimed" ? kpi(stats?.paying ?? null) : "—"}</dd></div>
                <div><dt>{c.kConv}</dt><dd>{phase === "claimed" ? kpi(convPct, "%") : "—"}</dd></div>
              </dl>
              <p className="cli-muted cli-small">{two.kRealNote}</p>
              {phase === "claimed" && !statsErr && stats?.signups === 0 && <p className="cli-muted cli-small">{c.zeroState}</p>}
            </section>

            <section className="cli-block cli-ledger" aria-labelledby="cli-ledger-t">
              <div className="cli-block__head">
                <h3 id="cli-ledger-t" className="cli-h">{two.ledgerTitle}</h3>
                <Sample label={two.sample} />
              </div>
              <ol className="cli-flow">
                <li>
                  <span className="cli-flow__l">{two.lPending}</span>
                  <span className="cli-flow__v">{usd(INVITE_SAMPLE.pending)}</span>
                  <span className="cli-flow__n">{two.lPendingNote}</span>
                </li>
                <li data-focus="1">
                  <span className="cli-flow__l">{two.lPayable}</span>
                  <span className="cli-flow__v">{usd(INVITE_SAMPLE.payable)}</span>
                  <span className="cli-flow__n">{two.lPayableNote}</span>
                </li>
                <li>
                  <span className="cli-flow__l">{two.lPaid}</span>
                  <span className="cli-flow__v">{usd(INVITE_SAMPLE.paid)}</span>
                  <span className="cli-flow__n">{two.lPaidNote}</span>
                </li>
              </ol>
            </section>
          </div>

          <section className="cli-block cli-wallet" aria-labelledby="cli-wallet-t">
            <div className="cli-block__head">
              <h3 id="cli-wallet-t" className="cli-h">{two.walletTitle}</h3>
              <span className="cli-net">{two.walletNet}</span>
            </div>
            <p className="cli-muted">{two.walletState}</p>
            {/* NON funzionale per scelta: disabled + readOnly, nessun name, nessuno
                stato, nessun submit. Niente di scritto qui esce dal browser. */}
            <div className="cli-wallet__row">
              <label htmlFor="cli-wallet" className="cli-label">{two.walletLabel}</label>
              <input id="cli-wallet" className="cli-input" type="text" placeholder={two.walletPh} disabled readOnly autoComplete="off" aria-describedby="cli-wallet-warn" />
              <button type="button" className="cli-cta cli-cta--ghost" disabled>{two.walletSave}</button>
            </div>
            <p id="cli-wallet-warn" className="cli-warn">{two.walletWarn}</p>
            <p className="cli-muted cli-small">{two.walletCycle}</p>
          </section>

          <section className="cli-block" aria-labelledby="cli-hist-t">
            <div className="cli-block__head">
              <h3 id="cli-hist-t" className="cli-h">{two.histTitle}</h3>
              <Sample label={two.sample} />
            </div>
            <table className="cli-table">
              <thead>
                <tr>
                  <th scope="col">{two.hUser}</th>
                  <th scope="col">{two.hEvent}</th>
                  <th scope="col">{two.hDate}</th>
                  <th scope="col" className="cli-num">{two.hBase}</th>
                  <th scope="col" className="cli-num">{two.hAmount}</th>
                  <th scope="col">{two.hState}</th>
                </tr>
              </thead>
              <tbody>
                {INVITE_SAMPLE.rows.map((r, i) => (
                  <tr key={i} data-state={r.state}>
                    <td data-k="who">{r.who}</td>
                    <td data-k="event">{r.event === "first" ? two.evFirst : fillInvite(two.evRenew, { n: r.renewN ?? 2 })}</td>
                    <td data-k="date">{fmtDate(r.date)}</td>
                    <td data-k="base" className="cli-num">{usd(r.base)}</td>
                    <td data-k="amount" className="cli-num"><strong>{usd(r.amount)}</strong></td>
                    <td data-k="state"><span className="cli-st" data-state={r.state}>{stateLabel[r.state]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {v2 && (
        <section className="cli-block cli-rules" aria-labelledby="cli-rules-t">
          <h3 id="cli-rules-t" className="cli-h">{two.rulesTitle}</h3>
          <ul>
            {[two.rule1, two.rule2, two.rule3, two.rule4, two.rule5, two.rule6, two.rule7].map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="cli-terms">
            <span>{two.termsDraft}</span>
            <span aria-hidden="true"> · </span>
            <Link href="/terms">{two.termsSite}</Link>
          </p>
        </section>
      )}
    </div>
  );
}
