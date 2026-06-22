"use client";

// ── BetRedge — Landing pubblica (#LANDING-BETREDGE-1) ────────────────────────
// Prima pagina su "/". Ricrea l'inspo BetRedge (hero split football/tennis,
// scie energia coral/cobalt, 4 card) interamente in CSS/SVG (nessuna foto).
// Le CTA reindirizzano nel desk su /app (deep-link ?tab=&sport=).
// Stile: dark energetico sportsbook su token --am-* + font Hanken/JetBrains.

import { useEffect, useState } from "react";
import Link from "next/link";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";
import { SportIcon } from "@/app/components/sport-icon";
import { HouseBanner } from "@/components/HouseBanner";
import { pickCampaign } from "@/lib/house-banners";
import LangDropdown from "@/components/LangDropdown";

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
    spAllSports: "Tutti gli sport", spFootball: "Calcio", spTennis: "Tennis", spWorldCup: "Mondiali",
    cardTrackTag: "La prova", cardTrack: "Track record", cardTrackDesc: "66.3% hit-rate · CLV verificato. Pick concluse, registrate prima dell'evento.", cardTrackBtn: "Storico",
    cardModel: "Modello vs Mercato", cardModelDesc: "Perché il modello sceglie una pick: probabilità calibrate confrontate con la quota.", cardModelBtn: "Scopri",
    cardPlans: "Piani", cardPlansDesc: "Free per provare · Base 19.90 · Pro 49.90 USDT/mese.", cardPlansBtn: "Vedi i piani",
    risk: "Nota rischio: BetRedge mostra analisi probabilistiche. Non garantisce profitti e non sostituisce la gestione del rischio personale. 18+.",
    privacy: "Privacy",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "MOTORE DI PROBABILITÀ · NON UN BOOKMAKER",
    waHead1: "La previsione reale di ogni partita.",
    waHead2: "Prima che si muova il mercato.",
    waBody: "BetRedge legge calcio, tennis e Mondiali con un modello che calibra le probabilità e le confronta con la quota — così vedi dove c'è valore. Niente hype: ogni pick è spiegata, ogni esito è registrato. La decisione resta tua.",
    waKpi1Lab: "hit-rate", waKpi2Lab: "edge medio", waKpi3Val: "Tracciato", waKpi3Lab: "CLV verificato",
    waCta: "Inizia gratis",
    // mini readout artifact
    waReadMatch: "Esempio · esito modellato",
    waReadModel: "Modello", waReadMarket: "Mercato implicito", waReadEdge: "valore",
    // ── How it works ──
    hwEyebrow: "COME FUNZIONA",
    hwHead: "Dal segnale alla tua decisione.",
    hwS1: "Segnale", hwS1Desc: "Gli agenti scansionano le partite e isolano dove il modello diverge dalla quota.",
    hwS2: "Spiegazione", hwS2Desc: "Vedi probabilità, quota ed edge — e il perché in chiaro. Nessuna scatola nera.",
    hwS3: "Decisione", hwS3Desc: "Decidi tu. BetRedge non piazza nulla al posto tuo: nessuna esecuzione automatica.",
    hwS4: "Verifica", hwS4Desc: "Ogni pick è registrata prima dell'evento → diventa track record verificabile.",
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
    spAllSports: "All Sports", spFootball: "Football", spTennis: "Tennis", spWorldCup: "World Cup",
    cardTrackTag: "The proof", cardTrack: "Track record", cardTrackDesc: "66.3% hit-rate · verified CLV. Picks logged before kickoff.", cardTrackBtn: "History",
    cardModel: "Model vs Market", cardModelDesc: "Why the model picks a bet: calibrated probabilities against the odds.", cardModelBtn: "Discover",
    cardPlans: "Plans", cardPlansDesc: "Free to try · Base 19.90 · Pro 49.90 USDT/month.", cardPlansBtn: "See plans",
    risk: "Risk note: BetRedge shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management. 18+.",
    privacy: "Privacy",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "PROBABILITY ENGINE · NOT A BOOKMAKER",
    waHead1: "The real prediction for every match.",
    waHead2: "Before the market moves.",
    waBody: "BetRedge reads football, tennis and the World Cup with a model that calibrates probabilities and lines them up against the odds — so you see where the value is. No hype: every pick is explained, every outcome is logged. The call stays yours.",
    waKpi1Lab: "hit-rate", waKpi2Lab: "avg edge", waKpi3Val: "Tracked", waKpi3Lab: "verified CLV",
    waCta: "Start free",
    waReadMatch: "Example · modelled outcome",
    waReadModel: "Model", waReadMarket: "Market implied", waReadEdge: "value",
    // ── How it works ──
    hwEyebrow: "HOW IT WORKS",
    hwHead: "From signal to your call.",
    hwS1: "Signal", hwS1Desc: "Agents scan the fixtures and isolate where the model diverges from the price.",
    hwS2: "Explain", hwS2Desc: "See probability, odds and edge — and the why, in plain terms. No black box.",
    hwS3: "Decide", hwS3Desc: "You decide. BetRedge places nothing for you: no automatic execution.",
    hwS4: "Track", hwS4Desc: "Every pick is logged before the event → it becomes a verifiable track record.",
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
    spAllSports: "Todos los deportes", spFootball: "Fútbol", spTennis: "Tenis", spWorldCup: "Mundial",
    cardTrackTag: "La prueba", cardTrack: "Track record", cardTrackDesc: "66.3% de acierto · CLV verificado. Picks registrados antes del partido.", cardTrackBtn: "Historial",
    cardModel: "Modelo vs Mercado", cardModelDesc: "Por qué el modelo elige una pick: probabilidades calibradas frente a la cuota.", cardModelBtn: "Descubre",
    cardPlans: "Planes", cardPlansDesc: "Free para probar · Base 19.90 · Pro 49.90 USDT/mes.", cardPlansBtn: "Ver planes",
    risk: "Nota de riesgo: BetRedge muestra análisis probabilísticos. No garantiza beneficios y no sustituye la gestión personal del riesgo. 18+.",
    privacy: "Privacidad",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "MOTOR DE PROBABILIDAD · NO UN BOOKMAKER",
    waHead1: "La predicción real de cada partido.",
    waHead2: "Antes de que se mueva el mercado.",
    waBody: "BetRedge lee fútbol, tenis y el Mundial con un modelo que calibra las probabilidades y las compara con la cuota — para que veas dónde hay valor. Sin hype: cada pick se explica, cada resultado se registra. La decisión es tuya.",
    waKpi1Lab: "acierto", waKpi2Lab: "edge medio", waKpi3Val: "Registrado", waKpi3Lab: "CLV verificado",
    waCta: "Empieza gratis",
    waReadMatch: "Ejemplo · resultado modelado",
    waReadModel: "Modelo", waReadMarket: "Implícito del mercado", waReadEdge: "valor",
    // ── How it works ──
    hwEyebrow: "CÓMO FUNCIONA",
    hwHead: "De la señal a tu decisión.",
    hwS1: "Señal", hwS1Desc: "Los agentes escanean los partidos y aíslan dónde el modelo difiere de la cuota.",
    hwS2: "Explicación", hwS2Desc: "Ves probabilidad, cuota y edge — y el porqué, en claro. Sin caja negra.",
    hwS3: "Decisión", hwS3Desc: "Tú decides. BetRedge no apuesta por ti: sin ejecución automática.",
    hwS4: "Registro", hwS4Desc: "Cada pick se registra antes del evento → se vuelve un track record verificable.",
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
    spAllSports: "Tous les sports", spFootball: "Football", spTennis: "Tennis", spWorldCup: "Coupe du Monde",
    cardTrackTag: "La preuve", cardTrack: "Track record", cardTrackDesc: "66,3% de réussite · CLV vérifié. Pronostics enregistrés avant le match.", cardTrackBtn: "Historique",
    cardModel: "Modèle vs Marché", cardModelDesc: "Pourquoi le modèle choisit un pari : probabilités calibrées face à la cote.", cardModelBtn: "Découvrir",
    cardPlans: "Offres", cardPlansDesc: "Free pour essayer · Base 19.90 · Pro 49.90 USDT/mois.", cardPlansBtn: "Voir les offres",
    risk: "Note de risque : BetRedge montre des analyses probabilistes. Elle ne garantit pas de profits et ne remplace pas la gestion personnelle du risque. 18+.",
    privacy: "Confidentialité",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "MOTEUR DE PROBABILITÉ · PAS UN BOOKMAKER",
    waHead1: "La vraie prévision de chaque match.",
    waHead2: "Avant que le marché ne bouge.",
    waBody: "BetRedge lit le football, le tennis et la Coupe du Monde avec un modèle qui calibre les probabilités et les confronte à la cote — pour que tu voies où est la valeur. Sans hype : chaque pronostic est expliqué, chaque résultat est enregistré. Le choix reste le tien.",
    waKpi1Lab: "réussite", waKpi2Lab: "edge moyen", waKpi3Val: "Suivi", waKpi3Lab: "CLV vérifié",
    waCta: "Commencer gratuitement",
    waReadMatch: "Exemple · résultat modélisé",
    waReadModel: "Modèle", waReadMarket: "Implicite du marché", waReadEdge: "valeur",
    // ── How it works ──
    hwEyebrow: "COMMENT ÇA MARCHE",
    hwHead: "Du signal à ta décision.",
    hwS1: "Signal", hwS1Desc: "Les agents scannent les matchs et isolent où le modèle s'écarte de la cote.",
    hwS2: "Explication", hwS2Desc: "Tu vois probabilité, cote et edge — et le pourquoi, en clair. Pas de boîte noire.",
    hwS3: "Décision", hwS3Desc: "Tu décides. BetRedge ne parie rien à ta place : aucune exécution automatique.",
    hwS4: "Suivi", hwS4Desc: "Chaque pronostic est enregistré avant l'événement → il devient un track record vérifiable.",
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
    spAllSports: "Все виды спорта", spFootball: "Футбол", spTennis: "Теннис", spWorldCup: "ЧМ",
    cardTrackTag: "Доказательство", cardTrack: "Track record", cardTrackDesc: "66.3% попаданий · проверенный CLV. Прогнозы фиксируются до начала.", cardTrackBtn: "История",
    cardModel: "Модель vs Рынок", cardModelDesc: "Почему модель выбирает ставку: калиброванные вероятности против коэффициента.", cardModelBtn: "Узнать",
    cardPlans: "Тарифы", cardPlansDesc: "Free для пробы · Base 19.90 · Pro 49.90 USDT/мес.", cardPlansBtn: "Тарифы",
    risk: "Примечание о риске: BetRedge показывает вероятностный анализ. Он не гарантирует прибыль и не заменяет личное управление рисками. 18+.",
    privacy: "Конфиденциальность",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "ДВИЖОК ВЕРОЯТНОСТЕЙ · НЕ БУКМЕКЕР",
    waHead1: "Реальный прогноз на каждый матч.",
    waHead2: "Раньше, чем сдвинется рынок.",
    waBody: "BetRedge анализирует футбол, теннис и ЧМ моделью, которая калибрует вероятности и сопоставляет их с коэффициентом — чтобы ты видел, где ценность. Без хайпа: каждый прогноз объяснён, каждый исход зафиксирован. Решение остаётся за тобой.",
    waKpi1Lab: "попаданий", waKpi2Lab: "ср. edge", waKpi3Val: "Отслеж.", waKpi3Lab: "проверенный CLV",
    waCta: "Начать бесплатно",
    waReadMatch: "Пример · смоделированный исход",
    waReadModel: "Модель", waReadMarket: "Подразум. рынком", waReadEdge: "ценность",
    // ── How it works ──
    hwEyebrow: "КАК ЭТО РАБОТАЕТ",
    hwHead: "От сигнала к твоему решению.",
    hwS1: "Сигнал", hwS1Desc: "Агенты сканируют матчи и выделяют, где модель расходится с коэффициентом.",
    hwS2: "Объяснение", hwS2Desc: "Видишь вероятность, коэффициент и edge — и причину, понятно. Без чёрного ящика.",
    hwS3: "Решение", hwS3Desc: "Решаешь ты. BetRedge ничего не ставит за тебя: без автоисполнения.",
    hwS4: "Учёт", hwS4Desc: "Каждый прогноз фиксируется до события → становится проверяемым track record.",
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

  const selectLang = (next: Lang) => {
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
            <a href="/app?tab=account" className="am-acct" title={auth.identifier}>
              {auth.name || auth.identifier}<span className="plan">{planPillLabel(auth.plan)}</span>
            </a>
          ) : auth.status === "anonymous" ? (
            <>
              <a href="/app?auth=login" className="lp-nav-link">{t.signin}</a>
              <a href="/app?auth=register" className="lp-nav-cta">{t.register}</a>
            </>
          ) : null /* loading: niente flicker di stato errato */}
          <LangDropdown value={lang} onSelect={selectLang} variant="landing" />
        </div>
      </header>

      {/* ── Hero (#HOME-SPORTS-1: immagine "All Sports" ricreata senza i loghi vecchi.
           Ancorata in alto (teste salve) + accorciata; gli sport sono una barra
           cliccabile attaccata SOTTO l'immagine — continua col banner. ── */}
      <section className="lp-hero lp-hero-img">
        <div className="lp-hero-bg" style={{ backgroundImage: "url(/banners/hero-allsports.jpg)" }} role="img" aria-label="BetRedge — All Sports" />
      </section>
      <nav className="lp-hero-sports" aria-label="Sports">
        <a href="/app?tab=bets&sport=all" className="lp-sport">
          <span className="lp-sport-well"><img className="lp-sport-img" src="/banners/sport-allsports.png" alt="" /></span>
          <b className="lp-sport-lab">{t.spAllSports}</b>
          <svg className="lp-sport-arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
        <a href="/app?tab=bets&sport=football" className="lp-sport">
          <span className="lp-sport-well"><img className="lp-sport-img" src="/banners/sport-football.png" alt="" /></span>
          <b className="lp-sport-lab">{t.spFootball}</b>
          <svg className="lp-sport-arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
        <a href="/app?tab=bets&sport=tennis" className="lp-sport">
          <span className="lp-sport-well"><img className="lp-sport-img" src="/banners/sport-tennis.png" alt="" /></span>
          <b className="lp-sport-lab">{t.spTennis}</b>
          <svg className="lp-sport-arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
        <Link href="/world-cup" className="lp-sport lp-sport-feat">
          <span className="lp-sport-well"><img className="lp-sport-img" src="/banners/sport-worldcup.png" alt="" /></span>
          <b className="lp-sport-lab">{t.spWorldCup}</b>
          <span className="lp-sport-live"><i className="lp-sport-dot" />LIVE</span>
          <svg className="lp-sport-arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      </nav>

      {/* ── What is BetRedge (#HOME-VALUEPROP-1) — split editoriale asimmetrico:
           a sinistra cosa È il prodotto, a destra un readout reale modello-vs-mercato
           (artefatto specifico, niente stock/icone). Un solo accent coral. ── */}
      <section className="lp-what">
        <div className="lp-what-copy">
          <p className="lp-eyebrow">{t.waEyebrow}</p>
          <h2 className="lp-what-head">
            {t.waHead1}<br /><span className="lp-what-head-2">{t.waHead2}</span>
          </h2>
          <p className="lp-what-body">{t.waBody}</p>
          <div className="lp-kpis">
            <div className="lp-kpi">
              <b className="lp-kpi-val">66.3<span className="lp-kpi-unit">%</span></b>
              <span className="lp-kpi-lab">{t.waKpi1Lab}</span>
            </div>
            <div className="lp-kpi">
              <b className="lp-kpi-val accent">+7.9<span className="lp-kpi-unit">pt</span></b>
              <span className="lp-kpi-lab">{t.waKpi2Lab}</span>
            </div>
            <div className="lp-kpi">
              <b className="lp-kpi-val">{t.waKpi3Val}</b>
              <span className="lp-kpi-lab">{t.waKpi3Lab}</span>
            </div>
          </div>
          <a href="/app?tab=account" className="lp-what-cta">{t.waCta}<span aria-hidden="true">→</span></a>
        </div>

        {/* readout: probabilità modello vs implicita di mercato → valore */}
        <figure className="lp-readout" aria-label={t.waReadMatch}>
          <figcaption className="lp-readout-cap">{t.waReadMatch}</figcaption>
          <div className="lp-readout-match">
            <span className="lp-readout-teams">Real Madrid <em>vs</em> Barcelona</span>
            <span className="lp-readout-pick">Real Madrid</span>
          </div>
          <div className="lp-readout-row">
            <span className="lp-readout-lab">{t.waReadModel}</span>
            <span className="lp-readout-bar"><i className="model" style={{ width: "64%" }} /></span>
            <b className="lp-readout-num accent">64%</b>
          </div>
          <div className="lp-readout-row">
            <span className="lp-readout-lab">{t.waReadMarket}</span>
            <span className="lp-readout-bar"><i className="market" style={{ width: "56%" }} /></span>
            <b className="lp-readout-num">56%</b>
          </div>
          <div className="lp-readout-edge">
            <span className="lp-readout-edge-lab">{t.waReadEdge}</span>
            <b className="lp-readout-edge-val">+8.0 pt</b>
          </div>
        </figure>
      </section>

      {/* ── How it works (#HOME-HOWITWORKS-1) — flusso connesso a 4 step
           (Signal → Explain → Decide → Track), non 4 card-icona identiche.
           Step numerati su una riga di connessione, glifi brand reali. ── */}
      <section className="lp-how">
        <header className="lp-how-head">
          <p className="lp-eyebrow">{t.hwEyebrow}</p>
          <h2 className="lp-how-title">{t.hwHead}</h2>
        </header>
        <ol className="lp-steps">
          <li className="lp-step">
            <div className="lp-step-mark"><span className="lp-step-n">01</span><svg className="lp-step-glyph" viewBox="0 0 24 24" aria-hidden="true"><use href="#g-search" /></svg></div>
            <h3 className="lp-step-title">{t.hwS1}</h3>
            <p className="lp-step-desc">{t.hwS1Desc}</p>
          </li>
          <li className="lp-step">
            <div className="lp-step-mark"><span className="lp-step-n">02</span><svg className="lp-step-glyph" viewBox="0 0 24 24" aria-hidden="true"><use href="#g-bolt" /></svg></div>
            <h3 className="lp-step-title">{t.hwS2}</h3>
            <p className="lp-step-desc">{t.hwS2Desc}</p>
          </li>
          <li className="lp-step">
            <div className="lp-step-mark"><span className="lp-step-n">03</span><svg className="lp-step-glyph" viewBox="0 0 24 24" aria-hidden="true"><use href="#g-pick" /></svg></div>
            <h3 className="lp-step-title">{t.hwS3}</h3>
            <p className="lp-step-desc">{t.hwS3Desc}</p>
          </li>
          <li className="lp-step">
            <div className="lp-step-mark"><span className="lp-step-n">04</span><svg className="lp-step-glyph" viewBox="0 0 24 24" aria-hidden="true"><use href="#g-history" /></svg></div>
            <h3 className="lp-step-title">{t.hwS4}</h3>
            <p className="lp-step-desc">{t.hwS4Desc}</p>
          </li>
        </ol>
      </section>

      {/* ── Cards (#LANDING-PHOTO: sfondo foto sport + overlay coral, logica banner) ── */}
      <section className="lp-cards">
        {/* 1 — track record (prova reale, FTC) → tile DOMINANTE: è la nostra prova.
             Span 2 righe a sinistra, titolo più grande, eyebrow + metrica reale. */}
        <article className="lp-card lp-card-photo lp-card-hero">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/card-track.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-card-head"><BrandMark size={26} /><Wordmark /></div>
          <div className="lp-card-body">
            <p className="lp-card-eyebrow">{t.cardTrackTag}</p>
            <p className="lp-card-title">{t.cardTrack}</p>
            <p className="lp-card-desc">{t.cardTrackDesc}</p>
          </div>
          <a href="/app?tab=history" className="lp-card-btn coral">{t.cardTrackBtn}</a>
        </article>

        {/* 2 — modello vs mercato (tile larga, riga 1) */}
        <article className="lp-card lp-card-photo lp-card-wide">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/card-model.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-card-head"><BrandMark size={22} /><Wordmark /></div>
          <div className="lp-card-body">
            <p className="lp-card-title">{t.cardModel}</p>
            <p className="lp-card-desc">{t.cardModelDesc}</p>
          </div>
          <a href="/app?tab=bets" className="lp-card-btn coral">{t.cardModelBtn}</a>
        </article>

        {/* 3 — piani (tile compatta, riga 2 · trattamento più sobrio = gerarchia) */}
        <article className="lp-card lp-card-photo lp-card-sm lp-card-quiet">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/card-plans.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-card-head"><BrandMark size={22} /><Wordmark /></div>
          <div className="lp-card-body">
            <p className="lp-card-title">{t.cardPlans}</p>
            <p className="lp-card-desc">{t.cardPlansDesc}</p>
          </div>
          <a href="/app?tab=account" className="lp-card-btn cobalt-outline">{t.cardPlansBtn}</a>
        </article>

        {/* 4 — app (tile compatta, riga 2) */}
        <article className="lp-card lp-card-app lp-card-photo lp-card-sm">
          <div className="lp-card-bg" style={{ backgroundImage: "url(/banners/stadium-night.jpg)" }} />
          <div className="lp-card-ov coral" />
          <div className="lp-phone">
            <div className="lp-phone-top"><BrandMark size={18} /><Wordmark /></div>
            <div className="lp-phone-rows">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="lp-phone-row">
                  <SportIcon sport={i % 2 ? "tennis" : "football"} size={15} variant="sm" />
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
