"use client";

// components/HouseBanner.tsx (#HOUSE-BANNERS-1, ricco in #HOUSE-BANNERS-2)
// Banner house PROPRIETARIO di BetRedge. Presentazionale: riceve una campagna
// già risolta (vedi lib/house-banners.ts) + dati reali opzionali del board.
// Versione ricca (ticker/chip/mini-board) SOLO con dati veri; senza dati → sobrio.
// Interattività: dismiss persistente (localStorage) + tracking view/click/dismiss.
// I glifi sport usano il SportGlyphSprite già montato nelle pagine host.

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { hasRichData, type BannerData, type BannerEdge, type HouseCampaign, type Lang } from "@/lib/house-banners";

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

const fmtEdge = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

function Headline({ headline, accent }: { headline: string; accent?: string }) {
  return (
    <>
      {headline}
      {accent ? <> <span className="hb-accent">{accent}</span></> : null}
    </>
  );
}

// Ticker scorrevole coi top edge reali. Duplica le righe per loop senza stacchi.
function Ticker({ edges }: { edges: BannerEdge[] }) {
  const row = (k: string) => (
    <div className="hb-tickrow" key={k}>
      {edges.map((e, i) => (
        <span className="hb-ti" key={`${k}-${i}`}>
          <svg aria-hidden="true"><use href={e.glyph} /></svg>
          {e.name} <span className="hb-ti-e">{fmtEdge(e.edge)}</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="hb-ticker" aria-hidden="true">
      <div className="hb-tickwrap">{row("a")}{row("b")}</div>
    </div>
  );
}

// Mini-board verticale (half page): top edge reali come righe.
function MiniBoard({ edges, lang }: { edges: BannerEdge[]; lang: Lang }) {
  return (
    <div className="hb-miniboard">
      <span className="hb-eyebrow hb-mb-lab">{lang === "it" ? "Top edge adesso" : "Top edge now"}</span>
      {edges.slice(0, 3).map((e, i) => (
        <div className="hb-mini" key={i}>
          <svg aria-hidden="true"><use href={e.glyph} /></svg>
          <span className="hb-mini-nm">{e.name}</span>
          <span className="hb-mini-e">{fmtEdge(e.edge)}</span>
        </div>
      ))}
    </div>
  );
}

// Stat chip reali (edge medio + hit rate). Mostra solo i campi disponibili.
function Chips({ data }: { data: BannerData }) {
  const chips: { k: string; v: string }[] = [];
  if (data.edgeAvgPct != null) chips.push({ k: "Edge medio", v: fmtEdge(data.edgeAvgPct) });
  if (data.hitRate) chips.push({ k: "Hit rate", v: data.hitRate });
  if (!chips.length) return null;
  return (
    <div className="hb-chips">
      {chips.map((c) => (
        <div className="hb-chip" key={c.k}>
          <span className="hb-chip-k">{c.k}</span>
          <span className="hb-chip-v">{c.v}</span>
        </div>
      ))}
    </div>
  );
}

// Sfondo foto opzionale (#HOUSE-PHOTO-1): immagine decorativa + overlay coral.
// Puramente presentazionale; il colore testo bianco è gestito da .hb-photo nel CSS.
function PhotoBg({ src }: { src: string }) {
  return (
    <>
      <div className="hb-photo-bg" aria-hidden="true" style={{ backgroundImage: `url(${src})` }} />
      <div className="hb-photo-ov" aria-hidden="true" />
    </>
  );
}

// Accetta il set lingue ampio del desk (it/en/es/fr/ru): risolve a it/en
// (it→it, qualsiasi altro→en) per le copy bilingui delle campagne.
// #QA-SERGIO-BAGS-1: `onCta` lets the host intercept a CTA click. Per i banner
// renderizzati DENTRO /app, gli href same-page (/app?tab=…) non risincronizzano
// il tab dell'host (lo legge solo al mount) → il <Link> alla stessa route è un
// no-op e il bottone sembrava morto. L'host ritorna true se ha gestito il click.
export function HouseBanner({ campaign, lang, data, onCta }: { campaign: HouseCampaign; lang: string; data?: BannerData | null; onCta?: (href: string) => boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const viewed = useRef(false);
  const L: Lang = lang === "it" ? "it" : "en";
  const c = campaign.copy[L];
  const ctaLabel = L === "it" ? campaign.cta.it : campaign.cta.en;
  const rich = hasRichData(data);
  // Classe foto (#HOUSE-PHOTO-1): vuota se la campagna non ha image → rendering invariato.
  const photoCls = campaign.image ? ` hb-photo hb-ov-${campaign.image.overlay ?? "l"}` : "";

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
  const onCtaClick = (e: MouseEvent) => {
    track("house_banner_click", campaign);
    // Solo click semplici: cmd/ctrl/shift/alt/middle restano "apri in nuova scheda".
    if (
      onCta &&
      e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey &&
      onCta(campaign.cta.href)
    ) {
      e.preventDefault();
    }
  };

  const dismissBtn = (
    <button type="button" className="hb-x" onClick={onDismiss} aria-label={L === "it" ? "Chiudi" : "Dismiss"}>×</button>
  );

  // ── Leaderboard (728×90) ──────────────────────────────────────────────
  if (campaign.format === "leaderboard") {
    const subBits: string[] = [];
    if (rich) {
      subBits.push(`${data.eventsCount} ${L === "it" ? "match" : "matches"}`);
      if (data.edgeAvgPct != null) subBits.push(`${fmtEdge(data.edgeAvgPct)} ${L === "it" ? "edge medio" : "avg edge"}`);
    }
    return (
      <aside className={`house-banner hb-leaderboard${photoCls}`} aria-label={c.eyebrow}>
        {campaign.image ? <PhotoBg src={campaign.image.src} /> : null}
        <svg className="hb-ic" aria-hidden="true"><use href={campaign.glyphs[0]} /></svg>
        <div className="hb-lead-text">
          <span className="hb-eyebrow">{c.eyebrow}</span>
          <span className="hb-headline"><Headline headline={c.headline} accent={c.accent} /></span>
        </div>
        {subBits.length ? <span className="hb-lead-stat">{subBits.join(" · ")}</span> : null}
        <Link href={campaign.cta.href} className="hb-cta" onClick={onCtaClick}>{ctaLabel}</Link>
        {dismissBtn}
      </aside>
    );
  }

  // ── Rectangle (300×250) ───────────────────────────────────────────────
  if (campaign.format === "rectangle") {
    const chip = rich
      ? (data.hitRate ? { k: L === "it" ? "Hit rate" : "Hit rate", v: data.hitRate }
        : data.edgeAvgPct != null ? { k: L === "it" ? "Edge medio" : "Avg edge", v: fmtEdge(data.edgeAvgPct) }
        : null)
      : null;
    return (
      <aside className={`house-banner hb-rectangle${photoCls}`} aria-label={c.eyebrow}>
        {campaign.image ? <PhotoBg src={campaign.image.src} /> : null}
        {dismissBtn}
        <span className="hb-eyebrow">{c.eyebrow}</span>
        <span className="hb-headline"><Headline headline={c.headline} accent={c.accent} /></span>
        <span className="hb-sub">{c.sub}</span>
        <div className="hb-glyphs">
          {campaign.glyphs.map((g) => (
            <svg key={g} className="hb-ic-sm" aria-hidden="true"><use href={g} /></svg>
          ))}
        </div>
        {chip ? (
          <div className="hb-chip hb-chip-row">
            <span className="hb-chip-k">{chip.k}</span>
            <span className="hb-chip-v">{chip.v}</span>
          </div>
        ) : null}
        <Link href={campaign.cta.href} className="hb-cta hb-cta-block" onClick={onCtaClick}>{ctaLabel}</Link>
      </aside>
    );
  }

  // ── Half page (300×600) ───────────────────────────────────────────────
  if (campaign.format === "halfpage") {
    return (
      <aside className={`house-banner hb-halfpage${photoCls}`} aria-label={c.eyebrow}>
        {campaign.image ? <PhotoBg src={campaign.image.src} /> : null}
        <div className="hb-glow" aria-hidden="true" />
        {dismissBtn}
        <span className="hb-eyebrow">{c.eyebrow}</span>
        <span className="hb-headline"><Headline headline={c.headline} accent={c.accent} /></span>
        <span className="hb-sub">{c.sub}</span>
        {rich ? <MiniBoard edges={data.topEdges} lang={L} /> : (
          <div className="hb-glyphs hb-glyphs-col">
            {campaign.glyphs.map((g) => (
              <svg key={g} className="hb-ic-sm" aria-hidden="true"><use href={g} /></svg>
            ))}
          </div>
        )}
        <Link href={campaign.cta.href} className="hb-cta hb-cta-block hb-cta-foot" onClick={onCtaClick}>{ctaLabel}</Link>
      </aside>
    );
  }

  // ── Billboard (970×250 / full-width) ──────────────────────────────────
  return (
    <aside className={`house-banner hb-billboard${rich ? " hb-rich" : ""}${photoCls}`} aria-label={c.eyebrow}>
      {campaign.image ? <PhotoBg src={campaign.image.src} /> : null}
      <div className="hb-glow" aria-hidden="true" />
      <div className="hb-float" aria-hidden="true">
        {campaign.glyphs.map((g, i) => (
          <svg key={g} className={`hb-fg hb-fg-${i}`} aria-hidden="true"><use href={g} /></svg>
        ))}
      </div>
      {dismissBtn}
      <div className="hb-bill-row">
        <div className="hb-bill-main">
          <span className="hb-eyebrow">{c.eyebrow}</span>
          <span className="hb-headline"><Headline headline={c.headline} accent={c.accent} /></span>
          <span className="hb-sub">{c.sub}</span>
          <Link href={campaign.cta.href} className="hb-cta" onClick={onCtaClick}>{ctaLabel}</Link>
        </div>
        {rich ? <Chips data={data} /> : null}
      </div>
      {rich ? <Ticker edges={data.topEdges} /> : null}
    </aside>
  );
}
