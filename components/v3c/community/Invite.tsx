"use client";
// components/v3c/community/Invite.tsx (#REDESIGN-V3C · filone pages)
// Il pannello Invita in v3c. Stesse chiamate e stessi stati di ReferralPanel
// (app/app/page.tsx): GET /api/referral/stats · POST /api/referral/claim;
// loading → unclaimed → claimed, «error» quando lo stato è ignoto (5xx/rete:
// offrire il claim a chi un codice ce l'ha già darebbe un 409). In più lo stato
// «signin»: la pagina non sta più dietro il muro della Dashboard, quindi un 401
// si dice per quello che è, con il link all'accesso che esiste oggi.
// Nessun premio e nessuna soglia scritti qui: arrivano tutti dall'API.
import { useCallback, useEffect, useRef, useState } from "react";
import { launchPromoLive } from "@/lib/launch-promo-client";
import { SIGN_IN_HREF } from "@/lib/v3c/checkout-link";
import { trackEvent } from "@/lib/track-event";
import { Fascia } from "../Fascia";
import { useCommunityCopy } from "./useCopy";

type Tier = { tier: number; reached: boolean; granted_at: string | null; rewardDays: number | null; grantsRoom: boolean };
type Stats = { signups: number; paying: number; inviteeBonusDays: number; tiers: Tier[] };
export type InvitePhase = "loading" | "unclaimed" | "claimed" | "error" | "signin";

function toStats(d: Record<string, unknown>): Stats {
  return {
    signups: Number(d?.signups) || 0,
    paying: Number(d?.paying) || 0,
    inviteeBonusDays: Number(d?.inviteeBonusDays) || 0,
    tiers: Array.isArray(d?.tiers)
      ? (d.tiers as Record<string, unknown>[]).map((x) => ({
          tier: Number(x?.tier) || 0,
          reached: x?.reached === true,
          granted_at: typeof x?.granted_at === "string" ? x.granted_at : null,
          rewardDays: typeof x?.rewardDays === "number" ? x.rewardDays : null,
          grantsRoom: x?.grantsRoom === true,
        }))
      : [],
  };
}

export function V3cInvite() {
  const c = useCommunityCopy().inv;
  const [phase, setPhase] = useState<InvitePhase>("loading");
  const [code, setCode] = useState("");
  const [claimedCode, setClaimedCode] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState(false);
  const [claimErr, setClaimErr] = useState<"taken" | "invalid" | "generic" | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const known = useRef<string | null>(null);

  const loadStats = useCallback(() => {
    fetch("/api/referral/stats", { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        if (r.ok) {
          const d = (await r.json()) as Record<string, unknown>;
          const cc = typeof d?.code === "string" ? d.code : null;
          known.current = cc;
          setClaimedCode(cc);
          setStats(toStats(d));
          setPhase("claimed");
        } else if (r.status === 401) {
          setPhase("signin");
        } else if (r.status === 403) {
          setPhase("unclaimed");
        } else {
          setStatsErr(true);
          setPhase(known.current ? "claimed" : "error");
        }
      })
      .catch(() => {
        setStatsErr(true);
        setPhase(known.current ? "claimed" : "error");
      });
  }, []);

  useEffect(() => {
    // l'origine esiste solo nel browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    loadStats();
  }, [loadStats]);

  const normalized = code.trim().toUpperCase();
  const valid = /^[A-Z0-9_-]{2,20}$/.test(normalized);
  const link = claimedCode && origin ? `${origin}/r/${claimedCode}` : "";
  const nextTier = stats?.tiers.find((x) => !x.reached) ?? null;
  const earnedDays = (stats?.tiers ?? []).reduce((s, x) => s + (x.granted_at !== null && x.rewardDays !== null ? x.rewardDays : 0), 0);
  const convPct = stats && stats.signups > 0 ? Math.round((stats.paying / stats.signups) * 100) : null;
  const progressPct = nextTier && nextTier.tier > 0 ? Math.min(100, Math.max(0, Math.round(((stats?.paying ?? 0) / nextTier.tier) * 100))) : 100;
  const kpi = (v: number | null, suffix = "") => (statsErr ? "—" : !stats ? "…" : v === null ? "—" : `${v}${suffix}`);

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
      const d = (await r.json().catch(() => ({}))) as { code?: unknown };
      if (r.ok) {
        setClaimedCode(String(d?.code ?? normalized));
        setPhase("claimed");
        loadStats();
        trackEvent("referral_code_claimed");
      } else if (r.status === 409 && d?.code) {
        setClaimedCode(String(d.code));
        setPhase("claimed");
        loadStats();
      } else if (r.status === 409) setClaimErr("taken");
      else if (r.status === 400) setClaimErr("invalid");
      else if (r.status === 401) setPhase("signin");
      else setClaimErr("generic");
    } catch {
      setClaimErr("generic");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); } catch { /* il link resta visibile */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    trackEvent("referral_link_copied");
  };

  return (
    <main className="v3c-wrap v3c-cm">
      <Fascia tab={c.tab} title={c.title} meta={<><b>{c.metaStrong}</b><span>{c.metaRest}</span></>} />
      <p className="v3c-lede v3c-cm-lede">{c.intro}</p>

      {phase === "loading" && <p className="v3c-cm-wait" aria-busy="true">{c.loading}</p>}

      {phase === "signin" && (
        <section className="v3c-cm-box">
          <h2 className="v3c-t-sec">{c.signInTitle}</h2>
          <p className="v3c-small">{c.signInBody}</p>
          <a className="v3c-btn v3c-btn-cta" href={SIGN_IN_HREF}>{c.signIn}</a>
        </section>
      )}

      {phase === "error" && (
        <div className="v3c-error" role="alert">
          <p>{c.statsErr}</p>
          <button type="button" className="v3c-linkbtn" onClick={() => { setStatsErr(false); setPhase("loading"); loadStats(); }}>{c.retry}</button>
        </div>
      )}

      {phase === "unclaimed" && (
        <section className="v3c-cm-box">
          <label className="v3c-cm-field">
            <span className="v3c-lab">{c.codeLabel}</span>
            <input value={code} maxLength={20} placeholder={c.placeholder} onChange={(e) => { setCode(e.target.value); setClaimErr(null); }} />
          </label>
          <p className="v3c-fine">{c.hint}</p>
          <button type="button" className="v3c-btn v3c-btn-cta" onClick={claim} disabled={!valid || busy}>{busy ? c.claimBusy : c.claimBtn}</button>
          {claimErr && <p className="v3c-cm-err" role="alert">{claimErr === "taken" ? c.errTaken : claimErr === "invalid" ? c.errInvalid : c.errGeneric}</p>}
        </section>
      )}

      {phase === "claimed" && (
        <>
          <section className="v3c-cm-link">
            <div>
              <span className="v3c-lab">{c.yourCode}</span>
              <b className="v3c-n-xl">{claimedCode}</b>
            </div>
            <div className="v3c-cm-linkrow">
              <span className="v3c-lab">{c.linkLabel}</span>
              <code className="v3c-cm-url">{link}</code>
              <button type="button" className="v3c-btn v3c-btn-cta" onClick={copyLink} aria-live="polite">{copied ? c.copied : c.copy}</button>
              {!!stats?.inviteeBonusDays && <p className="v3c-small">{c.friendGets(stats.inviteeBonusDays)}</p>}
            </div>
          </section>

          <dl className="v3c-cm-kpi">
            <div><dt>{c.signups}</dt><dd className="v3c-num">{kpi(stats?.signups ?? null)}</dd></div>
            <div><dt>{c.paying}</dt><dd className="v3c-num">{kpi(stats?.paying ?? null)}</dd></div>
            <div><dt>{c.kpiConv}</dt><dd className="v3c-num">{kpi(convPct, "%")}</dd></div>
            <div><dt>{c.kpiEarned}</dt><dd className="v3c-num"><mark>{kpi(earnedDays)}</mark></dd></div>
          </dl>
          {!statsErr && stats?.signups === 0 && <p className="v3c-small">{c.zeroState}</p>}

          {!!stats?.tiers.length && (
            <section className="v3c-cm-tiers">
              <div className="v3c-sec-h">
                <h2 className="v3c-t-sec">{c.rewardsTitle}</h2>
                <span className="v3c-small">{nextTier ? c.progress(stats.paying, Math.max(1, nextTier.tier - stats.paying)) : c.progressDone(stats.paying)}</span>
              </div>
              <div className="v3c-cm-bar" aria-hidden="true"><i style={{ width: `${progressPct}%` }} /></div>
              {nextTier && <p className="v3c-small">{c.nextUp(nextTier.rewardDays !== null ? c.rewardDays(nextTier.rewardDays) : c.rewardRoom, nextTier.tier)}</p>}
              <ul>
                {stats.tiers.map((x) => (
                  <li key={x.tier} className={x.reached ? "v3c-cm-reached" : undefined}>
                    <span aria-hidden="true">{x.reached ? "✓" : "·"}</span>
                    <span>{c.tierAt(x.tier)}</span>
                    <span>
                      {x.rewardDays !== null ? c.rewardDays(x.rewardDays) : c.rewardRoom}
                      {x.reached && !x.granted_at && <small> · {c.pending}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {statsErr && <p className="v3c-small">{c.statsErr}</p>}
        </>
      )}

      <div className="v3c-cm-foot">
        <p className="v3c-fine">{c.note}</p>
        {launchPromoLive() && <p className="v3c-fine">{c.promo}</p>}
      </div>
    </main>
  );
}
