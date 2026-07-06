"use client";

// components/HouseBanner.tsx (#HOUSE-BANNERS-1, ricco in #HOUSE-BANNERS-2)
// Banner house PROPRIETARIO di BetRedge. Presentazionale: riceve una campagna
// già risolta (vedi lib/house-banners.ts) + dati reali opzionali del board.
// Versione ricca (ticker/chip/mini-board) SOLO con dati veri; senza dati → sobrio.
// Interattività: dismiss persistente (localStorage) + tracking view/click/dismiss.
// I glifi sport usano il SportGlyphSprite già montato nelle pagine host.

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { hasRichData, copyFor, ctaLabelFor, creativeFor, type BannerData, type BannerEdge, type HouseCampaign, type Lang } from "@/lib/house-banners";

// Micro-stringhe del componente (non-copy) per le 5 lingue del desk.
const HB_UI: Record<Lang, {
  matches: string; avgEdge: string; edgeMedio: string; hitRate: string;
  topEdge: string; dismiss: string;
}> = {
  it: { matches: "match", avgEdge: "edge medio", edgeMedio: "Edge medio", hitRate: "Hit rate", topEdge: "Top edge adesso", dismiss: "Chiudi" },
  en: { matches: "matches", avgEdge: "avg edge", edgeMedio: "Avg edge", hitRate: "Hit rate", topEdge: "Top edge now", dismiss: "Dismiss" },
  es: { matches: "partidos", avgEdge: "edge medio", edgeMedio: "Edge medio", hitRate: "Hit rate", topEdge: "Top edge ahora", dismiss: "Cerrar" },
  fr: { matches: "matchs", avgEdge: "edge moyen", edgeMedio: "Edge moyen", hitRate: "Taux de réussite", topEdge: "Top edge maintenant", dismiss: "Fermer" },
  ru: { matches: "матчей", avgEdge: "средний эдж", edgeMedio: "Средний эдж", hitRate: "Точность", topEdge: "Топ эдж сейчас", dismiss: "Закрыть" },
};
function hbLang(lang: string): Lang {
  return lang === "it" || lang === "es" || lang === "fr" || lang === "ru" ? lang : "en";
}

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

// I glifi sport (calcio/tennis/WC) usano le icone 3D nuove (stesse del selettore
// sport); gli altri glifi (pick/rank/…) restano line-art SVG. `className` porta la
// dimensione esistente (.hb-ic/.hb-ic-sm/.hb-fg) — per ticker/mini la misura
// dell'img arriva da .hb-ti/.hb-mini .hb-spi nel CSS.
const SPORT_ICON: Record<string, string> = {
  "#g-ball": "/banners/sport-football.png",
  "#g-pitch": "/banners/sport-football.png",
  "#g-racket": "/banners/sport-tennis.png",
  "#g-tball": "/banners/sport-tennis.png",
  "#g-grass": "/banners/sport-tennis.png",
  "#g-court": "/banners/sport-tennis.png",
  "#g-trophy": "/banners/sport-worldcup.png",
};
function Glyph({ g, className }: { g: string; className?: string }) {
  const icon = SPORT_ICON[g];
  if (icon) {
    return <img src={icon} alt="" aria-hidden="true" className={`hb-spi${className ? ` ${className}` : ""}`} />;
  }
  return <svg className={className} aria-hidden="true"><use href={g} /></svg>;
}

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
          <Glyph g={e.glyph} />
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
      <span className="hb-eyebrow hb-mb-lab">{HB_UI[lang].topEdge}</span>
      {edges.slice(0, 3).map((e, i) => (
        <div className="hb-mini" key={i}>
          <Glyph g={e.glyph} />
          <span className="hb-mini-nm">{e.name}</span>
          <span className="hb-mini-e">{fmtEdge(e.edge)}</span>
        </div>
      ))}
    </div>
  );
}

// Stat chip reali (edge medio + hit rate). Mostra solo i campi disponibili.
function Chips({ data, lang }: { data: BannerData; lang: Lang }) {
  const chips: { k: string; v: string }[] = [];
  if (data.edgeAvgPct != null) chips.push({ k: HB_UI[lang].edgeMedio, v: fmtEdge(data.edgeAvgPct) });
  if (data.hitRate) chips.push({ k: HB_UI[lang].hitRate, v: data.hitRate });
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

// Accetta il set lingue ampio del desk (it/en/es/fr/ru): usa la copy nella
// lingua del desk con fallback a en (copyFor/ctaLabelFor) per le campagne.
// #QA-SERGIO-BAGS-1: `onCta` lets the host intercept a CTA click. Per i banner
// renderizzati DENTRO /app, gli href same-page (/app?tab=…) non risincronizzano
// il tab dell'host (lo legge solo al mount) → il <Link> alla stessa route è un
// no-op e il bottone sembrava morto. L'host ritorna true se ha gestito il click.
export function HouseBanner({ campaign, lang, data, onCta }: { campaign: HouseCampaign; lang: string; data?: BannerData | null; onCta?: (href: string) => boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const viewed = useRef(false);
  const L: Lang = hbLang(lang);
  const c = copyFor(campaign, L);
  const ctaLabel = ctaLabelFor(campaign, L);
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
    <button type="button" className="hb-x" onClick={onDismiss} aria-label={HB_UI[L].dismiss}>×</button>
  );

  // ── Creativo Ole (#HOUSE-OLE): banner finito 16:9 INTERO + CTA sopra ──────
  // Sostituisce l'overlay foto+testo. L'immagine porta già copy/logo di Ole; qui
  // resta solo il CTA (per-slot, i18n) e il dismiss. width:100%/height:auto →
  // nessun crop e nessuna banda (il contenitore si adatta al 16:9 del banner).
  const creative = creativeFor(campaign);
  if (creative) {
    return (
      <aside
        className="house-banner hb-creative"
        aria-label={c.eyebrow}
        style={{ position: "relative", display: "block", height: "auto", minHeight: 0, padding: 0, background: "transparent", overflow: "hidden", borderRadius: 14 }}
      >
        <img src={creative} alt={c.headline} style={{ display: "block", width: "100%", height: "auto" }} />
        <Link href={campaign.cta.href} className="hb-cta" onClick={onCtaClick} style={{ position: "absolute", left: 20, bottom: 20, zIndex: 2 }}>
          {ctaLabel}
        </Link>
        {dismissBtn}
      </aside>
    );
  }

  // ── Leaderboard (728×90) ──────────────────────────────────────────────
  if (campaign.format === "leaderboard") {
    const subBits: string[] = [];
    if (rich) {
      subBits.push(`${data.eventsCount} ${HB_UI[L].matches}`);
      if (data.edgeAvgPct != null) subBits.push(`${fmtEdge(data.edgeAvgPct)} ${HB_UI[L].avgEdge}`);
    }
    return (
      <aside className={`house-banner hb-leaderboard${photoCls}`} aria-label={c.eyebrow}>
        {campaign.image ? <PhotoBg src={campaign.image.src} /> : null}
        <Glyph g={campaign.glyphs[0]} className="hb-ic" />
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
      ? (data.hitRate ? { k: HB_UI[L].hitRate, v: data.hitRate }
        : data.edgeAvgPct != null ? { k: HB_UI[L].edgeMedio, v: fmtEdge(data.edgeAvgPct) }
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
            <Glyph key={g} g={g} className="hb-ic-sm" />
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
              <Glyph key={g} g={g} className="hb-ic-sm" />
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
          <Glyph key={g} g={g} className={`hb-fg hb-fg-${i}`} />
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
        {rich ? <Chips data={data} lang={L} /> : null}
      </div>
      {rich ? <Ticker edges={data.topEdges} /> : null}
    </aside>
  );
}
