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

type Lang = "it" | "en" | "es" | "fr" | "ru";
const LANGS: Lang[] = ["en", "it", "es", "fr", "ru"];

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
    cardFootballDesc: "Probabilità calibrate dal nostro modello sui principali campionati.",
    cardLive: "QUOTE LIVE & INSIGHTS",
    cardLiveDesc: "Edge in tempo reale e spiegazioni: il modello aggiorna mentre la partita gira.",
    playNow: "GIOCA ORA",
    cardApp: "BETREDGE APP",
    cardAppDesc: "Il desk in tasca. In arrivo su iOS e Android.",
    appSoon: "IN ARRIVO",
    spFootball: "Calcio", spTennis: "Tennis", spWorldCup: "Mondiali",
    cardTrack: "Track record", cardTrackDesc: "66.3% hit-rate · CLV verificato. Pick concluse, registrate prima dell'evento.", cardTrackBtn: "Storico",
    cardModel: "Modello vs Mercato", cardModelDesc: "Perché il modello sceglie una pick: probabilità calibrate confrontate con la quota.", cardModelBtn: "Scopri",
    cardPlans: "Piani", cardPlansDesc: "Free per provare · Base 19.90 · Pro 49.90 USDT/mese.", cardPlansBtn: "Vedi i piani",
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
    signNow: "SIGN UP",
    cardFootball: "FOOTBALL ODDS",
    cardFootballDesc: "Model-calibrated probabilities across top leagues.",
    cardLive: "LIVE ODDS & INSIGHTS",
    cardLiveDesc: "Real-time edge and explanations: the model updates while the match runs.",
    playNow: "PLAY NOW",
    cardApp: "BETREDGE APP",
    cardAppDesc: "The desk in your pocket. Coming soon to iOS and Android.",
    appSoon: "COMING SOON",
    spFootball: "Football", spTennis: "Tennis", spWorldCup: "World Cup",
    cardTrack: "Track record", cardTrackDesc: "66.3% hit-rate · verified CLV. Picks logged before kickoff.", cardTrackBtn: "History",
    cardModel: "Model vs Market", cardModelDesc: "Why the model picks a bet: calibrated probabilities against the odds.", cardModelBtn: "Discover",
    cardPlans: "Plans", cardPlansDesc: "Free to try · Base 19.90 · Pro 49.90 USDT/month.", cardPlansBtn: "See plans",
    risk: "Risk note: BetRedge shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management. 18+.",
    privacy: "Privacy",
  },
  es: {
    signin: "Entrar",
    register: "Regístrate",
    leftLabel: "CUOTAS IMBATIBLES EN FÚTBOL Y TENIS",
    rightLabel: "LA VENTAJA DEFINITIVA\nFÚTBOL Y TENIS",
    tagline: ["PREDICE.", "JUEGA.", "GANA."],
    pill: "LA VENTAJA DEFINITIVA EN LAS APUESTAS",
    viewNow: "VER AHORA",
    joinNow: "ÚNETE AHORA",
    cardBrandTitle: "Tu ventaja en las apuestas deportivas",
    signNow: "REGÍSTRATE",
    cardFootball: "CUOTAS FÚTBOL",
    cardFootballDesc: "Probabilidades calibradas por nuestro modelo en las principales ligas.",
    cardLive: "CUOTAS LIVE E INSIGHTS",
    cardLiveDesc: "Edge en tiempo real y explicaciones: el modelo se actualiza mientras corre el partido.",
    playNow: "JUEGA AHORA",
    cardApp: "BETREDGE APP",
    cardAppDesc: "El desk en tu bolsillo. Próximamente en iOS y Android.",
    appSoon: "PRÓXIMAMENTE",
    spFootball: "Fútbol", spTennis: "Tenis", spWorldCup: "Mundial",
    cardTrack: "Track record", cardTrackDesc: "66.3% de acierto · CLV verificado. Picks registrados antes del partido.", cardTrackBtn: "Historial",
    cardModel: "Modelo vs Mercado", cardModelDesc: "Por qué el modelo elige una pick: probabilidades calibradas frente a la cuota.", cardModelBtn: "Descubre",
    cardPlans: "Planes", cardPlansDesc: "Free para probar · Base 19.90 · Pro 49.90 USDT/mes.", cardPlansBtn: "Ver planes",
    risk: "Nota de riesgo: BetRedge muestra análisis probabilísticos. No garantiza beneficios y no sustituye la gestión personal del riesgo. 18+.",
    privacy: "Privacidad",
  },
  fr: {
    signin: "Se connecter",
    register: "S'inscrire",
    leftLabel: "DES COTES IMBATTABLES SUR LE FOOTBALL & LE TENNIS",
    rightLabel: "L'AVANTAGE ULTIME\nFOOTBALL & TENNIS",
    tagline: ["PRÉDIS.", "JOUE.", "GAGNE."],
    pill: "L'AVANTAGE ULTIME DANS LES PARIS",
    viewNow: "VOIR MAINTENANT",
    joinNow: "REJOINDRE",
    cardBrandTitle: "Ton avantage dans les paris sportifs",
    signNow: "S'INSCRIRE",
    cardFootball: "COTES FOOTBALL",
    cardFootballDesc: "Probabilités calibrées par notre modèle sur les principaux championnats.",
    cardLive: "COTES LIVE & INSIGHTS",
    cardLiveDesc: "Edge en temps réel et explications : le modèle se met à jour pendant le match.",
    playNow: "JOUE MAINTENANT",
    cardApp: "BETREDGE APP",
    cardAppDesc: "Le desk dans ta poche. Bientôt sur iOS et Android.",
    appSoon: "BIENTÔT",
    spFootball: "Football", spTennis: "Tennis", spWorldCup: "Coupe du Monde",
    cardTrack: "Track record", cardTrackDesc: "66,3% de réussite · CLV vérifié. Pronostics enregistrés avant le match.", cardTrackBtn: "Historique",
    cardModel: "Modèle vs Marché", cardModelDesc: "Pourquoi le modèle choisit un pari : probabilités calibrées face à la cote.", cardModelBtn: "Découvrir",
    cardPlans: "Offres", cardPlansDesc: "Free pour essayer · Base 19.90 · Pro 49.90 USDT/mois.", cardPlansBtn: "Voir les offres",
    risk: "Note de risque : BetRedge montre des analyses probabilistes. Elle ne garantit pas de profits et ne remplace pas la gestion personnelle du risque. 18+.",
    privacy: "Confidentialité",
  },
  ru: {
    signin: "Войти",
    register: "Регистрация",
    leftLabel: "НЕПОБЕДИМЫЕ КОЭФФИЦИЕНТЫ НА ФУТБОЛ И ТЕННИС",
    rightLabel: "АБСОЛЮТНОЕ ПРЕИМУЩЕСТВО\nФУТБОЛ И ТЕННИС",
    tagline: ["ПРОГНОЗИРУЙ.", "ИГРАЙ.", "ВЫИГРЫВАЙ."],
    pill: "АБСОЛЮТНОЕ ПРЕИМУЩЕСТВО В СТАВКАХ",
    viewNow: "СМОТРЕТЬ",
    joinNow: "ПРИСОЕДИНИТЬСЯ",
    cardBrandTitle: "Твоё преимущество в ставках на спорт",
    signNow: "РЕГИСТРАЦИЯ",
    cardFootball: "КОЭФФИЦИЕНТЫ ФУТБОЛ",
    cardFootballDesc: "Вероятности, откалиброванные нашей моделью по топ-лигам.",
    cardLive: "LIVE КОЭФФИЦИЕНТЫ И ИНСАЙТЫ",
    cardLiveDesc: "Edge в реальном времени и объяснения: модель обновляется во время матча.",
    playNow: "ИГРАТЬ",
    cardApp: "BETREDGE APP",
    cardAppDesc: "Desk в твоём кармане. Скоро на iOS и Android.",
    appSoon: "СКОРО",
    spFootball: "Футбол", spTennis: "Теннис", spWorldCup: "ЧМ",
    cardTrack: "Track record", cardTrackDesc: "66.3% попаданий · проверенный CLV. Прогнозы фиксируются до начала.", cardTrackBtn: "История",
    cardModel: "Модель vs Рынок", cardModelDesc: "Почему модель выбирает ставку: калиброванные вероятности против коэффициента.", cardModelBtn: "Узнать",
    cardPlans: "Тарифы", cardPlansDesc: "Free для пробы · Base 19.90 · Pro 49.90 USDT/мес.", cardPlansBtn: "Тарифы",
    risk: "Примечание о риске: BetRedge показывает вероятностный анализ. Он не гарантирует прибыль и не заменяет личное управление рисками. 18+.",
    privacy: "Конфиденциальность",
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
      <path d="M5 21A11 11 0 0 1 27 21" stroke="var(--am-muted)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 21A11 11 0 0 1 9.2 13.2" stroke="var(--am-coral)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="21" x2="23.5" y2="12.5" stroke="var(--am-coral)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2.2" fill="var(--am-coral)" />
    </svg>
  );
}

// #HOME-SPORTS-1: la topnav è auth-aware (come SiteTopbar). Se loggato mostra il
// nome utente + piano; se anonimo, Sign In / Register.
type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authed"; identifier: string; plan: string; name: string | null };
function planPillLabel(plan: string): string {
  if (["base", "premium", "admin_full"].includes(plan)) return "PRO";
  if (plan === "free") return "FREE";
  return "SETUP";
}

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    setMounted(true);
    try {
      const sl = localStorage.getItem("agentic-lang");
      if (sl && (LANGS as string[]).includes(sl)) setLang(sl as Lang);
      const dt = document.documentElement.getAttribute("data-theme");
      if (dt === "light" || dt === "dark") setTheme(dt);
    } catch {}
  }, []);

  // Auth-aware topnav: chiede a /api/auth (stessa chiamata del desk) e mostra
  // il nome utente solo se loggato; altrimenti i link Sign In / Register.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/auth", { credentials: "same-origin", cache: "no-store" });
        if (cancelled) return;
        if (resp.ok) {
          const data = await resp.json();
          setAuth({
            status: "authed",
            identifier: String(data.identifier ?? ""),
            plan: String(data.plan ?? ""),
            name: data.name ? String(data.name) : null,
          });
        } else {
          setAuth({ status: "anonymous" });
        }
      } catch {
        if (!cancelled) setAuth({ status: "anonymous" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const t = COPY[lang];

  const toggleLang = () => {
    const next: Lang = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length];
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
          {auth.status === "authed" ? (
            <Link href="/app?tab=account" className="am-acct" title={auth.identifier}>
              {auth.name || auth.identifier}<span className="plan">{planPillLabel(auth.plan)}</span>
            </Link>
          ) : auth.status === "anonymous" ? (
            <>
              <Link href="/app" className="lp-nav-link">{t.signin}</Link>
              <Link href="/app?tab=account" className="lp-nav-cta">{t.register}</Link>
            </>
          ) : null /* loading: niente flicker di stato errato */}
          <button className="lp-lang" onClick={toggleLang}>{lang.toUpperCase()}</button>
        </div>
      </header>

      {/* ── Hero (#HOME-SPORTS-1: immagine "All Sports" ricreata senza i loghi vecchi.
           Ancorata in alto (teste salve) + accorciata; gli sport sono una barra
           cliccabile attaccata SOTTO l'immagine — continua col banner. ── */}
      <section className="lp-hero lp-hero-img">
        <div className="lp-hero-bg" style={{ backgroundImage: "url(/banners/hero-allsports.jpg)" }} role="img" aria-label="BetRedge — All Sports" />
      </section>
      <nav className="lp-hero-sports" aria-label="Sports">
        <Link href="/app?tab=bets&sport=football" className="lp-sport">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-ball" /></svg>
          <b>{t.spFootball}</b>
        </Link>
        <Link href="/app?tab=bets&sport=tennis" className="lp-sport">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-tball" /></svg>
          <b>{t.spTennis}</b>
        </Link>
        <Link href="/world-cup" className="lp-sport">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#g-trophy" /></svg>
          <b>{t.spWorldCup}</b><span className="lp-sport-live">LIVE</span>
        </Link>
      </nav>

      {/* ── Cards (#LANDING-PHOTO: sfondo foto sport + overlay coral, logica banner) ── */}
      <section className="lp-cards">
        {/* 1 — track record (prova reale, FTC) */}
        <article className="lp-card lp-card-photo">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/card-track.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body">
            <p className="lp-card-title">{t.cardTrack}</p>
            <p className="lp-card-desc">{t.cardTrackDesc}</p>
          </div>
          <Link href="/app?tab=history" className="lp-card-btn coral">{t.cardTrackBtn}</Link>
        </article>

        {/* 2 — modello vs mercato */}
        <article className="lp-card lp-card-photo">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/card-model.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body">
            <p className="lp-card-title">{t.cardModel}</p>
            <p className="lp-card-desc">{t.cardModelDesc}</p>
          </div>
          <Link href="/app?tab=bets" className="lp-card-btn coral">{t.cardModelBtn}</Link>
        </article>

        {/* 3 — piani */}
        <article className="lp-card lp-card-photo">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/card-plans.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body">
            <p className="lp-card-title">{t.cardPlans}</p>
            <p className="lp-card-desc">{t.cardPlansDesc}</p>
          </div>
          <Link href="/app?tab=account" className="lp-card-btn cobalt-outline">{t.cardPlansBtn}</Link>
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
