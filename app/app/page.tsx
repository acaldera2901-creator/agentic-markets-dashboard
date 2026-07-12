"use client";

import { useEffect, useState, useCallback, useRef, useMemo, createContext, useContext } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { PredictionDetailModal, useDetailModal } from "@/components/PredictionDetailModal";
import type { MdsData, MdsGroup, MdsChip } from "@/components/MatchDetailSheet";
import {
  PUBLIC_PAID_PLAN,
  type PublicPlanKey,
  planAmountUsdt,
  planLabel,
  planPriceCopy as publicPlanPriceCopy,
} from "@/lib/commercial-plan";
import { buildBestBetRows, modelEdge, type BestBetCandidate } from "@/lib/best-bets";
import { readRefCode, writeRefCode } from "@/lib/referral-code";
import { surfaceFloorFor } from "@/lib/surfacing-gate";
import { formPhrase, goalsPhrase, scorerPhrase, confidenceWord } from "@/lib/why-text";
import { isRateMeaningful } from "@/lib/track-record";
import { resetAccessCache } from "@/lib/use-has-access";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";
import { SportIcon, SportMark } from "@/app/components/sport-icon";
import { MenuIcon } from "@/app/components/menu-icon";
import { FORTUNEPLAY_BET_URL } from "@/lib/affiliate";
// #FORTUNEPLAY-LIVE-ODDS-1: quote live + deep-link partita sulle card.
import { teamPairKey } from "@/lib/team-pair-key";
import { fpEdge } from "@/lib/fortuneplay-live";
import { normName } from "@/lib/odds-api";
import { canonicalPlayerKey } from "@/lib/tennis-names";
import type { FpOddsEntry } from "@/lib/fortuneplay-board";
import { HouseBanner } from "@/components/HouseBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { campaignsFor, campaignSport } from "@/lib/house-banners";
import LangDropdown from "@/components/LangDropdown";

// #BUNDLE-SLIM-0702 (Fase 1): componenti pesanti caricati on-demand (chunk lazy),
// fuori dal bundle iniziale di /app. MatchDetailSheet = solo all'apertura scheda
// (il modal è null finché chiuso); TrackRecordView = solo tab Storico; LiveChat =
// widget chat non necessario al primo paint.
const MatchDetailSheet = dynamic(() => import("@/components/MatchDetailSheet").then((m) => m.MatchDetailSheet));
const TrackRecordView = dynamic(() => import("@/components/track-record/TrackRecordView").then((m) => m.TrackRecordView));
const LiveChat = dynamic(() => import("@/components/LiveChat").then((m) => m.LiveChat), { ssr: false });

// ─── Analytics (fire-and-forget, never blocks UI) ─────────────────────────────

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = sessionStorage.getItem("am_sid");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("am_sid", sid);
  }
  return sid;
}

function trackEvent(
  event_type: string,
  extra?: { language?: string; plan?: string; partner_id?: string; value?: number; meta?: Record<string, unknown> }
) {
  if (typeof window === "undefined") return;
  const language = extra?.language ?? localStorage.getItem("agentic-lang") ?? undefined;
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type, session_id: getSessionId(), language, ...extra }),
  }).catch(() => { /* ignore */ });
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const BASE_TRANSLATIONS = {
  it: {
    // Nav
    nav_dashboard: "Dashboard", nav_portfolio: "Portfolio", nav_plans: "Piani",
    nav_bestbets: "Best Bets", nav_sports: "Sports", nav_tennis: "Tennis", nav_bets: "Scommesse",
    nav_history: "Storico", nav_partner: "Partner", nav_settings: "Impostazioni", nav_status: "Status",
    // Header
    header_events: "eventi", header_ev: "+EV", header_login: "Login / Crea profilo",
    // PreAccess
    preaccess_eyebrow: "Client access required",
    preaccess_title: "BetRedge privato per edge verificati",
    preaccess_subtitle: "Le prediction, il portafoglio, le size e il wallet di pagamento restano nascosti finché il cliente non accede e non sceglie un piano.",
    preaccess_login: "Login", preaccess_create: "Crea profilo",
    preaccess_s1_title: "Crea profilo", preaccess_s1_desc: "Account cliente con lingua, piano e stato pagamento.",
    preaccess_s2_title: "Scegli piano", preaccess_s2_desc: "Free per preview, BetRedge Pro per segnali e ricerca.",
    preaccess_s3_title: "Invia USDT", preaccess_s3_desc: "Il wallet compare solo dentro il checkout cliente.",
    preaccess_s4_title: "Sblocca desk", preaccess_s4_desc: "Dati reali visibili solo dopo piano attivo o approval interno.",
    preaccess_base_desc: "BetRedge Pro: tennis live, football research e Best Bets",
    preaccess_premium_desc: "Accessi avanzati riservati al team interno",
    // Auth modal
    auth_eyebrow: "Client access",
    auth_login_title: "Login BetRedge",
    auth_create_title: "Crea il tuo profilo BetRedge",
    auth_login_sub: "Accedi con l'email usata per il tuo profilo cliente.",
    auth_create_sub: "Crea il profilo, poi scegli BetRedge Pro per sbloccare i dati.",
    auth_name_label: "Nome", auth_name_placeholder: "Il tuo nome",
    auth_not_found: "Profilo non trovato. Crea un profilo cliente per continuare.",
    auth_create_btn: "Continue to plans",
    auth_footer: "BetRedge Pro è crypto-only. I dati prediction restano bloccati finché il piano non è attivo.",
    auth_pw_placeholder_new: "Almeno 8 caratteri",
    auth_err_wrongpw: "Email o password errata.", auth_err_noaccount: "Nessun account con questa email. Registrati.",
    auth_err_exists: "Account già esistente — accedi.", auth_err_founder: "Questo profilo richiede founder access.",
    auth_err_pwshort: "La password deve avere almeno 8 caratteri.", auth_err_generic: "Errore. Riprova.",
    auth_hint_incomplete: "Inserisci un'email valida e una password di almeno 8 caratteri.",
    auth_age_confirm: "Confermo di avere almeno 18 anni.",
    auth_tos_pre: "Accetto i ", auth_tos_terms: "Termini di Servizio", auth_tos_mid: " e l'", auth_tos_privacy: "Informativa Privacy", auth_tos_post: ".",
    auth_hint_consent: "Conferma di essere maggiorenne e accetta i Termini per continuare.",
    // Plans
    plans_eyebrow: "Client plans",
    plans_title: "Un piano pagante, promessa chiara",
    plans_subtitle: "Free resta preview. BetRedge Pro sblocca tennis live, football research, Best Bets, spiegazioni e track record. Nessuna promessa aggressiva di battere il mercato.",
    plans_cta: "View live edges",
    plans_base_desc: "Per chi vuole un desk AI operativo ma controllato: segnali, probabilità, spiegazioni, qualità dati e storico live/paper.",
    plans_base_core: "Segnali e ricerca, non autopilot", plans_base_sub: "Decisione finale al cliente",
    plans_base_f1: "Best Bets +EV quando odds ed edge sono disponibili",
    plans_base_f2: "Top Model Signals quando il mercato live è vuoto",
    plans_base_f3: "Probabilità modello, quota disponibile e spiegazione",
    plans_base_f4: "Tennis Live V4 e Football Live V4 research",
    plans_base_f5: "Storico e track record",
    plans_base_f6: "Execution automatica reale",
    plans_base_f7: "Nessuna promessa di profitto garantito",
    plans_premium_desc: "Per il cliente che vuole delegare agli agenti: analisi, decisione, stake e piazzamento live.",
    plans_premium_core: "Lo faccio per te", plans_premium_sub: "Execution layer con audit completo",
    plans_premium_f1: "Tutto il piano Base incluso",
    plans_premium_f2: "Agenti sbloccati per piazzare bet automaticamente",
    plans_premium_f3: "Stake sizing secondo bankroll e risk profile",
    plans_premium_f4: "Stop loss, limiti giornalieri e limiti per sport",
    plans_premium_f5: "Live execution solo con bet ID confermato",
    plans_premium_f6: "Report automatico dopo ogni operazione",
    plans_premium_f7: "Ogni cliente collega il proprio conto exchange",
    plans_premium_f8: "Dashboard modificabile per limiti e risk profile",
    plans_flow1_title: "Signal", plans_flow1_desc: "Gli agenti trovano il value bet.",
    plans_flow2_title: "Explain", plans_flow2_desc: "Il cliente vede quota, edge e perché.",
    plans_flow3_title: "Decide", plans_flow3_desc: "Il cliente decide se entrare: niente execution automatica nel go-live.",
    plans_flow4_title: "Track", plans_flow4_desc: "Prediction salvate prima dell'evento e misurate nel track record.",
    // Prediction card
    pred_why_show: "▼ perché", pred_why_hide: "▲ meno",
    no_clear_favorite: "Nessun favorito netto", open_match: "Partita aperta",
    pred_why_title: "Perché questa previsione",
    // Tennis card
    tennis_why_show: "▼ perché", tennis_why_hide: "▲ meno",
    tennis_ai_label: "Analisi AI",
    tennis_elo_label: "Analisi del modello",
    tennis_ai_loading: "Generazione analisi AI in corso...",
    // Sportsbook board
    board_title: "Best available edges", board_eyebrow: "Market board",
    board_football: "Football", board_tennis: "Tennis",
    board_value: "value", board_markets: "markets", board_matches: "matches",
    board_football_empty: "No football fixtures scheduled. Markets return automatically when the season resumes.",
    board_tennis_empty: "Tennis markets loading. Fallback data appears when API is ready.",
    // Profile panel
    profile_upgrade_eyebrow: "Passa a Pro",
    profile_upgrade_title: "BetRedge Pro",
    profile_upgrade_desc: "Sblocca tennis live, football research, Best Bets, spiegazioni modello e track record.",
    profile_upgrade_btn: "Upgrade to Pro",
    profile_logout: "Logout",
    // Settings
    settings_empty_title: "Crea un profilo per configurare il servizio",
    settings_empty_btn: "Crea profilo",
    settings_save: "Salva impostazioni",
    // Pending payment
    pending_title: "Pagamento inviato",
    pending_subtitle: "TX hash ricevuto. Il piano resta in verifica finché non viene approvato internamente.",
    pending_tx_label: "TX Hash inviato:",
    pending_go_plans: "← Torna ai piani",
    // Checkout
    checkout_title: "Acquista piano",
    checkout_step1: "Copia il wallet address USDT (TRC20)",
    checkout_step2: "Invia l'importo esatto dal tuo wallet",
    checkout_step3: "Incolla il TX hash per confermare",
    checkout_tx_label: "TX Hash", checkout_sla: "Attivazione manuale entro 12h dalla conferma on-chain. Problemi o ritardi:",
    checkout_tx_placeholder: "Incolla qui il transaction hash",
    checkout_confirm: "Invia TX hash",
    // Misc
    bet_now: "Piazza la scommessa →",
    refresh_odds: "AGGIORNA ODDS",
    loading_predictions: "Calcolo delle probabilità calibrate in corso…",
    no_predictions: "Nessuna prediction disponibile — clicca Refresh",
    no_match_filters: "Nessun match per i filtri selezionati",
    // BetSlip
    betslip_eyebrow: "Bet slip", betslip_live: "Live ticket", betslip_signal: "Signal ticket",
    betslip_clear: "Cancella", betslip_no_sel: "Nessuna selezione",
    betslip_no_sel_desc: "Clicca su una quota per ispezionare edge e qualità di esecuzione.",
    betslip_selection: "Selezione", betslip_odds: "Quota", betslip_model_prob: "Probabilità modello",
    betslip_edge: "Edge", betslip_market_only: "solo mercato", betslip_stake: "Stake",
    betslip_return: "Ritorno",
    betslip_football_btn: "Conferma ordine football", betslip_tennis_btn: "Salva segnale tennis",
    betslip_football_note: "Il football può eseguire live solo dopo approval del rischio e conferma del bet ID dall'exchange.",
    betslip_tennis_note: "Il tennis è solo segnale finché il runner mapping non è verificato per l'esecuzione live.",
    // Client summary strip
    summary_football_edge: "Football Edge",
    summary_tennis_signals: "Tennis Signals", summary_exec_quality: "Qualità Esecuzione",
    summary_pending_bets: "bet in attesa", summary_waiting_markets: "in attesa di mercati",
    summary_signal_active: "signal layer attivo", summary_blocked: "bloccati/rifiutati",
    summary_id_required: "ID richiesto per live exec",
    // LockedGate
    locked_eyebrow: "BetRedge bloccato", locked_title: "Accedi per vedere prediction, edge e spiegazioni",
    locked_desc: "I dati sensibili restano offuscati finché non accedi e non attivi un piano.",
    locked_btn: "Login / Crea profilo",
    locked_plan_eyebrow: "Piano richiesto",
    locked_plan_title: "Scegli un pacchetto per sbloccare il desk",
    locked_plan_desc: "Il profilo è attivo, ma prediction, edge e spiegazioni si sbloccano solo dopo aver selezionato BetRedge Pro.",
    locked_plan_btn: "Vai agli abbonamenti",
    // Page headers
    page_overview: "Dashboard cliente", page_portfolio: "Client portfolio",
    page_plans: "Client plans", page_bestbets: "Best Bets",
    page_sports: "Sports predictions", page_tennis: "Tennis · Calibrated model", page_bets: "Execution log",
    page_history: "Storico settled",
    page_partners: "Casino & Partner Network", page_settings: "Account settings",
    page_agents: "Health & safety", page_eyebrow: "Client sportsbook",
    // Top bar
    topbar_private: "private desk", topbar_scanning: "in analisi", topbar_plans: "piani attivi", topbar_syncing: "sync...",
    // Rail
    rail_desk: "DESK", rail_exec_title: "Execution layer",
    rail_exec_note: "Live execution solo con bet ID confermato. Tennis in signal layer.",
    // KPIs in overview
    kpi_events: "eventi", kpi_ev: "+EV", kpi_win: "% win",
    // Predictions tab
    pred_model_badge: "Modello calibrato · Forma · prossimi 30 giorni",
    pred_computing: "Calcolo…", pred_refresh: "↻ Aggiorna",
    pred_stale_warning: "⚠️ Prediction più vecchie di 1 ora — clicca Aggiorna per ricalcolare (~90s)",
    pred_value_bet: "value bet", pred_value_bets: "value bets",
    pred_sort_label: "Ordine", pred_sort_closest: "Prima kickoff", pred_sort_farthest: "Più lontani",
    pred_sort_best_edge: "Edge migliore", pred_sort_importance: "Più importanti",
    pred_cat_label: "Cat.", pred_cat_all: "Tutti", pred_cat_european: "⭐ Europei",
    pred_cat_top5: "Top 5 leghe", pred_cat_ev: "Solo +EV",
    pred_value_only: "Solo +EV", pred_league_label: "Lega",
    pred_type_label: "Tipo", pred_all_types: "Tutti i tipi",
    pred_showing: "Mostro", pred_of: "di", pred_predictions: "prediction",
    pred_loading_sub: "Il primo caricamento può richiedere ~90s per i dati storici",
    // Tennis tab
    tennis_badge: "Tennis AI v2.0 · ATP + WTA · Signal Layer",
    tennis_computed: "calcolato", tennis_matches_loaded: "partite caricate",
    tennis_kpi_today: "Partite Oggi", tennis_kpi_value: "Value Bets", tennis_kpi_markets: "Mercati Attivi",
    tennis_surface_label: "Superficie",
    tennis_loading: "Caricamento previsioni tennis…", tennis_no_matches: "Nessuna partita disponibile",
    // Partners tab
    partners_eyebrow: "Rete commerciale", partners_title: "Casino & Scommesse Partner",
    partners_desc: "Piattaforme di gioco e scommesse con cui BetRedge collabora — integrazione segnali, edge e strumenti AI per gli operatori del settore.",
    partners_active: "Partner Attivi", partners_negotiation: "In Trattativa", partners_coming: "Coming Soon",
    partners_section_exclusive: "Partner Esclusivi", partners_section_network: "Network Partner",
    partners_invite_title: "Vuoi collaborare?", partners_invite_desc: "Contattaci per integrare i nostri segnali AI nella tua piattaforma.",
    partners_since: "Partner dal", partners_visit: "Visita →", partners_link_soon: "Link in arrivo", partners_affiliate_note: "*Link affiliato — potremmo ricevere una commissione, senza costi per te.",
    partners_status_active: "Attivo", partners_status_featured: "⭐ In Evidenza",
    partners_status_negotiation: "In Trattativa", partners_status_coming: "Coming Soon",
    partners_exclusive_badge: "Partner Esclusivo",
    // Portfolio/Bets/Agents premium gates
    gate_eyebrow: "Accesso interno", gate_portfolio_title: "Portfolio live",
    gate_portfolio_desc: "Il portfolio live, il grafico equity e il P&L dettagliato per sport non fanno parte del piano pubblico di go-live.",
    gate_bets_title: "Execution log",
    gate_bets_desc: "Il log scommesse degli agenti è disponibile solo con il Piano Premium. Il tuo conto exchange viene collegato durante l'onboarding Premium e le bet vengono piazzate automaticamente dagli agenti.",
    gate_agents_title: "Status agenti",
    gate_agents_desc: "Il monitor degli agenti è disponibile solo con il Piano Premium. Mostra heartbeat, errori e stato di ogni agente del tuo conto.",
    gate_upgrade_btn: "Passa a Pro",
    // Footer
    footer_note: "Sportsbook Edge Desk · solo execution verificata · interfaccia client-grade",
    rg_footer: "18+. Gioca responsabilmente. I contenuti sono a scopo informativo; quote e bonus sono offerte di partner affiliati.",
    // History
    hist_matches: "Partite", hist_bets: "Scommesse", hist_won: "Vinte", hist_lost: "Perse",
    hist_hit_rate: "Hit Rate",
    hist_filter_all: "Tutte", hist_filter_with_bet: "Con scommessa", hist_filter_won: "Vinte",
    hist_filter_lost: "Perse", hist_filter_no_bet: "Senza scommessa",
    hist_legend_won: "Scommessa vinta", hist_legend_lost: "Scommessa persa",
    hist_legend_pending: "In attesa", hist_legend_no_bet: "Nessuna scommessa",
    hist_loading: "Caricamento ultimi 30 giorni…", hist_empty: "Nessun dato storico — effettua prima delle scommesse",
    hist_model_pred: "Previsione modello", hist_no_bet: "nessuna scommessa",
    hist_model_correct: "✓ modello corretto", hist_model_wrong: "✗ modello errato",
    portfolio_recent_eyebrow: "Recent bets",
    portfolio_recent_title: "Ultime operazioni",
    portfolio_total: "totale",
    portfolio_empty: "Nessuna operazione ancora disponibile.",
    portfolio_hero_title: "Portfolio unico",
    portfolio_hero_desc: "Performance cliente e desk operativo sono ora nella stessa pagina.",
    portfolio_open_desk: "Apri desk",
    portfolio_open_positions: "Posizioni Aperte",
    portfolio_starting_capital: "Capitale Iniziale",
    portfolio_trend: "Andamento portafoglio",
    price_month: "mese",
    crypto_profile_required: "Crea un profilo o accedi per selezionare il piano.",
    crypto_activate: "Attiva",
    crypto_create_first: "Crea profilo prima",
    checkout_copy: "Copia",
    checkout_copied: "✓ Copiato",
    checkout_amount: "Importo",
    checkout_monthly: "Cadenza mensile",
    checkout_note_prefix: "Dopo la verifica il piano viene attivato manualmente. Non inviare importi diversi da",
    checkout_note_suffix: "USDT.",
    checkout_cancel: "Annulla",
    founder_invalid: "Codice non valido.",
    founder_network: "Errore di rete.",
    founder_title: "Accesso fondatore",
    founder_desc: "Inserisci il codice segreto per accedere con privilegi admin.",
    founder_secret: "Codice segreto",
    founder_checking: "Verifica...",
    founder_login: "Accedi come fondatore",
    tennis_elo_data: "Dati modello",
    tennis_pipeline_title: "Tennis Pipeline · 6 Agenti",
    tennis_last_seen: "Ultimo heartbeat",
    tennis_no_heartbeat: "Nessun heartbeat ancora",
    tennis_footer: "Tennis AI v2.0 · modello calibrato · 2.966 giocatori · settlement loop live",
    agent_arch_title: "Architettura ibrida v5.0",
    agent_arch_dashboard_title: "Dashboard (Vercel)",
    agent_arch_dashboard_desc: "Modello calibrato · API-Football · Odds. Sempre online, non dipende dagli agenti Python.",
    agent_arch_agents_title: "Agenti Python (locale)",
    agent_arch_agents_desc: "Analisi real-time, League & Match Context Module, exchange execution, Ollama AI. Avvia con",
    agent_arch_none: "⚠️ Nessun agente attivo. Avvia il sistema con",
    agent_arch_none_suffix: "nella cartella del progetto.",
    agent_last_seen: "Ultimo heartbeat",
    agent_no_heartbeat: "Nessun heartbeat ricevuto",
    partner_primary_name: "Sportsbook Partner",
    partner_primary_desc: "Casino e piattaforma di scommesse sportive — partner esclusivo del progetto. Link di accesso in fase di finalizzazione. Disponibile a breve.",
    partner_tag_exclusive: "Esclusivo",
    language_it: "Italiano",
    language_en: "Inglese",
    account_pending_detail: "Conto cliente non ancora collegato. Il saldo parte da zero.",
    // Topnav / shell (i18n migration)
    nav_markets: "Mercati", nav_predictions: "Previsioni", nav_leaderboard: "Classifica", nav_account: "Account",
    auth_signin: "Accedi", auth_register: "Registrati",
    theme_aria: "Tema", featured_label: "In evidenza",
    kpi_events_lbl: "Eventi", kpi_withedge: "Con edge", kpi_hit: "Hit · 100g",
    season_pause: "Stagione in pausa — nessuna partita programmata nelle prossime 48h. Le prediction tornano automaticamente con la ripresa delle leghe (luglio 2026).",
    footer_pastperf: "Le performance passate non garantiscono risultati futuri.",
    footer_partnerlinks: "I link partner sono affiliati commerciali.",
    footer_terms: "Termini di Servizio",
    footer_privacy: "Privacy Policy",
    // Bets filter bar (i18n migration)
    bf_allsports: "Tutti", bf_allsignals: "Tutte le prediction", bf_valueonly: "Solo best bets",
    bf_competition: "Competizione", bf_allcompetitions: "Tutte le competizioni",
    bf_surface: "Superficie", bf_allsurfaces: "Tutte", bf_sort: "Ordina", bf_edge: "Miglior edge",
    bf_time: "Orario", bf_odds: "Quota più alta", bf_probability: "Probabilità modello",
    bf_search: "Cerca team, player, torneo...", bf_showing: "Mostro",
    bf_noresults: "Nessun mercato rispetta questi filtri. Allarga la ricerca o torna a Tutti.",
    // Best Bets board filter bar (i18n migration)
    bb_probability: "Probabilità più alta", bb_time: "Prima kickoff",
    bb_search: "Cerca match, team, player...", bb_valuemode: "+EV live",
    bb_modelmode: "Top Model Signals", bb_noedge: "segnali modello",
  },
  en: {
    // Nav
    nav_dashboard: "Dashboard", nav_portfolio: "Portfolio", nav_plans: "Plans",
    nav_bestbets: "Best Bets", nav_sports: "Sports", nav_tennis: "Tennis", nav_bets: "Bets",
    nav_history: "History", nav_partner: "Partner", nav_settings: "Settings", nav_status: "Status",
    // Header
    header_events: "events", header_ev: "+EV", header_login: "Login / Create profile",
    // PreAccess
    preaccess_eyebrow: "Client access required",
    preaccess_title: "Private BetRedge for verified edges",
    preaccess_subtitle: "Predictions, portfolio, stake sizes and payment wallet are hidden until the client signs in and chooses a plan.",
    preaccess_login: "Login", preaccess_create: "Create profile",
    preaccess_s1_title: "Create profile", preaccess_s1_desc: "Client account with language, plan and payment status.",
    preaccess_s2_title: "Choose plan", preaccess_s2_desc: "Free for preview, BetRedge Pro for signals and research.",
    preaccess_s3_title: "Send USDT", preaccess_s3_desc: "Wallet address appears only inside the client checkout.",
    preaccess_s4_title: "Unlock desk", preaccess_s4_desc: "Live data visible only after plan is active or internal approval.",
    preaccess_base_desc: "BetRedge Pro: tennis live, football research and Best Bets",
    preaccess_premium_desc: "Advanced access reserved for the internal team",
    // Auth modal
    auth_eyebrow: "Client access",
    auth_login_title: "Login BetRedge",
    auth_create_title: "Create your BetRedge profile",
    auth_login_sub: "Sign in with the email used for your client profile.",
    auth_create_sub: "Create your profile, then choose BetRedge Pro to unlock data.",
    auth_name_label: "Name", auth_name_placeholder: "Your name",
    auth_not_found: "Profile not found. Create a client profile to continue.",
    auth_create_btn: "Continue to plans",
    auth_footer: "BetRedge Pro is crypto-only. Prediction data stays locked until the plan is active.",
    auth_pw_placeholder_new: "At least 8 characters",
    auth_err_wrongpw: "Wrong email or password.", auth_err_noaccount: "No account for this email. Sign up.",
    auth_err_exists: "Account already exists — log in.", auth_err_founder: "This profile requires founder access.",
    auth_err_pwshort: "Password must be at least 8 characters.", auth_err_generic: "Error. Try again.",
    auth_hint_incomplete: "Enter a valid email and a password of at least 8 characters.",
    auth_age_confirm: "I confirm I am at least 18 years old.",
    auth_tos_pre: "I accept the ", auth_tos_terms: "Terms of Service", auth_tos_mid: " and the ", auth_tos_privacy: "Privacy Policy", auth_tos_post: ".",
    auth_hint_consent: "Confirm you are of legal age and accept the Terms to continue.",
    // Plans
    plans_eyebrow: "Client plans",
    plans_title: "One paid plan, clear promise",
    plans_subtitle: "Free stays as preview. BetRedge Pro unlocks tennis live, football research, Best Bets, explanations and track record. No aggressive market-beating promise.",
    plans_cta: "View live edges",
    plans_base_desc: "For clients who want an AI betting desk with controlled signals, probabilities, explanations, data quality and live/paper tracking.",
    plans_base_core: "Signals and research, not autopilot", plans_base_sub: "Final decision stays with the client",
    plans_base_f1: "Best Bets +EV when odds and edge are available",
    plans_base_f2: "Top Model Signals when live markets are quiet",
    plans_base_f3: "Model probability, available odds and explanation",
    plans_base_f4: "Tennis Live V4 and Football Live V4 research",
    plans_base_f5: "History and track record",
    plans_base_f6: "Real automated execution",
    plans_base_f7: "No guaranteed profit promises",
    plans_premium_desc: "For the client who wants to delegate to agents: analysis, decision, stake and live placement.",
    plans_premium_core: "I do it for you", plans_premium_sub: "Execution layer with full audit",
    plans_premium_f1: "Everything in the Base plan",
    plans_premium_f2: "Agents unlocked to place bets automatically",
    plans_premium_f3: "Stake sizing based on bankroll and risk profile",
    plans_premium_f4: "Stop loss, daily limits and sport limits",
    plans_premium_f5: "Live execution only with confirmed bet ID",
    plans_premium_f6: "Automatic report after each operation",
    plans_premium_f7: "Each client links their own exchange account",
    plans_premium_f8: "Editable dashboard for limits and risk profile",
    plans_flow1_title: "Signal", plans_flow1_desc: "Agents find the value bet.",
    plans_flow2_title: "Explain", plans_flow2_desc: "Client sees odds, edge and why.",
    plans_flow3_title: "Decide", plans_flow3_desc: "Client decides whether to enter: no automated execution in the go-live.",
    plans_flow4_title: "Track", plans_flow4_desc: "Predictions are saved before the event and measured in the track record.",
    // Prediction card
    pred_why_show: "▼ why", pred_why_hide: "▲ less",
    no_clear_favorite: "No clear favourite", open_match: "Open match",
    pred_why_title: "Why this prediction",
    // Tennis card
    tennis_why_show: "▼ why", tennis_why_hide: "▲ less",
    tennis_ai_label: "AI Analysis",
    tennis_elo_label: "Model analysis",
    tennis_ai_loading: "Generating AI analysis...",
    // Sportsbook board
    board_title: "Best available edges", board_eyebrow: "Market board",
    board_football: "Football", board_tennis: "Tennis",
    board_value: "value", board_markets: "markets", board_matches: "matches",
    board_football_empty: "No football fixtures scheduled. Markets return automatically when the season resumes.",
    board_tennis_empty: "Tennis markets loading. Fallback data appears when API is ready.",
    // Profile panel
    profile_upgrade_eyebrow: "Upgrade to Pro",
    profile_upgrade_title: "BetRedge Pro",
    profile_upgrade_desc: "Unlock tennis live, football research, Best Bets, model explanations and track record.",
    profile_upgrade_btn: "Upgrade to Pro",
    profile_logout: "Logout",
    // Settings
    settings_empty_title: "Create a profile to configure your service",
    settings_empty_btn: "Create profile",
    settings_save: "Save settings",
    // Pending payment
    pending_title: "Payment submitted",
    pending_subtitle: "TX hash received. The plan stays under review until it is approved internally.",
    pending_tx_label: "TX Hash sent:",
    pending_go_plans: "← Back to plans",
    // Checkout
    checkout_title: "Purchase plan",
    checkout_step1: "Copy the USDT wallet address (TRC20)",
    checkout_step2: "Send the exact amount from your wallet",
    checkout_step3: "Paste the TX hash to confirm",
    checkout_tx_label: "TX Hash", checkout_sla: "Manual activation within 12h of on-chain confirmation. Issues or delays:",
    checkout_tx_placeholder: "Paste transaction hash here",
    checkout_confirm: "Submit TX hash",
    // Misc
    bet_now: "Place Bet →",
    refresh_odds: "REFRESH ODDS",
    loading_predictions: "Computing calibrated predictions…",
    no_predictions: "No predictions yet — click Refresh",
    no_match_filters: "No matches for selected filters",
    // BetSlip
    betslip_eyebrow: "Bet slip", betslip_live: "Live ticket", betslip_signal: "Signal ticket",
    betslip_clear: "Clear", betslip_no_sel: "No selection",
    betslip_no_sel_desc: "Click an odds cell from the unified market board to inspect execution quality.",
    betslip_selection: "Selection", betslip_odds: "Odds", betslip_model_prob: "Model probability",
    betslip_edge: "Edge", betslip_market_only: "market only", betslip_stake: "Stake",
    betslip_return: "Return",
    betslip_football_btn: "Review football order", betslip_tennis_btn: "Save tennis signal",
    betslip_football_note: "Football can execute live only after risk approval and the exchange returns a confirmed bet ID.",
    betslip_tennis_note: "Tennis is signal-only until runner mapping is fully verified for live execution.",
    // Client summary strip
    summary_football_edge: "Football Edge",
    summary_tennis_signals: "Tennis Signals", summary_exec_quality: "Execution Quality",
    summary_pending_bets: "pending bets", summary_waiting_markets: "waiting for markets",
    summary_signal_active: "signal layer active", summary_blocked: "blocked/rejected safely",
    summary_id_required: "ID required for live exec",
    // LockedGate
    locked_eyebrow: "BetRedge locked", locked_title: "Sign in to see predictions, edge and explanations",
    locked_desc: "Sensitive data stays hidden until you sign in and activate a plan.",
    locked_btn: "Login / Create profile",
    locked_plan_eyebrow: "Plan required",
    locked_plan_title: "Choose a package to unlock the desk",
    locked_plan_desc: "Your profile is active, but predictions, edge and explanations unlock only after choosing BetRedge Pro.",
    locked_plan_btn: "Go to subscriptions",
    // Page headers
    page_overview: "Client dashboard", page_portfolio: "Client portfolio",
    page_plans: "Client plans", page_bestbets: "Best Bets",
    page_sports: "Sports predictions", page_tennis: "Tennis · Calibrated model", page_bets: "Execution log",
    page_history: "Settled history",
    page_partners: "Casino & Partner Network", page_settings: "Account settings",
    page_agents: "Health & safety", page_eyebrow: "Client sportsbook",
    // Top bar
    topbar_private: "private desk", topbar_scanning: "scanning", topbar_plans: "plans active", topbar_syncing: "syncing",
    // Rail
    rail_desk: "DESK", rail_exec_title: "Execution layer",
    rail_exec_note: "Live execution only with confirmed bet ID. Tennis in signal layer.",
    // KPIs in overview
    kpi_events: "events", kpi_ev: "+EV", kpi_win: "% win",
    // Predictions tab
    pred_model_badge: "Calibrated model · Form · next 30 days",
    pred_computing: "Computing…", pred_refresh: "↻ Refresh",
    pred_stale_warning: "⚠️ Predictions older than 1 hour — click Refresh to recompute (~90s)",
    pred_value_bet: "value bet", pred_value_bets: "value bets",
    pred_sort_label: "Sort", pred_sort_closest: "Closest first", pred_sort_farthest: "Farthest first",
    pred_sort_best_edge: "Best edge", pred_sort_importance: "Most important",
    pred_cat_label: "Cat.", pred_cat_all: "All", pred_cat_european: "⭐ European",
    pred_cat_top5: "Top 5 leagues", pred_cat_ev: "+EV only",
    pred_value_only: "+EV Only", pred_league_label: "League",
    pred_type_label: "Type", pred_all_types: "All types",
    pred_showing: "Showing", pred_of: "of", pred_predictions: "predictions",
    pred_loading_sub: "First load may take ~90s while fetching historical data",
    // Tennis tab
    tennis_badge: "Tennis AI v2.0 · ATP + WTA · Signal Layer",
    tennis_computed: "computed", tennis_matches_loaded: "matches loaded",
    tennis_kpi_today: "Matches Today", tennis_kpi_value: "Value Bets", tennis_kpi_markets: "Active Markets",
    tennis_surface_label: "Surface",
    tennis_loading: "Loading tennis predictions…", tennis_no_matches: "No matches available",
    // Partners tab
    partners_eyebrow: "Commercial network", partners_title: "Casino & Sportsbook Partners",
    partners_desc: "Gaming and betting platforms BetRedge collaborates with — signal integration, edge and AI tools for operators.",
    partners_active: "Active Partners", partners_negotiation: "In Negotiation", partners_coming: "Coming Soon",
    partners_section_exclusive: "Exclusive Partners", partners_section_network: "Partner Network",
    partners_invite_title: "Want to collaborate?", partners_invite_desc: "Contact us to integrate our AI signals into your platform.",
    partners_since: "Partner since", partners_visit: "Visit →", partners_link_soon: "Link coming soon", partners_affiliate_note: "*Affiliate link — we may earn a commission at no cost to you.",
    partners_status_active: "Active", partners_status_featured: "⭐ Featured",
    partners_status_negotiation: "In Negotiation", partners_status_coming: "Coming Soon",
    partners_exclusive_badge: "Exclusive Partner",
    // Portfolio/Bets/Agents premium gates
    gate_eyebrow: "Internal access", gate_portfolio_title: "Live portfolio",
    gate_portfolio_desc: "Live portfolio, equity chart and detailed P&L by sport are not part of the public go-live plan.",
    gate_bets_title: "Execution log",
    gate_bets_desc: "The agent bet log is available with the Premium Plan only. Your exchange account is linked during Premium onboarding and bets are placed automatically by agents.",
    gate_agents_title: "Agent status",
    gate_agents_desc: "The agent monitor is available with the Premium Plan only. Shows heartbeat, errors and status of every agent on your account.",
    gate_upgrade_btn: "Upgrade to Pro",
    // Footer
    footer_note: "Sportsbook Edge Desk · verified execution only · client-grade interface",
    rg_footer: "18+. Play responsibly. Content is for informational purposes; odds and bonuses are offers from affiliate partners.",
    // History
    hist_matches: "Matches", hist_bets: "Bets Placed", hist_won: "Won", hist_lost: "Lost",
    hist_hit_rate: "Hit Rate",
    hist_filter_all: "All matches", hist_filter_with_bet: "With bet", hist_filter_won: "Won",
    hist_filter_lost: "Lost", hist_filter_no_bet: "No bet placed",
    hist_legend_won: "Bet won", hist_legend_lost: "Bet lost",
    hist_legend_pending: "Pending", hist_legend_no_bet: "No bet placed",
    hist_loading: "Loading last 30 days history…", hist_empty: "No historical data yet — place some bets first",
    hist_model_pred: "Model prediction", hist_no_bet: "no bet placed",
    hist_model_correct: "✓ model correct", hist_model_wrong: "✗ model wrong",
    portfolio_recent_eyebrow: "Recent bets",
    portfolio_recent_title: "Latest operations",
    portfolio_total: "total",
    portfolio_empty: "No operations available yet.",
    portfolio_hero_title: "Unified portfolio",
    portfolio_hero_desc: "Client performance and operating desk now live on the same page.",
    portfolio_open_desk: "Open Desk",
    portfolio_open_positions: "Open Positions",
    portfolio_starting_capital: "Starting Capital",
    portfolio_trend: "Portfolio trend",
    price_month: "month",
    crypto_profile_required: "Create a profile or sign in to select this plan.",
    crypto_activate: "Activate",
    crypto_create_first: "Create profile first",
    checkout_copy: "Copy",
    checkout_copied: "✓ Copied",
    checkout_amount: "Amount",
    checkout_monthly: "Monthly",
    checkout_note_prefix: "After verification, the plan is activated manually. Do not send amounts other than",
    checkout_note_suffix: "USDT.",
    checkout_cancel: "Cancel",
    founder_invalid: "Invalid code.",
    founder_network: "Network error.",
    founder_title: "Founder access",
    founder_desc: "Enter the secret code to access admin privileges.",
    founder_secret: "Secret code",
    founder_checking: "Checking...",
    founder_login: "Log in as founder",
    tennis_elo_data: "Model data",
    tennis_pipeline_title: "Tennis Pipeline · 6 Agents",
    tennis_last_seen: "Last seen",
    tennis_no_heartbeat: "No heartbeat yet",
    tennis_footer: "Tennis AI v2.0 · calibrated model · 2,966 players · settlement loop live",
    agent_arch_title: "Hybrid architecture v5.0",
    agent_arch_dashboard_title: "Dashboard (Vercel)",
    agent_arch_dashboard_desc: "Calibrated model · API-Football · Odds. Always online, independent from local Python agents.",
    agent_arch_agents_title: "Python agents (local)",
    agent_arch_agents_desc: "Real-time analysis, League & Match Context Module, exchange execution, Ollama AI. Start with",
    agent_arch_none: "⚠️ No active agents. Start the system with",
    agent_arch_none_suffix: "inside the project folder.",
    agent_last_seen: "Last seen",
    agent_no_heartbeat: "No heartbeat received",
    partner_primary_name: "Sportsbook Partner",
    partner_primary_desc: "Casino and sportsbook platform — exclusive project partner. Access link being finalised. Available shortly.",
    partner_tag_exclusive: "Exclusive",
    language_it: "Italian",
    language_en: "English",
    account_pending_detail: "Client account not connected yet. Balance starts at zero.",
    // Topnav / shell (i18n migration)
    nav_markets: "Markets", nav_predictions: "Prediction", nav_leaderboard: "Leaderboard", nav_account: "Account",
    auth_signin: "Sign In", auth_register: "Register",
    theme_aria: "Theme", featured_label: "Featured",
    kpi_events_lbl: "Events", kpi_withedge: "With edge", kpi_hit: "Hit · 100g",
    season_pause: "Season pause — no fixtures in the next 48h. Predictions return automatically when leagues resume (July 2026).",
    footer_pastperf: "Past performance does not guarantee future results.",
    footer_partnerlinks: "Partner links are commercial affiliates.",
    footer_terms: "Terms of Service",
    footer_privacy: "Privacy Policy",
    // Bets filter bar (i18n migration)
    bf_allsports: "All", bf_allsignals: "All predictions", bf_valueonly: "Best bets only",
    bf_competition: "Competition", bf_allcompetitions: "All competitions",
    bf_surface: "Surface", bf_allsurfaces: "All", bf_sort: "Sort", bf_edge: "Best edge",
    bf_time: "Time", bf_odds: "Highest odds", bf_probability: "Model probability",
    bf_search: "Search team, player, tournament...", bf_showing: "Showing",
    bf_noresults: "No markets match these filters. Widen the search or return to All.",
    // Best Bets board filter bar (i18n migration)
    bb_probability: "Highest probability", bb_time: "Closest kickoff",
    bb_search: "Search match, team, player...", bb_valuemode: "Live +EV",
    bb_modelmode: "Top Model Signals", bb_noedge: "model signals",
  },
} as const;

const EXTRA_TRANSLATIONS = {
  es: {
    ...BASE_TRANSLATIONS.en,
    // Nav
    nav_dashboard: "Panel", nav_portfolio: "Portfolio", nav_plans: "Planes",
    nav_bestbets: "Mejores apuestas", nav_sports: "Deportes", nav_tennis: "Tenis", nav_bets: "Apuestas",
    nav_history: "Historial", nav_partner: "Partner", nav_settings: "Ajustes", nav_status: "Estado",
    // Header
    header_events: "eventos", header_ev: "+EV", header_login: "Login / Crear perfil",
    // PreAccess
    preaccess_eyebrow: "Acceso de cliente requerido",
    preaccess_title: "BetRedge privado para edges verificados",
    preaccess_subtitle: "Las predicciones, el portfolio, los importes y el wallet de pago permanecen ocultos hasta que el cliente inicia sesión y elige un plan.",
    preaccess_login: "Login", preaccess_create: "Crear perfil",
    preaccess_s1_title: "Crear perfil", preaccess_s1_desc: "Cuenta de cliente con idioma, plan y estado de pago.",
    preaccess_s2_title: "Elegir plan", preaccess_s2_desc: "Free para la vista previa, BetRedge Pro para señales e investigación.",
    preaccess_s3_title: "Enviar USDT", preaccess_s3_desc: "La dirección del wallet aparece solo dentro del checkout del cliente.",
    preaccess_s4_title: "Desbloquear desk", preaccess_s4_desc: "Datos en vivo visibles solo tras activar el plan o con aprobación interna.",
    preaccess_base_desc: "BetRedge Pro: tenis en vivo, investigación de fútbol y Best Bets",
    preaccess_premium_desc: "Accesos avanzados reservados al equipo interno",
    // Auth modal
    auth_eyebrow: "Acceso de cliente",
    auth_login_title: "Login BetRedge",
    auth_create_title: "Crea tu perfil BetRedge",
    auth_login_sub: "Inicia sesión con el email usado para tu perfil de cliente.",
    auth_create_sub: "Crea tu perfil y luego elige BetRedge Pro para desbloquear los datos.",
    auth_name_label: "Nombre", auth_name_placeholder: "Tu nombre",
    auth_not_found: "Perfil no encontrado. Crea un perfil de cliente para continuar.",
    auth_create_btn: "Continuar a planes",
    auth_footer: "BetRedge Pro es solo cripto. Los datos de predicción permanecen bloqueados hasta que el plan esté activo.",
    auth_pw_placeholder_new: "Al menos 8 caracteres",
    auth_err_wrongpw: "Email o contraseña incorrectos.", auth_err_noaccount: "No hay cuenta con este email. Regístrate.",
    auth_err_exists: "La cuenta ya existe — inicia sesión.", auth_err_founder: "Este perfil requiere acceso de founder.",
    auth_err_pwshort: "La contraseña debe tener al menos 8 caracteres.", auth_err_generic: "Error. Inténtalo de nuevo.",
    auth_hint_incomplete: "Introduce un email válido y una contraseña de al menos 8 caracteres.",
    auth_age_confirm: "Confirmo que tengo al menos 18 años.",
    auth_tos_pre: "Acepto los ", auth_tos_terms: "Términos del Servicio", auth_tos_mid: " y la ", auth_tos_privacy: "Política de Privacidad", auth_tos_post: ".",
    auth_hint_consent: "Confirma que eres mayor de edad y acepta los Términos para continuar.",
    // Plans
    plans_eyebrow: "Planes cliente",
    plans_title: "Un plan de pago, promesa clara",
    plans_subtitle: "Free se mantiene como vista previa. BetRedge Pro desbloquea tenis en vivo, investigación de fútbol, Best Bets, explicaciones y track record. Sin promesas agresivas de batir el mercado.",
    plans_cta: "Ver edges en vivo",
    plans_base_desc: "Para clientes que quieren un desk de apuestas con IA con señales controladas, probabilidades, explicaciones, calidad de datos y seguimiento live/paper.",
    plans_base_core: "Señales e investigación, no piloto automático", plans_base_sub: "La decisión final es del cliente",
    plans_base_f1: "Best Bets +EV cuando hay cuotas y edge disponibles",
    plans_base_f2: "Top Model Signals cuando los mercados en vivo están tranquilos",
    plans_base_f3: "Probabilidad del modelo, cuota disponible y explicación",
    plans_base_f4: "Investigación Tennis Live V4 y Football Live V4",
    plans_base_f5: "Historial y track record",
    plans_base_f6: "Ejecución automática real",
    plans_base_f7: "Sin promesas de beneficio garantizado",
    plans_premium_desc: "Para el cliente que quiere delegar en los agentes: análisis, decisión, importe y colocación en vivo.",
    plans_premium_core: "Lo hago por ti", plans_premium_sub: "Capa de ejecución con auditoría completa",
    plans_premium_f1: "Todo lo del plan Base",
    plans_premium_f2: "Agentes desbloqueados para colocar apuestas automáticamente",
    plans_premium_f3: "Cálculo de importe según bankroll y perfil de riesgo",
    plans_premium_f4: "Stop loss, límites diarios y límites por deporte",
    plans_premium_f5: "Ejecución en vivo solo con bet ID confirmado",
    plans_premium_f6: "Informe automático tras cada operación",
    plans_premium_f7: "Cada cliente vincula su propia cuenta de exchange",
    plans_premium_f8: "Panel editable para límites y perfil de riesgo",
    plans_flow1_title: "Señal", plans_flow1_desc: "Los agentes encuentran el value bet.",
    plans_flow2_title: "Explicar", plans_flow2_desc: "El cliente ve cuota, edge y el porqué.",
    plans_flow3_title: "Decidir", plans_flow3_desc: "El cliente decide si entra: sin ejecución automática en el lanzamiento.",
    plans_flow4_title: "Seguir", plans_flow4_desc: "Las predicciones se guardan antes del evento y se miden en el track record.",
    // Prediction card
    pred_why_show: "▼ por qué", pred_why_hide: "▲ menos",
    no_clear_favorite: "Sin favorito claro", open_match: "Partido abierto",
    pred_why_title: "Por qué esta predicción",
    // Tennis card
    tennis_why_show: "▼ por qué", tennis_why_hide: "▲ menos",
    tennis_ai_label: "Análisis IA",
    tennis_elo_label: "Análisis del modelo",
    tennis_ai_loading: "Generando análisis IA...",
    // Sportsbook board
    board_title: "Mejores edges disponibles", board_eyebrow: "Tablero de mercado",
    board_football: "Fútbol", board_tennis: "Tenis",
    board_value: "value", board_markets: "mercados", board_matches: "partidos",
    board_football_empty: "No hay partidos de fútbol programados. Los mercados vuelven automáticamente cuando se reanuda la temporada.",
    board_tennis_empty: "Cargando mercados de tenis. Los datos de respaldo aparecen cuando la API está lista.",
    // Profile panel
    profile_upgrade_eyebrow: "Pasar a Pro",
    profile_upgrade_title: "BetRedge Pro",
    profile_upgrade_desc: "Desbloquea tenis en vivo, investigación de fútbol, Best Bets, explicaciones del modelo y track record.",
    profile_upgrade_btn: "Pasar a Pro",
    profile_logout: "Cerrar sesión",
    // Settings
    settings_empty_title: "Crea un perfil para configurar tu servicio",
    settings_empty_btn: "Crear perfil",
    settings_save: "Guardar ajustes",
    // Pending payment
    pending_title: "Pago enviado",
    pending_subtitle: "Hash de TX recibido. El plan permanece en revisión hasta su aprobación interna.",
    pending_tx_label: "Hash de TX enviado:",
    pending_go_plans: "← Volver a planes",
    // Checkout
    checkout_title: "Comprar plan",
    checkout_step1: "Copia la dirección del wallet USDT (TRC20)",
    checkout_step2: "Envía el importe exacto desde tu wallet",
    checkout_step3: "Pega el hash de TX para confirmar",
    checkout_tx_label: "Hash de TX", checkout_sla: "Activación manual en 12h tras la confirmación on-chain. Problemas o retrasos:",
    checkout_tx_placeholder: "Pega aquí el hash de la transacción",
    checkout_confirm: "Enviar hash de TX",
    // Misc
    bet_now: "Hacer apuesta →",
    refresh_odds: "ACTUALIZAR ODDS",
    loading_predictions: "Calculando predicciones calibradas…",
    no_predictions: "Aún no hay predicciones — pulsa Actualizar",
    no_match_filters: "No hay partidos para los filtros seleccionados",
    // BetSlip
    betslip_eyebrow: "Boleto", betslip_live: "Ticket en vivo", betslip_signal: "Ticket de señal",
    betslip_clear: "Borrar", betslip_no_sel: "Sin selección",
    betslip_no_sel_desc: "Pulsa una cuota del tablero de mercado unificado para inspeccionar la calidad de ejecución.",
    betslip_selection: "Selección", betslip_odds: "Cuota", betslip_model_prob: "Probabilidad del modelo",
    betslip_edge: "Edge", betslip_market_only: "solo mercado", betslip_stake: "Importe",
    betslip_return: "Retorno",
    betslip_football_btn: "Revisar orden de fútbol", betslip_tennis_btn: "Guardar señal de tenis",
    betslip_football_note: "El fútbol puede ejecutarse en vivo solo tras la aprobación de riesgo y cuando el exchange devuelve un bet ID confirmado.",
    betslip_tennis_note: "El tenis es solo señal hasta que el mapeo de runners esté totalmente verificado para la ejecución en vivo.",
    // Client summary strip
    summary_football_edge: "Edge de Fútbol",
    summary_tennis_signals: "Señales de Tenis", summary_exec_quality: "Calidad de Ejecución",
    summary_pending_bets: "apuestas pendientes", summary_waiting_markets: "esperando mercados",
    summary_signal_active: "capa de señal activa", summary_blocked: "bloqueados/rechazados con seguridad",
    summary_id_required: "ID requerido para ejecución en vivo",
    // LockedGate
    locked_eyebrow: "BetRedge bloqueado", locked_title: "Inicia sesión para ver predicciones, edge y explicaciones",
    locked_desc: "Los datos sensibles permanecen ocultos hasta que inicies sesión y actives un plan.",
    locked_btn: "Login / Crear perfil",
    locked_plan_eyebrow: "Plan requerido",
    locked_plan_title: "Elige un paquete para desbloquear el desk",
    locked_plan_desc: "Tu perfil está activo, pero las predicciones, el edge y las explicaciones se desbloquean solo tras elegir BetRedge Pro.",
    locked_plan_btn: "Ir a las suscripciones",
    // Page headers
    page_overview: "Panel del cliente", page_portfolio: "Portfolio del cliente",
    page_plans: "Planes cliente", page_bestbets: "Mejores apuestas",
    page_sports: "Predicciones deportivas", page_tennis: "Tenis · Modelo calibrado", page_bets: "Registro de ejecución",
    page_history: "Historial liquidado",
    page_partners: "Casino & Red de Partners", page_settings: "Ajustes de la cuenta",
    page_agents: "Salud y seguridad", page_eyebrow: "Sportsbook del cliente",
    // Top bar
    topbar_private: "desk privado", topbar_scanning: "analizando", topbar_plans: "planes activos", topbar_syncing: "sincronizando",
    // Rail
    rail_desk: "DESK", rail_exec_title: "Capa de ejecución",
    rail_exec_note: "Ejecución en vivo solo con bet ID confirmado. Tenis en capa de señal.",
    // KPIs in overview
    kpi_events: "eventos", kpi_ev: "+EV", kpi_win: "% acierto",
    // Predictions tab
    pred_model_badge: "Modelo calibrado · Forma · próximos 30 días",
    pred_computing: "Calculando…", pred_refresh: "↻ Actualizar",
    pred_stale_warning: "⚠️ Predicciones de más de 1 hora — pulsa Actualizar para recalcular (~90s)",
    pred_value_bet: "value bet", pred_value_bets: "value bets",
    pred_sort_label: "Orden", pred_sort_closest: "Más próximos", pred_sort_farthest: "Más lejanos",
    pred_sort_best_edge: "Mejor edge", pred_sort_importance: "Más importantes",
    pred_cat_label: "Cat.", pred_cat_all: "Todas", pred_cat_european: "⭐ Europeas",
    pred_cat_top5: "Top 5 ligas", pred_cat_ev: "Solo +EV",
    pred_value_only: "Solo +EV", pred_league_label: "Liga",
    pred_type_label: "Tipo", pred_all_types: "Todos los tipos",
    pred_showing: "Mostrando", pred_of: "de", pred_predictions: "predicciones",
    pred_loading_sub: "La primera carga puede tardar ~90s mientras se obtienen los datos históricos",
    // Tennis tab
    tennis_badge: "Tennis AI v2.0 · ATP + WTA · Capa de señal",
    tennis_computed: "calculado", tennis_matches_loaded: "partidos cargados",
    tennis_kpi_today: "Partidos Hoy", tennis_kpi_value: "Value Bets", tennis_kpi_markets: "Mercados Activos",
    tennis_surface_label: "Superficie",
    tennis_loading: "Cargando predicciones de tenis…", tennis_no_matches: "No hay partidos disponibles",
    // Partners tab
    partners_eyebrow: "Red comercial", partners_title: "Casino & Partners de Sportsbook",
    partners_desc: "Plataformas de juego y apuestas con las que BetRedge colabora — integración de señales, edge y herramientas de IA para operadores.",
    partners_active: "Partners Activos", partners_negotiation: "En Negociación", partners_coming: "Próximamente",
    partners_section_exclusive: "Partners Exclusivos", partners_section_network: "Red de Partners",
    partners_invite_title: "¿Quieres colaborar?", partners_invite_desc: "Contáctanos para integrar nuestras señales de IA en tu plataforma.",
    partners_since: "Partner desde", partners_visit: "Visitar →", partners_link_soon: "Enlace en camino", partners_affiliate_note: "*Enlace de afiliado — podemos ganar una comisión sin coste para ti.",
    partners_status_active: "Activo", partners_status_featured: "⭐ Destacado",
    partners_status_negotiation: "En Negociación", partners_status_coming: "Próximamente",
    partners_exclusive_badge: "Partner Exclusivo",
    // Portfolio/Bets/Agents premium gates
    gate_eyebrow: "Acceso interno", gate_portfolio_title: "Portfolio en vivo",
    gate_portfolio_desc: "El portfolio en vivo, el gráfico de equity y el P&L detallado por deporte no forman parte del plan público de lanzamiento.",
    gate_bets_title: "Registro de ejecución",
    gate_bets_desc: "El registro de apuestas de los agentes está disponible solo con el Plan Premium. Tu cuenta de exchange se vincula durante el onboarding Premium y las apuestas las colocan automáticamente los agentes.",
    gate_agents_title: "Estado de los agentes",
    gate_agents_desc: "El monitor de agentes está disponible solo con el Plan Premium. Muestra heartbeat, errores y estado de cada agente de tu cuenta.",
    gate_upgrade_btn: "Pasar a Pro",
    // Footer
    footer_note: "Sportsbook Edge Desk · solo ejecución verificada · interfaz de nivel cliente",
    rg_footer: "18+. Juega con responsabilidad. El contenido es informativo; cuotas y bonos son ofertas de socios afiliados.",
    // History
    hist_matches: "Partidos", hist_bets: "Apuestas", hist_won: "Ganadas", hist_lost: "Perdidas",
    hist_hit_rate: "Tasa de acierto",
    hist_filter_all: "Todos los partidos", hist_filter_with_bet: "Con apuesta", hist_filter_won: "Ganadas",
    hist_filter_lost: "Perdidas", hist_filter_no_bet: "Sin apuesta",
    hist_legend_won: "Apuesta ganada", hist_legend_lost: "Apuesta perdida",
    hist_legend_pending: "Pendiente", hist_legend_no_bet: "Sin apuesta",
    hist_loading: "Cargando historial de los últimos 30 días…", hist_empty: "Aún no hay datos históricos — haz primero algunas apuestas",
    hist_model_pred: "Predicción del modelo", hist_no_bet: "sin apuesta",
    hist_model_correct: "✓ modelo correcto", hist_model_wrong: "✗ modelo incorrecto",
    portfolio_recent_eyebrow: "Apuestas recientes",
    portfolio_recent_title: "Últimas operaciones",
    portfolio_total: "total",
    portfolio_empty: "Aún no hay operaciones disponibles.",
    portfolio_hero_title: "Portfolio unificado",
    portfolio_hero_desc: "El rendimiento del cliente y el desk operativo ahora están en la misma página.",
    portfolio_open_desk: "Abrir Desk",
    portfolio_open_positions: "Posiciones Abiertas",
    portfolio_starting_capital: "Capital Inicial",
    portfolio_trend: "Tendencia del portfolio",
    price_month: "mes",
    crypto_profile_required: "Crea un perfil o inicia sesión para elegir este plan.",
    crypto_activate: "Activar",
    crypto_create_first: "Crea primero un perfil",
    checkout_copy: "Copiar",
    checkout_copied: "✓ Copiado",
    checkout_amount: "Importe",
    checkout_monthly: "Mensual",
    checkout_note_prefix: "Tras la verificación, el plan se activa manualmente. No envíes importes distintos a",
    checkout_note_suffix: "USDT.",
    checkout_cancel: "Cancelar",
    founder_invalid: "Código no válido.",
    founder_network: "Error de red.",
    founder_title: "Acceso de founder",
    founder_desc: "Introduce el código secreto para acceder con privilegios de admin.",
    founder_secret: "Código secreto",
    founder_checking: "Verificando...",
    founder_login: "Entrar como founder",
    tennis_elo_data: "Datos del modelo",
    tennis_pipeline_title: "Tennis Pipeline · 6 Agentes",
    tennis_last_seen: "Visto por última vez",
    tennis_no_heartbeat: "Aún sin heartbeat",
    tennis_footer: "Tennis AI v2.0 · modelo calibrado · 2.966 jugadores · settlement loop en vivo",
    agent_arch_title: "Arquitectura híbrida v5.0",
    agent_arch_dashboard_title: "Dashboard (Vercel)",
    agent_arch_dashboard_desc: "Modelo calibrado · API-Football · Odds. Siempre online, independiente de los agentes Python locales.",
    agent_arch_agents_title: "Agentes Python (local)",
    agent_arch_agents_desc: "Análisis en tiempo real, League & Match Context Module, ejecución en exchange, Ollama AI. Inicia con",
    agent_arch_none: "⚠️ No hay agentes activos. Inicia el sistema con",
    agent_arch_none_suffix: "dentro de la carpeta del proyecto.",
    agent_last_seen: "Visto por última vez",
    agent_no_heartbeat: "No se ha recibido heartbeat",
    partner_primary_name: "Sportsbook Partner",
    partner_primary_desc: "Casino y plataforma de apuestas deportivas — partner exclusivo del proyecto. Enlace de acceso en fase de finalización. Disponible en breve.",
    partner_tag_exclusive: "Exclusivo",
    language_it: "Italiano", language_en: "Inglés", language_es: "Español", language_fr: "Francés", language_ru: "Ruso",
    account_pending_detail: "Cuenta de cliente aún no conectada. El saldo empieza en cero.",
    // Topnav / shell (i18n migration)
    nav_markets: "Mercados", nav_predictions: "Predicciones", nav_leaderboard: "Clasificación", nav_account: "Cuenta",
    auth_signin: "Entrar", auth_register: "Registrarse",
    theme_aria: "Tema", featured_label: "Destacados",
    kpi_events_lbl: "Eventos", kpi_withedge: "Con edge", kpi_hit: "Acierto · 100d",
    season_pause: "Temporada en pausa — no hay partidos programados en las próximas 48h. Las predicciones vuelven automáticamente cuando las ligas se reanuden (julio 2026).",
    footer_pastperf: "El rendimiento pasado no garantiza resultados futuros.",
    footer_partnerlinks: "Los enlaces de partners son afiliados comerciales.",
    footer_terms: "Términos del Servicio",
    footer_privacy: "Política de Privacidad",
    // Bets filter bar (i18n migration)
    bf_allsports: "Todos", bf_allsignals: "Todas las predicciones", bf_valueonly: "Solo best bets",
    bf_competition: "Competición", bf_allcompetitions: "Todas las competiciones",
    bf_surface: "Superficie", bf_allsurfaces: "Todas", bf_sort: "Ordenar", bf_edge: "Mejor edge",
    bf_time: "Hora", bf_odds: "Cuota más alta", bf_probability: "Probabilidad del modelo",
    bf_search: "Buscar equipo, jugador, torneo...", bf_showing: "Mostrando",
    bf_noresults: "Ningún mercado coincide con estos filtros. Amplía la búsqueda o vuelve a Todos.",
    // Best Bets board filter bar (i18n migration)
    bb_probability: "Mayor probabilidad", bb_time: "Próximo a empezar",
    bb_search: "Buscar partido, equipo, jugador...", bb_valuemode: "+EV en directo",
    bb_modelmode: "Top Model Signals", bb_noedge: "señales del modelo",
  },
  fr: {
    ...BASE_TRANSLATIONS.en,
    // Nav
    nav_dashboard: "Tableau", nav_portfolio: "Portfolio", nav_plans: "Plans",
    nav_bestbets: "Meilleurs bets", nav_sports: "Sports", nav_tennis: "Tennis", nav_bets: "Paris",
    nav_history: "Historique", nav_partner: "Partner", nav_settings: "Paramètres", nav_status: "Statut",
    // Header
    header_events: "événements", header_ev: "+EV", header_login: "Connexion / Créer profil",
    // PreAccess
    preaccess_eyebrow: "Accès client requis",
    preaccess_title: "BetRedge privé pour des edges vérifiés",
    preaccess_subtitle: "Les prédictions, le portfolio, les mises et le wallet de paiement restent masqués jusqu'à ce que le client se connecte et choisisse un plan.",
    preaccess_login: "Connexion", preaccess_create: "Créer profil",
    preaccess_s1_title: "Créer profil", preaccess_s1_desc: "Compte client avec langue, plan et statut de paiement.",
    preaccess_s2_title: "Choisir un plan", preaccess_s2_desc: "Free pour l'aperçu, BetRedge Pro pour les signaux et la recherche.",
    preaccess_s3_title: "Envoyer des USDT", preaccess_s3_desc: "L'adresse du wallet n'apparaît que dans le checkout client.",
    preaccess_s4_title: "Débloquer le desk", preaccess_s4_desc: "Données en direct visibles seulement après activation du plan ou validation interne.",
    preaccess_base_desc: "BetRedge Pro : tennis en direct, recherche football et Best Bets",
    preaccess_premium_desc: "Accès avancés réservés à l'équipe interne",
    // Auth modal
    auth_eyebrow: "Accès client",
    auth_login_title: "Connexion BetRedge",
    auth_create_title: "Crée ton profil BetRedge",
    auth_login_sub: "Connecte-toi avec l'email utilisé pour ton profil client.",
    auth_create_sub: "Crée ton profil, puis choisis BetRedge Pro pour débloquer les données.",
    auth_name_label: "Nom", auth_name_placeholder: "Ton nom",
    auth_not_found: "Profil introuvable. Crée un profil client pour continuer.",
    auth_create_btn: "Continuer vers les plans",
    auth_footer: "BetRedge Pro est crypto uniquement. Les données de prédiction restent verrouillées tant que le plan n'est pas actif.",
    auth_pw_placeholder_new: "Au moins 8 caractères",
    auth_err_wrongpw: "Email ou mot de passe incorrect.", auth_err_noaccount: "Aucun compte pour cet email. Inscris-toi.",
    auth_err_exists: "Le compte existe déjà — connecte-toi.", auth_err_founder: "Ce profil requiert un accès founder.",
    auth_err_pwshort: "Le mot de passe doit comporter au moins 8 caractères.", auth_err_generic: "Erreur. Réessaie.",
    auth_hint_incomplete: "Saisis un email valide et un mot de passe d'au moins 8 caractères.",
    auth_age_confirm: "Je confirme avoir au moins 18 ans.",
    auth_tos_pre: "J'accepte les ", auth_tos_terms: "Conditions de Service", auth_tos_mid: " et la ", auth_tos_privacy: "Politique de Confidentialité", auth_tos_post: ".",
    auth_hint_consent: "Confirme que tu es majeur et accepte les Conditions pour continuer.",
    // Plans
    plans_eyebrow: "Plans client",
    plans_title: "Un seul plan payant, promesse claire",
    plans_subtitle: "Free reste un aperçu. BetRedge Pro débloque le tennis en direct, la recherche football, les Best Bets, les explications et le track record. Aucune promesse agressive de battre le marché.",
    plans_cta: "Voir les edges en direct",
    plans_base_desc: "Pour les clients qui veulent un desk de paris IA avec signaux contrôlés, probabilités, explications, qualité des données et suivi live/paper.",
    plans_base_core: "Signaux et recherche, pas un pilote automatique", plans_base_sub: "La décision finale reste au client",
    plans_base_f1: "Best Bets +EV quand cotes et edge sont disponibles",
    plans_base_f2: "Top Model Signals quand les marchés en direct sont calmes",
    plans_base_f3: "Probabilité du modèle, cote disponible et explication",
    plans_base_f4: "Recherche Tennis Live V4 et Football Live V4",
    plans_base_f5: "Historique et track record",
    plans_base_f6: "Exécution automatique réelle",
    plans_base_f7: "Aucune promesse de profit garanti",
    plans_premium_desc: "Pour le client qui veut déléguer aux agents : analyse, décision, mise et placement en direct.",
    plans_premium_core: "Je le fais pour toi", plans_premium_sub: "Couche d'exécution avec audit complet",
    plans_premium_f1: "Tout le plan Base inclus",
    plans_premium_f2: "Agents débloqués pour placer les paris automatiquement",
    plans_premium_f3: "Dimensionnement de la mise selon bankroll et profil de risque",
    plans_premium_f4: "Stop loss, limites journalières et limites par sport",
    plans_premium_f5: "Exécution en direct seulement avec bet ID confirmé",
    plans_premium_f6: "Rapport automatique après chaque opération",
    plans_premium_f7: "Chaque client relie son propre compte exchange",
    plans_premium_f8: "Dashboard modifiable pour limites et profil de risque",
    plans_flow1_title: "Signal", plans_flow1_desc: "Les agents trouvent le value bet.",
    plans_flow2_title: "Expliquer", plans_flow2_desc: "Le client voit la cote, l'edge et le pourquoi.",
    plans_flow3_title: "Décider", plans_flow3_desc: "Le client décide d'entrer ou non : pas d'exécution automatique au lancement.",
    plans_flow4_title: "Suivre", plans_flow4_desc: "Les prédictions sont enregistrées avant l'événement et mesurées dans le track record.",
    // Prediction card
    pred_why_show: "▼ pourquoi", pred_why_hide: "▲ moins",
    no_clear_favorite: "Pas de favori net", open_match: "Match ouvert",
    pred_why_title: "Pourquoi cette prédiction",
    // Tennis card
    tennis_why_show: "▼ pourquoi", tennis_why_hide: "▲ moins",
    tennis_ai_label: "Analyse IA",
    tennis_elo_label: "Analyse du modèle",
    tennis_ai_loading: "Génération de l'analyse IA...",
    // Sportsbook board
    board_title: "Meilleurs edges disponibles", board_eyebrow: "Tableau de marché",
    board_football: "Football", board_tennis: "Tennis",
    board_value: "value", board_markets: "marchés", board_matches: "matchs",
    board_football_empty: "Aucun match de football programmé. Les marchés reviennent automatiquement à la reprise de la saison.",
    board_tennis_empty: "Chargement des marchés de tennis. Les données de secours apparaissent quand l'API est prête.",
    // Profile panel
    profile_upgrade_eyebrow: "Passer à Pro",
    profile_upgrade_title: "BetRedge Pro",
    profile_upgrade_desc: "Débloque le tennis en direct, la recherche football, les Best Bets, les explications du modèle et le track record.",
    profile_upgrade_btn: "Passer à Pro",
    profile_logout: "Déconnexion",
    // Settings
    settings_empty_title: "Crée un profil pour configurer ton service",
    settings_empty_btn: "Créer profil",
    settings_save: "Enregistrer les paramètres",
    // Pending payment
    pending_title: "Paiement envoyé",
    pending_subtitle: "Hash de TX reçu. Le plan reste en cours de vérification jusqu'à son approbation interne.",
    pending_tx_label: "Hash de TX envoyé :",
    pending_go_plans: "← Retour aux plans",
    // Checkout
    checkout_title: "Acheter un plan",
    checkout_step1: "Copie l'adresse du wallet USDT (TRC20)",
    checkout_step2: "Envoie le montant exact depuis ton wallet",
    checkout_step3: "Colle le hash de TX pour confirmer",
    checkout_tx_label: "Hash de TX", checkout_sla: "Activation manuelle sous 12h après confirmation on-chain. Problèmes ou retards :",
    checkout_tx_placeholder: "Colle ici le hash de la transaction",
    checkout_confirm: "Envoyer le hash de TX",
    // Misc
    bet_now: "Placer le pari →",
    refresh_odds: "RAFRAÎCHIR ODDS",
    loading_predictions: "Calcul des prédictions calibrées…",
    no_predictions: "Pas encore de prédictions — clique sur Rafraîchir",
    no_match_filters: "Aucun match pour les filtres sélectionnés",
    // BetSlip
    betslip_eyebrow: "Coupon", betslip_live: "Ticket live", betslip_signal: "Ticket signal",
    betslip_clear: "Effacer", betslip_no_sel: "Aucune sélection",
    betslip_no_sel_desc: "Clique sur une cote du tableau de marché unifié pour inspecter la qualité d'exécution.",
    betslip_selection: "Sélection", betslip_odds: "Cote", betslip_model_prob: "Probabilité du modèle",
    betslip_edge: "Edge", betslip_market_only: "marché seulement", betslip_stake: "Mise",
    betslip_return: "Retour",
    betslip_football_btn: "Vérifier l'ordre football", betslip_tennis_btn: "Enregistrer le signal tennis",
    betslip_football_note: "Le football ne peut s'exécuter en direct qu'après approbation du risque et lorsque l'exchange renvoie un bet ID confirmé.",
    betslip_tennis_note: "Le tennis est en signal uniquement tant que le mapping des runners n'est pas entièrement vérifié pour l'exécution en direct.",
    // Client summary strip
    summary_football_edge: "Edge Football",
    summary_tennis_signals: "Signaux Tennis", summary_exec_quality: "Qualité d'Exécution",
    summary_pending_bets: "paris en attente", summary_waiting_markets: "en attente des marchés",
    summary_signal_active: "couche signal active", summary_blocked: "bloqués/rejetés en sécurité",
    summary_id_required: "ID requis pour l'exécution live",
    // LockedGate
    locked_eyebrow: "BetRedge verrouillé", locked_title: "Connecte-toi pour voir prédictions, edge et explications",
    locked_desc: "Les données sensibles restent masquées jusqu'à ta connexion et l'activation d'un plan.",
    locked_btn: "Connexion / Créer profil",
    locked_plan_eyebrow: "Plan requis",
    locked_plan_title: "Choisis un pack pour débloquer le desk",
    locked_plan_desc: "Ton profil est actif, mais les prédictions, l'edge et les explications ne se débloquent qu'après avoir choisi BetRedge Pro.",
    locked_plan_btn: "Aller aux abonnements",
    // Page headers
    page_overview: "Tableau client", page_portfolio: "Portfolio client",
    page_plans: "Plans client", page_bestbets: "Meilleurs bets",
    page_sports: "Prédictions sportives", page_tennis: "Tennis · Modèle calibré", page_bets: "Journal d'exécution",
    page_history: "Historique réglé",
    page_partners: "Casino & Réseau de Partners", page_settings: "Paramètres du compte",
    page_agents: "Santé et sécurité", page_eyebrow: "Sportsbook client",
    // Top bar
    topbar_private: "desk privé", topbar_scanning: "analyse", topbar_plans: "plans actifs", topbar_syncing: "sync",
    // Rail
    rail_desk: "DESK", rail_exec_title: "Couche d'exécution",
    rail_exec_note: "Exécution en direct seulement avec bet ID confirmé. Tennis en couche signal.",
    // KPIs in overview
    kpi_events: "événements", kpi_ev: "+EV", kpi_win: "% réussite",
    // Predictions tab
    pred_model_badge: "Modèle calibré · Forme · 30 prochains jours",
    pred_computing: "Calcul…", pred_refresh: "↻ Rafraîchir",
    pred_stale_warning: "⚠️ Prédictions de plus d'1 heure — clique sur Rafraîchir pour recalculer (~90s)",
    pred_value_bet: "value bet", pred_value_bets: "value bets",
    pred_sort_label: "Tri", pred_sort_closest: "Les plus proches", pred_sort_farthest: "Les plus lointains",
    pred_sort_best_edge: "Meilleur edge", pred_sort_importance: "Les plus importants",
    pred_cat_label: "Cat.", pred_cat_all: "Toutes", pred_cat_european: "⭐ Européennes",
    pred_cat_top5: "Top 5 ligues", pred_cat_ev: "+EV seulement",
    pred_value_only: "+EV seulement", pred_league_label: "Ligue",
    pred_type_label: "Type", pred_all_types: "Tous les types",
    pred_showing: "Affichage", pred_of: "sur", pred_predictions: "prédictions",
    pred_loading_sub: "Le premier chargement peut prendre ~90s pour récupérer les données historiques",
    // Tennis tab
    tennis_badge: "Tennis AI v2.0 · ATP + WTA · Couche signal",
    tennis_computed: "calculé", tennis_matches_loaded: "matchs chargés",
    tennis_kpi_today: "Matchs Aujourd'hui", tennis_kpi_value: "Value Bets", tennis_kpi_markets: "Marchés Actifs",
    tennis_surface_label: "Surface",
    tennis_loading: "Chargement des prédictions tennis…", tennis_no_matches: "Aucun match disponible",
    // Partners tab
    partners_eyebrow: "Réseau commercial", partners_title: "Casino & Partners Sportsbook",
    partners_desc: "Plateformes de jeu et de paris avec lesquelles BetRedge collabore — intégration de signaux, edge et outils IA pour les opérateurs.",
    partners_active: "Partners Actifs", partners_negotiation: "En Négociation", partners_coming: "Bientôt",
    partners_section_exclusive: "Partners Exclusifs", partners_section_network: "Réseau de Partners",
    partners_invite_title: "Envie de collaborer ?", partners_invite_desc: "Contacte-nous pour intégrer nos signaux IA à ta plateforme.",
    partners_since: "Partner depuis", partners_visit: "Visiter →", partners_link_soon: "Lien à venir", partners_affiliate_note: "*Lien d'affiliation — nous pouvons toucher une commission, sans frais pour toi.",
    partners_status_active: "Actif", partners_status_featured: "⭐ En vedette",
    partners_status_negotiation: "En Négociation", partners_status_coming: "Bientôt",
    partners_exclusive_badge: "Partner Exclusif",
    // Portfolio/Bets/Agents premium gates
    gate_eyebrow: "Accès interne", gate_portfolio_title: "Portfolio en direct",
    gate_portfolio_desc: "Le portfolio en direct, le graphique d'equity et le P&L détaillé par sport ne font pas partie du plan public de lancement.",
    gate_bets_title: "Journal d'exécution",
    gate_bets_desc: "Le journal des paris des agents est disponible uniquement avec le Plan Premium. Ton compte exchange est relié pendant l'onboarding Premium et les paris sont placés automatiquement par les agents.",
    gate_agents_title: "Statut des agents",
    gate_agents_desc: "Le moniteur des agents est disponible uniquement avec le Plan Premium. Il affiche le heartbeat, les erreurs et le statut de chaque agent de ton compte.",
    gate_upgrade_btn: "Passer à Pro",
    // Footer
    footer_note: "Sportsbook Edge Desk · exécution vérifiée uniquement · interface de niveau client",
    rg_footer: "18+. Jouez de façon responsable. Le contenu est informatif ; les cotes et bonus sont des offres de partenaires affiliés.",
    // History
    hist_matches: "Matchs", hist_bets: "Paris placés", hist_won: "Gagnés", hist_lost: "Perdus",
    hist_hit_rate: "Taux de réussite",
    hist_filter_all: "Tous les matchs", hist_filter_with_bet: "Avec pari", hist_filter_won: "Gagnés",
    hist_filter_lost: "Perdus", hist_filter_no_bet: "Sans pari",
    hist_legend_won: "Pari gagné", hist_legend_lost: "Pari perdu",
    hist_legend_pending: "En attente", hist_legend_no_bet: "Sans pari",
    hist_loading: "Chargement de l'historique des 30 derniers jours…", hist_empty: "Pas encore de données historiques — place d'abord quelques paris",
    hist_model_pred: "Prédiction du modèle", hist_no_bet: "sans pari",
    hist_model_correct: "✓ modèle correct", hist_model_wrong: "✗ modèle erroné",
    portfolio_recent_eyebrow: "Paris récents",
    portfolio_recent_title: "Dernières opérations",
    portfolio_total: "total",
    portfolio_empty: "Aucune opération disponible pour l'instant.",
    portfolio_hero_title: "Portfolio unifié",
    portfolio_hero_desc: "La performance du client et le desk opérationnel sont désormais sur la même page.",
    portfolio_open_desk: "Ouvrir le Desk",
    portfolio_open_positions: "Positions Ouvertes",
    portfolio_starting_capital: "Capital de Départ",
    portfolio_trend: "Tendance du portfolio",
    price_month: "mois",
    crypto_profile_required: "Crée un profil ou connecte-toi pour choisir ce plan.",
    crypto_activate: "Activer",
    crypto_create_first: "Crée d'abord un profil",
    checkout_copy: "Copier",
    checkout_copied: "✓ Copié",
    checkout_amount: "Montant",
    checkout_monthly: "Mensuel",
    checkout_note_prefix: "Après vérification, le plan est activé manuellement. N'envoie pas de montants différents de",
    checkout_note_suffix: "USDT.",
    checkout_cancel: "Annuler",
    founder_invalid: "Code invalide.",
    founder_network: "Erreur réseau.",
    founder_title: "Accès founder",
    founder_desc: "Saisis le code secret pour accéder aux privilèges admin.",
    founder_secret: "Code secret",
    founder_checking: "Vérification...",
    founder_login: "Se connecter en tant que founder",
    tennis_elo_data: "Données du modèle",
    tennis_pipeline_title: "Tennis Pipeline · 6 Agents",
    tennis_last_seen: "Vu pour la dernière fois",
    tennis_no_heartbeat: "Pas encore de heartbeat",
    tennis_footer: "Tennis AI v2.0 · modèle calibré · 2 966 joueurs · settlement loop en direct",
    agent_arch_title: "Architecture hybride v5.0",
    agent_arch_dashboard_title: "Dashboard (Vercel)",
    agent_arch_dashboard_desc: "Modèle calibré · API-Football · Odds. Toujours en ligne, indépendant des agents Python locaux.",
    agent_arch_agents_title: "Agents Python (local)",
    agent_arch_agents_desc: "Analyse en temps réel, League & Match Context Module, exécution sur exchange, Ollama AI. Démarre avec",
    agent_arch_none: "⚠️ Aucun agent actif. Démarre le système avec",
    agent_arch_none_suffix: "dans le dossier du projet.",
    agent_last_seen: "Vu pour la dernière fois",
    agent_no_heartbeat: "Aucun heartbeat reçu",
    partner_primary_name: "Sportsbook Partner",
    partner_primary_desc: "Casino et plateforme de paris sportifs — partner exclusif du projet. Lien d'accès en cours de finalisation. Disponible bientôt.",
    partner_tag_exclusive: "Exclusif",
    language_it: "Italien", language_en: "Anglais", language_es: "Espagnol", language_fr: "Français", language_ru: "Russe",
    account_pending_detail: "Compte client pas encore connecté. Le solde démarre à zéro.",
    // Topnav / shell (i18n migration)
    nav_markets: "Marchés", nav_predictions: "Prédictions", nav_leaderboard: "Classement", nav_account: "Compte",
    auth_signin: "Connexion", auth_register: "S'inscrire",
    theme_aria: "Thème", featured_label: "À la une",
    kpi_events_lbl: "Événements", kpi_withedge: "Avec edge", kpi_hit: "Réussite · 100j",
    season_pause: "Saison en pause — aucun match programmé dans les 48 prochaines heures. Les prédictions reviennent automatiquement à la reprise des ligues (juillet 2026).",
    footer_pastperf: "Les performances passées ne garantissent pas les résultats futurs.",
    footer_partnerlinks: "Les liens partners sont des affiliés commerciaux.",
    footer_terms: "Conditions de Service",
    footer_privacy: "Politique de Confidentialité",
    // Bets filter bar (i18n migration)
    bf_allsports: "Tous", bf_allsignals: "Toutes les prédictions", bf_valueonly: "Best bets uniquement",
    bf_competition: "Compétition", bf_allcompetitions: "Toutes les compétitions",
    bf_surface: "Surface", bf_allsurfaces: "Toutes", bf_sort: "Trier", bf_edge: "Meilleur edge",
    bf_time: "Heure", bf_odds: "Cote la plus élevée", bf_probability: "Probabilité du modèle",
    bf_search: "Rechercher équipe, joueur, tournoi...", bf_showing: "Affichage",
    bf_noresults: "Aucun marché ne correspond à ces filtres. Élargis la recherche ou reviens à Tous.",
    // Best Bets board filter bar (i18n migration)
    bb_probability: "Probabilité la plus élevée", bb_time: "Coup d'envoi le plus proche",
    bb_search: "Rechercher match, équipe, joueur...", bb_valuemode: "+EV en direct",
    bb_modelmode: "Top Model Signals", bb_noedge: "signaux du modèle",
  },
  ru: {
    ...BASE_TRANSLATIONS.en,
    // Nav
    nav_dashboard: "Панель", nav_portfolio: "Портфель", nav_plans: "Планы",
    nav_bestbets: "Лучшие ставки", nav_sports: "Спорт", nav_tennis: "Теннис", nav_bets: "Ставки",
    nav_history: "История", nav_partner: "Партнёры", nav_settings: "Настройки", nav_status: "Статус",
    // Header
    header_events: "события", header_ev: "+EV", header_login: "Войти / Создать профиль",
    // PreAccess
    preaccess_eyebrow: "Требуется доступ клиента",
    preaccess_title: "Приватный BetRedge для проверенных edge",
    preaccess_subtitle: "Прогнозы, портфель, размеры ставок и платёжный кошелёк скрыты, пока клиент не войдёт и не выберет план.",
    preaccess_login: "Войти", preaccess_create: "Создать профиль",
    preaccess_s1_title: "Создать профиль", preaccess_s1_desc: "Аккаунт клиента с языком, планом и статусом оплаты.",
    preaccess_s2_title: "Выбрать план", preaccess_s2_desc: "Free для превью, BetRedge Pro для сигналов и исследований.",
    preaccess_s3_title: "Отправить USDT", preaccess_s3_desc: "Адрес кошелька появляется только внутри клиентского checkout.",
    preaccess_s4_title: "Разблокировать desk", preaccess_s4_desc: "Live-данные видны только после активации плана или внутреннего одобрения.",
    preaccess_base_desc: "BetRedge Pro: теннис live, исследование футбола и Best Bets",
    preaccess_premium_desc: "Расширенный доступ зарезервирован для внутренней команды",
    // Auth modal
    auth_eyebrow: "Доступ клиента",
    auth_login_title: "Вход в BetRedge",
    auth_create_title: "Создай профиль BetRedge",
    auth_login_sub: "Войди с email, использованным для твоего профиля клиента.",
    auth_create_sub: "Создай профиль, затем выбери BetRedge Pro, чтобы открыть данные.",
    auth_name_label: "Имя", auth_name_placeholder: "Твоё имя",
    auth_not_found: "Профиль не найден. Создай профиль клиента, чтобы продолжить.",
    auth_create_btn: "Перейти к планам",
    auth_footer: "BetRedge Pro — только крипта. Данные прогнозов остаются заблокированными, пока план не активен.",
    auth_pw_placeholder_new: "Минимум 8 символов",
    auth_err_wrongpw: "Неверный email или пароль.", auth_err_noaccount: "Нет аккаунта с этим email. Зарегистрируйся.",
    auth_err_exists: "Аккаунт уже существует — войди.", auth_err_founder: "Этот профиль требует founder-доступа.",
    auth_err_pwshort: "Пароль должен содержать минимум 8 символов.", auth_err_generic: "Ошибка. Попробуй снова.",
    auth_hint_incomplete: "Введи корректный email и пароль не короче 8 символов.",
    auth_age_confirm: "Подтверждаю, что мне не менее 18 лет.",
    auth_tos_pre: "Я принимаю ", auth_tos_terms: "Условия использования", auth_tos_mid: " и ", auth_tos_privacy: "Политику конфиденциальности", auth_tos_post: ".",
    auth_hint_consent: "Подтверди совершеннолетие и прими Условия, чтобы продолжить.",
    // Plans
    plans_eyebrow: "Планы клиента",
    plans_title: "Один платный план, понятное обещание",
    plans_subtitle: "Free остаётся превью. BetRedge Pro открывает теннис live, исследование футбола, Best Bets, объяснения и track record. Без агрессивных обещаний обыграть рынок.",
    plans_cta: "Смотреть live edges",
    plans_base_desc: "Для клиентов, которым нужен AI-desk для ставок с контролируемыми сигналами, вероятностями, объяснениями, качеством данных и трекингом live/paper.",
    plans_base_core: "Сигналы и исследования, не автопилот", plans_base_sub: "Финальное решение за клиентом",
    plans_base_f1: "Best Bets +EV, когда есть котировки и edge",
    plans_base_f2: "Top Model Signals, когда live-рынки пустые",
    plans_base_f3: "Вероятность модели, доступная котировка и объяснение",
    plans_base_f4: "Исследование Tennis Live V4 и Football Live V4",
    plans_base_f5: "История и track record",
    plans_base_f6: "Реальное автоматическое исполнение",
    plans_base_f7: "Без обещаний гарантированной прибыли",
    plans_premium_desc: "Для клиента, который хочет делегировать агентам: анализ, решение, размер ставки и live-размещение.",
    plans_premium_core: "Я делаю это за тебя", plans_premium_sub: "Слой исполнения с полным аудитом",
    plans_premium_f1: "Всё из плана Base",
    plans_premium_f2: "Агенты разблокированы для автоматического размещения ставок",
    plans_premium_f3: "Расчёт ставки по банкроллу и профилю риска",
    plans_premium_f4: "Stop loss, дневные лимиты и лимиты по виду спорта",
    plans_premium_f5: "Live-исполнение только с подтверждённым bet ID",
    plans_premium_f6: "Автоматический отчёт после каждой операции",
    plans_premium_f7: "Каждый клиент подключает свой аккаунт exchange",
    plans_premium_f8: "Редактируемая панель для лимитов и профиля риска",
    plans_flow1_title: "Сигнал", plans_flow1_desc: "Агенты находят value bet.",
    plans_flow2_title: "Объяснить", plans_flow2_desc: "Клиент видит котировку, edge и почему.",
    plans_flow3_title: "Решить", plans_flow3_desc: "Клиент решает, входить ли: без автоисполнения на старте.",
    plans_flow4_title: "Отслеживать", plans_flow4_desc: "Прогнозы сохраняются до события и измеряются в track record.",
    // Prediction card
    pred_why_show: "▼ почему", pred_why_hide: "▲ меньше",
    no_clear_favorite: "Нет явного фаворита", open_match: "Открытый матч",
    pred_why_title: "Почему этот прогноз",
    // Tennis card
    tennis_why_show: "▼ почему", tennis_why_hide: "▲ меньше",
    tennis_ai_label: "AI-анализ",
    tennis_elo_label: "Анализ модели",
    tennis_ai_loading: "Генерация AI-анализа...",
    // Sportsbook board
    board_title: "Лучшие доступные edge", board_eyebrow: "Доска рынка",
    board_football: "Футбол", board_tennis: "Теннис",
    board_value: "value", board_markets: "рынки", board_matches: "матчи",
    board_football_empty: "Нет запланированных футбольных матчей. Рынки вернутся автоматически с возобновлением сезона.",
    board_tennis_empty: "Загрузка теннисных рынков. Резервные данные появятся, когда API будет готов.",
    // Profile panel
    profile_upgrade_eyebrow: "Перейти на Pro",
    profile_upgrade_title: "BetRedge Pro",
    profile_upgrade_desc: "Открой теннис live, исследование футбола, Best Bets, объяснения модели и track record.",
    profile_upgrade_btn: "Перейти на Pro",
    profile_logout: "Выйти",
    // Settings
    settings_empty_title: "Создай профиль, чтобы настроить сервис",
    settings_empty_btn: "Создать профиль",
    settings_save: "Сохранить настройки",
    // Pending payment
    pending_title: "Платёж отправлен",
    pending_subtitle: "Хэш TX получен. План остаётся на проверке до внутреннего одобрения.",
    pending_tx_label: "Отправленный хэш TX:",
    pending_go_plans: "← Назад к планам",
    // Checkout
    checkout_title: "Купить план",
    checkout_step1: "Скопируй адрес кошелька USDT (TRC20)",
    checkout_step2: "Отправь точную сумму со своего кошелька",
    checkout_step3: "Вставь хэш TX для подтверждения",
    checkout_tx_label: "Хэш TX", checkout_sla: "Ручная активация в течение 12ч после подтверждения on-chain. Проблемы или задержки:",
    checkout_tx_placeholder: "Вставь сюда хэш транзакции",
    checkout_confirm: "Отправить хэш TX",
    // Misc
    bet_now: "Сделать ставку →",
    refresh_odds: "ОБНОВИТЬ ODDS",
    loading_predictions: "Вычисление калиброванных прогнозов…",
    no_predictions: "Пока нет прогнозов — нажми Обновить",
    no_match_filters: "Нет матчей по выбранным фильтрам",
    // BetSlip
    betslip_eyebrow: "Купон", betslip_live: "Live-тикет", betslip_signal: "Сигнальный тикет",
    betslip_clear: "Очистить", betslip_no_sel: "Нет выбора",
    betslip_no_sel_desc: "Нажми на ячейку котировки на едином рынке, чтобы проверить качество исполнения.",
    betslip_selection: "Выбор", betslip_odds: "Котировка", betslip_model_prob: "Вероятность модели",
    betslip_edge: "Edge", betslip_market_only: "только рынок", betslip_stake: "Ставка",
    betslip_return: "Возврат",
    betslip_football_btn: "Проверить футбольный ордер", betslip_tennis_btn: "Сохранить теннисный сигнал",
    betslip_football_note: "Футбол исполняется live только после одобрения риска и когда exchange возвращает подтверждённый bet ID.",
    betslip_tennis_note: "Теннис — только сигнал, пока маппинг runner не полностью проверен для live-исполнения.",
    // Client summary strip
    summary_football_edge: "Edge футбола",
    summary_tennis_signals: "Сигналы тенниса", summary_exec_quality: "Качество исполнения",
    summary_pending_bets: "ставки в ожидании", summary_waiting_markets: "ожидание рынков",
    summary_signal_active: "сигнальный слой активен", summary_blocked: "заблокированы/отклонены безопасно",
    summary_id_required: "ID нужен для live-исполнения",
    // LockedGate
    locked_eyebrow: "BetRedge заблокирован", locked_title: "Войди, чтобы увидеть прогнозы, edge и объяснения",
    locked_desc: "Чувствительные данные скрыты, пока ты не войдёшь и не активируешь план.",
    locked_btn: "Войти / Создать профиль",
    locked_plan_eyebrow: "Нужен план",
    locked_plan_title: "Выбери пакет, чтобы разблокировать desk",
    locked_plan_desc: "Профиль активен, но прогнозы, edge и объяснения открываются только после выбора BetRedge Pro.",
    locked_plan_btn: "К подпискам",
    // Page headers
    page_overview: "Панель клиента", page_portfolio: "Портфель клиента",
    page_plans: "Планы клиента", page_bestbets: "Лучшие ставки",
    page_sports: "Спортивные прогнозы", page_tennis: "Теннис · Калиброванная модель", page_bets: "Журнал исполнения",
    page_history: "Закрытая история",
    page_partners: "Казино и сеть партнёров", page_settings: "Настройки аккаунта",
    page_agents: "Здоровье и безопасность", page_eyebrow: "Клиентский sportsbook",
    // Top bar
    topbar_private: "приватный desk", topbar_scanning: "анализ", topbar_plans: "планы активны", topbar_syncing: "синхронизация",
    // Rail
    rail_desk: "DESK", rail_exec_title: "Слой исполнения",
    rail_exec_note: "Live-исполнение только с подтверждённым bet ID. Теннис в сигнальном слое.",
    // KPIs in overview
    kpi_events: "события", kpi_ev: "+EV", kpi_win: "% побед",
    // Predictions tab
    pred_model_badge: "Калиброванная модель · Форма · ближайшие 30 дней",
    pred_computing: "Вычисление…", pred_refresh: "↻ Обновить",
    pred_stale_warning: "⚠️ Прогнозы старше 1 часа — нажми Обновить для пересчёта (~90с)",
    pred_value_bet: "value bet", pred_value_bets: "value bets",
    pred_sort_label: "Сортировка", pred_sort_closest: "Сначала ближайшие", pred_sort_farthest: "Сначала дальние",
    pred_sort_best_edge: "Лучший edge", pred_sort_importance: "Самые важные",
    pred_cat_label: "Кат.", pred_cat_all: "Все", pred_cat_european: "⭐ Европейские",
    pred_cat_top5: "Топ-5 лиг", pred_cat_ev: "Только +EV",
    pred_value_only: "Только +EV", pred_league_label: "Лига",
    pred_type_label: "Тип", pred_all_types: "Все типы",
    pred_showing: "Показано", pred_of: "из", pred_predictions: "прогнозов",
    pred_loading_sub: "Первая загрузка может занять ~90с на получение исторических данных",
    // Tennis tab
    tennis_badge: "Tennis AI v2.0 · ATP + WTA · Сигнальный слой",
    tennis_computed: "вычислено", tennis_matches_loaded: "матчей загружено",
    tennis_kpi_today: "Матчи сегодня", tennis_kpi_value: "Value Bets", tennis_kpi_markets: "Активные рынки",
    tennis_surface_label: "Покрытие",
    tennis_loading: "Загрузка теннисных прогнозов…", tennis_no_matches: "Нет доступных матчей",
    // Partners tab
    partners_eyebrow: "Коммерческая сеть", partners_title: "Казино и партнёры Sportsbook",
    partners_desc: "Игровые и беттинговые платформы, с которыми сотрудничает BetRedge — интеграция сигналов, edge и AI-инструменты для операторов.",
    partners_active: "Активные партнёры", partners_negotiation: "В переговорах", partners_coming: "Скоро",
    partners_section_exclusive: "Эксклюзивные партнёры", partners_section_network: "Сеть партнёров",
    partners_invite_title: "Хотите сотрудничать?", partners_invite_desc: "Свяжитесь с нами, чтобы интегрировать наши AI-сигналы в вашу платформу.",
    partners_since: "Партнёр с", partners_visit: "Перейти →", partners_link_soon: "Ссылка скоро", partners_affiliate_note: "*Партнёрская ссылка — мы можем получить комиссию без затрат для тебя.",
    partners_status_active: "Активен", partners_status_featured: "⭐ Рекомендуемый",
    partners_status_negotiation: "В переговорах", partners_status_coming: "Скоро",
    partners_exclusive_badge: "Эксклюзивный партнёр",
    // Portfolio/Bets/Agents premium gates
    gate_eyebrow: "Внутренний доступ", gate_portfolio_title: "Live-портфель",
    gate_portfolio_desc: "Live-портфель, график equity и детальный P&L по видам спорта не входят в публичный план запуска.",
    gate_bets_title: "Журнал исполнения",
    gate_bets_desc: "Журнал ставок агентов доступен только в плане Premium. Твой аккаунт exchange подключается во время онбординга Premium, и ставки размещаются агентами автоматически.",
    gate_agents_title: "Статус агентов",
    gate_agents_desc: "Монитор агентов доступен только в плане Premium. Показывает heartbeat, ошибки и статус каждого агента твоего аккаунта.",
    gate_upgrade_btn: "Перейти на Pro",
    // Footer
    footer_note: "Sportsbook Edge Desk · только проверенное исполнение · интерфейс клиентского уровня",
    rg_footer: "18+. Играй ответственно. Контент носит информационный характер; котировки и бонусы — предложения партнёров-аффилиатов.",
    // History
    hist_matches: "Матчи", hist_bets: "Сделано ставок", hist_won: "Выиграно", hist_lost: "Проиграно",
    hist_hit_rate: "Доля попаданий",
    hist_filter_all: "Все матчи", hist_filter_with_bet: "Со ставкой", hist_filter_won: "Выиграно",
    hist_filter_lost: "Проиграно", hist_filter_no_bet: "Без ставки",
    hist_legend_won: "Ставка выиграна", hist_legend_lost: "Ставка проиграна",
    hist_legend_pending: "В ожидании", hist_legend_no_bet: "Без ставки",
    hist_loading: "Загрузка истории за последние 30 дней…", hist_empty: "Пока нет исторических данных — сначала сделай несколько ставок",
    hist_model_pred: "Прогноз модели", hist_no_bet: "без ставки",
    hist_model_correct: "✓ модель верна", hist_model_wrong: "✗ модель ошиблась",
    portfolio_recent_eyebrow: "Недавние ставки",
    portfolio_recent_title: "Последние операции",
    portfolio_total: "всего",
    portfolio_empty: "Пока нет доступных операций.",
    portfolio_hero_title: "Единый портфель",
    portfolio_hero_desc: "Результаты клиента и операционный desk теперь на одной странице.",
    portfolio_open_desk: "Открыть Desk",
    portfolio_open_positions: "Открытые позиции",
    portfolio_starting_capital: "Начальный капитал",
    portfolio_trend: "Динамика портфеля",
    price_month: "месяц",
    crypto_profile_required: "Создай профиль или войди, чтобы выбрать этот план.",
    crypto_activate: "Активировать",
    crypto_create_first: "Сначала создай профиль",
    checkout_copy: "Копировать",
    checkout_copied: "✓ Скопировано",
    checkout_amount: "Сумма",
    checkout_monthly: "Ежемесячно",
    checkout_note_prefix: "После проверки план активируется вручную. Не отправляй суммы, отличные от",
    checkout_note_suffix: "USDT.",
    checkout_cancel: "Отмена",
    founder_invalid: "Неверный код.",
    founder_network: "Ошибка сети.",
    founder_title: "Founder-доступ",
    founder_desc: "Введи секретный код для доступа с правами admin.",
    founder_secret: "Секретный код",
    founder_checking: "Проверка...",
    founder_login: "Войти как founder",
    tennis_elo_data: "Данные модели",
    tennis_pipeline_title: "Tennis Pipeline · 6 агентов",
    tennis_last_seen: "Последний раз в сети",
    tennis_no_heartbeat: "Пока нет heartbeat",
    tennis_footer: "Tennis AI v2.0 · калиброванная модель · 2 966 игроков · settlement loop live",
    agent_arch_title: "Гибридная архитектура v5.0",
    agent_arch_dashboard_title: "Dashboard (Vercel)",
    agent_arch_dashboard_desc: "Калиброванная модель · API-Football · Odds. Всегда онлайн, независимо от локальных Python-агентов.",
    agent_arch_agents_title: "Python-агенты (локально)",
    agent_arch_agents_desc: "Анализ в реальном времени, League & Match Context Module, исполнение на exchange, Ollama AI. Запусти командой",
    agent_arch_none: "⚠️ Нет активных агентов. Запусти систему командой",
    agent_arch_none_suffix: "в папке проекта.",
    agent_last_seen: "Последний раз в сети",
    agent_no_heartbeat: "Heartbeat не получен",
    partner_primary_name: "Sportsbook Partner",
    partner_primary_desc: "Казино и платформа спортивных ставок — эксклюзивный партнёр проекта. Ссылка доступа дорабатывается. Будет доступна вскоре.",
    partner_tag_exclusive: "Эксклюзив",
    language_it: "Итальянский", language_en: "Английский", language_es: "Испанский", language_fr: "Французский", language_ru: "Русский",
    account_pending_detail: "Аккаунт клиента ещё не подключён. Баланс начинается с нуля.",
    // Topnav / shell (i18n migration)
    nav_markets: "Рынки", nav_predictions: "Прогнозы", nav_leaderboard: "Рейтинг", nav_account: "Аккаунт",
    auth_signin: "Войти", auth_register: "Регистрация",
    theme_aria: "Тема", featured_label: "Избранное",
    kpi_events_lbl: "События", kpi_withedge: "С эджем", kpi_hit: "Точность · 100д",
    season_pause: "Сезон на паузе — в ближайшие 48 часов матчей не запланировано. Прогнозы вернутся автоматически с возобновлением лиг (июль 2026).",
    footer_pastperf: "Прошлые результаты не гарантируют будущих.",
    footer_partnerlinks: "Партнёрские ссылки являются коммерческими аффилиатами.",
    footer_terms: "Условия использования",
    footer_privacy: "Политика конфиденциальности",
    // Bets filter bar (i18n migration)
    bf_allsports: "Все", bf_allsignals: "Все прогнозы", bf_valueonly: "Только best bets",
    bf_competition: "Турнир", bf_allcompetitions: "Все турниры",
    bf_surface: "Покрытие", bf_allsurfaces: "Все", bf_sort: "Сортировка", bf_edge: "Лучший эдж",
    bf_time: "Время", bf_odds: "Высший кэф", bf_probability: "Вероятность модели",
    bf_search: "Поиск: команда, игрок, турнир...", bf_showing: "Показано",
    bf_noresults: "Нет рынков по этим фильтрам. Расширь поиск или вернись ко «Все».",
    // Best Bets board filter bar (i18n migration)
    bb_probability: "Высшая вероятность", bb_time: "Ближайший матч",
    bb_search: "Поиск: матч, команда, игрок...", bb_valuemode: "+EV лайв",
    bb_modelmode: "Top Model Signals", bb_noedge: "сигналы модели",
  },
} as const;

const TRANSLATIONS = {
  ...BASE_TRANSLATIONS,
  ...EXTRA_TRANSLATIONS,
} as const;

type Lang = keyof typeof TRANSLATIONS;
const LANGUAGES: Lang[] = ["en", "it", "es", "fr", "ru"];
const TOPBAR_SUBTITLE: Record<Lang, string> = {
  it: "Un’unica console per segnali, analisi predittiva e live execution.",
  en: "One console for signals, predictive analytics and live execution.",
  es: "Una consola unica para señales, analisis predictivo y ejecucion live.",
  fr: "Une console unique pour signaux, analyse predictive et execution live.",
  ru: "Единая консоль для сигналов, предиктивной аналитики и live execution.",
};

const LanguageCtx = createContext<Lang>("en");
function useLang() { return useContext(LanguageCtx); }

const TzCtx = createContext("Europe/Rome");
const useTz = () => useContext(TzCtx);

interface LiveScore { home_score: number | null; away_score: number | null; match_status: string; minute: number | null; home_team?: string; away_team?: string; }
const LiveCtx = createContext<Record<string, LiveScore>>({});
const useLive = () => useContext(LiveCtx);

// #WC-LIVE-2: the live feed is keyed by the source match_id — football-data id
// for the domestic leagues (where it equals the prediction id), but "espn:<id>"
// for ESPN-only competitions like the World Cup, whose prediction rows carry a
// different id. So a match_id lookup misses the WC live score; fall back to an
// unordered team-name match (same approach as the WC board), then orient the
// record to this prediction so the scorebar AND the realized-result logic stay
// correct. Domestic leagues still hit by match_id first → no behaviour change.
function normLiveTeam(s?: string | null) {
  // Word-order tolerant: ESPN renders "Congo DR" where our rows store
  // "DR Congo" — concatenating in source order made the keys diverge and the
  // live score never matched. Token-sort so both collapse to the same key.
  return (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean).sort().join("");
}
function findLiveByTeams(map: Record<string, LiveScore>, home?: string | null, away?: string | null): LiveScore | undefined {
  const key = [normLiveTeam(home), normLiveTeam(away)].sort().join("|");
  if (key === "|") return undefined;
  for (const s of Object.values(map)) {
    if (s.home_team && s.away_team && [normLiveTeam(s.home_team), normLiveTeam(s.away_team)].sort().join("|") === key) return s;
  }
  return undefined;
}
function orientLive(live: LiveScore | undefined, home?: string | null, away?: string | null): LiveScore | undefined {
  if (!live || !live.home_team) return live;
  const lh = normLiveTeam(live.home_team);
  // Swap only when the feed's home clearly corresponds to our away side.
  if (lh === normLiveTeam(away) && lh !== normLiveTeam(home)) {
    return { ...live, home_score: live.away_score, away_score: live.home_score, home_team: live.away_team, away_team: live.home_team };
  }
  return live;
}

// Live tennis scores reach the cards the same way football live scores do.
// The /api/tennis and /api/tennis-live feeds don't share ids, so a card is
// matched to its live ESPN score by a normalized, order-independent last-name
// pair key (e.g. "alcaraz|sinner").
const LiveTennisCtx = createContext<Record<string, LiveTennisMatch>>({});
const useLiveTennis = () => useContext(LiveTennisCtx);
function tennisLastName(s: string) {
  return (s.split(" ").pop() ?? s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function tennisPairKey(a: string, b: string) {
  return [tennisLastName(a), tennisLastName(b)].sort().join("|");
}
function useT() { return TRANSLATIONS[useLang()]; }
// 5-way inline localization for strings that don't live in TRANSLATIONS.
// Replaces the `lang === "it" ? IT : EN` ternaries so es/fr/ru no longer fall
// back to English. Pass the value per language; `pick` selects by current lang.
function pick5<T>(lang: Lang, v: { it: T; en: T; es: T; fr: T; ru: T }): T { return v[lang]; }
function languageLabel(code: Lang, t: (typeof TRANSLATIONS)[Lang]) {
  const labels: Record<Lang, string> = {
    it: t.language_it,
    en: t.language_en,
    es: "language_es" in t ? t.language_es : "Español",
    fr: "language_fr" in t ? t.language_fr : "Français",
    ru: "language_ru" in t ? t.language_ru : "Русский",
  };
  return labels[code];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  total_bets: number;
  won: number;
  lost: number;
  pending: number;
  win_rate: string;
  avg_odds: string;
}

interface Bet {
  id: number;
  match_external_id: string;
  selection: string;
  odds: number;
  paper: boolean;
  status: string;
  placed_at: string;
  settled_at?: string | null;
  thesis?: string;
  home_team?: string;
  away_team?: string;
  league?: string;
  league_name?: string;
  kickoff?: string;
  enrichment?: PredictionEnrichment | null;
}


type WcFormCounts = { w: number; d: number; l: number };

// Format either form shape for display: club string ("WWDLL") passes through,
// WC counts become "6W-2D-2L". Null when absent — never invented.
function fmtFormAny(f?: string | WcFormCounts | null): string | null {
  if (!f) return null;
  if (typeof f === "string") return f;
  return `${f.w}W-${f.d}D-${f.l}L`;
}

interface PredictionEnrichment {
  pi_home?: number;
  pi_away?: number;
  xg_home?: number;
  xga_home?: number;
  xg_away?: number;
  xga_away?: number;
  npxg_home?: number;
  npxg_away?: number;
  ppda_home?: number;
  ppda_away?: number;
  // Club rows: form is a result string ("WWDLL"). World Cup rows (unified
  // fallback): form is W/D/L counts over the national side's last matches.
  form_home?: string | WcFormCounts;
  form_away?: string | WcFormCounts;
  // ── World Cup enrichment (kind === "world_cup", written by the Python model)
  kind?: string;
  venue?: {
    travel_km_home?: number | null; travel_km_away?: number | null;
    rest_days_home?: number | null; rest_days_away?: number | null;
    tz_shift_home?: number | null; tz_shift_away?: number | null;
    host_advantage?: string | null;
  } | null;
  squad?: {
    injuries_home?: string[]; injuries_away?: string[];
    revealed_home?: boolean; revealed_away?: boolean;
  } | null;
  lambdas?: { home?: number | null; away?: number | null } | null;
  matches?: { home?: number | null; away?: number | null } | null;
  group?: string | null;
  injuries_home?: string[];
  injuries_away?: string[];
  weather?: { temp: number; wind: number; condition: string; rain: number; icon: string } | null;
  api_pct_home?: number;
  api_pct_draw?: number;
  api_pct_away?: number;
  api_advice?: string;
  research?: string;
  extra_markets?: Array<{
    key: string;
    label: string;
    p: number;
    model_odds: number;
    market_odds: number | null;
    edge: number | null;
  }>;
  goals_summary?: {
    expected_goals: number;
    band_low: number;
    band_high: number;
    band_p: number;
  };
  // Mercati marcatore (anytime goalscorer) — Pro-only, prodotto da B-serve
  // (lib/goalscorer-model.ts). Shape esatta NON modificabile lato FE.
  // marketImplied/bestPrice/edge possono essere null (nessuna quota dal book):
  // in quel caso l'Edge mostra "–", mai numeri inventati. Le quote vengono da
  // book US → edge = "modello vs book US" (dichiarato in micro-nota).
  goalscorer_markets?: Array<{
    playerId: string | null;
    name: string;
    side: "home" | "away";
    pScores: number;
    marketImplied: number | null;
    bestPrice: number | null;
    bookmaker: string | null;
    edge: number | null;
    confidence: "alta" | "media";
  }>;
  // Confidence-surfacing gate (Wave 1, club football path). Present only when
  // below_floor — same contract as the national path's notes.surface. Survives
  // the per-tier enrichment strip (NOT in PREMIUM_ENRICHMENT_KEYS), so it reaches
  // every unlocked tier. below_floor=true -> no clear favourite: the card drops
  // the pick direction + edge/value badge but keeps the probabilities and why.
  surface?: { below_floor: boolean; floor: number };
  // Server-side kickoff provenance (not premium-stripped): true when the time
  // comes from a real source, so fmtKickoff can show a genuine 00:00 UTC slot.
  time_confirmed?: boolean;
  // Mercati soft (#SOFT-MARKETS): corner/cartellini/falli. Pro-only.
  // soft = valori reali (Pro); soft_locked = true senza valori (non-Pro con dati).
  // Mai edge — framing MODEL ESTIMATE soltanto.
  soft?: {
    corners?: { expected: number; main_line: number; p_over: number; is_generic: boolean };
    cards?: { expected: number; main_line: number; p_over: number; is_generic: boolean };
    fouls?: { expected: number; main_line: number; p_over: number; is_generic: boolean };
  };
  soft_locked?: boolean;
}

interface Prediction {
  id: number;
  match_id: string;
  league: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  lambda_home: number | null;
  lambda_away: number | null;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  edge: number | null;
  best_selection: string | null;
  model_matches: number | null;
  computed_at: string;
  match_type?: string | null;
  // True = model estimate without real market odds (no edge claimed) — drives
  // the PAPER badge. Set server-side by markModelEstimate.
  is_estimate?: boolean;
  enrichment?: PredictionEnrichment | null;
  // Reveal-gating fields (Task 7)
  locked?: boolean;
  pick_of_day?: boolean;
  pick?: string | null;
  confidence_score?: number | null;
  explanation?: string | null;
  affiliate?: { bookmaker: string; bonus: string; url: string; odds: number | null } | null;
}

interface AgentStatus {
  name: string;
  status: "alive" | "stale" | "offline";
  last_seen: string | null;
  age_seconds: number | null;
}

// Unified track record (/api/v2/history) — multi-sport, result-centric.
// Rows pass the same per-tier projection as the board: `locked` rows hide pick.
interface V2HistoryRow {
  id: string;
  sport: string;
  competition: string | null;
  event_name: string | null;
  home_team: string | null;
  away_team: string | null;
  player_one: string | null;
  player_two: string | null;
  market: string | null;
  pick: string | null;
  status: string | null;
  result: string | null; // won | lost | void | pending | null
  signal_type: string | null;
  is_paper: boolean;
  is_verified: boolean;
  starts_at: string | null;
  settled_at: string | null;
  world_cup_stage: string | null;
  // #021: REAL final score written by the settlement agents ("2-1" football,
  // "6-4 6-3" tennis). Null on rows settled before the feature or when the
  // provider gave no score — nothing is ever reconstructed.
  final_score?: string | null;
  locked?: boolean;
}

interface V2HistoryStats {
  total: number;
  won: number;
  lost: number;
  void: number;
  pending: number;
  paper: number;
  verified: number;
  win_rate: string | null;
}

// #021: live tennis match from /api/tennis-live (real ESPN scores, curated
// server-side with the same tournament rules as the board).
interface LiveTennisMatch {
  id: string;
  tournament: string;
  player1: string;
  player2: string;
  sets_p1: number[];
  sets_p2: number[];
  status_detail: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAGUE_FLAGS: Record<string, string> = {
  PL: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", SA: "🇮🇹", PD: "🇪🇸", BL1: "🇩🇪", FL1: "🇫🇷", CL: "⭐", EL: "🟠",
};

// Rail nav glyphs (mockup .rail svg <use>): tab → custom sport-glyph symbol id.
const RAIL_GLYPHS: Record<string, string> = {
  bets: "#g-desk",
  history: "#g-history",
  leaderboard: "#g-rank",
  "match-builder": "#g-builder",
  account: "#g-acct",
};

// #MENU-ICONS-0626: voci del rail con la nuova icona illustrata (MenuIcon raster).
// Le voci non mappate (es. leaderboard, in attesa del podio) restano sui glifi SVG.
const RAIL_ICONS: Record<string, "prediction" | "history" | "plans" | "creator" | "builder"> = {
  bets: "prediction",
  history: "history",
  "match-builder": "builder",
  plans: "plans",
};

const MATCH_TYPE_META: Record<string, { label: string; color: string; priority: number }> = {
  DERBY:              { label: "Derby",          color: "text-red-400 border-red-400/40 bg-red-400/10",        priority: 5 },
  TITLE_DECIDER:      { label: "Title",          color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", priority: 4 },
  RELEGATION:         { label: "Relegation",     color: "text-orange-400 border-orange-400/40 bg-orange-400/10", priority: 4 },
  NEUTRAL_VENUE:      { label: "Neutral",        color: "text-blue-400 border-blue-400/40 bg-blue-400/10",     priority: 3 },
  CUP_SPILLOVER:      { label: "Cup",            color: "text-violet-400 border-violet-400/40 bg-violet-400/10", priority: 3 },
  SHORT_REST:         { label: "Short Rest",     color: "text-amber-400 border-amber-400/40 bg-amber-400/10",  priority: 2 },
  EUROPEAN_HANGOVER:  { label: "EU Hangover",   color: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",     priority: 2 },
  DEAD_RUBBER:        { label: "Dead Rubber",    color: "text-gray-500 border-gray-500/40 bg-gray-500/10",     priority: 1 },
  ROTATION:           { label: "Rotation",       color: "text-gray-500 border-gray-500/40 bg-gray-500/10",     priority: 1 },
  STANDARD:           { label: "Standard",       color: "text-gray-600 border-gray-600/40 bg-gray-600/5",      priority: 0 },
};

type Tab = "bets" | "plans" | "history" | "leaderboard" | "match-builder" | "invita";
type AccountSection = "account" | "piani";

// ─── Tennis Types ─────────────────────────────────────────────────────────────

interface TennisMatch {
  id: string;
  player1: string;
  player2: string;
  tournament: string;
  surface: "CLAY" | "GRASS" | "HARD";
  round: string;
  scheduled: string;
  p1: number;
  p2: number;
  odds_p1: number;
  odds_p2: number;
  edge: number | null;
  best_selection: "P1" | "P2" | null;
  model: string;
  // Elo analysis fields
  elo_p1?: number | null;
  elo_p2?: number | null;
  elo_p1_overall?: number | null;
  elo_p2_overall?: number | null;
  surface_matches_p1?: number | null;
  surface_matches_p2?: number | null;
  serve_form_p1?: number | null;
  serve_form_p2?: number | null;
  return_form_p1?: number | null;
  return_form_p2?: number | null;
  surface_reliability_p1?: number | null;
  surface_reliability_p2?: number | null;
  feature_quality?: number | null;
  p1_rest_days?: number | null;
  p2_rest_days?: number | null;
  p1_recent_matches_14d?: number | null;
  p2_recent_matches_14d?: number | null;
  h2h_p1_wins?: number | null;
  h2h_p2_wins?: number | null;
  elo_raw_p1?: number | null;
  elo_raw_p2?: number | null;
  // Reveal-gating fields (Task 7)
  locked?: boolean;
  pick_of_day?: boolean;
  pick?: string | null;
  confidence_score?: number | null;
  explanation?: string | null;
  affiliate?: { bookmaker: string; bonus: string; url: string; odds: number | null } | null;
}

interface TennisSummary {
  total_today: number;
  value_bets: number;
  markets_active: number;
}

type SlipSelection = {
  id: string;
  sport: "Football" | "Tennis";
  event: string;
  league: string;
  kickoff: string;
  market: string;
  selection: string;
  odds: number;
  modelProbability: number;
  edge: number | null;
  confidence: number;
  recommendedStake: number;
};

interface TennisBet {
  id: number;
  match_id: string;
  selection: string;
  player_name: string | null;
  odds: number;
  paper: boolean;
  status: string;
  placed_at: string;
  settled_at?: string | null;
  tournament: string | null;
  surface: string | null;
  player1: string | null;
  player2: string | null;
  scheduled_at: string | null;
}


type ClientProfile = {
  name: string;
  email: string;
  plan: "free" | "unpaid" | "pending_payment" | "base" | "premium" | "admin_full";
  language?: Lang;
  timezone?: string;
  txHash?: string;
  requestedPlan?: "base" | "premium";
  planExpiresAt?: string | null;
  betfair?: {
    username?: string;
    appKeyLast4?: string;
    status?: "not_connected" | "pending_review" | "connected";
  };
  risk?: {
    maxStake: number;
    dailyStopLoss: number;
    maxBetsPerDay: number;
    mode: "approval" | "automatic";
  };
  notifications?: {
    valueBets: boolean;
    dailyReport: boolean;
    paymentUpdates: boolean;
    securityAlerts: boolean;
  };
  sportPreferences?: string[];
  leaderboardOptIn?: boolean;
};

type ClientAuthIntent = "login" | "create";

// Configurable via NEXT_PUBLIC_USDT_TRC20_ADDRESS (set on Vercel to rotate the
// receiving wallet without a code change). Necessarily public — the customer
// must see it to pay. Falls back to the current address if the env is unset.
const USDT_TRC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS || "TDUeCx7BBVySkZ8M9eC5Cocq87K2TcmkRf";
type PlanKey = PublicPlanKey;

function planPriceCopy(plan: PlanKey, lang: Lang) {
  return publicPlanPriceCopy(plan, lang);
}
const CLIENT_PROFILE_KEY = "agentic-client-profile";
const CLIENT_PROFILES_KEY = "agentic-client-profiles";
const PRIVATE_BALANCE_PLACEHOLDER = "LOCK";
const EMPTY_SUMMARY: Summary = {
  total_bets: 0,
  won: 0,
  lost: 0,
  pending: 0,
  win_rate: "0.0",
  avg_odds: "0.00",
};
const EMPTY_TENNIS_BET_SUMMARY: TennisBetSummary = {
  total: 0,
  won: 0,
  lost: 0,
  pending: 0,
};

interface TennisBetSummary {
  total: number;
  won: number;
  lost: number;
  pending: number;
  hit_rate?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%`; }

function fmtKickoff(utc: string, lang: Lang = "it", tz = "Europe/Rome", confirmed?: boolean) {
  const d = new Date(utc);
  const locale = lang === "en" ? "en-GB" : "it-IT";
  // Hide time when midnight UTC (the football-data "unconfirmed" placeholder),
  // UNLESS the server marked it confirmed — 00:00 UTC is a real evening slot
  // at the 2026 NA World Cup (20:00 ET).
  const timeUnknown = confirmed !== true && d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  if (timeUnknown) {
    return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: tz });
  }
  return d.toLocaleDateString(locale, {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: tz,
  });
}

function timeAgo(utc: string) {
  const diff = Math.floor((Date.now() - new Date(utc).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function confidenceFromEdge(edge: number | null, probability: number) {
  const edgeScore = Math.min(45, Math.max(0, (edge ?? 0) * 700));
  const probScore = Math.min(35, Math.max(0, (probability - 0.35) * 100));
  return Math.round(Math.min(95, 20 + edgeScore + probScore));
}

function stakeFromEdge(edge: number | null, confidence: number) {
  if (!edge || edge <= 0) return 0;
  return Math.min(25, Math.max(2, Math.round(edge * confidence * 3) / 2));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    W: "bg-green-500/80 text-white", D: "bg-yellow-500/80 text-black", L: "bg-red-500/80 text-white",
  };
  return (
    <span className={`inline-block w-5 h-5 text-[10px] font-bold rounded text-center leading-5 ${colors[result] ?? "bg-gray-600 text-gray-300"}`}>
      {result}
    </span>
  );
}

function FormRow({ label, form }: { label: string; form?: string }) {
  if (!form) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 font-mono w-10 shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {form.split("").map((r, i) => <FormBadge key={i} result={r} />)}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    won: "text-green-400 border-green-400/40 bg-green-400/10",
    lost: "text-red-400 border-red-400/40 bg-red-400/10",
    pending: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    execution_rejected: "text-red-300 border-red-400/40 bg-red-400/10",
    expired_unconfirmed: "text-gray-400 border-gray-500/40 bg-gray-500/10",
    voided: "text-gray-400 border-gray-400/40 bg-gray-400/10",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-mono ${colors[status] ?? "text-gray-400"}`}>
      {status}
    </span>
  );
}

function MatchTypeBadge({ matchType }: { matchType?: string | null }) {
  if (!matchType || matchType === "STANDARD" || matchType === "ROTATION") return null;
  const meta = MATCH_TYPE_META[matchType];
  if (!meta) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${meta.color}`}>
      {meta.label}
    </span>
  );
}

const FOOTBALL_BEST_EDGE_THRESHOLD = 0.02;
const TENNIS_BEST_EDGE_THRESHOLD = 0.03;
const MIN_BEST_BET_ODDS = 1.4;
const BEST_BETS_CAP = 5;
const TENNIS_TRADING_WINDOW_MS = 12 * 60 * 60 * 1000;

function isFutureMarket(utc: string) {
  return new Date(utc).getTime() > Date.now();
}

// #LIVE-1: la card resta sul board per tutta la partita (kickoff + 150 min,
// stesso margine della finestra server) — sparisce quando il settlement la
// sposta in History. isFutureMarket resta il gate severo per best-bet/CTA.
const IN_PLAY_GRACE_MS = 150 * 60 * 1000;
function isBoardVisibleMarket(utc: string) {
  return new Date(utc).getTime() + IN_PLAY_GRACE_MS > Date.now();
}

function isTennisMarketVisible(utc: string) {
  const scheduledAt = new Date(utc).getTime();
  if (!Number.isFinite(scheduledAt)) return false;
  return scheduledAt + TENNIS_TRADING_WINDOW_MS > Date.now();
}

function selectedFootballOdds(p: Prediction) {
  if (p.best_selection === "HOME") return p.odds_home;
  if (p.best_selection === "DRAW") return p.odds_draw;
  if (p.best_selection === "AWAY") return p.odds_away;
  return null;
}

function selectedTennisOdds(m: TennisMatch) {
  if (m.best_selection === "P1") return m.odds_p1;
  if (m.best_selection === "P2") return m.odds_p2;
  return null;
}

function selectedFootballProbability(p: Prediction) {
  if (p.best_selection === "HOME") return p.p_home;
  if (p.best_selection === "DRAW") return p.p_draw;
  if (p.best_selection === "AWAY") return p.p_away;
  return Math.max(p.p_home, p.p_draw, p.p_away);
}

function selectedTennisProbability(m: TennisMatch) {
  if (m.best_selection === "P1") return m.p1;
  if (m.best_selection === "P2") return m.p2;
  return Math.max(m.p1, m.p2);
}

// A below-floor pick is shown on the board as "no clear favourite" (no
// directional pick). It must NEVER resurface as a value/best bet — the market
// edge alone is not enough when the model has no clear favourite. Floor mirrors
// core/surfacing_gate.py via lib/surfacing-gate.ts (WC/club 56, friendly 61).
// #BESTBET-FLOOR-1: same gate the card applies (isValueBet = !belowFloor && …).
function isFootballSurfaced(p: Prediction): boolean {
  return p.confidence_score == null
    || p.confidence_score >= surfaceFloorFor("football", p.league);
}

function isFootballBestBet(p: Prediction) {
  const odds = selectedFootballOdds(p);
  return isFootballSurfaced(p)
    && isFutureMarket(p.kickoff)
    && Boolean(p.best_selection)
    && odds != null
    && odds >= MIN_BEST_BET_ODDS
    && (p.edge ?? 0) >= FOOTBALL_BEST_EDGE_THRESHOLD;
}

function isTennisBestBet(m: TennisMatch) {
  const odds = selectedTennisOdds(m);
  // #BESTBET-FLOOR-1: below the tennis floor the serving route drops `pick` but
  // keeps best_selection on the row → guard here too so a sub-floor coin-flip
  // never resurfaces as a value bet. #TENNIS-SEG-FLOOR-1: the floor is
  // segment-aware by tournament name (hi 62 / lo 64 / lo-grass 66).
  const surfaced = m.confidence_score == null
    || m.confidence_score >= surfaceFloorFor("tennis", m.tournament);
  return surfaced
    && isTennisMarketVisible(m.scheduled)
    && Boolean(m.best_selection)
    && odds != null
    && odds >= MIN_BEST_BET_ODDS
    && (m.edge ?? 0) >= TENNIS_BEST_EDGE_THRESHOLD;
}

// #FREE-PRED-REVAMP-0626: paywall curato per i Free. Sostituisce i wall gialli +
// i "🔒" placeholder: l'assaggio (1 pick reale per sport, già sbloccata dal server)
// resta sopra, questo pannello converte il resto. CTA → tab Piani via onUpgrade.
function FreePaywall({ count, hitRate, lang, onUpgrade }: {
  count: number;
  hitRate?: string | null;
  lang: Lang;
  onUpgrade?: () => void;
}) {
  const bullets = [
    pick5(lang, { it: "Edge% e pick su ogni match", en: "Edge% and pick on every match", es: "Edge% y pick en cada partido", fr: "Edge% et pick sur chaque match", ru: "Edge% и пик в каждом матче" }),
    pick5(lang, { it: "Il ragionamento del modello dietro ogni scelta", en: "The model's reasoning behind every call", es: "El razonamiento del modelo en cada elección", fr: "Le raisonnement du modèle derrière chaque choix", ru: "Обоснование модели за каждым выбором" }),
    pick5(lang, { it: "Tutte le competizioni + World Cup, calcio e tennis", en: "Every competition + World Cup, football and tennis", es: "Todas las competiciones + Mundial, fútbol y tenis", fr: "Toutes les compétitions + Coupe du Monde, football et tennis", ru: "Все турниры + Чемпионат мира, футбол и теннис" }),
  ];
  return (
    <section className="free-paywall">
      <p className="fp-eyebrow">{pick5(lang, { it: "Questo è l'assaggio gratis", en: "This is your free taste", es: "Esta es tu muestra gratis", fr: "Ceci est votre aperçu gratuit", ru: "Это ваш бесплатный пробник" })}</p>
      <h3>{pick5(lang, { it: `Sblocca tutte le ${count} prediction di oggi`, en: `Unlock all ${count} predictions today`, es: `Desbloquea las ${count} predicciones de hoy`, fr: `Débloquez les ${count} prédictions du jour`, ru: `Откройте все ${count} прогнозов на сегодня` })}</h3>
      <ul className="fp-bullets">
        {bullets.map((b, i) => (
          <li key={i} className="fp-bullet">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {hitRate && (
        <p className="fp-proof">
          <strong>{hitRate}</strong> {pick5(lang, { it: "hit rate · ultime 100 pick concluse", en: "hit rate · last 100 settled picks", es: "hit rate · últimas 100 picks", fr: "hit rate · 100 derniers picks réglés", ru: "hit rate · последние 100 закрытых пиков" })}
        </p>
      )}
      <div className="fp-actions">
        <button type="button" className="fp-cta" onClick={() => onUpgrade?.()}>
          {pick5(lang, { it: "Passa a Pro — 29.99 USDT/mese", en: "Upgrade to Pro — 29.99 USDT/month", es: "Pasa a Pro — 29.99 USDT/mes", fr: "Passez à Pro — 29.99 USDT/mois", ru: "Перейти на Pro — 29.99 USDT/мес" })}
        </button>
        <button type="button" className="fp-link" onClick={() => onUpgrade?.()}>
          {pick5(lang, { it: "Vedi i piani", en: "See plans", es: "Ver los planes", fr: "Voir les offres", ru: "Смотреть тарифы" })}
        </button>
      </div>
    </section>
  );
}

function SportsbookBoard({
  predictions,
  fpOdds,
  tennisMatches,
  onSelect,
  onBetNow,
  onGate,
  isFreeClient,
  isPremium,
  tennisIsPlaceholder,
  onBannerCta,
  hitRate,
}: {
  predictions: Prediction[];
  fpOdds: Record<string, FpOddsEntry>;
  tennisMatches: TennisMatch[];
  onSelect: (selection: SlipSelection) => void;
  onBetNow?: () => void;
  onGate?: () => void;
  isFreeClient?: boolean;
  isPremium?: boolean;
  tennisIsPlaceholder?: boolean;
  onBannerCta?: (href: string) => boolean;
  hitRate?: string | null;
}) {
  const [sportFilter, setSportFilter] = useState<"all" | "football" | "tennis">("all");
  // ?sport= deep-link dalla landing: applicato dopo il mount per non rompere
  // l'idratazione (SSR rende sempre "all", il client allinea qui).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("sport");
    if (s === "football" || s === "tennis") setSportFilter(s);
  }, []);
  const [signalFilter, setSignalFilter] = useState<"all" | "value">("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [surfaceFilter, setSurfaceFilter] = useState<"all" | TennisMatch["surface"]>("all");
  const [sortMode, setSortMode] = useState<"edge" | "time" | "odds" | "probability">("edge");
  const [searchTerm, setSearchTerm] = useState("");
  const footballValue = predictions
    .filter(isFootballBestBet)
    .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const tennisValue = tennisMatches
    .filter(isTennisBestBet)
    .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const t = useT();
  const lang = useLang();
  // Live-first ordering: in-play (and paused) matches always lead the board,
  // above the chosen sort. Same matching as the cards (id → team-name fallback).
  const liveMap = useLive();
  const liveTennisMap = useLiveTennis();
  const isFootballLive = (p: Prediction) => {
    const l = orientLive(liveMap[p.match_id] ?? findLiveByTeams(liveMap, p.home_team, p.away_team), p.home_team, p.away_team);
    return l?.match_status === "IN_PLAY" || l?.match_status === "PAUSED";
  };
  const isTennisLive = (m: TennisMatch) => {
    const lm = liveTennisMap[tennisPairKey(m.player1, m.player2)];
    return !!lm && !/final|complete|ended|retir|walkover|w\/o/i.test(lm.status_detail || "");
  };
  const query = searchTerm.trim().toLowerCase();
  const boardAudience = isPremium ? "premium" : (isFreeClient ? "free" : "anon");
  // #HOUSE-PHOTO-1 dedup + #BANNER-FEED-FIX-0708: mai 2 banner uguali per pagina.
  // Le campagne desk-feed sono divise per SPORT (non per parità d'indice, che
  // mandava una campagna World Cup/calcio nel feed tennis): il feed tennis riceve
  // SOLO campagne tennis; tutto il resto (calcio + multisport) va nel feed calcio.
  // Ognuna usata al massimo una volta → nessun banner ripetuto nel feed.
  const feedCampsAll = isFreeClient ? [] : campaignsFor("desk-feed", boardAudience);
  const footballFeed = feedCampsAll.filter((c) => campaignSport(c) !== "tennis");
  const tennisFeed = feedCampsAll.filter((c) => campaignSport(c) === "tennis");

  const labels = {
    allSports: t.bf_allsports,
    football: "Football",
    tennis: "Tennis",
    allSignals: t.bf_allsignals,
    valueOnly: t.bf_valueonly,
    competition: t.bf_competition,
    allCompetitions: t.bf_allcompetitions,
    surface: t.bf_surface,
    allSurfaces: t.bf_allsurfaces,
    sort: t.bf_sort,
    edge: t.bf_edge,
    time: t.bf_time,
    odds: t.bf_odds,
    probability: t.bf_probability,
    search: t.bf_search,
    showing: t.bf_showing,
    noResults: t.bf_noresults,
  };

  const competitionOptions = [
    ...Array.from(new Map(predictions.map((p) => [`football:${p.league}`, `${LEAGUE_FLAGS[p.league] ?? "FB"} ${p.league_name || p.league}`])).entries()),
    ...Array.from(new Map(tennisMatches.map((m) => [`tennis:${m.tournament}`, `TN ${m.tournament}`])).entries()),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const surfaceOptions = Array.from(new Set(tennisMatches.map((m) => m.surface))).sort();

  const sortFootball = (rows: Prediction[]) => rows.sort((a, b) => {
    const la = isFootballLive(a), lb = isFootballLive(b);
    if (la !== lb) return la ? -1 : 1;
    if (sortMode === "time") return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
    if (sortMode === "odds") return (selectedFootballOdds(b) ?? 0) - (selectedFootballOdds(a) ?? 0);
    if (sortMode === "probability") return selectedFootballProbability(b) - selectedFootballProbability(a);
    return (b.edge ?? -1) - (a.edge ?? -1);
  });

  const sortTennis = (rows: TennisMatch[]) => rows.sort((a, b) => {
    const la = isTennisLive(a), lb = isTennisLive(b);
    if (la !== lb) return la ? -1 : 1;
    if (sortMode === "time") return new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime();
    if (sortMode === "odds") return (selectedTennisOdds(b) ?? 0) - (selectedTennisOdds(a) ?? 0);
    if (sortMode === "probability") return selectedTennisProbability(b) - selectedTennisProbability(a);
    return (b.edge ?? -1) - (a.edge ?? -1);
  });

  // #ONLY-WITH-ODDS-1: mostra sul board SOLO i match per cui abbiamo la quota FortunePlay.
  // "Ha quota" = entry FP presente con un prezzo 1X2/moneyline reale. Applicato solo quando
  // le quote sono già caricate (fail-open: se l'endpoint quote è giù/non ancora risolto,
  // mostra tutto invece di un board vuoto).
  const fpLoaded = Object.keys(fpOdds).length > 0;
  const hasFpOdds = (key: string | null) => {
    const e = key ? fpOdds[key] : undefined;
    return !!e && (((e.oddsHome ?? 0) > 1) || ((e.oddsAway ?? 0) > 1));
  };

  const footballRows = sortFootball(predictions
    .filter((p) => sportFilter !== "tennis")
    .filter(() => surfaceFilter === "all")
    .filter((p) => isBoardVisibleMarket(p.kickoff))
    .filter((p) => !fpLoaded || hasFpOdds(teamPairKey("soccer", p.home_team, p.away_team, p.kickoff)))
    .filter((p) => signalFilter === "all" || isFootballBestBet(p))
    .filter((p) => competitionFilter === "all" || competitionFilter === `football:${p.league}`)
    .filter((p) => !query || `${p.home_team} ${p.away_team} ${p.league_name} ${p.league}`.toLowerCase().includes(query)))
    .slice(0, signalFilter === "value" ? BEST_BETS_CAP : Number.POSITIVE_INFINITY);

  const tennisRows = sortTennis(tennisMatches
    .filter((m) => sportFilter !== "football")
    .filter((m) => tennisIsPlaceholder || isTennisMarketVisible(m.scheduled))
    .filter((m) => tennisIsPlaceholder || !fpLoaded || hasFpOdds(teamPairKey("tennis", m.player1, m.player2, m.scheduled)))
    .filter((m) => tennisIsPlaceholder || signalFilter === "all" || isTennisBestBet(m))
    .filter((m) => competitionFilter === "all" || competitionFilter === `tennis:${m.tournament}`)
    .filter((m) => surfaceFilter === "all" || m.surface === surfaceFilter)
    .filter((m) => !query || `${m.player1} ${m.player2} ${m.tournament} ${m.surface}`.toLowerCase().includes(query)))
    .slice(0, signalFilter === "value" ? BEST_BETS_CAP : Number.POSITIVE_INFINITY);

  const filteredTotal = footballRows.length + tennisRows.length;
  const showFootballSection = sportFilter !== "tennis" && surfaceFilter === "all" && !competitionFilter.startsWith("tennis:");
  const showTennisSection = sportFilter !== "football" && !competitionFilter.startsWith("football:");

  return (
    <div className="sportsbook-board">
      <div className="board-subhead">
        <span>{labels.showing} {filteredTotal}</span>
        <span>Football {footballRows.length}</span>
        <span>Tennis {tennisRows.length}</span>
      </div>

      <div className="sports-filter-bar am-filters">
        <div className="am-seg" aria-label="Sport filter">
          <button className={sportFilter === "all" ? "on" : ""} onClick={() => setSportFilter("all")}>{labels.allSports}</button>
          <button className={sportFilter === "football" ? "on" : ""} onClick={() => setSportFilter("football")}>
            <SportIcon sport="football" size={14} className="ic" variant="sm" />{labels.football} <span className="ct">{footballRows.length}</span>
          </button>
          <button className={sportFilter === "tennis" ? "on" : ""} onClick={() => setSportFilter("tennis")}>
            <SportIcon sport="tennis" size={14} className="ic" variant="sm" />{labels.tennis} <span className="ct">{tennisRows.length}</span>
          </button>
        </div>

        <div className="am-seg" aria-label="Signal filter">
          <button className={signalFilter === "all" ? "on" : ""} onClick={() => setSignalFilter("all")}>{labels.allSignals}</button>
          <button className={signalFilter === "value" ? "on" : ""} onClick={() => setSignalFilter("value")}>
            <svg className="ic" aria-hidden="true"><use href="#g-bolt" /></svg>{labels.valueOnly}
          </button>
        </div>

        {/* competition/surface/sort kept as sober inline selects (no lost functionality) */}
        <label className="am-mini-field">
          <span>{labels.competition}</span>
          <select value={competitionFilter} onChange={(e) => setCompetitionFilter(e.target.value)}>
            <option value="all">{labels.allCompetitions}</option>
            {competitionOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="am-mini-field">
          <span>{labels.surface}</span>
          <select value={surfaceFilter} onChange={(e) => setSurfaceFilter(e.target.value as "all" | TennisMatch["surface"])} disabled={sportFilter === "football"}>
            <option value="all">{labels.allSurfaces}</option>
            {surfaceOptions.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
          </select>
        </label>

        <label className="am-mini-field">
          <span>{labels.sort}</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "edge" | "time" | "odds" | "probability")}>
            <option value="edge">{labels.edge}</option>
            <option value="time">{labels.time}</option>
            <option value="odds">{labels.odds}</option>
            <option value="probability">{labels.probability}</option>
          </select>
        </label>

        <div className="grow" />
        <label className="am-search">
          <svg aria-hidden="true"><use href="#g-search" /></svg>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={labels.search}
          />
        </label>
      </div>

      <FeaturedEdge
        predictions={predictions}
        tennisMatches={tennisMatches}
        isPremiumClient={isPremium}
        onGate={onGate}
      />

      {filteredTotal === 0 ? (
        <div className="book-empty">{labels.noResults}</div>
      ) : (
        <>
          {showFootballSection && (
            <section>
              <div className="sport-band">
                <span className="glyph"><SportIcon sport="football" size={26} /></span>
                <h2>{t.board_football}</h2>
                <span className="ct">{footballRows.length} {t.board_markets}</span>
                <span className="rule" />
                <span className="note">{footballValue.length} {t.board_value}</span>
              </div>
              {footballRows.length ? (
                <div className="am-grid">
                  {(() => {
                    // #HOUSE-PHOTO-1: banner foto intercalati ogni ~8 card; ogni campagna
                    // del pool calcio (footballFeed) usata UNA sola volta → nessun duplicato.
                    // #FREE-PRED-REVAMP-0626: il Free vede come ASSAGGIO le righe già
                    // sbloccate dal server (top-1 per sport, !locked) come card COMPLETE.
                    // Il resto è rappresentato dal <FreePaywall>, non da card blurrate.
                    const rows = isFreeClient ? footballRows.filter((p) => !p.locked) : footballRows;
                    let placed = 0;
                    return rows.flatMap((p, i) => {
                      const card = (
                        <PredictionCard key={p.match_id} p={p} fp={fpOdds[teamPairKey("soccer", p.home_team, p.away_team, p.kickoff) ?? ""]} onSelect={onSelect} onBetNow={onBetNow} onGate={onGate} isPremium={isPremium} />
                      );
                      // #BANNER-FEED-FIX-0708: un SOLO creativo landscape 16:9 per punto,
                      // MAI due affiancati. Compatto (span-8, una card gli sta a fianco →
                      // riga piena, zero gutter) e mostrato INTERO (aspect 16:9 → nessun crop
                      // del logo/claim baked). Distribuiti ogni 6 card a punti diversi.
                      if (placed < footballFeed.length && i > 0 && (i + 1) % 6 === 0 && i < rows.length - 1) {
                        const camp = footballFeed[placed++];
                        return [card, <HouseBanner key={`house-feed-${camp.id}`} campaign={{ ...camp, format: "billboard" }} lang={lang} onCta={onBannerCta} inGrid />];
                      }
                      return [card];
                    });
                  })()}
                </div>
              ) : (
                /* P6: honest empty-state — WC countdown message + hub link */
                <div className="book-empty wc-empty-state">
                  <div>{pick5(lang, {
                    it: "Nessun segnale calcio in questo momento. I primi segnali arrivano con l'apertura dei mercati del Mondiale — kickoff 11 giugno.",
                    en: "No football signals right now. The first signals arrive when World Cup markets open — kickoff June 11.",
                    es: "Ninguna señal de fútbol ahora mismo. Las primeras señales llegan con la apertura de los mercados del Mundial — kickoff 11 de junio.",
                    fr: "Aucun signal football pour le moment. Les premiers signaux arrivent à l'ouverture des marchés de la Coupe du Monde — coup d'envoi le 11 juin.",
                    ru: "Сейчас нет футбольных сигналов. Первые сигналы появятся с открытием рынков Чемпионата мира — старт 11 июня.",
                  })}</div>
                  <Link href="/world-cup" className="wc-back-link">{pick5(lang, {
                    it: "Esplora l'hub Mondiali: gironi, calendario, convocazioni →",
                    en: "Explore the World Cup hub: groups, calendar, squads →",
                    es: "Explora el hub del Mundial: grupos, calendario, convocatorias →",
                    fr: "Explorez le hub Coupe du Monde : groupes, calendrier, sélections →",
                    ru: "Откройте хаб Чемпионата мира: группы, календарь, составы →",
                  })}</Link>
                </div>
              )}
            </section>
          )}

          {/* #BANNERS-IN-GRID: rimossa l'interstitial billboard full-width (banda con
              gutter) tra calcio e tennis — i banner house ora vivono SOLO intercalati
              tra le schede bet come tile impacchettati (vedi .am-grid sopra). */}

          {showTennisSection && (
            <section>
              <div className="sport-band amber">
                <span className="glyph"><SportIcon sport="tennis" size={26} /></span>
                <h2>{t.board_tennis}</h2>
                <span className="ct">{tennisRows.length} {t.board_matches}</span>
                <span className="rule" />
                <span className="note">{tennisValue.length} {t.board_value}</span>
              </div>
              {tennisRows.length ? (
                <div className="am-grid">
                  {(() => {
                    // #HOUSE-PHOTO-1: banner tennis dal pool DISGIUNTO (tennisFeed), ognuno una
                    // volta sola → mai duplicati col feed calcio nella stessa pagina.
                    const rows = isFreeClient ? tennisRows.filter((m) => !m.locked) : tennisRows;
                    let placed = 0;
                    return rows.flatMap((m, i) => {
                      const card = (
                        <TennisMatchCard key={m.id} m={m} fp={fpOdds[teamPairKey("tennis", m.player1, m.player2, m.scheduled) ?? ""]} onSelect={onSelect} onBetNow={onBetNow} onGate={onGate} isPremium={isPremium} />
                      );
                      // #BANNER-FEED-FIX-0708: nel feed tennis i banner sono tile QUADRATI 1:1
                      // (span-3 come una card tennis), SEMPRE con creativo TENNIS (mai calcio) e
                      // mostrati INTERI (nessun crop del soggetto/testo). Singoli e distribuiti
                      // ogni 6 card a punti diversi.
                      if (placed < tennisFeed.length && i > 0 && (i + 1) % 6 === 0 && i < rows.length - 1) {
                        const camp = tennisFeed[placed++];
                        return [card, <HouseBanner key={`house-tennis-${camp.id}`} campaign={{ ...camp, format: "rectangle" }} lang={lang} onCta={onBannerCta} inGrid />];
                      }
                      return [card];
                    });
                  })()}
                </div>
              ) : (
                <div className="book-empty">{t.board_tennis_empty}</div>
              )}
            </section>
          )}

          {/* #FREE-PRED-REVAMP-0626: paywall curato dopo l'assaggio (solo Free). */}
          {isFreeClient && (
            <FreePaywall count={filteredTotal} hitRate={hitRate} lang={lang} onUpgrade={onGate} />
          )}
        </>
      )}
      {/* 18+ / Responsible Gambling + affiliate disclosure (Task 7 Step 3) */}
      <div className="rg-footer">{t.rg_footer}</div>
    </div>
  );
}

function BestBetsBoard({
  predictions,
  tennisMatches,
  onSelect,
  onBetNow,
  isFreeClient,
  isPremium,
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  onSelect: (selection: SlipSelection) => void;
  onBetNow?: () => void;
  isFreeClient?: boolean;
  isPremium?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [sportFilter, setSportFilter] = useState<"all" | "football" | "tennis">("all");
  // ?sport= deep-link dalla landing: applicato dopo il mount per non rompere
  // l'idratazione (SSR rende sempre "all", il client allinea qui).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("sport");
    if (s === "football" || s === "tennis") setSportFilter(s);
  }, []);
  const [sortMode, setSortMode] = useState<"probability" | "edge" | "time">("probability");
  const [searchTerm, setSearchTerm] = useState("");
  const query = searchTerm.trim().toLowerCase();
  const labels = {
    all: t.bf_allsports,
    football: "Football",
    tennis: "Tennis",
    sort: t.bf_sort,
    probability: t.bb_probability,
    edge: t.bf_edge,
    time: t.bb_time,
    search: t.bb_search,
    showing: t.bf_showing,
    valueMode: t.bb_valuemode,
    modelMode: t.bb_modelmode,
    noEdge: t.bb_noedge,
  };
  const footballById = new Map(predictions.map((p) => [p.match_id, p]));
  const tennisById = new Map(tennisMatches.map((m) => [m.id, m]));
  const footballCandidates: BestBetCandidate[] = predictions.map((p) => ({
    kind: "football",
    id: p.match_id,
    startsAt: p.kickoff,
    label: `${p.home_team} ${p.away_team} ${p.league_name} ${p.league}`,
    probability: selectedFootballProbability(p),
    odds: selectedFootballOdds(p),
    edge: p.edge,
    belowFloor: !isFootballSurfaced(p), // #BESTBET-FLOOR-1
  }));
  const tennisCandidates: BestBetCandidate[] = tennisMatches.map((m) => ({
    kind: "tennis",
    id: m.id,
    startsAt: m.scheduled,
    label: `${m.player1} ${m.player2} ${m.tournament} ${m.surface}`,
    probability: selectedTennisProbability(m),
    odds: selectedTennisOdds(m),
    edge: m.edge,
    // #BESTBET-FLOOR-1: below the tennis floor → no directional pick.
    // #TENNIS-SEG-FLOOR-1: segment-aware floor resolved from the tournament.
    belowFloor: m.confidence_score != null
      && m.confidence_score < surfaceFloorFor("tennis", m.tournament),
  }));
  const bestRows = buildBestBetRows(footballCandidates, tennisCandidates, {
    sportFilter,
    sortMode,
    query,
  });
  const visibleFootballValue = bestRows.items
    .filter((row) => row.kind === "football")
    .map((row) => footballById.get(row.id))
    .filter((p): p is Prediction => Boolean(p));
  const visibleTennisValue = bestRows.items
    .filter((row) => row.kind === "tennis")
    .map((row) => tennisById.get(row.id))
    .filter((m): m is TennisMatch => Boolean(m));
  const totalValue = bestRows.items.length;
  const modeLabel =
    bestRows.mode === "mixed" ? `${labels.valueMode} + ${labels.modelMode}`
    : bestRows.mode === "value" ? labels.valueMode
    : bestRows.mode === "model_signal" ? labels.modelMode
    : "+EV";

  return (
    <div className="sportsbook-board best-bets-board">
      <div className="board-subhead">
        <span>{labels.showing} {totalValue} {modeLabel}</span>
        <span>Football {visibleFootballValue.length}</span>
        <span>Tennis {visibleTennisValue.length}</span>
      </div>

      <div className="sports-filter-bar best-bets-filter-bar am-filters">
        <div className="am-seg" aria-label="Best bets sport filter">
          <button className={sportFilter === "all" ? "on" : ""} onClick={() => setSportFilter("all")}>{labels.all}</button>
          <button className={sportFilter === "football" ? "on" : ""} onClick={() => setSportFilter("football")}>
            <SportIcon sport="football" size={14} className="ic" variant="sm" />{labels.football} <span className="ct">{visibleFootballValue.length}</span>
          </button>
          <button className={sportFilter === "tennis" ? "on" : ""} onClick={() => setSportFilter("tennis")}>
            <SportIcon sport="tennis" size={14} className="ic" variant="sm" />{labels.tennis} <span className="ct">{visibleTennisValue.length}</span>
          </button>
        </div>
        <label className="am-mini-field">
          <span>{labels.sort}</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "probability" | "edge" | "time")}>
            <option value="probability">{labels.probability}</option>
            <option value="edge">{labels.edge}</option>
            <option value="time">{labels.time}</option>
          </select>
        </label>
        <div className="grow" />
        <label className="am-search">
          <svg aria-hidden="true"><use href="#g-search" /></svg>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={labels.search}
          />
        </label>
      </div>

      {totalValue ? (
        <>
          {visibleFootballValue.length > 0 && (
            <section>
              <div className="sport-band">
                <span className="glyph"><SportIcon sport="football" size={26} /></span>
                <h2>{t.board_football}</h2>
                <span className="ct">{visibleFootballValue.length} {bestRows.mode === "model_signal" ? labels.noEdge : t.board_value}</span>
                <span className="rule" />
              </div>
              <div className="am-grid">
                {visibleFootballValue.map((p) => <PredictionCard key={p.match_id} p={p} onSelect={onSelect} onBetNow={onBetNow} isPreview={isFreeClient} isPremium={isPremium} />)}
              </div>
            </section>
          )}

          {visibleTennisValue.length > 0 && (
            <section>
              <div className="sport-band amber">
                <span className="glyph"><SportIcon sport="tennis" size={26} /></span>
                <h2>{t.board_tennis}</h2>
                <span className="ct">{visibleTennisValue.length} {bestRows.mode === "model_signal" ? labels.noEdge : t.board_value}</span>
                <span className="rule" />
              </div>
              <div className="am-grid">
                {visibleTennisValue.map((m) => <TennisMatchCard key={m.id} m={m} onSelect={onSelect} onBetNow={onBetNow} isPreview={isFreeClient} isPremium={isPremium} />)}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="book-empty">
          {lang === "it"
            ? "Nessun mercato o model signal attivo ora. Le predizioni complete restano nella scheda Sports."
            : "No active market or model signal right now. Full predictions remain available in the Sports tab."}
        </div>
      )}
    </div>
  );
}

function BetSlip({ selection, onClear }: { selection: SlipSelection | null; onClear: () => void }) {
  const [stake, setStake] = useState(() => selection?.recommendedStake ? String(selection.recommendedStake) : "10");
  const stakeNumber = Number(stake) || 0;
  const returns = selection ? stakeNumber * selection.odds : 0;
  const profit = selection ? returns - stakeNumber : 0;
  const ev = selection ? (selection.modelProbability * profit) - ((1 - selection.modelProbability) * stakeNumber) : 0;
  const isFootballLive = selection?.sport === "Football";
  const t = useT();

  return (
    <aside className="betslip">
      <div className="betslip-head">
        <div>
          <p className="eyebrow">{t.betslip_eyebrow}</p>
          <h3>{isFootballLive ? t.betslip_live : t.betslip_signal}</h3>
        </div>
        {selection && <button onClick={onClear}>{t.betslip_clear}</button>}
      </div>

      {!selection ? (
        <div className="betslip-empty">
          <strong>{t.betslip_no_sel}</strong>
          <span>{t.betslip_no_sel_desc}</span>
        </div>
      ) : (
        <div className="betslip-ticket">
          <div className="ticket-top">
            <span>{selection.sport}</span>
            <em>{selection.market}</em>
          </div>
          <h4>{selection.event}</h4>
          <div className="ticket-line">
            <span>{t.betslip_selection}</span>
            <strong>{selection.selection}</strong>
          </div>
          <div className="ticket-line">
            <span>{t.betslip_odds}</span>
            <strong>{selection.odds.toFixed(2)}</strong>
          </div>
          <div className="ticket-line">
            <span>{t.betslip_model_prob}</span>
            <strong>{pct(selection.modelProbability)}</strong>
          </div>
          <div className="ticket-line">
            <span>{t.betslip_edge}</span>
            <strong className={(selection.edge ?? 0) > 0 ? "text-green-300" : "text-gray-400"}>
              {selection.edge == null ? t.betslip_market_only : `${selection.edge > 0 ? "+" : ""}${(selection.edge * 100).toFixed(1)}%`}
            </strong>
          </div>
          <label className="stake-input">
            <span>{t.betslip_stake}</span>
            <input value={stake} onChange={(e) => setStake(e.target.value)} inputMode="decimal" />
          </label>
          <div className="ticket-summary">
            <div>
              <span>{t.betslip_return}</span>
              {/* #UI-USD-DISPLAY-0623: simbolo valuta in USD ($), display-only */}
              <strong>${returns.toFixed(2)}</strong>
            </div>
            <div>
              <span>EV</span>
              <strong className={ev >= 0 ? "text-green-300" : "text-red-300"}>{ev >= 0 ? "+" : ""}${ev.toFixed(2)}</strong>
            </div>
          </div>
          <button className={`place-live ${isFootballLive ? "is-review" : "is-disabled"}`}>
            {isFootballLive ? t.betslip_football_btn : t.betslip_tennis_btn}
          </button>
          <p className="ticket-note">
            {isFootballLive ? t.betslip_football_note : t.betslip_tennis_note}
          </p>
        </div>
      )}
    </aside>
  );
}



function PreAccessLanding({
  onLogin,
  onCreate,
  onPlans,
}: {
  onLogin: () => void;
  onCreate: () => void;
  onPlans: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const sponsorSlots = [
    { label: "Top sponsor", title: "Operator slot", desc: "Reserved placement for a future sportsbook or casino partner." },
    { label: "Side partner", title: "Acquisition partner", desc: "Generic partner card ready for tracked campaign placement." },
    { label: "Bottom banner", title: "Media sponsor", desc: "Future banner for responsible partner integrations." },
  ];
  const futureSports = [
    { name: "F1", status: "Roadmap" },
    { name: "MotoGP", status: "Roadmap" },
    { name: "NBA", status: "Roadmap" },
    { name: "Golf", status: "Roadmap" },
    { name: "Esports", status: "Roadmap" },
  ];
  const faq = pick5(lang, {
    it: [
      ["Cosa vede un utente pubblico?", "Solo homepage, struttura del prodotto e storico passato/educational. I segnali live restano bloccati."],
      ["Cosa sblocca il piano Free?", "Profilo, lingua, preview account e accesso alla struttura, senza prediction operative."],
      ["Cosa sblocca BetRedge Pro?", "Tennis live, football research, Best Bets, Top Model Signals, spiegazioni modello e track record."],
      ["Gli agenti piazzano bet automaticamente?", "No nel go-live: il piano pubblico è research e signal desk. L'execution resta interna/non venduta."],
    ],
    en: [
      ["What can public users see?", "Only homepage, product structure and past/educational history. Live signals stay locked."],
      ["What does Free unlock?", "Profile, language, account preview and product structure, without operational predictions."],
      ["What does BetRedge Pro unlock?", "Tennis live, football research, Best Bets, Top Model Signals, model explanations and track record."],
      ["Do agents place bets automatically?", "Not in the go-live: the public plan is research and signal desk. Execution remains internal/not sold."],
    ],
    es: [
      ["¿Qué ve un usuario público?", "Solo la homepage, la estructura del producto y el historial pasado/educativo. Las señales live siguen bloqueadas."],
      ["¿Qué desbloquea el plan Free?", "Perfil, idioma, vista previa de cuenta y acceso a la estructura, sin predicciones operativas."],
      ["¿Qué desbloquea BetRedge Pro?", "Tenis live, football research, Best Bets, Top Model Signals, explicaciones del modelo y track record."],
      ["¿Los agentes hacen apuestas automáticamente?", "No en el lanzamiento: el plan público es research y signal desk. La ejecución sigue siendo interna/no se vende."],
    ],
    fr: [
      ["Que voit un utilisateur public ?", "Seulement la homepage, la structure du produit et l'historique passé/éducatif. Les signaux live restent verrouillés."],
      ["Que débloque le plan Free ?", "Profil, langue, aperçu du compte et accès à la structure, sans prédictions opérationnelles."],
      ["Que débloque BetRedge Pro ?", "Tennis live, football research, Best Bets, Top Model Signals, explications du modèle et track record."],
      ["Les agents placent-ils des paris automatiquement ?", "Pas au lancement : le plan public est research et signal desk. L'exécution reste interne/non vendue."],
    ],
    ru: [
      ["Что видит публичный пользователь?", "Только главную страницу, структуру продукта и прошлую/обучающую историю. Live-сигналы остаются заблокированы."],
      ["Что открывает план Free?", "Профиль, язык, предпросмотр аккаунта и доступ к структуре, без рабочих прогнозов."],
      ["Что открывает BetRedge Pro?", "Tennis live, football research, Best Bets, Top Model Signals, пояснения модели и track record."],
      ["Размещают ли агенты ставки автоматически?", "Не на старте: публичный план — это research и signal desk. Исполнение остаётся внутренним/не продаётся."],
    ],
  });
  return (
    <div className="public-homepage">
      <section className="public-sponsor-strip">
        <span>Partner placement</span>
        <strong>{pick5(lang, { it: "Slot sponsor generico, pronto per futuri operatori", en: "Generic sponsor slot, ready for future operators", es: "Espacio de patrocinio genérico, listo para futuros operadores", fr: "Emplacement sponsor générique, prêt pour de futurs opérateurs", ru: "Универсальный слот для спонсора, готов для будущих операторов" })}</strong>
        <em>{pick5(lang, { it: "Nessun brand reale collegato ora", en: "No real brand connected now", es: "Ninguna marca real conectada ahora", fr: "Aucune marque réelle connectée pour le moment", ru: "Сейчас реальный бренд не подключён" })}</em>
      </section>

      <section className="preaccess-hero">
        <div>
          <p className="eyebrow">{pick5(lang, { it: "PREVEDI. ANALIZZA. ANTICIPA.", en: "PREDICT. ANALYZE. EDGE.", es: "PREDICE. ANALIZA. ANTICIPA.", fr: "PRÉDIS. ANALYSE. ANTICIPE.", ru: "ПРОГНОЗИРУЙ. АНАЛИЗИРУЙ. ОПЕРЕЖАЙ." })}</p>
          <h3>{pick5(lang, { it: "Predictive intelligence per mercati sportivi, non un tipster feed", en: "Predictive intelligence for sports markets, not a tipster feed", es: "Inteligencia predictiva para mercados deportivos, no un feed de tipsters", fr: "Intelligence prédictive pour les marchés sportifs, pas un feed de pronostiqueurs", ru: "Предиктивная аналитика для спортивных рынков, а не лента типстеров" })}</h3>
          <span>
            {pick5(lang, {
              it: "Una homepage pubblica mostra solo struttura, storico passato e partner placeholder. Prediction, edge e live execution si sbloccano solo dopo login e piano.",
              en: "The public homepage shows only structure, past history and partner placeholders. Predictions, edge and live execution unlock only after login and plan selection.",
              es: "La homepage pública muestra solo estructura, historial pasado y placeholders de partners. Predicciones, edge y live execution se desbloquean solo tras el login y la selección de plan.",
              fr: "La homepage publique montre uniquement la structure, l'historique passé et des placeholders de partenaires. Prédictions, edge et live execution se débloquent seulement après le login et le choix du plan.",
              ru: "Публичная главная показывает только структуру, прошлую историю и плейсхолдеры партнёров. Прогнозы, edge и live execution открываются только после входа и выбора плана.",
            })}
          </span>
        </div>
        <DeskPreview />
        <div className="preaccess-actions">
          <button onClick={onCreate}>{t.preaccess_create}</button>
          <button onClick={onLogin}>{t.preaccess_login}</button>
          <button onClick={onPlans}>{pick5(lang, { it: "Vedi livelli", en: "View levels", es: "Ver niveles", fr: "Voir les niveaux", ru: "Смотреть уровни" })}</button>
        </div>
      </section>

      <section className="public-content-grid">
        <div className="public-main-column">
          <AccessLevels onCreate={onCreate} onPlans={onPlans} />
          <FutureSportsPanel sports={futureSports} />
          <FAQSupportSection items={faq} />
        </div>
        <aside className="public-side-column">
          {sponsorSlots.map((slot) => <SponsorSlot key={slot.label} {...slot} />)}
          <SupportHub />
        </aside>
      </section>
    </div>
  );
}

function DeskPreview() {
  const lang = useLang();
  return (
    <div className="desk-preview">
      <div className="desk-preview-head">
        <span>Sportsbook Edge Desk</span>
        <strong>LOCKED</strong>
      </div>
      <div className="desk-preview-board">
        <div><span>Football</span><em>Live V4 research</em><strong>Pro</strong></div>
        <div><span>Tennis</span><em>Calibrated model</em><strong>Pro</strong></div>
        <div><span>Best Bets</span><em>+EV or model signals</em><strong>Pro</strong></div>
      </div>
      <p>{pick5(lang, { it: "Preview pubblica: dati sensibili oscurati fino al piano.", en: "Public preview: sensitive data hidden until plan activation.", es: "Vista previa pública: datos sensibles ocultos hasta activar el plan.", fr: "Aperçu public : données sensibles masquées jusqu'à l'activation du plan.", ru: "Публичный предпросмотр: чувствительные данные скрыты до активации плана." })}</p>
    </div>
  );
}

function AccessLevels({ onCreate, onPlans }: { onCreate: () => void; onPlans: () => void }) {
  const lang = useLang();
  const priceCopy = {
    base: planPriceCopy("base", lang),
  };
  const levels = pick5(lang, {
    it: [
      { name: "Free", price: "$0", desc: "Profilo, lingua, preview e storico pubblico. Nessun segnale operativo.", cta: "Crea profilo", action: onCreate },
      { name: "BetRedge Pro", price: priceCopy.base, desc: "Tennis live, football research, Best Bets, spiegazioni e track record.", cta: "Vai al piano", action: onPlans },
    ],
    en: [
      { name: "Free", price: "$0", desc: "Profile, language, preview and public history. No operational signals.", cta: "Create profile", action: onCreate },
      { name: "BetRedge Pro", price: priceCopy.base, desc: "Tennis live, football research, Best Bets, explanations and track record.", cta: "View plan", action: onPlans },
    ],
    es: [
      { name: "Free", price: "$0", desc: "Perfil, idioma, vista previa e historial público. Sin señales operativas.", cta: "Crear perfil", action: onCreate },
      { name: "BetRedge Pro", price: priceCopy.base, desc: "Tenis live, football research, Best Bets, explicaciones y track record.", cta: "Ver plan", action: onPlans },
    ],
    fr: [
      { name: "Free", price: "$0", desc: "Profil, langue, aperçu et historique public. Aucun signal opérationnel.", cta: "Créer un profil", action: onCreate },
      { name: "BetRedge Pro", price: priceCopy.base, desc: "Tennis live, football research, Best Bets, explications et track record.", cta: "Voir le plan", action: onPlans },
    ],
    ru: [
      { name: "Free", price: "$0", desc: "Профиль, язык, предпросмотр и публичная история. Без рабочих сигналов.", cta: "Создать профиль", action: onCreate },
      { name: "BetRedge Pro", price: priceCopy.base, desc: "Tennis live, football research, Best Bets, пояснения и track record.", cta: "Смотреть план", action: onPlans },
    ],
  });
  return (
    <section className="public-section">
      <div className="public-section-head">
        <p className="eyebrow">{pick5(lang, { it: "Accesso clienti", en: "Client access", es: "Acceso clientes", fr: "Accès clients", ru: "Доступ клиентов" })}</p>
        <h3>{pick5(lang, { it: "Free più un piano unico, zero ambiguità", en: "Free plus one paid plan, zero ambiguity", es: "Free más un único plan de pago, cero ambigüedad", fr: "Free plus un seul plan payant, zéro ambiguïté", ru: "Free плюс один платный план, без двусмысленности" })}</h3>
      </div>
      <div className="access-level-grid">
        {levels.map((level) => (
          <article key={level.name}>
            <span>{level.name}</span>
            <strong>{level.price}</strong>
            <p>{level.desc}</p>
            <button onClick={level.action}>{level.cta}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function FutureSportsPanel({ sports }: { sports: { name: string; status: string }[] }) {
  const lang = useLang();
  return (
    <section className="public-section">
      <div className="public-section-head">
        <p className="eyebrow">Roadmap</p>
        <h3>{pick5(lang, { it: "Sport futuri, non ancora cliccabili", en: "Future sports, not clickable yet", es: "Deportes futuros, aún no clicables", fr: "Sports futurs, pas encore cliquables", ru: "Будущие виды спорта, пока недоступны для клика" })}</h3>
      </div>
      <div className="future-sports-grid">
        {sports.map((sport) => (
          <button key={sport.name} disabled>
            <strong>{sport.name}</strong>
            <span>{sport.status}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SponsorSlot({ label, title, desc }: { label: string; title: string; desc: string }) {
  return (
    <article className="sponsor-slot">
      <span>{label}</span>
      <strong>{title}</strong>
      <p>{desc}</p>
      <em>Placeholder</em>
    </article>
  );
}

function SupportHub() {
  const lang = useLang();
  const [topic, setTopic] = useState("access");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const copy = pick5(lang, {
    it: {
      eyebrow: "Supporto cliente",
      title: "Apri una richiesta",
      subtitle: "Descrivi il problema: il team potrà collegare questo flusso a email, Telegram o CRM senza cambiare la UI.",
      topic: "Area",
      priority: "Priorità",
      message: "Messaggio",
      placeholder: "Scrivi cosa non funziona, quale piano hai e cosa stavi provando a fare...",
      send: "Prepara ticket",
      sent: "Ticket preparato",
      sentDesc: "La richiesta è pronta per essere collegata al canale supporto operativo.",
      topics: [
        ["access", "Accesso / login"],
        ["payment", "Pagamento / TX hash"],
        ["signals", "Prediction e best bets"],
        ["execution", "Exchange / execution"],
        ["account", "Profilo e impostazioni"],
      ],
      priorities: [
        ["normal", "Normale"],
        ["high", "Alta"],
        ["urgent", "Urgente"],
      ],
    },
    en: {
      eyebrow: "Client support",
      title: "Open a request",
      subtitle: "Describe the issue: this flow can connect to email, Telegram or CRM without changing the UI.",
      topic: "Area",
      priority: "Priority",
      message: "Message",
      placeholder: "Write what is not working, which plan you have and what you were trying to do...",
      send: "Prepare ticket",
      sent: "Ticket prepared",
      sentDesc: "The request is ready to be connected to the operating support channel.",
      topics: [
        ["access", "Access / login"],
        ["payment", "Payment / TX hash"],
        ["signals", "Predictions and best bets"],
        ["execution", "Exchange / execution"],
        ["account", "Profile and settings"],
      ],
      priorities: [
        ["normal", "Normal"],
        ["high", "High"],
        ["urgent", "Urgent"],
      ],
    },
    es: {
      eyebrow: "Soporte al cliente",
      title: "Abrir una solicitud",
      subtitle: "Describe el problema: este flujo puede conectarse a email, Telegram o CRM sin cambiar la UI.",
      topic: "Área",
      priority: "Prioridad",
      message: "Mensaje",
      placeholder: "Escribe qué no funciona, qué plan tienes y qué estabas intentando hacer...",
      send: "Preparar ticket",
      sent: "Ticket preparado",
      sentDesc: "La solicitud está lista para conectarse al canal de soporte operativo.",
      topics: [
        ["access", "Acceso / login"],
        ["payment", "Pago / TX hash"],
        ["signals", "Predicciones y best bets"],
        ["execution", "Exchange / execution"],
        ["account", "Perfil y ajustes"],
      ],
      priorities: [
        ["normal", "Normal"],
        ["high", "Alta"],
        ["urgent", "Urgente"],
      ],
    },
    fr: {
      eyebrow: "Support client",
      title: "Ouvrir une demande",
      subtitle: "Décrivez le problème : ce flux peut se connecter à email, Telegram ou CRM sans changer l'UI.",
      topic: "Domaine",
      priority: "Priorité",
      message: "Message",
      placeholder: "Écrivez ce qui ne fonctionne pas, quel plan vous avez et ce que vous essayiez de faire...",
      send: "Préparer le ticket",
      sent: "Ticket préparé",
      sentDesc: "La demande est prête à être connectée au canal de support opérationnel.",
      topics: [
        ["access", "Accès / login"],
        ["payment", "Paiement / TX hash"],
        ["signals", "Prédictions et best bets"],
        ["execution", "Exchange / execution"],
        ["account", "Profil et paramètres"],
      ],
      priorities: [
        ["normal", "Normale"],
        ["high", "Haute"],
        ["urgent", "Urgente"],
      ],
    },
    ru: {
      eyebrow: "Поддержка клиентов",
      title: "Открыть запрос",
      subtitle: "Опишите проблему: этот поток можно подключить к email, Telegram или CRM без изменения UI.",
      topic: "Раздел",
      priority: "Приоритет",
      message: "Сообщение",
      placeholder: "Напишите, что не работает, какой у вас план и что вы пытались сделать...",
      send: "Подготовить тикет",
      sent: "Тикет подготовлен",
      sentDesc: "Запрос готов к подключению к каналу операционной поддержки.",
      topics: [
        ["access", "Доступ / вход"],
        ["payment", "Оплата / TX hash"],
        ["signals", "Прогнозы и best bets"],
        ["execution", "Exchange / execution"],
        ["account", "Профиль и настройки"],
      ],
      priorities: [
        ["normal", "Обычный"],
        ["high", "Высокий"],
        ["urgent", "Срочный"],
      ],
    },
  });

  if (sent) {
    return (
      <section className="support-hub">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h3>{copy.sent}</h3>
        <p>{copy.sentDesc}</p>
        <div className="support-ticket-summary">
          <span>{copy.topic}: {copy.topics.find(([key]) => key === topic)?.[1]}</span>
          <span>{copy.priority}: {copy.priorities.find(([key]) => key === priority)?.[1]}</span>
        </div>
        <button onClick={() => { setSent(false); setMessage(""); }}>{pick5(lang, { it: "Nuova richiesta", en: "New request", es: "Nueva solicitud", fr: "Nouvelle demande", ru: "Новый запрос" })}</button>
      </section>
    );
  }

  return (
    <section className="support-hub">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h3>{copy.title}</h3>
      <p>{copy.subtitle}</p>
      <div className="support-form">
        <label>
          <span>{copy.topic}</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {copy.topics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>{copy.priority}</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            {copy.priorities.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="support-message">
          <span>{copy.message}</span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder={copy.placeholder} />
        </label>
      </div>
      {message.trim().length > 0 && message.trim().length < 8 && (
        <p className="support-validation-hint">
          {pick5(lang, { it: "Messaggio troppo corto. Scrivi almeno 8 caratteri.", en: "Message too short. Please write at least 8 characters.", es: "Mensaje demasiado corto. Escribe al menos 8 caracteres.", fr: "Message trop court. Veuillez écrire au moins 8 caractères.", ru: "Сообщение слишком короткое. Напишите минимум 8 символов." })}
        </p>
      )}
      <button disabled={message.trim().length < 8} onClick={() => setSent(true)}>{copy.send}</button>
    </section>
  );
}

function FAQSupportSection({ items }: { items: string[][] }) {
  const lang = useLang();
  return (
    <section className="public-section">
      <div className="public-section-head">
        <p className="eyebrow">FAQ</p>
        <h3>{pick5(lang, { it: "Domande essenziali prima del login", en: "Essential questions before login", es: "Preguntas esenciales antes del login", fr: "Questions essentielles avant le login", ru: "Главные вопросы перед входом" })}</h3>
      </div>
      <div className="faq-grid">
        {items.map(([q, a]) => (
          <article key={q}>
            <strong>{q}</strong>
            <p>{a}</p>
          </article>
        ))}
      </div>
      <div className="risk-disclaimer">
        {pick5(lang, {
          it: "Nota rischio: BetRedge mostra analisi probabilistiche. Non garantisce profitti e non sostituisce gestione del rischio personale.",
          en: "Risk note: BetRedge shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management.",
          es: "Nota de riesgo: BetRedge muestra análisis probabilístico. No garantiza beneficios ni sustituye la gestión personal del riesgo.",
          fr: "Note de risque : BetRedge montre une analyse probabiliste. Cela ne garantit pas de profits et ne remplace pas la gestion personnelle du risque.",
          ru: "Замечание о риске: BetRedge показывает вероятностный анализ. Это не гарантирует прибыль и не заменяет личное управление рисками.",
        })}
      </div>
    </section>
  );
}

function PlanFeature({ children, locked = false }: { children: React.ReactNode; locked?: boolean }) {
  return (
    <li className={locked ? "is-locked" : ""}>
      <span>{locked ? "LOCK" : "OK"}</span>
      <strong>{children}</strong>
    </li>
  );
}

function CryptoPaymentBox({
  profile,
  plan,
  onSubmit,
}: {
  profile: ClientProfile | null;
  plan: PublicPlanKey;
  onSubmit: (plan: PublicPlanKey) => void;
}) {
  const t = useT();
  const lang = useLang();
  // Solo il piano ESATTO è "attuale": un utente base deve poter fare upgrade a pro.
  const isCurrentPlan = profile?.plan === plan;
  // Base → Pro è un upgrade; Pro → Base sarebbe un downgrade (lo etichettiamo).
  const isDowngrade = plan === "base" && profile?.plan === "premium";
  return (
    <div className="crypto-pay-box">
      <div>
        <span>USDT TRC20</span>
        <strong>{planPriceCopy(plan, lang)}</strong>
        {!profile && <em>{t.crypto_profile_required}</em>}
      </div>
      <button disabled={!profile || isCurrentPlan || isDowngrade} onClick={() => onSubmit(plan)}>
        {isCurrentPlan
          ? pick5(lang, { it: "Piano attuale", en: "Current plan", es: "Plan actual", fr: "Plan actuel", ru: "Текущий план" })
          : isDowngrade
            ? pick5(lang, { it: "Già su Pro", en: "Already on Pro", es: "Ya en Pro", fr: "Déjà sur Pro", ru: "Уже на Pro" })
            : profile
              ? `${t.crypto_activate} ${planLabel(plan, lang)}`
              : t.crypto_create_first}
      </button>
    </div>
  );
}

// PayPal JS SDK loader — cached on window.paypal, loaded once per page.
// components=buttons,applepay: applepay adds the window.paypal.Applepay()
// component used by the Apple Pay button below (Task 8).
function loadPayPalSdk(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as unknown as { paypal?: unknown }).paypal) return resolve();
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons,applepay`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("paypal sdk load failed"));
    document.head.appendChild(s);
  });
}

// Minimal typing for the vanilla PayPal JS SDK's Apple Pay component.
// Method names (config/validateMerchant/confirmOrder) verified against
// developer.paypal.com/docs/checkout/apm/apple-pay/ (2026-07-01).
type PayPalApplepayConfig = {
  isEligible: boolean;
  countryCode: string;
  merchantCapabilities: string[];
  supportedNetworks: string[];
};
type PayPalApplepayComponent = {
  config: () => Promise<PayPalApplepayConfig>;
  validateMerchant: (o: { validationUrl: string }) => Promise<{ merchantSession: unknown }>;
  confirmOrder: (o: { orderId: string; token: unknown; billingContact?: unknown }) => Promise<void>;
};

function CheckoutModal({
  plan,
  onConfirm,
  onClose,
}: {
  plan: PublicPlanKey;
  onConfirm: (txHash: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"monthly" | "annual">("annual");
  const [applePayReady, setApplePayReady] = useState(false);
  const [applePayBusy, setApplePayBusy] = useState(false);
  // #PRICING-CREATORS-0706: annuale = 11 mensilita arrotondate (1 mese gratis).
  // Mirror display di PAYGATE_PRICES (lib/paygate.ts) — tenere in sync.
  const ANNUAL_PRICE: Record<string, number> = { base: 164.99, premium: 329.99 };
  const price = planAmountUsdt(plan);
  const displayPrice = period === "annual" ? (ANNUAL_PRICE[plan] ?? price) : price;
  const t = useT();
  const lang = useLang();

  // PayPal one-click button: renders into #paypal-button-container only when
  // NEXT_PUBLIC_PAYPAL_CLIENT_ID is set (feature-flag off => no button, UI unchanged).
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) return;
    let cancelled = false;
    loadPayPalSdk(clientId)
      .then(() => {
        if (cancelled) return;
        const paypal = (window as unknown as {
          paypal: {
            Buttons: (cfg: {
              createOrder: () => Promise<string>;
              onApprove: (data: { orderID: string }) => Promise<void>;
            }) => { render: (sel: string) => void };
          };
        }).paypal;
        const container = document.querySelector("#paypal-button-container");
        if (!container) return;
        container.innerHTML = ""; // avoid double-render on re-run (plan/period change)
        paypal.Buttons({
          createOrder: async () => {
            const r = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requested_plan: plan, period }),
            });
            const d = (await r.json()) as { id?: string; error?: string };
            if (!d.id) throw new Error(d.error ?? "create-order failed");
            return d.id;
          },
          onApprove: async (data) => {
            const r = await fetch("/api/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paypal_order_id: data.orderID }),
            });
            const d = (await r.json()) as { ok?: boolean; granted?: boolean };
            window.location.assign(d.granted ? "/app?paypal=success" : "/app?paypal=pending");
          },
        }).render("#paypal-button-container");
      })
      .catch((e) => console.error("[paypal] sdk:", e));
    return () => {
      cancelled = true;
    };
  }, [plan, period]);

  // Apple Pay eligibility: only surface the button on Apple devices/browsers
  // (canMakePayments) AND when the PayPal merchant is Apple Pay eligible
  // (applepay.config().isEligible). Everywhere else applePayReady stays
  // false and no button renders — no layout shift, no dead button.
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) return;
    let cancelled = false;
    const AppleSession = (window as unknown as {
      ApplePaySession?: { canMakePayments: () => boolean };
    }).ApplePaySession;
    // applePayReady defaults to false (useState above) — nothing to do if
    // this device/browser can't run Apple Pay at all.
    if (!AppleSession?.canMakePayments()) return;
    loadPayPalSdk(clientId)
      .then(async () => {
        if (cancelled) return;
        const paypal = (window as unknown as { paypal: { Applepay: () => PayPalApplepayComponent } }).paypal;
        const applepay = paypal.Applepay();
        const cfg = await applepay.config();
        if (!cancelled) setApplePayReady(!!cfg.isEligible);
      })
      .catch((e) => {
        console.error("[applepay] config:", e);
        if (!cancelled) setApplePayReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plan, period]);

  const handleApplePay = async () => {
    setError("");
    setApplePayBusy(true);
    try {
      const paypal = (window as unknown as { paypal: { Applepay: () => PayPalApplepayComponent } }).paypal;
      const applepay = paypal.Applepay();
      const cfg = await applepay.config();
      if (!cfg.isEligible) throw new Error("applepay not eligible");

      const r = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_plan: plan, period }),
      });
      const d = (await r.json()) as { id?: string; error?: string };
      if (!d.id) throw new Error(d.error ?? "create-order failed");
      const orderId = d.id;

      const AppleSession = (window as unknown as {
        ApplePaySession: new (
          version: number,
          request: Record<string, unknown>
        ) => {
          begin: () => void;
          completeMerchantValidation: (s: unknown) => void;
          completePayment: (status: number) => void;
          onvalidatemerchant: (e: { validationURL: string }) => void;
          onpaymentauthorized: (e: { payment: { token: unknown; billingContact?: unknown } }) => void;
          oncancel: () => void;
        };
      } & { ApplePaySession: { STATUS_SUCCESS: number; STATUS_FAILURE: number } }).ApplePaySession;

      // Displayed amount only — the server (create-order) is the authority
      // on the actual charged amount; this total is cosmetic on the sheet.
      const session = new AppleSession(4, {
        countryCode: cfg.countryCode,
        currencyCode: "USD",
        merchantCapabilities: cfg.merchantCapabilities,
        supportedNetworks: cfg.supportedNetworks,
        total: { label: "BetRedge", type: "final", amount: displayPrice.toFixed(2) },
      });

      session.onvalidatemerchant = async (e) => {
        try {
          const { merchantSession } = await applepay.validateMerchant({ validationUrl: e.validationURL });
          session.completeMerchantValidation(merchantSession);
        } catch (err) {
          console.error("[applepay] validateMerchant:", err);
          session.completePayment(AppleSession.STATUS_FAILURE);
        }
      };

      session.onpaymentauthorized = async (e) => {
        try {
          await applepay.confirmOrder({
            orderId,
            token: e.payment.token,
            billingContact: e.payment.billingContact,
          });
          const capRes = await fetch("/api/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paypal_order_id: orderId }),
          });
          const capData = (await capRes.json()) as { ok?: boolean; granted?: boolean };
          session.completePayment(capData.granted ? AppleSession.STATUS_SUCCESS : AppleSession.STATUS_FAILURE);
          window.location.assign(capData.granted ? "/app?paypal=success" : "/app?paypal=pending");
        } catch (err) {
          console.error("[applepay] confirmOrder/capture:", err);
          session.completePayment(AppleSession.STATUS_FAILURE);
        } finally {
          setApplePayBusy(false);
        }
      };

      session.oncancel = () => setApplePayBusy(false);

      session.begin();
    } catch (e) {
      console.error("[applepay] flow:", e);
      setError((t as Record<string, string>).checkout_error || "Pagamento non disponibile, riprova.");
      setApplePayBusy(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(USDT_TRC20_ADDRESS).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const payWithCard = async () => {
    const res = await fetch("/api/paygate/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requested_plan: plan, period }),
    });
    if (!res.ok) {
      console.error("paygate checkout failed", res.status);
      setError((t as Record<string, string>).checkout_error || "Pagamento non disponibile, riprova.");
      return;
    }
    const { url } = (await res.json()) as { url?: string };
    if (url) window.location.href = url;
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-head">
          <p className="eyebrow">Checkout</p>
          <h3>{planLabel(plan, lang)}</h3>
          {process.env.NEXT_PUBLIC_PAYGATE_ENABLED !== "true" && (
          <span>
            {(() => {
              const amount = <strong style={{ color: "var(--am-coral)", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{price.toFixed(2)} USDT</strong>;
              const parts = pick5(lang, {
                it: ["Invia esattamente ", " all'indirizzo qui sotto. Il piano passerà in verifica."],
                en: ["Send exactly ", " to the address below. The plan will move to review."],
                es: ["Envía exactamente ", " a la dirección de abajo. El plan pasará a revisión."],
                fr: ["Envoyez exactement ", " à l'adresse ci-dessous. Le plan passera en vérification."],
                ru: ["Отправьте ровно ", " на адрес ниже. План перейдёт на проверку."],
              });
              return <>{parts[0]}{amount}{parts[1]}</>;
            })()}
          </span>
          )}
        </div>

        {process.env.NEXT_PUBLIC_PAYGATE_ENABLED !== "true" && (<>
        <div className="checkout-wallet-block">
          <span>Network: TRC20 (Tron) · USDT</span>
          <div className="checkout-address">
            <code>{USDT_TRC20_ADDRESS}</code>
            <button type="button" onClick={handleCopy}>{copied ? t.checkout_copied : t.checkout_copy}</button>
          </div>
          <em>{t.checkout_amount}: {price.toFixed(2)} USDT</em>
        </div>

        <div className="checkout-steps">
          <div><span>1</span><span>{t.checkout_step1}</span></div>
          <div><span>2</span><span>{t.checkout_step2}</span></div>
          <div><span>3</span><span>{t.checkout_step3}</span></div>
        </div>

        {/* SLA + support (GAP7): set expectations on activation latency + give a
            channel for "I paid but see nothing". Manual activation today. */}
        <p style={{ fontSize: "11px", fontFamily: "var(--font-mono), ui-monospace, monospace", color: "var(--am-muted)", lineHeight: 1.5, margin: "4px 0 0" }}>
          {t.checkout_sla}{" "}
          <a href="mailto:info@betredge.com?subject=Pagamento%20-%20attivazione" style={{ color: "var(--am-coral)", textDecoration: "underline" }}>
            info@betredge.com
          </a>
        </p>

        <label>
          <span>{t.checkout_tx_label}</span>
          <input
            value={txHash}
            onChange={(e) => setTxHash(e.target.value.trim())}
            placeholder={t.checkout_tx_placeholder}
            autoComplete="off"
          />
        </label>

        <button
          disabled={txHash.length < 10 || submitting}
          onClick={async () => {
            setError("");
            setSubmitting(true);
            const ok = await onConfirm(txHash);
            // On success the parent unmounts this modal; on failure keep it open
            // with a retryable error — never silently swallow a lost tx_hash.
            if (!ok) {
              setSubmitting(false);
              setError(pick5(lang, {
                it: "Invio non riuscito: la transazione non è stata registrata. Controlla la connessione e riprova, oppure scrivi a info@betredge.com.",
                en: "Submission failed: your transaction was not recorded. Check your connection and retry, or email info@betredge.com.",
                es: "Envío fallido: tu transacción no se registró. Comprueba la conexión y reinténtalo, o escribe a info@betredge.com.",
                fr: "Échec de l'envoi : votre transaction n'a pas été enregistrée. Vérifiez la connexion et réessayez, ou écrivez à info@betredge.com.",
                ru: "Отправка не удалась: транзакция не зарегистрирована. Проверьте соединение и повторите, или напишите на info@betredge.com.",
              }));
            }
          }}
          style={{ marginTop: 4 }}
        >
          {submitting ? pick5(lang, { it: "Invio in corso…", en: "Submitting…", es: "Enviando…", fr: "Envoi en cours…", ru: "Отправка…" }) : <>{t.checkout_confirm} · {price.toFixed(2)} USDT</>}
        </button>
        </>)}
        {error && (
          <p style={{ fontSize: "12px", fontFamily: "var(--font-mono), ui-monospace, monospace", color: "var(--am-negative)", lineHeight: 1.5, margin: "8px 0 0" }}>
            {error}
          </p>
        )}

        {process.env.NEXT_PUBLIC_PAYGATE_ENABLED === "true" && (
          <div style={{ marginTop: 12, borderTop: "1px solid var(--am-coral)", paddingTop: 12 }}>
            <div style={{ display: "flex", gap: 8, margin: "0 0 6px" }}>
              <button type="button" onClick={() => setPeriod("monthly")} aria-pressed={period === "monthly"}
                style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid var(--am-coral)", background: period === "monthly" ? "var(--am-coral)" : "none", color: period === "monthly" ? "#fff" : "var(--am-coral)", cursor: "pointer", fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: 13 }}>
                {pick5(lang, { it: "Mensile", en: "Monthly", es: "Mensual", fr: "Mensuel", ru: "Месячный" })}
              </button>
              <button type="button" onClick={() => setPeriod("annual")} aria-pressed={period === "annual"}
                style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid var(--am-coral)", background: period === "annual" ? "var(--am-coral)" : "none", color: period === "annual" ? "#fff" : "var(--am-coral)", cursor: "pointer", fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: 13 }}>
                {pick5(lang, { it: "Annuale — 1 mese gratis", en: "Annual — 1 month free", es: "Anual — 1 mes gratis", fr: "Annuel — 1 mois offert", ru: "Год — 1 месяц бесплатно" })}
              </button>
            </div>
            <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 8px" }}>
              {period === "monthly"
                ? pick5(lang, { it: "Pagamento singolo, sblocca 30 giorni (rinnovo manuale).", en: "One-time payment, unlocks 30 days (manual renewal).", es: "Pago único, desbloquea 30 días (renovación manual).", fr: "Paiement unique, débloque 30 jours (renouvellement manuel).", ru: "Разовый платёж, 30 дней (ручное продление)." })
                : pick5(lang, { it: "Pagamento singolo, sblocca 12 mesi: paghi 11 mensilità, 1 mese è gratis.", en: "One-time payment, unlocks 12 months: you pay 11 monthly instalments, 1 month is free.", es: "Pago único, desbloquea 12 meses: pagas 11 mensualidades, 1 mes es gratis.", fr: "Paiement unique, débloque 12 mois : vous payez 11 mensualités, 1 mois est offert.", ru: "Разовый платёж, 12 месяцев: вы платите за 11 месяцев, 1 месяц бесплатно." })}
            </p>
            <button type="button" onClick={payWithCard}
              style={{ width: "100%", padding: "8px 0", borderRadius: 6, background: "none", border: "1px solid var(--am-coral)", color: "var(--am-coral)", cursor: "pointer" }}>
              {pick5(lang, { it: "Paga con carta", en: "Pay with card", es: "Pagar con tarjeta", fr: "Payer par carte", ru: "Оплатить картой" })} · {displayPrice.toFixed(2)} USD
            </button>
          </div>
        )}

        {process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, opacity: 0.7, textAlign: "center", margin: "0 0 6px" }}>
              {pick5(lang, { it: "oppure paga con PayPal", en: "or pay with PayPal", es: "o paga con PayPal", fr: "ou payez avec PayPal", ru: "или оплатите через PayPal" })}
            </p>
            <div id="paypal-button-container" />
          </div>
        )}

        {process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && applePayReady && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={handleApplePay}
              disabled={applePayBusy}
              aria-label="Apple Pay"
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 6,
                background: "#000",
                border: "none",
                color: "#fff",
                cursor: applePayBusy ? "default" : "pointer",
                opacity: applePayBusy ? 0.6 : 1,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {applePayBusy ? "…" : " Pay"}
            </button>
          </div>
        )}

        <p>
          {process.env.NEXT_PUBLIC_PAYGATE_ENABLED !== "true" && (<>{t.checkout_note_prefix} {price.toFixed(2)} {t.checkout_note_suffix}{" "}</>)}
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--muted-2)", cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: "inherit" }}
          >
            {t.checkout_cancel}
          </button>
        </p>
      </div>
    </div>
  );
}

function FounderModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key) return;
    setBusy(true);
    setError("");
    try {
      const resp = await fetch("/api/founder/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: key }),
      });
      const data = await resp.json();
      if (data.ok) {
        onSuccess();
      } else {
        setError(t.founder_invalid);
      }
    } catch {
      setError(t.founder_network);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <form className="auth-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="auth-modal-head">
          <p className="eyebrow">Team access</p>
          <h3>{t.founder_title}</h3>
          <span>{t.founder_desc}</span>
        </div>
        <label>
          <span>{t.founder_secret}</span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="••••••••"
            autoFocus
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button disabled={!key || busy}>{busy ? t.founder_checking : t.founder_login}</button>
      </form>
    </div>
  );
}

function PendingPaymentView({
  profile,
  onGoPlans,
}: {
  profile: ClientProfile;
  onGoPlans: () => void;
}) {
  const t = useT();
  return (
    <div className="pending-payment-view">
      <p className="eyebrow">{t.pending_title}</p>
      <h2>{t.pending_subtitle}</h2>
      {profile.txHash && profile.txHash !== "test" && (
        <div className="pending-tx">
          <span>{t.pending_tx_label} {profile.txHash.length > 20 ? `${profile.txHash.slice(0, 10)}...${profile.txHash.slice(-8)}` : profile.txHash}</span>
        </div>
      )}
      <button onClick={onGoPlans}>{t.pending_go_plans}</button>
    </div>
  );
}

// #PRICING-CREATORS-0706 (rev. Michele, A4): banner PROMO DI LANCIO -50% sul
// primo mese — vale per TUTTI (nessuna condizione referral; il link creator
// /r/CODICE fa solo attribuzione). DARK finché NEXT_PUBLIC_LAUNCH_PROMO_ENABLED
// non è "true". Il countdown è sulla DEADLINE UNICA della campagna di lancio
// (NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE, data reale ~1 mese): mai un timer
// per-utente che si resetta (dark pattern FTC). Display only: il prezzo
// scontato vero viene applicato SERVER-SIDE al checkout (lib/creator-promo +
// discountedAmountFor).
function LaunchPromoBanner() {
  const lang = useLang();
  const enabled = process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED === "true";
  const deadlineIso = process.env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE || "";
  const deadline = enabled && deadlineIso ? new Date(deadlineIso).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const iv = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(iv);
  }, [enabled]);
  if (!enabled || !Number.isFinite(deadline) || now >= deadline) return null;
  const left = deadline - now;
  const dd = Math.floor(left / 86_400_000);
  const hh = Math.floor((left % 86_400_000) / 3_600_000);
  const mm = Math.floor((left % 3_600_000) / 60_000);
  const countdown = dd > 0 ? `${dd}d ${hh}h` : hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
  return (
    <section className="plans-hero" style={{ borderColor: "var(--coral, #ff6b5e)" }}>
      <div>
        <p className="eyebrow">{pick5(lang, { it: "Offerta di lancio", en: "Launch offer", es: "Oferta de lanzamiento", fr: "Offre de lancement", ru: "Стартовое предложение" })}</p>
        <h3>{pick5(lang, { it: "-50% sul primo acquisto", en: "-50% on your first purchase", es: "-50% en tu primera compra", fr: "-50% sur votre premier achat", ru: "-50% на первую покупку" })}</h3>
        <span>
          {pick5(lang, {
            it: "Per il lancio, il primo acquisto — mensile o annuale — è a metà prezzo per tutti: lo sconto si applica da solo al checkout. L'offerta scade tra ",
            en: "For launch, your first purchase — monthly or annual — is half price for everyone: the discount applies automatically at checkout. Offer ends in ",
            es: "Por el lanzamiento, tu primera compra — mensual o anual — está a mitad de precio para todos: el descuento se aplica solo al pagar. La oferta termina en ",
            fr: "Pour le lancement, votre premier achat — mensuel ou annuel — est à moitié prix pour tous : la remise s'applique automatiquement au paiement. L'offre expire dans ",
            ru: "В честь запуска первая покупка — месячная или годовая — за полцены для всех: скидка применится автоматически при оплате. Предложение истекает через ",
          })}
          <strong>{countdown}</strong>.
        </span>
      </div>
    </section>
  );
}

function PlansTab({
  profile,
  onOpenDesk,
  onPaymentSubmit,
  onActivateFree,
}: {
  profile: ClientProfile | null;
  onOpenDesk: () => void;
  onPaymentSubmit: (plan: PublicPlanKey) => void;
  onActivateFree: () => void;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="plans-view" id="client-plans">
      <section className="plans-hero">
        <div>
          <p className="eyebrow">{t.plans_eyebrow}</p>
          <h3>{t.plans_title}</h3>
          <span>{t.plans_subtitle}</span>
        </div>
        <button onClick={onOpenDesk}>{t.plans_cta}</button>
      </section>

      <LaunchPromoBanner />

      <section className="plans-grid plans-grid-3">
        {/* ── FREE ── */}
        <article className="plan-card">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">Free</p>
              <h4>BetRedge Free</h4>
            </div>
            <span>$0</span>
          </div>
          <p className="plan-description">
            {pick5(lang, {
              it: "Una prediction per sport ogni settimana, sbloccata del tutto. Profilo e storico pubblico.",
              en: "One prediction per sport every week, fully unlocked. Profile and public history.",
              es: "Una predicción por deporte cada semana, totalmente desbloqueada. Perfil e historial público.",
              fr: "Une prédiction par sport chaque semaine, entièrement débloquée. Profil et historique public.",
              ru: "Один прогноз на вид спорта каждую неделю, полностью открыт. Профиль и публичная история.",
            })}
          </p>
          <div className="price-line">
            <strong>$0</strong>
            <span>{pick5(lang, { it: "Per sempre", en: "Forever", es: "Para siempre", fr: "Pour toujours", ru: "Навсегда" })}</span>
          </div>
          <div className="plan-core-line">
            <strong>{pick5(lang, { it: "1 per sport / settimana", en: "1 per sport / week", es: "1 por deporte / semana", fr: "1 par sport / semaine", ru: "1 на вид спорта / неделя" })}</strong>
            <em>{pick5(lang, { it: "La top del modello per calcio e per tennis.", en: "The model's top pick for football and tennis.", es: "La mejor selección del modelo para fútbol y tenis.", fr: "Le meilleur choix du modèle pour le football et le tennis.", ru: "Лучший выбор модели для футбола и тенниса." })}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{pick5(lang, { it: "1 top prediction calcio + 1 tennis / settimana", en: "1 top football + 1 tennis prediction / week", es: "1 predicción top de fútbol + 1 de tenis / semana", fr: "1 prédiction top football + 1 tennis / semaine", ru: "1 топ-прогноз по футболу + 1 по теннису / неделя" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Pick, probabilità e spiegazione su quelle", en: "Pick, probabilities and explanation on those", es: "Selección, probabilidades y explicación sobre ellas", fr: "Choix, probabilités et explication sur ceux-ci", ru: "Выбор, вероятности и пояснение по ним" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Profilo e lingua salvati · storico pubblico", en: "Profile and language saved · public history", es: "Perfil e idioma guardados · historial público", fr: "Profil et langue enregistrés · historique public", ru: "Профиль и язык сохранены · публичная история" })}</PlanFeature>
            <PlanFeature locked>{pick5(lang, { it: "Resto del board, edge e Deep Analysis", en: "Rest of the board, edge and Deep Analysis", es: "Resto del panel, edge y Deep Analysis", fr: "Reste du tableau, edge et Deep Analysis", ru: "Остальная часть доски, edge и Deep Analysis" })}</PlanFeature>
          </ul>
          <button className="plan-action" disabled={!profile || profile.plan === "free"} onClick={onActivateFree}>
            {!profile ? t.crypto_create_first : profile.plan === "free" ? pick5(lang, { it: "Free attivo", en: "Free active", es: "Free activo", fr: "Free actif", ru: "Free активен" }) : pick5(lang, { it: "Attiva Free", en: "Activate Free", es: "Activar Free", fr: "Activer Free", ru: "Активировать Free" })}
          </button>
        </article>

        {/* ── BASE ── */}
        <article className="plan-card">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">{pick5(lang, { it: "Più popolare", en: "Most popular", es: "Más popular", fr: "Le plus populaire", ru: "Самый популярный" })}</p>
              <h4>{planLabel("base", lang)}</h4>
            </div>
            <span>{planPriceCopy("base", lang)}</span>
          </div>
          <p className="plan-description">
            {pick5(lang, {
              it: "Le top 5 prediction per sport ogni settimana, con edge e spiegazioni complete.",
              en: "The top 5 predictions per sport every week, with full edge and explanations.",
              es: "Las 5 mejores predicciones por deporte cada semana, con edge y explicaciones completas.",
              fr: "Les 5 meilleures prédictions par sport chaque semaine, avec edge et explications complètes.",
              ru: "Топ-5 прогнозов на вид спорта каждую неделю, с edge и полными пояснениями.",
            })}
          </p>
          <div className="price-line">
            <strong>{planPriceCopy("base", lang)}</strong>
            <span>Crypto only · USDT TRC20</span>
          </div>
          <div className="plan-core-line">
            <strong>{pick5(lang, { it: "5 per sport / settimana", en: "5 per sport / week", es: "5 por deporte / semana", fr: "5 par sport / semaine", ru: "5 на вид спорта / неделя" })}</strong>
            <em>{pick5(lang, { it: "10 prediction a settimana, le migliori per edge.", en: "10 predictions a week, the best by edge.", es: "10 predicciones por semana, las mejores por edge.", fr: "10 prédictions par semaine, les meilleures par edge.", ru: "10 прогнозов в неделю, лучшие по edge." })}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{pick5(lang, { it: "Top 5 calcio + 5 tennis / settimana (10 totali)", en: "Top 5 football + 5 tennis / week (10 total)", es: "Top 5 fútbol + 5 tenis / semana (10 en total)", fr: "Top 5 football + 5 tennis / semaine (10 au total)", ru: "Топ-5 футбол + 5 теннис / неделя (10 всего)" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Pick, probabilità e spiegazione", en: "Pick, probabilities and explanation", es: "Selección, probabilidades y explicación", fr: "Choix, probabilités et explication", ru: "Выбор, вероятности и пояснение" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Edge %, stake suggerito, closing line value", en: "Edge %, suggested stake, closing line value", es: "Edge %, stake sugerido, closing line value", fr: "Edge %, mise suggérée, closing line value", ru: "Edge %, рекомендуемая ставка, closing line value" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Storico completo settlato", en: "Full settled history", es: "Historial completo liquidado", fr: "Historique complet réglé", ru: "Полная история расчётов" })}</PlanFeature>
            <PlanFeature locked>{pick5(lang, { it: "Prediction illimitate e Deep Analysis (→ Pro)", en: "Unlimited predictions and Deep Analysis (→ Pro)", es: "Predicciones ilimitadas y Deep Analysis (→ Pro)", fr: "Prédictions illimitées et Deep Analysis (→ Pro)", ru: "Безлимитные прогнозы и Deep Analysis (→ Pro)" })}</PlanFeature>
          </ul>
          <CryptoPaymentBox profile={profile} plan="base" onSubmit={onPaymentSubmit} />
        </article>

        {/* ── PRO (premium) ── */}
        <article className="plan-card is-premium">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">{pick5(lang, { it: "Tutto incluso", en: "Everything", es: "Todo incluido", fr: "Tout inclus", ru: "Всё включено" })}</p>
              <h4>{planLabel("premium", lang)}</h4>
            </div>
            <span>{planPriceCopy("premium", lang)}</span>
          </div>
          <p className="plan-description">
            {pick5(lang, {
              it: "Accesso completo: tutte le prediction, illimitate, su ogni sport, con la massima profondità.",
              en: "Full access: all predictions, unlimited, across every sport, at maximum depth.",
              es: "Acceso completo: todas las predicciones, ilimitadas, en cada deporte, con la máxima profundidad.",
              fr: "Accès complet : toutes les prédictions, illimitées, sur chaque sport, avec la profondeur maximale.",
              ru: "Полный доступ: все прогнозы, без лимита, по каждому виду спорта, с максимальной глубиной.",
            })}
          </p>
          <div className="price-line">
            <strong>{planPriceCopy("premium", lang)}</strong>
            <span>Crypto only · USDT TRC20</span>
          </div>
          <div className="plan-core-line">
            <strong>{pick5(lang, { it: "Illimitato", en: "Unlimited", es: "Ilimitado", fr: "Illimité", ru: "Безлимитно" })}</strong>
            <em>{pick5(lang, { it: "Nessun limite settimanale, tutta la piattaforma.", en: "No weekly cap, the whole platform.", es: "Sin límite semanal, toda la plataforma.", fr: "Aucune limite hebdomadaire, toute la plateforme.", ru: "Без недельного лимита, вся платформа." })}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{pick5(lang, { it: "TUTTE le prediction, illimitate", en: "ALL predictions, unlimited", es: "TODAS las predicciones, ilimitadas", fr: "TOUTES les prédictions, illimitées", ru: "ВСЕ прогнозы, без лимита" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Deep Analysis: forma, infortuni, venue", en: "Deep Analysis: form, injuries, venue", es: "Deep Analysis: forma, lesiones, estadio", fr: "Deep Analysis : forme, blessures, stade", ru: "Deep Analysis: форма, травмы, арена" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Tennis Live V4 e Football Live V4 research", en: "Tennis Live V4 and Football Live V4 research", es: "Tennis Live V4 y Football Live V4 research", fr: "Tennis Live V4 et Football Live V4 research", ru: "Tennis Live V4 и Football Live V4 research" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Match Builder e Best Bets +EV", en: "Match Builder and Best Bets +EV", es: "Match Builder y Best Bets +EV", fr: "Match Builder et Best Bets +EV", ru: "Match Builder и Best Bets +EV" })}</PlanFeature>
            <PlanFeature>{pick5(lang, { it: "Edge, stake e CLV su tutto", en: "Edge, stake and CLV on everything", es: "Edge, stake y CLV en todo", fr: "Edge, mise et CLV sur tout", ru: "Edge, ставка и CLV по всему" })}</PlanFeature>
            <PlanFeature><Link href="/weekly-pick" style={{ textDecoration: "underline" }}>{pick5(lang, { it: "Weekly Pick inclusa (la multipla della casa)", en: "Weekly Pick included (the house accumulator)", es: "Weekly Pick incluida (la combinada de la casa)", fr: "Weekly Pick inclus (le combiné de la maison)", ru: "Weekly Pick включён (экспресс от команды)" })}</Link></PlanFeature>
          </ul>
          <CryptoPaymentBox profile={profile} plan="premium" onSubmit={onPaymentSubmit} />
        </article>
      </section>

      <section className="plan-flow">
        <div><span>01</span><strong>{t.plans_flow1_title}</strong><em>{t.plans_flow1_desc}</em></div>
        <div><span>02</span><strong>{t.plans_flow2_title}</strong><em>{t.plans_flow2_desc}</em></div>
        <div><span>03</span><strong>{t.plans_flow3_title}</strong><em>{t.plans_flow3_desc}</em></div>
        <div><span>04</span><strong>{t.plans_flow4_title}</strong><em>{t.plans_flow4_desc}</em></div>
      </section>
    </div>
  );
}

function SettingsTab({
  profile,
  onUnlock,
  onSave,
}: {
  profile: ClientProfile | null;
  onUnlock: () => void;
  onSave: (profile: ClientProfile) => void;
}) {
  const [draft, setDraft] = useState<ClientProfile | null>(profile);

  useEffect(() => {
    queueMicrotask(() => setDraft(profile));
  }, [profile]);

  const t = useT();
  const lang = useLang();

  if (!draft) {
    return (
      <section className="settings-empty">
        <p className="eyebrow">Account</p>
        <h3>{t.settings_empty_title}</h3>
        <button onClick={onUnlock}>{t.settings_empty_btn}</button>
      </section>
    );
  }

  const settingsTimezone = draft.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const leaderboard = draft.leaderboardOptIn ?? false;

  const copy = pick5(lang, {
    it: {
      profile: "Profilo",
      accountDetails: "Dettagli account",
      name: "Nome",
      language: "Lingua",
      timezone: "Timezone",
      notifications: "Notifiche",
      valueBets: "Nuovi value bet",
      dailyReport: "Report giornaliero",
      paymentUpdates: "Pagamenti e accesso",
      securityAlerts: "Sicurezza account",
      enabled: "Attivo",
      disabled: "Disattivo",
      emailNote: "Per cambiare email contatta il supporto",
      sportPrefs: "Sport preferiti",
      sportPrefsDesc: "Ricevi prediction solo per gli sport selezionati.",
      leaderboardTitle: "Leaderboard",
      leaderboardDesc: "Appari nella classifica pubblica dei clienti per hit rate.",
      leaderboardOn: "Partecipo",
      leaderboardOff: "Non partecipo",
    },
    en: {
      profile: "Profile",
      accountDetails: "Account details",
      name: "Name",
      language: "Language",
      timezone: "Timezone",
      notifications: "Notifications",
      valueBets: "New value bets",
      dailyReport: "Daily report",
      paymentUpdates: "Payment and access",
      securityAlerts: "Account security",
      enabled: "Enabled",
      disabled: "Disabled",
      emailNote: "Contact support to change your email",
      sportPrefs: "Sport preferences",
      sportPrefsDesc: "Receive predictions only for selected sports.",
      leaderboardTitle: "Leaderboard",
      leaderboardDesc: "Appear in the public leaderboard ranked by hit rate.",
      leaderboardOn: "Opted in",
      leaderboardOff: "Opted out",
    },
    es: {
      profile: "Perfil",
      accountDetails: "Detalles de la cuenta",
      name: "Nombre",
      language: "Idioma",
      timezone: "Zona horaria",
      notifications: "Notificaciones",
      valueBets: "Nuevos value bets",
      dailyReport: "Informe diario",
      paymentUpdates: "Pagos y acceso",
      securityAlerts: "Seguridad de la cuenta",
      enabled: "Activo",
      disabled: "Inactivo",
      emailNote: "Para cambiar el email contacta con soporte",
      sportPrefs: "Deportes preferidos",
      sportPrefsDesc: "Recibe predicciones solo de los deportes seleccionados.",
      leaderboardTitle: "Leaderboard",
      leaderboardDesc: "Aparece en el leaderboard público de clientes por hit rate.",
      leaderboardOn: "Participo",
      leaderboardOff: "No participo",
    },
    fr: {
      profile: "Profil",
      accountDetails: "Détails du compte",
      name: "Nom",
      language: "Langue",
      timezone: "Fuseau horaire",
      notifications: "Notifications",
      valueBets: "Nouveaux value bets",
      dailyReport: "Rapport quotidien",
      paymentUpdates: "Paiements et accès",
      securityAlerts: "Sécurité du compte",
      enabled: "Activé",
      disabled: "Désactivé",
      emailNote: "Pour changer d'email, contactez le support",
      sportPrefs: "Sports préférés",
      sportPrefsDesc: "Recevez des prédictions uniquement pour les sports sélectionnés.",
      leaderboardTitle: "Leaderboard",
      leaderboardDesc: "Apparaissez dans le leaderboard public des clients classé par hit rate.",
      leaderboardOn: "J'y participe",
      leaderboardOff: "Je n'y participe pas",
    },
    ru: {
      profile: "Профиль",
      accountDetails: "Данные аккаунта",
      name: "Имя",
      language: "Язык",
      timezone: "Часовой пояс",
      notifications: "Уведомления",
      valueBets: "Новые value bets",
      dailyReport: "Ежедневный отчёт",
      paymentUpdates: "Платежи и доступ",
      securityAlerts: "Безопасность аккаунта",
      enabled: "Включено",
      disabled: "Выключено",
      emailNote: "Чтобы сменить email, обратитесь в поддержку",
      sportPrefs: "Любимые виды спорта",
      sportPrefsDesc: "Получайте прогнозы только по выбранным видам спорта.",
      leaderboardTitle: "Leaderboard",
      leaderboardDesc: "Появляйтесь в публичном leaderboard клиентов по hit rate.",
      leaderboardOn: "Участвую",
      leaderboardOff: "Не участвую",
    },
  });

  return (
    <div className="settings-view">
      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="eyebrow">{copy.profile}</p>
            <h3>{copy.accountDetails}</h3>
          </div>
          <span>{draft.plan.replace("_", " ")}</span>
        </div>
        <div className="settings-grid">
          <label>
            <span>{copy.name}</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            <span>Email</span>
            <input value={draft.email} readOnly disabled />
            <small style={{ display: "block", marginTop: "0.35rem", fontSize: "0.7rem", opacity: 0.55 }}>{copy.emailNote}</small>
          </label>
          <label>
            <span>{copy.language}</span>
            <select value={draft.language ?? "en"} onChange={(event) => setDraft({ ...draft, language: event.target.value as Lang })}>
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>{languageLabel(code, t)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.timezone}</span>
            <select value={settingsTimezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}>
              {TIMEZONE_OPTIONS.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="eyebrow">{copy.leaderboardTitle}</p>
            <h3>{copy.leaderboardDesc}</h3>
          </div>
          <span>{leaderboard ? copy.leaderboardOn : copy.leaderboardOff}</span>
        </div>
        <div className="settings-notification-list">
          <button type="button"
            className={leaderboard ? "is-on" : ""}
            onClick={() => setDraft({ ...draft, leaderboardOptIn: !leaderboard })}
          >
            <span>{copy.leaderboardTitle}</span>
            <strong>{leaderboard ? copy.leaderboardOn : copy.leaderboardOff}</strong>
          </button>
        </div>
      </section>

      <button className="settings-save" onClick={() => onSave(draft)}>{t.settings_save}</button>
    </div>
  );
}

function ClientAuthModal({
  intent,
  onClose,
  onAuthed,
  dismissible = true,
}: {
  intent: ClientAuthIntent;
  onClose: () => void;
  onAuthed: (profile: ClientProfile, serverPlan?: ClientProfile["plan"]) => void;
  // #LOGIN-WALL-0626: false on the desk auth wall → no × (Escape/backdrop already
  // don't close, see #QA-SERGIO-BAGS-1), so the modal can only be dismissed by
  // logging in or registering.
  dismissible?: boolean;
}) {
  const [mode, setMode] = useState<ClientAuthIntent>(intent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // #SIGNUP-GATE: legal-age + ToS acceptance are mandatory before a profile is created.
  const [ageOk, setAgeOk] = useState(false);
  const [tosOk, setTosOk] = useState(false);
  // #CRM-CRON-BUGFIX gap#2 (Tommy 06/07): il modal desk NON inviava
  // marketing_opt_in (solo la HomeAuthModal della landing lo faceva) → chi si
  // registrava dal desk restava fuori dal flow CRM acquisition per sempre.
  // Checkbox FACOLTATIVA, non pre-flaggata, separata da ToS/+18 (parità con la
  // landing); non incide su canSubmit.
  const [marketingOk, setMarketingOk] = useState(false);
  const t = useT();
  const lang = useLang();
  const it = lang === "it";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome";
  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = normalizedEmail.includes("@");
  const pwValid = password.length >= 8;
  const canSubmit = mode === "login"
    ? emailValid && pwValid
    : name.trim().length > 1 && emailValid && pwValid && ageOk && tosOk;

  // #QA-SERGIO-BAGS-1: Escape NON chiude più (come il backdrop). Il form di
  // registrazione tiene lo stato locale (name/email/password); chiuderlo lo
  // distrugge (unmount), quindi un Escape/click-fuori accidentale azzerava
  // tutto. Ora la chiusura è solo esplicita via la × in alto a destra.

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true); setError(""); setInfo(""); setShowResend(false);
    try {
      const resp = await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({
          action: mode === "login" ? "login" : "register",
          identifier: normalizedEmail, password,
          name: mode === "create" ? name.trim() : undefined,
          language: lang, timezone: tz,
          // #MB-1: first-touch influencer ref (lib/referral-code: normalizza + scadenza)
          ref: mode === "create" ? (readRefCode() ?? undefined) : undefined,
          marketing_opt_in: mode === "create" ? marketingOk : undefined,
        }),
      });
      const data = await resp.json().catch(() => ({})) as { plan?: ClientProfile["plan"]; name?: string | null; pending_activation?: boolean; error?: string };
      // HIGH-3: register no longer logs in — it sends an activation email. Show
      // a "check your inbox" notice instead of a session.
      if (resp.status === 202 || data.pending_activation) {
        setInfo(it
          ? `Ti abbiamo inviato un'email di attivazione a ${normalizedEmail}. Clicca il link per attivare il profilo (controlla anche lo spam), poi accedi qui.`
          : `We sent an activation email to ${normalizedEmail}. Click the link to activate your profile (check spam too), then log in here.`);
        setShowResend(true);
        // "register must lead to login, not the account page": after sign-up the
        // account isn't a session yet (email-activation gate), so flip the modal
        // to the login tab — the user activates via email, then logs in right here.
        setMode("login");
      } else if (resp.ok) {
        onAuthed({
          name: (data.name ?? name.trim()) || normalizedEmail,
          email: normalizedEmail, plan: "free", language: lang, timezone: tz,
          risk: { maxStake: 10, dailyStopLoss: 50, maxBetsPerDay: 5, mode: "automatic" },
          betfair: { status: "not_connected" }, notifications: defaultNotifications(),
        }, data.plan);
      } else if (resp.status === 403 && data.error === "activation_required") {
        // Account exists but the email was never confirmed → not a session.
        setError(it
          ? "Questo profilo non è ancora attivo. Conferma il tuo indirizzo email dal link che ti abbiamo inviato."
          : "This profile isn't activated yet. Confirm your email via the link we sent you.");
        setShowResend(true);
      } else if (resp.status === 401) setError(t.auth_err_wrongpw);
      else if (resp.status === 404) setError(t.auth_err_noaccount);
      else if (resp.status === 409) setError(t.auth_err_exists);
      else if (resp.status === 403) setError(t.auth_err_founder);
      else if (resp.status === 400) setError(t.auth_err_pwshort);
      else if (resp.status === 502) setError(it ? "Invio dell'email di attivazione non riuscito. Riprova tra poco." : "Could not send the activation email. Please retry shortly.");
      else setError(t.auth_err_generic);
    } catch { setError(t.auth_err_generic); }
    finally { setBusy(false); }
  };

  const resendActivation = async () => {
    if (busy || !emailValid) return;
    setBusy(true); setError("");
    try {
      await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action: "resend_activation", identifier: normalizedEmail, language: lang }),
      });
      setInfo(it ? "Email di attivazione reinviata. Controlla la posta." : "Activation email resent. Check your inbox.");
    } catch { setError(t.auth_err_generic); }
    finally { setBusy(false); }
  };

  // "Password dimenticata?": ask the server for a reset link. Always succeeds for
  // the user (no account enumeration — the server returns 200 regardless), so we
  // show the same neutral confirmation whether or not the email exists.
  const submitForgot = async () => {
    if (busy || !emailValid) return;
    setBusy(true); setError("");
    try {
      await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action: "forgot_password", identifier: normalizedEmail, language: lang }),
      });
      setForgotSent(true);
    } catch { setError(t.auth_err_generic); }
    finally { setBusy(false); }
  };

  // Forgot-password view: a compact email-only form rendered inside the same modal
  // shell. Reached from the "Password dimenticata?" link in login mode.
  if (forgot) {
    return (
      <div className="auth-modal-backdrop">
        <form className="auth-modal" onSubmit={(e) => { e.preventDefault(); submitForgot(); }} style={{ position: "relative" }}>
          {dismissible && (
            <button type="button" onClick={onClose} aria-label={it ? "Chiudi" : "Close"}
              style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none",
                color: "var(--am-muted-2)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4 }}>
              ×
            </button>
          )}
          <div className="auth-modal-head">
            <p className="eyebrow">{t.auth_eyebrow}</p>
            <h3>{it ? "Recupera la password" : "Recover your password"}</h3>
            <span>{it ? "Ti inviamo un link per impostare una nuova password." : "We'll email you a link to set a new password."}</span>
          </div>
          {forgotSent ? (
            <p className="auth-info" style={{ fontSize: "13px", lineHeight: 1.5, color: "var(--am-coral)", margin: "4px 0 0" }}>
              {it
                ? `Se esiste un account per ${normalizedEmail}, ti abbiamo inviato un link di reset (controlla anche lo spam). Il link scade tra 1 ora.`
                : `If an account exists for ${normalizedEmail}, we sent a reset link (check spam too). The link expires in 1 hour.`}
            </p>
          ) : (
            <>
              <label>
                <span>Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email" autoComplete="email" />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button disabled={!emailValid || busy}>{busy ? "…" : (it ? "Invia link di reset" : "Send reset link")}</button>
            </>
          )}
          <button type="button" onClick={() => { setForgot(false); setForgotSent(false); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--am-muted)", textDecoration: "underline",
              cursor: "pointer", fontSize: "12px", padding: "6px 0", alignSelf: "center" }}>
            {it ? "Torna all'accesso" : "Back to login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-modal-backdrop">
      <form className="auth-modal"
        onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ position: "relative" }}>
        {dismissible && (
          <button type="button" onClick={onClose} aria-label={it ? "Chiudi" : "Close"}
            style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none",
              color: "var(--am-muted-2)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4 }}>
            ×
          </button>
        )}
        <div className="auth-modal-head">
          <p className="eyebrow">{t.auth_eyebrow}</p>
          <h3>{mode === "login" ? t.auth_login_title : t.auth_create_title}</h3>
          <span>{mode === "login" ? t.auth_login_sub : t.auth_create_sub}</span>
        </div>
        <div className="auth-mode-switch">
          <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setError(""); }}>Login</button>
          <button type="button" className={mode === "create" ? "is-active" : ""} onClick={() => { setMode("create"); setError(""); }}>{t.preaccess_create}</button>
        </div>
        {mode === "create" && (
          <label>
            <span>{t.auth_name_label}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.auth_name_placeholder} autoComplete="name" />
          </label>
        )}
        <label>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email" autoComplete="email" />
        </label>
        <label>
          <span>Password</span>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "create" ? t.auth_pw_placeholder_new : "••••••••"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={{ width: "100%", paddingRight: 52 }} />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              aria-pressed={showPw}
              aria-label={showPw ? (it ? "Nascondi password" : "Hide password") : (it ? "Mostra password" : "Show password")}
              style={{ position: "absolute", right: 8, background: "none", border: "none",
                color: "var(--am-muted)", fontSize: 11, fontWeight: 700, letterSpacing: ".04em",
                textTransform: "uppercase", cursor: "pointer", padding: "4px 6px" }}>
              {showPw ? (it ? "Nascondi" : "Hide") : (it ? "Mostra" : "Show")}
            </button>
          </div>
        </label>
        {mode === "login" && (
          <button type="button" onClick={() => { setForgot(true); setError(""); setInfo(""); }}
            style={{ background: "none", border: "none", color: "var(--am-muted)", textDecoration: "underline",
              cursor: "pointer", fontSize: "12px", padding: "2px 0", alignSelf: "flex-start" }}>
            {it ? "Password dimenticata?" : "Forgot your password?"}
          </button>
        )}
        {/* #SIGNUP-GATE: +18 confirmation + Terms acceptance, required to create a profile */}
        {mode === "create" && (
          <div className="auth-consent" style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 0" }}>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.45, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} style={{ width: "auto", marginTop: 2, flex: "0 0 auto" }} />
              <span>{t.auth_age_confirm}</span>
            </label>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.45, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={tosOk} onChange={(e) => setTosOk(e.target.checked)} style={{ width: "auto", marginTop: 2, flex: "0 0 auto" }} />
              {/* #UI-TERMS-INSITE-0623: /terms e /privacy sono route interne →
                  navigano nel sito (back funziona). Niente più target="_blank". */}
              <span>{t.auth_tos_pre}<Link href="/terms" style={{ color: "var(--am-coral)", textDecoration: "underline" }}>{t.auth_tos_terms}</Link>{t.auth_tos_mid}<Link href="/privacy" style={{ color: "var(--am-coral)", textDecoration: "underline" }}>{t.auth_tos_privacy}</Link>{t.auth_tos_post}</span>
            </label>
            {/* Consenso marketing FACOLTATIVO (stessa copy della HomeAuthModal) —
                sblocca i flussi CRM acquisition; non incide su canSubmit. */}
            <label style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.45, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={marketingOk} onChange={(e) => setMarketingOk(e.target.checked)} style={{ width: "auto", marginTop: 2, flex: "0 0 auto" }} />
              <span>{pick5(lang, { it: "Voglio ricevere offerte e novità BetRedge via email (facoltativo).", en: "I want to receive BetRedge offers and news by email (optional).", es: "Quiero recibir ofertas y novedades de BetRedge por email (opcional).", fr: "Je veux recevoir les offres et actus BetRedge par email (facultatif).", ru: "Хочу получать предложения и новости BetRedge по email (необязательно)." })}</span>
            </label>
          </div>
        )}
        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info" style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--am-coral)", margin: "4px 0 0" }}>{info}</p>}
        {showResend && (
          <button type="button" onClick={resendActivation} disabled={busy || !emailValid}
            style={{ background: "none", border: "none", color: "var(--am-muted)", textDecoration: "underline", cursor: "pointer", fontSize: "12px", padding: "4px 0", alignSelf: "flex-start" }}>
            {it ? "Non l'hai ricevuta? Reinvia l'email di attivazione" : "Didn't get it? Resend the activation email"}
          </button>
        )}
        {/* BUG-009: the submit button is disabled until the form validates;
            without this hint the click looked silently unresponsive. */}
        {!error && !info && !canSubmit && !busy && (email || password) && (
          <p className="auth-error">
            {mode === "create" && name.trim().length > 1 && emailValid && pwValid && (!ageOk || !tosOk)
              ? t.auth_hint_consent
              : t.auth_hint_incomplete}
          </p>
        )}
        <button disabled={!canSubmit || busy}>{busy ? "…" : (mode === "login" ? "Login" : t.auth_create_btn)}</button>
        <p>{t.auth_footer}</p>
      </form>
    </div>
  );
}

// Mirrors the server gate (lib/auth.ts planHasAccess/planHasPremium): pending_payment
// does NOT unlock data — it shows a "waiting for confirmation" state. The server is the
// authority on data; these predicates only drive UI state.
function profileHasAccess(profile: ClientProfile | null) {
  return Boolean(profile && ["base", "premium", "admin_full"].includes(profile.plan));
}

function profileHasSignalPreview(profile: ClientProfile | null) {
  return Boolean(profile && (profile.plan === "free" || profileHasAccess(profile)));
}

function profileHasPremium(profile: ClientProfile | null) {
  return Boolean(profile && ["premium", "admin_full"].includes(profile.plan));
}

function profileIsPending(profile: ClientProfile | null) {
  return Boolean(profile && profile.plan === "pending_payment");
}

const TIMEZONE_OPTIONS = ["Europe/Rome", "Europe/Oslo", "Europe/London", "America/New_York", "America/Sao_Paulo", "Asia/Dubai"];

function defaultNotifications(): NonNullable<ClientProfile["notifications"]> {
  return {
    valueBets: true,
    dailyReport: true,
    paymentUpdates: true,
    securityAlerts: true,
  };
}

function ProfilePanel({
  profile,
  onLogout,
  onUpgrade,
}: {
  profile: ClientProfile;
  onLogout: () => void;
  onUpgrade: () => void;
}) {
  const hasPremium = profileHasPremium(profile);
  const t = useT();
  const lang = useLang();
  // Days remaining on a paid subscription (payments GAP2). Hidden for free/admin.
  const daysLeft = profile.planExpiresAt && profileHasAccess(profile) && profile.plan !== "admin_full"
    ? // eslint-disable-next-line react-hooks/purity -- day-granularity countdown: Date.now() drift within a render pass cannot change the ceil'd result; panel is client-only (post-login).
      Math.ceil((new Date(profile.planExpiresAt).getTime() - Date.now()) / 86_400_000)
    : null;
  return (
    <section className="profile-panel">
      <div className="profile-card">
        <div className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="eyebrow">Client profile</p>
          <h3>{profile.name}</h3>
          <span>{profile.email} · {profile.plan.replace("_", " ")}</span>
        </div>
        <button onClick={onLogout}>{t.profile_logout}</button>
      </div>
      {daysLeft != null && (
        <div className="upgrade-card" style={daysLeft <= 5 ? { borderColor: "var(--am-amber)" } : undefined}>
          <div>
            <p className="eyebrow">{pick5(lang, { it: "Abbonamento", en: "Subscription", es: "Suscripción", fr: "Abonnement", ru: "Подписка" })}</p>
            <h3>{daysLeft > 0
              ? `${daysLeft} ${daysLeft === 1 ? pick5(lang, { it: "giorno rimanente", en: "day left", es: "día restante", fr: "jour restant", ru: "день осталось" }) : pick5(lang, { it: "giorni rimanenti", en: "days left", es: "días restantes", fr: "jours restants", ru: "дн. осталось" })}`
              : pick5(lang, { it: "Scaduto", en: "Expired", es: "Caducado", fr: "Expiré", ru: "Истёк" })}</h3>
            <span>{pick5(lang, { it: "BetRedge Pro · rinnovo mensile", en: "BetRedge Pro · monthly renewal", es: "BetRedge Pro · renovación mensual", fr: "BetRedge Pro · renouvellement mensuel", ru: "BetRedge Pro · ежемесячное продление" })}</span>
          </div>
          {daysLeft <= 7 && <button onClick={onUpgrade}>{pick5(lang, { it: "Rinnova", en: "Renew", es: "Renovar", fr: "Renouveler", ru: "Продлить" })}</button>}
        </div>
      )}
      {!hasPremium && (
        <div className="upgrade-card">
          <div>
            <p className="eyebrow">{t.profile_upgrade_eyebrow}</p>
            <h3>{t.profile_upgrade_title}</h3>
            <span>{t.profile_upgrade_desc}</span>
          </div>
          <button onClick={onUpgrade}>{t.profile_upgrade_btn}</button>
        </div>
      )}
    </section>
  );
}


function LockedGate({
  isUnlocked,
  onUnlock,
  mode = "auth",
  children,
}: {
  isUnlocked: boolean;
  onUnlock: () => void;
  mode?: "auth" | "plan";
  children: React.ReactNode;
}) {
  const t = useT();
  const copy = mode === "plan"
    ? {
        eyebrow: t.locked_plan_eyebrow,
        title: t.locked_plan_title,
        desc: t.locked_plan_desc,
        btn: t.locked_plan_btn,
      }
    : {
        eyebrow: t.locked_eyebrow,
        title: t.locked_title,
        desc: t.locked_desc,
        btn: t.locked_btn,
      };
  return (
    <div className={`locked-gate ${isUnlocked ? "is-unlocked" : ""}`}>
      {!isUnlocked && (
        <div className="locked-overlay">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h3>{copy.title}</h3>
          <span>{copy.desc}</span>
          <button onClick={onUnlock}>{copy.btn}</button>
        </div>
      )}
      <div className="locked-content">{children}</div>
    </div>
  );
}

// ─── Prediction "Why" Reasoning ───────────────────────────────────────────────

// ── Human "why" narratives (UI-WHY-PROSE). One readable paragraph in the active
// language, assembled from the same data the cards already hold. No codes, no
// λ/Δ/pp jargon, no model-ids, no "?": missing facts are simply omitted.
// it = Italian; every other language falls back to English (same posture as the
// rest of the app's es/fr/ru handling).
function teamFormCounts(f?: string | WcFormCounts | null): { w: number; d: number; l: number } | null {
  if (!f) return null;
  if (typeof f === "string") {
    if (!f.trim()) return null;
    return { w: (f.match(/W/gi) || []).length, d: (f.match(/D/gi) || []).length, l: (f.match(/L/gi) || []).length };
  }
  if (typeof f === "object" && (f.w != null || f.d != null || f.l != null)) {
    return { w: f.w ?? 0, d: f.d ?? 0, l: f.l ?? 0 };
  }
  return null;
}

// Story-style "why": 2 short sentences, REAL but conversational. Sentence 1 =
// the momentum/form story (qualitative, no raw W-D-L), sentence 2 = the value /
// honest model-read logic. Deliberately does NOT repeat the % or edge numbers
// already shown in the Market/Model/Edge block.
function buildFootballWhy(p: Prediction, lang: Lang): string {
  const it = lang === "it";
  const e = p.enrichment ?? {};
  const sides = [
    { v: p.p_home, name: p.home_team, isHome: true, isDraw: false },
    { v: p.p_draw, name: it ? "il pareggio" : "the draw", isHome: false, isDraw: true },
    { v: p.p_away, name: p.away_team, isHome: false, isDraw: false },
  ].filter((s) => Number.isFinite(s.v));
  if (!sides.length) return it ? "Lettura del modello in arrivo." : "Model read incoming.";

  const ranked = sides.slice().sort((a, b) => b.v - a.v);
  const top = ranked[0];
  const tp = Math.round(top.v * 100);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const out: string[] = [];

  // ── 1. La chiamata, in parole semplici (sempre) ──
  if (top.isDraw) {
    out.push(it ? "Le due squadre si equivalgono: il modello vede l'equilibrio." : "The two sides are evenly matched — the model sees a balanced game.");
  } else if (tp >= 65) {
    out.push(it ? `${top.name} parte favorito netto.` : `${top.name} starts as a clear favourite.`);
  } else if (tp >= 45) {
    out.push(it ? `Partita aperta, ${top.name} leggermente avanti.` : `An open game, ${top.name} slightly ahead.`);
  } else {
    out.push(it ? `Partita equilibrata, ${top.name} il più probabile.` : `A tight game — ${top.name} is the model's most likely.`);
  }

  // ── 2. Forma a parole (confronto se entrambe note) ──
  const hf = formPhrase(teamFormCounts(e.form_home), lang);
  const af = formPhrase(teamFormCounts(e.form_away), lang);
  if (hf && af) {
    out.push(it ? `${p.home_team} è ${hf}, ${p.away_team} ${af}.` : `${p.home_team} is ${hf}, ${p.away_team} ${af}.`);
  }

  // ── 3. Storia gol (+ marcatore chiave come clausola, per restare entro 4 frasi) ──
  const gs = e.goals_summary;
  if (gs && typeof gs.expected_goals === "number") {
    const o25 = (e.extra_markets ?? []).find((m) => m.key === "over_2_5");
    const over = o25 && typeof o25.p === "number" ? o25.p : null;
    let s = goalsPhrase(gs.expected_goals, gs.band_low, gs.band_high, over, lang);
    const topScorer = (e.goalscorer_markets ?? []).slice().sort((a, b) => b.pScores - a.pScores)[0];
    if (topScorer && topScorer.pScores >= 0.15) {
      s += `; ${scorerPhrase(topScorer.name, topScorer.pScores, lang)}`;
    }
    out.push(cap(s) + ".");
  }

  // ── 4. Confidenza + onestà value (una frase, sempre) ──
  const mH = e.matches?.home, mA = e.matches?.away;
  const smallSample = (mH != null && mH < 10) || (mA != null && mA < 10);
  const conf = confidenceWord(tp >= 65, smallSample, lang);
  const tail = top.isDraw ? (it ? " sul pareggio" : " on the draw")
    : top.isHome ? (it ? " in casa" : " on the home side")
    : (it ? " sulla trasferta" : " on the away side");
  let value: string;
  if (p.edge != null && p.odds_home != null) {
    value = isFootballBestBet(p)
      ? (it ? `il modello la dà più probabile della quota: c'è valore${tail}` : `the model rates it likelier than the price — there's value${tail}`)
      : (it ? `il mercato è già in linea, nessun margine di valore` : `the market is already in line, no value edge`);
  } else {
    value = it ? `non c'è una quota di mercato: è la lettura del modello, non una value bet` : `no market price here — it's the model's read, not a value bet`;
  }
  out.push(`${cap(conf)}: ${value}.`);

  return out.join(" ");
}

// Story-style tennis "why": 2 short sentences, REAL but conversational.
// Sentence 1 = favourite + surface read (qualitative, from surface Elo);
// sentence 2 = value / honest model-read. No repeated % (shown in the block).
function buildTennisWhy(m: TennisMatch, lang: Lang): string {
  const it = lang === "it";
  const surf = it
    ? (m.surface === "CLAY" ? "sulla terra" : m.surface === "GRASS" ? "sull'erba" : "sul cemento")
    : (m.surface === "CLAY" ? "on clay" : m.surface === "GRASS" ? "on grass" : "on hard court");
  const p1n = m.player1.split(" ").pop() ?? m.player1;
  const p2n = m.player2.split(" ").pop() ?? m.player2;
  const favIsP1 = m.p1 >= m.p2;
  const favName = favIsP1 ? p1n : p2n;
  const gap = Math.abs(m.p1 - m.p2);
  const tbd = /\bTBD\b|\bTBA\b|qualifier/i.test(`${m.player1} ${m.player2}`);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const out: string[] = [];

  // ── 1. La chiamata + superficie ──
  if (tbd) {
    out.push(it
      ? `L'avversario non è ancora confermato: per ora è una lettura provvisoria del modello ${surf}.`
      : `The opponent isn't confirmed yet, so for now it's a provisional model read ${surf}.`);
  } else if (gap <= 0.06) {
    out.push(it
      ? `Match equilibrato ${surf}.`
      : `A balanced match ${surf}.`);
  } else {
    let eloTail = "";
    if (m.elo_p1 != null && m.elo_p2 != null) {
      const d = Math.abs(m.elo_p1 - m.elo_p2);
      const leaderIsFav = (m.elo_p1 >= m.elo_p2) === favIsP1;
      if (d >= 60 && leaderIsFav) eloTail = it ? `, dove ha un netto vantaggio su questa superficie` : `, with a clear edge on this surface`;
      else if (d >= 15 && leaderIsFav) eloTail = it ? `, dove parte un po' più in alto su questa superficie` : `, sitting a little higher on this surface`;
    }
    const favSM = favIsP1 ? m.surface_matches_p1 : m.surface_matches_p2;
    const smTail = typeof favSM === "number" && favSM >= 20
      ? (it ? ` (${favSM} match giocati qui)` : ` (${favSM} matches here)`) : "";
    const strong = Math.max(m.p1, m.p2) >= 0.65;
    out.push(it
      ? `Il modello vede ${favName} ${strong ? "favorito netto" : "favorito di misura"} ${surf}${eloTail}${smTail}.`
      : `The model makes ${favName} ${strong ? "a clear favourite" : "a narrow favourite"} ${surf}${eloTail}${smTail}.`);
  }

  // ── 2. Testa a testa (se rilevante) ──
  const h1 = m.h2h_p1_wins, h2 = m.h2h_p2_wins;
  if (typeof h1 === "number" && typeof h2 === "number" && h1 + h2 >= 2 && h1 !== h2) {
    const leadName = h1 > h2 ? p1n : p2n;
    const a = Math.max(h1, h2), b = Math.min(h1, h2);
    out.push(it ? `${leadName} conduce gli scontri diretti ${a}-${b}.` : `${leadName} leads the head-to-head ${a}-${b}.`);
  }

  // ── 3. Confidenza + onestà value (una frase) ──
  const favSM2 = favIsP1 ? m.surface_matches_p1 : m.surface_matches_p2;
  const smallSample = typeof favSM2 === "number" && favSM2 < 10;
  const strong = !tbd && gap > 0.06 && Math.max(m.p1, m.p2) >= 0.65;
  const conf = confidenceWord(strong, smallSample, lang);
  const tail = it ? ` su ${favName}` : ` on ${favName}`;
  let value: string;
  if (isTennisBestBet(m)) {
    value = it ? `il modello lo dà più probabile della quota: c'è valore${tail}` : `the model rates it likelier than the price — there's value${tail}`;
  } else if (m.odds_p1 != null || m.odds_p2 != null) {
    value = it ? `il mercato è già in linea, nessun valore da prendere` : `the market is already in line, no value to take`;
  } else {
    value = it ? `non c'è una quota di mercato: è la lettura del modello, non una value bet` : `no market price here — it's the model's read, not a value bet`;
  }
  out.push(`${cap(conf)}: ${value}.`);

  return out.join(" ");
}

function GoalsBlock({
  summary,
  markets,
  lang,
}: {
  summary: NonNullable<PredictionEnrichment["goals_summary"]>;
  markets: NonNullable<PredictionEnrichment["extra_markets"]>;
  lang: Lang;
}) {
  const ou = (key: string) => markets.find((m) => m.key === key)?.p ?? null;
  const o15 = ou("over_1_5");
  const o25 = ou("over_2_5");
  const o35 = ou("over_3_5");
  const bandLabel =
    summary.band_low === summary.band_high
      ? `${summary.band_low}`
      : `${summary.band_low}–${summary.band_high}`;
  const fmt = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)}%`);
  return (
    <div className="goals-block">
      <div className="goals-head">
        <span className="goals-eg">
          {pick5(lang, { it: "Gol attesi", en: "Expected goals", es: "Goles esperados", fr: "Buts attendus", ru: "Ожидаемые голы" })}: <b>{summary.expected_goals.toFixed(1)}</b>
        </span>
        <span className="goals-band">
          {pick5(lang, { it: "Fascia più probabile", en: "Most likely range", es: "Rango más probable", fr: "Fourchette probable", ru: "Вероятный диапазон" })}:{" "}
          <b>{bandLabel} {pick5(lang, { it: "gol", en: "goals", es: "goles", fr: "buts", ru: "голов" })}</b> ({Math.round(summary.band_p * 100)}%)
        </span>
      </div>
      <div className="goals-ou">
        <span>Over 1.5: <b>{fmt(o15)}</b></span>
        <span>Over 2.5: <b>{fmt(o25)}</b></span>
        <span>Over 3.5: <b>{fmt(o35)}</b></span>
      </div>
    </div>
  );
}

function GoalscorerBlock({
  markets,
  homeTeam,
  awayTeam,
  lang,
}: {
  markets: NonNullable<PredictionEnrichment["goalscorer_markets"]>;
  homeTeam: string;
  awayTeam: string;
  lang: Lang;
}) {
  // Split per lato, ordina per P modello (già ordinato da B-serve, ma difensivo).
  const home = markets.filter((m) => m.side === "home").sort((a, b) => b.pScores - a.pScores);
  const away = markets.filter((m) => m.side === "away").sort((a, b) => b.pScores - a.pScores);
  if (home.length === 0 && away.length === 0) return null;
  // Edge mostrato SOLO quando esiste una quota (book US). Mai numeri inventati.
  const hasAnyOdds = markets.some((m) => m.edge != null);
  const edgeTxt = (m: NonNullable<PredictionEnrichment["goalscorer_markets"]>[number]) =>
    m.edge == null ? "–" : m.edge > 0 ? `+${(m.edge * 100).toFixed(1)}%` : pick5(lang, { it: "in linea", en: "in line", es: "en línea", fr: "en ligne", ru: "в линии" });

  const renderSide = (rows: typeof home, team: string) => {
    if (rows.length === 0) return null;
    return (
      <div className="gs-side">
        <div className="gs-team">{team}</div>
        <ul className="gs-list">
          {rows.map((m, i) => (
            <li key={m.playerId ?? `${m.side}-${m.name}-${i}`} className="gs-row">
              <span className="gs-name" title={m.name}>
                {m.name}
                {m.confidence === "alta" && <span className="gs-tier" title={pick5(lang, { it: "Titolare / alta confidenza", en: "Starter / high confidence", es: "Titular / confianza alta", fr: "Titulaire / confiance élevée", ru: "Основной / высокая уверенность" })} />}
              </span>
              <span className="gs-model" title={pick5(lang, { it: "Probabilità modello che segni", en: "Model probability to score", es: "Probabilidad del modelo de marcar", fr: "Probabilité du modèle de marquer", ru: "Вероятность гола по модели" })}>{pct(m.pScores)}</span>
              <span className="gs-market">{m.marketImplied != null ? pct(m.marketImplied) : "–"}</span>
              <span className={`gs-edge${m.edge != null && m.edge > 0 ? " pos" : ""}`}>{edgeTxt(m)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="gs-block">
      <div className="gs-head">
        <span className="gs-title">
          {pick5(lang, { it: "Marcatori", en: "Goalscorers", es: "Goleadores", fr: "Buteurs", ru: "Бомбардиры" })}
        </span>
        <span className="gs-cols" aria-hidden="true">
          <span>{pick5(lang, { it: "Modello", en: "Model", es: "Modelo", fr: "Modèle", ru: "Модель" })}</span>
          <span>{pick5(lang, { it: "Mercato", en: "Market", es: "Mercado", fr: "Marché", ru: "Рынок" })}</span>
          <span>Edge</span>
        </span>
      </div>
      <div className="gs-sides">
        {renderSide(home, homeTeam)}
        {renderSide(away, awayTeam)}
      </div>
      <p className="gs-note">
        {hasAnyOdds
          ? pick5(lang, {
              it: "Probabilità che il giocatore segni almeno un gol. Edge = modello − quota (book US).",
              en: "Probability the player scores at least once. Edge = model − price (US books).",
              es: "Probabilidad de que el jugador marque al menos una vez. Edge = modelo − cuota (books US).",
              fr: "Probabilité que le joueur marque au moins une fois. Edge = modèle − cote (books US).",
              ru: "Вероятность, что игрок забьёт хотя бы раз. Edge = модель − котировка (US-буки).",
            })
          : pick5(lang, {
              it: "Probabilità che il giocatore segni almeno un gol. Nessuna quota disponibile: Edge non calcolabile.",
              en: "Probability the player scores at least once. No price available: edge not computable.",
              es: "Probabilidad de que el jugador marque al menos una vez. Sin cuota: edge no calculable.",
              fr: "Probabilité que le joueur marque au moins une fois. Pas de cote : edge non calculable.",
              ru: "Вероятность, что игрок забьёт хотя бы раз. Котировки нет: edge не рассчитывается.",
            })}
      </p>
    </div>
  );
}

function PredictionCard({ p, fp, onSelect, onBetNow, isPreview, isPremium, onGate }: { p: Prediction; fp?: FpOddsEntry; onSelect?: (s: SlipSelection) => void; onBetNow?: () => void; isPreview?: boolean; isPremium?: boolean; onGate?: () => void }) {
  const [showWhy, setShowWhy] = useState(false);
  const t = useT();
  const lang = useLang();
  const tz = useTz();
  const liveMap = useLive();
  const live = orientLive(liveMap[p.match_id] ?? findLiveByTeams(liveMap, p.home_team, p.away_team), p.home_team, p.away_team);
  const isLive = live?.match_status === "IN_PLAY";
  const isPaused = live?.match_status === "PAUSED";
  const isFinished = live?.match_status === "FINISHED";
  const hasScore = live && (live.home_score != null || live.away_score != null);
  const e = p.enrichment ?? {};
  // Confidence-surfacing gate (Wave 1): below the floor there is no clear
  // favourite — drop the pick direction, the +EV/value styling and the edge
  // badge, but keep the probability bars and the why. The match stays on the
  // board. Probability-neutral (server never alters p_* or confidence).
  const belowFloor = e.surface?.below_floor === true;
  const isValueBet = !belowFloor && isFootballBestBet(p);

  const handleSelect = () => {
    if (!onSelect || !p.best_selection) return;
    const selOdds = p.best_selection === "HOME" ? p.odds_home : p.best_selection === "DRAW" ? p.odds_draw : p.odds_away;
    const selP = p.best_selection === "HOME" ? p.p_home : p.best_selection === "DRAW" ? p.p_draw : p.p_away;
    if (!selOdds || selP == null) return;
    const confidence = confidenceFromEdge(p.edge, selP);
    onSelect({
      id: p.match_id,
      sport: "Football",
      event: `${p.home_team} vs ${p.away_team}`,
      league: p.league,
      kickoff: p.kickoff,
      market: "1X2",
      selection: p.best_selection === "HOME" ? p.home_team : p.best_selection === "DRAW" ? "Draw" : p.away_team,
      odds: selOdds,
      modelProbability: selP,
      edge: p.edge,
      confidence,
      recommendedStake: stakeFromEdge(p.edge, confidence),
    });
  };

  // Score readout state (scorebar) — preserves all live/finished logic.
  const scStatus = isLive ? "live" : isPaused ? "paused" : isFinished ? "finished" : null;
  const scLabel = isLive ? `LIVE${live?.minute != null ? ` ${live.minute}'` : ""}` : isPaused ? "HT" : isFinished ? "FT" : null;
  // Final verdict (only when a pick was asserted and not below floor).
  const verdict = (() => {
    if (!(isFinished && hasScore && live && live.home_score != null && live.away_score != null)) return null;
    const actual = live.home_score > live.away_score ? "HOME" : live.home_score < live.away_score ? "AWAY" : "DRAW";
    if (!p.best_selection || belowFloor) return null;
    const correct = p.best_selection === actual;
    return { correct, text: correct ? "✓ Modello corretto" : "✗ Modello errato" };
  })();
  // Demoted extra-markets (schedina) — moved into the expandable analysis.
  const extraPicks = (e.extra_markets ?? []).filter((m) => m.p >= 0.55).sort((a, b) => b.p - a.p).slice(0, 5);

  // ── Direction B readout: Market vs Model vs Edge (clear-pick cards only) ──
  // All figures are REAL: model% = the model's probability for the pick,
  // market% = raw implied (1/odds) for that same pick, edge = p.edge (value)
  // or the model-edge margin when there is no market price. Nothing fabricated.
  // Unified card structure (Andrea, 2026-06-20): always the readout, never bars
  // — even with no clear favourite, where we show the model's most-probable
  // outcome with NO edge claimed (FTC-honest).
  const topKey: "HOME" | "DRAW" | "AWAY" =
    p.p_home >= p.p_draw && p.p_home >= p.p_away ? "HOME"
    : p.p_draw >= p.p_away ? "DRAW" : "AWAY";
  const pickKey: string = belowFloor ? topKey : (p.best_selection ?? topKey);
  const pickName =
    pickKey === "HOME" ? p.home_team
    : pickKey === "AWAY" ? p.away_team
    : pickKey === "DRAW" ? pick5(lang, { it: "Pareggio", en: "Draw", es: "Empate", fr: "Match nul", ru: "Ничья" })
    : null;
  const pickProb =
    pickKey === "HOME" ? p.p_home
    : pickKey === "AWAY" ? p.p_away
    : pickKey === "DRAW" ? p.p_draw
    : null;
  const pickOdds =
    pickKey === "HOME" ? p.odds_home
    : pickKey === "AWAY" ? p.odds_away
    : pickKey === "DRAW" ? p.odds_draw
    : null;
  const marketImplied = pickOdds && pickOdds > 0 ? 1 / pickOdds : null;
  const edgeVal = !belowFloor && p.edge != null && p.edge > 0 ? p.edge * 100 : null;
  // Confidence 0-100 → 4-dot meter + word label.
  const confScore = p.confidence_score ?? (pickProb != null ? confidenceFromEdge(p.edge, pickProb) : null);
  const confDots = confScore != null ? Math.max(1, Math.min(4, Math.round(confScore / 25))) : 0;
  const confLabel = confScore == null ? null
    : confScore >= 70 ? pick5(lang, { it: "alta", en: "high", es: "alta", fr: "élevée", ru: "высокая" })
    : confScore >= 45 ? pick5(lang, { it: "media", en: "medium", es: "media", fr: "moyenne", ru: "средняя" })
    : pick5(lang, { it: "bassa", en: "low", es: "baja", fr: "faible", ru: "низкая" });

  // #FORTUNEPLAY-LIVE-ODDS-1: quota live FortunePlay allineata al LATO della pick
  // (per nome normalizzato, non per posizione: home/away FP ≠ per forza il nostro)
  // + value del modello vs quota FP. Solo card sbloccate/non-preview.
  const fpPickOdds: number | null = (() => {
    if (!fp || isPreview || p.locked) return null;
    if (pickKey === "DRAW") return fp.oddsDraw;
    const k = normName(pickKey === "HOME" ? p.home_team : p.away_team);
    if (k && k === fp.homeKey) return fp.oddsHome;
    if (k && k === fp.awayKey) return fp.oddsAway;
    return null;
  })();
  const fpValue = pickProb != null ? fpEdge(pickProb, fpPickOdds) : null;

  // #CARD-REDESIGN-V2: dati risolti per la scheda info (MatchDetailSheet). Il modal
  // si apre solo per card sbloccate (modalEnabled) → qui i dati sono sempre completi.
  const mdsData: MdsData = (() => {
    const fpq = (key: "HOME" | "DRAW" | "AWAY"): number | null => {
      if (!fp) return null;
      if (key === "DRAW") return fp.oddsDraw;
      const k = normName(key === "HOME" ? p.home_team : p.away_team);
      if (k && k === fp.homeKey) return fp.oddsHome;
      if (k && k === fp.awayKey) return fp.oddsAway;
      return null;
    };
    const pv = (v: number | null) => (v != null && v > 0 ? `+${(v * 100).toFixed(0)}%` : null);
    const groups: MdsGroup[] = [];

    // Esito 1X2
    const esito: Array<{ key: "HOME" | "DRAW" | "AWAY"; sel: string; prob: number }> = [
      { key: "HOME", sel: p.home_team, prob: p.p_home },
      { key: "DRAW", sel: pick5(lang, { it: "Pareggio", en: "Draw", es: "Empate", fr: "Match nul", ru: "Ничья" }), prob: p.p_draw },
      { key: "AWAY", sel: p.away_team, prob: p.p_away },
    ];
    groups.push({
      key: "esito", icon: "result", title: pick5(lang, { it: "Esito 1X2", en: "Match result", es: "Resultado 1X2", fr: "Résultat 1X2", ru: "Исход 1X2" }),
      src: { kind: fp ? "fp" : "est", label: fp ? "FortunePlay" : pick5(lang, { it: "solo modello", en: "model only", es: "solo modelo", fr: "modèle seul", ru: "только модель" }) },
      chips: esito.map((o) => {
        const q = fpq(o.key);
        return { id: `esito-${o.key}`, mkt: "Esito 1X2", sel: o.sel, prob: o.prob != null ? pct(o.prob) : null, q, value: q != null ? pv(fpEdge(o.prob, q)) : null, rec: pickKey === o.key };
      }),
    });

    // Gol Over/Under (solo se FortunePlay quota i totali)
    if (fp && fp.totalLine != null && (fp.totalOver != null || fp.totalUnder != null)) {
      const line = fp.totalLine;
      const findP = (side: string) => (e.extra_markets ?? []).find((x) => x.label && x.label.toLowerCase().includes(side) && x.label.includes(String(line)))?.p ?? null;
      const overP = findP("over"), underP = findP("under");
      const overVal = fp.totalOver != null && overP != null ? fpEdge(overP, fp.totalOver) : null;
      const underVal = fp.totalUnder != null && underP != null ? fpEdge(underP, fp.totalUnder) : null;
      const recOver = overP != null && underP != null ? overP >= underP : (overVal ?? -1) > (underVal ?? -1);
      groups.push({
        key: "gol", icon: "goal", title: pick5(lang, { it: "Gol", en: "Goals", es: "Goles", fr: "Buts", ru: "Голы" }),
        meta: `${pick5(lang, { it: "linea", en: "line", es: "línea", fr: "ligne", ru: "линия" })} ${line}${e.goals_summary ? ` · ${pick5(lang, { it: "attesi", en: "exp.", es: "esp.", fr: "att.", ru: "ожид." })} ${e.goals_summary.expected_goals.toFixed(1)}` : ""}`,
        src: { kind: "fp", label: "FortunePlay" },
        chips: [
          { id: "gol-over", mkt: `Gol O/U ${line}`, sel: `Over ${line}`, prob: overP != null ? pct(overP) : null, q: fp.totalOver, value: pv(overVal), rec: recOver },
          { id: "gol-under", mkt: `Gol O/U ${line}`, sel: `Under ${line}`, prob: underP != null ? pct(underP) : null, q: fp.totalUnder, value: pv(underVal), rec: !recOver },
        ],
      });
    }

    // Marcatore (anytime) — quote best book US
    // #GS-DEDUP-SHEET: dedup duplicati (es. "D. Muñoz" vs "Daniel Muñoz") per
    // lato+cognome+iniziale, tiene il pScores più alto (preferendo chi ha quota).
    const gsRaw = e.goalscorer_markets ?? [];
    const gsKey = (n: string) => {
      const parts = canonicalPlayerKey(n).split(" ").filter(Boolean);
      const last = parts.length ? parts[parts.length - 1] : "";
      const initial = parts.length ? parts[0][0] : "";
      return `${last}|${initial}`;
    };
    const gsMap = new Map<string, (typeof gsRaw)[number]>();
    for (const x of gsRaw) {
      const k = `${x.side}|${gsKey(x.name)}`;
      const prev = gsMap.get(k);
      if (!prev || x.pScores > prev.pScores || (x.pScores === prev.pScores && x.bestPrice != null && prev.bestPrice == null)) gsMap.set(k, x);
    }
    const gs = [...gsMap.values()].sort((a, b) => b.pScores - a.pScores).slice(0, 4);
    if (gs.length) {
      const topP = Math.max(...gs.map((x) => x.pScores));
      groups.push({
        key: "marcatore", icon: "boot", title: pick5(lang, { it: "Marcatore", en: "Goalscorer", es: "Goleador", fr: "Buteur", ru: "Бомбардир" }),
        src: { kind: "us", label: pick5(lang, { it: "best · book US", en: "best · US book", es: "best · casa US", fr: "best · book US", ru: "best · US" }) },
        chips: gs.map((x, i) => ({ id: `gs-${i}`, mkt: pick5(lang, { it: "Marcatore", en: "Goalscorer", es: "Goleador", fr: "Buteur", ru: "Бомбардир" }), sel: x.name, prob: pct(x.pScores), q: x.bestPrice, value: pv(x.edge), rec: x.pScores === topP && x.bestPrice != null })),
        note: pick5(lang, { it: "La nostra probabilità che ogni giocatore segni almeno un gol.", en: "Our probability that each player scores at least once.", es: "Nuestra probabilidad de que cada jugador marque al menos una vez.", fr: "Notre probabilité que chaque joueur marque au moins une fois.", ru: "Наша вероятность того, что игрок забьёт хотя бы раз." }),
      });
    }

    // Soft: cartellini + falli come NOSTRE predizioni (segnale reale dal backtest).
    // Corner ESCLUSI: nessuna skill validata (backtest peggiore della media-lega).
    // Solo mercati con modello reale (!is_generic) — mai una stima generica.
    const sf = e.soft;
    if (sf) {
      const chips: MdsChip[] = [];
      if (sf.cards && !sf.cards.is_generic) chips.push({ id: "soft-cards", mkt: pick5(lang, { it: "Cartellini", en: "Cards", es: "Tarjetas", fr: "Cartons", ru: "Карточки" }), sel: `${pick5(lang, { it: "Cartellini", en: "Cards", es: "Tarjetas", fr: "Cartons", ru: "Карточки" })} Over ${sf.cards.main_line}`, prob: pct(sf.cards.p_over) });
      if (sf.fouls && !sf.fouls.is_generic) chips.push({ id: "soft-fouls", mkt: pick5(lang, { it: "Falli", en: "Fouls", es: "Faltas", fr: "Fautes", ru: "Фолы" }), sel: `${pick5(lang, { it: "Falli", en: "Fouls", es: "Faltas", fr: "Fautes", ru: "Фолы" })} Over ${sf.fouls.main_line}`, prob: pct(sf.fouls.p_over) });
      if (chips.length) groups.push({
        key: "soft", icon: "flag", title: pick5(lang, { it: "Cartellini · Falli", en: "Cards · Fouls", es: "Tarjetas · Faltas", fr: "Cartons · Fautes", ru: "Карточки · Фолы" }),
        src: { kind: "est", label: pick5(lang, { it: "modello · Pro", en: "model · Pro", es: "modelo · Pro", fr: "modèle · Pro", ru: "модель · Pro" }) },
        chips,
        note: pick5(lang, { it: "Cartellini e falli: la nostra probabilità Over dal modello (Pro).", en: "Cards & fouls: our model's Over probability (Pro).", es: "Tarjetas y faltas: nuestra probabilidad Over del modelo (Pro).", fr: "Cartons et fautes : notre probabilité Over du modèle (Pro).", ru: "Карточки и фолы: наша вероятность Over от модели (Pro)." }),
      });
    }

    return {
      league: p.league_name || p.league,
      when: fmtKickoff(p.kickoff, lang, tz, p.enrichment?.time_confirmed),
      home: p.home_team, away: p.away_team,
      extraMarkets: e.extra_markets ?? undefined, // real model prediction for FP goal-derived markets
      hero: {
        flag: pick5(lang, { it: "La nostra prediction", en: "Our prediction", es: "Nuestro pronóstico", fr: "Notre pronostic", ru: "Наш прогноз" }),
        pick: pickName ? (pickKey === "DRAW" ? pickName : `${pickName} ${pick5(lang, { it: "vince", en: "to win", es: "gana", fr: "gagne", ru: "победа" })}`) : pick5(lang, { it: "Lettura modello", en: "Model read", es: "Lectura del modelo", fr: "Lecture du modèle", ru: "Чтение модели" }),
        read: `${pickProb != null ? pct(pickProb) + " " : ""}${pick5(lang, { it: "modello", en: "model", es: "modelo", fr: "modèle", ru: "модель" })}${confLabel ? ` · ${pick5(lang, { it: "conf.", en: "conf.", es: "conf.", fr: "conf.", ru: "увер." })} ${confLabel}` : ""}`,
        confDots,
        quotaLabel: pick5(lang, { it: "Quota FortunePlay", en: "FortunePlay odds", es: "Cuota FortunePlay", fr: "Cote FortunePlay", ru: "Коэф. FortunePlay" }),
        quota: fpPickOdds != null ? fpPickOdds.toFixed(2) : null,
        value: fpValue != null && fpValue > 0 ? `value ${(fpValue * 100).toFixed(1)}%` : null,
      },
      groups,
      matchUrl: fp?.matchUrl || FORTUNEPLAY_BET_URL,
      fpMatchId: fp?.id ?? null,
      books: fp?.books?.map((b) => ({ name: b.name, matchUrl: b.matchUrl })),
      moreLabel: pick5(lang, { it: "Altri mercati FortunePlay", en: "More FortunePlay markets", es: "Más mercados FortunePlay", fr: "Plus de marchés FortunePlay", ru: "Ещё рынки FortunePlay" }),
      labels: {
        schedina: pick5(lang, { it: "La tua schedina", en: "Your betslip", es: "Tu boleto", fr: "Votre coupon", ru: "Ваш купон" }),
        quotaComb: pick5(lang, { it: "quota combinata", en: "combined odds", es: "cuota combinada", fr: "cote combinée", ru: "комбо кэф" }),
        quotaOne: pick5(lang, { it: "quota", en: "odds", es: "cuota", fr: "cote", ru: "кэф" }),
        touch: pick5(lang, { it: "tocca i mercati", en: "tap the markets", es: "toca los mercados", fr: "touchez les marchés", ru: "выберите рынки" }),
        apri: pick5(lang, { it: "Apri su FortunePlay", en: "Open on FortunePlay", es: "Abrir en FortunePlay", fr: "Ouvrir sur FortunePlay", ru: "Открыть на FortunePlay" }),
        apriMulti: pick5(lang, { it: "Apri la multipla su FortunePlay", en: "Open the accumulator on FortunePlay", es: "Abrir la combinada en FortunePlay", fr: "Ouvrir le combiné sur FortunePlay", ru: "Открыть экспресс на FortunePlay" }),
        openBook: pick5(lang, { it: "Apri su {book}", en: "Open on {book}", es: "Abrir en {book}", fr: "Ouvrir sur {book}", ru: "Открыть на {book}" }),
        disc: pick5(lang, { it: "Value indicativo del modello vs quota FortunePlay — non è garanzia di vincita. +18 · gioca responsabilmente.", en: "Indicative model value vs FortunePlay odds — not a guarantee of winning. 18+ · play responsibly.", es: "Value indicativo del modelo vs cuota FortunePlay — no garantiza ganancias. +18 · juega con responsabilidad.", fr: "Valeur indicative du modèle vs cote FortunePlay — aucune garantie de gain. 18+ · jouez responsable.", ru: "Ориентировочная ценность vs кэф FortunePlay — не гарантия выигрыша. 18+" }),
        side: pick5(lang, { it: "Schedina composta lato BetRedge → il bottone apre la partita su FortunePlay.", en: "Betslip composed on BetRedge → the button opens the match on FortunePlay.", es: "Boleto compuesto en BetRedge → el botón abre el partido en FortunePlay.", fr: "Coupon composé sur BetRedge → le bouton ouvre le match sur FortunePlay.", ru: "Купон собран в BetRedge → кнопка открывает матч на FortunePlay." }),
        selOne: pick5(lang, { it: "1 selezione", en: "1 selection", es: "1 selección", fr: "1 sélection", ru: "1 выбор" }),
        selMany: pick5(lang, { it: "{n} selezioni", en: "{n} selections", es: "{n} selecciones", fr: "{n} sélections", ru: "{n} выборов" }),
      },
    };
  })();

  // Detail modal: la card della griglia è una sintesi compatta; il click la
  // "ingrandisce" nella scheda-dettaglio completa. Locked/preview non aprono il
  // modal (locked → gate via overlay; preview → niente da rivelare).
  const modalEnabled = !p.locked && !isPreview;
  const { open: modalOpen, rect: modalRect, close: closeModal, cardProps } = useDetailModal(modalEnabled);
  const modalTitleId = `pdm-${p.match_id}`;

  // ── chrome riusabile (griglia + header modal): top + fixture/scorebar ──
  const headerNode = (
    <>
      {/* top: sport glyph + league + when (live pulse) */}
      <div className="top">
        <div className="comp">
          <SportMark sport={p.enrichment?.kind === "world_cup" || p.league === "WC" ? "worldcup" : "football"} size={15} className="sgi" />
          <span className="league">{p.league_name || p.league}</span>
          {p.match_type && p.match_type !== "STANDARD" && <MatchTypeBadge matchType={p.match_type} />}
        </div>
        {/* #LIVE-1: in-play hint without a feed — only for viewers with NO feed. */}
        {scStatus === "live" || (!isPremium && !isFutureMarket(p.kickoff) && !isFinished && !hasScore) ? (
          <span className="when live"><span className="pulse" />{scStatus === "live" && live?.minute != null ? `${live.minute}'` : "LIVE"}</span>
        ) : (
          <span className="when">{fmtKickoff(p.kickoff, lang, tz, p.enrichment?.time_confirmed)}</span>
        )}
      </div>

      {/* fixture + scorebar (inset readout) */}
      <div className="fx">
        <div className="teams">{p.home_team}<span className="vs">v</span>{p.away_team}</div>
        {hasScore ? (
          <div className="scorebar">
            <span className={`stt${scStatus === "live" ? " live" : ""}`}>{scLabel}</span>
            <span className="sc">{live?.home_score ?? 0}<span className="x">–</span>{live?.away_score ?? 0}</span>
            <span className="grow" />
            {verdict && <span className={`verd ${verdict.correct ? "correct" : "wrong"}`}>{verdict.text}</span>}
          </div>
        ) : (
          <div className="scorebar">
            <span className="stt">{isFutureMarket(p.kickoff) ? "Kickoff" : pick5(lang, { it: "Programmato", en: "Scheduled", es: "Programado", fr: "Programmé", ru: "Запланирован" })}</span>
            <span className="sc sched">{fmtKickoff(p.kickoff, lang, tz, p.enrichment?.time_confirmed)}</span>
          </div>
        )}
      </div>
    </>
  );

  // ── readout riusabile (griglia + lead colonna sinistra modal) ──
  const readoutNode = (
    <>
      {/* model-vs-market readout / gate overlay */}
      {p.locked ? (
        <div className="lock-overlay" role="button" onClick={() => onGate?.()}>
          <span className="blurred">▒▒ HOME ▒▒▒%</span>
          <span className="blurred">▒▒ DRAW ▒▒▒%</span>
          <span className="blurred">▒▒ AWAY ▒▒▒%</span>
          <span className="locked-cta">{t.locked_title}</span>
        </div>
      ) : (
        <>
          <div
            className={`v2r${onSelect && isValueBet && p.best_selection ? " sel" : ""}`}
            onClick={onSelect && isValueBet && p.best_selection ? (ev) => { ev.stopPropagation(); handleSelect(); } : undefined}
          >
            <div className="v2r-l">
              <span className="v2r-eye">{isPreview ? "🔒 Pro" : pick5(lang, { it: "Il nostro pronostico", en: "Our prediction", es: "Nuestro pron\u00f3stico", fr: "Notre pronostic", ru: "\u041d\u0430\u0448 \u043f\u0440\u043e\u0433\u043d\u043e\u0437" })}</span>
              <span className="v2r-pick">{pickName ?? pick5(lang, { it: "Lettura modello", en: "Model read", es: "Lectura del modelo", fr: "Lecture du mod\u00e8le", ru: "\u0427\u0442\u0435\u043d\u0438\u0435 \u043c\u043e\u0434\u0435\u043b\u0438" })}</span>
              {!isPreview && confScore != null && (
                <span className="v2r-conf">{[0, 1, 2, 3].map((i) => <span key={i} className={`d${i < confDots ? " on" : ""}`} />)}{confLabel && <span className="v2r-conf-t">{confLabel}</span>}</span>
              )}
            </div>
            <div className="v2r-q">
              {isPreview ? (
                <span className="v2r-qn lock">🔒</span>
              ) : fpPickOdds != null ? (
                <>
                  <span className="v2r-qlab">{pick5(lang, { it: "Quota FortunePlay", en: "FortunePlay odds", es: "Cuota FortunePlay", fr: "Cote FortunePlay", ru: "\u041a\u043e\u044d\u0444. FortunePlay" })}</span>
                  <span className="v2r-qn">{fpPickOdds.toFixed(2)}</span>
                  <span className="v2r-sub">{pickProb != null ? `${pct(pickProb)} ` : ""}{pick5(lang, { it: "modello", en: "model", es: "modelo", fr: "mod\u00e8le", ru: "\u043c\u043e\u0434\u0435\u043b\u044c" })}{fpValue != null && fpValue > 0 ? <span className="v2r-val" title={pick5(lang, { it: "Value indicativo del modello rispetto alla quota FortunePlay. Non \u00e8 una garanzia di vincita. +18, gioca responsabilmente.", en: "Indicative model value vs the FortunePlay price. Not a guarantee of winning. 18+, play responsibly.", es: "Value indicativo del modelo frente a la cuota FortunePlay. No garantiza ganancias. +18, juega con responsabilidad.", fr: "Valeur indicative du mod\u00e8le par rapport \u00e0 la cote FortunePlay. Aucune garantie de gain. 18+, jouez de mani\u00e8re responsable.", ru: "\u041e\u0440\u0438\u0435\u043d\u0442\u0438\u0440\u043e\u0432\u043e\u0447\u043d\u0430\u044f \u0446\u0435\u043d\u043d\u043e\u0441\u0442\u044c. 18+" })}>value {(fpValue * 100).toFixed(1)}%</span> : null}</span>
                </>
              ) : (
                <>
                  <span className="v2r-qlab">{pick5(lang, { it: "probabilit\u00e0 modello", en: "model probability", es: "probabilidad del modelo", fr: "probabilit\u00e9 du mod\u00e8le", ru: "\u0432\u0435\u0440\u043e\u044f\u0442\u043d\u043e\u0441\u0442\u044c \u043c\u043e\u0434\u0435\u043b\u0438" })}</span>
                  <span className="v2r-qn">{pickProb != null ? pct(pickProb) : "\u2013"}</span>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  // ── corpo completo: vive SOLO nel modal (la griglia mostra solo la sintesi) ──
  const bodyNode = (
    <>
      {!p.locked && e.goals_summary && (
        <GoalsBlock summary={e.goals_summary} markets={e.extra_markets ?? []} lang={lang} />
      )}

      {!p.locked && e.goalscorer_markets && e.goalscorer_markets.length > 0 && (
        <GoalscorerBlock markets={e.goalscorer_markets} homeTeam={p.home_team} awayTeam={p.away_team} lang={lang} />
      )}

      {/* WHY — readout + expandable analysis (deep-analysis / schedina / affiliate live here) */}
      <div className="why">
        <details className="why-box">
          <summary className="why-lab">{pick5(lang, { it: "Perché", en: "Why", es: "Por qué", fr: "Pourquoi", ru: "Почему" })}<span className="why-caret" aria-hidden="true" /></summary>
          <p className="why-txt">
            {isPreview
              ? (lang === "it"
                  ? "Il ragionamento del modello e l'edge sono riservati al piano Pro. Sblocca per leggere perché il modello sceglie questo pronostico."
                  : "The model's reasoning and edge are reserved for the Pro plan. Unlock to read why the model makes this call.")
              : buildFootballWhy(p, lang)}
          </p>
          {!isPreview && (
            <button className="why-more" onClick={() => setShowWhy(!showWhy)}>
              {showWhy
                ? pick5(lang, { it: "Nascondi analisi", en: "Hide analysis", es: "Ocultar análisis", fr: "Masquer l'analyse", ru: "Скрыть анализ" })
                : pick5(lang, { it: "Leggi l'analisi completa", en: "Read full analysis", es: "Leer el análisis completo", fr: "Lire l'analyse complète", ru: "Читать полный анализ" })} <span className="ar">→</span>
            </button>
          )}
        </details>

        {/* footer action row */}
        <div className="act">
          {/* bet action: dropdown partner affiliati quando attivo (→ sito esterno),
              altrimenti vecchio CTA. FT → status note. */}
          {/* #PARTNER-REMOVE-0626: Place bet → link invito FortunePlay (via onBetNow). */}
          {!isPreview && onBetNow && (isFinished ? (
            <span className="ft-note">{pick5(lang, { it: "Terminata — in arrivo nello storico", en: "Full time — moving to history", es: "Finalizado — pasando al historial", fr: "Terminé — passe à l'historique", ru: "Матч окончен — переходит в историю" })}</span>
          ) : (
            <button className="betbtn" onClick={fp?.matchUrl ? () => window.open(fp.matchUrl, "_blank", "noopener,noreferrer") : onBetNow}>{t.bet_now}</button>
          ))}
          <span className="model">{pick5(lang, { it: "Modello calibrato", en: "Calibrated model", es: "Modelo calibrado", fr: "Modèle calibré", ru: "Калиброванная модель" })}</span>
          {isPreview || p.locked ? (
            <span className="gate">Pro</span>
          ) : isFinished ? (
            <span className="gate settled">{pick5(lang, { it: "Settlato", en: "Settled", es: "Liquidado", fr: "Réglé", ru: "Рассчитан" })}</span>
          ) : (
            <span className="gate">Pro</span>
          )}
        </div>

        {/* expandable analysis body */}
        {isPreview ? (
          <div className="nudge">
            <strong>{pick5(lang, { it: "Edge e analisi richiedono BetRedge Pro", en: "Edge and analysis require BetRedge Pro", es: "Edge y análisis requieren BetRedge Pro", fr: "Edge et analyse nécessitent BetRedge Pro", ru: "Edge и анализ доступны с BetRedge Pro" })}</strong>
            <em>{pick5(lang, { it: "Sblocca edge%, ragionamento AI e segnali con Pro (29.99 USDT/mese).", en: "Unlock edge%, AI reasoning and signals with Pro (29.99 USDT/month).", es: "Desbloquea edge%, razonamiento de IA y señales con Pro (29.99 USDT/mes).", fr: "Débloquez edge%, raisonnement IA et signaux avec Pro (29.99 USDT/mois).", ru: "Откройте edge%, ИИ-обоснование и сигналы с Pro (29.99 USDT/мес)." })}</em>
          </div>
        ) : showWhy && (
        <div className="why-body">
          {p.pick && (
            <p className="why-prose mono">Pick: <strong>{p.pick}</strong>{p.confidence_score != null ? ` · ${p.confidence_score}%` : ""}</p>
          )}

          {/* Schedina (extra markets) — demoted into the expansion */}
          {extraPicks.length > 0 && (
            <div className="extra-markets">
              <span className="extra-markets-label">{pick5(lang, { it: "Schedina", en: "Acca picks", es: "Combinada", fr: "Combiné", ru: "Экспресс" })}</span>
              {extraPicks.map((m) => {
                const strength = m.p >= 0.80 ? "high" : m.p >= 0.65 ? "mid" : "low";
                return (
                  <span key={m.key} className={`extra-market-pill ${strength}`}>
                    <span className="extra-market-name">{m.label}</span>
                    <span className="extra-market-pct">{Math.round(m.p * 100)}%</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Affiliate bonus CTA — demoted into the expansion */}
          {p.affiliate && (
            <a className="bonus-cta" href={p.affiliate.url} target="_blank" rel="nofollow sponsored noopener">
              {p.affiliate.bonus} · {p.affiliate.bookmaker} →
            </a>
          )}
          {p.pick_of_day && <span className="badge-potd">Pick of the Day</span>}

      {/* Deep Analysis — Premium only */}
      {isPremium && (
        <div className="deep-analysis-panel">
          <div className="da-header">
            <span className="da-badge">⚡ Pro</span>
            <span className="da-title">{pick5(lang, { it: "Analisi approfondita", en: "Deep Analysis", es: "Análisis profundo", fr: "Analyse approfondie", ru: "Глубокий анализ" })}</span>
          </div>
          {(e.xg_home != null || e.xg_away != null) && (
            <div className="da-row">
              <span className="da-label">{pick5(lang, { it: "Gol attesi", en: "Expected goals", es: "Goles esperados", fr: "Buts attendus", ru: "Ожидаемые голы" })}</span>
              <span className="da-value">{e.xg_home?.toFixed(2) ?? "–"} vs {e.xg_away?.toFixed(2) ?? "–"}</span>
            </div>
          )}
          {e.goals_summary && (
            <div className="da-row">
              <span className="da-label">{pick5(lang, { it: "Risultato probabile", en: "Likely result", es: "Resultado probable", fr: "Résultat probable", ru: "Вероятный счёт" })}</span>
              <span className="da-value">{e.goals_summary.band_low === e.goals_summary.band_high ? `${e.goals_summary.band_low}` : `${e.goals_summary.band_low}-${e.goals_summary.band_high}`} {pick5(lang, { it: "gol", en: "goals", es: "goles", fr: "buts", ru: "гола" })} ({Math.round(e.goals_summary.band_p * 100)}%)</span>
            </div>
          )}
          {(() => {
            const o25 = (e.extra_markets ?? []).find((m) => m.key === "over_2_5");
            return o25 ? (
              <div className="da-row">
                <span className="da-label">Over 2.5</span>
                <span className="da-value">{Math.round(o25.p * 100)}%</span>
              </div>
            ) : null;
          })()}
          {(e.form_home || e.form_away) && (
            <div className="da-row">
              <span className="da-label">{pick5(lang, { it: "Forma", en: "Form", es: "Forma", fr: "Forme", ru: "Форма" })}</span>
              <span className="da-value">{fmtFormAny(e.form_home) ?? "–"} vs {fmtFormAny(e.form_away) ?? "–"}</span>
            </div>
          )}
          {(() => {
            const ts = (e.goalscorer_markets ?? []).slice().sort((a, b) => b.pScores - a.pScores)[0];
            return ts ? (
              <div className="da-row">
                <span className="da-label">{pick5(lang, { it: "Marcatore top", en: "Top scorer", es: "Goleador top", fr: "Buteur n°1", ru: "Топ-бомбардир" })}</span>
                <span className="da-value">{ts.name} {Math.round(ts.pScores * 100)}%</span>
              </div>
            ) : null;
          })()}
          {(e.ppda_home != null || e.ppda_away != null) && (
            <div className="da-row">
              <span className="da-label">{pick5(lang, { it: "Pressing", en: "Pressing", es: "Presión", fr: "Pressing", ru: "Прессинг" })}</span>
              <span className="da-value">{e.ppda_home?.toFixed(1) ?? "–"} vs {e.ppda_away?.toFixed(1) ?? "–"}</span>
            </div>
          )}
          {/* World Cup context rows — real venue/squad/sample data */}
          {e.kind === "world_cup" && e.venue && (e.venue.travel_km_home != null || e.venue.travel_km_away != null) && (
            <div className="da-row">
              <span className="da-label">✈️ {pick5(lang, { it: "Trasferta", en: "Travel", es: "Viaje", fr: "Déplacement", ru: "Переезд" })}</span>
              <span className="da-value">{e.venue.travel_km_home != null ? `${Math.round(e.venue.travel_km_home).toLocaleString()} km` : "–"} vs {e.venue.travel_km_away != null ? `${Math.round(e.venue.travel_km_away).toLocaleString()} km` : "–"}</span>
            </div>
          )}
          {e.kind === "world_cup" && e.venue && (e.venue.rest_days_home != null || e.venue.rest_days_away != null) && (
            <div className="da-row">
              <span className="da-label">😴 {pick5(lang, { it: "Riposo", en: "Rest", es: "Descanso", fr: "Repos", ru: "Отдых" })}</span>
              <span className="da-value">{e.venue.rest_days_home ?? "–"} vs {e.venue.rest_days_away ?? "–"} {pick5(lang, { it: "giorni", en: "days", es: "días", fr: "jours", ru: "дней" })}</span>
            </div>
          )}
          {e.kind === "world_cup" && e.venue?.host_advantage && (
            <div className="da-row">
              <span className="da-label">🏟️ Host</span>
              <span className="da-value">{e.venue.host_advantage}</span>
            </div>
          )}
          {e.kind === "world_cup" && ((e.squad?.injuries_home?.length ?? 0) > 0 || (e.squad?.injuries_away?.length ?? 0) > 0) && (
            <div className="da-row">
              <span className="da-label">🚑 {pick5(lang, { it: "Infortuni rosa", en: "Squad injuries", es: "Lesiones plantilla", fr: "Blessures effectif", ru: "Травмы состава" })}</span>
              <span className="da-value">{e.squad?.injuries_home?.length ?? 0} vs {e.squad?.injuries_away?.length ?? 0}</span>
            </div>
          )}
          {e.kind === "world_cup" && e.matches && (e.matches.home != null || e.matches.away != null) && (
            <div className="da-row">
              <span className="da-label">🗃️ {pick5(lang, { it: "Campione", en: "Sample", es: "Muestra", fr: "Échantillon", ru: "Выборка" })}</span>
              <span className="da-value">{e.matches.home ?? "–"} vs {e.matches.away ?? "–"} {pick5(lang, { it: "partite", en: "matches", es: "partidos", fr: "matchs", ru: "матчей" })}</span>
            </div>
          )}
          {((e.injuries_home?.length ?? 0) > 0 || (e.injuries_away?.length ?? 0) > 0) && (
            <div className="da-row">
              <span className="da-label">🚑 {pick5(lang, { it: "Infortuni", en: "Injuries", es: "Lesiones", fr: "Blessures", ru: "Травмы" })}</span>
              <span className="da-value">H:{e.injuries_home?.length ?? 0} · A:{e.injuries_away?.length ?? 0}</span>
            </div>
          )}
          {e.weather && (
            <div className="da-row">
              <span className="da-label">{e.weather.icon} {pick5(lang, { it: "Meteo", en: "Weather", es: "Clima", fr: "Météo", ru: "Погода" })}</span>
              <span className="da-value">{e.weather.temp}°C · {e.weather.condition} · {e.weather.wind}km/h</span>
            </div>
          )}
          {(() => {
            const pk = p.best_selection;
            const pr = pk === "HOME" ? p.p_home : pk === "DRAW" ? p.p_draw : pk === "AWAY" ? p.p_away : null;
            const od = pk === "HOME" ? p.odds_home : pk === "DRAW" ? p.odds_draw : pk === "AWAY" ? p.odds_away : null;
            const mi = od && od > 0 ? 1 / od : null;
            if (pr == null || mi == null) return null;
            const ed = p.edge != null ? ` (${p.edge > 0 ? "+" : ""}${(p.edge * 100).toFixed(1)}%)` : "";
            return (
              <div className="da-row">
                <span className="da-label">{pick5(lang, { it: "Modello vs Mercato", en: "Model vs Market", es: "Modelo vs Mercado", fr: "Modèle vs Marché", ru: "Модель vs Рынок" })}</span>
                <span className="da-value">{Math.round(pr * 100)}% vs {Math.round(mi * 100)}%{ed}</span>
              </div>
            );
          })()}
          {e.extra_markets && e.extra_markets.some((m) => m.edge != null) && (
            <div className="da-row da-markets-row">
              <span className="da-label">{pick5(lang, { it: "Mercati", en: "Markets", es: "Mercados", fr: "Marchés", ru: "Рынки" })}</span>
              <div className="da-markets-list">
                {e.extra_markets.filter((m) => m.edge != null).slice(0, 4).map((m) => (
                  <span key={m.key} className={`da-market-pill${m.edge != null && m.edge > 0.02 ? " value" : ""}`}>
                    {m.label}{m.edge != null ? ` ${m.edge > 0 ? "+" : ""}${(m.edge * 100).toFixed(1)}%` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
          {e.research && (
            <div className="da-research">
              <span className="da-label">🤖 AI</span>
              <p className="da-research-text">{e.research}</p>
            </div>
          )}
        </div>
      )}

      {/* Deep Analysis locked teaser — Base users only (demoted into expansion) */}
      {!isPremium && (
        <div className="deep-analysis-locked">
          <span>⚡</span>
          <span>{pick5(lang, { it: "Analisi approfondita disponibile con BetRedge Pro (29.99 USDT/mese)", en: "Deep analysis available with BetRedge Pro (29.99 USDT/month)", es: "Análisis profundo disponible con BetRedge Pro (29.99 USDT/mes)", fr: "Analyse approfondie disponible avec BetRedge Pro (29.99 USDT/mois)", ru: "Глубокий анализ доступен с BetRedge Pro (29.99 USDT/мес)" })}</span>
        </div>
      )}
        </div>
        )}
      </div>
    </>
  );

  // Locked / preview: nessun modal (gate / niente da rivelare) → resta il layout
  // inline completo di prima, identico. Le card "vere" diventano una sintesi
  // compatta cliccabile che apre la scheda-dettaglio.
  if (!modalEnabled) {
    return (
      <article className="card"><div className="pred" {...cardProps}>
        {headerNode}
        {readoutNode}
        {bodyNode}
      </div></article>
    );
  }

  return (
    <>
      <article className="card"><div className="pred is-clickable" {...cardProps}>
        {headerNode}
        {readoutNode}
        <div className="pred-more" aria-hidden="true">
          <span className="pm-lab">{pick5(lang, { it: "Apri scheda completa", en: "Open full card", es: "Abrir ficha completa", fr: "Ouvrir la fiche complète", ru: "Открыть карточку" })}</span>
          <span className="pm-chev" />
        </div>
      </div></article>
      <PredictionDetailModal
        open={modalOpen}
        onClose={closeModal}
        anchorRect={modalRect}
        titleId={modalTitleId}
        lang={lang}
        title={<>{p.home_team} <span className="pdm-v">v</span> {p.away_team}</>}
        subtitle={p.league_name || p.league}
        hideHead
        hideExtraMarkets
      >
        <MatchDetailSheet data={mdsData} hideBookLinks={!onBetNow} />
      </PredictionDetailModal>
    </>
  );
}

// ─── Tennis Tab ───────────────────────────────────────────────────────────────

const SURFACE_META: Record<string, { label: string; color: string }> = {
  CLAY:  { label: "CLAY",  color: "text-orange-400 border-orange-400/40 bg-orange-400/10" },
  GRASS: { label: "GRASS", color: "text-green-400 border-green-400/40 bg-green-400/10" },
  HARD:  { label: "HARD",  color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
};


function TennisMatchCard({ m, fp, onSelect, onBetNow, isPreview, isPremium, onGate }: { m: TennisMatch; fp?: FpOddsEntry; onSelect?: (s: SlipSelection) => void; onBetNow?: () => void; isPreview?: boolean; isPremium?: boolean; onGate?: () => void }) {
  const [showWhy, setShowWhy] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const t = useT();
  const lang = useLang();
  const tz = useTz();
  const surface = SURFACE_META[m.surface] ?? { label: m.surface, color: "text-gray-400 border-gray-400/40 bg-gray-400/10" };

  const handleWhyClick = async () => {
    const next = !showWhy;
    setShowWhy(next);
    if (next && lang === "it" && !aiAnalysis && !loadingAnalysis) {
      setLoadingAnalysis(true);
      try {
        const res = await fetch("/api/tennis-analysis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ match_id: m.id }),
        });
        const data = await res.json() as { analysis?: string };
        if (data.analysis) setAiAnalysis(data.analysis);
      } catch {
        // keep Elo fallback
      } finally {
        setLoadingAnalysis(false);
      }
    }
  };
  const isValue = isTennisBestBet(m);
  const scheduledDate = fmtKickoff(m.scheduled, lang, tz);
  // Live ESPN score for this match (same treatment as the football card).
  const liveMatch = useLiveTennis()[tennisPairKey(m.player1, m.player2)];
  const liveIsFinal = !!liveMatch && /final|complete|ended|retir|walkover|w\/o/i.test(liveMatch.status_detail || "");
  const liveIsOn = !!liveMatch && !liveIsFinal;
  const liveOrient = liveMatch ? tennisLastName(liveMatch.player1) === tennisLastName(m.player1) : true;
  const liveSets1 = liveMatch ? (liveOrient ? liveMatch.sets_p1 : liveMatch.sets_p2) : [];
  const liveSets2 = liveMatch ? (liveOrient ? liveMatch.sets_p2 : liveMatch.sets_p1) : [];
  const liveSetsLabel = liveSets1.map((v, i) => `${v}-${liveSets2[i] ?? 0}`).join("  ");

  const handleSelect = (player: "P1" | "P2") => {
    if (!onSelect) return;
    const isP1 = player === "P1";
    const odds = isP1 ? m.odds_p1 : m.odds_p2;
    const probability = isP1 ? m.p1 : m.p2;
    const name = isP1 ? m.player1 : m.player2;
    // Signal-only rows (and locked projections) carry null odds at runtime
    // despite the type; mirror the football guard or SlipSelection.odds lies.
    if (odds == null || !Number.isFinite(probability)) return;
    const edgeForSel = m.best_selection === player ? m.edge : null;
    const confidence = confidenceFromEdge(edgeForSel, probability);
    onSelect({
      id: m.id,
      sport: "Tennis",
      event: `${m.player1} vs ${m.player2}`,
      league: m.tournament,
      kickoff: m.scheduled,
      market: "Match Winner",
      selection: name,
      odds,
      modelProbability: probability,
      edge: edgeForSel,
      confidence,
      recommendedStake: stakeFromEdge(edgeForSel, confidence),
    });
  };

  // Pick / verdict (presentation derived from the model's probabilities).
  const hasFavorite = m.p1 !== m.p2;
  const p1IsPick = hasFavorite && m.p1 > m.p2;
  // Scorebar state from the ESPN live feed.
  const scStatus = liveMatch ? (liveIsFinal ? "finished" : "live") : null;
  const scLabel = liveMatch ? (liveIsFinal ? "FT" : `LIVE`) : null;

  // ── Direction B readout (tennis): Market vs Model vs Edge ──
  // Mirror the football card: the SHOWN player must be the one the edge refers
  // to. `best_selection` is the agent's value pick (max-edge) and can be the
  // underdog — showing the model favourite next to that edge misattributes it
  // (and clicking the favourite then zeroed the edge in handleSelect).
  const valuePlayer: "P1" | "P2" | null =
    m.best_selection === "P1" || m.best_selection === "P2" ? m.best_selection : null;
  const favPlayer: "P1" | "P2" | null = hasFavorite ? (p1IsPick ? "P1" : "P2") : null;
  // Unified card structure (Andrea, 2026-06-20): always the readout, never bars —
  // even with no favourite (dead heat), show the model's higher-prob player with
  // NO edge claimed (FTC-honest).
  const topPlayer: "P1" | "P2" = m.p1 >= m.p2 ? "P1" : "P2";
  const pickPlayer: "P1" | "P2" = (isValue && valuePlayer) ? valuePlayer : (favPlayer ?? topPlayer);
  const pickName = pickPlayer === "P1" ? (m.player1.split(" ").pop() ?? m.player1)
    : pickPlayer === "P2" ? (m.player2.split(" ").pop() ?? m.player2) : null;
  const pickProb = pickPlayer === "P1" ? m.p1 : pickPlayer === "P2" ? m.p2 : null;
  const pickOdds = pickPlayer === "P1" ? m.odds_p1 : pickPlayer === "P2" ? m.odds_p2 : null;
  const marketImplied = pickOdds && pickOdds > 0 ? 1 / pickOdds : null;
  // Edge only when the shown player IS the value pick.
  const edgeVal = (isValue && pickPlayer === valuePlayer && m.edge != null && m.edge > 0) ? m.edge * 100 : null;
  const confScore = m.confidence_score ?? (pickProb != null ? confidenceFromEdge(m.edge, pickProb) : null);
  const confDots = confScore != null ? Math.max(1, Math.min(4, Math.round(confScore / 25))) : 0;
  const confLabel = confScore == null ? null
    : confScore >= 70 ? pick5(lang, { it: "alta", en: "high", es: "alta", fr: "élevée", ru: "высокая" })
    : confScore >= 45 ? pick5(lang, { it: "media", en: "medium", es: "media", fr: "moyenne", ru: "средняя" })
    : pick5(lang, { it: "bassa", en: "low", es: "baja", fr: "faible", ru: "низкая" });

  // #FORTUNEPLAY-LIVE-ODDS-1: quota live FortunePlay allineata al giocatore della
  // pick (per nome canonico) + value. Tennis = 2 vie, niente draw.
  const fpPickOdds: number | null = (() => {
    if (!fp || isPreview || m.locked) return null;
    const k = canonicalPlayerKey(pickPlayer === "P1" ? m.player1 : m.player2);
    if (k && k === fp.homeKey) return fp.oddsHome;
    if (k && k === fp.awayKey) return fp.oddsAway;
    return null;
  })();
  const fpValue = pickProb != null ? fpEdge(pickProb, fpPickOdds) : null;

  // #CARD-REDESIGN-V2: dati scheda info tennis (match-winner 2 vie, niente draw/gol/soft).
  const mdsData: MdsData = (() => {
    const fpq = (player: "P1" | "P2"): number | null => {
      if (!fp) return null;
      const k = canonicalPlayerKey(player === "P1" ? m.player1 : m.player2);
      if (k && k === fp.homeKey) return fp.oddsHome;
      if (k && k === fp.awayKey) return fp.oddsAway;
      return null;
    };
    const pv = (v: number | null) => (v != null && v > 0 ? `+${(v * 100).toFixed(0)}%` : null);
    const esito: Array<{ key: "P1" | "P2"; sel: string; prob: number }> = [
      { key: "P1", sel: m.player1, prob: m.p1 },
      { key: "P2", sel: m.player2, prob: m.p2 },
    ];
    const groups: MdsGroup[] = [{
      key: "esito", icon: "result", title: pick5(lang, { it: "Vincente match", en: "Match winner", es: "Ganador del partido", fr: "Vainqueur du match", ru: "Победитель матча" }),
      src: { kind: fp ? "fp" : "est", label: fp ? "FortunePlay" : pick5(lang, { it: "solo modello", en: "model only", es: "solo modelo", fr: "modèle seul", ru: "только модель" }) },
      chips: esito.map((o) => {
        const q = fpq(o.key);
        return { id: `esito-${o.key}`, mkt: pick5(lang, { it: "Vincente", en: "Winner", es: "Ganador", fr: "Vainqueur", ru: "Победитель" }), sel: o.sel, prob: o.prob != null ? pct(o.prob) : null, q, value: q != null ? pv(fpEdge(o.prob, q)) : null, rec: pickPlayer === o.key };
      }),
    }];
    return {
      league: m.tournament,
      when: fmtKickoff(m.scheduled, lang, tz),
      home: m.player1, away: m.player2,
      hero: {
        flag: pick5(lang, { it: "La nostra prediction", en: "Our prediction", es: "Nuestro pronóstico", fr: "Notre pronostic", ru: "Наш прогноз" }),
        pick: pickName ? `${pickName} ${pick5(lang, { it: "vince", en: "to win", es: "gana", fr: "gagne", ru: "победа" })}` : pick5(lang, { it: "Lettura modello", en: "Model read", es: "Lectura del modelo", fr: "Lecture du modèle", ru: "Чтение модели" }),
        read: `${pickProb != null ? pct(pickProb) + " " : ""}${pick5(lang, { it: "modello", en: "model", es: "modelo", fr: "modèle", ru: "модель" })}${confLabel ? ` · ${pick5(lang, { it: "conf.", en: "conf.", es: "conf.", fr: "conf.", ru: "увер." })} ${confLabel}` : ""}`,
        confDots,
        quotaLabel: pick5(lang, { it: "Quota FortunePlay", en: "FortunePlay odds", es: "Cuota FortunePlay", fr: "Cote FortunePlay", ru: "Коэф. FortunePlay" }),
        quota: fpPickOdds != null ? fpPickOdds.toFixed(2) : null,
        value: fpValue != null && fpValue > 0 ? `value ${(fpValue * 100).toFixed(1)}%` : null,
      },
      groups,
      matchUrl: fp?.matchUrl || FORTUNEPLAY_BET_URL,
      fpMatchId: fp?.id ?? null,
      books: fp?.books?.map((b) => ({ name: b.name, matchUrl: b.matchUrl })),
      moreLabel: pick5(lang, { it: "Altri mercati FortunePlay", en: "More FortunePlay markets", es: "Más mercados FortunePlay", fr: "Plus de marchés FortunePlay", ru: "Ещё рынки FortunePlay" }),
      labels: {
        schedina: pick5(lang, { it: "La tua schedina", en: "Your betslip", es: "Tu boleto", fr: "Votre coupon", ru: "Ваш купон" }),
        quotaComb: pick5(lang, { it: "quota combinata", en: "combined odds", es: "cuota combinada", fr: "cote combinée", ru: "комбо кэф" }),
        quotaOne: pick5(lang, { it: "quota", en: "odds", es: "cuota", fr: "cote", ru: "кэф" }),
        touch: pick5(lang, { it: "tocca i mercati", en: "tap the markets", es: "toca los mercados", fr: "touchez les marchés", ru: "выберите рынки" }),
        apri: pick5(lang, { it: "Apri su FortunePlay", en: "Open on FortunePlay", es: "Abrir en FortunePlay", fr: "Ouvrir sur FortunePlay", ru: "Открыть на FortunePlay" }),
        apriMulti: pick5(lang, { it: "Apri la multipla su FortunePlay", en: "Open the accumulator on FortunePlay", es: "Abrir la combinada en FortunePlay", fr: "Ouvrir le combiné sur FortunePlay", ru: "Открыть экспресс на FortunePlay" }),
        openBook: pick5(lang, { it: "Apri su {book}", en: "Open on {book}", es: "Abrir en {book}", fr: "Ouvrir sur {book}", ru: "Открыть на {book}" }),
        disc: pick5(lang, { it: "Value indicativo del modello vs quota FortunePlay — non è garanzia di vincita. +18 · gioca responsabilmente.", en: "Indicative model value vs FortunePlay odds — not a guarantee of winning. 18+ · play responsibly.", es: "Value indicativo del modelo vs cuota FortunePlay — no garantiza ganancias. +18 · juega con responsabilidad.", fr: "Valeur indicative du modèle vs cote FortunePlay — aucune garantie de gain. 18+ · jouez responsable.", ru: "Ориентировочная ценность vs кэф FortunePlay — не гарантия выигрыша. 18+" }),
        side: pick5(lang, { it: "Schedina composta lato BetRedge → il bottone apre la partita su FortunePlay.", en: "Betslip composed on BetRedge → the button opens the match on FortunePlay.", es: "Boleto compuesto en BetRedge → el botón abre el partido en FortunePlay.", fr: "Coupon composé sur BetRedge → le bouton ouvre le match sur FortunePlay.", ru: "Купон собран в BetRedge → кнопка открывает матч на FortunePlay." }),
        selOne: pick5(lang, { it: "1 selezione", en: "1 selection", es: "1 selección", fr: "1 sélection", ru: "1 выбор" }),
        selMany: pick5(lang, { it: "{n} selezioni", en: "{n} selections", es: "{n} selecciones", fr: "{n} sélections", ru: "{n} выборов" }),
      },
    };
  })();

  // Detail modal (stesso shell del calcio). Locked/preview restano inline.
  const modalEnabled = !m.locked && !isPreview;
  const { open: modalOpen, rect: modalRect, close: closeModal, cardProps } = useDetailModal(modalEnabled);
  const modalTitleId = `pdm-t-${m.id}`;

  const headerNode = (
    <>
      {/* top: surface glyph + tournament + when */}
      <div className="top">
        <div className="comp">
          <SportIcon sport="tennis" size={15} className="sgi" variant="sm" />
          <span className="league">{m.tournament}</span>
          {m.round && <span className="rnd">{m.round}</span>}
        </div>
        {liveIsOn ? (
          <span className="when live"><span className="pulse" />live</span>
        ) : (
          <span className="when">{scheduledDate}</span>
        )}
      </div>

      {/* fixture + scorebar */}
      <div className="fx">
        <div className="teams">{m.player1}<span className="vs">v</span>{m.player2}</div>
        {liveMatch ? (
          <div className="scorebar">
            <span className={`stt${scStatus === "live" ? " live" : ""}`}>{scLabel}</span>
            <span className="sc">{liveSetsLabel || "0-0"}</span>
            <span className="grow" />
            {liveMatch.status_detail && <span className="verd">{liveMatch.status_detail}</span>}
          </div>
        ) : (
          <div className="scorebar">
            <span className="stt">{pick5(lang, { it: "Programmato", en: "Scheduled", es: "Programado", fr: "Programmé", ru: "Запланирован" })}</span>
            <span className="sc sched">{scheduledDate} · {surface.label}</span>
          </div>
        )}
      </div>
    </>
  );

  const readoutNode = (
    <>
      {/* verdict line + rows / gate overlay */}
      {m.locked ? (
        <div className="lock-overlay" role="button" onClick={() => onGate?.()}>
          <span className="blurred">▒▒▒▒▒▒▒▒ ▒▒▒%</span>
          <span className="blurred">▒▒▒▒▒▒▒▒ ▒▒▒%</span>
          <span className="locked-cta">{t.locked_title}</span>
        </div>
      ) : (
        <>
          <div
            className={`v2r${onSelect && isValue && pickPlayer ? " sel" : ""}`}
            onClick={onSelect && isValue && pickPlayer ? (ev) => { ev.stopPropagation(); handleSelect(pickPlayer as "P1" | "P2"); } : undefined}
          >
            <div className="v2r-l">
              <span className="v2r-eye">{isPreview ? "🔒 Pro" : pick5(lang, { it: "Il nostro pronostico", en: "Our prediction", es: "Nuestro pron\u00f3stico", fr: "Notre pronostic", ru: "\u041d\u0430\u0448 \u043f\u0440\u043e\u0433\u043d\u043e\u0437" })}</span>
              <span className="v2r-pick">{pickName ?? pick5(lang, { it: "Lettura modello", en: "Model read", es: "Lectura del modelo", fr: "Lecture du mod\u00e8le", ru: "\u0427\u0442\u0435\u043d\u0438\u0435 \u043c\u043e\u0434\u0435\u043b\u0438" })}</span>
              {!isPreview && confScore != null && (
                <span className="v2r-conf">{[0, 1, 2, 3].map((i) => <span key={i} className={`d${i < confDots ? " on" : ""}`} />)}{confLabel && <span className="v2r-conf-t">{confLabel}</span>}</span>
              )}
            </div>
            <div className="v2r-q">
              {isPreview ? (
                <span className="v2r-qn lock">🔒</span>
              ) : fpPickOdds != null ? (
                <>
                  <span className="v2r-qlab">{pick5(lang, { it: "Quota FortunePlay", en: "FortunePlay odds", es: "Cuota FortunePlay", fr: "Cote FortunePlay", ru: "\u041a\u043e\u044d\u0444. FortunePlay" })}</span>
                  <span className="v2r-qn">{fpPickOdds.toFixed(2)}</span>
                  <span className="v2r-sub">{pickProb != null ? `${pct(pickProb)} ` : ""}{pick5(lang, { it: "modello", en: "model", es: "modelo", fr: "mod\u00e8le", ru: "\u043c\u043e\u0434\u0435\u043b\u044c" })}{fpValue != null && fpValue > 0 ? <span className="v2r-val" title={pick5(lang, { it: "Value indicativo del modello rispetto alla quota FortunePlay. Non \u00e8 una garanzia di vincita. +18, gioca responsabilmente.", en: "Indicative model value vs the FortunePlay price. Not a guarantee of winning. 18+, play responsibly.", es: "Value indicativo del modelo frente a la cuota FortunePlay. No garantiza ganancias. +18, juega con responsabilidad.", fr: "Valeur indicative du mod\u00e8le par rapport \u00e0 la cote FortunePlay. Aucune garantie de gain. 18+, jouez de mani\u00e8re responsable.", ru: "\u041e\u0440\u0438\u0435\u043d\u0442\u0438\u0440\u043e\u0432\u043e\u0447\u043d\u0430\u044f \u0446\u0435\u043d\u043d\u043e\u0441\u0442\u044c. 18+" })}>value {(fpValue * 100).toFixed(1)}%</span> : null}</span>
                </>
              ) : (
                <>
                  <span className="v2r-qlab">{pick5(lang, { it: "probabilit\u00e0 modello", en: "model probability", es: "probabilidad del modelo", fr: "probabilit\u00e9 du mod\u00e8le", ru: "\u0432\u0435\u0440\u043e\u044f\u0442\u043d\u043e\u0441\u0442\u044c \u043c\u043e\u0434\u0435\u043b\u0438" })}</span>
                  <span className="v2r-qn">{pickProb != null ? pct(pickProb) : "\u2013"}</span>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  const bodyNode = (
    <>
      {/* WHY — Elo readout + expandable analysis */}
      <div className="why">
        <details className="why-box">
          <summary className="why-lab">{pick5(lang, { it: "Perché", en: "Why", es: "Por qué", fr: "Pourquoi", ru: "Почему" })}<span className="why-caret" aria-hidden="true" /></summary>
          <p className="why-txt">
            {isPreview
              ? (lang === "it"
                  ? "Il ragionamento del modello e l'edge sono riservati al piano Pro. Sblocca per leggere perché il modello sceglie questo pronostico."
                  : "The model's reasoning and edge are reserved for the Pro plan. Unlock to read why the model makes this call.")
              : buildTennisWhy(m, lang)}
          </p>
          {!isPreview && (
            <button className="why-more" onClick={handleWhyClick}>
              {loadingAnalysis
                ? pick5(lang, { it: "Carico l'analisi…", en: "Loading analysis…", es: "Cargando análisis…", fr: "Chargement de l'analyse…", ru: "Загрузка анализа…" })
                : showWhy
                  ? pick5(lang, { it: "Nascondi analisi", en: "Hide analysis", es: "Ocultar análisis", fr: "Masquer l'analyse", ru: "Скрыть анализ" })
                  : pick5(lang, { it: "Leggi l'analisi completa", en: "Read full analysis", es: "Leer el análisis completo", fr: "Lire l'analyse complète", ru: "Читать полный анализ" })} <span className="ar">→</span>
            </button>
          )}
        </details>

        {/* footer action row */}
        <div className="act">
          {/* #PARTNER-REMOVE-0626: Place bet → link invito FortunePlay (via onBetNow). */}
          {!isPreview && onBetNow && (liveIsFinal ? (
            <span className="ft-note">{pick5(lang, { it: "Terminata — in arrivo nello storico", en: "Full time — moving to history", es: "Finalizado — pasando al historial", fr: "Terminé — passe à l'historique", ru: "Матч окончен — переходит в историю" })}</span>
          ) : (
            <button className="betbtn" onClick={fp?.matchUrl ? () => window.open(fp.matchUrl, "_blank", "noopener,noreferrer") : onBetNow}>{t.bet_now}</button>
          ))}
          <span className="model">{pick5(lang, { it: "Modello calibrato", en: "Calibrated model", es: "Modelo calibrado", fr: "Modèle calibré", ru: "Калиброванная модель" })}</span>
          <span className="gate">Pro</span>
        </div>

        {/* expandable analysis body */}
        {isPreview ? (
          <div className="nudge">
            <strong>{pick5(lang, { it: "Edge e analisi richiedono BetRedge Pro", en: "Edge and analysis require BetRedge Pro", es: "Edge y análisis requieren BetRedge Pro", fr: "Edge et analyse nécessitent BetRedge Pro", ru: "Edge и анализ доступны с BetRedge Pro" })}</strong>
            <em>{pick5(lang, { it: "Sblocca edge%, analisi del modello e segnali tennis con Pro (29.99 USDT/mese).", en: "Unlock edge%, model analysis and tennis signals with Pro (29.99 USDT/month).", es: "Desbloquea edge%, análisis del modelo y señales de tenis con Pro (29.99 USDT/mes).", fr: "Débloquez edge%, analyse du modèle et signaux tennis avec Pro (29.99 USDT/mois).", ru: "Откройте edge%, анализ модели и теннисные сигналы с Pro (29.99 USDT/мес)." })}</em>
          </div>
        ) : showWhy && (
        <div className="why-body">
          {/* AI analysis — shown first when available */}
          {aiAnalysis && lang === "it" ? (
            <>
              <div className="wlab"><span>🤖</span> {t.tennis_ai_label}</div>
              <p className="why-prose mono">{aiAnalysis}</p>
            </>
          ) : loadingAnalysis ? (
            <p className="why-prose">{t.tennis_ai_loading}</p>
          ) : null}

          {m.pick && (
            <p className="why-prose mono">Pick: <strong>{m.pick}</strong>{m.confidence_score != null ? ` · ${m.confidence_score}%` : ""}</p>
          )}

          {/* Affiliate bonus CTA + pick-of-day — demoted into the expansion */}
          {m.affiliate && (
            <a className="bonus-cta" href={m.affiliate.url} target="_blank" rel="nofollow sponsored noopener">
              {m.affiliate.bonus} · {m.affiliate.bookmaker} →
            </a>
          )}
          {m.pick_of_day && <span className="badge-potd">Pick of the Day</span>}

      {/* Deep Analysis — Premium only */}
      {isPremium && (
        <div className="deep-analysis-panel">
          <div className="da-header">
            <span className="da-badge">⚡ Pro</span>
            <span className="da-title">{pick5(lang, { it: "Analisi del modello", en: "Model analysis", es: "Análisis del modelo", fr: "Analyse du modèle", ru: "Анализ модели" })}</span>
          </div>
          <div className="da-row">
            <span className="da-label">{pick5(lang, { it: "Forza sulla superficie", en: "Strength on this surface", es: "Fuerza en esta superficie", fr: "Niveau sur cette surface", ru: "Сила на этом покрытии" })}</span>
            <span className="da-value">{m.elo_p1?.toFixed(0) ?? "–"} vs {m.elo_p2?.toFixed(0) ?? "–"}</span>
          </div>
          {(m.elo_p1_overall != null || m.elo_p2_overall != null) && (
            <div className="da-row">
              <span className="da-label">{pick5(lang, { it: "Forza generale", en: "Overall strength", es: "Fuerza general", fr: "Niveau général", ru: "Общая сила" })}</span>
              <span className="da-value">{m.elo_p1_overall?.toFixed(0) ?? "–"} vs {m.elo_p2_overall?.toFixed(0) ?? "–"}</span>
            </div>
          )}
          {(m.surface_matches_p1 != null || m.surface_matches_p2 != null) && (
            <div className="da-row">
              <span className="da-label">{pick5(lang, { it: "Match su questa superficie", en: "Matches on this surface", es: "Partidos en esta superficie", fr: "Matchs sur cette surface", ru: "Матчи на покрытии" })}</span>
              <span className="da-value">{m.surface_matches_p1 ?? "–"} vs {m.surface_matches_p2 ?? "–"}</span>
            </div>
          )}
          {(m.elo_raw_p1 != null || m.elo_raw_p2 != null) && (
            <div className="da-row">
              <span className="da-label">{pick5(lang, { it: "Probabilità modello", en: "Model probability", es: "Probabilidad del modelo", fr: "Probabilité du modèle", ru: "Вероятность модели" })}</span>
              <span className="da-value">{m.elo_raw_p1 != null ? `${Math.round(m.elo_raw_p1 * 100)}%` : "–"} vs {m.elo_raw_p2 != null ? `${Math.round(m.elo_raw_p2 * 100)}%` : "–"}</span>
            </div>
          )}
          {(m.h2h_p1_wins != null || m.h2h_p2_wins != null) && (
            <div className="da-row">
              <span className="da-label">{pick5(lang, { it: "Testa a testa", en: "Head-to-head", es: "Cara a cara", fr: "Confrontations", ru: "Личные встречи" })}</span>
              <span className="da-value">{m.h2h_p1_wins ?? 0}–{m.h2h_p2_wins ?? 0}</span>
            </div>
          )}
        </div>
      )}

      {/* Deep Analysis locked teaser — Base users only (demoted into expansion) */}
      {!isPremium && (
        <div className="deep-analysis-locked">
          <span>⚡</span>
          <span>{pick5(lang, { it: "Analisi approfondita del modello disponibile con BetRedge Pro (29.99 USDT/mese)", en: "Deep model analysis available with BetRedge Pro (29.99 USDT/month)", es: "Análisis profundo del modelo disponible con BetRedge Pro (29.99 USDT/mes)", fr: "Analyse approfondie du modèle disponible avec BetRedge Pro (29.99 USDT/mois)", ru: "Глубокий анализ модели доступен с BetRedge Pro (29.99 USDT/мес)" })}</span>
        </div>
      )}
        </div>
        )}
      </div>
    </>
  );

  if (!modalEnabled) {
    return (
      <article className="card tennis"><div className="pred tennis" {...cardProps}>
        {headerNode}
        {readoutNode}
        {bodyNode}
      </div></article>
    );
  }

  return (
    <>
      <article className="card tennis"><div className="pred tennis is-clickable" {...cardProps}>
        {headerNode}
        {readoutNode}
        <div className="pred-more" aria-hidden="true">
          <span className="pm-lab">{pick5(lang, { it: "Apri scheda completa", en: "Open full card", es: "Abrir ficha completa", fr: "Ouvrir la fiche complète", ru: "Открыть карточку" })}</span>
          <span className="pm-chev" />
        </div>
      </div></article>
      <PredictionDetailModal
        open={modalOpen}
        onClose={closeModal}
        anchorRect={modalRect}
        titleId={modalTitleId}
        lang={lang}
        title={<>{m.player1} <span className="pdm-v">v</span> {m.player2}</>}
        subtitle={<>{m.tournament}{m.round ? ` · ${m.round}` : ""} · {surface.label}</>}
        hideHead
        hideExtraMarkets
      >
        <MatchDetailSheet data={mdsData} hideBookLinks={!onBetNow} />
      </PredictionDetailModal>
    </>
  );
}


// ─── Agent Status Tab ─────────────────────────────────────────────────────────

function AgentStatusTab({ agents }: { agents: AgentStatus[] }) {
  const t = useT();
  const AGENT_ROLES: Record<string, string> = {
    // Football
    DataCollector:          "Fetches fixtures, odds, history from all data sources",
    ModelAgent:             "Runs Dixon-Coles Poisson model + League & Match Context Module",
    AnalystAgent:           "Identifies value bets by comparing model vs market odds",
    StrategistAgent:        "Evaluates opportunities, assigns conviction score 0-10",
    RiskManagerAgent:       "Kelly sizing, exposure limits, drawdown circuit breaker",
    TraderAgent:            "Executes approved football orders on the exchange (live)",
    MonitorAgent:           "Heartbeat monitoring, PSI drift detection, Telegram alerts",
    ResearchAgent:          "Generates AI match analysis via Ollama local LLM",
    AHCollectorAgent:       "Asian Handicap odds from Pinnacle/SBOBet",
    ResultSettlementAgent:  "Polls settled football markets, updates bet P&L",
    // Tennis
    TennisDataCollectorAgent: "Tennis markets · 5-min polling cycle",
    TennisModelAgent:         "Elo Surface v2 · clay/grass/hard · 2,966 players bootstrapped",
    TennisAnalystAgent:       "Value edge detection · 4% threshold · market comparison",
    TennisRiskManagerAgent:   "Quarter-Kelly sizing · 20% bankroll cap · drawdown gate",
    TennisTraderAgent:        "Paper bets · Neon DB · exchange dedup guard",
    TennisSettlementAgent:    "CLOSED market → winner → Elo.update() → P&L settlement loop",
  };

  const anyOnline = agents.some((a) => a.status !== "offline");

  return (
    <div className="space-y-4">
      <div className="am-surface p-4">
        <div className="text-xs font-mono text-[var(--am-muted)] space-y-1 leading-relaxed">
          <div className="text-[var(--am-coral)] font-bold mb-2">{t.agent_arch_title}</div>
          <div>
            <span className="text-[var(--am-text)]">{t.agent_arch_dashboard_title}</span> — {t.agent_arch_dashboard_desc}
          </div>
          <div>
            <span className="text-[var(--am-text)]">{t.agent_arch_agents_title}</span> — {t.agent_arch_agents_desc} <code className="text-[var(--am-coral)]">python run.py</code>.
          </div>
          {!anyOnline && (
            <div className="mt-2 text-[var(--am-negative)] border border-[var(--am-negative-b)] rounded px-2 py-1">
              {t.agent_arch_none} <code>python run.py</code> {t.agent_arch_none_suffix}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.name} className="am-surface p-4 space-y-2" style={{
            borderColor: agent.status === "alive" ? "var(--am-positive-b)" :
              agent.status === "stale" ? "var(--am-line-2)" : "var(--am-negative-b)"
          }}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[var(--am-text)] font-mono">{agent.name}</span>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${agent.status === "alive" ? "animate-pulse" : ""}`} style={{
                  background: agent.status === "alive" ? "var(--am-positive)" :
                    agent.status === "stale" ? "var(--am-muted-2)" : "var(--am-negative)"
                }} />
                <span className="text-xs font-mono" style={{
                  color: agent.status === "alive" ? "var(--am-positive)" :
                    agent.status === "stale" ? "var(--am-muted-2)" : "var(--am-negative)"
                }}>
                  {agent.status.toUpperCase()}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--am-muted-2)] font-mono leading-relaxed">
              {AGENT_ROLES[agent.name] ?? "Multi-agent system component"}
            </p>
            <div className="text-[10px] text-[var(--am-muted-2)] font-mono">
              {agent.last_seen ? `${t.agent_last_seen}: ${timeAgo(agent.last_seen)}` : t.agent_no_heartbeat}
              {agent.age_seconds != null && ` (${agent.age_seconds}s ago)`}
            </div>
          </div>
        ))}
      </div>

      <div className="am-surface p-4">
        <h3 className="text-xs font-mono text-[var(--am-coral)] uppercase tracking-wider mb-3">Pipeline Flow · 16 Agents</h3>
        <div className="text-[10px] text-[var(--am-muted-2)] font-mono mb-1 uppercase tracking-wider">⚽ Football</div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--am-muted)]">
          {[
            "DataCollector", "→", "ModelAgent", "→", "ContextService", "→",
            "AnalystAgent", "→", "StrategistAgent", "→", "RiskManagerAgent", "→", "TraderAgent", "→", "ResultSettlement",
          ].map((item, i) => (
            <span key={i} className={
              item === "→" ? "text-[var(--am-muted-2)]" : "text-[var(--am-text)]"
            }>{item}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--am-muted)] mt-1">
          {["AHCollectorAgent", "→", "AH Odds", "·", "ResearchAgent", "→", "AI Summaries", "·", "MonitorAgent", "→", "Alerts + PSI"].map((item, i) => (
            <span key={i} className={["→", "·"].includes(item) ? "text-[var(--am-muted-2)]" : "text-[var(--am-text)]"}>{item}</span>
          ))}
        </div>
        <div className="text-[10px] text-[var(--am-muted-2)] font-mono mb-1 mt-3 uppercase tracking-wider">🎾 Tennis</div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--am-muted)]">
          {[
            "TennisDataCollector", "→", "TennisModel", "→", "TennisAnalyst", "→",
            "TennisRiskManager", "→", "TennisTrader", "→", "TennisSettlement",
          ].map((item, i) => (
            <span key={i} className={item === "→" ? "text-[var(--am-muted-2)]" : "text-[var(--am-text)]"}>{item}</span>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-[var(--am-muted-2)] font-mono">
          ContextService v5.0: LeagueStrengthAnalyzer · LeagueOddsProfiler · LeaguePredictabilityTracker · MatchTypeClassifier · CompetitionTypeFactors
        </div>
      </div>
    </div>
  );
}

function ClientStatusTab({
  agents,
  bets,
  tennisSummary,
  computedAt,
  tennisComputedAt,
}: {
  agents: AgentStatus[];
  bets: Bet[];
  tennisSummary: TennisSummary | null;
  computedAt: string | null;
  tennisComputedAt: string | null;
}) {
  const footballAgents = agents.filter((a) => !a.name.startsWith("Tennis"));
  const tennisAgents = agents.filter((a) => a.name.startsWith("Tennis"));
  const footballAlive = footballAgents.filter((a) => a.status === "alive").length;
  const tennisAlive = tennisAgents.filter((a) => a.status === "alive").length;
  const confirmedLive = bets.filter((b) => !b.paper).length;
  const blocked = bets.filter((b) => FAILED_STATUSES.includes(b.status)).length;

  const rows = [
    {
      title: "Football execution",
      value: footballAgents.length ? `${footballAlive}/${footballAgents.length} online` : "checking",
      detail: "Live orders are valid only when the exchange confirms a bet ID.",
      tone: footballAlive === footballAgents.length && footballAgents.length > 0 ? "good" : "warn",
    },
    {
      title: "Tennis signal layer",
      value: tennisAgents.length ? `${tennisAlive}/${tennisAgents.length} active` : "active signal",
      detail: `${tennisSummary?.value_bets ?? 0} value signals from ${tennisSummary?.markets_active ?? 0} active markets.`,
      tone: "good",
    },
    {
      title: "Execution audit",
      value: `${confirmedLive} confirmed`,
      detail: blocked ? `${blocked} orders blocked or rejected safely.` : "Every live bet must have a confirmed bet ID.",
      tone: blocked ? "warn" : "good",
    },
    {
      title: "Data freshness",
      value: computedAt ? timeAgo(computedAt) : "syncing",
      detail: tennisComputedAt ? `Tennis updated ${timeAgo(tennisComputedAt)}.` : "Tennis database fallback is enabled.",
      tone: "neutral",
    },
  ];

  return (
    <div className="client-status">
      <section className="client-callout">
        <div>
          <p className="eyebrow">Client status</p>
          <h3>Only decision-critical health is shown here.</h3>
        </div>
        <p>
          The desk hides internal agent noise and surfaces four client questions:
          can we trade, are signals fresh, did the exchange confirm, and what is blocked for safety.
        </p>
      </section>

      <section className="client-status-grid">
        {rows.map((row) => (
          <article key={row.title} className={`client-status-card ${row.tone}`}>
            <span>{row.title}</span>
            <strong>{row.value}</strong>
            <em>{row.detail}</em>
          </article>
        ))}
      </section>

      <section className="client-system-list">
        <div>
          <strong>Client sees</strong>
          <span>Market board, bet slip, active bets, settled history, execution confirmation.</span>
        </div>
        <div>
          <strong>Client does not need</strong>
          <span>Python process names, internal pipeline steps, optimizer jargon, raw heartbeat spam.</span>
        </div>
      </section>
    </div>
  );
}

// ─── Bets Tab ─────────────────────────────────────────────────────────────────

const FAILED_STATUSES = ["execution_rejected", "expired_unconfirmed", "cancelled"];


// ─── Match Builder Tab (#MB-1, influencer tool) ──────────────────────────────
//
// L'influencer (loggato) seleziona 2–5 predizioni, vede il moltiplicatore
// combinato e genera un link /app?mb=id1,id2&ref=CODICE. Il visitatore che apre
// il link trova la schedina precaricata: i pick/quote restano gated per gli
// anonimi (projection server-side), quindi il link è esso stesso il funnel.
// Onestà quote: le selezioni senza mercato reale usano le FAIR ODDS del
// modello, etichettate FAIR e mai spacciate per quote bancabili.

interface MbItem {
  id: string;
  label: string;
  market: string;
  sport: string;
  when: string;
  // Probabilità del pick secondo il nostro sistema (0-1). Decisione Andrea
  // 2026-06-07: il builder mostra il "più quotato dal sistema" come
  // percentuale modello, MAI come quota — coerente col prodotto
  // (probabilità calibrate, non promesse di edge).
  prob: number;
}

interface MbWcRow {
  id?: string | number;
  home_team?: string | null;
  away_team?: string | null;
  starts_at?: string;
  pick?: string | null;
  odds?: number | null;
  fair_odds?: number | null;
  locked?: boolean;
}

function MatchBuilderTab({
  predictions, tennisMatches, onRegister, isLoggedIn, sharedIds = [], refCode = "",
  isUnlocked = false, isPremium = false, onUnlock, loading = false,
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  onRegister: () => void;
  isLoggedIn: boolean;
  sharedIds?: string[];
  refCode?: string;
  // Plan gate: Free/anon see the builder behind a LockedGate (upsell); Base
  // sees the 3 strongest signals; Premium/admin see every signal.
  isUnlocked?: boolean;
  isPremium?: boolean;
  onUnlock?: () => void;
  // Parent board still fetching predictions: distinguishes "loading" from the
  // genuine "no signals" empty state (#MB-FIX #4).
  loading?: boolean;
}) {
  const lang = useLang();
  const [selected, setSelected] = useState<string[]>(sharedIds);
  const [influencerCode, setInfluencerCode] = useState(refCode);
  const [copied, setCopied] = useState(false);
  // World Cup rows live only in /world-cup (#BOARD-WC-SPLIT) — the builder
  // fetches them from the v2 API directly (projected per-session like the WC tab).
  const [wcRows, setWcRows] = useState<MbWcRow[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/v2/predictions?competition=World Cup&sport=football", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive) setWcRows(Array.isArray(d?.predictions) ? d.predictions : []); })
      .catch(() => { /* WC feed down: builder still works on board signals */ });
    return () => { alive = false; };
  }, []);

  const copy = pick5(lang, {
    it: {
      eyebrow: "Strumento influencer", title: "Match Builder",
      subtitle: "Costruisci una schedina con le predizioni AI e condividi il link con i tuoi follower.",
      selectTitle: "Seleziona le predizioni (2–5)", selectedLabel: "Selezionate",
      combinedProb: "Probabilità combinata (modello)",
      yourCode: "Il tuo codice influencer (es. MARIO10)", copyLink: "Copia e pubblica link", copied: "Copiato ✓",
      published: "Pubblicata su Creator Picks ✓",
      sharedTitle: "Schedina condivisa", sharedDesc: "Un creator ha costruito questa schedina per te.",
      sharedBy: "Codice creator", registerCta: "Registrati gratis per vedere i pick",
      noSignals: "Nessuna predizione disponibile al momento.",
      empty: "Seleziona almeno 2 predizioni per generare il link.",
    },
    en: {
      eyebrow: "Influencer tool", title: "Match Builder",
      subtitle: "Build an accumulator from AI predictions and share the link with your followers.",
      selectTitle: "Select predictions (2–5)", selectedLabel: "Selected",
      combinedProb: "Combined probability (model)",
      yourCode: "Your influencer code (e.g. JOHN10)", copyLink: "Copy & publish link", copied: "Copied ✓",
      published: "Published to Creator Picks ✓",
      sharedTitle: "Shared accumulator", sharedDesc: "A creator built this accumulator for you.",
      sharedBy: "Creator code", registerCta: "Register free to reveal picks",
      noSignals: "No predictions available right now.",
      empty: "Select at least 2 predictions to generate a link.",
    },
    es: {
      eyebrow: "Herramienta influencer", title: "Match Builder",
      subtitle: "Crea una combinada con las predicciones de IA y comparte el link con tus seguidores.",
      selectTitle: "Selecciona las predicciones (2–5)", selectedLabel: "Seleccionadas",
      combinedProb: "Probabilidad combinada (modelo)",
      yourCode: "Tu código de influencer (ej. MARIO10)", copyLink: "Copiar y publicar link", copied: "Copiado ✓",
      published: "Publicada en Creator Picks ✓",
      sharedTitle: "Combinada compartida", sharedDesc: "Un creator construyó esta combinada para ti.",
      sharedBy: "Código creator", registerCta: "Regístrate gratis para ver los picks",
      noSignals: "No hay predicciones disponibles ahora.",
      empty: "Selecciona al menos 2 predicciones para generar el link.",
    },
    fr: {
      eyebrow: "Outil influenceur", title: "Match Builder",
      subtitle: "Construisez un combiné avec les prédictions IA et partagez le lien avec vos abonnés.",
      selectTitle: "Sélectionnez les prédictions (2–5)", selectedLabel: "Sélectionnées",
      combinedProb: "Probabilité combinée (modèle)",
      yourCode: "Votre code influenceur (ex. MARIO10)", copyLink: "Copier et publier le lien", copied: "Copié ✓",
      published: "Publié sur Creator Picks ✓",
      sharedTitle: "Combiné partagé", sharedDesc: "Un creator a construit ce combiné pour vous.",
      sharedBy: "Code creator", registerCta: "Inscrivez-vous gratuitement pour voir les picks",
      noSignals: "Aucune prédiction disponible pour le moment.",
      empty: "Sélectionnez au moins 2 prédictions pour générer un lien.",
    },
    ru: {
      eyebrow: "Инструмент инфлюенсера", title: "Match Builder",
      subtitle: "Соберите экспресс из прогнозов ИИ и поделитесь ссылкой с подписчиками.",
      selectTitle: "Выберите прогнозы (2–5)", selectedLabel: "Выбрано",
      combinedProb: "Совокупная вероятность (модель)",
      yourCode: "Ваш код инфлюенсера (напр. MARIO10)", copyLink: "Скопировать и опубликовать ссылку", copied: "Скопировано ✓",
      published: "Опубликовано в Creator Picks ✓",
      sharedTitle: "Общий экспресс", sharedDesc: "Creator собрал этот экспресс для вас.",
      sharedBy: "Код creator", registerCta: "Зарегистрируйтесь бесплатно, чтобы увидеть пики",
      noSignals: "Сейчас нет доступных прогнозов.",
      empty: "Выберите минимум 2 прогноза, чтобы сгенерировать ссылку.",
    },
  });

  const items: MbItem[] = [
    ...predictions
      .filter((p) => !p.locked && isFutureMarket(p.kickoff) && Boolean(p.best_selection))
      .map((p): MbItem | null => {
        const prob = selectedFootballProbability(p);
        if (!Number.isFinite(prob) || prob <= 0) return null;
        return {
          id: `f_${p.match_id}`,
          label: `${p.home_team} vs ${p.away_team}`,
          market: p.best_selection === "HOME" ? p.home_team : p.best_selection === "AWAY" ? p.away_team : "Draw",
          sport: p.league_name || "Football", when: p.kickoff,
          prob,
        };
      })
      .filter((i): i is MbItem => i !== null),
    ...wcRows
      // #WC-MAINBOARD-1: la WC ora compare anche nel board (predictions); evita
      // il doppione tenendo nel builder solo le WC non già presenti nel board.
      .filter((r) => !r.locked && r.home_team && r.away_team && r.pick && r.starts_at && isFutureMarket(r.starts_at)
        && !predictions.some((p) => p.league === "WC" && p.home_team === r.home_team && p.away_team === r.away_team))
      .map((r): MbItem | null => {
        const conf = (r as { confidence_score?: number | null }).confidence_score;
        const prob = conf != null && conf > 0 ? conf / 100
          : r.fair_odds != null && r.fair_odds > 1 ? 1 / r.fair_odds : null;
        if (prob == null || !Number.isFinite(prob) || prob <= 0) return null;
        return {
          id: `w_${r.id}`,
          label: `${r.home_team} vs ${r.away_team}`,
          market: r.pick === "HOME" ? String(r.home_team) : r.pick === "AWAY" ? String(r.away_team) : "Draw",
          sport: "World Cup", when: String(r.starts_at),
          prob,
        };
      })
      .filter((i): i is MbItem => i !== null),
    ...tennisMatches
      .filter((m) => !m.locked && isTennisMarketVisible(m.scheduled) && Boolean(m.best_selection))
      .map((m): MbItem | null => {
        const prob = selectedTennisProbability(m);
        if (!Number.isFinite(prob) || prob <= 0) return null;
        return {
          id: `t_${m.id}`,
          label: `${m.player1} vs ${m.player2}`,
          market: m.best_selection === "P1" ? m.player1 : m.player2,
          sport: `Tennis · ${m.tournament}`, when: m.scheduled,
          prob,
        };
      })
      .filter((i): i is MbItem => i !== null),
  ];

  // Locked rows (anonymous/free projection): the share-link visitor must still
  // SEE which matches are in the slip — names visible, pick/odds behind the
  // register CTA. Only unlocked items are selectable/priced.
  const lockedLabels = new Map<string, string>([
    ...predictions
      .filter((p) => p.locked && p.home_team && p.away_team)
      .map((p) => [`f_${p.match_id}`, `${p.home_team} vs ${p.away_team}`] as [string, string]),
    ...wcRows
      // #WC-MAINBOARD-1: niente doppione coi locked del board (predictions).
      .filter((r) => r.locked && r.home_team && r.away_team
        && !predictions.some((p) => p.league === "WC" && p.home_team === r.home_team && p.away_team === r.away_team))
      .map((r) => [`w_${r.id}`, `${r.home_team} vs ${r.away_team}`] as [string, string]),
    // MEDIUM-5: tennis was missing here, so tennis selections in a shared link
    // vanished for anonymous visitors (locked → not in `items`, not labeled).
    ...tennisMatches
      .filter((m) => m.locked && m.player1 && m.player2)
      .map((m) => [`t_${m.id}`, `${m.player1} vs ${m.player2}`] as [string, string]),
  ]);
  // Plan gate on the selectable inventory: Premium/admin see every signal;
  // Base sees only the 3 strongest (by model probability). Free/anon never
  // interact here — the whole builder sits behind the LockedGate below.
  const cappedItems = isPremium
    ? items
    : [...items].sort((a, b) => b.prob - a.prob).slice(0, 3);
  // #MB-FIX #1: a slip opened from a shared link (selected = sharedIds, up to 5)
  // must never lose legs to the Base 3-signal cap — otherwise legs 4-5 vanished
  // silently AND the combined prob was computed on a subset. Always keep any
  // already-selected unlocked leg visible/priced; the cap only limits new picks.
  const visibleItems = isPremium
    ? items
    : [...cappedItems, ...items.filter((i) => selected.includes(i.id) && !cappedItems.some((c) => c.id === i.id))];
  const selectedItems = visibleItems.filter((i) => selected.includes(i.id));
  const combinedProb = selectedItems.reduce((acc, i) => acc * i.prob, 1);
  const isSharedView = sharedIds.length > 0 && !isLoggedIn;
  // #MB-FIX #2: shared-link teaser (anon) must show EVERY leg of the slip —
  // names visible, pick/odds gated. Cover both locked legs (label from
  // lockedLabels) and any leg already unlocked for this visitor (in `items`);
  // a leg that dropped out of the feed entirely is simply omitted. The old code
  // rendered only locked legs, so a slip whose matches were unlocked/expired
  // showed an empty teaser (header + CTA, no fixtures).
  const sharedRows: { id: string; label: string }[] = sharedIds
    .map((id) => {
      const it = items.find((i) => i.id === id);
      if (it) return { id, label: it.label };
      const ll = lockedLabels.get(id);
      return ll ? { id, label: ll } : null;
    })
    .filter((r): r is { id: string; label: string } => r !== null);

  const toggle = (id: string) => {
    // #MB-FIX #3: editing the slip invalidates a prior "published ✓" note, which
    // otherwise stayed pinned to a slip the user has already changed.
    setPublishState("idle");
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const shareLink = (() => {
    if (selected.length < 2) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({ mb: selected.join(",") });
    const code = influencerCode.trim().toUpperCase();
    if (/^[A-Z0-9_-]{2,20}$/.test(code)) params.set("ref", code);
    return `${base}/app?${params.toString()}`;
  })();

  const [publishState, setPublishState] = useState<"idle" | "published">("idle");
  const copyLink = async () => {
    if (!shareLink) return;
    try { await navigator.clipboard.writeText(shareLink); } catch { /* clipboard denied: link shown below anyway */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    trackEvent("mb_link_copied", { meta: { selections: selected.length } });
    // Publish to Creator Picks (#MB-2): fail-soft — the share link works even
    // if the publish API hiccups; the slip just won't appear on /community.
    const code = influencerCode.trim().toUpperCase();
    if (isLoggedIn && /^[A-Z0-9_-]{2,20}$/.test(code) && selectedItems.length >= 2) {
      try {
        const resp = await fetch("/api/match-builder", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code,
            mb: selected.join(","),
            selections: selectedItems.map((i) => ({
              id: i.id, label: i.label, market: i.market, sport: i.sport, when: i.when, prob: i.prob,
            })),
          }),
        });
        if (resp.ok) setPublishState("published");
      } catch { /* publish best-effort */ }
    }
  };

  // Presentation-only grouping for scannability. Mostly by item id prefix
  // (f_/w_/t_), MA #MB-WC-GROUP-0627: da quando /api/predictions include anche la
  // World Cup (league "WC"), quelle righe arrivano come item football (f_, sport
  // "World Cup") e le wcRows (w_) duplicate vengono dedotte via → la WC finiva
  // sepolta sotto "Calcio". Raggruppo la WC per LABEL sport, non solo per prefisso.
  const isWcItem = (i: MbItem) => i.id.startsWith("w_") || i.sport === "World Cup";
  const mbGroups: { key: string; head: string; amber: boolean; rows: MbItem[] }[] = [
    { key: "football", head: pick5(lang, { it: "Calcio", en: "Football", es: "Fútbol", fr: "Football", ru: "Футбол" }), amber: false, rows: visibleItems.filter((i) => i.id.startsWith("f_") && !isWcItem(i)) },
    { key: "tennis", head: "Tennis", amber: false, rows: visibleItems.filter((i) => i.id.startsWith("t_")) },
    { key: "worldcup", head: "World Cup", amber: true, rows: visibleItems.filter(isWcItem) },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6 p-4">
      {/* Header — the page deskhead already renders the big "Match Builder"
          title, so the component keeps only the creator-tool framing (eyebrow +
          subtitle) to avoid the duplicated heading. */}
      <div className="space-y-1">
        <p className="eyebrow">{copy.eyebrow}</p>
        <p className="text-xs font-mono text-[var(--am-muted-2)] max-w-lg">{copy.subtitle}</p>
      </div>

      {/* ── Shared-view: visitor sees the matches; pick/odds gated behind CTA ── */}
      {isSharedView && (
        <div className="am-surface p-5 space-y-3" style={{ borderColor: "var(--am-coral-b)" }}>
          <div className="space-y-1">
            <p className="text-xs font-mono font-bold text-[var(--am-coral)]">{copy.sharedTitle}</p>
            <p className="text-xs font-mono text-[var(--am-muted)]">{copy.sharedDesc}</p>
            {refCode && (
              <p className="text-[10px] font-mono text-[var(--am-muted-2)]">{copy.sharedBy}: <span className="text-[var(--am-coral)]">{refCode}</span></p>
            )}
          </div>
          {sharedRows.length > 0 && (
            <div className="mb-slip-list">
              {sharedRows.map((row) => (
                <div key={row.id} className="mb-slip-item">
                  <span className="mb-slip-fixture">{row.label}</span>
                  <span className="mb-slip-meta"><span className="text-[var(--am-muted-2)]">🔒</span></span>
                </div>
              ))}
            </div>
          )}
          <button onClick={onRegister} className="mb-cta">{copy.registerCta} →</button>
        </div>
      )}

      {/* ── Two columns on desktop: selectable list (left) + sticky slip (right) ──
           Free/anon: the whole builder sits behind the LockedGate (blurred,
           pointer-events off) with a plan/auth upsell — same wall as the board. */}
      {!isSharedView && (
        <LockedGate isUnlocked={isUnlocked} mode={isLoggedIn ? "plan" : "auth"} onUnlock={() => onUnlock?.()}>
        <div className="mb-layout">
          {/* LEFT — scannable selectable list, grouped by sport */}
          <div className="min-w-0">
            <p className="text-xs font-mono text-[var(--am-muted)] uppercase tracking-wider mb-3">{copy.selectTitle}</p>
            {visibleItems.length === 0 ? (
              <div className="am-surface p-8 text-center text-xs font-mono text-[var(--am-muted-2)]">
                {/* #MB-FIX #4: during the parent's predictions fetch, items is
                    empty — show a loading line, not the false "no signals". */}
                {loading ? pick5(lang, { it: "Caricamento predizioni…", en: "Loading predictions…", es: "Cargando predicciones…", fr: "Chargement des prédictions…", ru: "Загрузка прогнозов…" }) : copy.noSignals}
              </div>
            ) : (
              <div className="mb-select-scroll">
                {mbGroups.map((group) => (
                  <div key={group.key} className="mb-group">
                    <div className={`mb-group-head${group.amber ? " amber" : ""}`}>
                      <span className="mb-glyph"><SportMark sport={group.key as "football" | "tennis" | "worldcup"} size={16} /></span>
                      <h3>{group.head}</h3>
                      <span className="mb-ct">{group.rows.length}</span>
                      <span className="mb-rule" />
                    </div>
                    <div className="mb-rows">
                      {group.rows.map((item) => {
                        const isSelected = selected.includes(item.id);
                        const atCap = selected.length >= 5 && !isSelected;
                        const [home, away] = item.label.split(" vs ");
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggle(item.id)}
                            disabled={atCap}
                            className={`am-surface mb-row${isSelected ? " is-selected" : ""}${atCap ? " is-disabled" : ""}`}
                          >
                            <span className="mb-row-glyph"><SportMark sport={group.key as "football" | "tennis" | "worldcup"} size={16} /></span>
                            <span className="mb-row-body">
                              <span className="mb-fixture">
                                {away != null ? (
                                  <>{home}<span className="mb-vs">vs</span>{away}</>
                                ) : item.label}
                              </span>
                              <span className="mb-pick"><span className="mb-pick-label">Pick: </span><strong>{item.market}</strong></span>
                            </span>
                            <span className="mb-row-tail">
                              <span className="mb-prob">{Math.round(item.prob * 100)}%</span>
                              <span className="mb-check" aria-hidden="true">✓</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {selected.length >= 5 && (
                  <p className="mb-cap-note">{pick5(lang, { it: "Massimo 5 selezioni — deseleziona per cambiarne una.", en: "Maximum 5 selections — deselect one to swap.", es: "Máximo 5 selecciones — deselecciona una para cambiarla.", fr: "Maximum 5 sélections — désélectionnez-en une pour la remplacer.", ru: "Максимум 5 выборов — снимите один, чтобы заменить." })}</p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — sticky slip */}
          <div className="mb-slip-col">
            <div className="am-surface p-5 space-y-4" style={selectedItems.length >= 2 ? { borderColor: "var(--am-coral-b)" } : undefined}>
              <div className="mb-slip-head">
                <span className="mb-slip-count">{copy.selectedLabel} · {selectedItems.length}/5</span>
                {selectedItems.length >= 2 && (
                  <span className="mb-slip-prob">{Math.round(combinedProb * 100)}%</span>
                )}
              </div>

              {selectedItems.length >= 2 ? (
                <>
                  <p className="mb-slip-prob-cap">{copy.combinedProb}</p>
                  <div className="mb-slip-divider" />
                  <div className="mb-slip-list">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="mb-slip-item">
                        <span className="mb-slip-fixture">{item.label}</span>
                        <span className="mb-slip-meta">
                          <span className="mb-slip-market">{item.market}</span>
                          <span className="mb-slip-pct">{Math.round(item.prob * 100)}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mb-slip-divider" />
                </>
              ) : (
                <p className="mb-slip-empty">{copy.empty}</p>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-mono text-[var(--am-muted)]">{copy.yourCode}</p>
                <input
                  type="text"
                  value={influencerCode}
                  onChange={(e) => setInfluencerCode(e.target.value)}
                  placeholder="YOURCODE"
                  className="mb-input"
                  maxLength={20}
                />
              </div>

              {selected.length >= 2 && (
                <div className="space-y-2">
                  <button onClick={copyLink} className="mb-cta">
                    {copied ? copy.copied : copy.copyLink}
                  </button>
                  {publishState === "published" && (
                    <p className="text-[10px] font-mono text-[var(--am-positive)]">{copy.published} · <a href="/community" className="underline">Creator Picks →</a></p>
                  )}
                  <p className="mb-link">{shareLink}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </LockedGate>
      )}
    </div>
  );
}

// ─── Leaderboard Tab ─────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  bets_won: number;
  bets_total: number;
  hit_rate: number;
  sport: string;
}

function LeaderboardTab({ clientName, isOptedIn }: { clientName?: string; isOptedIn?: boolean }) {
  const lang = useLang();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [systemWins, setSystemWins] = useState<number | null>(null);
  const [systemHitRate, setSystemHitRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.leaderboard ?? []);
        setSystemWins(d.system_wins ?? null);
        setSystemHitRate(d.system_hit_rate ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copy = pick5(lang, {
    it: {
      eyebrow: "Classifica pubblica",
      title: "Leaderboard BetRedge",
      subtitle: "10 punti per ogni scommessa vinta. La classifica si aggiorna ad ogni settlement.",
      rank: "#",
      player: "Giocatore",
      points: "Punti",
      won: "Vinte",
      total: "Totali",
      hitRate: "Hit Rate",
      sport: "Sport",
      systemWins: "Bet vinte dal sistema",
      systemHitRate: "Hit rate sistema",
      pointsFormula: "10 pt per vittoria",
      yourRank: "La tua posizione",
      notOptedIn: "Abilita la leaderboard nelle Impostazioni per comparire in classifica.",
      loading: "Caricamento classifica…",
      noData: "Nessun dato disponibile.",
      podiumLabel: ["🥇 Primo", "🥈 Secondo", "🥉 Terzo"],
    },
    en: {
      eyebrow: "Public leaderboard",
      title: "BetRedge Leaderboard",
      subtitle: "10 points for every won bet. Rankings update after each settlement.",
      rank: "#",
      player: "Player",
      points: "Points",
      won: "Won",
      total: "Total",
      hitRate: "Hit Rate",
      sport: "Sport",
      systemWins: "System wins",
      systemHitRate: "System hit rate",
      pointsFormula: "10 pts per win",
      yourRank: "Your position",
      notOptedIn: "Enable leaderboard in Settings to appear in the rankings.",
      loading: "Loading leaderboard…",
      noData: "No data available.",
      podiumLabel: ["🥇 First", "🥈 Second", "🥉 Third"],
    },
    es: {
      eyebrow: "Clasificación pública",
      title: "Leaderboard BetRedge",
      subtitle: "10 puntos por cada apuesta ganada. La clasificación se actualiza tras cada settlement.",
      rank: "#",
      player: "Jugador",
      points: "Puntos",
      won: "Ganadas",
      total: "Totales",
      hitRate: "Hit Rate",
      sport: "Deporte",
      systemWins: "Bets ganadas por el sistema",
      systemHitRate: "Hit rate del sistema",
      pointsFormula: "10 pts por victoria",
      yourRank: "Tu posición",
      notOptedIn: "Activa la leaderboard en Ajustes para aparecer en la clasificación.",
      loading: "Cargando clasificación…",
      noData: "No hay datos disponibles.",
      podiumLabel: ["🥇 Primero", "🥈 Segundo", "🥉 Tercero"],
    },
    fr: {
      eyebrow: "Classement public",
      title: "Leaderboard BetRedge",
      subtitle: "10 points pour chaque pari gagné. Le classement se met à jour après chaque settlement.",
      rank: "#",
      player: "Joueur",
      points: "Points",
      won: "Gagnés",
      total: "Total",
      hitRate: "Hit Rate",
      sport: "Sport",
      systemWins: "Bets gagnés par le système",
      systemHitRate: "Hit rate du système",
      pointsFormula: "10 pts par victoire",
      yourRank: "Votre position",
      notOptedIn: "Activez le leaderboard dans les Paramètres pour apparaître au classement.",
      loading: "Chargement du classement…",
      noData: "Aucune donnée disponible.",
      podiumLabel: ["🥇 Premier", "🥈 Deuxième", "🥉 Troisième"],
    },
    ru: {
      eyebrow: "Публичный рейтинг",
      title: "Leaderboard BetRedge",
      subtitle: "10 очков за каждую выигранную ставку. Рейтинг обновляется после каждого settlement.",
      rank: "#",
      player: "Игрок",
      points: "Очки",
      won: "Выиграно",
      total: "Всего",
      hitRate: "Hit Rate",
      sport: "Спорт",
      systemWins: "Ставки, выигранные системой",
      systemHitRate: "Hit rate системы",
      pointsFormula: "10 очков за победу",
      yourRank: "Ваша позиция",
      notOptedIn: "Включите leaderboard в Настройках, чтобы попасть в рейтинг.",
      loading: "Загрузка рейтинга…",
      noData: "Нет доступных данных.",
      podiumLabel: ["🥇 Первое", "🥈 Второе", "🥉 Третье"],
    },
  });

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  const yourEntry = isOptedIn && clientName
    ? entries.find((e) => e.name === clientName)
    : null;

  const medalColors = [
    "from-[var(--am-coral)] to-[var(--am-coral-2)]",
    "from-[var(--am-panel-3)] to-[var(--am-panel-2)]",
    "from-[var(--am-panel-2)] to-[var(--am-inset)]",
  ];
  const medalBorder = ["var(--am-coral-b)", "var(--am-line-2)", "var(--am-line)"];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 className="text-xl font-bold text-[var(--am-text)]">{copy.title}</h2>
        <p className="text-xs font-mono text-[var(--am-muted-2)] max-w-lg">{copy.subtitle}</p>
      </div>

      {/* Stats strip — only once the settled sample is statistically honest
          (server returns null below MIN_SYSTEM_SETTLED to avoid a "100% from
          1 pick" FTC claim). */}
      {systemHitRate != null && systemWins != null && (
        <div className="grid grid-cols-3 gap-4">
          <div className="am-surface p-4 text-center">
            <div className="text-2xl font-black text-[var(--am-positive)] font-mono">{systemWins}</div>
            <div className="text-[10px] font-mono text-[var(--am-muted-2)] uppercase tracking-wider mt-0.5">{copy.systemWins}</div>
          </div>
          <div className="am-surface p-4 text-center">
            <div className="text-2xl font-black text-[var(--am-coral)] font-mono">{systemWins * 10}</div>
            <div className="text-[10px] font-mono text-[var(--am-muted-2)] uppercase tracking-wider mt-0.5">{copy.pointsFormula}</div>
          </div>
          <div className="am-surface p-4 text-center">
            <div className="text-2xl font-black font-mono text-[var(--am-positive)]">
              {systemHitRate}%
            </div>
            <div className="text-[10px] font-mono text-[var(--am-muted-2)] uppercase tracking-wider mt-0.5">{copy.systemHitRate}</div>
          </div>
        </div>
      )}

      {/* Hall of Fame */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">Hall of Fame</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="am-surface p-4 space-y-1">
              <div className="text-[10px] font-mono text-[var(--am-muted)] uppercase tracking-wider">
                🏆 Top hit rate
              </div>
              {(() => {
                const top = [...entries].sort((a, b) => b.hit_rate - a.hit_rate)[0];
                return top ? (
                  <>
                    <div className="text-sm font-bold text-[var(--am-text)] truncate">{top.name}</div>
                    <div className="text-lg font-black font-mono text-[var(--am-positive)]">
                      {top.hit_rate}%
                    </div>
                    <div className="text-[10px] font-mono text-[var(--am-muted-2)]">{top.bets_won}W / {top.bets_total}</div>
                  </>
                ) : null;
              })()}
            </div>
            <div className="am-surface p-4 space-y-1">
              <div className="text-[10px] font-mono text-[var(--am-muted)] uppercase tracking-wider">
                {pick5(lang, { it: "🔥 Più attivo", en: "🔥 Most active", es: "🔥 Más activo", fr: "🔥 Le plus actif", ru: "🔥 Самый активный" })}
              </div>
              {(() => {
                const top = [...entries].sort((a, b) => b.bets_total - a.bets_total)[0];
                return top ? (
                  <>
                    <div className="text-sm font-bold text-[var(--am-text)] truncate">{top.name}</div>
                    <div className="text-lg font-black font-mono text-[var(--am-coral)]">{top.bets_total}</div>
                    <div className="text-[10px] font-mono text-[var(--am-muted-2)]">{pick5(lang, { it: "scommesse totali", en: "total bets", es: "apuestas totales", fr: "paris totaux", ru: "всего ставок" })}</div>
                  </>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs font-mono text-[var(--am-muted-2)] animate-pulse py-8 text-center">{copy.loading}</div>
      ) : entries.length === 0 ? (
        <div className="text-xs font-mono text-[var(--am-muted-2)] py-8 text-center">{copy.noData}</div>
      ) : (
        <>
          {/* Podium */}
          {podium.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {podium.map((e, i) => (
                <div key={e.rank} className={`am-surface p-4 text-center space-y-2 bg-gradient-to-b ${medalColors[i]}`} style={i === 0 ? { borderColor: medalBorder[i], background: "var(--am-coral)" } : { borderColor: medalBorder[i] }}>
                  <div className="text-lg">{copy.podiumLabel[i].split(" ")[0]}</div>
                  <div className={`text-sm font-bold truncate ${i === 0 ? "text-[var(--am-coral-ink)]" : "text-[var(--am-text)]"}`}>{e.name}</div>
                  <div className={`text-xl font-black font-mono ${i === 0 ? "text-[var(--am-coral-ink)]" : "text-[var(--am-text)]"}`}>{e.points} pt</div>
                  <div className={`text-[10px] font-mono ${i === 0 ? "text-[var(--am-coral-ink)] opacity-90" : "text-[var(--am-muted-2)]"}`}>{e.bets_won}W · {e.hit_rate}%</div>
                </div>
              ))}
            </div>
          )}

          {/* Full table */}
          {rest.length > 0 && (
            <div className="am-surface overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-[var(--am-line)] text-[var(--am-muted-2)] uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">{copy.rank}</th>
                    <th className="px-4 py-3 text-left">{copy.player}</th>
                    <th className="px-4 py-3 text-right">{copy.points}</th>
                    <th className="px-4 py-3 text-right">{copy.won}/{copy.total}</th>
                    <th className="px-4 py-3 text-right">{copy.hitRate}</th>
                    <th className="px-4 py-3 text-right hidden md:table-cell">{copy.sport}</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((e) => (
                    <tr key={e.rank}
                      className="border-b border-[var(--am-line)] transition-colors"
                      style={yourEntry?.rank === e.rank ? { background: "var(--am-coral-dim)", borderColor: "var(--am-coral-b)" } : undefined}
                    >
                      <td className="px-4 py-3 text-[var(--am-muted-2)]">{e.rank}</td>
                      <td className="px-4 py-3 text-[var(--am-text)] font-semibold">
                        {e.name}
                        {yourEntry?.rank === e.rank && <span className="ml-2 text-[9px] text-[var(--am-coral)] border border-[var(--am-coral-b)] px-1 py-0.5 rounded">YOU</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--am-positive)] font-bold">{e.points}</td>
                      <td className="px-4 py-3 text-right text-[var(--am-muted)]">{e.bets_won}/{e.bets_total}</td>
                      <td className="px-4 py-3 text-right text-[var(--am-positive)]">{e.hit_rate}%</td>
                      <td className="px-4 py-3 text-right text-[var(--am-muted-2)] hidden md:table-cell capitalize">{e.sport}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Your rank / opt-in CTA */}
      <div className="am-surface p-5 space-y-2">
        <p className="eyebrow">{copy.yourRank}</p>
        {isOptedIn && yourEntry ? (
          <div className="flex items-center gap-4">
            <div className="text-3xl font-black font-mono text-[var(--am-coral)]">#{yourEntry.rank}</div>
            <div>
              <div className="text-sm font-bold text-[var(--am-text)]">{yourEntry.name}</div>
              <div className="text-xs font-mono text-[var(--am-muted-2)]">
                {yourEntry.points} {copy.points} · {yourEntry.hit_rate}% {copy.hitRate}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-[var(--am-muted-2)]">{copy.notOptedIn}</p>
        )}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ history, stats, loading }: {
  history: V2HistoryRow[];
  stats: V2HistoryStats | null;
  loading: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [sportFilter, setSportFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");

  const SPORT_ICONS: Record<string, string> = { football: "⚽", tennis: "🎾" };
  const resultOf = (h: V2HistoryRow) => h.result ?? "pending";

  // Sport is the first-level filter; competitions are derived from the rows of
  // the SELECTED sport only, so a football competition can never stay active
  // while tennis is selected (the cross-filter conflict the old tab had).
  const sports = [...new Set(history.map((h) => h.sport))].sort();
  const sportRows = sportFilter === "all" ? history : history.filter((h) => h.sport === sportFilter);
  const competitions = [...new Set(sportRows.map((h) => h.competition ?? "—"))].sort();
  const effectiveCompetition = competitions.includes(competitionFilter) ? competitionFilter : "all";

  const filtered = sportRows.filter((h) => {
    if (effectiveCompetition !== "all" && (h.competition ?? "—") !== effectiveCompetition) return false;
    if (resultFilter !== "all" && resultOf(h) !== resultFilter) return false;
    return true;
  });

  // Per-button counts on the current sport slice: a 0-count button is shown
  // disabled instead of producing a silent empty list.
  const countByResult = (key: string) =>
    key === "all" ? sportRows.length : sportRows.filter((h) => resultOf(h) === key).length;
  const countByCompetition = (c: string) =>
    c === "all" ? sportRows.length : sportRows.filter((h) => (h.competition ?? "—") === c).length;

  const eventLabel = (h: V2HistoryRow) =>
    h.event_name
    ?? (h.home_team && h.away_team ? `${h.home_team} vs ${h.away_team}` : null)
    ?? (h.player_one && h.player_two ? `${h.player_one} vs ${h.player_two}` : "—");

  // #HISTORY-KPI-FILTER-1: the header KPIs must follow the selected sport, not
  // stay pinned to the global all-sports figure (a user filtering "football"
  // saw the football list but the all-sports hit rate). Derived from sportRows
  // (sport slice, not result-filtered) so the rate is stable across result tabs.
  const scopedTotal = sportRows.length;
  const scopedWon = sportRows.filter((h) => resultOf(h) === "won").length;
  const scopedDecided = scopedWon + sportRows.filter((h) => resultOf(h) === "lost").length;
  // #HITRATE-GUARD-1: a filtered scope can shrink to a handful of decided picks
  // (football day-one read 93.8% on 16) — below the threshold the KPI hides and
  // the list speaks for itself.
  const scopedWinRate = isRateMeaningful(scopedDecided)
    ? `${((scopedWon / scopedDecided) * 100).toFixed(1)}%` : null;

  return (
    <div className="am-history space-y-6">
      {/* Header — mockup .history .hh: title + subtitle + 2 KPIs from real stats */}
      <div className="hh">
        <div>
          <h2>{pick5(lang, { it: "Storico", en: "History", es: "Historial", fr: "Historique", ru: "История" })}</h2>
          <p className="hsub">
            {lang === "it"
              ? "La prova di calibrazione: pick settlati, esiti reali. Trasparente, niente cherry-picking."
              : "The calibration proof: settled picks, real outcomes. Transparent, no cherry-picking."}
          </p>
        </div>
        {stats && (
          <div className="hr">
            <div className="am-kpi"><span className="v">{scopedTotal}</span><span className="l">{t.hist_matches}</span></div>
            {scopedWinRate && (
              <div className="am-kpi"><span className="v sig">{scopedWinRate}</span><span className="l">{t.hist_hit_rate}</span></div>
            )}
          </div>
        )}
      </div>

      {/* Filters: sport → result → competition (derived from selected sport) */}
      <div className="am-filters">
        <div className="am-seg" aria-label="Sport filter">
          {["all", ...sports].map((s) => (
            <button key={s} className={sportFilter === s ? "on" : ""}
              onClick={() => { setSportFilter(s); setCompetitionFilter("all"); }}>
              {s === "all"
                ? pick5(lang, { it: "Tutti gli sport", en: "All sports", es: "Todos los deportes", fr: "Tous les sports", ru: "Все виды спорта" })
                : (<>
                    {s === "football"
                      ? <SportIcon sport="football" size={14} className="ic" variant="sm" />
                      : s === "tennis"
                        ? <SportIcon sport="tennis" size={14} className="ic" variant="sm" />
                        : null}
                    {s}
                  </>)}
            </button>
          ))}
        </div>

        <div className="am-seg" aria-label="Result filter">
          {[
            { key: "all",     label: t.hist_filter_all },
            { key: "won",     label: t.hist_filter_won },
            { key: "lost",    label: t.hist_filter_lost },
            { key: "void",    label: "Void" },
            { key: "pending", label: t.hist_legend_pending },
          ].map((f) => {
            const n = countByResult(f.key);
            return (
              <button key={f.key} className={resultFilter === f.key ? "on" : ""}
                onClick={() => setResultFilter(f.key)} disabled={n === 0}>
                {f.label} <span className="ct">{n}</span>
              </button>
            );
          })}
        </div>

        <label className="am-mini-field">
          <span>{pick5(lang, { it: "Competizione", en: "Competition", es: "Competición", fr: "Compétition", ru: "Турнир" })}</span>
          <select value={effectiveCompetition} onChange={(e) => setCompetitionFilter(e.target.value)}>
            {["all", ...competitions].map((c) => {
              const n = countByCompetition(c);
              return (
                <option key={c} value={c}>
                  {c === "all"
                    ? `${pick5(lang, { it: "Tutte le competizioni", en: "All competitions", es: "Todas las competiciones", fr: "Toutes les compétitions", ru: "Все турниры" })} (${n})`
                    : `${c} (${n})`}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] font-mono" style={{ color: "var(--am-muted-2)" }}>
        <span><span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ background: "var(--am-positive)" }}></span>{t.hist_legend_won}</span>
        <span><span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ background: "var(--am-negative)" }}></span>{t.hist_legend_lost}</span>
        <span><span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ background: "var(--am-amber)" }}></span>{t.hist_legend_pending}</span>
        <span><span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ background: "var(--am-muted-2)" }}></span>Void</span>
      </div>

      {loading ? (
        <div className="am-surface p-12 text-center font-mono" style={{ color: "var(--am-muted)" }}>
          <div className="animate-pulse">{t.hist_loading}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="am-surface p-8 text-center font-mono" style={{ color: "var(--am-muted)" }}>
          {history.length === 0 ? t.hist_empty : t.no_match_filters}
        </div>
      ) : (
        /* Table — mockup .htable: Match / Pick / Modello / Esito (dot won/lost). */
        <div className="am-htable-wrap">
          <table className="am-htable">
            <thead>
              <tr>
                <th>Match</th>
                <th>Pick</th>
                <th className="r">{pick5(lang, { it: "Esito", en: "Result", es: "Resultado", fr: "Résultat", ru: "Итог" })}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const r = resultOf(h);
                const resClass = r === "won" || r === "lost" || r === "void" ? r : "pending";
                const resLabel =
                  r === "won" ? pick5(lang, { it: "Vinta", en: "Won", es: "Ganada", fr: "Gagné", ru: "Выиграна" })
                  : r === "lost" ? pick5(lang, { it: "Persa", en: "Lost", es: "Perdida", fr: "Perdu", ru: "Проиграна" })
                  : r === "void" ? "Void"
                  : pick5(lang, { it: "Aperta", en: "Pending", es: "Abierta", fr: "En cours", ru: "Открыта" });
                return (
                  <tr key={h.id}>
                    <td className="fx-c">
                      {SPORT_ICONS[h.sport] ?? ""} {eventLabel(h)}
                      {h.final_score ? <span className="r" style={{ marginLeft: 8 }}>{h.final_score}</span> : null}
                    </td>
                    <td className="pk">{h.locked ? "🔒" : (h.pick ?? "—")}</td>
                    <td className="r">
                      <span className={`res ${resClass}`}><span className="d" />{resLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Assistance Tab ───────────────────────────────────────────────────────────

function AssistanceTab() {
  return <SupportHub />;
}

// ─── FAQ Tab ──────────────────────────────────────────────────────────────────

function FAQTab() {
  const lang = useLang();
  const faqItems = pick5(lang, {
    it: [
      ["Cosa vede un utente pubblico?", "Solo struttura del prodotto e storico passato. I segnali live restano bloccati."],
      ["Cosa sblocca il piano Free?", "Profilo, lingua e preview account senza prediction operative."],
      ["Cosa sblocca BetRedge Pro?", "Tennis live, football research, Best Bets, Top Model Signals, spiegazioni modello e track record."],
      ["Gli agenti piazzano bet automaticamente?", "No nel go-live: il piano pubblico è research e signal desk. L'execution resta interna/non venduta."],
      ["Come pago?", "Solo crypto — USDT TRC20. Invia l'importo esatto all'indirizzo USDT indicato nel checkout."],
      ["Come viene attivato il piano?", "Dopo il TX hash il piano viene verificato internamente o attivato secondo la policy operativa configurata."],
    ],
    en: [
      ["What can public users see?", "Only product structure and past history. Live signals stay locked."],
      ["What does Free unlock?", "Profile, language and account preview without operational predictions."],
      ["What does BetRedge Pro unlock?", "Tennis live, football research, Best Bets, Top Model Signals, model explanations and track record."],
      ["Do agents place bets automatically?", "Not in the go-live: the public plan is research and signal desk. Execution remains internal/not sold."],
      ["How do I pay?", "Crypto only — USDT TRC20. Send the exact amount to the USDT address shown at checkout."],
      ["How is the plan activated?", "After the TX hash, the plan is internally reviewed or activated according to the configured operating policy."],
    ],
    es: [
      ["¿Qué ve un usuario público?", "Solo la estructura del producto y el historial pasado. Las señales live siguen bloqueadas."],
      ["¿Qué desbloquea el plan Free?", "Perfil, idioma y vista previa de cuenta, sin predicciones operativas."],
      ["¿Qué desbloquea BetRedge Pro?", "Tenis live, football research, Best Bets, Top Model Signals, explicaciones del modelo y track record."],
      ["¿Los agentes hacen apuestas automáticamente?", "No en el lanzamiento: el plan público es research y signal desk. La ejecución sigue siendo interna/no se vende."],
      ["¿Cómo pago?", "Solo crypto — USDT TRC20. Envía el importe exacto a la dirección USDT indicada en el checkout."],
      ["¿Cómo se activa el plan?", "Tras el TX hash, el plan se revisa internamente o se activa según la política operativa configurada."],
    ],
    fr: [
      ["Que voit un utilisateur public ?", "Seulement la structure du produit et l'historique passé. Les signaux live restent verrouillés."],
      ["Que débloque le plan Free ?", "Profil, langue et aperçu du compte, sans prédictions opérationnelles."],
      ["Que débloque BetRedge Pro ?", "Tennis live, football research, Best Bets, Top Model Signals, explications du modèle et track record."],
      ["Les agents placent-ils des paris automatiquement ?", "Pas au lancement : le plan public est research et signal desk. L'exécution reste interne/non vendue."],
      ["Comment payer ?", "Crypto uniquement — USDT TRC20. Envoyez le montant exact à l'adresse USDT indiquée au checkout."],
      ["Comment le plan est-il activé ?", "Après le TX hash, le plan est vérifié en interne ou activé selon la politique opérationnelle configurée."],
    ],
    ru: [
      ["Что видит публичный пользователь?", "Только структуру продукта и прошлую историю. Live-сигналы остаются заблокированы."],
      ["Что открывает план Free?", "Профиль, язык и предпросмотр аккаунта, без рабочих прогнозов."],
      ["Что открывает BetRedge Pro?", "Tennis live, football research, Best Bets, Top Model Signals, пояснения модели и track record."],
      ["Размещают ли агенты ставки автоматически?", "Не на старте: публичный план — это research и signal desk. Исполнение остаётся внутренним/не продаётся."],
      ["Как оплатить?", "Только крипто — USDT TRC20. Отправьте точную сумму на адрес USDT, указанный в checkout."],
      ["Как активируется план?", "После TX hash план проверяется вручную или активируется согласно настроенной операционной политике."],
    ],
  });
  return <FAQSupportSection items={faqItems} />;
}

// ─── Client Area Tab ──────────────────────────────────────────────────────────

function ClientAreaTab({
  profile,
  onActivateFree,
  onUpgrade,
}: {
  profile: ClientProfile | null;
  onActivateFree: () => void;
  // #UI-PLANS-CTA-0623: porta DIRETTAMENTE alla vista piani. Prima un onUpgrade
  // era referenziato in ProfilePanel ma ClientAreaTab non lo accettava/inoltrava
  // → il bottone Upgrade era morto. Ora è cablato fino al cambio di sezione piani.
  onUpgrade: () => void;
}) {
  const lang = useLang();
  const t = useT();

  const openBillingPortal = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    if (!res.ok) return;
    const { url } = (await res.json()) as { url?: string };
    if (url) window.location.href = url;
  };

  const plan = profile?.plan ?? "unpaid";
  const accessState = profileHasPremium(profile)
    ? "Premium"
    : profileHasAccess(profile)
      ? "Pro"
      : profile?.plan === "free"
        ? "Free"
        : profile?.plan === "pending_payment"
          ? "Review"
          : "Login";
  const notifications = profile?.notifications ?? defaultNotifications();
  const statusCopy = pick5(lang, {
    it: {
      title: "Dashboard cliente",
      subtitle: "Profilo, piano e stato accesso in un solo posto.",
      currentPlan: "Piano attuale",
      access: "Stato accesso",
      exchange: "Conto exchange",
      timezone: "Timezone",
      notifications: "Notifiche attive",
      payment: "Pagamento",
      paymentOk: "Accesso attivo",
      paymentFree: "Free attivo",
      paymentReview: "TX ricevuto",
      paymentMissing: "Nessun piano selezionato",
      connected: "Collegato",
      notConnected: "Da collegare",
      openDesk: "Apri desk",
      logout: "Esci dall'account",
    },
    en: {
      title: "Client dashboard",
      subtitle: "Profile, plan and access status in one place.",
      currentPlan: "Current plan",
      access: "Access status",
      exchange: "Exchange account",
      timezone: "Timezone",
      notifications: "Active notifications",
      payment: "Payment",
      paymentOk: "Access active",
      paymentFree: "Free active",
      paymentReview: "TX received",
      paymentMissing: "No plan selected",
      connected: "Connected",
      notConnected: "Needs setup",
      openDesk: "Open desk",
      logout: "Log out",
    },
    es: {
      title: "Dashboard del cliente",
      subtitle: "Perfil, plan y estado de acceso en un solo lugar.",
      currentPlan: "Plan actual",
      access: "Estado de acceso",
      exchange: "Cuenta exchange",
      timezone: "Zona horaria",
      notifications: "Notificaciones activas",
      payment: "Pago",
      paymentOk: "Acceso activo",
      paymentFree: "Free activo",
      paymentReview: "TX recibido",
      paymentMissing: "Ningún plan seleccionado",
      connected: "Conectado",
      notConnected: "Por conectar",
      openDesk: "Abrir desk",
      logout: "Cerrar sesión",
    },
    fr: {
      title: "Dashboard client",
      subtitle: "Profil, plan et statut d'accès au même endroit.",
      currentPlan: "Plan actuel",
      access: "Statut d'accès",
      exchange: "Compte exchange",
      timezone: "Fuseau horaire",
      notifications: "Notifications actives",
      payment: "Paiement",
      paymentOk: "Accès actif",
      paymentFree: "Free actif",
      paymentReview: "TX reçu",
      paymentMissing: "Aucun plan sélectionné",
      connected: "Connecté",
      notConnected: "À connecter",
      openDesk: "Ouvrir le desk",
      logout: "Se déconnecter",
    },
    ru: {
      title: "Дашборд клиента",
      subtitle: "Профиль, план и статус доступа в одном месте.",
      currentPlan: "Текущий план",
      access: "Статус доступа",
      exchange: "Аккаунт exchange",
      timezone: "Часовой пояс",
      notifications: "Активные уведомления",
      payment: "Оплата",
      paymentOk: "Доступ активен",
      paymentFree: "Free активен",
      paymentReview: "TX получен",
      paymentMissing: "План не выбран",
      connected: "Подключено",
      notConnected: "Требует подключения",
      openDesk: "Открыть desk",
      logout: "Выйти из аккаунта",
    },
  });
  const paymentState = plan === "pending_payment"
    ? statusCopy.paymentReview
    : profileHasAccess(profile)
      ? statusCopy.paymentOk
      : plan === "free"
        ? statusCopy.paymentFree
        : statusCopy.paymentMissing;

  if (!profile) {
    return (
      <section className="settings-empty">
        <p className="eyebrow">Client profile</p>
        <h3>{t.settings_empty_title}</h3>
        <button onClick={onActivateFree}>{t.settings_empty_btn}</button>
      </section>
    );
  }

  return (
    <section className="client-account-summary">
      <div className="client-account-main">
        <div className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="eyebrow">{profile.email}</p>
          <h3>{profile.name}</h3>
          <span>{statusCopy.currentPlan}: {plan.replace("_", " ")}</span>
        </div>
      </div>
      <div className="client-account-kpis">
        <article><span>{statusCopy.access}</span><strong>{accessState}</strong></article>
        <article><span>{statusCopy.payment}</span><strong>{paymentState}</strong></article>
        <article><span>{statusCopy.timezone}</span><strong>{profile.timezone ?? "Europe/Rome"}</strong></article>
        <article><span>{statusCopy.notifications}</span><strong>{(["valueBets", "dailyReport", "paymentUpdates", "securityAlerts"] as const).filter(k => notifications[k]).length}/4</strong></article>
      </div>
      {plan === "pending_payment" && profile.txHash && profile.txHash !== "test" && (
        <div className="client-account-note">
          <span>{t.pending_tx_label}</span>
          <code>{profile.txHash.length > 24 ? `${profile.txHash.slice(0, 12)}...${profile.txHash.slice(-8)}` : profile.txHash}</code>
        </div>
      )}
      {/* #UI-PLANS-CTA-0623: CTA upgrade diretto ai piani per chi non è ancora Pro */}
      {!profileHasPremium(profile) && (
        <button className="plan-action" type="button" onClick={onUpgrade}>
          {profileHasAccess(profile)
            ? pick5(lang, { it: "Passa a Pro", en: "Upgrade to Pro", es: "Pasar a Pro", fr: "Passer à Pro", ru: "Перейти на Pro" })
            : pick5(lang, { it: "Vedi i piani", en: "See plans", es: "Ver planes", fr: "Voir les offres", ru: "Смотреть тарифы" })}
        </button>
      )}
      {process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" && profileHasAccess(profile) && (
        <button className="btn-secondary" type="button" onClick={openBillingPortal}>
          {pick5(lang, { it: "Gestisci abbonamento", en: "Manage subscription", es: "Gestionar suscripción", fr: "Gérer l'abonnement", ru: "Управление подпиской" })}
        </button>
      )}
    </section>
  );
}

// FAQ + Assistenza in fondo alla scheda Account — blocchi collassabili, non
// sotto-tab a sé: contenuto riusato (SupportHub + FAQ), zero route nuove.
function AccountHelpFooter() {
  const lang = useLang();
  return (
    <div className="account-help-footer">
      <details className="account-help-acc">
        <summary>FAQ</summary>
        <FAQTab />
      </details>
      <details className="account-help-acc">
        <summary>{pick5(lang, { it: "Assistenza", en: "Support", es: "Asistencia", fr: "Assistance", ru: "Поддержка" })}</summary>
        <AssistanceTab />
      </details>
    </div>
  );
}

// ─── Account Tab (unione Client Area + Impostazioni + Assistenza + FAQ) ─────────

// #UI-ACCOUNT-DROPDOWN-0623: menu account a tendina dal pill in alto a dx.
// Pannello ricco theme-aware: intestazione (nome+email SOLA LETTURA + piano),
// card piano (stato + azione → tab Plans), preferenze inline (notifiche auto-save
// + lingua), footer (aiuto → Tawk + esci). Chiude su click-fuori / Esc. Riusa i
// contratti esistenti (save profilo, logout, piani). Nessuna modifica libera di
// nome/email (scelta Andrea: niente "cambia nome quando vuoi").
function AccountMenu({
  profile,
  lang,
  planLabel,
  onLogout,
  onGoToPlans,
  onSelectLang,
}: {
  profile: ClientProfile;
  lang: Lang;
  planLabel: string;
  onLogout: () => void;
  onGoToPlans: () => void;
  onSelectLang: (l: Lang) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const isPremium = profileHasPremium(profile);
  const isAccess = profileHasAccess(profile);
  const daysLeft = profile.planExpiresAt && isAccess && profile.plan !== "admin_full"
    ? Math.max(0, Math.ceil((new Date(profile.planExpiresAt).getTime() - Date.now()) / 86400000))
    : null;
  const planName = isPremium ? "BetRedge Pro" : isAccess ? "BetRedge Base" : profile.plan === "free" ? "BetRedge Free" : "Setup";
  const planStatus = daysLeft != null
    ? pick5(lang, { it: `scade tra ${daysLeft}g`, en: `${daysLeft}d left`, es: `caduca en ${daysLeft}d`, fr: `expire dans ${daysLeft}j`, ru: `осталось ${daysLeft}д` })
    : isPremium || isAccess
    ? pick5(lang, { it: "attivo", en: "active", es: "activo", fr: "actif", ru: "активен" })
    : pick5(lang, { it: "gratis", en: "free", es: "gratis", fr: "gratuit", ru: "бесплатно" });
  const LANG_LABEL: Record<Lang, string> = { it: "Italiano", en: "English", es: "Español", fr: "Français", ru: "Русский" };
  const TEAM_EMAIL = "info@betredge.com";

  return (
    <div className="acct-menu-wrap" ref={wrapRef}>
      <button className="am-acct" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {profile.name}
        <span className="plan">{planLabel}</span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-menu-head">
            <div className="acct-menu-id">
              <div className="acct-menu-name">{profile.name}</div>
              <div className="acct-menu-email">{profile.email}</div>
            </div>
            <span className={`acct-menu-badge plan-${planLabel.toLowerCase()}`}>{planLabel}</span>
          </div>

          <div className="acct-menu-plan">
            <div className="amp-info">
              <div className="amp-title">{planName}</div>
              <div className="amp-status">{planStatus}</div>
            </div>
            <button className="amp-action" onClick={() => { setOpen(false); onGoToPlans(); }}>
              {isPremium
                ? pick5(lang, { it: "Gestisci", en: "Manage", es: "Gestionar", fr: "Gérer", ru: "Управлять" })
                : pick5(lang, { it: "Vedi i piani", en: "See plans", es: "Ver planes", fr: "Voir les offres", ru: "Тарифы" })} →
            </button>
          </div>

          <div className="acct-menu-prefs">
            <div className="acct-pref-row">
              <span>{pick5(lang, { it: "Lingua", en: "Language", es: "Idioma", fr: "Langue", ru: "Язык" })}</span>
              <select className="acct-lang-select" value={lang} onChange={(e) => onSelectLang(e.target.value as Lang)}>
                {(["en", "it", "es", "fr", "ru"] as Lang[]).map((l) => (
                  <option key={l} value={l}>{LANG_LABEL[l]}</option>
                ))}
              </select>
            </div>

            {/* #UI-ACCOUNT-FAQ-0623: FAQ + Contatta il team al posto dei toggle notifiche. */}
            <details className="acct-menu-faq">
              <summary>FAQ</summary>
              <div className="acct-menu-faq-body"><FAQTab /></div>
            </details>

            <a className="acct-menu-contact" href={`mailto:${TEAM_EMAIL}`}>
              <span>{pick5(lang, { it: "Contatta il team", en: "Contact the team", es: "Contacta al equipo", fr: "Contacter l'équipe", ru: "Связаться с командой" })}</span>
              <span className="acct-contact-mail">{TEAM_EMAIL}</span>
            </a>
          </div>

          <div className="acct-menu-foot acct-menu-foot-end">
            <button type="button" className="acct-menu-logout" onClick={() => { setOpen(false); onLogout(); }}>
              {pick5(lang, { it: "Esci", en: "Log out", es: "Cerrar sesión", fr: "Se déconnecter", ru: "Выйти" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// #REFERRAL-PANEL (item 3) — Account → "Invita". Model per #PRICING-CREATORS-0706:
// the creator shares betredge.com/r/CODE; sign-ups with that code are attributed
// via profiles.referred_by (first-touch). Follower gets the launch −50% (same for
// everyone), creator sees a counter; per-code revenue is a backend toggle on
// request. Code is self-declared + remembered in localStorage — persisting a
// referral_code on the profile is a gated follow-up.
function ReferralPanel() {
  const lang = useLang();
  // #REFERRAL-HARDENING: il codice ora si CLAIMA una volta sola sul profilo
  // (POST /api/referral/claim, migration 013) e le stats rispondono SOLO per
  // il proprio codice claimato: niente piu' ?code= arbitrario (enumerazione,
  // audit #1). Stati: loading -> unclaimed (input+claim) -> claimed (link+stats).
  const [phase, setPhase] = useState<"loading" | "unclaimed" | "claimed">("loading");
  const [code, setCode] = useState("");
  const [claimedCode, setClaimedCode] = useState<string | null>(null);
  const [stats, setStats] = useState<{ signups: number; paid: number } | null>(null);
  const [statsErr, setStatsErr] = useState(false);
  const [claimErr, setClaimErr] = useState<"taken" | "invalid" | "generic" | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStats = () => {
    fetch("/api/referral/stats", { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          setClaimedCode(typeof d?.code === "string" ? d.code : null);
          setStats({ signups: Number(d?.signups) || 0, paid: Number(d?.paid) || 0 });
          setPhase("claimed");
        } else if (r.status === 403) {
          setPhase("unclaimed"); // nessun codice claimato: mostra il claim
        } else {
          setPhase("unclaimed");
          setStatsErr(true);
        }
      })
      .catch(() => { setPhase("unclaimed"); setStatsErr(true); });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount load
  useEffect(() => { loadStats(); }, []);

  const normalized = code.trim().toUpperCase();
  const valid = /^[A-Z0-9_-]{2,20}$/.test(normalized);
  const shownCode = claimedCode ?? "";
  const link = shownCode && typeof window !== "undefined" ? `${window.location.origin}/r/${shownCode}` : "";

  const claim = async () => {
    if (!valid || busy) return;
    setBusy(true); setClaimErr(null);
    try {
      const r = await fetch("/api/referral/claim", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ code: normalized }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setClaimedCode(String(d?.code ?? normalized));
        setPhase("claimed");
        loadStats();
        trackEvent("referral_code_claimed", { meta: { code: normalized } });
      } else if (r.status === 409 && d?.code) {
        // Avevi gia' un codice (magari claimato da un altro device): usalo.
        setClaimedCode(String(d.code));
        setPhase("claimed");
        loadStats();
      } else if (r.status === 409) {
        setClaimErr("taken");
      } else if (r.status === 400) {
        setClaimErr("invalid");
      } else {
        setClaimErr("generic");
      }
    } catch {
      setClaimErr("generic");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); } catch { /* clipboard denied: link shown below anyway */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    trackEvent("referral_link_copied", { meta: { code: shownCode } });
  };

  const c = pick5(lang, {
    it: { title: "Invita", intro: "Condividi il tuo link: chi si iscrive col tuo codice ti viene attribuito.", promo: "I nuovi iscritti hanno la promo di lancio −50% sul primo acquisto (uguale per tutti): lo sconto si applica da solo al checkout.", codeLabel: "Scegli il tuo codice creator", placeholder: "ILTUOCODICE", hint: "2–20 caratteri: lettere, numeri, - _ · una volta scelto non si cambia", claimBtn: "Riserva il codice", claimBusy: "Riservo…", errTaken: "Codice già preso: scegline un altro.", errInvalid: "Codice non valido (2–20 caratteri: lettere, numeri, - _).", errGeneric: "Errore momentaneo, riprova.", yourCode: "Il tuo codice", linkLabel: "Il tuo link di invito", copy: "Copia link", copied: "Copiato ✓", signups: "Iscritti col tuo codice", paid: "Di cui abbonati", statsErr: "Statistiche non disponibili al momento.", loading: "Carico…", note: "Guadagni sugli abbonamenti dei tuoi iscritti solo se attiviamo la revenue sul tuo codice — scrivici per richiederla." },
    en: { title: "Invite", intro: "Share your link: anyone who signs up with your code is attributed to you.", promo: "New sign-ups get the −50% launch promo on their first purchase (same for everyone): the discount applies automatically at checkout.", codeLabel: "Choose your creator code", placeholder: "YOURCODE", hint: "2–20 chars: letters, numbers, - _ · cannot be changed once claimed", claimBtn: "Claim code", claimBusy: "Claiming…", errTaken: "Code already taken — pick another.", errInvalid: "Invalid code (2–20 chars: letters, numbers, - _).", errGeneric: "Temporary error, try again.", yourCode: "Your code", linkLabel: "Your invite link", copy: "Copy link", copied: "Copied ✓", signups: "Sign-ups with your code", paid: "Subscribers among them", statsErr: "Stats unavailable right now.", loading: "Loading…", note: "You earn on your sign-ups' subscriptions only if we enable revenue on your code — reach out to request it." },
    es: { title: "Invitar", intro: "Comparte tu link: quien se registre con tu código se te atribuye.", promo: "Los nuevos registros tienen la promo de lanzamiento −50% en su primera compra (igual para todos): el descuento se aplica solo al finalizar la compra.", codeLabel: "Elige tu código de creator", placeholder: "TUCODIGO", hint: "2–20 caracteres: letras, números, - _ · no se puede cambiar", claimBtn: "Reservar código", claimBusy: "Reservando…", errTaken: "Código ya ocupado: elige otro.", errInvalid: "Código no válido (2–20 caracteres: letras, números, - _).", errGeneric: "Error momentáneo, reintenta.", yourCode: "Tu código", linkLabel: "Tu link de invitación", copy: "Copiar link", copied: "Copiado ✓", signups: "Registros con tu código", paid: "De ellos, suscriptores", statsErr: "Estadísticas no disponibles ahora.", loading: "Cargando…", note: "Ganas con las suscripciones de tus registros solo si activamos la revenue en tu código — escríbenos para solicitarla." },
    fr: { title: "Inviter", intro: "Partagez votre lien : toute inscription avec votre code vous est attribuée.", promo: "Les nouveaux inscrits ont la promo de lancement −50% sur leur premier achat (identique pour tous) : la réduction s'applique automatiquement au paiement.", codeLabel: "Choisissez votre code creator", placeholder: "VOTRECODE", hint: "2–20 caractères : lettres, chiffres, - _ · définitif une fois réservé", claimBtn: "Réserver le code", claimBusy: "Réservation…", errTaken: "Code déjà pris — choisissez-en un autre.", errInvalid: "Code invalide (2–20 caractères : lettres, chiffres, - _).", errGeneric: "Erreur momentanée, réessayez.", yourCode: "Votre code", linkLabel: "Votre lien d'invitation", copy: "Copier le lien", copied: "Copié ✓", signups: "Inscriptions avec votre code", paid: "Dont abonnés", statsErr: "Statistiques indisponibles pour le moment.", loading: "Chargement…", note: "Vous gagnez sur les abonnements de vos inscrits uniquement si nous activons la revenue sur votre code — contactez-nous pour la demander." },
    ru: { title: "Пригласить", intro: "Поделитесь ссылкой: каждый, кто зарегистрируется по вашему коду, закрепляется за вами.", promo: "Новые регистрации получают промо запуска −50% на первую покупку (для всех одинаково): скидка применяется автоматически при оплате.", codeLabel: "Выберите ваш код креатора", placeholder: "YOURCODE", hint: "2–20 символов: латинские буквы, цифры, - _ · нельзя изменить после", claimBtn: "Занять код", claimBusy: "Резервирую…", errTaken: "Код уже занят — выберите другой.", errInvalid: "Неверный код (2–20 символов).", errGeneric: "Временная ошибка, попробуйте ещё раз.", yourCode: "Ваш код", linkLabel: "Ваша ссылка-приглашение", copy: "Скопировать ссылку", copied: "Скопировано ✓", signups: "Регистраций по вашему коду", paid: "Из них подписчиков", statsErr: "Статистика сейчас недоступна.", loading: "Загрузка…", note: "Вы зарабатываете на подписках приглашённых только если мы включим revenue для вашего кода — напишите нам, чтобы запросить." },
  });

  return (
    <div className="account-bento">
      <div className="am-card p-5 space-y-4" style={{ gridColumn: "1 / -1" }}>
        <div className="space-y-1">
          <p className="eyebrow">{c.title}</p>
          <p className="text-xs font-mono text-[var(--am-muted-2)] max-w-lg">{c.intro}</p>
          {/* #PRELAUNCH-AUDIT: il claim −50% appare SOLO quando la promo è davvero
              attiva (stesso flag del LaunchPromoBanner) → niente deceptive pricing. */}
          {process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED === "true" && (
            <p className="text-xs font-mono text-[var(--am-muted-2)] max-w-lg">{c.promo}</p>
          )}
        </div>
        {phase === "loading" && (
          <p className="text-[10px] font-mono text-[var(--am-muted-2)]">{c.loading}</p>
        )}
        {phase === "unclaimed" && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono text-[var(--am-muted)]">{c.codeLabel}</p>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setClaimErr(null); }}
              placeholder={c.placeholder}
              className="mb-input"
              maxLength={20}
            />
            <p className="text-[10px] font-mono text-[var(--am-muted-2)]">{c.hint}</p>
            <button onClick={claim} disabled={!valid || busy} className="mb-cta">
              {busy ? c.claimBusy : c.claimBtn}
            </button>
            {claimErr && (
              <p className="text-[10px] font-mono" style={{ color: "var(--am-coral)" }}>
                {claimErr === "taken" ? c.errTaken : claimErr === "invalid" ? c.errInvalid : c.errGeneric}
              </p>
            )}
          </div>
        )}
        {phase === "claimed" && (
          <>
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-[var(--am-muted)]">{c.yourCode}</p>
              <p className="mb-link">{shownCode}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-[var(--am-muted)]">{c.linkLabel}</p>
              <p className="mb-link">{link}</p>
              <button onClick={copyLink} className="mb-cta">{copied ? c.copied : c.copy}</button>
            </div>
            <div className="flex gap-3">
              <div className="am-surface p-3 flex-1 text-center">
                <div className="text-2xl font-black font-mono text-[var(--am-coral)]">{statsErr ? "—" : stats ? stats.signups : "…"}</div>
                <div className="text-[10px] font-mono text-[var(--am-muted-2)]">{c.signups}</div>
              </div>
              <div className="am-surface p-3 flex-1 text-center">
                <div className="text-2xl font-black font-mono text-[var(--am-coral)]">{statsErr ? "—" : stats ? stats.paid : "…"}</div>
                <div className="text-[10px] font-mono text-[var(--am-muted-2)]">{c.paid}</div>
              </div>
            </div>
            {statsErr && (
              <p className="text-[10px] font-mono text-[var(--am-muted-2)]">{c.statsErr}</p>
            )}
          </>
        )}
        <p className="text-[10px] font-mono text-[var(--am-muted-2)] border-t pt-3" style={{ borderColor: "var(--am-line)" }}>{c.note}</p>
      </div>
    </div>
  );
}

function AccountTab({
  profile,
  onOpenDesk,
  onPaymentSubmit,
  onActivateFree,
  onLogout,
  onUnlock,
  onSave,
  section,
  onSectionChange,
}: {
  profile: ClientProfile | null;
  onOpenDesk: () => void;
  onPaymentSubmit: (plan: PublicPlanKey) => void;
  onActivateFree: () => void;
  onLogout: () => void;
  onUnlock: () => void;
  onSave: (profile: ClientProfile) => void;
  section: AccountSection;
  onSectionChange: (s: AccountSection) => void;
}) {
  const lang = useLang();
  const sections: { key: AccountSection; label: string }[] = [
    { key: "account", label: "Account" },
    { key: "piani",   label: pick5(lang, { it: "Piani", en: "Plans", es: "Planes", fr: "Offres", ru: "Тарифы" }) },
  ];
  return (
    <div className="account-tab">
      <div className="segmented-filter account-subnav">
        {sections.map((s) => (
          <button
            key={s.key}
            className={section === s.key ? "is-active" : ""}
            onClick={() => onSectionChange(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "account" && (
        <div className="account-bento">
          <div className="ab-plan"><ClientAreaTab profile={profile} onActivateFree={onActivateFree} onUpgrade={() => onSectionChange("piani")} /></div>
          <div className="ab-settings"><SettingsTab profile={profile} onUnlock={onUnlock} onSave={onSave} /></div>
          {profile && (
            <div className="am-card ab-logout p-4 flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-[var(--am-muted-2)]">
                {pick5(lang, { it: "Sessione", en: "Session", es: "Sesión", fr: "Session", ru: "Сессия" })}
              </span>
              <button className="btn-secondary" onClick={onLogout}>
                {pick5(lang, { it: "Esci dall'account", en: "Log out", es: "Cerrar sesión", fr: "Se déconnecter", ru: "Выйти" })}
              </button>
            </div>
          )}
          <div className="ab-help"><AccountHelpFooter /></div>
        </div>
      )}
      {section === "piani" && (
        <PlansTab
          profile={profile}
          onOpenDesk={onOpenDesk}
          onPaymentSubmit={onPaymentSubmit}
          onActivateFree={onActivateFree}
        />
      )}
    </div>
  );
}

// ─── Unified Bets Tab ─────────────────────────────────────────────────────────

// ─── Live Now strip (#021) ────────────────────────────────────────────────────
// Matches currently in play, with REAL scores: football from /api/live
// (football-data.org, incl. World Cup), tennis from /api/tennis-live (ESPN,
// curated like the board). Matches that have kicked off leave the upcoming
// board (starts_at filter) — this strip is where they live until settlement
// moves them into history automatically. Renders nothing when nothing is live.
function LiveNowStrip({
  liveScores,
  liveTennis,
  boardTennisKeys,
  lang,
}: {
  liveScores: Record<string, LiveScore>;
  liveTennis: LiveTennisMatch[];
  boardTennisKeys: Set<string>;
  lang: string;
}) {
  const liveFootball = Object.entries(liveScores).filter(
    ([, s]) =>
      (s.match_status === "IN_PLAY" || s.match_status === "PAUSED") &&
      s.home_team && s.away_team
  );
  // Show only live tennis matches that also exist on the board (parity with /api/tennis board).
  const liveTennisOnBoard = liveTennis.filter((m) =>
    boardTennisKeys.has(tennisPairKey(m.player1, m.player2))
  );
  if (liveFootball.length === 0 && liveTennisOnBoard.length === 0) return null;

  const setsLabel = (m: LiveTennisMatch) =>
    m.sets_p1.map((v, i) => `${v}-${m.sets_p2[i] ?? ""}`).join(" ");

  return (
    <div className="am-ticker">
      <span className="t-lab"><span className="pulse" />In play</span>
      <div className="scroll">
        {liveFootball.map(([id, s]) => (
          <span key={`f-${id}`} className="ti">
            <SportIcon sport="football" size={13} className="ig" variant="sm" />
            {s.home_team} <b>{s.home_score ?? "–"}–{s.away_score ?? "–"}</b> {s.away_team}
            {s.match_status === "PAUSED" ? (
              <span className="m">HT</span>
            ) : s.minute != null ? (
              <span className="m">{s.minute}′</span>
            ) : null}
          </span>
        ))}
        {liveTennisOnBoard.map((m) => (
          <span key={`t-${m.id}`} className="ti">
            <SportIcon sport="tennis" size={13} className="ig" variant="sm" />
            {m.player1} <b>{setsLabel(m) || "–"}</b> {m.player2}
            <span className="m">{m.status_detail}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Featured "Edge del giorno" (focal card) ─────────────────────────────────
// Presentational focal block from the sleek-coral mockup (.featured). Picks the
// single highest-edge value bet across football + tennis and renders the big
// coral probability, the pick, the edge chip, and the model "why" on the right.
// Gating: full content only when premium; otherwise a teaser/locked variant
// that never exposes the pick name or the probability.
// On-brand partner/ad banner. Honest "Sponsorizzato · Partner" label (affiliate
// disclosure), sober surface, single coral accent on the CTA — not a garish ad.
function FeaturedEdge({
  predictions,
  tennisMatches,
  isPremiumClient,
  onGate,
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  isPremiumClient?: boolean;
  onGate?: () => void;
}) {
  const lang = useLang();
  const it = lang === "it";

  // The day's standout pick. Prefer a real value bet (passes the board's
  // best-bet gate); if none qualifies right now (e.g. season pause), fall back
  // to the highest-edge visible market that still has a model selection, so the
  // card is present whenever there's a pick to show. Numbers stay real.
  // Rank by the SAME metric the card shows — the model edge (margin of the
  // pick over the 2nd-best outcome). Before, the card was ranked by market
  // edge but displayed model edge, so the headline number looked disconnected
  // from the fixture. Now the number is genuinely the day's max and matches
  // the match on screen. Numbers stay real; framing stays "model edge".
  const footballModelEdge = (p: Prediction) => {
    const probs = [p.p_home, p.p_draw, p.p_away].filter((v) => Number.isFinite(v)).sort((a, b) => b - a);
    return probs.length >= 2 ? modelEdge(probs[0], probs[1]) : 0;
  };
  const tennisModelEdge = (m: TennisMatch) =>
    Number.isFinite(m.p1) && Number.isFinite(m.p2) ? modelEdge(Math.max(m.p1, m.p2), Math.min(m.p1, m.p2)) : 0;
  const byFootballEdge = (a: Prediction, b: Prediction) => footballModelEdge(b) - footballModelEdge(a);
  const byTennisEdge = (a: TennisMatch, b: TennisMatch) => tennisModelEdge(b) - tennisModelEdge(a);
  const footballValue = predictions.filter(isFootballBestBet).sort(byFootballEdge);
  const tennisValue = tennisMatches.filter(isTennisBestBet).sort(byTennisEdge);
  const footballAny = predictions
    .filter((p) => p.best_selection && isBoardVisibleMarket(p.kickoff))
    .sort(byFootballEdge);
  const tennisAny = tennisMatches
    .filter((m) => m.best_selection && isTennisMarketVisible(m.scheduled))
    .sort(byTennisEdge);
  const topFootball = footballValue[0] ?? footballAny[0];
  const topTennis = tennisValue[0] ?? tennisAny[0];

  const fEdge = topFootball ? footballModelEdge(topFootball) : -Infinity;
  const tEdge = topTennis ? tennisModelEdge(topTennis) : -Infinity;
  if (!topFootball && !topTennis) return null;
  const sport: "football" | "tennis" = fEdge >= tEdge ? "football" : "tennis";

  // Common presentational fields, resolved per sport.
  let fixtureName: React.ReactNode;
  let league: string;
  let probability: number;
  let pickName: string;
  let modelEdgePts: number;
  let why: string;
  const metrics: { dt: string; dd: React.ReactNode }[] = [];

  if (sport === "football" && topFootball) {
    const p = topFootball;
    fixtureName = (
      <>
        {p.home_team}
        <span className="vsmid"> {it ? "contro" : "vs"} </span>
        {p.away_team}
      </>
    );
    league = p.league_name;
    // Coherence (FTC): pick, probability, model-edge chip and the "why" prose
    // must all describe the SAME selection. The model-edge margin and
    // buildFootballWhy both narrate the model's top-probability outcome, so the
    // pick shown here must be that outcome too — NOT best_selection, which can
    // be a market value bet on the underdog. That mismatch produced a card that
    // named a 15% underdog, showed "+46.7pt model edge" (the favourite's
    // margin) and read "value on the home side" (the opposite team).
    const fRanked = [
      { name: p.home_team, v: p.p_home },
      { name: it ? "Pareggio" : "Draw", v: p.p_draw },
      { name: p.away_team, v: p.p_away },
    ].filter((s) => Number.isFinite(s.v)).sort((a, b) => b.v - a.v);
    pickName = fRanked[0]?.name ?? p.home_team;
    probability = fRanked[0]?.v ?? p.p_home;
    // Model edge = margin of the picked (top) outcome over the 2nd-best — the
    // uniform metric used on every card; a real market edge stays in the prose.
    modelEdgePts = fRanked.length >= 2 ? modelEdge(fRanked[0].v, fRanked[1].v) : 0;
    why = buildFootballWhy(p, lang);
    const fh = teamFormCounts(p.enrichment?.form_home);
    const fa = teamFormCounts(p.enrichment?.form_away);
    const mH = p.enrichment?.matches?.home, mA = p.enrichment?.matches?.away;
    if (fh && fa) {
      const fmt = (f: { w: number; d: number; l: number }) =>
        it ? `${f.w}V·${f.d}P·${f.l}S` : `${f.w}W·${f.d}D·${f.l}L`;
      metrics.push({ dt: it ? "Forma (5)" : "Form (5)", dd: <>{fmt(fh)} <span className="vs">vs</span> {fmt(fa)}</> });
    }
    if (mH != null && mA != null) {
      metrics.push({ dt: it ? "Campione" : "Sample", dd: <span className="tnum">{mH} <span className="vs">vs</span> {mA}</span> });
    }
  } else {
    const m = topTennis as TennisMatch;
    fixtureName = (
      <>
        {m.player1}
        <span className="vsmid"> {it ? "contro" : "vs"} </span>
        {m.player2}
      </>
    );
    const surf = it
      ? (m.surface === "CLAY" ? "terra" : m.surface === "GRASS" ? "erba" : "cemento")
      : (m.surface === "CLAY" ? "clay" : m.surface === "GRASS" ? "grass" : "hard");
    league = `${m.tournament} · ${surf} · ${m.round}`;
    // Coherence (FTC): pick, probability, model-edge and buildTennisWhy (which
    // narrates the higher-probability player as the favourite) must all point
    // at the same selection — the model's top player, not best_selection.
    const p1Fav = m.p1 >= m.p2;
    pickName = p1Fav ? m.player1 : m.player2;
    probability = Math.max(m.p1, m.p2);
    modelEdgePts = Number.isFinite(m.p1) && Number.isFinite(m.p2) ? modelEdge(Math.max(m.p1, m.p2), Math.min(m.p1, m.p2)) : 0;
    why = buildTennisWhy(m, lang);
    if (m.elo_p1 != null && m.elo_p2 != null) {
      metrics.push({ dt: it ? `Rating ${surf}` : `Rating ${surf}`, dd: <span className="tnum">{Math.round(m.elo_p1)} <span className="vs">·</span> {Math.round(m.elo_p2)}</span> });
    }
    if (m.surface_matches_p1 != null && m.surface_matches_p2 != null) {
      metrics.push({ dt: it ? "Match superficie" : "Surface matches", dd: <span className="tnum">{m.surface_matches_p1} <span className="vs">·</span> {m.surface_matches_p2}</span> });
    }
  }

  const eyebrow = it ? "Edge del giorno · il modello vs il mercato" : "Edge of the day · model vs market";

  // Locked / teaser variant — never expose pick name or probability.
  if (!isPremiumClient) {
    return (
      <section className="featured featured-locked" aria-label={eyebrow}>
        <div className="big">
          <div className="eyebrow"><span className="dot" /> {eyebrow}</div>
          <div className="fxrow">
            <SportIcon sport={sport} size={20} className="sgi" />
            <span className="fxname">{fixtureName}</span>
          </div>
          <div className="league">{league}</div>
          <div className="hero-prob">
            <span className="num blurred" aria-hidden="true">··<span className="pc">%</span></span>
            <div className="col">
              <span className="pickname locked-text">{it ? "Pick bloccato" : "Pick locked"}</span>
              <span className="subl">{it ? "probabilità del modello" : "model probability"}</span>
            </div>
          </div>
          <button className="featured-unlock" onClick={() => onGate?.()}>
            {it ? "Edge del giorno bloccato — sblocca con Pro →" : "Edge of the day locked — unlock with Pro →"}
          </button>
        </div>
        <div className="seam" />
        <div className="why">
          <div className="wlab"><span className="tri">▸</span> {it ? "Perché il modello sceglie questo pick" : "Why the model picks this"}</div>
          <p className="line locked-blur" aria-hidden="true">
            {it
              ? "L'analisi completa — rating, campione, testa a testa e narrativa — è riservata agli abbonati Pro."
              : "The full breakdown — rating, sample, head-to-head and narrative — is reserved for Pro members."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="featured" aria-label={eyebrow}>
      <div className="big">
        <div className="eyebrow"><span className="dot" /> {eyebrow}</div>
        <div className="fxrow">
          <SportIcon sport={sport} size={20} className="sgi" />
          <span className="fxname">{fixtureName}</span>
        </div>
        <div className="league">{league}</div>
        <div className="hero-prob">
          <span className="num tnum">{Math.round(probability * 100)}<span className="pc">%</span></span>
          <div className="col">
            <span className="pickname">{pickName}</span>
            <span className="subl">{it ? "probabilità del modello" : "model probability"}</span>
          </div>
        </div>
        <span className="edge model">
          <svg aria-hidden="true"><use href="#g-bolt" /></svg>
          +{modelEdgePts.toFixed(1)} pt · {it ? "edge modello" : "model edge"}
        </span>
      </div>
      <div className="seam" />
      <div className="why">
        <div className="wlab"><span className="tri">▸</span> {it ? `Perché il modello sceglie ${pickName}` : `Why the model picks ${pickName}`}</div>
        {metrics.length > 0 && (
          <dl>
            {metrics.map((m, i) => (
              <div className="it" key={i}><dt>{m.dt}</dt><dd>{m.dd}</dd></div>
            ))}
          </dl>
        )}
        <p className="line">{why}</p>
      </div>
    </section>
  );
}

function UnifiedBetsTab({
  predictions,
  fpOdds,
  tennisMatches,
  onSelect,
  onBetNow,
  onSignIn,
  onRegister,
  onGate,
  isSignalPreviewUnlocked,
  isFreeClient,
  isPremiumClient,
  isLoggedIn,
  tennisIsPlaceholder,
  onBannerCta,
  hitRate,
}: {
  predictions: Prediction[];
  fpOdds: Record<string, FpOddsEntry>;
  tennisMatches: TennisMatch[];
  onSelect: (s: SlipSelection) => void;
  onBetNow?: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  onGate?: () => void;
  isSignalPreviewUnlocked: boolean;
  isFreeClient: boolean;
  isPremiumClient?: boolean;
  isLoggedIn: boolean;
  tennisIsPlaceholder?: boolean;
  onBannerCta?: (href: string) => boolean;
  hitRate?: string | null;
}) {
  const lang = useLang();

  return (
    <>
      {!isLoggedIn && (
        <div className="flex items-center justify-between gap-3 mx-4 mt-3 mb-0 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-xs font-mono text-gray-300">
          <span>{pick5(lang, { it: "Registrati per salvare le selezioni, ricevere alert e sbloccare l'execution automatica.", en: "Register to save selections, get alerts and unlock auto-execution.", es: "Regístrate para guardar selecciones, recibir alertas y desbloquear la ejecución automática.", fr: "Inscrivez-vous pour enregistrer vos sélections, recevoir des alertes et débloquer l'exécution automatique.", ru: "Зарегистрируйтесь, чтобы сохранять выборы, получать оповещения и открыть авто-исполнение." })}</span>
          <div className="flex gap-2 shrink-0">
            <button className="btn-secondary" style={{ fontSize: "11px", padding: "3px 10px" }} onClick={onSignIn}>{pick5(lang, { it: "Accedi", en: "Sign In", es: "Acceder", fr: "Connexion", ru: "Войти" })}</button>
            <button className="btn-primary" style={{ fontSize: "11px", padding: "3px 10px" }} onClick={onRegister}>{pick5(lang, { it: "Registrati", en: "Register", es: "Registrarse", fr: "S'inscrire", ru: "Регистрация" })}</button>
          </div>
        </div>
      )}
      {/* Whole-board access wall: anonymous and free/pending see the board
          blurred behind a single login/plan overlay (the per-card `locked`
          projection already strips the picks server-side; this hides the
          matchups too). Leaderboard and the public Old-bets history stay
          outside the gate. Unlock = active plan (profileHasAccess). */}
      {/* #BANNERS-IN-GRID: rimossa la banda house full-width sopra la board (topbar,
          lasciava gutter ai lati). I banner house ora vivono SOLO intercalati tra le
          schede bet, impacchettati come tile della griglia. */}
      {/* Free (signal-preview) clients pass the whole-board wall so the inner
          per-card free preview renders (1 pick/sport + free-preview-wall);
          anonymous (no profile → no signal preview) still hits the auth wall,
          and pending_payment still hits the plan wall. */}
      <LockedGate
        isUnlocked={Boolean(isPremiumClient || isSignalPreviewUnlocked)}
        mode={isLoggedIn ? "plan" : "auth"}
        onUnlock={() => onGate?.()}
      >
        <SportsbookBoard
          predictions={predictions}
          fpOdds={fpOdds}
          tennisMatches={tennisMatches}
          onSelect={onSelect}
          onBetNow={onBetNow}
          onGate={onGate}
          isFreeClient={isFreeClient}
          isPremium={isPremiumClient}
          tennisIsPlaceholder={tennisIsPlaceholder}
          onBannerCta={onBannerCta}
          hitRate={hitRate}
        />
      </LockedGate>
    </>
  );
}

// ─── GDPR Cookie Consent Banner ──────────────────────────────────────────────

function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const lang = useLang();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync from localStorage: a lazy initializer would mismatch the server-rendered (hidden) markup at hydration.
    try { if (!localStorage.getItem("gdpr_consent")) setVisible(true); } catch { /* SSR/no-storage */ }
  }, []);
  if (!visible) return null;
  const decide = (v: "accepted" | "declined") => {
    try { localStorage.setItem("gdpr_consent", v); } catch { /* */ }
    // #PRELAUNCH-AUDIT: segnala il consenso ai client che caricano terze parti solo
    // dopo l'Accept (es. LiveChat/Tawk.to) → si attivano senza reload.
    try { window.dispatchEvent(new Event("betredge:gdpr-consent")); } catch { /* */ }
    setVisible(false);
  };
  const it = lang === "it";
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "rgba(10,12,18,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)",
      padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", backdropFilter: "blur(8px)" }}>
      <p style={{ color: "#94a3b8", fontSize: "11px", fontFamily: "monospace", flex: 1, minWidth: "200px", margin: 0 }}>
        {it ? "Usiamo cookie per migliorare l'esperienza. I link ai bookmaker partner possono essere affiliati — potremmo ricevere una commissione, senza costi aggiuntivi per te."
            : "We use cookies to improve your experience. Links to partner sportsbooks may be affiliate links — we may earn a commission at no extra cost to you."}
      </p>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button onClick={() => decide("declined")} style={{ fontSize: "10px", fontFamily: "monospace", padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", cursor: "pointer" }}>
          {it ? "Rifiuta" : "Decline"}
        </button>
        <button onClick={() => decide("accepted")} style={{ fontSize: "10px", fontFamily: "monospace", padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(99,212,255,0.4)", background: "rgba(99,212,255,0.08)", color: "#67e8f9", cursor: "pointer" }}>
          {it ? "Accetta" : "Accept"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const VALID_TABS: readonly Tab[] = ["bets", "plans", "history", "leaderboard", "match-builder", "invita"];

// #UI-ACCOUNT-DROPDOWN-0623: la vecchia tab "account" è ora il dropdown; i deep-link
// legacy (?tab=account, banner ?tab=account&plans=1) atterrano sulla tab Plans.
// #PARTNER-REMOVE-0626: la tab Partner è stata rimossa; i deep-link legacy
// ?tab=partner(s) ricadono sul board (default), nessun alias.
const TAB_ALIASES: Record<string, Tab> = { account: "plans" };

export default function Dashboard() {
  // ?tab= deep-link (#021 hotfix): lets external pages (e.g. the World Cup
  // hub's Place Bet button) land directly on a tab. Whitelisted values only.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "bets";
    const raw = new URLSearchParams(window.location.search).get("tab");
    const requested = (raw && TAB_ALIASES[raw]) || (raw as Tab | null);
    return requested && VALID_TABS.includes(requested) ? requested : "bets";
  });
  // #QA-SERGIO-BAGS-1: i CTA dei banner house puntano a /app?tab=… ma `tab` viene
  // letto dall'URL solo al mount: un <Link> alla STESSA route (siamo già su /app)
  // non lo risincronizza → il bottone sembrava morto. Qui intercettiamo i deep-link
  // same-page e cambiamo tab in place (come la nav laterale, setTab). Gli href
  // cross-route (/world-cup, /community) tornano false → naviga il <Link>.
  const handleBannerCta = (href: string): boolean => {
    try {
      const url = new URL(href, window.location.origin);
      if (url.pathname === "/app") {
        const raw = url.searchParams.get("tab");
        const requested = (raw && TAB_ALIASES[raw]) || (raw as Tab | null);
        if (requested && VALID_TABS.includes(requested)) {
          // Deep-link legacy /app?tab=account(&plans=1) → l'alias mappa account→plans.
          setTab(requested);
          return true;
        }
      }
    } catch { /* href non parsabile: lascia fare al <Link> */ }
    return false;
  };
  const [uiLanguage, setUiLanguage] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem("agentic-lang") as Lang | null;
    return stored && LANGUAGES.includes(stored) ? stored : "en";
  });
  const selectLanguage = (next: Lang) => {
    if (next === uiLanguage) return;
    setUiLanguage(next);
    localStorage.setItem("agentic-lang", next);
    trackEvent("language_change", { language: next });
  };
  // Theme toggle (Cobalt & Coral redesign, F1) — presentation only, no logic change.
  // #UI-THEME-HARDEN-0623: il pre-paint setta data-theme, MA su /app l'idratazione
  // può resettare data-theme al valore SSR ("dark"), lasciando il desk scuro
  // nonostante la scelta light. Qui non ci limitiamo a leggere data-theme: ri-leggiamo
  // la scelta salvata (localStorage → prefers, stessa logica del pre-paint) e la
  // RI-APPLICHIAMO a data-theme, così il tema scelto vince sempre.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    let t = "";
    try { t = localStorage.getItem("agentic-theme") ?? ""; } catch {}
    if (t !== "light" && t !== "dark") {
      t = (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ri-assert post-idratazione: una lazy initializer mismatcherebbe l'HTML SSR.
    setTheme(t as "dark" | "light");
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  const toggleTheme = () => {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("agentic-theme", next); } catch {}
    trackEvent("theme_change", { meta: { theme: next } });
  };
  // #THEME-CONSISTENCY-0623: segue il tema di sistema SOLO se l'utente non ha
  // mai scelto manualmente (agentic-theme vuoto). La scelta esplicita vince e
  // persiste. Mantiene il desk allineato a home e /community sullo stesso
  // contratto. Presentazionale, nessuna logica di modello/gate.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      let chosen = "";
      try { chosen = localStorage.getItem("agentic-theme") ?? ""; } catch {}
      if (chosen === "light" || chosen === "dark") return;
      const next: "dark" | "light" = e.matches ? "light" : "dark";
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // #UI-SCROLLTOP-0623: cambiare scheda è solo client-state (setTab), quindi la
  // pagina restava ferma a metà contenuto della scheda precedente. Riporta in
  // cima a ogni cambio tab (instant). I CTA che puntano ai Piani fanno il loro
  // scrollIntoView in un doppio rAF DOPO questo reset, quindi vincono e atterrano
  // sui piani. Presentazionale.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, [tab]);

  // #AUTORELOAD: quando è live un nuovo deploy, le schede aperte si aggiornano da
  // sole. La baseline è il build-id della PRIMA risposta di /api/version (stesso
  // deploy del caricamento); se nei check successivi l'id cambia → nuovo deploy.
  // Per non interrompere chi usa l'app, la reload avviene al RIENTRO sulla scheda
  // (visibilitychange→visible). 'dev' (locale) = no-op.
  useEffect(() => {
    let baseline: string | null = null;
    let stale = false;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { id } = (await r.json()) as { id?: string };
        if (!id || id === "dev") return;
        if (baseline === null) { baseline = id; return; }  // prima risposta = baseline
        if (id !== baseline) stale = true;
      } catch { /* offline/transitorio: riprova al prossimo giro */ }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (stale) window.location.reload();
      else void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const iv = window.setInterval(check, 5 * 60 * 1000); // marca stale; la reload è al rientro
    void check(); // imposta la baseline
    return () => { document.removeEventListener("visibilitychange", onVisible); window.clearInterval(iv); };
  }, []);

  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  // #MB-1 Match Builder: shared accumulator ids (?mb=) + influencer ref (?ref=).
  // The ref is first-touch: persisted once in localStorage and attached to the
  // register payload (app/api/auth, referred_by).
  const [mbSharedIds, setMbSharedIds] = useState<string[]>([]);
  const [mbRefCode, setMbRefCode] = useState<string>("");
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = (params.get("ref") ?? "").trim().toUpperCase().slice(0, 20);
      if (/^[A-Z0-9_-]{2,20}$/.test(ref)) {
        writeRefCode(ref); // first-touch + scadenza 60gg (lib/referral-code)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync from the share-link URL params (?ref=/?mb=): runs once, paired with a localStorage write side effect.
        setMbRefCode(ref);
      }
      const mb = params.get("mb");
      if (mb) {
        setMbSharedIds(mb.split(",").filter(Boolean).slice(0, 5));
        setTab("match-builder");
      }
    } catch { /* URL/storage unavailable: no share link to restore */ }
  }, []);
  const [storedProfiles, setStoredProfiles] = useState<ClientProfile[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<ClientAuthIntent>("login");
  // True once the server-session reconcile has resolved, so we know whether the
  // visitor is anonymous before deciding to surface the sign-in/register prompt.
  const [authChecked, setAuthChecked] = useState(false);
  // #LOGIN-WALL-0626: real server-session signal (cookie), NOT clientProfile —
  // a stale localStorage profile survives an expired cookie (see the 401 branch
  // of the probe), so gating the hard auth wall on the profile would be leaky.
  const [hasSession, setHasSession] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PublicPlanKey | null>(null);
  // HIGH-3: landing from the email activation link. On success the activate
  // endpoint already set the session cookie (the hydration effect logs the user
  // in); here we just surface a notice and clean the URL. On failure we open the
  // auth modal so the user can retry / resend.
  const [activationNotice, setActivationNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const activated = params.get("activated");
      const act = params.get("activation");
      if (!activated && !act) return;
      const it = (window.localStorage.getItem("agentic-lang") ?? "en") !== "en";
      // Resolve the notice (and whether to open the auth modal) from the params,
      // then apply once. One-shot mount sync from the activation redirect URL.
      let notice: { ok: boolean; msg: string } | null = null;
      let openAuth = false;
      if (activated === "1") {
        notice = { ok: true, msg: it ? "Profilo attivato — benvenuto!" : "Profile activated — welcome!" };
      } else if (act === "already") {
        notice = { ok: true, msg: it ? "Profilo già attivo: accedi pure." : "Profile already active: please log in." };
      } else if (act) {
        notice = { ok: false, msg: act === "expired"
          ? (it ? "Link di attivazione scaduto. Reinvia l'email dal login." : "Activation link expired. Resend it from login.")
          : (it ? "Link di attivazione non valido. Riprova o reinvia l'email." : "Invalid activation link. Retry or resend the email.") };
        openAuth = true;
      }
      /* eslint-disable react-hooks/set-state-in-effect -- one-shot mount sync from the activation redirect params; paired with history.replaceState. */
      if (notice) setActivationNotice(notice);
      if (openAuth) setAuthOpen(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      window.history.replaceState({}, "", window.location.pathname);
    } catch { /* URL unavailable */ }
  }, []);
  // Deep-link auth intent (?auth=login | ?auth=register): the landing page CTAs
  // navigate here with this param so the right modal opens with the right tab
  // (login vs register) instead of the default. #LOGIN-WALL-0626: the desk auth
  // modal is force-shown for anonymous visitors anyway; this only picks the tab.
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("auth");
      if (raw !== "login" && raw !== "register") return;
      /* eslint-disable react-hooks/set-state-in-effect -- one-shot mount sync from the ?auth= deep-link param; paired with history.replaceState. */
      setAuthIntent(raw === "register" ? "create" : "login");
      setAuthOpen(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.pathname + url.search);
    } catch { /* URL/storage unavailable */ }
  }, []);
  const [founderOpen, setFounderOpen] = useState(false);
  const founderClickRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const [slipSelection, setSlipSelection] = useState<SlipSelection | null>(null);
  // #PRELAUNCH-AUDIT LEGALE-2 layer2 (Decreto Dignità): nasconde i link-book agli
  // utenti IT. Geo server-side via /api/geo-books; default false (mostra) fino alla
  // risposta, ma il grosso dell'esposizione è coperto da layer1 (dropdown) + campagne.
  const [booksBlocked, setBooksBlocked] = useState(false);
  useEffect(() => {
    fetch("/api/geo-books", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBooksBlocked(!!d?.blocked))
      .catch(() => {});
  }, []);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  // #FORTUNEPLAY-LIVE-ODDS-1: quote live FortunePlay indicizzate per team_pair_key.
  const [fpOdds, setFpOdds] = useState<Record<string, FpOddsEntry>>({});
  const [tennisMatches, setTennisMatches] = useState<TennisMatch[]>([]);
  const [tennisIsPlaceholder, setTennisIsPlaceholder] = useState(false);
  const [tennisSummary, setTennisSummary] = useState<TennisSummary | null>(null);
  const [tennisComputedAt, setTennisComputedAt] = useState<string | null>(null);
  const [tennisBets, setTennisBets] = useState<TennisBet[]>([]);
  const [tennisBetSummary, setTennisBetSummary] = useState<TennisBetSummary | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [historyV2, setHistoryV2] = useState<V2HistoryRow[]>([]);
  const [historyV2Stats, setHistoryV2Stats] = useState<V2HistoryStats | null>(null);
  const [historyV2Loading, setHistoryV2Loading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(true);
  const [tennisLoading, setTennisLoading] = useState(true);
  const [predStale, setPredStale] = useState(false);
  const [predFallback, setPredFallback] = useState(false);
  const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({});
  const [liveTennis, setLiveTennis] = useState<LiveTennisMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const [userTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome");
  useEffect(() => { trackEvent("page_view"); }, []);
  useEffect(() => {
    if (tab === "plans") trackEvent("plan_view");
  }, [tab]);

  // IP-based language detection — only runs when no stored preference exists
  useEffect(() => {
    const stored = localStorage.getItem("agentic-lang");
    if (stored && LANGUAGES.includes(stored as Lang)) return;
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d: { languages?: string }) => {
        // ipapi.co returns e.g. "it-IT,en" or "es-ES,ca" — take first lang code
        const primary = (d.languages ?? "").split(",")[0]?.split("-")[0]?.toLowerCase() as Lang;
        const detected: Lang = LANGUAGES.includes(primary) ? primary : "en";
        setUiLanguage(detected);
        localStorage.setItem("agentic-lang", detected);
      })
      .catch(() => { /* keep default */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const profilesRaw = window.localStorage.getItem(CLIENT_PROFILES_KEY);
      const raw = window.localStorage.getItem(CLIENT_PROFILE_KEY);
      const parsedProfiles = profilesRaw ? JSON.parse(profilesRaw) as ClientProfile[] : null;
      const parsedProfile = raw ? JSON.parse(raw) as ClientProfile : null;
      queueMicrotask(() => {
        if (parsedProfiles) setStoredProfiles(parsedProfiles);
        if (parsedProfile) setClientProfile(parsedProfile);
      });
    } catch { /**/ }
  }, []);

  // On mount, reconcile the locally-stored profile with the server session (the cookie
  // is the authority). If there is a valid session, adopt the fresh DB plan; if not, the
  // stored profile is downgraded so it can never show premium data without a session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/auth", { credentials: "same-origin", cache: "no-store" });
        if (cancelled) return;
        if (resp.ok) {
          setHasSession(true); // #LOGIN-WALL-0626
          const server = await resp.json() as { identifier?: string; plan?: ClientProfile["plan"]; name?: string | null; plan_expires_at?: string | null };
          setClientProfile((prev) => {
            // BUG-003: a valid server session with no locally-stored profile
            // (fresh device, cleared storage) left the board chrome logged-out
            // — "Sign In", register banner, "Create profile" in Settings —
            // while the cookie already unlocked the picks. The cookie is the
            // authority: hydrate the profile from it so the whole board agrees.
            if (!prev) {
              if (!server.identifier) return prev;
              const hydrated: ClientProfile = {
                name: server.name ?? "",
                email: server.identifier.trim().toLowerCase(),
                plan: server.plan ?? "free",
                planExpiresAt: server.plan_expires_at ?? null,
              };
              try { window.localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(hydrated)); } catch { /**/ }
              return hydrated;
            }
            const planChanged = server.plan && server.plan !== prev.plan;
            const expiryChanged = server.plan_expires_at !== prev.planExpiresAt;
            if (planChanged || expiryChanged) {
              const next = { ...prev, plan: server.plan ?? prev.plan, planExpiresAt: server.plan_expires_at ?? null };
              try { window.localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(next)); } catch { /**/ }
              return next;
            }
            return prev;
          });
        } else if (resp.status === 401) {
          setHasSession(false); // #LOGIN-WALL-0626
          // No server session: keep the user identity but strip any premium plan locally.
          setClientProfile((prev) => {
            if (!prev || !profileHasAccess(prev)) return prev;
            const next = { ...prev, plan: "free" as const };
            try { window.localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(next)); } catch { /**/ }
            return next;
          });
        }
      } catch { /* offline: leave local state as-is */ }
      finally { if (!cancelled) setAuthChecked(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  // #LOGIN-WALL-0626: the desk is now a hard auth wall — anonymous visitors get a
  // non-dismissible login/register modal that's force-shown whenever there's no
  // server session (see `mustAuth` in render). The modal defaults to the Login
  // tab; the landing CTAs deep-link ?auth=register to open the register tab.

  const saveClientProfile = (profile: ClientProfile) => {
    const normalizedProfile = { ...profile, email: profile.email.trim().toLowerCase() };
    // Auth state changed: drop the shared /api/auth probe cache so the
    // world-cup islands (who-wins) re-check access on their next mount.
    resetAccessCache();
    setClientProfile(normalizedProfile);
    if (normalizedProfile.language && normalizedProfile.language !== uiLanguage) {
      setUiLanguage(normalizedProfile.language);
      localStorage.setItem("agentic-lang", normalizedProfile.language);
    }
    setAuthOpen(false);
    window.localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(normalizedProfile));
    const nextProfiles = [
      normalizedProfile,
      ...storedProfiles.filter((item) => item.email.toLowerCase() !== normalizedProfile.email),
    ];
    setStoredProfiles(nextProfiles);
    window.localStorage.setItem(CLIENT_PROFILES_KEY, JSON.stringify(nextProfiles));
  };

  // Settings save: persist the profile locally AND sync the leaderboard opt-in
  // to the server when it changes (HIGH-2: the toggle previously only touched
  // localStorage, so POST /api/leaderboard was never called and no one could
  // actually appear in the public leaderboard).
  const handleSettingsSave = (profile: ClientProfile) => {
    const wasOptedIn = clientProfile?.leaderboardOptIn ?? false;
    const nowOptedIn = profile.leaderboardOptIn ?? false;
    saveClientProfile(profile);
    if (nowOptedIn === wasOptedIn) return;
    const req = nowOptedIn
      ? fetch("/api/leaderboard", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ displayName: profile.name }),
        })
      : fetch("/api/leaderboard", { method: "DELETE", credentials: "same-origin" });
    req
      .then((r) => { if (!r.ok) console.error(`[leaderboard] opt-${nowOptedIn ? "in" : "out"} failed: ${r.status}`); })
      .catch((e) => console.error("[leaderboard] opt-in/out network error:", String(e)));
  };

  const openAuth = (intent: ClientAuthIntent = "login") => {
    setAuthIntent(intent);
    setAuthOpen(true);
  };

  const handleAuthed = (profile: ClientProfile, serverPlan?: ClientProfile["plan"]) => {
    // The modal already authenticated (register/login with password) and the
    // server set the signed session cookie. We only adopt the DB plan and persist
    // the local UX profile — the cookie, not localStorage, is the data authority.
    setHasSession(true); // #LOGIN-WALL-0626: cookie now set → lift the auth wall
    saveClientProfile({ ...profile, plan: serverPlan ?? profile.plan });
    setTab("bets");
  };

  const submitCryptoPayment = (plan: PublicPlanKey) => {
    if (!clientProfile) {
      setAuthOpen(true);
      return;
    }
    setCheckoutPlan(plan);
    setCheckoutOpen(true);
  };

  const activateFreePlan = () => {
    if (!clientProfile) {
      openAuth("create");
      return;
    }
    saveClientProfile({ ...clientProfile, plan: "free" });
    setTab("bets");
  };

  const handleCheckoutConfirm = async (txHash: string): Promise<boolean> => {
    if (!clientProfile || !checkoutPlan) return false;
    const { txHash: _tx, requestedPlan: _rp, ...rest } = clientProfile;
    // Submitting a tx_hash does NOT unlock access. Mirror the 'pending_payment'
    // waiting state ONLY when the SERVER actually recorded it. Never fake success
    // on a failed/timed-out write: a silently lost tx_hash means the customer
    // believes they paid while we have no record (HIGH-1). On failure we return
    // false so the modal stays open with a retry.
    try {
      const resp = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "checkout", requested_plan: checkoutPlan, tx_hash: txHash }),
      });
      if (!resp.ok) return false;
      const server = await resp.json() as { plan?: ClientProfile["plan"] };
      saveClientProfile({ ...rest, plan: server.plan ?? "pending_payment", txHash, requestedPlan: checkoutPlan });
    } catch {
      return false;
    }
    trackEvent("conversion", { plan: checkoutPlan, meta: { tx: txHash } });
    setCheckoutOpen(false);
    setCheckoutPlan(null);
    setTab("bets");
    return true;
  };

  const handleFounderAccess = () => {
    const adminProfile: ClientProfile = {
      name: "Andrea",
      email: "admin@agentic-markets.internal",
      plan: "admin_full",
      language: "it",
    };
    saveClientProfile(adminProfile);
    setFounderOpen(false);
  };

  const handleFounderTrigger = () => {
    const ref = founderClickRef.current;
    if (ref.timer) clearTimeout(ref.timer);
    ref.count += 1;
    if (ref.count >= 5) {
      ref.count = 0;
      setFounderOpen(true);
    } else {
      ref.timer = setTimeout(() => { ref.count = 0; }, 3000);
    }
  };

  const logoutClientProfile = () => {
    resetAccessCache();
    setHasSession(false); // #LOGIN-WALL-0626: drop the session → re-arm the auth wall
    setClientProfile(null);
    setSlipSelection(null);
    setTab("bets");
    window.localStorage.removeItem(CLIENT_PROFILE_KEY);
    void fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => { /* cookie clears client-side via reload anyway */ });
  };

  const focusClientPlans = () => {
    // #UI-ACCOUNT-DROPDOWN-0623: i Piani sono ora una tab di primo livello ("plans").
    // Switching tabs mounts the target on the next render, so scroll after a double
    // rAF (one for the setState flush, one for the mounted DOM).
    setTab("plans");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById("client-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const fetchData = useCallback(async () => {
    // Premium endpoints: only fetch with an unlocked plan; the server gate (401/403)
    // is the real authority, this just avoids needless locked requests and clears stale data.
    if (!profileHasAccess(clientProfile)) {
      setSummary(null); setBets([]);
      setTennisBets([]); setTennisBetSummary(null);
      setLoading(false);
      return;
    }
    try {
      const [dataResp, tennisBetsResp] = await Promise.all([
        fetch("/api/data", { credentials: "same-origin" }),
        fetch("/api/tennis-bets", { credentials: "same-origin" }),
      ]);
      if (dataResp.ok) {
        const data = await dataResp.json();
        setSummary(data.summary);
        setBets(data.bets ?? []);
        setLastUpdate(new Date().toLocaleTimeString());
      } else if (dataResp.status === 401 || dataResp.status === 403) {
        setSummary(null); setBets([]);
      }
      if (tennisBetsResp.ok) {
        const tb = await tennisBetsResp.json();
        setTennisBets(tb.bets ?? []);
        setTennisBetSummary(tb.summary ?? null);
      } else if (tennisBetsResp.status === 401 || tennisBetsResp.status === 403) {
        setTennisBets([]); setTennisBetSummary(null);
      }
    } catch { /**/ } finally { setLoading(false); }
  }, [clientProfile]);

  const fetchPredictions = useCallback(async () => {
    // No access gate here: API returns per-card locked projection (Task 7)
    setPredLoading(true);
    try {
      const resp = await fetch("/api/predictions", { credentials: "same-origin" });
      if (resp.ok) {
        const data = await resp.json();
        const isOffSeason = data.is_off_season === true;
        const live: Prediction[] = data.predictions ?? [];
        setPredictions(live);
        setPredFallback(isOffSeason);
        setComputedAt(data.computed_at ?? null);
        setPredStale(data.is_stale ?? false);
      } else if (resp.status === 401 || resp.status === 403) {
        setPredictions([]);
      }
    } catch { /**/ } finally { setPredLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // #FORTUNEPLAY-LIVE-ODDS-1: quote live FortunePlay (server fa 1 fetch + TTL-cache
  // 30s; qui poll ~30s). Degrada in silenzio: su errore le card restano com'oggi.
  const fetchFpOdds = useCallback(async () => {
    try {
      const resp = await fetch("/api/fortuneplay-odds", { credentials: "same-origin" });
      if (resp.ok) { const d = await resp.json(); setFpOdds(d.odds ?? {}); }
    } catch { /* degrada al landing */ }
  }, []);

  const fetchTennis = useCallback(async () => {
    // No access gate here: API returns per-card locked projection (Task 7)
    setTennisLoading(true);
    try {
      const resp = await fetch("/api/tennis", { credentials: "same-origin" });
      if (resp.ok) {
        const data = await resp.json();
        const liveMatches: TennisMatch[] = data.matches ?? [];
        setTennisMatches(liveMatches);
        setTennisIsPlaceholder(false);
        setTennisSummary(data.summary ?? null);
        setTennisComputedAt(data.computed_at ?? null);
      } else if (resp.status === 401 || resp.status === 403) {
        setTennisMatches([]);
        setTennisSummary(null);
      }
    } catch { /**/ } finally { setTennisLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unified multi-sport track record for the History tab.
  const fetchHistoryV2 = useCallback(async () => {
    setHistoryV2Loading(true);
    try {
      const resp = await fetch("/api/v2/history?limit=300", { credentials: "same-origin" });
      if (resp.ok) {
        const data = await resp.json();
        setHistoryV2(data.history ?? []);
        setHistoryV2Stats(data.stats ?? null);
      }
    } catch { /**/ } finally { setHistoryV2Loading(false); }
  }, []);

  const fetchLive = useCallback(async () => {
    if (!profileHasAccess(clientProfile)) {
      setLiveScores({});
      return;
    }
    try {
      const r = await fetch("/api/live", { credentials: "same-origin" });
      if (!r.ok) return;
      const d = await r.json() as { live: Record<string, LiveScore> };
      setLiveScores(d.live ?? {});
    } catch { /* silent */ }
  }, [clientProfile]);

  // #021: live tennis (public real scores from the ESPN feed, board-curated
  // server-side). Polled with the same cadence as football live.
  const fetchTennisLive = useCallback(async () => {
    try {
      const r = await fetch("/api/tennis-live");
      if (!r.ok) return;
      const d = await r.json() as { matches: LiveTennisMatch[] };
      setLiveTennis(Array.isArray(d.matches) ? d.matches : []);
    } catch { /* silent */ }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/predictions", { method: "POST" });
      await Promise.all([fetchPredictions(), fetchTennis(), fetchHistoryV2()]);
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
      void fetchPredictions();
      void fetchFpOdds();
      void fetchTennis();
      void fetchHistoryV2();
      void fetchLive();
      void fetchTennisLive();
    });
    const dataInt = setInterval(fetchData, 30_000);
    const predInt = setInterval(fetchPredictions, 3_600_000);
    const fpInt = setInterval(fetchFpOdds, 30_000);
    const tennisInt = setInterval(fetchTennis, 120_000);
    const liveInt = setInterval(fetchLive, 60_000);
    const tennisLiveInt = setInterval(fetchTennisLive, 60_000);
    return () => { clearInterval(dataInt); clearInterval(predInt); clearInterval(fpInt); clearInterval(tennisInt); clearInterval(liveInt); clearInterval(tennisLiveInt); };
  }, [fetchData, fetchPredictions, fetchFpOdds, fetchTennis, fetchLive, fetchTennisLive]);

  // #LOGIN-WALL-0626: once the session reconcile resolved and there's no cookie
  // session, the desk is walled — the auth modal is force-shown and locked.
  const mustAuth = authChecked && !hasSession;

  const hasClientProfile = Boolean(clientProfile);
  const isClientUnlocked = profileHasAccess(clientProfile);
  const isFreeClient = clientProfile?.plan === "free";
  const isSignalPreviewUnlocked = profileHasSignalPreview(clientProfile);
  // "With edge" KPI — prediction-native: count cards with a model edge ≥ 10 pt
  // (margin of the pick over the 2nd outcome), not just market value bets. A
  // market value bet always has a clear pick, so this is a strict superset and
  // surfaces the model's conviction instead of sitting at 0 without odds.
  const MODEL_EDGE_KPI_FLOOR = 10.0;
  const fbWithEdge = predictions.filter((p) => {
    if (p.enrichment?.surface?.below_floor === true) return false;
    const ps = [p.p_home, p.p_draw, p.p_away].filter((v) => Number.isFinite(v)).sort((a, b) => b - a);
    return ps.length >= 2 && modelEdge(ps[0], ps[1]) >= MODEL_EDGE_KPI_FLOOR;
  }).length;
  const tnWithEdge = tennisMatches.filter((m) =>
    Number.isFinite(m.p1) && Number.isFinite(m.p2) &&
    modelEdge(Math.max(m.p1, m.p2), Math.min(m.p1, m.p2)) >= MODEL_EDGE_KPI_FLOOR,
  ).length;
  const withEdgeCount = fbWithEdge + tnWithEdge;
  // #HITRATE-GUARD-1: niente percentuale promozionale sotto la soglia di campione.
  const v2RateMeaningful = historyV2Stats != null
    && isRateMeaningful(historyV2Stats.won + historyV2Stats.lost);
  const tNav = TRANSLATIONS[uiLanguage];
  const lockedGateMode: "auth" | "plan" = hasClientProfile ? "plan" : "auth";
  const handleProtectedUnlock = () => {
    if (hasClientProfile) {
      focusClientPlans();
    } else {
      openAuth("login");
    }
  };
  const navItems: { tab: Tab; label: string; value?: string; tone?: string }[] = [
    { tab: "bets",        label: tNav.nav_predictions, value: isSignalPreviewUnlocked ? String(predictions.length + tennisMatches.length) : undefined, tone: "green" },
    { tab: "history",      label: tNav.nav_history },
    { tab: "leaderboard", label: tNav.nav_leaderboard },
    // #MB-1: builder visibile solo da loggati (decisione Andrea 2026-06-07);
    // i link condivisi ?mb= aprono comunque il tab anche da anonimi.
    ...(hasClientProfile ? [{ tab: "match-builder" as Tab, label: "Match Builder", tone: "green" }] : []),
    // #REFERRAL-PANEL: "Invita" visibile solo da loggati (referral = attribuzione al proprio codice).
    ...(hasClientProfile ? [{ tab: "invita" as Tab, label: pick5(uiLanguage, { it: "Invita", en: "Invite", es: "Invitar", fr: "Inviter", ru: "Пригласить" }) }] : []),
    // #UI-ACCOUNT-DROPDOWN-0623: "Account" → "Plans" tab; l'account vive nel dropdown dal pill.
    { tab: "plans",       label: pick5(uiLanguage, { it: "Piani", en: "Plans", es: "Planes", fr: "Offres", ru: "Тарифы" }), value: clientProfile ? (profileHasPremium(clientProfile) ? "PRO" : isClientUnlocked ? "BASE" : clientProfile.plan === "free" ? "FREE" : "SETUP") : "LOGIN" },
  ];

  const tUI = TRANSLATIONS[uiLanguage];

  const liveTennisMap = useMemo(() => {
    const map: Record<string, LiveTennisMatch> = {};
    for (const lm of liveTennis) map[tennisPairKey(lm.player1, lm.player2)] = lm;
    return map;
  }, [liveTennis]);

  // #MOBILE-1: voci della bottom tab bar (solo mobile). Riusa setTab + label i18n + glifi rail.
  const BOTTOM_TABS: { tab: Tab; label: string; glyph: string }[] = [
    { tab: "bets",        label: tNav.nav_predictions, glyph: RAIL_GLYPHS["bets"] ?? "#g-desk" },
    { tab: "history",     label: tNav.nav_history,     glyph: RAIL_GLYPHS["history"] ?? "#g-desk" },
    { tab: "leaderboard", label: tNav.nav_leaderboard, glyph: RAIL_GLYPHS["leaderboard"] ?? "#g-desk" },
    { tab: "plans",       label: pick5(uiLanguage, { it: "Piani", en: "Plans", es: "Planes", fr: "Offres", ru: "Тарифы" }), glyph: RAIL_GLYPHS["account"] ?? "#g-desk" },
  ];

  return (
    <LanguageCtx.Provider value={uiLanguage}>
    <TzCtx.Provider value={userTz}>
    <LiveCtx.Provider value={liveScores}>
    <LiveTennisCtx.Provider value={liveTennisMap}>
    <main className="portal-root">
      <SportGlyphSprite />
      <CookieBanner />
      {activationNotice && (
        <div role="status" onClick={() => setActivationNotice(null)}
          style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 9998,
            padding: "10px 18px", borderRadius: 10, cursor: "pointer", maxWidth: "92vw",
            fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: 13, lineHeight: 1.4,
            background: "var(--am-panel-2)", color: "var(--am-text)",
            border: `1px solid ${activationNotice.ok ? "var(--am-coral-b)" : "var(--am-negative-b)"}`,
            boxShadow: "0 12px 40px rgba(0,0,0,0.28)" }}>
          {activationNotice.msg}
        </div>
      )}

      {/* #BANNERS-IN-GRID: rimossa la banda house full-width in cima al portal (top),
          i banner house vivono ora solo intercalati tra le schede bet. */}

      {/* ── Topbar (sleek-coral redesign — logo + topnav + theme/account/lang) ── */}
      <header className="am-topbar">
        <div className="am-topbar-in">
          <Link href="/" className="am-brandmark" aria-label="BetrEdge — home" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
            {/* #UI-LOGO-THEME-0623: logo theme-aware (bianco dark / nero light), swap CSS no-flash */}
            <img className="brand-logo-dark" src="/logos/betredge-logo-white.png" alt="BetrEdge" style={{ height: 30, width: "auto" }} />
            <img className="brand-logo-light" src="/logos/betredge-logo-black.png" alt="" aria-hidden="true" style={{ height: 30, width: "auto" }} />
          </Link>

          <nav className="am-topnav">
            {[
              { tab: "bets" as Tab, label: tNav.nav_predictions },
              { tab: "history" as Tab, label: tNav.nav_history },
              { tab: "leaderboard" as Tab, label: tNav.nav_leaderboard },
              ...(hasClientProfile ? [{ tab: "match-builder" as Tab, label: "Match Builder" }] : []),
            ].map((item) => (
              <button
                key={item.tab}
                className={tab === item.tab ? "active" : ""}
                onClick={() => { setTab(item.tab); trackEvent("tab_click", { meta: { tab: item.tab } }); }}
              >
                {item.label}
              </button>
            ))}
            {/* #UI-ACCOUNT-DROPDOWN-0623: "Plans" è ora una tab di primo livello
                (l'account è nel dropdown dal pill). */}
            <button
              className={tab === "plans" ? "active" : ""}
              onClick={() => { setTab("plans"); trackEvent("tab_click", { meta: { tab: "plans" } }); }}
            >
              {pick5(uiLanguage, { it: "Piani", en: "Plans", es: "Planes", fr: "Offres", ru: "Тарифы" })}
            </button>
          </nav>

          <div className="am-topright">
            {/* theme toggle segmentato DARK/LIGHT — riusa toggleTheme/theme esistenti */}
            <div className="am-tt" role="group" aria-label={tNav.theme_aria}>
              <button
                className={theme === "dark" ? "on" : ""}
                aria-pressed={theme === "dark"}
                onClick={() => { if (theme !== "dark") toggleTheme(); }}
              >
                DARK
              </button>
              <button
                className={theme === "light" ? "on" : ""}
                aria-pressed={theme === "light"}
                onClick={() => { if (theme !== "light") toggleTheme(); }}
              >
                LIGHT
              </button>
            </div>

            {clientProfile ? (
              /* #UI-ACCOUNT-DROPDOWN-0623: il pill apre il menu account a tendina
                 (account rifatto). Niente più tab Account né Logout separato. */
              <AccountMenu
                profile={clientProfile}
                lang={uiLanguage}
                planLabel={profileHasPremium(clientProfile) ? "PRO" : isClientUnlocked ? "BASE" : clientProfile.plan === "free" ? "FREE" : "SETUP"}
                onLogout={logoutClientProfile}
                onGoToPlans={() => { setTab("plans"); trackEvent("tab_click", { meta: { tab: "plans", src: "acct-menu" } }); }}
                onSelectLang={selectLanguage}
              />
            ) : (
              <>
                <button className="am-auth-secondary" onClick={() => openAuth("login")}>
                  {tNav.auth_signin}
                </button>
                <button className="am-auth-primary" onClick={() => openAuth("create")}>
                  {tNav.auth_register}
                </button>
              </>
            )}

            <LangDropdown value={uiLanguage} onSelect={selectLanguage} />
          </div>
        </div>
      </header>

      {/* #BANNERS-IN-GRID: rimossa anche la banda house desk-top sotto l'header
          (supersede #BANNER-FIX-0707): i banner house vivono solo intercalati tra
          le schede bet, non come bande chrome. */}

      {/* ── 3-column layout ── */}
      <div className="portal-columns">

        {/* ── Desk (nav + content) ── */}
        <div className="portal-desk">
          <section className="book-layout">
            <aside className="sports-rail">
              {/* ── DESK group — mockup .rail .navlab + boxed active state ── */}
              <span className="rail-lab">Desk</span>
              {navItems.map((item) => (
                <button
                  key={item.tab}
                  className={`rail-item ${tab === item.tab ? "is-active" : ""} ${item.tone ?? ""}`}
                  onClick={() => { setTab(item.tab); trackEvent("tab_click", { meta: { tab: item.tab } }); }}
                >
                  {RAIL_ICONS[item.tab]
                    ? <MenuIcon name={RAIL_ICONS[item.tab]} size={18} className="rail-ic" />
                    : <svg className="rail-ic" aria-hidden="true"><use href={RAIL_GLYPHS[item.tab] ?? "#g-desk"} /></svg>}
                  <span className="rail-label">{item.label}</span>
                  {item.value && <strong className="n">{item.value}</strong>}
                </button>
              ))}
              {/* ── IN EVIDENZA group ── */}
              <span className="rail-sep" />
              <span className="rail-lab is-second">{tNav.featured_label}</span>
              {/* Track B: World Cup hub is a route, not a tab */}
              <Link className="rail-item" href="/world-cup">
                <SportIcon sport="worldcup" size={17} className="rail-ic" variant="sm" />
                <span className="rail-label">World Cup</span>
              </Link>
              {/* #MB-2: Creator Picks — schedine pubblicate dalla community */}
              <a className="rail-item" href="/community">
                <MenuIcon name="creator" size={18} className="rail-ic" />
                <span className="rail-label">Creator Picks</span>
              </a>
              {/* #WEEKLY-PICK-1: Weekly Pick — la multipla della casa (route) */}
              <Link className="rail-item" href="/weekly-pick">
                <svg className="rail-ic" aria-hidden="true"><use href="#g-ticket" /></svg>
                <span className="rail-label">Weekly Pick</span>
              </Link>
              <button className="rail-refresh" onClick={handleRefresh} disabled={refreshing}>
                ↻ {refreshing ? "..." : tUI.refresh_odds}
                <span className="sync">live</span>
              </button>
            </aside>

        <section className="book-main">
          {/* #MOBILE-FEATURED-1: gruppo "In Evidenza" — solo mobile (≤760px, dove il
              rail sparisce). Rispecchia il FEATURED del rail PC con le nostre icone;
              tile prominenti che vanno a capo (nessuno scroll → tutto visibile). */}
          <nav className="am-featured" aria-label={tNav.featured_label}>
            <span className="am-featured-lab">{tNav.featured_label}</span>
            <div className="am-featured-grid">
              <Link className="am-feat-tile" href="/world-cup">
                <SportIcon sport="worldcup" size={22} className="am-feat-ic" variant="sm" />
                <span className="am-feat-l">World Cup</span>
              </Link>
              <a className="am-feat-tile" href="/community">
                <MenuIcon name="creator" size={22} className="am-feat-ic" />
                <span className="am-feat-l">Creator Picks</span>
              </a>
              <Link className="am-feat-tile" href="/weekly-pick">
                <svg className="am-feat-ic" aria-hidden="true"><use href="#g-ticket" /></svg>
                <span className="am-feat-l">Weekly Pick</span>
              </Link>
              {hasClientProfile && (
                <button className="am-feat-tile" onClick={() => { setTab("match-builder"); trackEvent("tab_click", { meta: { tab: "match-builder", src: "featured-mobile" } }); }}>
                  <MenuIcon name="builder" size={22} className="am-feat-ic" />
                  <span className="am-feat-l">Match Builder</span>
                </button>
              )}
              {hasClientProfile && (
                <button className="am-feat-tile" onClick={() => { setTab("invita"); trackEvent("tab_click", { meta: { tab: "invita", src: "featured-mobile" } }); }}>
                  <svg className="am-feat-ic" aria-hidden="true"><use href="#g-acct" /></svg>
                  <span className="am-feat-l">{pick5(uiLanguage, { it: "Invita", en: "Invite", es: "Invitar", fr: "Inviter", ru: "Пригласить" })}</span>
                </button>
              )}
            </div>
          </nav>
          <div className="book-main-head am-deskhead">
            <div className="am-deskhead-titles">
              <h2>{navItems.find((n) => n.tab === tab)?.label ?? tNav.nav_predictions}</h2>
              <p className="am-sub">
                {tab === "plans" ? (
                  uiLanguage === "it"
                    ? <>Scegli il piano giusto per te. Sblocca prediction, edge e Deep Analysis.</>
                    : <>Choose the plan that fits you. Unlock predictions, edge and Deep Analysis.</>
                ) : uiLanguage === "it" ? (
                  <>Probabilità <b>calibrate da un modello</b> su calcio e tennis. Il modello ha <b>una</b> opinione, non opinioni da bar.</>
                ) : uiLanguage === "es" ? (
                  <>Probabilidades <b>calibradas por un modelo</b> en fútbol y tenis. El modelo tiene <b>una</b> opinión, no charlas de bar.</>
                ) : uiLanguage === "fr" ? (
                  <>Probabilités <b>calibrées par un modèle</b> sur le football et le tennis. Le modèle a <b>une seule</b> opinion, pas des avis de comptoir.</>
                ) : uiLanguage === "ru" ? (
                  <>Вероятности, <b>калиброванные моделью</b> по футболу и теннису. У модели <b>одно</b> мнение, а не разговоры за барной стойкой.</>
                ) : (
                  <>Probabilities <b>calibrated by a model</b> on football and tennis. The model holds <b>one</b> opinion, not bar-stool takes.</>
                )}
              </p>
            </div>
            {tab === "bets" && (
              <button className="mb-entry" onClick={() => setTab("match-builder")}>Match Builder →</button>
            )}
            {tab !== "plans" && (
            <div className="am-statbar">
              <div className="am-kpi">
                <span className="v">{predictions.length + tennisMatches.length}</span>
                <span className="l">{tNav.kpi_events_lbl}</span>
              </div>
              <div className="am-kpi">
                <span className="v sig">{withEdgeCount}</span>
                <span className="l">{tNav.kpi_withedge}</span>
              </div>
              {/* #HITRATE-GUARD-1: the rate is a claim — hidden below the sample threshold. */}
              {v2RateMeaningful && historyV2Stats?.win_rate && (
                <div className="am-kpi">
                  <span className="v">{historyV2Stats.win_rate}</span>
                  <span className="l">{tNav.kpi_hit}</span>
                </div>
              )}
            </div>
            )}
          </div>

          {predFallback && tab === "bets" && (
            <div className="flex items-center gap-3 mx-4 mt-2 mb-0 px-3 py-2 rounded-lg border border-amber-400/30 bg-amber-400/5 text-xs font-mono text-amber-400">
              <span>⚽ {tNav.season_pause}</span>
            </div>
          )}
          {tab === "bets" && (
            <LiveNowStrip liveScores={liveScores} liveTennis={liveTennis} boardTennisKeys={new Set(tennisMatches.map((m) => tennisPairKey(m.player1, m.player2)))} lang={uiLanguage} />
          )}
          {tab === "bets" && (
            <UnifiedBetsTab
              predictions={predictions}
              fpOdds={fpOdds}
              tennisMatches={tennisMatches}
              onSelect={(s) => setSlipSelection(s)}
              // BUG-011: an anonymous "Place Bet" used to jump to the Partners
              // (affiliate) tab with no context. Prompt sign-in first; a
              // #PARTNER-REMOVE-0626: Place bet apre direttamente il link invito FortunePlay.
              // #PRELAUNCH-AUDIT LEGALE-2: agli utenti IT NON passiamo onBetNow → la .betbtn
              // (gated su `onBetNow`) sparisce da tutte le card. Niente link-book per l'Italia.
              onBetNow={booksBlocked ? undefined : () => window.open(FORTUNEPLAY_BET_URL, "_blank", "noopener,noreferrer")}
              onSignIn={() => openAuth("login")}
              onRegister={() => openAuth("create")}
              onGate={handleProtectedUnlock}
              onBannerCta={handleBannerCta}
              isSignalPreviewUnlocked={isSignalPreviewUnlocked}
              isFreeClient={isFreeClient}
              isPremiumClient={isClientUnlocked}
              isLoggedIn={hasClientProfile}
              tennisIsPlaceholder={tennisIsPlaceholder}
              hitRate={v2RateMeaningful ? historyV2Stats?.win_rate ?? null : null}
            />
          )}
          {/* #UI-ACCOUNT-DROPDOWN-0623: la tab "Plans" rende direttamente PlansTab.
              L'account (profilo/preferenze/logout) è nel dropdown dal pill. */}
          {tab === "plans" && (
            <PlansTab
              profile={clientProfile}
              onOpenDesk={() => setTab("bets")}
              onPaymentSubmit={submitCryptoPayment}
              onActivateFree={activateFreePlan}
            />
          )}
          {/* #REFERRAL-PANEL: la vecchia AccountTab (dove era finita per errore la
              sezione Invita) non è più montata dopo #UI-ACCOUNT-DROPDOWN-0623 →
              il pannello referral vive su una tab dedicata, raggiungibile. */}
          {tab === "invita" && <ReferralPanel />}
          {tab === "history" && (
            <TrackRecordView rows={historyV2} lang={uiLanguage === "it" ? "it" : "en"} />
          )}
          {tab === "leaderboard" && (
            <LeaderboardTab
              clientName={clientProfile?.name}
              isOptedIn={clientProfile?.leaderboardOptIn ?? false}
            />
          )}
          {tab === "match-builder" && (
            <MatchBuilderTab
              predictions={predictions}
              tennisMatches={tennisMatches}
              onRegister={() => openAuth("create")}
              isLoggedIn={hasClientProfile}
              sharedIds={mbSharedIds}
              refCode={mbRefCode}
              isUnlocked={isClientUnlocked}
              isPremium={profileHasPremium(clientProfile)}
              onUnlock={handleProtectedUnlock}
              loading={predLoading}
            />
          )}
        </section>
        </section>{/* end book-layout */}
        </div>{/* end portal-desk */}

      </div>{/* end portal-columns */}

      {/* #BANNERS-IN-GRID: rimossa la banda house billboard full-width in fondo (bottom),
          i banner house vivono ora solo intercalati tra le schede bet. */}


      {/* #UI-FOOTER-UNIFIED-0623: footer condiviso (Terms/Privacy in-site, social
          placeholder, 18+/gioco responsabile). Sostituisce il footer bespoke del
          desk mantenendone il contenuto equivalente. Il trigger founder nascosto
          resta sotto, invariato. */}
      <SiteFooter lang={uiLanguage} />
      {/* #UI-LIVECHAT-0623: live chat talk.to dietro env flag, inerte se non settata */}
      <LiveChat />
      <div style={{ textAlign: "center", paddingBottom: 16 }}>
        <button
          type="button"
          onClick={handleFounderTrigger}
          style={{ background: "none", border: "none", color: "transparent", cursor: "default", userSelect: "none", width: 10, height: 10 }}
          aria-hidden="true"
        >·</button>
      </div>
      {(authOpen || mustAuth) && (
        <ClientAuthModal
          intent={authIntent}
          dismissible={!mustAuth}
          onClose={() => { if (!mustAuth) setAuthOpen(false); }}
          onAuthed={handleAuthed}
        />
      )}
      {checkoutOpen && checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          onConfirm={handleCheckoutConfirm}
          onClose={() => { setCheckoutOpen(false); setCheckoutPlan(null); }}
        />
      )}
      {founderOpen && (
        <FounderModal
          onClose={() => setFounderOpen(false)}
          onSuccess={handleFounderAccess}
        />
      )}

      {/* #MOBILE-1: bottom tab bar — visibile solo ≤760px (CSS), sostituisce la sidebar-muro */}
      <nav className="am-bottomnav" aria-label="Mobile navigation">
        {BOTTOM_TABS.map((b) => (
          <button
            key={b.tab}
            className={`bn ${tab === b.tab ? "on" : ""}`}
            aria-current={tab === b.tab ? "page" : undefined}
            onClick={() => { setTab(b.tab); trackEvent("tab_click", { meta: { tab: b.tab, src: "bottomnav" } }); }}
          >
            {/* #MOBILE-FEATURED-1: nostre icone illustrate come nel rail PC; glifo di fallback. */}
            {RAIL_ICONS[b.tab]
              ? <MenuIcon name={RAIL_ICONS[b.tab]} size={20} />
              : <svg aria-hidden="true"><use href={b.glyph} /></svg>}
            <span className="bn-l">{b.label}</span>
          </button>
        ))}
      </nav>
    </main>
    </LiveTennisCtx.Provider>
    </LiveCtx.Provider>
    </TzCtx.Provider>
    </LanguageCtx.Provider>
  );
}
