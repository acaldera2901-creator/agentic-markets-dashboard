"use client";

// ── BetRedge — Landing pubblica (#LANDING-BETREDGE-1) ────────────────────────
// Prima pagina su "/". Ricrea l'inspo BetRedge (hero split football/tennis,
// scie energia coral/cobalt, 4 card) interamente in CSS/SVG (nessuna foto).
// Le CTA reindirizzano nel desk su /app (deep-link ?tab=&sport=).
// Stile: dark energetico sportsbook su token --am-* + font Hanken/JetBrains.

import { useEffect, useState } from "react";
import Link from "next/link";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";

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

// Composizione "atleta + scia di energia". Silhouette in SVG + glow radiale +
// ribbon di luce. accent = "coral" (calcio) | "cobalt" (tennis).
function AthleteEnergy({ sport }: { sport: "football" | "tennis" }) {
  const coral = sport === "football";
  const c1 = coral ? "var(--am-coral)" : "var(--am-cobalt)";
  const c2 = coral ? "var(--am-coral-2)" : "var(--am-cobalt-2)";
  const gid = `g-${sport}`;
  return (
    <div className={`lp-athlete lp-athlete-${sport}`} aria-hidden="true">
      <svg viewBox="0 0 320 360" className="lp-athlete-svg" role="presentation">
        <defs>
          <radialGradient id={`${gid}-glow`} cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor={c1} stopOpacity="0.55" />
            <stop offset="45%" stopColor={c2} stopOpacity="0.18" />
            <stop offset="100%" stopColor={c2} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${gid}-streak`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} stopOpacity="0" />
            <stop offset="50%" stopColor={c1} stopOpacity="1" />
            <stop offset="100%" stopColor={c2} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* alone di energia */}
        <ellipse cx="160" cy="150" rx="150" ry="170" fill={`url(#${gid}-glow)`} />

        {/* scie di luce che avvolgono la figura */}
        <g className="lp-streaks" fill="none" stroke={`url(#${gid}-streak)`} strokeLinecap="round">
          <path d="M40 250 C 70 120, 250 120, 280 250" strokeWidth="7" opacity="0.9" />
          <path d="M55 285 C 95 95, 225 95, 265 285" strokeWidth="3.5" opacity="0.6" />
          <path d="M30 200 C 120 60, 200 60, 290 200" strokeWidth="2" opacity="0.4" />
        </g>

        {/* figura atleta — silhouette cinetica (testa + arti spessi, posa dinamica) */}
        {coral ? (
          // calciatore in falcata che colpisce il pallone
          <g className="lp-figure">
            <g stroke="var(--am-text)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M180 118 150 196" />            {/* busto inclinato */}
              <path d="M168 130 212 140" />            {/* braccio dietro */}
              <path d="M168 130 148 152 166 170" />    {/* braccio avanti piegato */}
              <path d="M150 196 176 238 158 290" />    {/* gamba d'appoggio piegata */}
              <path d="M150 196 106 226 70 252" />     {/* gamba di tiro estesa */}
            </g>
            <circle cx="187" cy="92" r="20" fill="var(--am-text)" />
            <circle cx="158" cy="300" r="15" fill="var(--am-bg)" stroke="var(--am-text)" strokeWidth="5" />
            <circle cx="158" cy="300" r="5" fill="var(--am-coral)" />
          </g>
        ) : (
          // tennista al servizio: racchetta alzata sopra la testa, affondo
          <g className="lp-figure">
            <g stroke="var(--am-text)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M160 120 168 210" />            {/* busto */}
              <path d="M160 132 136 92" />             {/* braccio del lancio in alto */}
              <path d="M160 132 190 110 214 76" />     {/* braccio racchetta piegato in alto */}
              <path d="M168 210 192 252 186 302" />    {/* gamba avanti (affondo) */}
              <path d="M168 210 136 250 114 298" />    {/* gamba dietro */}
            </g>
            <circle cx="158" cy="98" r="20" fill="var(--am-text)" />
            <g stroke="var(--am-text)" strokeWidth="6" fill="none" strokeLinecap="round">
              <path d="M214 76 228 58" />              {/* manico racchetta */}
              <ellipse cx="237" cy="46" rx="14" ry="19" transform="rotate(30 237 46)" />
            </g>
          </g>
        )}
      </svg>
    </div>
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

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-side lp-left">
          <AthleteEnergy sport="football" />
          <p className="lp-side-label">{t.leftLabel}</p>
        </div>

        <div className="lp-hero-center">
          <div className="lp-hero-logo"><Wordmark big /></div>
          <h1 className="lp-tagline">
            {t.tagline.map((w, i) => (
              <span key={i} className="lp-tagword" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>{w} </span>
            ))}
          </h1>
          <div className="lp-pill">{t.pill}<span className="lp-pill-dot">▾</span></div>
        </div>

        <div className="lp-hero-side lp-right">
          <AthleteEnergy sport="tennis" />
          <p className="lp-side-label lp-side-label-r">{t.rightLabel}</p>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <div className="lp-cta">
        <Link href="/app" className="lp-btn lp-btn-coral">{t.viewNow}</Link>
        <Link href="/app?tab=account" className="lp-btn lp-btn-cobalt">{t.joinNow}</Link>
      </div>

      {/* ── Cards ──────────────────────────────────────────────── */}
      <section className="lp-cards">
        {/* 1 — brand */}
        <article className="lp-card">
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body lp-card-brand">
            <svg className="lp-card-glyph" viewBox="0 0 24 24" aria-hidden="true"><use href="#g-bolt" /></svg>
            <p className="lp-card-title">{t.cardBrandTitle}</p>
          </div>
          <Link href="/app?tab=account" className="lp-card-btn coral">{t.signNow}</Link>
        </article>

        {/* 2 — football odds */}
        <article className="lp-card">
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body">
            <div className="lp-card-orb coral"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-ball" /></svg></div>
            <p className="lp-card-title">{t.cardFootball}</p>
            <p className="lp-card-desc">{t.cardFootballDesc}</p>
          </div>
          <Link href="/app?tab=bets&sport=football" className="lp-card-btn coral">{t.playNow}</Link>
        </article>

        {/* 3 — live odds & insights */}
        <article className="lp-card">
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body">
            <div className="lp-card-orb cobalt"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-rank" /></svg></div>
            <p className="lp-card-title">{t.cardLive}</p>
            <p className="lp-card-desc">{t.cardLiveDesc}</p>
          </div>
          <Link href="/app?tab=bets" className="lp-card-btn cobalt-outline">{t.playNow}</Link>
        </article>

        {/* 4 — app */}
        <article className="lp-card lp-card-app">
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

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="lp-foot">
        <p>{t.risk}</p>
        <Link href="/privacy">{t.privacy}</Link>
      </footer>
    </div>
  );
}
