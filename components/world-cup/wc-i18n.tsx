"use client";
// Shared i18n for the World Cup surface (#WC-I18N, 2026-06-08).
//
// The WC hub is rendered by a server component (app/world-cup/page.tsx) and the
// site chrome (SiteTopbar) sits OUTSIDE app/page.tsx's LanguageCtx, so neither
// can use useT(). Both read the same `agentic-lang` key the rest of the app
// persists (default "it") — exactly the workaround WcBoard already uses for its
// surface-gate strings. 5-language parity (it/en/es/fr/ru) — never hardcode
// English on this surface again.
import { useEffect, useState } from "react";

export type WcLang = "it" | "en" | "es" | "fr" | "ru";

export function resolveWcLang(): WcLang {
  if (typeof window === "undefined") return "it";
  const stored = window.localStorage.getItem("agentic-lang");
  return stored === "en" || stored === "es" || stored === "fr" || stored === "ru" ? stored : "it";
}

// Reactive lang hook: "it" on the server / first paint (matches the default and
// avoids hydration mismatch), then resolves real value on mount and follows
// cross-tab changes to `agentic-lang`.
export function useWcLang(): WcLang {
  const [lang, setLang] = useState<WcLang>("it");
  useEffect(() => {
    setLang(resolveWcLang());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "agentic-lang") setLang(resolveWcLang());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return lang;
}

const COPY = {
  back: { it: "Bacheca", en: "Board", es: "Tablero", fr: "Tableau", ru: "Доска" },
  signIn: { it: "Accedi", en: "Sign in", es: "Entrar", fr: "Connexion", ru: "Войти" },
  register: { it: "Registrati", en: "Register", es: "Registrarse", fr: "S'inscrire", ru: "Регистрация" },
  eyebrow: {
    it: "Mondiale FIFA 2026 · USA / Canada / Messico",
    en: "FIFA World Cup 2026 · USA / Canada / Mexico",
    es: "Mundial FIFA 2026 · EE. UU. / Canadá / México",
    fr: "Coupe du Monde FIFA 2026 · États-Unis / Canada / Mexique",
    ru: "ЧМ ФИФА 2026 · США / Канада / Мексика",
  },
  heroTitle: {
    it: "Hub Intelligence Mondiale",
    en: "World Cup Intelligence Hub",
    es: "Centro de Inteligencia del Mundial",
    fr: "Hub Intelligence Coupe du Monde",
    ru: "Аналитический центр ЧМ",
  },
  heroSub: {
    it: "48 squadre · 12 gironi · 104 partite. Convocazioni tracciate in tempo reale, pronostici AI con un track record di hit-rate trasparente.",
    en: "48 teams · 12 groups · 104 matches. Squad reveals tracked as they happen, AI predictions with a transparent hit-rate record.",
    es: "48 selecciones · 12 grupos · 104 partidos. Convocatorias seguidas en tiempo real, pronósticos de IA con un registro de acierto transparente.",
    fr: "48 équipes · 12 groupes · 104 matchs. Listes suivies en temps réel, pronostics IA avec un historique de réussite transparent.",
    ru: "48 команд · 12 групп · 104 матча. Составы отслеживаются в реальном времени, прогнозы ИИ с прозрачной статистикой попаданий.",
  },
  boardTitle: { it: "Bacheca pronostici", en: "Prediction board", es: "Tablero de pronósticos", fr: "Tableau des pronostics", ru: "Доска прогнозов" },
  outlookTitle: { it: "Chi vince il Mondiale?", en: "Who wins the World Cup?", es: "¿Quién gana el Mundial?", fr: "Qui gagne la Coupe du Monde ?", ru: "Кто выиграет ЧМ?" },
  groupsTitle: { it: "Gironi", en: "Groups", es: "Grupos", fr: "Groupes", ru: "Группы" },
  calendarTitle: { it: "Calendario partite", en: "Match calendar", es: "Calendario de partidos", fr: "Calendrier des matchs", ru: "Календарь матчей" },
  squadsTitle: { it: "Rose e convocazioni", en: "Squads & call-ups", es: "Plantillas y convocatorias", fr: "Effectifs et convocations", ru: "Составы и вызовы" },
  trackRecordTitle: { it: "Track record", en: "Track record", es: "Historial", fr: "Historique", ru: "История результатов" },
  players: { it: "giocatori", en: "players", es: "jugadores", fr: "joueurs", ru: "игроков" },
  injured: { it: "infortunati", en: "injured", es: "lesionados", fr: "blessés", ru: "травмированы" },
  squadsSyncing: {
    it: "Sincronizzazione rose — torna tra poco.",
    en: "Squad data syncing — back shortly.",
    es: "Sincronizando plantillas — vuelve pronto.",
    fr: "Synchronisation des effectifs — revenez bientôt.",
    ru: "Синхронизация составов — зайдите позже.",
  },
  // Countdown
  days: { it: "giorni", en: "days", es: "días", fr: "jours", ru: "дн" },
  hrs: { it: "ore", en: "hrs", es: "h", fr: "h", ru: "ч" },
  min: { it: "min", en: "min", es: "min", fr: "min", ru: "мин" },
  sec: { it: "sec", en: "sec", es: "s", fr: "s", ru: "с" },
  tournamentLive: { it: "Torneo in corso", en: "Tournament live", es: "Torneo en vivo", fr: "Tournoi en direct", ru: "Турнир идёт" },
  // Calendar + Groups
  group: { it: "Girone", en: "Group", es: "Grupo", fr: "Groupe", ru: "Группа" },
  team: { it: "Squadra", en: "Team", es: "Equipo", fr: "Équipe", ru: "Команда" },
  filterAll: { it: "Tutte", en: "All", es: "Todos", fr: "Tous", ru: "Все" },
  filterGroups: { it: "Gironi", en: "Groups", es: "Grupos", fr: "Groupes", ru: "Группы" },
  filterFinal: { it: "Finale", en: "Final", es: "Final", fr: "Finale", ru: "Финал" },
  venueTBC: { it: "Sede da definire", en: "Venue TBC", es: "Sede por confirmar", fr: "Lieu à confirmer", ru: "Стадион уточняется" },
  vsLabel: { it: "vs", en: "vs", es: "vs", fr: "vs", ru: "vs" },
  calendarUnavailable: {
    it: "Calendario non disponibile ora — riprova tra poco.",
    en: "Match calendar unavailable right now — retry shortly.",
    es: "Calendario no disponible ahora — inténtalo en breve.",
    fr: "Calendrier indisponible pour le moment — réessayez bientôt.",
    ru: "Календарь сейчас недоступен — повторите позже.",
  },
  groupsUnavailable: {
    it: "Classifiche dei gironi non disponibili ora — riprova tra poco.",
    en: "Group tables unavailable right now — retry shortly.",
    es: "Clasificaciones de grupos no disponibles ahora — inténtalo en breve.",
    fr: "Classements des groupes indisponibles pour le moment — réessayez bientôt.",
    ru: "Таблицы групп сейчас недоступны — повторите позже.",
  },
} as const satisfies Record<string, Record<WcLang, string>>;

export type WcCopyKey = keyof typeof COPY;

export function wcT(id: WcCopyKey, lang: WcLang): string {
  return COPY[id][lang];
}

// Client text leaf usable inside the server-rendered hub: <T id="boardTitle" />.
export function T({ id }: { id: WcCopyKey }) {
  const lang = useWcLang();
  return <>{wcT(id, lang)}</>;
}
