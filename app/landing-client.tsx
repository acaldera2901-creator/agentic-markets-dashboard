"use client";

// ── BetRedge — Landing pubblica (#LANDING-BETREDGE-1) ────────────────────────
// Prima pagina su "/". Ricrea l'inspo BetRedge (hero split football/tennis,
// scie energia coral/cobalt, 4 card) interamente in CSS/SVG (nessuna foto).
// Le CTA reindirizzano nel desk sui path per-tab (#URL-PATHS-0810: /predictions?sport=…, /plans, …).
// Stile: dark energetico sportsbook su token --am-* + font Hanken/JetBrains.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";
import { SportIcon } from "@/app/components/sport-icon";
import LandingCarousel from "@/app/components/LandingCarousel"; // #HOME-BETMODE-1
import { HouseBanner } from "@/components/HouseBanner";
import { WidgetLivePreview } from "@/components/WidgetLivePreview";
import { pickCampaign } from "@/lib/house-banners";
import LangDropdown from "@/components/LangDropdown";
import { SiteFooter } from "@/components/SiteFooter";
import { LiveChat } from "@/components/LiveChat";
import { HomeAuthModal, type HomeAuthIntent } from "@/components/auth/HomeAuthModal";
import { writeRefCode } from "@/lib/referral-code";
import { PUBLIC_PAID_PLANS } from "@/lib/commercial-plan"; // #HOME-V3: prezzi reali (no fabbricazione)
// #SEO-ORPHANS-0908: elenco unico guide/pillar, condiviso con footer, /tools e /blog.
import { BLOG_INDEX, LEARN_GUIDES, LEARN_PILLARS, guideHref } from "@/lib/learn-links";
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
    spAllSports: "Tutti gli sport", spFootball: "Calcio", spTennis: "Tennis", spWorldCup: "Mondiali", spTools: "Strumenti",
    cardTrackTag: "La prova", cardTrack: "Track record", cardTrackDesc: "Hit-rate su pick concluse, registrate prima dell'evento.", cardTrackBtn: "Storico",
    cardModel: "Modello vs Mercato", cardModelDesc: "Perché il modello sceglie una pick: probabilità calibrate confrontate con la quota.", cardModelBtn: "Scopri",
    cardPlans: "Piani", cardPlansDesc: "Free per provare · Base 14.99 · Pro 29.99 USDT/mese.", cardPlansBtn: "Vedi i piani",
    risk: "Nota rischio: BetRedge mostra analisi probabilistiche. Non garantisce profitti e non sostituisce la gestione del rischio personale. I risultati passati non garantiscono risultati futuri. 18+.",
    privacy: "Privacy",
    // ── Edge Scanner (value-prop) ──
    waEyebrow: "MOTORE DI PROBABILITÀ · NON UN BOOKMAKER",
    // #CONVERSION-COPY-0916: hero da "manifesto" a "risposta di prodotto" (audit Tommy §2).
    waHead1: "Leggi la quota",
    waHead2: "prima di seguire il pronostico.",
    waBody: "BetRedge confronta la probabilità implicita del mercato con un modello calibrato, mostra lo scarto e spiega il ragionamento prima del fischio d'inizio.",
    waKpi1Val: "Hit-rate", waKpi1Lab: "su pick concluse", waKpi2Lab: "prima del fischio",
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
    // #CONVERSION-COPY-0916: i 5 tempi con cui si legge una scheda (audit §5).
    hwEyebrow: "COME SI LEGGE UNA SCHEDA",
    hwHead: "Mercato. Modello. Edge. Perché. Registro.",
    hwS1: "Mercato", hwS1Desc: "Cosa implica la quota, una volta convertita in probabilità.",
    hwS2: "Modello", hwS2Desc: "La stima calibrata di BetRedge sul contesto disponibile della partita.",
    hwS3: "Edge", hwS3Desc: "La differenza tra le due probabilità. Uno scarto, non una garanzia.",
    hwS4: "Perché", hwS4Desc: "I fattori che hanno pesato davvero sulla lettura.",
    hwS5: "Registro", hwS5Desc: "Registrata prima del fischio. Resta visibile dopo la chiusura.",
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
    spAllSports: "All Sports", spFootball: "Football", spTennis: "Tennis", spWorldCup: "World Cup", spTools: "Free tools",
    cardTrackTag: "The proof", cardTrack: "Track record", cardTrackDesc: "Hit rate on settled picks, logged before kickoff.", cardTrackBtn: "History",
    cardModel: "Model vs Market", cardModelDesc: "Why the model picks a bet: calibrated probabilities against the odds.", cardModelBtn: "Discover",
    cardPlans: "Plans", cardPlansDesc: "Free to try · Base 14.99 · Pro 29.99 USDT/month.", cardPlansBtn: "See plans",
    risk: "Risk note: BetRedge shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management. Past results do not guarantee future results. 18+.",
    privacy: "Privacy",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "PROBABILITY ENGINE · NOT A BOOKMAKER",
    waHead1: "Read the odds",
    waHead2: "before you follow the pick.",
    waBody: "BetRedge compares the market’s implied probability with a calibrated model, shows the gap, and explains the reasoning before kick-off.",
    waKpi1Val: "Hit rate", waKpi1Lab: "on settled picks", waKpi2Lab: "logged pre-match",
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
    hwEyebrow: "HOW TO READ THE CARD",
    hwHead: "Market. Model. Edge. Why. Record.",
    hwS1: "Market", hwS1Desc: "What the odds imply once converted into probability.",
    hwS2: "Model", hwS2Desc: "BetRedge’s calibrated estimate from the available match context.",
    hwS3: "Edge", hwS3Desc: "The difference between those two probabilities. A gap, not a guarantee.",
    hwS4: "Why", hwS4Desc: "The factors that materially shaped the reading.",
    hwS5: "Record", hwS5Desc: "Logged before kick-off. Still visible after settlement.",
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
    spAllSports: "Todos los deportes", spFootball: "Fútbol", spTennis: "Tenis", spWorldCup: "Mundial", spTools: "Herramientas",
    cardTrackTag: "La prueba", cardTrack: "Track record", cardTrackDesc: "Acierto en apuestas cerradas, registradas antes del partido.", cardTrackBtn: "Historial",
    cardModel: "Modelo vs Mercado", cardModelDesc: "Por qué el modelo elige una pick: probabilidades calibradas frente a la cuota.", cardModelBtn: "Descubre",
    cardPlans: "Planes", cardPlansDesc: "Free para probar · Base 14.99 · Pro 29.99 USDT/mes.", cardPlansBtn: "Ver planes",
    risk: "Nota de riesgo: BetRedge muestra análisis probabilísticos. No garantiza beneficios y no sustituye la gestión personal del riesgo. Los resultados pasados no garantizan resultados futuros. 18+.",
    privacy: "Privacidad",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "MOTOR DE PROBABILIDAD · NO UN BOOKMAKER",
    waHead1: "Lee la cuota",
    waHead2: "antes de seguir el pronóstico.",
    waBody: "BetRedge compara la probabilidad implícita del mercado con un modelo calibrado, muestra la diferencia y explica el razonamiento antes del pitido inicial.",
    waKpi1Val: "Acierto", waKpi1Lab: "en apuestas cerradas", waKpi2Lab: "antes del partido",
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
    hwEyebrow: "CÓMO LEER LA FICHA",
    hwHead: "Mercado. Modelo. Edge. Porqué. Registro.",
    hwS1: "Mercado", hwS1Desc: "Lo que implica la cuota una vez convertida en probabilidad.",
    hwS2: "Modelo", hwS2Desc: "La estimación calibrada de BetRedge con el contexto disponible del partido.",
    hwS3: "Edge", hwS3Desc: "La diferencia entre esas dos probabilidades. Una brecha, no una garantía.",
    hwS4: "Porqué", hwS4Desc: "Los factores que realmente pesaron en la lectura.",
    hwS5: "Registro", hwS5Desc: "Registrada antes del pitido. Sigue visible tras el cierre.",
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
    spAllSports: "Tous les sports", spFootball: "Football", spTennis: "Tennis", spWorldCup: "Coupe du Monde", spTools: "Outils",
    cardTrackTag: "La preuve", cardTrack: "Track record", cardTrackDesc: "Taux de réussite sur paris clôturés, enregistrés avant le match.", cardTrackBtn: "Historique",
    cardModel: "Modèle vs Marché", cardModelDesc: "Pourquoi le modèle choisit un pari : probabilités calibrées face à la cote.", cardModelBtn: "Découvrir",
    cardPlans: "Offres", cardPlansDesc: "Free pour essayer · Base 14.99 · Pro 29.99 USDT/mois.", cardPlansBtn: "Voir les offres",
    risk: "Note de risque : BetRedge montre des analyses probabilistes. Elle ne garantit pas de profits et ne remplace pas la gestion personnelle du risque. Les résultats passés ne garantissent pas les résultats futurs. 18+.",
    privacy: "Confidentialité",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "MOTEUR DE PROBABILITÉ · PAS UN BOOKMAKER",
    waHead1: "Lis la cote",
    waHead2: "avant de suivre le prono.",
    waBody: "BetRedge compare la probabilité implicite du marché à un modèle calibré, montre l’écart et explique le raisonnement avant le coup d’envoi.",
    waKpi1Val: "Réussite", waKpi1Lab: "sur paris clôturés", waKpi2Lab: "avant le match",
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
    hwEyebrow: "COMMENT LIRE LA FICHE",
    hwHead: "Marché. Modèle. Edge. Pourquoi. Registre.",
    hwS1: "Marché", hwS1Desc: "Ce que la cote implique une fois convertie en probabilité.",
    hwS2: "Modèle", hwS2Desc: "L’estimation calibrée de BetRedge à partir du contexte disponible du match.",
    hwS3: "Edge", hwS3Desc: "La différence entre ces deux probabilités. Un écart, pas une garantie.",
    hwS4: "Pourquoi", hwS4Desc: "Les facteurs qui ont réellement pesé sur la lecture.",
    hwS5: "Registre", hwS5Desc: "Enregistrée avant le coup d’envoi. Toujours visible après le règlement.",
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
    spAllSports: "Все виды спорта", spFootball: "Футбол", spTennis: "Теннис", spWorldCup: "ЧМ", spTools: "Инструменты",
    cardTrackTag: "Доказательство", cardTrack: "Track record", cardTrackDesc: "Точность попаданий по закрытым прогнозам. Прогнозы фиксируются до начала.", cardTrackBtn: "История",
    cardModel: "Модель vs Рынок", cardModelDesc: "Почему модель выбирает ставку: калиброванные вероятности против коэффициента.", cardModelBtn: "Узнать",
    cardPlans: "Тарифы", cardPlansDesc: "Free для пробы · Base 14.99 · Pro 29.99 USDT/мес.", cardPlansBtn: "Тарифы",
    risk: "Примечание о риске: BetRedge показывает вероятностный анализ. Он не гарантирует прибыль и не заменяет личное управление рисками. Прошлые результаты не гарантируют будущих результатов. 18+.",
    privacy: "Конфиденциальность",
    // ── What is BetRedge (value-prop) ──
    waEyebrow: "ДВИЖОК ВЕРОЯТНОСТЕЙ · НЕ БУКМЕКЕР",
    waHead1: "Сначала коэффициент,",
    waHead2: "потом прогноз.",
    waBody: "BetRedge сравнивает подразумеваемую рынком вероятность с калиброванной моделью, показывает разрыв и объясняет логику до стартового свистка.",
    waKpi1Val: "Точность", waKpi1Lab: "по закрытым прогнозам", waKpi2Lab: "до матча",
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
    hwEyebrow: "КАК ЧИТАТЬ КАРТОЧКУ",
    hwHead: "Рынок. Модель. Edge. Почему. Запись.",
    hwS1: "Рынок", hwS1Desc: "Что подразумевает коэффициент, переведённый в вероятность.",
    hwS2: "Модель", hwS2Desc: "Калиброванная оценка BetRedge по доступному контексту матча.",
    hwS3: "Edge", hwS3Desc: "Разница между этими двумя вероятностями. Разрыв, а не гарантия.",
    hwS4: "Почему", hwS4Desc: "Факторы, которые реально повлияли на оценку.",
    hwS5: "Запись", hwS5Desc: "Зафиксирована до свистка. Остаётся видимой после расчёта.",
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
  { match: "Brazil–Argentina", glyph: "trophy", model: 49, market: 42, edge: 7.1 },
  { match: "Inter–Napoli", glyph: "ball", model: 54, market: 48, edge: 6.2 },
  { match: "Sinner–Zverev", glyph: "tball", model: 66, market: 61, edge: 5.4 },
  { match: "Bayern–Dortmund", glyph: "ball", model: 58, market: 54, edge: 4.1 },
];

// ── #HOME-V3 copy ("Live Terminal + Proof Spine") ───────────────────────────
// Copy NUOVO delle sezioni editoriali v3. Le sezioni hero + how-it-works riusano
// la COPY esistente (waEyebrow/waHead*/waBody/hw*), già tradotta e FTC-safe.
// EN + IT completi; es/fr/ru ricadono su EN (localizzazione = follow-up).
type V3Copy = {
  inviteHead: string; inviteBody: string;
  ctaTerminal: string; ctaTrack: string; ctaBrowse: string;
  // #CONVERSION-COPY-0916 (audit Tommy §2/§4/§6/§7): prima azione + riga di
  // rassicurazione sotto l'hero, striscia «ogni lettura mostra», CTA del
  // registro, sottotitoli/CTA/nota dei piani, riga di fiducia finale.
  ctaFirst: string; heroNote: string;
  stripKick: string; stripItems: string[];
  prCta: string;
  pcFreeTag: string; pcBaseTag: string; pcProTag: string;
  pcCtaFree: string; pcCtaBase: string; pcCtaPro: string; pcNote: string;
  fnNote: string;
  // #CLV-CLAIM-0831: `chipClv` RIMOSSO. Era il chip di fiducia «CLV verified»
  // sulla landing pubblica, accanto a due claim veri (sigillata prima del
  // fischio, calibrata). Quel terzo non era vero: misurato il 31/08 su
  // produzione, 0 righe su 3.730 in unified_predictions hanno closing_odds o
  // closing_line_value, e 1 su 1.127 in pick_settlement. Non e' un ritardo di
  // popolamento: le quote di chiusura degli ultimi 30 giorni coprono OTTO
  // partite dalla sola fonte che per regola di sistema puo' alimentare il
  // prodotto (odds_api), e nessuna delle otto compare in pick_ledger — le altre
  // 1.169 righe `is_closing` vengono da stake/roobet, la via che alimenta solo
  // la misura. Un claim di verifica senza il dato che lo verifica va tolto,
  // non riformulato. Vedi lib/landing-claims.test.ts prima di rimetterlo.
  chipLogged: string; chipCal: string;
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
  wgKick: string; wgHead: string; wgBody: string; wgCta: string;
  // #SEO-ORPHANS-0908 — contorno del blocco guide. I titoli delle guide NON
  // stanno qui: sono quelli veri degli articoli (inglesi) e vivono in
  // lib/learn-links.ts. Qui solo il testo che si traduce davvero.
  gdEyebrow: string; gdHead: string; gdSub: string; gdAlso: string; gdAll: string;
};
const V3_EN: V3Copy = {
  inviteHead: "Your invite is live", inviteBody: "days of PRO, free — unlocked when you confirm your email.",
  ctaTerminal: "Open the terminal", ctaTrack: "See the track record", ctaBrowse: "Browse the track record",
  ctaFirst: "Read your first match free", heroNote: "No card required · No automatic bets · You make the call",
  stripKick: "Every reading shows",
  stripItems: ["Model probability", "Market-implied probability", "Edge", "Reasoning", "Pre-kick-off timestamp", "Settled public result"],
  chipLogged: "Logged before kick-off", chipCal: "Calibrated, not hyped",
  anEyebrow: "Your first reading", anHead: "Exactly what you read.", anSub: "One card, every layer — nothing hidden, nothing hyped. This is the exact card from the board.",
  anCapLive: "Live reading — the exact card component from the board.",
  anCapRepr: "Representative reading — the exact card component from the board.",
  anNotes: [
    { lab: "Model lean", strong: "The side the model leans to, stated plainly.", body: "One side — or “no clear favourite” when the model is below its floor. We never force one." },
    { lab: "Probability", strong: "Calibrated, not inflated.", body: "71% means the model expects it to land close to 71 times in 100 over the long run." },
    { lab: "Market", strong: "The price, made comparable.", body: "We convert the book’s odds to an implied probability, so model and market sit side by side." },
    { lab: "Edge", strong: "The gap, quantified.", body: "Where the model sees more value than the price implies — never a promise of profit." },
    { lab: "Deep Analysis", strong: "The “why”, in the open.", body: "Form, xG, injuries, Elo, serve/return, H2H, surface — reasoning, not a black box." },
  ],
  prEyebrow: "The proof", prHead: "The receipts come first.", prBadge: "LOGGED PRE-KICK-OFF",
  prMeta: (n) => `${n} settled readings, each time-stamped before the whistle. This is the settled hit-rate — past performance, not a forecast. Nothing edited after the fact.`,
  prMetaQual: "Every reading is time-stamped before the whistle and settled on the public record — past performance, not a forecast. Nothing edited after the fact.",
  prWall: "PUBLIC RECORD", prColMatch: "MATCH", prColRes: "RESULT",
  prCta: "View the full record",
  prQuote: "Below our confidence floor we publish “no clear favourite” rather than manufacture a pick — and it stays on the record too.",
  prQuoteSub: " Calibrated, never hyped — the difference between a probability engine and a tipster.",
  // #CONVERSION-COPY-0916 (audit §3): via le etichette da tipster (Best Bets,
  // house multi, in-play) — il prodotto è lo stesso, il nome dice cosa mostra.
  suEyebrow: "The board", suHead: "Four ways to read the market.", suSub: "One engine, four surfaces — from a single fixture to the whole week. Readings, not tips.",
  suItems: [
    { pk: "Model Edges", pn: "Today’s market gaps", p: "Fixtures where BetRedge’s calibrated probability differs materially from the market-implied probability, ranked by edge. Filter by sport and market.", ps: "refreshed live · ", psB: "edge-ranked" },
    { pk: "Weekly Model Case", pn: "The weekly combination model", p: "One combination of markets a week, built by the model and frozen the moment it’s published — every leg time-stamped before kick-off.", ps: "frozen at publish · ", psB: "fully logged" },
    { pk: "Build a Probability View", pn: "Combine markets on one fixture", p: "Stack markets across a fixture and watch the blended probability and implied edge recompute as you add legs.", ps: "live probability · ", psB: "per leg" },
    { pk: "Live Probability Board", pn: "The board, as the match moves", p: "Probabilities that update as the match state changes — the same reading, in real time. No automatic execution.", ps: "live · ", psB: "updating" },
  ],
  pcEyebrow: "Access", pcHead: "Start free. Read deeper when you need it.",
  pcFree: "Free", pcBase: "Base", pcPro: "Pro", pcBest: "FULL RESEARCH BOARD", pcMo: " / mo",
  pcFreeTag: "For learning how the board works.", pcBaseTag: "For the full pre-match picture.", pcProTag: "For full access to the probability board.",
  pcCtaFree: "Read a match free", pcCtaBase: "Start Base", pcCtaPro: "Unlock Pro",
  pcNote: "Monthly billing · No bookmaker account required · No bets placed for you · No guaranteed returns · 18+",
  // #FREE-BASE-DAILY-QUOTA-0831 — i tre elenchi dicono ora quello che il gate
  // consegna davvero. Base NON aveva "Deep Analysis su ogni scheda" (è Pro-only,
  // la proiezione gliela toglie) né "tutto il feed" (è a quota): due claim che il
  // prodotto non manteneva.
  pcFreeList: ["3 model readings per sport, every day", "Public pre-kick-off record", "Probability, market price and a preview of the edge", "No card required"],
  // #CLV-CLAIM-0831: «closing line value» tolto anche dalla lista Base — è lo
  // stesso claim del chip rimosso il 31/08, misurato senza dato dietro.
  pcBaseList: ["7 model readings per sport, every day", "Full edge % and stake context", "Weekly Model Case", "Full public record"],
  pcProList: ["Everything in Base, with no daily cap", "Deep analysis on every match card", "Live Probability Board", "Build a Probability View"],
  fnHead1: "Read your first match ", fnHeadG: "free.", fnBody: "See a calibrated probability, its edge, and the reasoning — then make your own call. No card required to start.",
  fnNote: "No tips. No black box. No guaranteed returns. You make the call.",
  // #WIDGET-LANDING-0824 — richiamo ai proprietari di siti: il widget è un canale
  // di acquisizione, e questa riga è il solo posto in home in cui esiste.
  // #CONVERSION-COPY-0916 (audit §7): vende un livello di probabilità
  // trasparente, non «i nostri pronostici» — il B2B non parla da tipster.
  wgKick: "For publishers", wgHead: "Give your audience a transparent probability layer.",
  wgBody: "Add live BetRedge match readings to your site with one lightweight embed. The board updates itself, links back to the underlying analysis and attributes referred readers to your account.",
  wgCta: "Explore the publisher widget",
  gdEyebrow: "Guides",
  gdHead: "Five terms, in the order they build.",
  gdSub: "Each one is the piece the next one needs. Plain English, no tips — and where a calculator does the sum, it is linked next to it.",
  gdAlso: "How the model works",
  gdAll: "All guides",
};
const V3_IT: V3Copy = {
  inviteHead: "Il tuo invito è attivo", inviteBody: "giorni di PRO, gratis — si attivano quando confermi la mail.",
  ctaTerminal: "Apri il terminale", ctaTrack: "Vedi il track record", ctaBrowse: "Sfoglia il track record",
  ctaFirst: "Leggi la tua prima partita gratis", heroNote: "Senza carta · Nessuna scommessa automatica · Decidi tu",
  stripKick: "Ogni lettura mostra",
  stripItems: ["Probabilità del modello", "Probabilità implicita del mercato", "Edge", "Ragionamento", "Timestamp prima del fischio", "Esito pubblico concluso"],
  chipLogged: "Registrata prima del fischio", chipCal: "Calibrata, mai gonfiata",
  anEyebrow: "La tua prima lettura", anHead: "Esattamente cosa leggi.", anSub: "Una scheda, ogni livello — niente nascosto, niente hype. È la scheda identica a quella sulla board.",
  anCapLive: "Lettura live — il componente scheda identico a quello della board.",
  anCapRepr: "Lettura rappresentativa — il componente scheda identico a quello della board.",
  anNotes: [
    { lab: "Lean del modello", strong: "Il lato verso cui pende il modello, detto chiaro.", body: "Un solo lato — o “nessun favorito chiaro” quando il modello è sotto la soglia. Non lo forziamo mai." },
    { lab: "Probabilità", strong: "Calibrata, non gonfiata.", body: "71% significa che il modello se l’aspetta vicino a 71 volte su 100 nel lungo periodo." },
    { lab: "Mercato", strong: "La quota, resa comparabile.", body: "Convertiamo la quota del book in probabilità implicita, così modello e mercato stanno affiancati." },
    { lab: "Edge", strong: "Lo scarto, quantificato.", body: "Dove il modello vede più valore di quanto implichi la quota — mai una promessa di profitto." },
    { lab: "Deep Analysis", strong: "Il “perché”, in chiaro.", body: "Forma, xG, infortuni, Elo, servizio/risposta, H2H, superficie — ragionamento, non scatola nera." },
  ],
  prEyebrow: "La prova", prHead: "Prima vengono le ricevute.", prBadge: "REGISTRATA PRIMA DEL FISCHIO",
  prMeta: (n) => `${n} letture concluse, ciascuna con timestamp prima del fischio. Questo è l’hit-rate concluso — risultati passati, non una previsione. Nulla modificato a posteriori.`,
  prMetaQual: "Ogni lettura ha un timestamp prima del fischio ed è conclusa sul registro pubblico — risultati passati, non una previsione. Nulla modificato a posteriori.",
  prWall: "REGISTRO PUBBLICO", prColMatch: "MATCH", prColRes: "ESITO",
  prCta: "Vedi il registro completo",
  prQuote: "Sotto la soglia di confidenza pubblichiamo “nessun favorito chiaro” invece di fabbricare una pick — e resta nel registro anche quello.",
  prQuoteSub: " Calibrata, mai gonfiata — la differenza tra un motore di probabilità e un tipster.",
  suEyebrow: "Il board", suHead: "Quattro modi di leggere il mercato.", suSub: "Un motore, quattro superfici — dalla singola partita all’intera settimana. Letture, non dritte.",
  suItems: [
    { pk: "Model Edges", pn: "Gli scarti di mercato di oggi", p: "Le partite dove la probabilità calibrata di BetRedge si discosta in modo rilevante da quella implicita del mercato, ordinate per edge. Filtra per sport e mercato.", ps: "aggiornato live · ", psB: "ordinato per edge" },
    { pk: "Weekly Model Case", pn: "Il modello combinato della settimana", p: "Una combinazione di mercati a settimana, costruita dal modello e congelata al momento della pubblicazione — ogni selezione con timestamp prima del fischio.", ps: "congelata alla pubblicazione · ", psB: "tutto registrato" },
    { pk: "Costruisci una vista di probabilità", pn: "Combina i mercati di una partita", p: "Sovrapponi mercati su una partita e guarda probabilità ed edge combinati ricalcolarsi mentre aggiungi selezioni.", ps: "probabilità live · ", psB: "per selezione" },
    { pk: "Board di probabilità live", pn: "Il board, mentre la partita si muove", p: "Probabilità che si aggiornano al cambiare dello stato della partita — la stessa lettura, in tempo reale. Nessuna esecuzione automatica.", ps: "live · ", psB: "in aggiornamento" },
  ],
  pcEyebrow: "Accesso", pcHead: "Inizia gratis. Leggi più a fondo quando ti serve.",
  pcFree: "Free", pcBase: "Base", pcPro: "Pro", pcBest: "BOARD DI RICERCA COMPLETO", pcMo: " / mese",
  pcFreeTag: "Per imparare come funziona il board.", pcBaseTag: "Per il quadro pre-partita completo.", pcProTag: "Per l’accesso completo al board di probabilità.",
  pcCtaFree: "Leggi una partita gratis", pcCtaBase: "Inizia con Base", pcCtaPro: "Sblocca Pro",
  pcNote: "Fatturazione mensile · Nessun conto bookmaker richiesto · Nessuna scommessa piazzata per te · Nessun rendimento garantito · 18+",
  pcFreeList: ["3 letture del modello per sport, ogni giorno", "Registro pubblico prima del fischio", "Probabilità, quota di mercato e un’anteprima dell’edge", "Senza carta"],
  pcBaseList: ["7 letture del modello per sport, ogni giorno", "Edge % completo e contesto di stake", "Weekly Model Case", "Registro pubblico completo"],
  pcProList: ["Tutto ciò che c’è in Base, senza tetto giornaliero", "Deep analysis su ogni scheda", "Board di probabilità live", "Costruisci una vista di probabilità"],
  fnHead1: "Leggi la tua prima partita ", fnHeadG: "gratis.", fnBody: "Vedi una probabilità calibrata, il suo edge e il ragionamento — poi decidi tu. Nessuna carta per iniziare.",
  fnNote: "Niente dritte. Niente scatola nera. Nessun rendimento garantito. Decidi tu.",
  wgKick: "Per gli editori", wgHead: "Dai al tuo pubblico un livello di probabilità trasparente.",
  wgBody: "Aggiungi le letture live di BetRedge al tuo sito con un embed leggero. Il board si aggiorna da solo, rimanda all’analisi sottostante e attribuisce a te i lettori che porta.",
  wgCta: "Scopri il widget per editori",
  gdEyebrow: "Guide",
  gdHead: "Cinque termini, nell\u2019ordine in cui si reggono.",
  gdSub: "Ognuno \u00e8 il pezzo che serve al successivo. Sono in inglese, senza dritte \u2014 e dove il conto lo fa un calcolatore, il calcolatore \u00e8 linkato accanto.",
  gdAlso: "Come funziona il modello",
  gdAll: "Tutte le guide",
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mounted + lingua e tema da localStorage: il pattern SSR-safe canonico, e lo storage va letto solo dopo il mount (#STORAGE-CRASH-0813)
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
    // #UI-MACHINA-0802: default SCURO, non quello del sistema — vedi app/layout.tsx.
    if (t !== "light" && t !== "dark") {
      t = "dark";
    }
    setTheme(t as "dark" | "light");
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  // #THEME-CONSISTENCY-0623 → superato da #UI-MACHINA-0802: l'ascolto del tema di
  // sistema è rimosso anche qui, così landing e desk restano sullo stesso
  // contratto (default scuro, scelta manuale che vince e persiste).

  // #PRICING-CREATORS-0706: i link invito creator (/r/CODICE) atterrano QUI con
  // ?ref=. First-touch identico al desk (#MB-1): persistiamo una volta sola in
  // localStorage (am_ref) — il register (in-place o dal desk) lo allega al
  // payload → profiles.referred_by. Mai sovrascritto se già presente.
  useEffect(() => {
    // writeRefCode: normalizza + first-touch + timestamp (scadenza 60gg). Fail-soft.
    try { writeRefCode(new URLSearchParams(window.location.search).get("ref") ?? ""); } catch { /* no-op */ }
  }, []);

  // #TG-TRIAL-SITE: se si arriva con un link invito interno, la pagina DEVE dire
  // cosa dà — il canale Telegram promette «3 giorni di PRO» e una promessa che
  // la pagina non conferma vale zero. La fetch parte solo con ?ref= presente, e
  // un 404 (codice creator o inesistente) non mostra niente: fail-soft.
  const [inviteDays, setInviteDays] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    let code = "";
    try { code = new URLSearchParams(window.location.search).get("ref") ?? ""; } catch { /* no-op */ }
    if (!code) return;
    (async () => {
      try {
        const r = await fetch(`/api/invite?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { ok?: boolean; days?: number };
        if (!cancelled && j.ok && typeof j.days === "number") setInviteDays(j.days);
      } catch { /* no-op */ }
    })();
    return () => { cancelled = true; };
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
    <div className="lp hv3 mc-scene-stadium" data-mounted={mounted ? "1" : "0"} data-mc-ground>
      {/* #UI-MACHINA-0802 — la scena del fondo cinematico: fissa, sfocata, sotto
          la velatura di [data-mc-ground]::after. Decorazione, non contenuto. */}
      <span className="bgfix" aria-hidden="true" />
      <SportGlyphSprite />

      {/* #TG-TRIAL-SITE: banda invito — appare SOLO con un codice interno valido */}
      {inviteDays != null && (
        <div className="lp-invite" role="status">
          <span className="lp-invite-dot" aria-hidden="true" />
          <strong>{v.inviteHead}:</strong>
          <span>&nbsp;{inviteDays} {v.inviteBody}</span>
        </div>
      )}

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
              <Link href="/plans" className="am-acct" title={auth.identifier}>
                {auth.name || auth.identifier}<span className="plan">{planPillLabel(auth.plan)}</span>
              </Link>
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

      {/* ── Sport quick-nav (#HOME-V3-SPORTNAV): ripristina la barra sport della home
           pre-v3 (rimossa nel redesign) nella FORMA squadrata v3 (toolbar segmentata,
           mono uppercase, divisori). Icone sport RASTER reali (/banners/*-sm.png).
           Deep-link identici agli originali: sport→board filtrata, WC→hub /world-cup.
           LIVE = board live-first (in-play in cima) con pulse-dot di stato. Su mobile
           scrolla in orizzontale DENTRO la riga, non il body. ── */}
      <nav className="v-sportnav-wrap" aria-label="Sports">
        <div className="v-sportnav">
          <Link href="/predictions?sport=all" className="v-sportbtn">
            <img className="v-sportbtn-ic" src="/banners/sport-allsports-sm.png" alt="" aria-hidden="true" />
            {t.spAllSports}
          </Link>
          <Link href="/predictions?sport=football" className="v-sportbtn">
            <img className="v-sportbtn-ic" src="/banners/sport-football-sm.png" alt="" aria-hidden="true" />
            {t.spFootball}
          </Link>
          <Link href="/predictions?sport=tennis" className="v-sportbtn">
            <img className="v-sportbtn-ic" src="/banners/sport-tennis-sm.png" alt="" aria-hidden="true" />
            {t.spTennis}
          </Link>
          {/* #TOOLS-HUB-0805: lo slot che era della World Cup (torneo finito) porta
              ai calcolatori gratuiti — pagina pubblica, senza login, pensata per
              il traffico organico. L'hub WC resta online, fuori dalla nav. */}
          <Link href="/tools" className="v-sportbtn v-sportbtn--tools">
            <img className="v-sportbtn-ic" src="/icons/menu-tools-sm.png" alt="" aria-hidden="true" />
            {t.spTools}
          </Link>
          <Link href="/predictions?sport=all" className="v-sportbtn v-sportbtn--live">
            <span className="dot" aria-hidden="true" />
            LIVE
          </Link>
        </div>
      </nav>

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
            <Link href="/predictions" className="v-btn v-btn--primary">{v.ctaFirst}</Link>
            <Link href="/history" className="v-btn v-btn--secondary">{v.ctaTrack}</Link>
          </div>
          {/* #CONVERSION-COPY-0916: la riga di rassicurazione sotto la prima azione
              (senza carta · nessuna scommessa automatica · decidi tu). È testo, non
              un terzo chip: i due chip sotto sono claim misurati sul prodotto e la
              guardia lib/landing-claims.test.ts li conta. */}
          <p className="v-hero-note">{v.heroNote}</p>
          <div className="v-trust">
            <span className="trust-chip"><span className="trust-chip-dot">●</span> {v.chipLogged}</span>
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
      </div>
      {/* ── #CONVERSION-COPY-0916 — striscia «ogni lettura mostra» (audit §4).
           Chiude l'hero con l'elenco dei sei pezzi che una lettura porta sempre:
           è l'indice della scheda che segue, non un'altra fila di chip. Mono,
           fra due filetti, i termini separati da un punto — una riga di
           registro, che è quello che promette. ── */}
      <div className="v-wrap">
        <ol className="v-strip" aria-label={v.stripKick}>
          <li className="k">{v.stripKick}</li>
          {v.stripItems.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </div></section>

      {/* ── La prima lettura (#CONVERSION-COPY-0916: spostata QUI, subito sotto
           l'hero, da dopo «come funziona» — la prova prima della filosofia, audit
           §4/§9). La scheda è il COMPONENTE BOARD REALE (TennisMatchCard), reso
           1:1 col prodotto (unlocked/full: pick, prob, edge, confidenza,
           "Perché"/Deep Analysis). Alimentato da un match reale di /api/tennis
           quando disponibile, altrimenti una pick rappresentativa onesta — la
           didascalia dice quale delle due. Le note attorno spiegano le parti. ── */}
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

      {/* ── Come si legge la scheda: banda editoriale a 5 tempi (NON scalette
           numerate). #CONVERSION-COPY-0916: da Segnale→Spiegazione→Decisione→
           Verifica a Mercato→Modello→Edge→Perché→Registro (audit §5) — l'ordine
           in cui i numeri della scheda qui sopra si costruiscono l'uno sull'altro. ── */}
      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">{t.hwEyebrow}</div><h2>{t.hwHead}</h2></div>
        <div className="v-flow v-flow--5">
          <div className="fs"><h3>{t.hwS1}</h3><p>{t.hwS1Desc}</p></div>
          <div className="fs"><h3>{t.hwS2}</h3><p>{t.hwS2Desc}</p></div>
          <div className="fs"><h3>{t.hwS3}</h3><p>{t.hwS3Desc}</p></div>
          <div className="fs"><h3>{t.hwS4}</h3><p>{t.hwS4Desc}</p></div>
          <div className="fs"><h3>{t.hwS5}</h3><p>{t.hwS5Desc}</p></div>
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
        {/* #CONVERSION-COPY-0916 (audit §4): il registro ha un'uscita esplicita. */}
        <div className="v-proof-cta"><Link href="/history" className="v-btn v-btn--utility">{v.prCta}</Link></div>
      </div></section>

      {/* ── Suite: 4 superfici di prodotto (feature reali, deep-link nel desk) ── */}
      <section className="v-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">{v.suEyebrow}</div><h2>{v.suHead}</h2><p>{v.suSub}</p></div>
        <div className="v-suite">
          {v.suItems.map((it, i) => (
            <a className="v-prow" key={it.pk} href={["/predictions", "/weekly-pick", "/match-builder", "/predictions"][i]}>
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
        {/* #CONVERSION-COPY-0916 (audit §6): ogni piano dice per chi è (.tag) e
            il tasto dice cosa succede (leggi/inizia/sblocca), non il nome del
            piano ripetuto. La nota sotto i tre risponde alle domande che
            altrimenti finiscono in FAQ: cadenza, niente bookmaker, niente
            scommesse per te, niente rendimento garantito, 18+. */}
        <div className="v-tiers">
          <div className="v-tier">
            <div className="name">{v.pcFree}</div><div className="price">$0</div>
            <p className="tag">{v.pcFreeTag}</p>
            <ul>{v.pcFreeList.map((li) => <li key={li}>{li}</li>)}</ul>
            <button type="button" className="v-btn v-btn--utility" style={{ alignSelf: "flex-start" }} onClick={() => setAuthModal("create")}>{v.pcCtaFree}</button>
          </div>
          <div className="v-tier">
            <div className="name">{v.pcBase}</div><div className="price">${PUBLIC_PAID_PLANS.base.amountUsdt}<small>{v.pcMo}</small></div>
            <p className="tag">{v.pcBaseTag}</p>
            <ul>{v.pcBaseList.map((li) => <li key={li}>{li}</li>)}</ul>
            <Link href="/plans" className="v-btn v-btn--secondary" style={{ alignSelf: "flex-start" }}>{v.pcCtaBase}</Link>
          </div>
          <div className="v-tier pro">
            <div className="name">{v.pcPro} <span className="best">{v.pcBest}</span></div><div className="price">${PUBLIC_PAID_PLANS.premium.amountUsdt}<small>{v.pcMo}</small></div>
            <p className="tag">{v.pcProTag}</p>
            <ul>{v.pcProList.map((li) => <li key={li}>{li}</li>)}</ul>
            <Link href="/plans" className="v-btn v-btn--primary" style={{ alignSelf: "flex-start" }}>{v.pcCtaPro}</Link>
          </div>
        </div>
        <p className="v-tiers-note">{v.pcNote}</p>
      </div></section>

      {/* ── Final CTA ── */}
      <section className="v-final"><div className="v-wrap">
        <h2>{v.fnHead1}<span className="g">{v.fnHeadG}</span></h2>
        <p>{v.fnBody}</p>
        <div className="v-actions">
          <Link href="/predictions" className="v-btn v-btn--primary">{v.ctaTerminal}</Link>
          <Link href="/history" className="v-btn v-btn--secondary">{v.ctaBrowse}</Link>
        </div>
        {/* #CONVERSION-COPY-0916 (audit §13): la riga di fiducia chiude il funnel consumer. */}
        <p className="v-final-note">{v.fnNote}</p>
      </div></section>

      {/* ── #SEO-ORPHANS-0908 — indice delle guide ─────────────────────────────
           DOVE: dopo la CTA finale, per la stessa ragione della riga widget qui
           sotto. Le sette pagine con testo vero prendevano zero link interni,
           ma la home è anche l'imbocco del funnel: un blocco messo sopra il
           prezzo avrebbe pagato la SEO col checkout. Qui raccoglie chi è
           arrivato in fondo senza cliccare — un lettore che non ha convertito
           è esattamente chi una guida può riportare indietro.
           COSA NON È: non tre card uguali con un'icona. È un indice, e l'ordine
           è la sua tesi — probabilità implicita → valore atteso → value bet →
           CLV, ognuno il pezzo che serve al prossimo. La numerazione porta quel
           significato, altrimenti sarebbe decorazione.
           PESO: densità e corpo del titolo deliberatamente sotto .v-prow (la
           suite di prodotto). Deve leggersi come materiale di lettura, non
           come una quinta superficie da vendere.
           Il 04 non ha link a destra: la CLV non ha un calcolatore nell'hub, e
           la casella resta vuota invece di puntare a un tool affine per
           simmetria. Il sottotitolo lo dichiara. ── */}
      <section className="v-sec v-guides-sec"><div className="v-wrap">
        <div className="v-sec-head"><div className="v-kick q">{v.gdEyebrow}</div><h2>{v.gdHead}</h2><p>{v.gdSub}</p></div>
        <ol className="v-guides">
          {LEARN_GUIDES.map((g, i) => (
            <li className="v-grow" key={g.slug}>
              <span className="gi" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <span className="gt">{g.term}</span>
              <Link className="gh" href={guideHref(g.slug)}>{g.title}</Link>
              {g.seeAlso ? (
                <Link className="gx" href={g.seeAlso.href}>{g.seeAlso.label} &rarr;</Link>
              ) : (
                <span className="gx" />
              )}
            </li>
          ))}
        </ol>
        <p className="v-guides-see">
          <span className="v-kick q">{v.gdAlso}</span>
          {LEARN_PILLARS.map((pl) => (
            <Link key={pl.href} href={pl.href}>{pl.label}</Link>
          ))}
          <Link href={BLOG_INDEX}>{v.gdAll}</Link>
        </p>
      </div></section>

      {/* ── #WIDGET-LANDING-0824: riga per i proprietari di siti. Sta DOPO la CTA
           finale di proposito — non compete con l'iscrizione, raccoglie chi è
           arrivato in fondo e ha un pubblico suo.
           #CONVERSION-COPY-0916 (audit §7): .v-b2b la stacca visivamente dal
           percorso consumer — filetto pieno e fondo di secondo livello, così si
           legge come un'altra porta, non come un'altra sezione della stessa. ── */}
      <section className="v-sec v-b2b"><div className="v-wrap">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", justifyContent: "space-between",
                      // la riga si ferma prima del bordo della sezione: a 1280px, larga
                      // quanto il wrap, tra il testo e il widget restavano 238px di vuoto
                      // e i due pezzi smettevano di leggersi come una coppia (misurato).
                      maxWidth: 960, margin: "0 auto" }}>
          <div style={{ flex: "1 1 320px", maxWidth: "52ch" }}>
            <div className="v-kick q">{v.wgKick}</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: "clamp(20px,3vw,28px)", letterSpacing: "-.02em" }}>{v.wgHead}</h2>
            <p style={{ margin: "0 0 16px", color: "var(--am-muted)" }}>{v.wgBody}</p>
            <Link href="/widget" className="v-btn v-btn--secondary">{v.wgCta}</Link>
          </div>
          {/* Il widget VERO accanto alla riga che lo vende: la sezione si
              dimostra da sola invece di descriversi. */}
          <div style={{ flex: "1 1 300px", maxWidth: 400, width: "100%" }}>
            <WidgetLivePreview lang={lang} theme={theme} />
          </div>
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
