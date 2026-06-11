"use client";

// components/HouseBanner.tsx (#HOUSE-BANNERS-1)
// Banner house PROPRIETARIO di BetRedge. Presentazionale: riceve una campagna
// già risolta (vedi lib/house-banners.ts) e la renderizza nel formato richiesto.
// Interattività: dismiss persistente (localStorage) + tracking view/click/dismiss.
// I glifi sport usano il SportGlyphSprite già montato nelle pagine host.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HouseCampaign, Lang } from "@/lib/house-banners";

const DISMISS_KEY = "br_house_dismissed";

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, Array.from(ids).join(","));
  } catch {
    /* no-op */
  }
}

// Mini-tracker fire-and-forget, coerente col trackEvent del desk (stessa am_sid).
function track(event_type: string, campaign: HouseCampaign) {
  if (typeof window === "undefined") return;
  let sid = "";
  try {
    sid = sessionStorage.getItem("am_sid") ?? "";
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("am_sid", sid);
    }
  } catch {
    /* ignore */
  }
  const language = (() => {
    try { return localStorage.getItem("agentic-lang") ?? undefined; } catch { return undefined; }
  })();
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type, session_id: sid, language, meta: { campaign_id: campaign.id, slot: campaign.slot } }),
  }).catch(() => { /* never block UI */ });
}

function Headline({ headline, accent }: { headline: string; accent?: string }) {
  return (
    <>
      {headline}
      {accent ? <> <span className="hb-accent">{accent}</span></> : null}
    </>
  );
}

// Accetta il set lingue ampio del desk (it/en/es/fr/ru): risolve a it/en
// (it→it, qualsiasi altro→en) per le copy bilingui delle campagne.
export function HouseBanner({ campaign, lang }: { campaign: HouseCampaign; lang: string }) {
  const [dismissed, setDismissed] = useState(false);
  const viewed = useRef(false);
  const L: Lang = lang === "it" ? "it" : "en";
  const c = campaign.copy[L];
  const ctaLabel = L === "it" ? campaign.cta.it : campaign.cta.en;

  // Mount-sync da localStorage: se già chiuso in sessione, non mostrare.
  useEffect(() => {
    if (readDismissed().has(campaign.id)) {
      setDismissed(true);
    } else if (!viewed.current) {
      viewed.current = true;
      track("house_banner_view", campaign);
    }
  }, [campaign]);

  if (dismissed) return null;

  const onDismiss = () => {
    const ids = readDismissed();
    ids.add(campaign.id);
    persistDismissed(ids);
    track("house_banner_dismiss", campaign);
    setDismissed(true);
  };
  const onClick = () => track("house_banner_click", campaign);

  const dismissBtn = (
    <button type="button" className="hb-x" onClick={onDismiss} aria-label={lang === "it" ? "Chiudi" : "Dismiss"}>×</button>
  );

  // ── Leaderboard (728×90) ──────────────────────────────────────────────
  if (campaign.format === "leaderboard") {
    return (
      <aside className="house-banner hb-leaderboard" aria-label={c.eyebrow}>
        <svg className="hb-ic" aria-hidden="true"><use href={campaign.glyphs[0]} /></svg>
        <div className="hb-lead-text">
          <span className="hb-eyebrow">{c.eyebrow}</span>
          <span className="hb-headline"><Headline headline={c.headline} accent={c.accent} /></span>
        </div>
        <Link href={campaign.cta.href} className="hb-cta" onClick={onClick}>{ctaLabel}</Link>
        {dismissBtn}
      </aside>
    );
  }

  // ── Rectangle (300×250) ───────────────────────────────────────────────
  if (campaign.format === "rectangle") {
    return (
      <aside className="house-banner hb-rectangle" aria-label={c.eyebrow}>
        {dismissBtn}
        <span className="hb-eyebrow">{c.eyebrow}</span>
        <span className="hb-headline"><Headline headline={c.headline} accent={c.accent} /></span>
        <span className="hb-sub">{c.sub}</span>
        <div className="hb-glyphs">
          {campaign.glyphs.map((g) => (
            <svg key={g} className="hb-ic-sm" aria-hidden="true"><use href={g} /></svg>
          ))}
        </div>
        <Link href={campaign.cta.href} className="hb-cta hb-cta-block" onClick={onClick}>{ctaLabel}</Link>
      </aside>
    );
  }

  // ── Billboard (970×250 / full-width) ──────────────────────────────────
  return (
    <aside className="house-banner hb-billboard" aria-label={c.eyebrow}>
      <div className="hb-glow" aria-hidden="true" />
      <div className="hb-float" aria-hidden="true">
        {campaign.glyphs.map((g, i) => (
          <svg key={g} className={`hb-fg hb-fg-${i}`} aria-hidden="true"><use href={g} /></svg>
        ))}
      </div>
      {dismissBtn}
      <div className="hb-bill-main">
        <span className="hb-eyebrow">{c.eyebrow}</span>
        <span className="hb-headline"><Headline headline={c.headline} accent={c.accent} /></span>
        <span className="hb-sub">{c.sub}</span>
        <Link href={campaign.cta.href} className="hb-cta" onClick={onClick}>{ctaLabel}</Link>
      </div>
    </aside>
  );
}
