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
import LandingCarousel from "@/app/components/LandingCarousel"; // #HOME-BETMODE-1
import { HouseBanner } from "@/components/HouseBanner";
import { pickCampaign } from "@/lib/house-banners";
import LangDropdown from "@/components/LangDropdown";
import { SiteFooter } from "@/components/SiteFooter";
import { LiveChat } from "@/components/LiveChat";
import { HomeAuthModal, type HomeAuthIntent } from "@/components/auth/HomeAuthModal";

type Lang = "it" | "en" | "es" | "fr" | "ru";
const LANGS: Lang[] = ["en", "it", "es", "fr", "ru"];

const COPY = {
  it: {
    signin: "Accedi",
    register: "Registrati",
    logout: "Esci",
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
    // ── Edge Scanner (value-prop) ──
    waEyebrow: "MOTORE DI PROBABILITÀ · NON UN BOOKMAKER",
    waHead1: "Il modello legge ogni partita.",
    waHead2: "Tu vedi solo l'edge.",
    waBody: "Calcio, tennis e Mondiali passano nel modello: probabilità calibrate confrontate con la quota del bookmaker. Dove divergono, è il tuo edge. Ogni pick è spiegata e registrata prima del fischio.",
    waKpi1Lab: "hit-rate", waKpi2Lab: "edge medio", waKpi3Val: "Tracciato", waKpi3Lab: "CLV verificato",
    waCta: "Inizia gratis",
    waCtaSub: "Senza carta",
    // terminale edge_scanner — header colonne + stati + footer
    waColMatch: "Match", waReadModel: "Model", waReadMarket: "Market", waReadEdge: "Edge",
    waScanLive: "live", waScanExample: "esempio", waScanning: "scanning",
    waTermAllExample: "Esempio · output del modello",
    waTagExample: "esempio",
    waFootReal: "Riga in alto: dato reale di oggi · le altre illustrano il formato",
    waFootExample: "Output illustrativo del modello · dati reali nel desk",
    waFootEvents: (n: number, e: number) => `${n} eventi · ${e} con edge`,
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
    logout: "Logout",
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
    waHead1: "The model reads every match.",
    waHead2: "You only see the edge.",
    waBody: "Football, tennis and the World Cup run through the model: calibrated probabilities lined up against the bookmaker's odds. Where they diverge, that's your edge. Every pick is explained and logged before kick-off.",
    waKpi1Lab: "hit-rate", waKpi2Lab: "avg edge", waKpi3Val: "Tracked", waKpi3Lab: "verified CLV",
    waCta: "Start free",
    waCtaSub: "No card",
    waColMatch: "Match", waReadModel: "Model", waReadMarket: "Market", waReadEdge: "Edge",
    waScanLive: "live", waScanExample: "example", waScanning: "scanning",
    waTermAllExample: "Example · model output",
    waTagExample: "example",
    waFootReal: "Top row: today's real data · the rest illustrate the format",
    waFootExample: "Illustrative model output · live data in the desk",
    waFootEvents: (n: number, e: number) => `${n} events · ${e} with edge`,
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
    logout: "Salir",
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
    waHead1: "El modelo lee cada partido.",
    waHead2: "Tú solo ves el edge.",
    waBody: "Fútbol, tenis y el Mundial pasan por el modelo: probabilidades calibradas frente a la cuota del bookmaker. Donde divergen, ahí está tu edge. Cada pick se explica y se registra antes del pitido.",
    waKpi1Lab: "acierto", waKpi2Lab: "edge medio", waKpi3Val: "Registrado", waKpi3Lab: "CLV verificado",
    waCta: "Empieza gratis",
    waCtaSub: "Sin tarjeta",
    waColMatch: "Match", waReadModel: "Model", waReadMarket: "Market", waReadEdge: "Edge",
    waScanLive: "live", waScanExample: "ejemplo", waScanning: "scanning",
    waTermAllExample: "Ejemplo · salida del modelo",
    waTagExample: "ejemplo",
    waFootReal: "Fila superior: dato real de hoy · las demás ilustran el formato",
    waFootExample: "Salida ilustrativa del modelo · datos reales en el desk",
    waFootEvents: (n: number, e: number) => `${n} eventos · ${e} con edge`,
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
    logout: "Quitter",
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
    waHead1: "Le modèle lit chaque match.",
    waHead2: "Tu ne vois que l'edge.",
    waBody: "Football, tennis et Coupe du Monde passent dans le modèle : des probabilités calibrées confrontées à la cote du bookmaker. Là où elles divergent, c'est ton edge. Chaque pronostic est expliqué et enregistré avant le coup d'envoi.",
    waKpi1Lab: "réussite", waKpi2Lab: "edge moyen", waKpi3Val: "Suivi", waKpi3Lab: "CLV vérifié",
    waCta: "Commencer gratuitement",
    waCtaSub: "Sans carte",
    waColMatch: "Match", waReadModel: "Model", waReadMarket: "Market", waReadEdge: "Edge",
    waScanLive: "live", waScanExample: "exemple", waScanning: "scanning",
    waTermAllExample: "Exemple · sortie du modèle",
    waTagExample: "exemple",
    waFootReal: "Ligne du haut : donnée réelle du jour · les autres illustrent le format",
    waFootExample: "Sortie illustrative du modèle · données réelles dans le desk",
    waFootEvents: (n: number, e: number) => `${n} événements · ${e} avec edge`,
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
    logout: "Выйти",
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
    waHead1: "Модель читает каждый матч.",
    waHead2: "Ты видишь только edge.",
    waBody: "Футбол, теннис и ЧМ проходят через модель: калиброванные вероятности сопоставляются с коэффициентом букмекера. Там, где они расходятся, — твой edge. Каждый прогноз объяснён и зафиксирован до свистка.",
    waKpi1Lab: "попаданий", waKpi2Lab: "ср. edge", waKpi3Val: "Отслеж.", waKpi3Lab: "проверенный CLV",
    waCta: "Начать бесплатно",
    waCtaSub: "Без карты",
    waColMatch: "Match", waReadModel: "Model", waReadMarket: "Market", waReadEdge: "Edge",
    waScanLive: "live", waScanExample: "пример", waScanning: "scanning",
    waTermAllExample: "Пример · вывод модели",
    waTagExample: "пример",
    waFootReal: "Верхняя строка: реальные данные сегодня · остальные показывают формат",
    waFootExample: "Иллюстративный вывод модели · реальные данные в деске",
    waFootEvents: (n: number, e: number) => `${n} событий · ${e} с edge`,
    // ── How it works ──
    hwEyebrow: "КАК ЭТО РАБОТАЕТ",
    hwHead: "От сигнала к твоему решению.",
    hwS1: "Сигнал", hwS1Desc: "Агенты сканируют матчи и выделяют, где модель расходится с коэффициентом.",
    hwS2: "Объяснение", hwS2Desc: "Видишь вероятность, коэффициент и edge — и причину, понятно. Без чёрного ящика.",
    hwS3: "Решение", hwS3Desc: "Решаешь ты. BetRedge ничего не ставит за тебя: без автоисполнения.",
    hwS4: "Учёт", hwS4Desc: "Каждый прогноз фиксируется до события → становится проверяемым track record.",
  },
} as const;

// Logo BetrEdge (rebrand 2026-06-22): immagine unica mark+wordmark (coral).
// BrandMark rende il logo all'altezza `size`; Wordmark è incluso nell'immagine
// (resta come no-op per non toccare i call-site esistenti).
function BrandMark({ size = 32 }: { size?: number }) {
  // #UI-LOGO-THEME-0623: due loghi (bianco per dark, nero per light), swap via CSS
  // su data-theme → no flash, niente JS.
  const s = { height: size, width: "auto" as const };
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <img className="brand-logo-dark" src="/logos/betredge-logo-white.png" alt="BetrEdge" style={s} />
      <img className="brand-logo-light" src="/logos/betredge-logo-black.png" alt="" aria-hidden="true" style={s} />
    </span>
  );
}
function Wordmark() { return null; }

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

// #LANDING-EDGE-SCANNER-1 — riga reale del terminale derivata da /api/predictions.
type ScanRow = { match: string; glyph: "ball" | "tball" | "trophy"; model: number; market: number; edge: number };
type PredApiRow = {
  home_team?: string; away_team?: string; league?: string; locked?: boolean;
  p_home?: number | null; p_draw?: number | null; p_away?: number | null;
  edge?: number | null; best_selection?: string | null;
};
// Probabilità della selezione (HOME/DRAW/AWAY) usata dal board. Edge è una FRAZIONE
// (0.08 = 8 pt). Market% = Model% − edge (implicita di mercato), come da pipeline GET.
function rowFromPrediction(p: PredApiRow): ScanRow | null {
  if (!p || p.locked) return null;
  const sel = p.best_selection;
  const edge = typeof p.edge === "number" ? p.edge : null;
  if (!sel || edge == null || edge <= 0) return null;
  const prob = sel === "HOME" ? p.p_home : sel === "DRAW" ? p.p_draw : sel === "AWAY" ? p.p_away : null;
  if (typeof prob !== "number" || prob <= 0 || prob > 1) return null;
  const model = Math.round(prob * 100);
  const market = Math.round((prob - edge) * 100);
  const edgePt = Math.round(edge * 1000) / 10; // un decimale, in punti
  if (market < 0 || market > 100 || edgePt <= 0) return null;
  const home = (p.home_team ?? "").trim();
  const away = (p.away_team ?? "").trim();
  if (!home || !away) return null;
  return {
    match: `${home}–${away}`,
    glyph: p.league === "WC" ? "trophy" : "ball",
    model, market, edge: edgePt,
  };
}
// Righe esempio del terminale — illustrano il FORMATO, marcate "esempio" in UI.
// Non sono claim sui risultati: matchup neutri, edge plausibili decrescenti.
const SCAN_EXAMPLE_ROWS: ScanRow[] = [
  { match: "Brasile–Argentina", glyph: "trophy", model: 49, market: 42, edge: 7.1 },
  { match: "Inter–Napoli", glyph: "ball", model: 54, market: 48, edge: 6.2 },
  { match: "Sinner–Zverev", glyph: "tball", model: 66, market: 61, edge: 5.4 },
  { match: "Bayern–Dortmund", glyph: "ball", model: 58, market: 54, edge: 4.1 },
];

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  // #UI-HOMEAUTH-0623 (spec #4): Sign In/Register aprono la modale IN-PLACE sulla
  // home, senza navigare su /app. null = chiusa.
  const [authModal, setAuthModal] = useState<HomeAuthIntent | null>(null);
  // #LANDING-EDGE-SCANNER-1: prima riga del terminale = dato REALE del giorno
  // (match con edge più alto da /api/predictions, sbloccato = pick_of_day per anon).
  // null finché non popolato/fallita la fetch → terminale tutto-esempio (FTC: mai
  // numeri finti spacciati per reali). SSR-safe: parte null, popola al mount.
  const [scanLive, setScanLive] = useState<ScanRow | null>(null);
  const [scanCounts, setScanCounts] = useState<{ events: number; withEdge: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const sl = localStorage.getItem("agentic-lang");
      if (sl && (LANGS as string[]).includes(sl)) setLang(sl as Lang);
    } catch {}
    // #UI-THEME-HARDEN-0623: ri-applica la scelta salvata (localStorage → prefers,
    // stessa logica del pre-paint) e ri-asserta data-theme, così un eventuale reset
    // da idratazione non lascia il tema sbagliato.
    let t = "";
    try { t = localStorage.getItem("agentic-theme") ?? ""; } catch {}
    if (t !== "light" && t !== "dark") {
      t = (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }
    setTheme(t as "dark" | "light");
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  // #THEME-CONSISTENCY-0623: segui l'impostazione di sistema (computer/browser)
  // SOLO se l'utente non ha mai scelto un tema manualmente (agentic-theme vuoto).
  // Appena tocca DARK/LIGHT la scelta persiste e vince. Così il tema "resta sulla
  // scelta dell'utente OPPURE segue il sistema", senza divergere tra le pagine.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      let chosen = "";
      try { chosen = localStorage.getItem("agentic-theme") ?? ""; } catch {}
      if (chosen === "light" || chosen === "dark") return; // scelta esplicita: non sovrascrivere
      const next: "dark" | "light" = e.matches ? "light" : "dark";
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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

  // #LANDING-EDGE-SCANNER-1: popola la riga reale del terminale. Fail-soft:
  // qualunque errore / off-season / nessun match con edge → resta null e il
  // terminale mostra il formato tutto-esempio (label "esempio"). Mai riga finta.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/predictions", { credentials: "same-origin", cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        const rows: PredApiRow[] = Array.isArray(data?.predictions) ? data.predictions : [];
        // Il pick_of_day (rank 0, edge più alto) è l'unica riga sbloccata per anon.
        const best = rows.map(rowFromPrediction).filter((r): r is ScanRow => r !== null)
          .sort((a, b) => b.edge - a.edge)[0] ?? null;
        const withEdge = rows.filter((r) => typeof r.edge === "number" && (r.edge as number) > 0).length;
        if (cancelled) return;
        if (best) {
          setScanLive(best);
          setScanCounts({ events: typeof data?.count === "number" ? data.count : rows.length, withEdge });
        }
      } catch { /* fail-soft: terminale tutto-esempio */ }
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
  // #UI-LOGOUT-TOPBAR-0623: logout dalla home (route separata dal desk) → invalida
  // la sessione lato server poi ricarica "/" in stato anonimo.
  const logoutHome = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action: "logout" }),
      });
    } catch { /* il reload riporta comunque allo stato pubblico */ }
    window.location.href = "/";
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
            /* #UI-LOGOUT-TOPBAR-0623: da loggati il Logout è in topbar accanto alla
               pill nome+piano (che resta link all'account). Su home/route separate
               il logout fa POST /api/auth {action:"logout"} poi reload su "/". */
            <>
              <a href="/app?tab=account" className="am-acct" title={auth.identifier}>
                {auth.name || auth.identifier}<span className="plan">{planPillLabel(auth.plan)}</span>
              </a>
              <button type="button" className="lp-nav-link" onClick={logoutHome}>
                {t.logout}
              </button>
            </>
          ) : auth.status === "anonymous" ? (
            <>
              {/* #UI-HOMEAUTH-0623: aprono la modale IN-PLACE, non navigano più su /app */}
              <button type="button" className="lp-nav-link" onClick={() => setAuthModal("login")}>{t.signin}</button>
              <button type="button" className="lp-nav-cta" onClick={() => setAuthModal("create")}>{t.register}</button>
            </>
          ) : null /* loading: niente flicker di stato errato */}
          <LangDropdown value={lang} onSelect={selectLang} variant="landing" />
        </div>
      </header>

      {/* ── Hero (#HOME-BETMODE-1: il mega-hero a tutto schermo è ora un banner più
           piccolo che RUOTA in carosello — foto reali + copy 5-lingue riusate da
           lib/house-banners.ts. La barra sport SOTTO resta invariata e continua
           col banner. Le vecchie classi .lp-hero/.lp-hero-img/.lp-hero-bg non sono
           più referenziate da qui → orfane (vedi report); lasciate nel CSS. ── */}
      <LandingCarousel lang={lang} />
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

      {/* ── Edge Scanner (#LANDING-EDGE-SCANNER-1) — split asimmetrico: a sinistra
           il punto di vista (motore di probabilità, non bookmaker) + 3 KPI-prova +
           CTA; a destra un terminale quant che "scansiona" le partite e fa emergere
           l'edge. Riga 1 = dato REALE del giorno (fetch /api/predictions, match con
           edge più alto); le altre illustrano il formato (FTC: mai numeri finti
           spacciati per reali). Fallback off-season → terminale tutto-esempio. ── */}
      <section className="lp-scan">
        <div className="lp-scan-copy">
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
          <div className="lp-scan-cta-row">
            <a href="/app?tab=account" className="lp-what-cta">{t.waCta}<span aria-hidden="true">→</span></a>
            <span className="lp-scan-cta-sub">{t.waCtaSub}</span>
          </div>
        </div>

        {/* terminale edge_scanner: header + beam di scansione + righe + footer */}
        <figure className="lp-term" aria-label="Edge Scanner">
          <figcaption className="lp-term-top">
            <span className="lp-term-dot" aria-hidden="true" />
            <span className="lp-term-dot" aria-hidden="true" />
            <span className="lp-term-dot" aria-hidden="true" />
            <span className="lp-term-ttl">edge_scanner.{scanLive ? t.waScanLive : t.waScanExample}</span>
            <span className="lp-term-scan">{t.waScanning}</span>
          </figcaption>
          <span className="lp-term-beam" aria-hidden="true" />
          <div className="lp-term-head" role="row">
            <span>{t.waColMatch}</span>
            <span>{t.waReadModel}</span>
            <span>{t.waReadMarket}</span>
            <span>{t.waReadEdge}</span>
          </div>
          {scanLive ? (
            <div className="lp-term-row is-real" role="row">
              <span className="lp-term-fx">
                <svg viewBox="0 0 24 24" aria-hidden="true"><use href={scanLive.glyph === "trophy" ? "#g-trophy" : scanLive.glyph === "tball" ? "#g-tball" : "#g-ball"} /></svg>
                <span className="lp-term-name">{scanLive.match}</span>
              </span>
              <span className="lp-term-c">{scanLive.model}%</span>
              <span className="lp-term-c">{scanLive.market}%</span>
              <span className="lp-term-edge">+{scanLive.edge.toFixed(1)}</span>
            </div>
          ) : null}
          {SCAN_EXAMPLE_ROWS.map((r, i) => (
            <div className="lp-term-row" role="row" key={r.match} style={{ ["--d" as string]: `${(i + (scanLive ? 1 : 0)) * 0.09 + 0.05}s` }}>
              <span className="lp-term-fx">
                <svg viewBox="0 0 24 24" aria-hidden="true"><use href={r.glyph === "trophy" ? "#g-trophy" : r.glyph === "tball" ? "#g-tball" : "#g-ball"} /></svg>
                <span className="lp-term-name">{r.match}</span>
                <span className="lp-term-tag">{t.waTagExample}</span>
              </span>
              <span className="lp-term-c">{r.model}%</span>
              <span className="lp-term-c">{r.market}%</span>
              <span className="lp-term-edge">+{r.edge.toFixed(1)}</span>
            </div>
          ))}
          <div className="lp-term-foot">
            <span className="lp-term-foot-n">
              {scanLive && scanCounts ? t.waFootEvents(scanCounts.events, scanCounts.withEdge) : t.waTermAllExample}
            </span>
            <span className="lp-term-foot-note">{scanLive ? t.waFootReal : t.waFootExample}</span>
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

      {/* ── Footer (#UI-FOOTER-UNIFIED-0623: footer condiviso del sito) ── */}
      <SiteFooter lang={lang} />

      {/* #UI-LIVECHAT-0623: widget live chat (talk.to) dietro env flag, inerte
          finché NEXT_PUBLIC_TALKTO_ID non è settato. */}
      <LiveChat />

      {/* #UI-HOMEAUTH-0623 (spec #4): modale auth in-place sulla home */}
      {authModal && (
        <HomeAuthModal intent={authModal} lang={lang} onClose={() => setAuthModal(null)} />
      )}
    </div>
  );
}
