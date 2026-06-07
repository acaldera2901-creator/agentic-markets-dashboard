// World Cup i18n — single source of truth for all user-facing strings on
// the /world-cup surface. Two languages only: "it" (default) and "en".
// This file is safe for both server and client components.
// Server components that need to resolve the lang from a cookie should import
// wcLangFromCookie from "@/lib/world-cup-i18n.server" instead.

export type WcLang = "it" | "en";

/** Returns "it" for any value that is not exactly "en". */
export function normalizeWcLang(v: string | undefined | null): WcLang {
  return v === "en" ? "en" : "it";
}

// ---------------------------------------------------------------------------
// Dictionary
// ---------------------------------------------------------------------------

const dict = {
  it: {
    // ---- SiteTopbar --------------------------------------------------------
    signIn: "Accedi",
    register: "Registrati",
    backLabelBoard: "Board",
    backLabelHub: "World Cup hub",

    // ---- world-cup/page.tsx hero -------------------------------------------
    eyebrow: "FIFA World Cup 2026 · USA / Canada / Messico",
    heroTitle: "World Cup Intelligence Hub",
    heroSub:
      "48 squadre · 12 gironi · 104 partite. Convocati tracciati in tempo reale, previsioni AI con track record trasparente.",

    // ---- world-cup/page.tsx sections ---------------------------------------
    sectionBoard: "Prediction board",
    sectionOutlook: "Chi vince i Mondiali?",
    sectionGroups: "Gironi",
    sectionCalendar: "Calendario partite",
    sectionSquads: "Rose & convocati",
    sectionTrackRecord: "Track record",

    // ---- squads grid -------------------------------------------------------
    players: "giocatori",
    injured: "infortunati",
    squadSyncing: "Sincronizzazione rose — riprova tra poco.",

    // ---- world-cup/[team]/page.tsx hero ------------------------------------
    teamEyebrowBase: "World Cup 2026",
    teamEyebrowGroup: "World Cup 2026 · Girone",
    flaggedInjured: "segnalati infortunati",
    noInjuries: "nessun infortunio segnalato",

    // ---- world-cup/[team]/page.tsx sections --------------------------------
    sectionSquad: "Rosa",
    sectionCallUp: "Cronologia convocati",
    sectionFixtures: "Partite",

    // ---- [team] timeline empty state ---------------------------------------
    noRosterChanges:
      "Nessuna variazione alla rosa registrata — la rosa di base è stata acquisita il",
    noRosterChangesSuffix:
      "UTC. Ogni futura convocazione, esclusione o cambio di stato infortuni apparirà qui automaticamente.",

    // ---- [team] timeline labels --------------------------------------------
    timelineIn: "Entrato:",
    timelineOut: "Uscito:",
    timelineInjury: "Stato infortuni cambiato:",

    // ---- [team] fixture empty / venue TBC ----------------------------------
    fixturesUnavailable: "Partite non disponibili al momento — riprova tra poco.",
    venueTbc: "Sede da definire",

    // ---- WcBoard -----------------------------------------------------------
    loading: "Caricamento World Cup board…",
    noSignals:
      "I primi segnali World Cup vengono pubblicati all'apertura dei mercati — kickoff 11 giugno.",
    signInToReveal: "Accedi per vedere pick & confidenza",
    hideWhy: "Nascondi perché",
    why: "Perché",
    confidence: "confidenza",
    placeBet: "Piazza la scommessa →",
    wcBadge: "World Cup",
    paperBadge: "paper",
    deepAnalysisLocked:
      "Analisi approfondita disponibile con Signal Desk Pro (49,50 USDT/mese)",

    // ---- DeepAnalysis panel ------------------------------------------------
    deepAnalysisTitle: "Analisi approfondita",
    proBadge: "Pro",
    daForm: "Forma",
    daLambda: "λ tasso xG",
    daTravel: "Viaggio",
    daRest: "Riposo",
    daHostEdge: "Vantaggio campo",
    daInjuries: "Infortuni",
    daMarket: "Mercato",
    daSample: "Campione",
    daMatches: "partite",

    // ---- ProbRow outcome labels (3-way) ------------------------------------
    home: "CASA",
    draw: "PAREGGIO",
    away: "OSPITE",

    // ---- Countdown ---------------------------------------------------------
    tournamentLive: "Torneo in corso",
    days: "giorni",
    hrs: "ore",
    min: "min",
    sec: "sec",

    // ---- GroupsGrid --------------------------------------------------------
    groupsUnavailable:
      "Tabelle dei gironi non disponibili al momento — riprova tra poco.",
    groupLabel: "Girone",
    colTeam: "Squadra",
    colP: "G",
    colW: "V",
    colD: "P",
    colL: "S",
    colGD: "DR",
    colPts: "Pts",

    // ---- CalendarSection ---------------------------------------------------
    calendarUnavailable:
      "Calendario partite non disponibile al momento — riprova tra poco.",
    stageAll: "Tutti",
    stageGroups: "Gironi",
    stageR32: "R32",
    stageR16: "R16",
    stageQF: "QF",
    stageSF: "SF",
    stageFinal: "Finale",
    venueGroup: "Girone",

    // ---- TrackRecordStrip --------------------------------------------------
    trackRecordEmpty:
      "Il track record World Cup inizia con la prima partita liquidata — ogni risultato, vittorie e sconfitte, appare qui.",
    statSettled: "liquidate",
    statWon: "vinte",
    statLost: "perse",
    statHitRate: "hit rate",

    // ---- WinnerOdds --------------------------------------------------------
    winnerModelView: "Modello simulativo",
    winnerTournamentSims: "simulazioni del torneo",
    winnerColTeam: "Squadra",
    winnerColWin: "🏆 Vittoria",
    winnerField: "Resto del campo (altre",
    winnerFieldTeams: "squadre)",
    winnerNote:
      "Vista puramente modellistica (motore Elo-rating, Monte Carlo sull'intero tabellone, vantaggio campo incluso) — non è",
    winnerNot: "blended",
    winnerNoteSuffix:
      "con i mercati di scommessa, che prezzano i favoriti in modo meno aggressivo (i mercati antepost piazzano la Spagna vicino al 18%). Stesso favorito e podio dei principali modelli pubblici. Aggiornato",
    winnerDisclaimer: "· solo a scopo informativo, non consiglio di scommessa.",
  },

  en: {
    // ---- SiteTopbar --------------------------------------------------------
    signIn: "Sign in",
    register: "Register",
    backLabelBoard: "Board",
    backLabelHub: "World Cup hub",

    // ---- world-cup/page.tsx hero -------------------------------------------
    eyebrow: "FIFA World Cup 2026 · USA / Canada / Mexico",
    heroTitle: "World Cup Intelligence Hub",
    heroSub:
      "48 teams · 12 groups · 104 matches. Squad reveals tracked as they happen, AI predictions with a transparent hit-rate record.",

    // ---- world-cup/page.tsx sections ---------------------------------------
    sectionBoard: "Prediction board",
    sectionOutlook: "Who wins the World Cup?",
    sectionGroups: "Groups",
    sectionCalendar: "Match calendar",
    sectionSquads: "Squads & call-ups",
    sectionTrackRecord: "Track record",

    // ---- squads grid -------------------------------------------------------
    players: "players",
    injured: "injured",
    squadSyncing: "Squad data syncing — back shortly.",

    // ---- world-cup/[team]/page.tsx hero ------------------------------------
    teamEyebrowBase: "World Cup 2026",
    teamEyebrowGroup: "World Cup 2026 · Group",
    flaggedInjured: "flagged injured",
    noInjuries: "no injuries flagged",

    // ---- world-cup/[team]/page.tsx sections --------------------------------
    sectionSquad: "Squad",
    sectionCallUp: "Call-up timeline",
    sectionFixtures: "Fixtures",

    // ---- [team] timeline empty state ---------------------------------------
    noRosterChanges:
      "No roster changes recorded yet — the baseline squad was captured on",
    noRosterChangesSuffix:
      "UTC. Every future call-up, cut or injury flip lands here automatically.",

    // ---- [team] timeline labels --------------------------------------------
    timelineIn: "In:",
    timelineOut: "Out:",
    timelineInjury: "Injury status changed:",

    // ---- [team] fixture empty / venue TBC ----------------------------------
    fixturesUnavailable: "Fixtures unavailable right now — retry shortly.",
    venueTbc: "Venue TBC",

    // ---- WcBoard -----------------------------------------------------------
    loading: "Loading World Cup board…",
    noSignals:
      "First World Cup signals publish when markets open — kickoff June 11.",
    signInToReveal: "Sign in to reveal pick & confidence",
    hideWhy: "Hide why",
    why: "Why",
    confidence: "confidence",
    placeBet: "Place bet →",
    wcBadge: "World Cup",
    paperBadge: "paper",
    deepAnalysisLocked:
      "Deep analysis available with Signal Desk Pro (49.50 USDT/month)",

    // ---- DeepAnalysis panel ------------------------------------------------
    deepAnalysisTitle: "Deep Analysis",
    proBadge: "Pro",
    daForm: "Form",
    daLambda: "λ xG rate",
    daTravel: "Travel",
    daRest: "Rest",
    daHostEdge: "Host edge",
    daInjuries: "Injuries",
    daMarket: "Market",
    daSample: "Sample",
    daMatches: "matches",

    // ---- ProbRow outcome labels (3-way) ------------------------------------
    home: "HOME",
    draw: "DRAW",
    away: "AWAY",

    // ---- Countdown ---------------------------------------------------------
    tournamentLive: "Tournament live",
    days: "days",
    hrs: "hrs",
    min: "min",
    sec: "sec",

    // ---- GroupsGrid --------------------------------------------------------
    groupsUnavailable:
      "Group tables unavailable right now — retry shortly.",
    groupLabel: "Group",
    colTeam: "Team",
    colP: "P",
    colW: "W",
    colD: "D",
    colL: "L",
    colGD: "GD",
    colPts: "Pts",

    // ---- CalendarSection ---------------------------------------------------
    calendarUnavailable:
      "Match calendar unavailable right now — retry shortly.",
    stageAll: "All",
    stageGroups: "Groups",
    stageR32: "R32",
    stageR16: "R16",
    stageQF: "QF",
    stageSF: "SF",
    stageFinal: "Final",
    venueGroup: "Group",

    // ---- TrackRecordStrip --------------------------------------------------
    trackRecordEmpty:
      "The World Cup track record starts with the first settled match — every result lands here, wins and losses alike.",
    statSettled: "settled",
    statWon: "won",
    statLost: "lost",
    statHitRate: "hit rate",

    // ---- WinnerOdds --------------------------------------------------------
    winnerModelView: "Model view",
    winnerTournamentSims: "tournament simulations",
    winnerColTeam: "Team",
    winnerColWin: "🏆 Win",
    winnerField: "Field (other",
    winnerFieldTeams: "teams)",
    winnerNote:
      "Pure model view (Elo-rating engine, full-bracket Monte Carlo, host advantage included) — it is",
    winnerNot: "not",
    winnerNoteSuffix:
      "blended with betting markets, which price the favourites less aggressively (antepost markets put Spain nearer 18%). Same favourite and podium as the major public supercomputer models. Updated",
    winnerDisclaimer: "· for information only, not betting advice.",
  },
} as const;

// Enforce key parity at the type level: both lang objects must have identical keys.
type DictShape = typeof dict.it;
// This line will produce a compile error if "en" is missing any key from "it":
export const WC_T: Record<WcLang, DictShape> = dict;
