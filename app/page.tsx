"use client";

// ── BetRedge — Landing pubblica (#LANDING-BETREDGE-1) ────────────────────────
// Prima pagina su "/". Ricrea l'inspo BetRedge (hero split football/tennis,
// scie energia coral/cobalt, 4 card) interamente in CSS/SVG (nessuna foto).
// Le CTA reindirizzano nel desk su /app (deep-link ?tab=&sport=).
// Stile: dark energetico sportsbook su token --am-* + font Hanken/JetBrains.

import { useEffect, useState } from "react";
import Link from "next/link";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";
import { HouseBanner } from "@/components/HouseBanner";
import { pickCampaign } from "@/lib/house-banners";

type Lang = "it" | "en";

const COPY = {
  it: {
    signin: "Accedi",
    register: "Registrati",
    leftLabel: "QUOTE IMBATTIBILI SU CALCIO & TENNIS",
    rightLabel: "IL VANTAGGIO DEFINITIVO\nCALCIO & TENNIS",
    tagline: ["PREVEDI.", "GIOCA.", "GUADAGNA."],
    pill: "IL VANTAGGIO DEFINITIVO NELLE SCOMMESSE",
    viewNow: "GUARDA ORA",
    joinNow: "ISCRIVITI ORA",
    cardBrandTitle: "Il tuo vantaggio nelle scommesse sportive",
    signNow: "REGISTRATI",
    cardFootball: "QUOTE CALCIO",
    cardFootballDesc: "Probabilità calibrate dal modello sui principali campionati — Dixon-Coles + xG.",
    cardLive: "QUOTE LIVE & INSIGHTS",
    cardLiveDesc: "Edge in tempo reale e spiegazioni: il modello aggiorna mentre la partita gira.",
    playNow: "GIOCA ORA",
    cardApp: "BETREDGE APP",
    cardAppDesc: "Il desk in tasca. In arrivo su iOS e Android.",
    appSoon: "IN ARRIVO",
    risk: "Nota rischio: BetRedge mostra analisi probabilistiche. Non garantisce profitti e non sostituisce la gestione del rischio personale. 18+.",
    privacy: "Privacy",
  },
  en: {
    signin: "Sign In",
    register: "Register",
    leftLabel: "UNBEATABLE ODDS ON FOOTBALL & TENNIS",
    rightLabel: "THE ULTIMATE EDGE\nFOOTBALL & TENNIS",
    tagline: ["PREDICT.", "PLAY.", "PROFIT."],
    pill: "THE ULTIMATE BETTING EDGE",
    viewNow: "VIEW NOW",
    joinNow: "JOIN NOW",
    cardBrandTitle: "Your edge in sports betting",
    signNow: "SIGN NOW",
    cardFootball: "FOOTBALL ODDS",
    cardFootballDesc: "Model-calibrated probabilities across top leagues — Dixon-Coles + xG.",
    cardLive: "LIVE ODDS & INSIGHTS",
    cardLiveDesc: "Real-time edge and explanations: the model updates while the match runs.",
    playNow: "PLAY NOW",
    cardApp: "BETREDGE APP",
    cardAppDesc: "The desk in your pocket. Coming soon to iOS and Android.",
    appSoon: "COMING SOON",
    risk: "Risk note: BetRedge shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management. 18+.",
    privacy: "Privacy",
  },
} as const;

// Wordmark riusabile (coerente col rebrand): Bet R edge ›
function Wordmark({ big = false }: { big?: boolean }) {
  return (
    <span className={big ? "lp-wm-big" : "am-wm"}>
      Bet<span className="r">R</span>edge<span className="chev">›</span>
    </span>
  );
}

// Mark target (stesso del desk topbar)
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="am-logo" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13" stroke="var(--am-muted)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="7" stroke="var(--am-muted)" strokeWidth="1.6" />
      <path d="M16 16 26 9.5A12 12 0 0 1 16 28Z" fill="var(--am-coral)" />
      <circle cx="16" cy="16" r="2" fill="var(--am-text)" />
    </svg>
  );
}

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("it");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const sl = localStorage.getItem("agentic-lang");
      if (sl === "it" || sl === "en") setLang(sl);
      const dt = document.documentElement.getAttribute("data-theme");
      if (dt === "light" || dt === "dark") setTheme(dt);
    } catch {}
  }, []);

  const t = COPY[lang];

  const toggleLang = () => {
    const next: Lang = lang === "it" ? "en" : "it";
    setLang(next);
    try { localStorage.setItem("agentic-lang", next); } catch {}
  };
  const setThemeMode = (mode: "dark" | "light") => {
    setTheme(mode);
    document.documentElement.setAttribute("data-theme", mode);
    try { localStorage.setItem("agentic-theme", mode); } catch {}
  };

  return (
    <div className="lp" data-mounted={mounted ? "1" : "0"}>
      <SportGlyphSprite />

      {/* ── Topnav ─────────────────────────────────────────────── */}
      <header className="lp-nav">
        <Link href="/" className="lp-brand" aria-label="BetRedge">
          <BrandMark />
          <Wordmark />
        </Link>
        <div className="lp-nav-right">
          <div className="lp-theme" role="group" aria-label="Theme">
            <button className={theme === "dark" ? "on" : ""} onClick={() => setThemeMode("dark")}>DARK</button>
            <button className={theme === "light" ? "on" : ""} onClick={() => setThemeMode("light")}>LIGHT</button>
          </div>
          <Link href="/app" className="lp-nav-link">{t.signin}</Link>
          <Link href="/app?tab=account" className="lp-nav-cta">{t.register}</Link>
          <button className="lp-lang" onClick={toggleLang}>{lang.toUpperCase()}</button>
        </div>
      </header>

      {/* ── Hero (#LANDING-HERO-IMG: immagine unica calcio+tennis con nastri energia) ── */}
      <section className="lp-hero lp-hero-img">
        <div className="lp-hero-bg" style={{ backgroundImage: "url(/banners/hero-bg.jpg)" }} aria-hidden="true" />
        <p className="lp-side-label lp-side-l">{t.leftLabel}</p>
        <div className="lp-hero-center">
          <div className="lp-hero-logo"><Wordmark big /></div>
          <h1 className="lp-tagline">
            {t.tagline.map((w, i) => (
              <span key={i} className="lp-tagword" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>{w} </span>
            ))}
          </h1>
          <div className="lp-pill">{t.pill}<span className="lp-pill-dot">▾</span></div>
        </div>
        <p className="lp-side-label lp-side-label-r lp-side-r">{t.rightLabel}</p>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <div className="lp-cta">
        <Link href="/app" className="lp-btn lp-btn-coral">{t.viewNow}</Link>
        <Link href="/app?tab=account" className="lp-btn lp-btn-cobalt">{t.joinNow}</Link>
      </div>

      {/* ── Cards (#LANDING-PHOTO: sfondo foto sport + overlay coral, logica banner) ── */}
      <section className="lp-cards">
        {/* 1 — brand */}
        <article className="lp-card lp-card-photo">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/stadium-crowd.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body lp-card-brand">
            <p className="lp-card-title">{t.cardBrandTitle}</p>
          </div>
          <Link href="/app?tab=account" className="lp-card-btn coral">{t.signNow}</Link>
        </article>

        {/* 2 — football odds */}
        <article className="lp-card lp-card-photo">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/football-ball.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body">
            <p className="lp-card-title">{t.cardFootball}</p>
            <p className="lp-card-desc">{t.cardFootballDesc}</p>
          </div>
          <Link href="/app?tab=bets&sport=football" className="lp-card-btn coral">{t.playNow}</Link>
        </article>

        {/* 3 — live odds & insights */}
        <article className="lp-card lp-card-photo">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/basket-court.jpg)" }} />
          <div className="lp-card-ov cobalt" />
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body">
            <p className="lp-card-title">{t.cardLive}</p>
            <p className="lp-card-desc">{t.cardLiveDesc}</p>
          </div>
          <Link href="/app?tab=bets" className="lp-card-btn cobalt-outline">{t.playNow}</Link>
        </article>

        {/* 4 — app */}
        <article className="lp-card lp-card-app lp-card-photo">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/stadium-night.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-phone">
            <div className="lp-phone-top"><BrandMark size={18} /><Wordmark /></div>
            <div className="lp-phone-rows">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="lp-phone-row">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><use href={i % 2 ? "#g-tball" : "#g-ball"} /></svg>
                  <span className="lp-phone-bar" /><b className="lp-phone-odd">{(1.6 + i * 0.4).toFixed(2)}</b>
                </div>
              ))}
            </div>
            <span className="lp-phone-cta">{t.cardApp}</span>
          </div>
          <span className="lp-soon">{t.appSoon}</span>
        </article>
      </section>

      {/* ── House billboard (#HOUSE-BANNERS-1) ─────────────────── */}
      {(() => {
        const camp = pickCampaign("landing", "anon");
        return camp ? (
          <section className="lp-house">
            <HouseBanner campaign={camp} lang={lang} />
          </section>
        ) : null;
      })()}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="lp-foot">
        <p>{t.risk}</p>
        <Link href="/privacy">{t.privacy}</Link>
      </footer>
    </div>
  );
}
