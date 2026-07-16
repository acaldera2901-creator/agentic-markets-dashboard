"use client";

// ── BetRedge — Landing pubblica (#LANDING-BETREDGE-1) ────────────────────────
// Prima pagina su "/". Ricrea l'inspo BetRedge (hero split football/tennis,
// scie energia coral/cobalt, 4 card) interamente in CSS/SVG (nessuna foto).
// Le CTA reindirizzano nel desk su /app (deep-link ?tab=&sport=).
// Stile: dark energetico sportsbook su token --am-* + font Hanken/JetBrains.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
import { writeRefCode } from "@/lib/referral-code";
import { PUBLIC_PAID_PLANS } from "@/lib/commercial-plan"; // #HOME-V3: prezzi reali (no fabbricazione)
import type { TennisMatch } from "@/app/app/page"; // #HOME-V3: tipo del componente board reale
// #HOME-V3 Anatomy: la scheda è il COMPONENTE REALE della board (TennisMatchCard),
// non una versione marketing. Lazy-load (ssr:false) per non gonfiare il bundle
// iniziale della landing con il modulo del desk. Reso 1:1 col prodotto.
const TennisMatchCard = dynamic(
  () => import("@/app/app/page").then((m) => m.TennisMatchCard),
  { ssr: false, loading: () => <div className="v-anat-card-skel" aria-hidden="true" /> },
);

type Lang = "it" | "en" | "es" | "fr" | "ru";
const LANGS: Lang[] = ["en", "it", "es", "fr", "ru"];

const COPY = {
  it: {
    signin: "Accedi",
    register: "Registrati",
    logout: "Esci",
    leftLabel: "PROBABILITÀ CALIBRATE SU CALCIO & TENNIS",
    rightLabel: "PROBABILITÀ, NON PROMESSE\nCALCIO & TENNIS",
    tagline: ["PREVEDI.", "CONFRONTA.", "DECIDI."],
    pill: "MOTORE DI PROBABILITÀ · NON UN BOOKMAKER",
    viewNow: "GUARDA ORA",
    joinNow: "ISCRIVITI ORA",
    cardBrandTitle: "Probabilità calibrate, non promesse",
    signNow: "REGISTRATI",
    cardFootball: "QUOTE CALCIO",
    cardFootballDesc: "Probabilità calibrate dal nostro modello sui principali campionati.",
    cardLive: "QUOTE LIVE & INSIGHTS",
    cardLiveDesc: "Edge in tempo reale e spiegazioni: il modello aggiorna mentre la partita gira.",
    playNow: "VEDI ORA",
    cardApp: "BETREDGE APP",
    cardAppDesc: "Il desk in tasca. In arrivo su iOS e Android.",
    appSoon: "IN ARRIVO",
    spAllSports: "Tutti gli sport", spFootball: "Calcio", spTennis: "Tennis", spWorldCup: "Mondiali",
    cardTrackTag: "La prova", cardTrack: "Track record", cardTrackDesc: "Hit-rate · CLV verificato. Pick concluse, registrate prima dell'evento.", cardTrackBtn: "Storico",
    cardModel: "Modello vs Mercato", cardModelDesc: "Perché il modello sceglie una pick: probabilità calibrate confrontate con la quota.", cardModelBtn: "Scopri",
    cardPlans: "Piani", cardPlansDesc: "Free per provare · Base 14.99 · Pro 29.99 USDT/mese.", cardPlansBtn: "Vedi i piani",
    risk: "Nota rischio: BetRedge mostra analisi probabilistiche. Non garantisce profitti e non sostituisce la gestione del rischio personale. I risultati passati non garantiscono risultati futuri. 18+.",
    privacy: "Privacy",
    // ── Edge Scanner (value-prop) ──
    waEyebrow: "MOTORE DI PROBABILITÀ · NON UN BOOKMAKER",
    waHead1: "Non battiamo il banco.",
    waHead2: "Lo rendiamo leggibile.",
    waBody: "Ogni partita passa nel modello: probabilità calibrate, confrontate con la quota. Dove c'è scarto lo evidenziamo e lo spieghiamo — prima del fischio — e lo registriamo. Niente soffiate, niente scatola nera: numeri onesti e il loro perché.",
    waKpi1Val: "Hit-rate", waKpi1Lab: "su pick concluse", waKpi2Lab: "prima del fischio", waKpi3Val: "CLV", waKpi3Lab: "verificato e tracciato",
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
    leftLabel: "CALIBRATED PROBABILITIES ON FOOTBALL & TENNIS",
    rightLabel: "PROBABILITIES, NOT PROMISES\nFOOTBALL & TENNIS",
    tagline: ["PREDICT.", "COMPARE.", "DECIDE."],
    pill: "PROBABILITY ENGINE · NOT A BOOKMAKER",
    viewNow: "VIEW NOW",
    joinNow: "JOIN NOW",
    cardBrandTitle: "Calibrated probabilities, not promises",
    signNow: "SIGN UP",
    cardFootball: "FOOTBALL ODDS",
    cardFootballDesc: "Model-calibrated probabilities across top leagues.",
    cardLive: "LIVE ODDS & INSIGHTS",
    cardLiveDesc: "Real-time edge and explanations: the model updates while the match runs.",
    playNow: "VIEW NOW",
    cardApp: "BETREDGE APP",
    cardAppDesc: "The desk in your pocket. Coming soon to iOS and Android.",
    appSoon: "COMING SOON",
    spAllSports: "All Sports", spFootball: "Football", spTennis: "Tennis", spWorldCup: "World Cup",
    cardTrackTag: "The proof", cardTrack: "Track record", cardTrackDesc: "Hit rate · verified CLV. Picks logged before kickoff.", cardTrackBtn: "History",
    cardModel: "Model vs Market", cardModelDesc: "Why the model picks a bet: calibrated probabilities against the odds.", cardModelBtn: "Discover",
    cardPlans: "Plans", cardPlansDesc: "Free to try · Base 14.99 · Pro 29.99 USDT/month.", cardPlansBtn: "See plans",
    risk: "Risk note: BetRedge shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management. Past results do not guarantee future results. 18+.",
    privacy: "Privacy",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "PROBABILITY ENGINE · NOT A BOOKMAKER",
    waHead1: "We don't beat the book.",
    waHead2: "We make it readable.",
    waBody: "Every match runs through the model: calibrated probabilities, lined up against the odds. Where there's a gap we flag it and explain it — before kick-off — and we log it. No tips, no black box: honest numbers and the reasoning behind them.",
    waKpi1Val: "Hit rate", waKpi1Lab: "on settled picks", waKpi2Lab: "logged pre-match", waKpi3Val: "CLV", waKpi3Lab: "verified & tracked",
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
    leftLabel: "PROBABILIDADES CALIBRADAS EN FÚTBOL Y TENIS",
    rightLabel: "PROBABILIDADES, NO PROMESAS\nFÚTBOL Y TENIS",
    tagline: ["PREDICE.", "COMPARA.", "DECIDE."],
    pill: "MOTOR DE PROBABILIDAD · NO UN BOOKMAKER",
    viewNow: "VER AHORA",
    joinNow: "ÚNETE AHORA",
    cardBrandTitle: "Probabilidades calibradas, no promesas",
    signNow: "REGÍSTRATE",
    cardFootball: "CUOTAS FÚTBOL",
    cardFootballDesc: "Probabilidades calibradas por nuestro modelo en las principales ligas.",
    cardLive: "CUOTAS LIVE E INSIGHTS",
    cardLiveDesc: "Edge en tiempo real y explicaciones: el modelo se actualiza mientras corre el partido.",
    playNow: "VER AHORA",
    cardApp: "BETREDGE APP",
    cardAppDesc: "El desk en tu bolsillo. Próximamente en iOS y Android.",
    appSoon: "PRÓXIMAMENTE",
    spAllSports: "Todos los deportes", spFootball: "Fútbol", spTennis: "Tenis", spWorldCup: "Mundial",
    cardTrackTag: "La prueba", cardTrack: "Track record", cardTrackDesc: "Acierto · CLV verificado. Picks registrados antes del partido.", cardTrackBtn: "Historial",
    cardModel: "Modelo vs Mercado", cardModelDesc: "Por qué el modelo elige una pick: probabilidades calibradas frente a la cuota.", cardModelBtn: "Descubre",
    cardPlans: "Planes", cardPlansDesc: "Free para probar · Base 14.99 · Pro 29.99 USDT/mes.", cardPlansBtn: "Ver planes",
    risk: "Nota de riesgo: BetRedge muestra análisis probabilísticos. No garantiza beneficios y no sustituye la gestión personal del riesgo. Los resultados pasados no garantizan resultados futuros. 18+.",
    privacy: "Privacidad",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "MOTOR DE PROBABILIDAD · NO UN BOOKMAKER",
    waHead1: "No batimos a la casa.",
    waHead2: "La hacemos legible.",
    waBody: "Cada partido pasa por el modelo: probabilidades calibradas, frente a la cuota. Donde hay diferencia la señalamos y la explicamos — antes del pitido — y la registramos. Sin soplos, sin caja negra: números honestos y su porqué.",
    waKpi1Val: "Acierto", waKpi1Lab: "en apuestas cerradas", waKpi2Lab: "antes del partido", waKpi3Val: "CLV", waKpi3Lab: "verificado y registrado",
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
    leftLabel: "DES PROBABILITÉS CALIBRÉES SUR LE FOOTBALL & LE TENNIS",
    rightLabel: "DES PROBABILITÉS, PAS DES PROMESSES\nFOOTBALL & TENNIS",
    tagline: ["PRÉDIS.", "COMPARE.", "DÉCIDE."],
    pill: "MOTEUR DE PROBABILITÉ · PAS UN BOOKMAKER",
    viewNow: "VOIR MAINTENANT",
    joinNow: "REJOINDRE",
    cardBrandTitle: "Des probabilités calibrées, pas des promesses",
    signNow: "S'INSCRIRE",
    cardFootball: "COTES FOOTBALL",
    cardFootballDesc: "Probabilités calibrées par notre modèle sur les principaux championnats.",
    cardLive: "COTES LIVE & INSIGHTS",
    cardLiveDesc: "Edge en temps réel et explications : le modèle se met à jour pendant le match.",
    playNow: "VOIR MAINTENANT",
    cardApp: "BETREDGE APP",
    cardAppDesc: "Le desk dans ta poche. Bientôt sur iOS et Android.",
    appSoon: "BIENTÔT",
    spAllSports: "Tous les sports", spFootball: "Football", spTennis: "Tennis", spWorldCup: "Coupe du Monde",
    cardTrackTag: "La preuve", cardTrack: "Track record", cardTrackDesc: "Taux de réussite · CLV vérifié. Pronostics enregistrés avant le match.", cardTrackBtn: "Historique",
    cardModel: "Modèle vs Marché", cardModelDesc: "Pourquoi le modèle choisit un pari : probabilités calibrées face à la cote.", cardModelBtn: "Découvrir",
    cardPlans: "Offres", cardPlansDesc: "Free pour essayer · Base 14.99 · Pro 29.99 USDT/mois.", cardPlansBtn: "Voir les offres",
    risk: "Note de risque : BetRedge montre des analyses probabilistes. Elle ne garantit pas de profits et ne remplace pas la gestion personnelle du risque. Les résultats passés ne garantissent pas les résultats futurs. 18+.",
    privacy: "Confidentialité",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "MOTEUR DE PROBABILITÉ · PAS UN BOOKMAKER",
    waHead1: "On ne bat pas le bookmaker.",
    waHead2: "On le rend lisible.",
    waBody: "Chaque match passe dans le modèle : des probabilités calibrées, confrontées à la cote. Là où il y a un écart, on le signale et on l'explique — avant le coup d'envoi — et on l'enregistre. Pas de tuyaux, pas de boîte noire : des chiffres honnêtes et leur pourquoi.",
    waKpi1Val: "Réussite", waKpi1Lab: "sur paris clôturés", waKpi2Lab: "avant le match", waKpi3Val: "CLV", waKpi3Lab: "vérifié et suivi",
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
    leftLabel: "КАЛИБРОВАННЫЕ ВЕРОЯТНОСТИ НА ФУТБОЛ И ТЕННИС",
    rightLabel: "ВЕРОЯТНОСТИ, А НЕ ОБЕЩАНИЯ\nФУТБОЛ И ТЕННИС",
    tagline: ["ПРОГНОЗИРУЙ.", "СРАВНИВАЙ.", "РЕШАЙ."],
    pill: "ДВИЖОК ВЕРОЯТНОСТЕЙ · НЕ БУКМЕКЕР",
    viewNow: "СМОТРЕТЬ",
    joinNow: "ПРИСОЕДИНИТЬСЯ",
    cardBrandTitle: "Калиброванные вероятности, а не обещания",
    signNow: "РЕГИСТРАЦИЯ",
    cardFootball: "КОЭФФИЦИЕНТЫ ФУТБОЛ",
    cardFootballDesc: "Вероятности, откалиброванные нашей моделью по топ-лигам.",
    cardLive: "LIVE КОЭФФИЦИЕНТЫ И ИНСАЙТЫ",
    cardLiveDesc: "Edge в реальном времени и объяснения: модель обновляется во время матча.",
    playNow: "СМОТРЕТЬ",
    cardApp: "BETREDGE APP",
    cardAppDesc: "Desk в твоём кармане. Скоро на iOS и Android.",
    appSoon: "СКОРО",
    spAllSports: "Все виды спорта", spFootball: "Футбол", spTennis: "Теннис", spWorldCup: "ЧМ",
    cardTrackTag: "Доказательство", cardTrack: "Track record", cardTrackDesc: "Точность попаданий · проверенный CLV. Прогнозы фиксируются до начала.", cardTrackBtn: "История",
    cardModel: "Модель vs Рынок", cardModelDesc: "Почему модель выбирает ставку: калиброванные вероятности против коэффициента.", cardModelBtn: "Узнать",
    cardPlans: "Тарифы", cardPlansDesc: "Free для пробы · Base 14.99 · Pro 29.99 USDT/мес.", cardPlansBtn: "Тарифы",
    risk: "Примечание о риске: BetRedge показывает вероятностный анализ. Он не гарантирует прибыль и не заменяет личное управление рисками. Прошлые результаты не гарантируют будущих результатов. 18+.",
    privacy: "Конфиденциальность",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "ДВИЖОК ВЕРОЯТНОСТЕЙ · НЕ БУКМЕКЕР",
    waHead1: "Мы не обыгрываем букмекера.",
    waHead2: "Мы делаем его понятным.",
    waBody: "Каждый матч проходит через модель: калиброванные вероятности, сопоставленные с коэффициентом. Где есть расхождение — мы отмечаем его и объясняем — до свистка — и фиксируем. Никаких подсказок, никакого чёрного ящика: честные цифры и их причина.",
    waKpi1Val: "Точность", waKpi1Lab: "по закрытым прогнозам", waKpi2Lab: "до матча", waKpi3Val: "CLV", waKpi3Lab: "проверенный, отслеживается",
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
// Etichetta pill = pacchetto REALE del cliente. Deve combaciare con la logica del
// desk (app/app/page.tsx: profileHasPremium/profileHasAccess): solo premium/admin
// è PRO, base è BASE (prima base veniva mostrato come PRO → badge sbagliato in home).
function planPillLabel(plan: string): string {
  if (["premium", "admin_full"].includes(plan)) return "PRO";
  if (plan === "base") return "BASE";
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

// ── #HOME-V3 copy ("Live Terminal + Proof Spine") ───────────────────────────
// Copy NUOVO delle sezioni editoriali v3. Le sezioni hero + how-it-works riusano
// la COPY esistente (waEyebrow/waHead*/waBody/hw*), già tradotta e FTC-safe.
// EN + IT completi; es/fr/ru ricadono su EN (localizzazione = follow-up).
type V3Copy = {
  ctaTerminal: string; ctaTrack: string; ctaBrowse: string;
  chipLogged: string; chipClv: string; chipCal: string;
  anEyebrow: string; anHead: string; anSub: string;
  anCapLive: string; anCapRepr: string;
  anNotes: { lab: string; body: string; strong: string }[];
  prEyebrow: string; prHead: string; prBadge: string;
  prMeta: (n: number) => string; prMetaQual: string; prWall: string; prQuote: string; prQuoteSub: string;
  prColMatch: string; prColRes: string;
  suEyebrow: string; suHead: string; suSub: string;
  suItems: { pk: string; pn: string; p: string; ps: string; psB: string }[];
  pcEyebrow: string; pcHead: string;
  pcFree: string; pcBase: string; pcPro: string; pcBest: string; pcMo: string;
  pcFreeList: string[]; pcBaseList: string[]; pcProList: string[];
  fnHead1: string; fnHeadG: string; fnBody: string;
};
const V3_EN: V3Copy = {
  ctaTerminal: "Open the terminal", ctaTrack: "See the track record", ctaBrowse: "Browse the track record",
  chipLogged: "Logged before kick-off", chipClv: "CLV verified", chipCal: "Calibrated, not hyped",
  anEyebrow: "Anatomy of a reading", anHead: "Exactly what you read.", anSub: "One card, every layer — nothing hidden, nothing hyped. This is the exact card from the board.",
  anCapLive: "Live pick — the exact card component from the board.",
  anCapRepr: "Representative reading — the exact card component from the board.",
  anNotes: [
    { lab: "Pick", strong: "The call, stated plainly.", body: "A single side — or “no clear favourite” when the model is below its floor. We never force one." },
    { lab: "Probability", strong: "Calibrated, not inflated.", body: "71% means the model expects it to land close to 71 times in 100 over the long run." },
    { lab: "Market", strong: "The price, made comparable.", body: "We convert the book’s odds to an implied probability, so model and market sit side by side." },
    { lab: "Edge", strong: "The gap, quantified.", body: "Where the model sees more value than the price implies — never a promise of profit." },
    { lab: "Deep Analysis", strong: "The “why”, in the open.", body: "Form, xG, injuries, Elo, serve/return, H2H, surface — reasoning, not a black box." },
  ],
  prEyebrow: "The proof", prHead: "The receipts come first.", prBadge: "CLV VERIFIED · LOGGED PRE-KICK-OFF",
  prMeta: (n) => `${n} settled picks, each time-stamped before the whistle. This is the settled hit-rate — past performance, not a forecast. Nothing edited after the fact.`,
  prMetaQual: "Every pick is time-stamped before the whistle and settled on the public record — past performance, not a forecast. Nothing edited after the fact.",
  prWall: "SETTLED PICKS", prColMatch: "MATCH", prColRes: "RESULT",
  prQuote: "Below our confidence floor we publish “no clear favourite” rather than manufacture a pick.",
  prQuoteSub: " Calibrated, never hyped — the difference between a probability engine and a tipster.",
  suEyebrow: "The suite", suHead: "Four ways to read the board.", suSub: "One engine, surfaced the way you actually work — from a single value bet to the whole week.",
  suItems: [
    { pk: "Best Bets · +EV", pn: "The value feed", p: "Every fixture where the model sees value versus the price, ranked by edge and confidence. Filter by sport and market.", ps: "refreshed live · ", psB: "+EV only" },
    { pk: "Weekly Pick", pn: "The house multi", p: "One curated accumulator a week, built by the model and frozen the moment it’s published — you see the same slip we do.", ps: "frozen at publish · ", psB: "fully logged" },
    { pk: "Match Builder", pn: "Build your own read", p: "Combine markets across a fixture and watch the blended probability and edge recompute as you add legs.", ps: "live probability · ", psB: "per leg" },
    { pk: "Live · In-play", pn: "The board, moving", p: "Probabilities that update through the match as the state changes — the same reading, in real time.", ps: "in-play · ", psB: "updating" },
  ],
  pcEyebrow: "Access", pcHead: "Start free. Read deeper when you’re ready.",
  pcFree: "Free", pcBase: "Base", pcPro: "Pro", pcBest: "FULL ACCESS", pcMo: " / mo",
  pcFreeList: ["One pick per sport, per week", "Public track record", "Preview of the edge scanner"],
  pcBaseList: ["All Best Bets · +EV feed", "Weekly Pick", "Deep Analysis on every card", "Full settled history"],
  pcProList: ["Everything in Base", "Live · in-play readings", "Match Builder", "Priority scanner & crypto billing"],
  fnHead1: "Read your first match ", fnHeadG: "free.", fnBody: "See a calibrated probability, its edge, and the reasoning — then make your own call. No card required to start.",
};
const V3_IT: V3Copy = {
  ctaTerminal: "Apri il terminale", ctaTrack: "Vedi il track record", ctaBrowse: "Sfoglia il track record",
  chipLogged: "Registrata prima del fischio", chipClv: "CLV verificato", chipCal: "Calibrata, mai gonfiata",
  anEyebrow: "Anatomia di una lettura", anHead: "Esattamente cosa leggi.", anSub: "Una scheda, ogni livello — niente nascosto, niente hype. È la scheda identica a quella sulla board.",
  anCapLive: "Pick live — il componente scheda identico a quello della board.",
  anCapRepr: "Lettura rappresentativa — il componente scheda identico a quello della board.",
  anNotes: [
    { lab: "Pick", strong: "La scelta, detta chiara.", body: "Un solo lato — o “nessun favorito chiaro” quando il modello è sotto la soglia. Non la forziamo mai." },
    { lab: "Probabilità", strong: "Calibrata, non gonfiata.", body: "71% significa che il modello se l’aspetta vicino a 71 volte su 100 nel lungo periodo." },
    { lab: "Mercato", strong: "La quota, resa comparabile.", body: "Convertiamo la quota del book in probabilità implicita, così modello e mercato stanno affiancati." },
    { lab: "Edge", strong: "Lo scarto, quantificato.", body: "Dove il modello vede più valore di quanto implichi la quota — mai una promessa di profitto." },
    { lab: "Deep Analysis", strong: "Il “perché”, in chiaro.", body: "Forma, xG, infortuni, Elo, servizio/risposta, H2H, superficie — ragionamento, non scatola nera." },
  ],
  prEyebrow: "La prova", prHead: "Prima vengono le ricevute.", prBadge: "CLV VERIFICATO · REGISTRATA PRIMA DEL FISCHIO",
  prMeta: (n) => `${n} pick concluse, ciascuna con timestamp prima del fischio. Questo è l’hit-rate concluso — risultati passati, non una previsione. Nulla modificato a posteriori.`,
  prMetaQual: "Ogni pick ha un timestamp prima del fischio ed è conclusa sul registro pubblico — risultati passati, non una previsione. Nulla modificato a posteriori.",
  prWall: "PICK CONCLUSE", prColMatch: "MATCH", prColRes: "ESITO",
  prQuote: "Sotto la soglia di confidenza pubblichiamo “nessun favorito chiaro” invece di fabbricare una pick.",
  prQuoteSub: " Calibrata, mai gonfiata — la differenza tra un motore di probabilità e un tipster.",
  suEyebrow: "La suite", suHead: "Quattro modi di leggere il board.", suSub: "Un motore, presentato come lavori davvero — dalla singola value bet all’intera settimana.",
  suItems: [
    { pk: "Best Bets · +EV", pn: "Il feed del valore", p: "Ogni partita dove il modello vede valore rispetto alla quota, ordinata per edge e confidenza. Filtra per sport e mercato.", ps: "aggiornato live · ", psB: "solo +EV" },
    { pk: "Weekly Pick", pn: "La multipla della casa", p: "Una multipla curata a settimana, costruita dal modello e congelata al momento della pubblicazione — vedi la stessa schedina che vediamo noi.", ps: "congelata alla pubblicazione · ", psB: "tutto registrato" },
    { pk: "Match Builder", pn: "Costruisci la tua lettura", p: "Combina mercati su una partita e guarda probabilità ed edge combinati ricalcolarsi mentre aggiungi selezioni.", ps: "probabilità live · ", psB: "per selezione" },
    { pk: "Live · In-play", pn: "Il board, in movimento", p: "Probabilità che si aggiornano durante la partita al cambiare dello stato — la stessa lettura, in tempo reale.", ps: "in-play · ", psB: "in aggiornamento" },
  ],
  pcEyebrow: "Accesso", pcHead: "Inizia gratis. Leggi più a fondo quando vuoi.",
  pcFree: "Free", pcBase: "Base", pcPro: "Pro", pcBest: "ACCESSO COMPLETO", pcMo: " / mese",
  pcFreeList: ["Una pick per sport, a settimana", "Track record pubblico", "Anteprima dell’edge scanner"],
  pcBaseList: ["Tutto il feed Best Bets · +EV", "Weekly Pick", "Deep Analysis su ogni scheda", "Storico concluso completo"],
  pcProList: ["Tutto ciò che c’è in Base", "Letture live · in-play", "Match Builder", "Scanner prioritario & pagamento crypto"],
  fnHead1: "Leggi la tua prima partita ", fnHeadG: "gratis.", fnBody: "Vedi una probabilità calibrata, il suo edge e il ragionamento — poi decidi tu. Nessuna carta per iniziare.",
};
const V3: Record<Lang, V3Copy> = { en: V3_EN, it: V3_IT, es: V3_EN, fr: V3_EN, ru: V3_EN };

// #HOME-V3 proof: riga reale del track record (fetch /api/v2/history). Mai numeri finti.
type ProofRow = { name: string; comp: string; result: "won" | "lost" };
type HistApiRow = {
  home_team?: string | null; away_team?: string | null; event_name?: string | null;
  player_one?: string | null; player_two?: string | null;
  competition?: string | null; sport?: string | null; result?: string | null;
};

// #HOME-V3 Anatomy: pick REALE rappresentativa, alimenta il componente board vero
// quando l'API /api/tennis non offre un match sbloccato con edge (es. Preview senza
// DB). Onesta: è "rappresentativa", non spacciata per live; il LOOK è quello reale.
function anatomyFallbackMatch(): TennisMatch {
  return {
    id: "anatomy-demo",
    player1: "Jannik Sinner", player2: "Novak Djokovic",
    tournament: "Wimbledon", surface: "GRASS", round: "SF",
    scheduled: new Date(Date.now() + 2 * 86400000).toISOString(),
    p1: 0.71, p2: 0.29, odds_p1: 1.90, odds_p2: 3.10,
    edge: 0.071, best_selection: "P1", model: "elo+form",
    elo_p1: 2185, elo_p2: 2140, elo_p1_overall: 2185, elo_p2_overall: 2160,
    surface_matches_p1: 46, surface_matches_p2: 214,
    serve_form_p1: 0.84, serve_form_p2: 0.80,
    return_form_p1: 0.33, return_form_p2: 0.30,
    surface_reliability_p1: 0.72, surface_reliability_p2: 0.9,
    feature_quality: 0.86, h2h_p1_wins: 4, h2h_p2_wins: 3,
    locked: false, pick_of_day: false, pick: "Sinner", confidence_score: 78,
    explanation:
      "The model rates Sinner's hold and return pressure on grass above the market's implied 64%: recent serve form and surface Elo tilt the edge to the server.",
    affiliate: null,
  };
}

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
  // #HOME-V3 proof: hit-rate REALE + ultime pick concluse da /api/v2/history.
  // null finché non popolato/fallito → sezione mostra il testo qualitativo (nessun
  // numero inventato). win_rate è già la stringa "64.0%"|null calcolata server-side.
  const [proof, setProof] = useState<{ winRate: string; settled: number } | null>(null);
  const [proofRows, setProofRows] = useState<ProofRow[]>([]);
  // #HOME-V3 Anatomy: match REALE per il componente board. Parte dal fallback
  // rappresentativo; se /api/tennis offre un match sbloccato con edge lo sostituisce.
  const [anatomyMatch, setAnatomyMatch] = useState<TennisMatch>(anatomyFallbackMatch);
  const [anatomyIsLive, setAnatomyIsLive] = useState(false);

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

  // #PRICING-CREATORS-0706: i link invito creator (/r/CODICE) atterrano QUI con
  // ?ref=. First-touch identico al desk (#MB-1): persistiamo una volta sola in
  // localStorage (am_ref) — il register (in-place o dal desk) lo allega al
  // payload → profiles.referred_by. Mai sovrascritto se già presente.
  useEffect(() => {
    // writeRefCode: normalizza + first-touch + timestamp (scadenza 60gg). Fail-soft.
    try { writeRefCode(new URLSearchParams(window.location.search).get("ref") ?? ""); } catch { /* no-op */ }
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

  // #HOME-V3 proof: popola bignum + wall con dati REALI del track record. Fail-soft:
  // errore/off-season/nessuna pick conclusa → proof=null → testo qualitativo, niente
  // numero. Mostra solo esiti aggregati (won/lost) + nome evento, mai la pick masked.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/v2/history?limit=12", { credentials: "same-origin", cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        const stats = data?.stats ?? {};
        const rows: HistApiRow[] = Array.isArray(data?.history) ? data.history : [];
        const settledRows: ProofRow[] = rows
          .filter((r) => r.result === "won" || r.result === "lost")
          .map((r) => {
            const name = r.home_team && r.away_team
              ? `${r.home_team}–${r.away_team}`
              : (r.event_name || (r.player_one && r.player_two ? `${r.player_one}–${r.player_two}` : "")).trim();
            return { name, comp: (r.competition || r.sport || "").trim(), result: r.result as "won" | "lost" };
          })
          .filter((r) => r.name.length > 0)
          .slice(0, 6);
        if (cancelled) return;
        const won = typeof stats.won === "number" ? stats.won : 0;
        const lost = typeof stats.lost === "number" ? stats.lost : 0;
        if (typeof stats.win_rate === "string" && won + lost > 0) {
          setProof({ winRate: stats.win_rate, settled: won + lost });
          setProofRows(settledRows);
        }
      } catch { /* fail-soft: sezione proof qualitativa */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // #HOME-V3 Anatomy: sostituisci il fallback con un match REALE sbloccato con edge
  // dalla stessa fonte della board (/api/tennis). Fail-soft: resta il rappresentativo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/tennis", { credentials: "same-origin", cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        const matches: TennisMatch[] = Array.isArray(data?.matches) ? data.matches : [];
        const best = matches
          .filter((m) => m.locked === false && !!m.best_selection && typeof m.edge === "number" && (m.edge as number) > 0 && m.confidence_score != null)
          .sort((a, b) => (b.edge as number) - (a.edge as number))[0];
        if (best && !cancelled) { setAnatomyMatch(best); setAnatomyIsLive(true); }
      } catch { /* fail-soft: resta la pick rappresentativa */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const t = COPY[lang];
  const v = V3[lang];

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
    <div className="lp hv3" data-mounted={mounted ? "1" : "0"}>
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

      {/* ═══ HOME REDESIGN v3 (#HOME-V3) — "Live Terminal + Proof Spine" ═══
           Il carousel banner in cima è TENUTO com'è (lock Andrea). Da qui sotto è
           il redesign editoriale v3 approvato (mockup v3). Scoped .hv3. Verde #23A559
           primario, cobalto #3b82f6 solo secondario. Tasti squadrati. Asset reali. */}

      {/* ── Edge tape (marquee decorativo, aria-hidden) — dati esempio (stesso set
           FTC-safe del terminale), mai spacciati per claim reali. ── */}
      <div className="v-tape" aria-hidden="true">
        <div className="v-tape-track">
          {[...SCAN_EXAMPLE_ROWS, ...SCAN_EXAMPLE_ROWS].map((r, i) => (
            <span key={i}><em>{r.match}</em> · model {r.model} · mkt {r.market} · <span className="up">+{r.edge.toFixed(1)}</span></span>
          ))}
        </div>
      </div>

      {/* ── Hero: punto di vista + terminale Edge Scanner (riga 1 = dato REALE del
           giorno da /api/predictions; le altre illustrano il formato, label "example").
           #LANDING-EDGE-SCANNER-1 preservato — solo restyle in v3. ── */}
      <section className="v-hero"><div className="v-wrap v-grid">
        <div>
          <div className="v-kick">{t.waEyebrow}</div>
          <h1>{t.waHead1}<br /><span className="g">{t.waHead2}</span></h1>
          <p className="lede">{t.waBody}</p>
          <div className="v-actions">
            <a href="/app?tab=bets" className="v-btn v-btn--primary">{v.ctaTerminal}</a>
            <a href="/app?tab=history" className="v-btn v-btn--secondary">{v.ctaTrack}</a>
          </div>
          <div className="v-trust">
            <span className="trust-chip"><span className="trust-chip-dot">●</span> {v.chipLogged}</span>
            <span className="trust-chip"><span className="trust-chip-dot">●</span> {v.chipClv}</span>
            <span className="trust-chip"><span className="trust-chip-dot">●</span> {v.chipCal}</span>
          </div>
        </div>
        <figure className="v-scan" aria-label="Edge Scanner">
          <figcaption className="v-scan-head">
            <span className="live"><span className="v-pulse" />EDGE SCANNER</span>
            <span>· {scanLive ? t.waScanLive.toUpperCase() : t.waScanExample.toUpperCase()}</span>
            <span className="tag">{scanLive && scanCounts ? `SCANNING ${scanCounts.events} FIXTURES` : t.waScanning.toUpperCase()}</span>
          </figcaption>
          <div className="v-scan-cols"><span>{t.waColMatch}</span><span>Mdl</span><span>Mkt</span><span>{t.waReadEdge}</span><span /></div>
          {scanLive ? (
            <div className="v-scan-row">
              <span className="fx">
                <SportIcon sport={scanLive.glyph === "trophy" ? "worldcup" : scanLive.glyph === "tball" ? "tennis" : "football"} size={16} variant="sm" />
                <span className="nm">{scanLive.match}<small>{scanLive.glyph === "trophy" ? "WORLD CUP" : scanLive.glyph === "tball" ? "TENNIS" : "FOOTBALL"}</small></span>
              </span>
              <span className="md">{scanLive.model}</span>
              <span className="mk">{scanLive.market}</span>
              <span className="ed">+{scanLive.edge.toFixed(1)}</span>
              <span className="go">›</span>
            </div>
          ) : null}
          {SCAN_EXAMPLE_ROWS.map((r) => (
            <div className="v-scan-row" key={r.match}>
              <span className="fx">
                <SportIcon sport={r.glyph === "trophy" ? "worldcup" : r.glyph === "tball" ? "tennis" : "football"} size={16} variant="sm" />
                <span className="nm">{r.match}<small>{r.glyph === "trophy" ? "WORLD CUP" : r.glyph === "tball" ? "TENNIS" : "FOOTBALL"}</small></span>
                <span className="tag-ex">{t.waTagExample}</span>
              </span>
              <span className="md">{r.model}</span>
              <span className="mk">{r.market}</span>
              <span className="ed">+{r.edge.toFixed(1)}</span>
              <span className="go">›</span>
            </div>
          ))}
          <div className="v-scan-foot">
            <b>{scanLive && scanCounts ? t.waFootEvents(scanCounts.events, scanCounts.withEdge) + " · " : ""}Edge = model probability − market-implied probability. Below our confidence floor we show</b> <span style={{ color: "var(--v-muted)" }}>&ldquo;no clear favourite&rdquo;</span> <b>instead of forcing a pick.</b>
          </div>
        </figure>
      </div></section>

      {/* ── How it works: banda editoriale a 4 tempi (NON scalette numerate) ── */}
      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">{t.hwEyebrow}</div><h2>{t.hwHead}</h2></div>
        <div className="v-flow">
          <div className="fs"><h3>{t.hwS1}</h3><p>{t.hwS1Desc}</p></div>
          <div className="fs"><h3>{t.hwS2}</h3><p>{t.hwS2Desc}</p></div>
          <div className="fs"><h3>{t.hwS3}</h3><p>{t.hwS3Desc}</p></div>
          <div className="fs"><h3>{t.hwS4}</h3><p>{t.hwS4Desc}</p></div>
        </div>
      </div></section>

      {/* ── Anatomy of a reading: la scheda è il COMPONENTE BOARD REALE
           (TennisMatchCard), reso 1:1 col prodotto (unlocked/full: pick, prob, edge,
           confidenza, "Perché"/Deep Analysis). Alimentato da un match reale di
           /api/tennis quando disponibile, altrimenti una pick rappresentativa onesta.
           Le note attorno spiegano le parti della scheda. ── */}
      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">{v.anEyebrow}</div><h2>{v.anHead}</h2><p>{v.anSub}</p></div>
        <div className="v-anat">
          <div className="v-anat-card">
            <TennisMatchCard m={anatomyMatch} isPremium />
            <p className="v-anat-cap">
              {anatomyIsLive ? v.anCapLive : v.anCapRepr}
            </p>
          </div>
          <div className="v-notes">
            {v.anNotes.map((n) => (
              <div className="row" key={n.lab}><span className="lab">{n.lab}</span><span className="d"><b>{n.strong}</b> {n.body}</span></div>
            ))}
          </div>
        </div>
      </div></section>

      {/* ── Proof: hit-rate + ultime pick concluse da dati REALI (/api/v2/history).
           Fail-soft: se non disponibili → testo qualitativo, MAI un numero inventato. ── */}
      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">{v.prEyebrow}</div><h2>{v.prHead}</h2></div>
        {proof ? (
          <>
            <div className="v-proof-top">
              <div className="v-bignum">{proof.winRate}</div>
              <div className="v-proof-meta"><div className="badge"><span className="v-pulse" />{v.prBadge}</div><p>{v.prMeta(proof.settled)}</p></div>
            </div>
            {proofRows.length > 0 ? (
              <>
                <div className="v-wall-head"><span>{v.prWall}</span></div>
                {proofRows.map((r, i) => (
                  <div className="v-wrow" key={i}>
                    <span className="fx">{r.name}{r.comp ? <span className="sp">{r.comp}</span> : null}</span>
                    <span className={`res ${r.result}`}>{r.result === "won" ? "WON" : "LOST"}</span>
                  </div>
                ))}
              </>
            ) : null}
          </>
        ) : (
          <div className="v-proof-top"><div className="v-proof-meta"><div className="badge"><span className="v-pulse" />{v.prBadge}</div><p>{v.prMetaQual}</p></div></div>
        )}
        <blockquote className="v-quote">{v.prQuote}<span>{v.prQuoteSub}</span></blockquote>
      </div></section>

      {/* ── Suite: 4 superfici di prodotto (feature reali, deep-link nel desk) ── */}
      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">{v.suEyebrow}</div><h2>{v.suHead}</h2><p>{v.suSub}</p></div>
        <div className="v-suite">
          {v.suItems.map((it, i) => (
            <a className="v-prow" key={it.pk} href={["/app?tab=bets", "/weekly-pick", "/app?tab=builder", "/app?tab=bets"][i]}>
              <div><div className="pk">{it.pk}</div><div className="pn">{it.pn}</div></div>
              <p>{it.p}</p>
              <div className="ps">{it.ps}<b>{it.psB}</b></div>
            </a>
          ))}
        </div>
      </div></section>

      {/* ── Pricing: prezzi REALI da lib/commercial-plan.ts (display USD $).
           ⚠️ Il mockup mostrava 19.90/49.90 — qui i valori LIVE 14.99/29.99 (flag PR). ── */}
      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">{v.pcEyebrow}</div><h2>{v.pcHead}</h2></div>
        <div className="v-tiers">
          <div className="v-tier">
            <div className="name">{v.pcFree}</div><div className="price">$0</div>
            <ul>{v.pcFreeList.map((li) => <li key={li}>{li}</li>)}</ul>
            <button type="button" className="v-btn v-btn--utility" style={{ alignSelf: "flex-start" }} onClick={() => setAuthModal("create")}>{t.register}</button>
          </div>
          <div className="v-tier">
            <div className="name">{v.pcBase}</div><div className="price">${PUBLIC_PAID_PLANS.base.amountUsdt}<small>{v.pcMo}</small></div>
            <ul>{v.pcBaseList.map((li) => <li key={li}>{li}</li>)}</ul>
            <a href="/app?tab=account" className="v-btn v-btn--secondary" style={{ alignSelf: "flex-start" }}>{v.pcBase}</a>
          </div>
          <div className="v-tier pro">
            <div className="name">{v.pcPro} <span className="best">{v.pcBest}</span></div><div className="price">${PUBLIC_PAID_PLANS.premium.amountUsdt}<small>{v.pcMo}</small></div>
            <ul>{v.pcProList.map((li) => <li key={li}>{li}</li>)}</ul>
            <a href="/app?tab=account" className="v-btn v-btn--primary" style={{ alignSelf: "flex-start" }}>{v.pcPro}</a>
          </div>
        </div>
      </div></section>

      {/* ── Final CTA ── */}
      <section className="v-final"><div className="v-wrap">
        <h2>{v.fnHead1}<span className="g">{v.fnHeadG}</span></h2>
        <p>{v.fnBody}</p>
        <div className="v-actions">
          <a href="/app?tab=bets" className="v-btn v-btn--primary">{v.ctaTerminal}</a>
          <a href="/app?tab=history" className="v-btn v-btn--secondary">{v.ctaBrowse}</a>
        </div>
      </div></section>

      {/* ── House billboard (#HOUSE-BANNERS-1) — creatività house reali, tenuto ── */}
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
