"use client";

import { useEffect, useState, useCallback, useRef, useMemo, createContext, useContext } from "react";
import Link from "next/link";
import {
  PUBLIC_PAID_PLAN,
  type PublicPlanKey,
  planAmountUsdt,
  planLabel,
  planPriceCopy as publicPlanPriceCopy,
} from "@/lib/commercial-plan";
import { buildBestBetRows, modelEdge, type BestBetCandidate } from "@/lib/best-bets";
import { surfaceFloorFor } from "@/lib/surfacing-gate";
import { resetAccessCache } from "@/lib/use-has-access";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";
import { PlaceBetMenu } from "@/components/PlaceBetMenu";
import { HouseBanner } from "@/components/HouseBanner";
import { TrackRecordView } from "@/components/track-record/TrackRecordView";
import { pickCampaign, campaignsFor, audienceFromPlan, buildBannerData, type BannerData, type BannerMatchInput } from "@/lib/house-banners";
import LangDropdown from "@/components/LangDropdown";

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
    preaccess_title: "Signal Desk privato per edge verificati",
    preaccess_subtitle: "Le prediction, il portafoglio, le size e il wallet di pagamento restano nascosti finché il cliente non accede e non sceglie un piano.",
    preaccess_login: "Login", preaccess_create: "Crea profilo",
    preaccess_s1_title: "Crea profilo", preaccess_s1_desc: "Account cliente con lingua, piano e stato pagamento.",
    preaccess_s2_title: "Scegli piano", preaccess_s2_desc: "Free per preview, Signal Desk Pro per segnali e ricerca.",
    preaccess_s3_title: "Invia USDT", preaccess_s3_desc: "Il wallet compare solo dentro il checkout cliente.",
    preaccess_s4_title: "Sblocca desk", preaccess_s4_desc: "Dati reali visibili solo dopo piano attivo o approval interno.",
    preaccess_base_desc: "Signal Desk Pro: tennis live, football research e Best Bets",
    preaccess_premium_desc: "Accessi avanzati riservati al team interno",
    // Auth modal
    auth_eyebrow: "Client access",
    auth_login_title: "Login Signal Desk",
    auth_create_title: "Crea il tuo profilo Signal Desk",
    auth_login_sub: "Accedi con l'email usata per il tuo profilo cliente.",
    auth_create_sub: "Crea il profilo, poi scegli Signal Desk Pro per sbloccare i dati.",
    auth_name_label: "Nome", auth_name_placeholder: "Il tuo nome",
    auth_not_found: "Profilo non trovato. Crea un profilo cliente per continuare.",
    auth_create_btn: "Continue to plans",
    auth_footer: "Signal Desk Pro è crypto-only. I dati prediction restano bloccati finché il piano non è attivo.",
    auth_pw_placeholder_new: "Almeno 8 caratteri",
    auth_err_wrongpw: "Email o password errata.", auth_err_noaccount: "Nessun account con questa email. Registrati.",
    auth_err_exists: "Account già esistente — accedi.", auth_err_founder: "Questo profilo richiede founder access.",
    auth_err_pwshort: "La password deve avere almeno 8 caratteri.", auth_err_generic: "Errore. Riprova.",
    auth_hint_incomplete: "Inserisci un'email valida e una password di almeno 8 caratteri.",
    auth_age_confirm: "Confermo di avere almeno 18 anni.",
    auth_tos_pre: "Accetto i ", auth_tos_link: "Termini di Servizio e l'Informativa Privacy", auth_tos_post: ".",
    auth_hint_consent: "Conferma di essere maggiorenne e accetta i Termini per continuare.",
    // Plans
    plans_eyebrow: "Client plans",
    plans_title: "Un piano pagante, promessa chiara",
    plans_subtitle: "Free resta preview. Signal Desk Pro sblocca tennis live, football research, Best Bets, spiegazioni e track record. Nessuna promessa aggressiva di battere il mercato.",
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
    profile_upgrade_title: "Signal Desk Pro",
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
    locked_eyebrow: "Signal Desk bloccato", locked_title: "Accedi per vedere prediction, edge e spiegazioni",
    locked_desc: "I dati sensibili restano offuscati finché non accedi e non attivi un piano.",
    locked_btn: "Login / Crea profilo",
    locked_plan_eyebrow: "Piano richiesto",
    locked_plan_title: "Scegli un pacchetto per sbloccare il desk",
    locked_plan_desc: "Il profilo è attivo, ma prediction, edge e spiegazioni si sbloccano solo dopo aver selezionato Signal Desk Pro.",
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
    preaccess_title: "Private Signal Desk for verified edges",
    preaccess_subtitle: "Predictions, portfolio, stake sizes and payment wallet are hidden until the client signs in and chooses a plan.",
    preaccess_login: "Login", preaccess_create: "Create profile",
    preaccess_s1_title: "Create profile", preaccess_s1_desc: "Client account with language, plan and payment status.",
    preaccess_s2_title: "Choose plan", preaccess_s2_desc: "Free for preview, Signal Desk Pro for signals and research.",
    preaccess_s3_title: "Send USDT", preaccess_s3_desc: "Wallet address appears only inside the client checkout.",
    preaccess_s4_title: "Unlock desk", preaccess_s4_desc: "Live data visible only after plan is active or internal approval.",
    preaccess_base_desc: "Signal Desk Pro: tennis live, football research and Best Bets",
    preaccess_premium_desc: "Advanced access reserved for the internal team",
    // Auth modal
    auth_eyebrow: "Client access",
    auth_login_title: "Login Signal Desk",
    auth_create_title: "Create your Signal Desk profile",
    auth_login_sub: "Sign in with the email used for your client profile.",
    auth_create_sub: "Create your profile, then choose Signal Desk Pro to unlock data.",
    auth_name_label: "Name", auth_name_placeholder: "Your name",
    auth_not_found: "Profile not found. Create a client profile to continue.",
    auth_create_btn: "Continue to plans",
    auth_footer: "Signal Desk Pro is crypto-only. Prediction data stays locked until the plan is active.",
    auth_pw_placeholder_new: "At least 8 characters",
    auth_err_wrongpw: "Wrong email or password.", auth_err_noaccount: "No account for this email. Sign up.",
    auth_err_exists: "Account already exists — log in.", auth_err_founder: "This profile requires founder access.",
    auth_err_pwshort: "Password must be at least 8 characters.", auth_err_generic: "Error. Try again.",
    auth_hint_incomplete: "Enter a valid email and a password of at least 8 characters.",
    auth_age_confirm: "I confirm I am at least 18 years old.",
    auth_tos_pre: "I accept the ", auth_tos_link: "Terms of Service and Privacy Policy", auth_tos_post: ".",
    auth_hint_consent: "Confirm you are of legal age and accept the Terms to continue.",
    // Plans
    plans_eyebrow: "Client plans",
    plans_title: "One paid plan, clear promise",
    plans_subtitle: "Free stays as preview. Signal Desk Pro unlocks tennis live, football research, Best Bets, explanations and track record. No aggressive market-beating promise.",
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
    profile_upgrade_title: "Signal Desk Pro",
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
    locked_eyebrow: "Signal Desk locked", locked_title: "Sign in to see predictions, edge and explanations",
    locked_desc: "Sensitive data stays hidden until you sign in and activate a plan.",
    locked_btn: "Login / Create profile",
    locked_plan_eyebrow: "Plan required",
    locked_plan_title: "Choose a package to unlock the desk",
    locked_plan_desc: "Your profile is active, but predictions, edge and explanations unlock only after choosing Signal Desk Pro.",
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
    preaccess_title: "Signal Desk privado para edges verificados",
    preaccess_subtitle: "Las predicciones, el portfolio, los importes y el wallet de pago permanecen ocultos hasta que el cliente inicia sesión y elige un plan.",
    preaccess_login: "Login", preaccess_create: "Crear perfil",
    preaccess_s1_title: "Crear perfil", preaccess_s1_desc: "Cuenta de cliente con idioma, plan y estado de pago.",
    preaccess_s2_title: "Elegir plan", preaccess_s2_desc: "Free para la vista previa, Signal Desk Pro para señales e investigación.",
    preaccess_s3_title: "Enviar USDT", preaccess_s3_desc: "La dirección del wallet aparece solo dentro del checkout del cliente.",
    preaccess_s4_title: "Desbloquear desk", preaccess_s4_desc: "Datos en vivo visibles solo tras activar el plan o con aprobación interna.",
    preaccess_base_desc: "Signal Desk Pro: tenis en vivo, investigación de fútbol y Best Bets",
    preaccess_premium_desc: "Accesos avanzados reservados al equipo interno",
    // Auth modal
    auth_eyebrow: "Acceso de cliente",
    auth_login_title: "Login Signal Desk",
    auth_create_title: "Crea tu perfil Signal Desk",
    auth_login_sub: "Inicia sesión con el email usado para tu perfil de cliente.",
    auth_create_sub: "Crea tu perfil y luego elige Signal Desk Pro para desbloquear los datos.",
    auth_name_label: "Nombre", auth_name_placeholder: "Tu nombre",
    auth_not_found: "Perfil no encontrado. Crea un perfil de cliente para continuar.",
    auth_create_btn: "Continuar a planes",
    auth_footer: "Signal Desk Pro es solo cripto. Los datos de predicción permanecen bloqueados hasta que el plan esté activo.",
    auth_pw_placeholder_new: "Al menos 8 caracteres",
    auth_err_wrongpw: "Email o contraseña incorrectos.", auth_err_noaccount: "No hay cuenta con este email. Regístrate.",
    auth_err_exists: "La cuenta ya existe — inicia sesión.", auth_err_founder: "Este perfil requiere acceso de founder.",
    auth_err_pwshort: "La contraseña debe tener al menos 8 caracteres.", auth_err_generic: "Error. Inténtalo de nuevo.",
    auth_hint_incomplete: "Introduce un email válido y una contraseña de al menos 8 caracteres.",
    auth_age_confirm: "Confirmo que tengo al menos 18 años.",
    auth_tos_pre: "Acepto los ", auth_tos_link: "Términos del Servicio y la Política de Privacidad", auth_tos_post: ".",
    auth_hint_consent: "Confirma que eres mayor de edad y acepta los Términos para continuar.",
    // Plans
    plans_eyebrow: "Planes cliente",
    plans_title: "Un plan de pago, promesa clara",
    plans_subtitle: "Free se mantiene como vista previa. Signal Desk Pro desbloquea tenis en vivo, investigación de fútbol, Best Bets, explicaciones y track record. Sin promesas agresivas de batir el mercado.",
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
    profile_upgrade_title: "Signal Desk Pro",
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
    locked_eyebrow: "Signal Desk bloqueado", locked_title: "Inicia sesión para ver predicciones, edge y explicaciones",
    locked_desc: "Los datos sensibles permanecen ocultos hasta que inicies sesión y actives un plan.",
    locked_btn: "Login / Crear perfil",
    locked_plan_eyebrow: "Plan requerido",
    locked_plan_title: "Elige un paquete para desbloquear el desk",
    locked_plan_desc: "Tu perfil está activo, pero las predicciones, el edge y las explicaciones se desbloquean solo tras elegir Signal Desk Pro.",
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
    preaccess_title: "Signal Desk privé pour des edges vérifiés",
    preaccess_subtitle: "Les prédictions, le portfolio, les mises et le wallet de paiement restent masqués jusqu'à ce que le client se connecte et choisisse un plan.",
    preaccess_login: "Connexion", preaccess_create: "Créer profil",
    preaccess_s1_title: "Créer profil", preaccess_s1_desc: "Compte client avec langue, plan et statut de paiement.",
    preaccess_s2_title: "Choisir un plan", preaccess_s2_desc: "Free pour l'aperçu, Signal Desk Pro pour les signaux et la recherche.",
    preaccess_s3_title: "Envoyer des USDT", preaccess_s3_desc: "L'adresse du wallet n'apparaît que dans le checkout client.",
    preaccess_s4_title: "Débloquer le desk", preaccess_s4_desc: "Données en direct visibles seulement après activation du plan ou validation interne.",
    preaccess_base_desc: "Signal Desk Pro : tennis en direct, recherche football et Best Bets",
    preaccess_premium_desc: "Accès avancés réservés à l'équipe interne",
    // Auth modal
    auth_eyebrow: "Accès client",
    auth_login_title: "Connexion Signal Desk",
    auth_create_title: "Crée ton profil Signal Desk",
    auth_login_sub: "Connecte-toi avec l'email utilisé pour ton profil client.",
    auth_create_sub: "Crée ton profil, puis choisis Signal Desk Pro pour débloquer les données.",
    auth_name_label: "Nom", auth_name_placeholder: "Ton nom",
    auth_not_found: "Profil introuvable. Crée un profil client pour continuer.",
    auth_create_btn: "Continuer vers les plans",
    auth_footer: "Signal Desk Pro est crypto uniquement. Les données de prédiction restent verrouillées tant que le plan n'est pas actif.",
    auth_pw_placeholder_new: "Au moins 8 caractères",
    auth_err_wrongpw: "Email ou mot de passe incorrect.", auth_err_noaccount: "Aucun compte pour cet email. Inscris-toi.",
    auth_err_exists: "Le compte existe déjà — connecte-toi.", auth_err_founder: "Ce profil requiert un accès founder.",
    auth_err_pwshort: "Le mot de passe doit comporter au moins 8 caractères.", auth_err_generic: "Erreur. Réessaie.",
    auth_hint_incomplete: "Saisis un email valide et un mot de passe d'au moins 8 caractères.",
    auth_age_confirm: "Je confirme avoir au moins 18 ans.",
    auth_tos_pre: "J'accepte les ", auth_tos_link: "Conditions de Service et la Politique de Confidentialité", auth_tos_post: ".",
    auth_hint_consent: "Confirme que tu es majeur et accepte les Conditions pour continuer.",
    // Plans
    plans_eyebrow: "Plans client",
    plans_title: "Un seul plan payant, promesse claire",
    plans_subtitle: "Free reste un aperçu. Signal Desk Pro débloque le tennis en direct, la recherche football, les Best Bets, les explications et le track record. Aucune promesse agressive de battre le marché.",
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
    profile_upgrade_title: "Signal Desk Pro",
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
    locked_eyebrow: "Signal Desk verrouillé", locked_title: "Connecte-toi pour voir prédictions, edge et explications",
    locked_desc: "Les données sensibles restent masquées jusqu'à ta connexion et l'activation d'un plan.",
    locked_btn: "Connexion / Créer profil",
    locked_plan_eyebrow: "Plan requis",
    locked_plan_title: "Choisis un pack pour débloquer le desk",
    locked_plan_desc: "Ton profil est actif, mais les prédictions, l'edge et les explications ne se débloquent qu'après avoir choisi Signal Desk Pro.",
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
    preaccess_title: "Приватный Signal Desk для проверенных edge",
    preaccess_subtitle: "Прогнозы, портфель, размеры ставок и платёжный кошелёк скрыты, пока клиент не войдёт и не выберет план.",
    preaccess_login: "Войти", preaccess_create: "Создать профиль",
    preaccess_s1_title: "Создать профиль", preaccess_s1_desc: "Аккаунт клиента с языком, планом и статусом оплаты.",
    preaccess_s2_title: "Выбрать план", preaccess_s2_desc: "Free для превью, Signal Desk Pro для сигналов и исследований.",
    preaccess_s3_title: "Отправить USDT", preaccess_s3_desc: "Адрес кошелька появляется только внутри клиентского checkout.",
    preaccess_s4_title: "Разблокировать desk", preaccess_s4_desc: "Live-данные видны только после активации плана или внутреннего одобрения.",
    preaccess_base_desc: "Signal Desk Pro: теннис live, исследование футбола и Best Bets",
    preaccess_premium_desc: "Расширенный доступ зарезервирован для внутренней команды",
    // Auth modal
    auth_eyebrow: "Доступ клиента",
    auth_login_title: "Вход в Signal Desk",
    auth_create_title: "Создай профиль Signal Desk",
    auth_login_sub: "Войди с email, использованным для твоего профиля клиента.",
    auth_create_sub: "Создай профиль, затем выбери Signal Desk Pro, чтобы открыть данные.",
    auth_name_label: "Имя", auth_name_placeholder: "Твоё имя",
    auth_not_found: "Профиль не найден. Создай профиль клиента, чтобы продолжить.",
    auth_create_btn: "Перейти к планам",
    auth_footer: "Signal Desk Pro — только крипта. Данные прогнозов остаются заблокированными, пока план не активен.",
    auth_pw_placeholder_new: "Минимум 8 символов",
    auth_err_wrongpw: "Неверный email или пароль.", auth_err_noaccount: "Нет аккаунта с этим email. Зарегистрируйся.",
    auth_err_exists: "Аккаунт уже существует — войди.", auth_err_founder: "Этот профиль требует founder-доступа.",
    auth_err_pwshort: "Пароль должен содержать минимум 8 символов.", auth_err_generic: "Ошибка. Попробуй снова.",
    auth_hint_incomplete: "Введи корректный email и пароль не короче 8 символов.",
    auth_age_confirm: "Подтверждаю, что мне не менее 18 лет.",
    auth_tos_pre: "Я принимаю ", auth_tos_link: "Условия использования и Политику конфиденциальности", auth_tos_post: ".",
    auth_hint_consent: "Подтверди совершеннолетие и прими Условия, чтобы продолжить.",
    // Plans
    plans_eyebrow: "Планы клиента",
    plans_title: "Один платный план, понятное обещание",
    plans_subtitle: "Free остаётся превью. Signal Desk Pro открывает теннис live, исследование футбола, Best Bets, объяснения и track record. Без агрессивных обещаний обыграть рынок.",
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
    profile_upgrade_title: "Signal Desk Pro",
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
    locked_eyebrow: "Signal Desk заблокирован", locked_title: "Войди, чтобы увидеть прогнозы, edge и объяснения",
    locked_desc: "Чувствительные данные скрыты, пока ты не войдёшь и не активируешь план.",
    locked_btn: "Войти / Создать профиль",
    locked_plan_eyebrow: "Нужен план",
    locked_plan_title: "Выбери пакет, чтобы разблокировать desk",
    locked_plan_desc: "Профиль активен, но прогнозы, edge и объяснения открываются только после выбора Signal Desk Pro.",
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
const BetLinksCtx = createContext<boolean>(false);
const useBetLinksEnabled = () => useContext(BetLinksCtx);
function tennisLastName(s: string) {
  return (s.split(" ").pop() ?? s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function tennisPairKey(a: string, b: string) {
  return [tennisLastName(a), tennisLastName(b)].sort().join("|");
}
function useT() { return TRANSLATIONS[useLang()]; }
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
  // Confidence-surfacing gate (Wave 1, club football path). Present only when
  // below_floor — same contract as the national path's notes.surface. Survives
  // the per-tier enrichment strip (NOT in PREMIUM_ENRICHMENT_KEYS), so it reaches
  // every unlocked tier. below_floor=true -> no clear favourite: the card drops
  // the pick direction + edge/value badge but keeps the probabilities and why.
  surface?: { below_floor: boolean; floor: number };
  // Server-side kickoff provenance (not premium-stripped): true when the time
  // comes from a real source, so fmtKickoff can show a genuine 00:00 UTC slot.
  time_confirmed?: boolean;
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

interface HistoryMatch {
  match_id: string;
  league: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  edge: number | null;
  best_selection: string | null;
  home_score: number | null;
  away_score: number | null;
  match_status: string | null;
  bet_selection: string | null;
  bet_status: string | null;
  bet_odds: number | null;
}

interface HistoryStats {
  total_matches: number;
  bets_placed: number;
  won: number;
  lost: number;
  pending: number;
  accuracy: string;
  model_accuracy: string;
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
  partners: "#g-desk",
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

type Tab = "bets" | "account" | "history" | "partners" | "leaderboard" | "match-builder";
type AccountSection = "panoramica" | "impostazioni" | "assistenza" | "faq";

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
  // never resurfaces as a value bet (floor mirrors lib/surfacing-gate.ts = 62).
  const surfaced = m.confidence_score == null
    || m.confidence_score >= surfaceFloorFor("tennis", null);
  return surfaced
    && isTennisMarketVisible(m.scheduled)
    && Boolean(m.best_selection)
    && odds != null
    && odds >= MIN_BEST_BET_ODDS
    && (m.edge ?? 0) >= TENNIS_BEST_EDGE_THRESHOLD;
}

// #HOUSE-BANNERS-2: dati reali per i banner ricchi (ticker/chip/mini-board).
// edge è decimale sul board (0.062) → ×100 in punti per il rendering "+6.2%".
function deskBannerData(
  predictions: Prediction[],
  tennisMatches: TennisMatch[],
  opts: { hitRate?: string | null } = {},
): BannerData {
  const matches: BannerMatchInput[] = [
    ...predictions.map((p) => ({ sport: "football" as const, name: `${p.home_team}–${p.away_team}`, edge: p.edge != null ? p.edge * 100 : null })),
    ...tennisMatches.map((m) => ({ sport: "tennis" as const, name: `${m.player1}–${m.player2}`, edge: m.edge != null ? m.edge * 100 : null })),
  ];
  return buildBannerData(matches, { eventsCount: predictions.length + tennisMatches.length, hitRate: opts.hitRate });
}

function SportsbookBoard({
  predictions,
  tennisMatches,
  onSelect,
  onBetNow,
  onGate,
  isFreeClient,
  isPremium,
  tennisIsPlaceholder,
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  onSelect: (selection: SlipSelection) => void;
  onBetNow?: () => void;
  onGate?: () => void;
  isFreeClient?: boolean;
  isPremium?: boolean;
  tennisIsPlaceholder?: boolean;
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
  // #HOUSE-BANNERS-2: dati reali per ticker/chip/mini-board del feed e interstitial.
  const boardData = deskBannerData(predictions, tennisMatches);
  const boardAudience = isPremium ? "premium" : (isFreeClient ? "free" : "anon");
  // #HOUSE-PHOTO-1 dedup: mai 2 banner uguali per pagina. Le campagne desk-feed
  // sono divise in modo DISGIUNTO tra calcio (indici pari) e tennis (dispari),
  // ognuna usata al massimo una volta → nessun banner ripetuto nel feed.
  const feedCampsAll = isFreeClient ? [] : campaignsFor("desk-feed", boardAudience);
  const footballFeed = feedCampsAll.filter((_, idx) => idx % 2 === 0);
  const tennisFeed = feedCampsAll.filter((_, idx) => idx % 2 === 1);

  const labels = lang === "it" ? {
    allSports: "Tutti",
    football: "Football",
    tennis: "Tennis",
    allSignals: "Tutte le prediction",
    valueOnly: "Solo best bets",
    competition: "Competizione",
    allCompetitions: "Tutte le competizioni",
    surface: "Superficie",
    allSurfaces: "Tutte",
    sort: "Ordina",
    edge: "Miglior edge",
    time: "Orario",
    odds: "Quota più alta",
    probability: "Probabilità modello",
    search: "Cerca team, player, torneo...",
    showing: "Mostro",
    noResults: "Nessun mercato rispetta questi filtri. Allarga la ricerca o torna a Tutti.",
  } : {
    allSports: "All",
    football: "Football",
    tennis: "Tennis",
    allSignals: "All predictions",
    valueOnly: "Best bets only",
    competition: "Competition",
    allCompetitions: "All competitions",
    surface: "Surface",
    allSurfaces: "All",
    sort: "Sort",
    edge: "Best edge",
    time: "Time",
    odds: "Highest odds",
    probability: "Model probability",
    search: "Search team, player, tournament...",
    showing: "Showing",
    noResults: "No markets match these filters. Widen the search or return to All.",
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

  const footballRows = sortFootball(predictions
    .filter((p) => sportFilter !== "tennis")
    .filter(() => surfaceFilter === "all")
    .filter((p) => isBoardVisibleMarket(p.kickoff))
    .filter((p) => signalFilter === "all" || isFootballBestBet(p))
    .filter((p) => competitionFilter === "all" || competitionFilter === `football:${p.league}`)
    .filter((p) => !query || `${p.home_team} ${p.away_team} ${p.league_name} ${p.league}`.toLowerCase().includes(query)))
    .slice(0, signalFilter === "value" ? BEST_BETS_CAP : Number.POSITIVE_INFINITY);

  const tennisRows = sortTennis(tennisMatches
    .filter((m) => sportFilter !== "football")
    .filter((m) => tennisIsPlaceholder || isTennisMarketVisible(m.scheduled))
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
            <svg className="ic" aria-hidden="true"><use href="#g-ball" /></svg>{labels.football} <span className="ct">{footballRows.length}</span>
          </button>
          <button className={sportFilter === "tennis" ? "on" : ""} onClick={() => setSportFilter("tennis")}>
            <svg className="ic" aria-hidden="true"><use href="#g-tball" /></svg>{labels.tennis} <span className="ct">{tennisRows.length}</span>
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
          {isFreeClient && (
            <div className="free-tier-banner">
              <strong>{lang === "it" ? "Piano Free — 1 prediction per sport" : "Free Plan — 1 prediction per sport"}</strong>
              <span>{lang === "it"
                ? "Vedi 1 anteprima per sport. Sblocca prediction, edge% e analisi con Signal Desk Pro (49.90 USDT/mese)."
                : "You see 1 preview per sport. Unlock predictions, edge% and analysis with Signal Desk Pro (49.90 USDT/month)."
              }</span>
            </div>
          )}

          {showFootballSection && (
            <section>
              <div className="sport-band">
                <span className="glyph"><svg aria-hidden="true"><use href="#g-ball" /></svg></span>
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
                    const rows = isFreeClient ? footballRows.slice(0, 1) : footballRows;
                    let placed = 0;
                    return rows.flatMap((p, i) => {
                      const card = (
                        <PredictionCard key={p.match_id} p={p} onSelect={onSelect} onBetNow={onBetNow} onGate={onGate} isPreview={isFreeClient} isPremium={isPremium} />
                      );
                      if (placed < footballFeed.length && i % 8 === 7 && i < rows.length - 1) {
                        const camp = footballFeed[placed++];
                        return [card, <HouseBanner key={`house-feed-${camp.id}`} campaign={camp} lang={lang} />];
                      }
                      return [card];
                    });
                  })()}
                  {isFreeClient && footballRows.length > 1 && (
                    <div className="free-preview-wall">
                      <div className="fpw-lock">🔒</div>
                      <div className="fpw-count">+{footballRows.length - 1} {lang === "it" ? "prediction bloccate" : "predictions locked"}</div>
                      <div className="fpw-sub">{lang === "it" ? "Sblocca tutto con Signal Desk Pro (49.90 USDT/mese)" : "Unlock all with Signal Desk Pro (49.90 USDT/month)"}</div>
                    </div>
                  )}
                </div>
              ) : (
                /* P6: honest empty-state — WC countdown message + hub link */
                <div className="book-empty wc-empty-state">
                  <div>{lang === "it"
                    ? "Nessun segnale calcio in questo momento. I primi segnali arrivano con l'apertura dei mercati del Mondiale — kickoff 11 giugno."
                    : "No football signals right now. The first signals arrive when World Cup markets open — kickoff June 11."}</div>
                  <Link href="/world-cup" className="wc-back-link">{lang === "it"
                    ? "Esplora l'hub Mondiali: gironi, calendario, convocazioni →"
                    : "Explore the World Cup hub: groups, calendar, squads →"}</Link>
                </div>
              )}
            </section>
          )}

          {/* #HOUSE-BANNERS-2: interstitial billboard tra calcio e tennis (board pieno) */}
          {showFootballSection && showTennisSection && !isFreeClient && (() => {
            const camp = pickCampaign("desk-interstitial", boardAudience);
            return camp ? (
              <div className="house-interstitial">
                <HouseBanner campaign={camp} lang={lang} data={boardData} />
              </div>
            ) : null;
          })()}

          {showTennisSection && (
            <section>
              <div className="sport-band amber">
                <span className="glyph"><svg aria-hidden="true"><use href="#g-racket" /></svg></span>
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
                    const rows = isFreeClient ? tennisRows.slice(0, 1) : tennisRows;
                    let placed = 0;
                    return rows.flatMap((m, i) => {
                      const card = (
                        <TennisMatchCard key={m.id} m={m} onSelect={onSelect} onBetNow={onBetNow} onGate={onGate} isPreview={isFreeClient} isPremium={isPremium} />
                      );
                      if (placed < tennisFeed.length && i % 8 === 7 && i < rows.length - 1) {
                        const camp = tennisFeed[placed++];
                        return [card, <HouseBanner key={`house-tennis-${camp.id}`} campaign={camp} lang={lang} />];
                      }
                      return [card];
                    });
                  })()}
                  {isFreeClient && tennisRows.length > 1 && (
                    <div className="free-preview-wall">
                      <div className="fpw-lock">🔒</div>
                      <div className="fpw-count">+{tennisRows.length - 1} {lang === "it" ? "match bloccati" : "matches locked"}</div>
                      <div className="fpw-sub">{lang === "it" ? "Sblocca tutto con Signal Desk Pro (49.90 USDT/mese)" : "Unlock all with Signal Desk Pro (49.90 USDT/month)"}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="book-empty">{t.board_tennis_empty}</div>
              )}
            </section>
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
  const labels = lang === "it" ? {
    all: "Tutti",
    football: "Football",
    tennis: "Tennis",
    sort: "Ordina",
    probability: "Probabilità più alta",
    edge: "Miglior edge",
    time: "Prima kickoff",
    search: "Cerca match, team, player...",
    showing: "Mostro",
    valueMode: "+EV live",
    modelMode: "Top Model Signals",
    noEdge: "segnali modello",
  } : {
    all: "All",
    football: "Football",
    tennis: "Tennis",
    sort: "Sort",
    probability: "Highest probability",
    edge: "Best edge",
    time: "Closest kickoff",
    search: "Search match, team, player...",
    showing: "Showing",
    valueMode: "Live +EV",
    modelMode: "Top Model Signals",
    noEdge: "model signals",
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
    belowFloor: m.confidence_score != null
      && m.confidence_score < surfaceFloorFor("tennis", null),
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
            <svg className="ic" aria-hidden="true"><use href="#g-ball" /></svg>{labels.football} <span className="ct">{visibleFootballValue.length}</span>
          </button>
          <button className={sportFilter === "tennis" ? "on" : ""} onClick={() => setSportFilter("tennis")}>
            <svg className="ic" aria-hidden="true"><use href="#g-tball" /></svg>{labels.tennis} <span className="ct">{visibleTennisValue.length}</span>
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
                <span className="glyph"><svg aria-hidden="true"><use href="#g-ball" /></svg></span>
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
                <span className="glyph"><svg aria-hidden="true"><use href="#g-racket" /></svg></span>
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
              <strong>{returns.toFixed(2)}€</strong>
            </div>
            <div>
              <span>EV</span>
              <strong className={ev >= 0 ? "text-green-300" : "text-red-300"}>{ev >= 0 ? "+" : ""}{ev.toFixed(2)}€</strong>
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
  history,
  historyStats,
  historyLoading,
}: {
  onLogin: () => void;
  onCreate: () => void;
  onPlans: () => void;
  history: HistoryMatch[];
  historyStats: HistoryStats | null;
  historyLoading: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const visibleHistory = history.filter((item) => item.bet_status && item.bet_status !== "pending").slice(0, 5);
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
  const faq = lang === "it" ? [
    ["Cosa vede un utente pubblico?", "Solo homepage, struttura del prodotto e storico passato/educational. I segnali live restano bloccati."],
    ["Cosa sblocca il piano Free?", "Profilo, lingua, preview account e accesso alla struttura, senza prediction operative."],
    ["Cosa sblocca Signal Desk Pro?", "Tennis live, football research, Best Bets, Top Model Signals, spiegazioni modello e track record."],
    ["Gli agenti piazzano bet automaticamente?", "No nel go-live: il piano pubblico è research e signal desk. L'execution resta interna/non venduta."],
  ] : [
    ["What can public users see?", "Only homepage, product structure and past/educational history. Live signals stay locked."],
    ["What does Free unlock?", "Profile, language, account preview and product structure, without operational predictions."],
    ["What does Signal Desk Pro unlock?", "Tennis live, football research, Best Bets, Top Model Signals, model explanations and track record."],
    ["Do agents place bets automatically?", "Not in the go-live: the public plan is research and signal desk. Execution remains internal/not sold."],
  ];
  return (
    <div className="public-homepage">
      <section className="public-sponsor-strip">
        <span>Partner placement</span>
        <strong>{lang === "it" ? "Slot sponsor generico, pronto per futuri operatori" : "Generic sponsor slot, ready for future operators"}</strong>
        <em>{lang === "it" ? "Nessun brand reale collegato ora" : "No real brand connected now"}</em>
      </section>

      <section className="preaccess-hero">
        <div>
          <p className="eyebrow">{lang === "it" ? "PREVEDI. ANALIZZA. ANTICIPA." : "PREDICT. ANALYZE. EDGE."}</p>
          <h3>{lang === "it" ? "Predictive intelligence per mercati sportivi, non un tipster feed" : "Predictive intelligence for sports markets, not a tipster feed"}</h3>
          <span>
            {lang === "it"
              ? "Una homepage pubblica mostra solo struttura, storico passato e partner placeholder. Prediction, edge e live execution si sbloccano solo dopo login e piano."
              : "The public homepage shows only structure, past history and partner placeholders. Predictions, edge and live execution unlock only after login and plan selection."}
          </span>
        </div>
        <DeskPreview />
        <div className="preaccess-actions">
          <button onClick={onCreate}>{t.preaccess_create}</button>
          <button onClick={onLogin}>{t.preaccess_login}</button>
          <button onClick={onPlans}>{lang === "it" ? "Vedi livelli" : "View levels"}</button>
        </div>
      </section>

      <section className="public-content-grid">
        <div className="public-main-column">
          <AccessLevels onCreate={onCreate} onPlans={onPlans} />
          <PublicOldBetsPanel history={visibleHistory} stats={historyStats} loading={historyLoading} />
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
      <p>{lang === "it" ? "Preview pubblica: dati sensibili oscurati fino al piano." : "Public preview: sensitive data hidden until plan activation."}</p>
    </div>
  );
}

function AccessLevels({ onCreate, onPlans }: { onCreate: () => void; onPlans: () => void }) {
  const lang = useLang();
  const priceCopy = {
    base: planPriceCopy("base", lang),
  };
  const levels = lang === "it" ? [
    { name: "Free", price: "€0", desc: "Profilo, lingua, preview e storico pubblico. Nessun segnale operativo.", cta: "Crea profilo", action: onCreate },
    { name: "Signal Desk Pro", price: priceCopy.base, desc: "Tennis live, football research, Best Bets, spiegazioni e track record.", cta: "Vai al piano", action: onPlans },
  ] : [
    { name: "Free", price: "€0", desc: "Profile, language, preview and public history. No operational signals.", cta: "Create profile", action: onCreate },
    { name: "Signal Desk Pro", price: priceCopy.base, desc: "Tennis live, football research, Best Bets, explanations and track record.", cta: "View plan", action: onPlans },
  ];
  return (
    <section className="public-section">
      <div className="public-section-head">
        <p className="eyebrow">{lang === "it" ? "Accesso clienti" : "Client access"}</p>
        <h3>{lang === "it" ? "Free più un piano unico, zero ambiguità" : "Free plus one paid plan, zero ambiguity"}</h3>
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

function PublicOldBetsPanel({ history, stats, loading }: { history: HistoryMatch[]; stats: HistoryStats | null; loading: boolean }) {
  const lang = useLang();
  return (
    <section className="public-section">
      <div className="public-section-head">
        <p className="eyebrow">{lang === "it" ? "Old bets" : "Old bets"}</p>
        <h3>{lang === "it" ? "Storico passato visibile senza login" : "Past history visible without login"}</h3>
      </div>
      {/* #LEGACY-HITRATE-1: the legacy `bets` feed has no confidence, so its
          aggregate hit-rate can't be floored and contradicted the surfaced
          track record (52% here vs the gated rate in the unified History tab).
          Drop the misleading headline; the canonical hit-rate lives in History. */}
      <div className="public-history-stats">
        <div><span>{lang === "it" ? "Partite" : "Matches"}</span><strong>{stats?.total_matches ?? "..."}</strong></div>
        <div><span>{lang === "it" ? "Bets" : "Bets"}</span><strong>{stats?.bets_placed ?? "..."}</strong></div>
      </div>
      <div className="public-old-bets">
        {loading ? (
          <div className="book-empty">{lang === "it" ? "Caricamento storico..." : "Loading history..."}</div>
        ) : history.length ? history.map((row, index) => (
          <div key={`${row.match_id}-${row.bet_selection ?? row.best_selection ?? index}`}>
            <span>{LEAGUE_FLAGS[row.league] ?? "FB"} {row.league}</span>
            <strong>{row.home_team} vs {row.away_team}</strong>
            {/* MEDIUM-1: pick gated server-side for non-paid viewers (selection
                comes back null) → show a lock instead of leaking/placeholdering it. */}
            <em>{row.bet_selection ?? row.best_selection ?? (lang === "it" ? "🔒 pick" : "🔒 pick")} · {row.bet_status}</em>
          </div>
        )) : (
          <div className="book-empty">{lang === "it" ? "Nessuno storico pubblico disponibile ora." : "No public history available right now."}</div>
        )}
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
        <h3>{lang === "it" ? "Sport futuri, non ancora cliccabili" : "Future sports, not clickable yet"}</h3>
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
  const copy = lang === "it" ? {
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
  } : {
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
  };

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
        <button onClick={() => { setSent(false); setMessage(""); }}>{lang === "it" ? "Nuova richiesta" : "New request"}</button>
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
          {lang === "it" ? "Messaggio troppo corto. Scrivi almeno 8 caratteri." : "Message too short. Please write at least 8 characters."}
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
        <h3>{lang === "it" ? "Domande essenziali prima del login" : "Essential questions before login"}</h3>
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
        {lang === "it"
          ? "Nota rischio: BetRedge mostra analisi probabilistiche. Non garantisce profitti e non sostituisce gestione del rischio personale."
          : "Risk note: BetRedge shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management."}
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
          ? (lang === "it" ? "Piano attuale" : "Current plan")
          : isDowngrade
            ? (lang === "it" ? "Già su Pro" : "Already on Pro")
            : profile
              ? `${t.crypto_activate} ${planLabel(plan, lang)}`
              : t.crypto_create_first}
      </button>
    </div>
  );
}

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
  const price = planAmountUsdt(plan);
  const t = useT();
  const lang = useLang();

  const handleCopy = () => {
    navigator.clipboard.writeText(USDT_TRC20_ADDRESS).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const payWithCard = async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requested_plan: plan }),
    });
    if (!res.ok) {
      console.error("stripe checkout failed", res.status);
      return;
    }
    const { url } = (await res.json()) as { url?: string };
    if (url) window.location.href = url;
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-head">
          <p className="eyebrow">Checkout · USDT TRC20</p>
          <h3>{planLabel(plan, lang)}</h3>
          <span>
            {lang === "it" ? <>Invia esattamente <strong style={{ color: "var(--am-coral)", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{price.toFixed(2)} USDT</strong> all&apos;indirizzo qui sotto. Il piano passerà in verifica.</> : <>Send exactly <strong style={{ color: "var(--am-coral)", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{price.toFixed(2)} USDT</strong> to the address below. The plan will move to review.</>}
          </span>
        </div>

        <div className="checkout-wallet-block">
          <span>Network: TRC20 (Tron) · USDT</span>
          <div className="checkout-address">
            <code>{USDT_TRC20_ADDRESS}</code>
            <button type="button" onClick={handleCopy}>{copied ? t.checkout_copied : t.checkout_copy}</button>
          </div>
          <em>{t.checkout_amount}: {price.toFixed(2)} USDT · {t.checkout_monthly}</em>
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
          <a href="mailto:info@agenticmarkets.com?subject=Pagamento%20-%20attivazione" style={{ color: "var(--am-coral)", textDecoration: "underline" }}>
            info@agenticmarkets.com
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
              setError(lang === "it"
                ? "Invio non riuscito: la transazione non è stata registrata. Controlla la connessione e riprova, oppure scrivi a info@agenticmarkets.com."
                : "Submission failed: your transaction was not recorded. Check your connection and retry, or email info@agenticmarkets.com.");
            }
          }}
          style={{ marginTop: 4 }}
        >
          {submitting ? (lang === "it" ? "Invio in corso…" : "Submitting…") : <>{t.checkout_confirm} · {price.toFixed(2)} USDT</>}
        </button>
        {error && (
          <p style={{ fontSize: "12px", fontFamily: "var(--font-mono), ui-monospace, monospace", color: "var(--am-negative)", lineHeight: 1.5, margin: "8px 0 0" }}>
            {error}
          </p>
        )}

        {process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" && (
          <button
            type="button"
            onClick={payWithCard}
            style={{ marginTop: 8, background: "none", border: "1px solid var(--am-coral)", color: "var(--am-coral)", cursor: "pointer" }}
          >
            {lang === "it" ? "Paga con carta" : "Pay with card"}
          </button>
        )}

        <p>
          {t.checkout_note_prefix} {price.toFixed(2)} {t.checkout_note_suffix}{" "}
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

      <section className="plans-grid plans-grid-3">
        {/* ── FREE ── */}
        <article className="plan-card">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">Free</p>
              <h4>BetRedge Free</h4>
            </div>
            <span>€0</span>
          </div>
          <p className="plan-description">
            {lang === "it"
              ? "Una prediction per sport ogni settimana, sbloccata del tutto. Profilo e storico pubblico."
              : "One prediction per sport every week, fully unlocked. Profile and public history."}
          </p>
          <div className="price-line">
            <strong>€0</strong>
            <span>{lang === "it" ? "Per sempre" : "Forever"}</span>
          </div>
          <div className="plan-core-line">
            <strong>{lang === "it" ? "1 per sport / settimana" : "1 per sport / week"}</strong>
            <em>{lang === "it" ? "La top del modello per calcio e per tennis." : "The model's top pick for football and tennis."}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{lang === "it" ? "1 top prediction calcio + 1 tennis / settimana" : "1 top football + 1 tennis prediction / week"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Pick, probabilità e spiegazione su quelle" : "Pick, probabilities and explanation on those"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Profilo e lingua salvati · storico pubblico" : "Profile and language saved · public history"}</PlanFeature>
            <PlanFeature locked>{lang === "it" ? "Resto del board, edge e Deep Analysis" : "Rest of the board, edge and Deep Analysis"}</PlanFeature>
          </ul>
          <button className="plan-action" disabled={!profile || profile.plan === "free"} onClick={onActivateFree}>
            {!profile ? t.crypto_create_first : profile.plan === "free" ? (lang === "it" ? "Free attivo" : "Free active") : (lang === "it" ? "Attiva Free" : "Activate Free")}
          </button>
        </article>

        {/* ── BASE ── */}
        <article className="plan-card">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">{lang === "it" ? "Più popolare" : "Most popular"}</p>
              <h4>{planLabel("base", lang)}</h4>
            </div>
            <span>{planPriceCopy("base", lang)}</span>
          </div>
          <p className="plan-description">
            {lang === "it"
              ? "Le top 5 prediction per sport ogni settimana, con edge e spiegazioni complete."
              : "The top 5 predictions per sport every week, with full edge and explanations."}
          </p>
          <div className="price-line">
            <strong>{planPriceCopy("base", lang)}</strong>
            <span>Crypto only · USDT TRC20</span>
          </div>
          <div className="plan-core-line">
            <strong>{lang === "it" ? "5 per sport / settimana" : "5 per sport / week"}</strong>
            <em>{lang === "it" ? "10 prediction a settimana, le migliori per edge." : "10 predictions a week, the best by edge."}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{lang === "it" ? "Top 5 calcio + 5 tennis / settimana (10 totali)" : "Top 5 football + 5 tennis / week (10 total)"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Pick, probabilità e spiegazione" : "Pick, probabilities and explanation"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Edge %, stake suggerito, closing line value" : "Edge %, suggested stake, closing line value"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Storico completo settlato" : "Full settled history"}</PlanFeature>
            <PlanFeature locked>{lang === "it" ? "Prediction illimitate e Deep Analysis (→ Pro)" : "Unlimited predictions and Deep Analysis (→ Pro)"}</PlanFeature>
          </ul>
          <CryptoPaymentBox profile={profile} plan="base" onSubmit={onPaymentSubmit} />
        </article>

        {/* ── PRO (premium) ── */}
        <article className="plan-card is-premium">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">{lang === "it" ? "Tutto incluso" : "Everything"}</p>
              <h4>{planLabel("premium", lang)}</h4>
            </div>
            <span>{planPriceCopy("premium", lang)}</span>
          </div>
          <p className="plan-description">
            {lang === "it"
              ? "Accesso completo: tutte le prediction, illimitate, su ogni sport, con la massima profondità."
              : "Full access: all predictions, unlimited, across every sport, at maximum depth."}
          </p>
          <div className="price-line">
            <strong>{planPriceCopy("premium", lang)}</strong>
            <span>Crypto only · USDT TRC20</span>
          </div>
          <div className="plan-core-line">
            <strong>{lang === "it" ? "Illimitato" : "Unlimited"}</strong>
            <em>{lang === "it" ? "Nessun limite settimanale, tutta la piattaforma." : "No weekly cap, the whole platform."}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{lang === "it" ? "TUTTE le prediction, illimitate" : "ALL predictions, unlimited"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Deep Analysis: forma, infortuni, venue" : "Deep Analysis: form, injuries, venue"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Tennis Live V4 e Football Live V4 research" : "Tennis Live V4 and Football Live V4 research"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Match Builder e Best Bets +EV" : "Match Builder and Best Bets +EV"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Edge, stake e CLV su tutto" : "Edge, stake and CLV on everything"}</PlanFeature>
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

  const copy = lang === "it" ? {
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
  } : {
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
  };

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
}: {
  intent: ClientAuthIntent;
  onClose: () => void;
  onAuthed: (profile: ClientProfile, serverPlan?: ClientProfile["plan"]) => void;
}) {
  const [mode, setMode] = useState<ClientAuthIntent>(intent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [busy, setBusy] = useState(false);
  // #SIGNUP-GATE: legal-age + ToS acceptance are mandatory before a profile is created.
  const [ageOk, setAgeOk] = useState(false);
  const [tosOk, setTosOk] = useState(false);
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
          // #MB-1: first-touch influencer ref from a Match Builder share link
          ref: mode === "create"
            ? (() => { try { return window.localStorage.getItem("am_ref") ?? undefined; } catch { return undefined; } })()
            : undefined,
        }),
      });
      const data = await resp.json().catch(() => ({})) as { plan?: ClientProfile["plan"]; name?: string | null; pending_activation?: boolean; error?: string };
      // HIGH-3: register no longer logs in — it sends an activation email. Show
      // a "check your inbox" notice instead of a session.
      if (resp.status === 202 || data.pending_activation) {
        setInfo(it
          ? `Ti abbiamo inviato un'email di attivazione a ${normalizedEmail}. Clicca il link per attivare il profilo (controlla anche lo spam).`
          : `We sent an activation email to ${normalizedEmail}. Click the link to activate your profile (check spam too).`);
        setShowResend(true);
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

  return (
    <div className="auth-modal-backdrop">
      <form className="auth-modal"
        onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ position: "relative" }}>
        <button type="button" onClick={onClose} aria-label={it ? "Chiudi" : "Close"}
          style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none",
            color: "var(--am-muted-2)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4 }}>
          ×
        </button>
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
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "create" ? t.auth_pw_placeholder_new : "••••••••"}
            autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>
        {/* #SIGNUP-GATE: +18 confirmation + Terms acceptance, required to create a profile */}
        {mode === "create" && (
          <div className="auth-consent" style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 0" }}>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.45, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} style={{ width: "auto", marginTop: 2, flex: "0 0 auto" }} />
              <span>{t.auth_age_confirm}</span>
            </label>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.45, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={tosOk} onChange={(e) => setTosOk(e.target.checked)} style={{ width: "auto", marginTop: 2, flex: "0 0 auto" }} />
              <span>{t.auth_tos_pre}<Link href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--am-coral)", textDecoration: "underline" }}>{t.auth_tos_link}</Link>{t.auth_tos_post}</span>
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
            <p className="eyebrow">{lang === "it" ? "Abbonamento" : "Subscription"}</p>
            <h3>{daysLeft > 0
              ? `${daysLeft} ${lang === "it" ? (daysLeft === 1 ? "giorno rimanente" : "giorni rimanenti") : (daysLeft === 1 ? "day left" : "days left")}`
              : (lang === "it" ? "Scaduto" : "Expired")}</h3>
            <span>{lang === "it" ? "Signal Desk Pro · rinnovo mensile" : "Signal Desk Pro · monthly renewal"}</span>
          </div>
          {daysLeft <= 7 && <button onClick={onUpgrade}>{lang === "it" ? "Rinnova" : "Renew"}</button>}
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

function bestFootballSelection(p: Prediction) {
  if (!p.best_selection) return null;
  const map = {
    HOME: { name: p.home_team, odds: p.odds_home, probability: p.p_home },
    DRAW: { name: "Draw", odds: p.odds_draw, probability: p.p_draw },
    AWAY: { name: p.away_team, odds: p.odds_away, probability: p.p_away },
  } as const;
  return map[p.best_selection as keyof typeof map] ?? null;
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

// Qualitative form word from real W-D-L counts (no raw numbers in the prose).
function formMoodWord(f: { w: number; d: number; l: number } | null, lang: Lang): string | null {
  if (!f) return null;
  const it = lang === "it";
  const played = f.w + f.d + f.l;
  if (played === 0) return null;
  if (f.w >= 3 || (f.w >= 2 && f.l === 0)) return it ? "in un buon momento" : "in good form";
  if (f.l >= 3 || f.w === 0) return it ? "in un periodo difficile" : "going through a rough patch";
  return it ? "in forma altalenante" : "in patchy form";
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
  const out: string[] = [];

  // ── Sentence 1 — form / momentum story ──
  const homeW = formMoodWord(teamFormCounts(e.form_home), lang);
  const awayW = formMoodWord(teamFormCounts(e.form_away), lang);
  if (!top.isDraw && homeW && awayW) {
    const pickIsHome = top.isHome;
    const pickTeam = pickIsHome ? p.home_team : p.away_team;
    const otherTeam = pickIsHome ? p.away_team : p.home_team;
    const pickW = pickIsHome ? homeW : awayW;
    const otherW = pickIsHome ? awayW : homeW;
    out.push(it
      ? `${pickTeam} arriva ${pickW}${pickIsHome ? "" : " e in trasferta tiene bene"}, mentre ${otherTeam} è ${otherW}.`
      : `${pickTeam} comes in ${pickW}${pickIsHome ? "" : " and travels well"}, while ${otherTeam} is ${otherW}.`);
  } else if (top.isDraw) {
    out.push(it
      ? `Le due squadre si equivalgono e il modello vede l'equilibrio reggere fino in fondo.`
      : `The two sides are evenly matched and the model sees the balance holding to the end.`);
  } else if (tp >= 65) {
    out.push(it
      ? `${top.name} parte nettamente favorito secondo il modello.`
      : `${top.name} starts as a clear favourite for the model.`);
  } else {
    out.push(it
      ? `Partita aperta, con ${top.name} leggermente avanti per il modello.`
      : `An open game, with ${top.name} a slight edge for the model.`);
  }

  // ── Sentence 2 — value / honest model-read logic ──
  const tail = top.isDraw ? (it ? " sul pareggio" : " on the draw")
    : top.isHome ? (it ? " in casa" : " on the home side")
    : (it ? " sulla trasferta" : " on the away side");
  if (p.edge != null && p.odds_home != null) {
    if (isFootballBestBet(p)) {
      out.push(it
        ? `Il modello la dà più probabile di quanto prezzi la quota: da qui il valore${tail}.`
        : `The model rates it likelier than the price implies — that's where the value${tail} sits.`);
    } else {
      out.push(it
        ? `Il mercato la prezza già in linea col modello: nessun margine di valore da prendere.`
        : `The market already prices it in line with the model — no value edge to take.`);
    }
  } else {
    out.push(it
      ? `Non c'è una quota di mercato: è la lettura del modello, non una value bet.`
      : `There's no market price here — it's the model's read, not a value bet.`);
  }

  // Honesty: surface a small-sample caveat so a pick built on few matches does
  // not read as confident as one built on a solid sample.
  const mH = e.matches?.home, mA = e.matches?.away;
  if (mH != null && mA != null) {
    const low = mH < 10 || mA < 10;
    out.push(it
      ? `Stima basata su ${mH} contro ${mA} partite${low ? " — campione limitato, più incertezza." : ", un campione solido."}`
      : `Built on ${mH} vs ${mA} matches${low ? " — a small sample, so more uncertainty." : ", a solid sample."}`);
  }

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
  const out: string[] = [];

  // ── Sentence 1 — favourite + surface story ──
  if (tbd) {
    out.push(it
      ? `L'avversario non è ancora confermato: per ora è una lettura provvisoria del modello ${surf}.`
      : `The opponent isn't confirmed yet, so for now it's a provisional model read ${surf}.`);
  } else if (gap <= 0.06) {
    out.push(it
      ? `Match equilibrato ${surf}: il modello non vede un favorito reale.`
      : `A balanced match ${surf}: the model sees no real favourite.`);
  } else {
    let eloTail = "";
    if (m.elo_p1 != null && m.elo_p2 != null) {
      const d = Math.abs(m.elo_p1 - m.elo_p2);
      const leaderIsFav = (m.elo_p1 >= m.elo_p2) === favIsP1;
      if (d >= 60 && leaderIsFav) eloTail = it ? `, dove ha un netto vantaggio nei rating sulla superficie` : `, where they hold a clear edge in the surface ratings`;
      else if (d >= 15 && leaderIsFav) eloTail = it ? `, dove parte un po' più in alto nei rating sulla superficie` : `, where they sit a little higher in the surface ratings`;
    }
    const strong = Math.max(m.p1, m.p2) >= 0.65;
    out.push(it
      ? `Il modello vede ${favName} ${strong ? "nettamente favorito" : "favorito di misura"} ${surf}${eloTail}.`
      : `The model makes ${favName} ${strong ? "a clear favourite" : "a narrow favourite"} ${surf}${eloTail}.`);
  }

  // ── Sentence 2 — value / honest model-read ──
  const tail = it ? ` su ${favName}` : ` on ${favName}`;
  if (isTennisBestBet(m)) {
    out.push(it
      ? `Il modello lo dà più probabile di quanto prezzi la quota: da qui il valore${tail}.`
      : `The model rates it likelier than the price implies — that's where the value${tail} sits.`);
  } else if (m.odds_p1 != null || m.odds_p2 != null) {
    out.push(it
      ? `Il mercato lo prezza già in linea col modello: nessun valore da prendere.`
      : `The market already prices it in line with the model — no value to take.`);
  } else {
    out.push(it
      ? `Non c'è una quota di mercato: è la lettura del modello, non una value bet.`
      : `There's no market price here — it's the model's read, not a value bet.`);
  }

  return out.join(" ");
}



function PredictionCard({ p, onSelect, onBetNow, isPreview, isPremium, onGate }: { p: Prediction; onSelect?: (s: SlipSelection) => void; onBetNow?: () => void; isPreview?: boolean; isPremium?: boolean; onGate?: () => void }) {
  const [showWhy, setShowWhy] = useState(false);
  const t = useT();
  const lang = useLang();
  const betLinksEnabled = useBetLinksEnabled();
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
  const rowsData: { key: "HOME" | "DRAW" | "AWAY"; pct: number }[] = [
    { key: "HOME", pct: p.p_home }, { key: "DRAW", pct: p.p_draw }, { key: "AWAY", pct: p.p_away },
  ];
  // Demoted extra-markets (schedina) — moved into the expandable analysis.
  const extraPicks = (e.extra_markets ?? []).filter((m) => m.p >= 0.55).sort((a, b) => b.p - a.p).slice(0, 5);

  // ── Direction B readout: Market vs Model vs Edge (clear-pick cards only) ──
  // All figures are REAL: model% = the model's probability for the pick,
  // market% = raw implied (1/odds) for that same pick, edge = p.edge (value)
  // or the model-edge margin when there is no market price. Nothing fabricated.
  const pickKey = !belowFloor ? p.best_selection : null;
  const pickName =
    pickKey === "HOME" ? p.home_team
    : pickKey === "AWAY" ? p.away_team
    : pickKey === "DRAW" ? (lang === "it" ? "Pareggio" : "Draw")
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
  const edgeVal = p.edge != null && p.edge > 0 ? p.edge * 100 : null;
  // Confidence 0-100 → 4-dot meter + word label.
  const confScore = p.confidence_score ?? (pickProb != null ? confidenceFromEdge(p.edge, pickProb) : null);
  const confDots = confScore != null ? Math.max(1, Math.min(4, Math.round(confScore / 25))) : 0;
  const confLabel = confScore == null ? null
    : confScore >= 70 ? (lang === "it" ? "alta" : "high")
    : confScore >= 45 ? (lang === "it" ? "media" : "medium")
    : (lang === "it" ? "bassa" : "low");

  return (
    <article className="card"><div className="pred">
      {/* top: sport glyph + league + when (live pulse) */}
      <div className="top">
        <div className="comp">
          <svg className="sgi" aria-hidden="true"><use href="#g-ball" /></svg>
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
            <span className="stt">{isFutureMarket(p.kickoff) ? (lang === "it" ? "Kickoff" : "Kickoff") : (lang === "it" ? "Programmato" : "Scheduled")}</span>
            <span className="sc sched">{fmtKickoff(p.kickoff, lang, tz, p.enrichment?.time_confirmed)}</span>
          </div>
        )}
      </div>

      {/* model-vs-market readout / gate overlay */}
      {p.locked ? (
        <div className="lock-overlay" role="button" onClick={() => onGate?.()}>
          <span className="blurred">▒▒ HOME ▒▒▒%</span>
          <span className="blurred">▒▒ DRAW ▒▒▒%</span>
          <span className="blurred">▒▒ AWAY ▒▒▒%</span>
          <span className="locked-cta">{t.locked_title}</span>
        </div>
      ) : belowFloor ? (
        <>
          {/* open match — no clear favourite: keep the honest 1X2 bars */}
          <div className="rows">
            {rowsData.map((r) => (
              <div key={r.key} className="row">
                <span className="lab">{r.key}</span>
                <div className="track"><span className="fill" style={{ width: `${Math.round(r.pct * 100)}%` }} /></div>
                <span className="pct">{pct(r.pct)}</span>
              </div>
            ))}
          </div>
          <span className="edge flat">{t.no_clear_favorite} · {t.open_match}</span>
        </>
      ) : (
        <>
          <div
            className={`mvm${onSelect && isValueBet && p.best_selection ? " sel" : ""}`}
            onClick={onSelect && isValueBet && p.best_selection ? handleSelect : undefined}
          >
            <div className="col">
              <div className="n">{isPreview ? "🔒" : marketImplied != null ? pct(marketImplied) : "–"}</div>
              <div className="l">{lang === "it" ? "Mercato" : "Market"}</div>
            </div>
            <div className="col model">
              <div className="n">{pickProb != null ? pct(pickProb) : "–"}</div>
              <div className="l">{lang === "it" ? "Modello" : "Model"}{pickName ? ` · ${pickName}` : ""}</div>
            </div>
            <div className={`col edge${edgeVal != null && !isPreview ? " val" : ""}`}>
              <div className="n">
                {isPreview ? "🔒"
                  : edgeVal != null ? `+${edgeVal.toFixed(1)}%`
                  : "–"}
              </div>
              <div className="l">Edge</div>
            </div>
          </div>
          {!isPreview && edgeVal != null && confScore != null && (
            <div className="conf">
              <span className="conf-lab">{lang === "it" ? "Confidenza" : "Confidence"}</span>
              {[0, 1, 2, 3].map((i) => <span key={i} className={`dot${i < confDots ? " on" : ""}`} />)}
              {confLabel && <span className="conf-txt">{confLabel}</span>}
            </div>
          )}
          {!isPreview && edgeVal == null && (
            <span className="edge flat">
              {marketImplied != null
                ? (lang === "it" ? "nessun edge · in linea col mercato" : "no edge · in line with market")
                : (lang === "it" ? "nessuna quota · lettura del modello" : "no market price · model read")}
            </span>
          )}
          {isPreview && <span className="edge flat">🔒 {lang === "it" ? "Mercato ed edge richiedono Pro" : "Market & edge require Pro"}</span>}
        </>
      )}

      {/* WHY — readout + expandable analysis (deep-analysis / schedina / affiliate live here) */}
      <div className="why">
        <div className="why-box">
          <div className="why-lab">{lang === "it" ? "Perché" : "Why"}</div>
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
                ? (lang === "it" ? "Nascondi analisi" : "Hide analysis")
                : (lang === "it" ? "Leggi l'analisi completa" : "Read full analysis")} <span className="ar">→</span>
            </button>
          )}
        </div>

        {/* footer action row */}
        <div className="act">
          {!isPreview && pickOdds != null && (
            <span className="odds"><span className="odds-lab">{lang === "it" ? "Quota" : "Odds"}</span><b>{pickOdds.toFixed(2)}</b></span>
          )}
          {/* bet action: dropdown partner affiliati quando attivo (→ sito esterno),
              altrimenti vecchio CTA. FT → status note. */}
          {!isPreview && (betLinksEnabled || onBetNow) && (isFinished ? (
            <span className="ft-note">{lang === "it" ? "Terminata — in arrivo nello storico" : "Full time — moving to history"}</span>
          ) : betLinksEnabled ? (
            <PlaceBetMenu
              buttonClassName="betbtn"
              label={lang === "it" ? "Piazza scommessa" : "Place bet"}
              disclaimer={lang === "it" ? "18+ · Gioca responsabilmente · *Link affiliato — potremmo ricevere una commissione, senza costi per te." : "18+ · Play responsibly · *Affiliate link — we may earn a commission at no cost to you."}
              selection={{
                sport: p.league === "WC" ? "worldcup" : "football",
                league: p.league,
                homeTeam: p.home_team,
                awayTeam: p.away_team,
                market: "1X2",
                pick: p.pick ?? p.best_selection ?? "",
                odds: null,
                eventStartUtc: p.kickoff,
              }}
            />
          ) : (
            <button className="betbtn" onClick={onBetNow}>{t.bet_now}</button>
          ))}
          <span className="model">{lang === "it" ? "Modello calibrato" : "Calibrated model"}</span>
          {isPreview || p.locked ? (
            <span className="gate">Pro</span>
          ) : isFinished ? (
            <span className="gate settled">{lang === "it" ? "Settlato" : "Settled"}</span>
          ) : (
            <span className="gate">Pro</span>
          )}
        </div>

        {/* expandable analysis body */}
        {isPreview ? (
          <div className="nudge">
            <strong>{lang === "it" ? "Edge e analisi richiedono Signal Desk Pro" : "Edge and analysis require Signal Desk Pro"}</strong>
            <em>{lang === "it" ? "Sblocca edge%, ragionamento AI e segnali con Pro (49.90 USDT/mese)." : "Unlock edge%, AI reasoning and signals with Pro (49.90 USDT/month)."}</em>
          </div>
        ) : showWhy && (
        <div className="why-body">
          {p.pick && (
            <p className="why-prose mono">Pick: <strong>{p.pick}</strong>{p.confidence_score != null ? ` · ${p.confidence_score}%` : ""}</p>
          )}

          {/* Schedina (extra markets) — demoted into the expansion */}
          {extraPicks.length > 0 && (
            <div className="extra-markets">
              <span className="extra-markets-label">{lang === "it" ? "Schedina" : "Acca picks"}</span>
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
            <span className="da-title">{lang === "it" ? "Analisi approfondita" : "Deep Analysis"}</span>
          </div>
          {(e.xg_home != null || e.xg_away != null) && (
            <div className="da-row">
              <span className="da-label">{lang === "it" ? "Gol attesi" : "Expected goals"}</span>
              <span className="da-value">{e.xg_home?.toFixed(2) ?? "–"} vs {e.xg_away?.toFixed(2) ?? "–"}</span>
            </div>
          )}
          {(e.npxg_home != null || e.npxg_away != null) && (
            <div className="da-row">
              <span className="da-label">npxG</span>
              <span className="da-value">{e.npxg_home?.toFixed(2) ?? "–"} vs {e.npxg_away?.toFixed(2) ?? "–"}</span>
            </div>
          )}
          {(e.ppda_home != null || e.ppda_away != null) && (
            <div className="da-row">
              <span className="da-label">Pressing (PPDA)</span>
              <span className="da-value">{e.ppda_home?.toFixed(1) ?? "–"} vs {e.ppda_away?.toFixed(1) ?? "–"}</span>
            </div>
          )}
          {(e.form_home || e.form_away) && (
            <div className="da-row">
              <span className="da-label">{lang === "it" ? "Forma" : "Form"}</span>
              <span className="da-value">{fmtFormAny(e.form_home) ?? "–"} vs {fmtFormAny(e.form_away) ?? "–"}</span>
            </div>
          )}
          {/* World Cup context rows — real venue/squad/sample data */}
          {e.kind === "world_cup" && e.venue && (e.venue.travel_km_home != null || e.venue.travel_km_away != null) && (
            <div className="da-row">
              <span className="da-label">✈️ {lang === "it" ? "Trasferta" : "Travel"}</span>
              <span className="da-value">{e.venue.travel_km_home != null ? `${Math.round(e.venue.travel_km_home).toLocaleString()} km` : "–"} vs {e.venue.travel_km_away != null ? `${Math.round(e.venue.travel_km_away).toLocaleString()} km` : "–"}</span>
            </div>
          )}
          {e.kind === "world_cup" && e.venue && (e.venue.rest_days_home != null || e.venue.rest_days_away != null) && (
            <div className="da-row">
              <span className="da-label">😴 {lang === "it" ? "Riposo" : "Rest"}</span>
              <span className="da-value">{e.venue.rest_days_home ?? "–"} vs {e.venue.rest_days_away ?? "–"} {lang === "it" ? "giorni" : "days"}</span>
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
              <span className="da-label">🚑 {lang === "it" ? "Infortuni rosa" : "Squad injuries"}</span>
              <span className="da-value">{e.squad?.injuries_home?.length ?? 0} vs {e.squad?.injuries_away?.length ?? 0}</span>
            </div>
          )}
          {e.kind === "world_cup" && e.matches && (e.matches.home != null || e.matches.away != null) && (
            <div className="da-row">
              <span className="da-label">🗃️ {lang === "it" ? "Campione" : "Sample"}</span>
              <span className="da-value">{e.matches.home ?? "–"} vs {e.matches.away ?? "–"} {lang === "it" ? "partite" : "matches"}</span>
            </div>
          )}
          {(e.pi_home != null || e.pi_away != null) && (
            <div className="da-row">
              <span className="da-label">{lang === "it" ? "Rating" : "Rating"}</span>
              <span className="da-value">{e.pi_home ?? "–"} vs {e.pi_away ?? "–"}</span>
            </div>
          )}
          {((e.injuries_home?.length ?? 0) > 0 || (e.injuries_away?.length ?? 0) > 0) && (
            <div className="da-row">
              <span className="da-label">🚑 {lang === "it" ? "Infortuni" : "Injuries"}</span>
              <span className="da-value">H:{e.injuries_home?.length ?? 0} · A:{e.injuries_away?.length ?? 0}</span>
            </div>
          )}
          {e.weather && (
            <div className="da-row">
              <span className="da-label">{e.weather.icon} {lang === "it" ? "Meteo" : "Weather"}</span>
              <span className="da-value">{e.weather.temp}°C · {e.weather.condition} · {e.weather.wind}km/h</span>
            </div>
          )}
          {e.api_pct_home != null && (
            <div className="da-row">
              <span className="da-label">API-FB</span>
              <span className="da-value">H:{e.api_pct_home}% D:{e.api_pct_draw ?? "–"}% A:{e.api_pct_away ?? "–"}%{e.api_advice ? ` · ${e.api_advice}` : ""}</span>
            </div>
          )}
          {e.extra_markets && e.extra_markets.some((m) => m.edge != null) && (
            <div className="da-row da-markets-row">
              <span className="da-label">{lang === "it" ? "Mercati" : "Markets"}</span>
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
          <span>{lang === "it" ? "Analisi approfondita disponibile con Signal Desk Pro (49.90 USDT/mese)" : "Deep analysis available with Signal Desk Pro (49.90 USDT/month)"}</span>
        </div>
      )}
        </div>
        )}
      </div>
    </div></article>
  );
}

// ─── Tennis Tab ───────────────────────────────────────────────────────────────

const SURFACE_META: Record<string, { label: string; color: string }> = {
  CLAY:  { label: "CLAY",  color: "text-orange-400 border-orange-400/40 bg-orange-400/10" },
  GRASS: { label: "GRASS", color: "text-green-400 border-green-400/40 bg-green-400/10" },
  HARD:  { label: "HARD",  color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
};


function TennisMatchCard({ m, onSelect, onBetNow, isPreview, isPremium, onGate }: { m: TennisMatch; onSelect?: (s: SlipSelection) => void; onBetNow?: () => void; isPreview?: boolean; isPremium?: boolean; onGate?: () => void }) {
  const [showWhy, setShowWhy] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const t = useT();
  const lang = useLang();
  const betLinksEnabled = useBetLinksEnabled();
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
  const rowsData: { player: "P1" | "P2"; name: string; pct: number }[] = [
    { player: "P1", name: m.player1.split(" ").pop() ?? m.player1, pct: m.p1 },
    { player: "P2", name: m.player2.split(" ").pop() ?? m.player2, pct: m.p2 },
  ];

  // ── Direction B readout (tennis): Market vs Model vs Edge ──
  // Mirror the football card: the SHOWN player must be the one the edge refers
  // to. `best_selection` is the agent's value pick (max-edge) and can be the
  // underdog — showing the model favourite next to that edge misattributes it
  // (and clicking the favourite then zeroed the edge in handleSelect).
  const valuePlayer: "P1" | "P2" | null =
    m.best_selection === "P1" || m.best_selection === "P2" ? m.best_selection : null;
  const favPlayer: "P1" | "P2" | null = hasFavorite ? (p1IsPick ? "P1" : "P2") : null;
  const pickPlayer: "P1" | "P2" | null = (isValue && valuePlayer) ? valuePlayer : favPlayer;
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
    : confScore >= 70 ? (lang === "it" ? "alta" : "high")
    : confScore >= 45 ? (lang === "it" ? "media" : "medium")
    : (lang === "it" ? "bassa" : "low");

  return (
    <article className="card tennis"><div className="pred tennis">
      {/* top: surface glyph + tournament + when */}
      <div className="top">
        <div className="comp">
          <svg className="sgi" aria-hidden="true"><use href="#g-grass" /></svg>
          <span className="league">{m.tournament}</span>
          {m.round && <span className="rnd">{m.round}</span>}
        </div>
        {liveIsOn ? (
          <span className="when live"><span className="pulse" />{lang === "it" ? "live" : "live"}</span>
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
            <span className="stt">{lang === "it" ? "Programmato" : "Scheduled"}</span>
            <span className="sc sched">{scheduledDate} · {surface.label}</span>
          </div>
        )}
      </div>

      {/* verdict line + rows / gate overlay */}
      {m.locked ? (
        <div className="lock-overlay" role="button" onClick={() => onGate?.()}>
          <span className="blurred">▒▒▒▒▒▒▒▒ ▒▒▒%</span>
          <span className="blurred">▒▒▒▒▒▒▒▒ ▒▒▒%</span>
          <span className="locked-cta">{t.locked_title}</span>
        </div>
      ) : !hasFavorite ? (
        <>
          {/* dead heat — no favourite: keep the honest two-way bars */}
          <div className="rows">
            {rowsData.map((r) => (
              <div key={r.player} className="row">
                <span className="lab">{r.name}</span>
                <div className="track"><span className="fill" style={{ width: `${Math.round(r.pct * 100)}%` }} /></div>
                <span className="pct">{pct(r.pct)}</span>
              </div>
            ))}
          </div>
          <span className="edge flat">{lang === "it" ? "Nessun favorito · match aperto" : "No favourite · open match"}</span>
        </>
      ) : (
        <>
          <div
            className={`mvm${onSelect && isValue && pickPlayer ? " sel" : ""}`}
            onClick={onSelect && isValue && pickPlayer ? () => handleSelect(pickPlayer as "P1" | "P2") : undefined}
          >
            <div className="col">
              <div className="n">{isPreview ? "🔒" : marketImplied != null ? pct(marketImplied) : "–"}</div>
              <div className="l">{lang === "it" ? "Mercato" : "Market"}</div>
            </div>
            <div className="col model">
              <div className="n">{pickProb != null ? pct(pickProb) : "–"}</div>
              <div className="l">{lang === "it" ? "Modello" : "Model"}{pickName ? ` · ${pickName}` : ""}</div>
            </div>
            <div className={`col edge${edgeVal != null && !isPreview ? " val" : ""}`}>
              <div className="n">
                {isPreview ? "🔒"
                  : edgeVal != null ? `+${edgeVal.toFixed(1)}%`
                  : "–"}
              </div>
              <div className="l">Edge</div>
            </div>
          </div>
          {!isPreview && edgeVal != null && confScore != null && (
            <div className="conf">
              <span className="conf-lab">{lang === "it" ? "Confidenza" : "Confidence"}</span>
              {[0, 1, 2, 3].map((i) => <span key={i} className={`dot${i < confDots ? " on" : ""}`} />)}
              {confLabel && <span className="conf-txt">{confLabel}</span>}
            </div>
          )}
          {!isPreview && edgeVal == null && (
            <span className="edge flat">
              {marketImplied != null
                ? (lang === "it" ? "nessun edge · in linea col mercato" : "no edge · in line with market")
                : (lang === "it" ? "nessuna quota · lettura del modello" : "no market price · model read")}
            </span>
          )}
          {isPreview && <span className="edge flat">🔒 {lang === "it" ? "Mercato ed edge richiedono Pro" : "Market & edge require Pro"}</span>}
        </>
      )}

      {/* WHY — Elo readout + expandable analysis */}
      <div className="why">
        <div className="why-box">
          <div className="why-lab">{lang === "it" ? "Perché" : "Why"}</div>
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
                ? (lang === "it" ? "Carico l'analisi…" : "Loading analysis…")
                : showWhy
                  ? (lang === "it" ? "Nascondi analisi" : "Hide analysis")
                  : (lang === "it" ? "Leggi l'analisi completa" : "Read full analysis")} <span className="ar">→</span>
            </button>
          )}
        </div>

        {/* footer action row */}
        <div className="act">
          {!isPreview && pickOdds != null && (
            <span className="odds"><span className="odds-lab">{lang === "it" ? "Quota" : "Odds"}</span><b>{pickOdds.toFixed(2)}</b></span>
          )}
          {!isPreview && (betLinksEnabled || onBetNow) && (liveIsFinal ? (
            <span className="ft-note">{lang === "it" ? "Terminata — in arrivo nello storico" : "Full time — moving to history"}</span>
          ) : betLinksEnabled ? (
            <PlaceBetMenu
              buttonClassName="betbtn"
              label={lang === "it" ? "Piazza scommessa" : "Place bet"}
              disclaimer={lang === "it" ? "18+ · Gioca responsabilmente · *Link affiliato — potremmo ricevere una commissione, senza costi per te." : "18+ · Play responsibly · *Affiliate link — we may earn a commission at no cost to you."}
              selection={{
                sport: "tennis",
                market: "MO",
                pick: m.pick ?? m.best_selection ?? "",
                odds: null,
              }}
            />
          ) : (
            <button className="betbtn" onClick={onBetNow}>{t.bet_now}</button>
          ))}
          <span className="model">{lang === "it" ? "Modello calibrato" : "Calibrated model"}</span>
          <span className="gate">Pro</span>
        </div>

        {/* expandable analysis body */}
        {isPreview ? (
          <div className="nudge">
            <strong>{lang === "it" ? "Edge e analisi richiedono Signal Desk Pro" : "Edge and analysis require Signal Desk Pro"}</strong>
            <em>{lang === "it" ? "Sblocca edge%, analisi del modello e segnali tennis con Pro (49.90 USDT/mese)." : "Unlock edge%, model analysis and tennis signals with Pro (49.90 USDT/month)."}</em>
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
            <span className="da-title">{lang === "it" ? "Analisi del modello" : "Model analysis"}</span>
          </div>
          <div className="da-row">
            <span className="da-label">Rating {surface.label}</span>
            <span className="da-value">{m.elo_p1?.toFixed(0) ?? "–"} vs {m.elo_p2?.toFixed(0) ?? "–"}</span>
          </div>
          {(m.elo_p1_overall != null || m.elo_p2_overall != null) && (
            <div className="da-row">
              <span className="da-label">{lang === "it" ? "Rating gen." : "Overall rating"}</span>
              <span className="da-value">{m.elo_p1_overall?.toFixed(0) ?? "–"} vs {m.elo_p2_overall?.toFixed(0) ?? "–"}</span>
            </div>
          )}
          {(m.surface_matches_p1 != null || m.surface_matches_p2 != null) && (
            <div className="da-row">
              <span className="da-label">{lang === "it" ? "Match sup." : "Surf. matches"}</span>
              <span className="da-value">{m.surface_matches_p1 ?? "–"} vs {m.surface_matches_p2 ?? "–"}</span>
            </div>
          )}
          {(m.elo_raw_p1 != null || m.elo_raw_p2 != null) && (
            <div className="da-row">
              <span className="da-label">{lang === "it" ? "Prob. modello" : "Model prob."}</span>
              <span className="da-value">{m.elo_raw_p1 != null ? `${Math.round(m.elo_raw_p1 * 100)}%` : "–"} vs {m.elo_raw_p2 != null ? `${Math.round(m.elo_raw_p2 * 100)}%` : "–"}</span>
            </div>
          )}
          {(m.h2h_p1_wins != null || m.h2h_p2_wins != null) && (
            <div className="da-row">
              <span className="da-label">H2H</span>
              <span className="da-value">{m.h2h_p1_wins ?? 0}–{m.h2h_p2_wins ?? 0}</span>
            </div>
          )}
        </div>
      )}

      {/* Deep Analysis locked teaser — Base users only (demoted into expansion) */}
      {!isPremium && (
        <div className="deep-analysis-locked">
          <span>⚡</span>
          <span>{lang === "it" ? "Analisi approfondita del modello disponibile con Signal Desk Pro (49.90 USDT/mese)" : "Deep model analysis available with Signal Desk Pro (49.90 USDT/month)"}</span>
        </div>
      )}
        </div>
        )}
      </div>
    </div></article>
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
// combinato e genera un link /?mb=id1,id2&ref=CODICE. Il visitatore che apre
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
  isUnlocked = false, isPremium = false, onUnlock,
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

  const copy = lang === "it" ? {
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
  } : {
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
  };

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
  const visibleItems = isPremium
    ? items
    : [...items].sort((a, b) => b.prob - a.prob).slice(0, 3);
  const selectedItems = visibleItems.filter((i) => selected.includes(i.id));
  const lockedSelected = selected.filter((id) => !items.some((i) => i.id === id) && lockedLabels.has(id));
  const combinedProb = selectedItems.reduce((acc, i) => acc * i.prob, 1);
  const isSharedView = sharedIds.length > 0 && !isLoggedIn;

  const toggle = (id: string) => {
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
    return `${base}/?${params.toString()}`;
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

  // Presentation-only grouping for scannability. Derived from the item id
  // prefix (f_/w_/t_) — same data, just clustered by sport family.
  const mbGroups: { key: string; head: string; glyph: string; amber: boolean; rows: MbItem[] }[] = [
    { key: "football", head: lang === "it" ? "Calcio" : "Football", glyph: "#g-ball", amber: false, rows: visibleItems.filter((i) => i.id.startsWith("f_")) },
    { key: "tennis", head: "Tennis", glyph: "#g-tball", amber: false, rows: visibleItems.filter((i) => i.id.startsWith("t_")) },
    { key: "worldcup", head: "World Cup", glyph: "#g-trophy", amber: true, rows: visibleItems.filter((i) => i.id.startsWith("w_")) },
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
          {lockedSelected.length > 0 && (
            <div className="mb-slip-list">
              {lockedSelected.map((id) => (
                <div key={id} className="mb-slip-item">
                  <span className="mb-slip-fixture">{lockedLabels.get(id)}</span>
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
              <div className="am-surface p-8 text-center text-xs font-mono text-[var(--am-muted-2)]">{copy.noSignals}</div>
            ) : (
              <div className="mb-select-scroll">
                {mbGroups.map((group) => (
                  <div key={group.key} className="mb-group">
                    <div className={`mb-group-head${group.amber ? " amber" : ""}`}>
                      <span className="mb-glyph"><svg aria-hidden="true"><use href={group.glyph} /></svg></span>
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
                            <span className="mb-row-glyph"><svg aria-hidden="true"><use href={group.glyph} /></svg></span>
                            <span className="mb-row-body">
                              <span className="mb-fixture">
                                {away != null ? (
                                  <>{home}<span className="mb-vs">vs</span>{away}</>
                                ) : item.label}
                              </span>
                              <span className="mb-pick"><span className="mb-pick-label">{lang === "it" ? "Pick" : "Pick"}: </span><strong>{item.market}</strong></span>
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
                  <p className="mb-cap-note">{lang === "it" ? "Massimo 5 selezioni — deseleziona per cambiarne una." : "Maximum 5 selections — deselect one to swap."}</p>
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

// ─── Partners Tab ─────────────────────────────────────────────────────────────

type PartnerType = "Casino & Sportsbook" | "Sportsbook" | "Exchange" | "Casino" | "Crypto Casino";
type PartnerStatus = "featured" | "active" | "coming_soon" | "in_discussion";

interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  description: string;
  description_en?: string; // EN override; falls back to `description` when absent
  url: string | null;
  since: string;
  logo_initials: string;
  logo_color: string;
  featured?: boolean;
  tags?: string[];
}

const PARTNERS: Partner[] = [
  {
    id: "partner-01",
    name: "Sportsbook Partner",
    type: "Casino & Sportsbook",
    status: "in_discussion",
    description: "Casino e piattaforma di scommesse sportive — partnership in fase di definizione. Integrazione con BetRedge per segnali e probabilità calibrate.",
    url: "mailto:info@agenticmarkets.com?subject=Partner%20Inquiry",
    since: "2026",
    logo_initials: "P1",
    logo_color: "from-amber-500 to-orange-600",
    featured: true,
    tags: ["Esclusivo", "Sport", "Casino", "Live"],
  },
  {
    id: "partner-stake",
    name: "Stake",
    type: "Casino & Sportsbook",
    status: "active",
    description: "Casino e sportsbook crypto. Collegamento diretto dalle pick via \"Piazza scommessa\".",
    description_en: "Crypto casino & sportsbook. Bet straight from the picks via \"Place bet\".",
    url: "https://stake.com",
    since: "2026",
    logo_initials: "ST",
    logo_color: "from-slate-600 to-slate-900",
    tags: ["Sport", "Casino", "Crypto"],
  },
  {
    id: "partner-roobet",
    name: "Roobet",
    type: "Casino & Sportsbook",
    status: "active",
    description: "Casino e sportsbook crypto. Collegamento diretto dalle pick via \"Piazza scommessa\".",
    description_en: "Crypto casino & sportsbook. Bet straight from the picks via \"Place bet\".",
    url: "https://roobet.com",
    since: "2026",
    logo_initials: "RB",
    logo_color: "from-yellow-400 to-amber-500",
    tags: ["Sport", "Casino", "Crypto"],
  },
];

const PARTNER_STATUS_COLORS: Record<PartnerStatus, string> = {
  featured:      "text-[var(--am-coral)] border-[var(--am-coral-b)] bg-[var(--am-coral-dim)]",
  active:        "text-[var(--am-coral)] border-[var(--am-coral-b)] bg-[var(--am-coral-dim)]",
  coming_soon:   "text-[var(--am-muted)] border-[var(--am-line-2)] bg-[var(--am-inset)]",
  in_discussion: "text-[var(--am-muted-2)] border-[var(--am-line)] bg-[var(--am-inset)]",
};

function PartnerCard({ p }: { p: Partner }) {
  const t = useT();
  const lang = useLang();
  const statusColor = PARTNER_STATUS_COLORS[p.status];
  const partnerName = p.id === "partner-01" ? t.partner_primary_name : p.name;
  const partnerDescription =
    p.id === "partner-01"
      ? t.partner_primary_desc
      : lang === "it" ? p.description : (p.description_en ?? p.description);
  const partnerTags = p.id === "partner-01" ? [t.partner_tag_exclusive, "Sport", "Casino", "Live"] : (p.tags ?? []);
  const statusLabel: Record<PartnerStatus, string> = {
    featured:      t.partners_exclusive_badge,
    active:        t.partners_status_active,
    coming_soon:   t.partners_status_coming,
    in_discussion: t.partners_status_negotiation,
  };
  return (
    <div className="am-surface p-5 space-y-4 flex flex-col" style={p.featured ? { borderColor: "var(--am-coral-b)" } : undefined}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.logo_color} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
          {p.logo_initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[var(--am-text)]">{partnerName}</span>
            {p.featured && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--am-coral-b)] text-[var(--am-coral)] bg-[var(--am-coral-dim)] font-mono uppercase tracking-wider">{t.partners_status_featured}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-mono text-[var(--am-muted-2)]">{p.type}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${statusColor}`}>{statusLabel[p.status]}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs font-mono text-[var(--am-muted)] leading-relaxed flex-1">{partnerDescription}</p>

      {/* Tags */}
      {partnerTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {partnerTags.map((tag) => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--am-inset)] border border-[var(--am-line)] text-[var(--am-muted-2)] font-mono">{tag}</span>
          ))}
        </div>
      )}

      {/* Affiliate disclosure — only for real outbound (non-mailto) links */}
      {p.url && !p.url.startsWith("mailto:") && (
        <p className="text-[9px] font-mono text-[var(--am-muted-2)] italic">
          {t.partners_affiliate_note}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--am-line)]">
        <span className="text-[10px] font-mono text-[var(--am-muted-2)]">{t.partners_since} {p.since}</span>
        {p.url ? (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("partner_click", { partner_id: p.id })}
            className="text-[10px] font-mono px-3 py-1 rounded border border-[var(--am-coral-b)] text-[var(--am-coral)] bg-[var(--am-coral-dim)] hover:bg-[var(--am-coral-dim)] transition-colors"
          >
            {t.partners_visit}
          </a>
        ) : (
          <span className="text-[10px] font-mono text-[var(--am-muted-2)] italic">{t.partners_link_soon}</span>
        )}
      </div>
    </div>
  );
}

const PARTNER_CATEGORIES = ["sportsbook", "casino", "exchange", "data_provider"] as const;
type PartnerCategory = typeof PARTNER_CATEGORIES[number];

function PartnersTab() {
  const t = useT();
  const lang = useLang();
  const featured = PARTNERS.filter((p) => p.featured);
  const others = PARTNERS.filter((p) => !p.featured);

  return (
    <div className="space-y-8 p-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="eyebrow">{t.partners_eyebrow}</p>
        <h2 className="text-xl font-bold text-[var(--am-text)]">{t.partners_title}</h2>
        <p className="text-xs font-mono text-[var(--am-muted-2)] max-w-lg">{t.partners_desc}</p>
        <p className="text-[10px] font-mono text-[var(--am-muted-2)] mt-1">
          {lang === "it"
            ? "I link partner sono relazioni commerciali affiliate. BetRedge riceve compenso per referral qualificati."
            : "Partner links are commercial affiliate relationships. BetRedge receives compensation for qualified referrals."}
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t.partners_active,      value: String(PARTNERS.filter((p) => ["featured", "active"].includes(p.status)).length), color: "text-[var(--am-coral)]" },
          { label: t.partners_negotiation, value: String(PARTNERS.filter((p) => p.status === "in_discussion").length), color: "text-[var(--am-muted)]" },
          { label: t.partners_coming,      value: String(PARTNERS.filter((p) => p.status === "coming_soon").length), color: "text-[var(--am-muted)]" },
        ].map((s) => (
          <div key={s.label} className="am-surface p-3 text-center">
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-mono text-[var(--am-muted-2)] uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <div className="space-y-3">
          <div className="text-[9px] font-mono text-[var(--am-coral)] uppercase tracking-widest">{t.partners_section_exclusive}</div>
          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {featured.map((p) => <PartnerCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {/* Others */}
      {others.length > 0 && (
        <div className="space-y-3">
          <div className="text-[9px] font-mono text-[var(--am-muted-2)] uppercase tracking-widest">{t.partners_section_network}</div>
          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {others.map((p) => <PartnerCard key={p.id} p={p} />)}
          </div>
        </div>
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
  const [systemWins, setSystemWins] = useState(0);
  const [systemHitRate, setSystemHitRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.leaderboard ?? []);
        setSystemWins(d.system_wins ?? 0);
        setSystemHitRate(d.system_hit_rate ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copy = lang === "it" ? {
    eyebrow: "Classifica pubblica",
    title: "Leaderboard Signal Desk",
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
  } : {
    eyebrow: "Public leaderboard",
    title: "Signal Desk Leaderboard",
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
  };

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

      {/* Stats strip */}
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

      {/* Hall of Fame */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">{lang === "it" ? "Hall of Fame" : "Hall of Fame"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="am-surface p-4 space-y-1">
              <div className="text-[10px] font-mono text-[var(--am-muted)] uppercase tracking-wider">
                {lang === "it" ? "🏆 Top hit rate" : "🏆 Top hit rate"}
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
                {lang === "it" ? "🔥 Più attivo" : "🔥 Most active"}
              </div>
              {(() => {
                const top = [...entries].sort((a, b) => b.bets_total - a.bets_total)[0];
                return top ? (
                  <>
                    <div className="text-sm font-bold text-[var(--am-text)] truncate">{top.name}</div>
                    <div className="text-lg font-black font-mono text-[var(--am-coral)]">{top.bets_total}</div>
                    <div className="text-[10px] font-mono text-[var(--am-muted-2)]">{lang === "it" ? "scommesse totali" : "total bets"}</div>
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
  const scopedWinRate = scopedDecided > 0 ? `${((scopedWon / scopedDecided) * 100).toFixed(1)}%` : null;

  return (
    <div className="am-history space-y-6">
      {/* Header — mockup .history .hh: title + subtitle + 2 KPIs from real stats */}
      <div className="hh">
        <div>
          <h2>{lang === "it" ? "Storico" : "History"}</h2>
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
                ? (lang === "it" ? "Tutti gli sport" : "All sports")
                : (<>
                    {s === "football"
                      ? <svg className="ic" aria-hidden="true"><use href="#g-ball" /></svg>
                      : s === "tennis"
                        ? <svg className="ic" aria-hidden="true"><use href="#g-tball" /></svg>
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
          <span>{lang === "it" ? "Competizione" : "Competition"}</span>
          <select value={effectiveCompetition} onChange={(e) => setCompetitionFilter(e.target.value)}>
            {["all", ...competitions].map((c) => {
              const n = countByCompetition(c);
              return (
                <option key={c} value={c}>
                  {c === "all"
                    ? `${lang === "it" ? "Tutte le competizioni" : "All competitions"} (${n})`
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
                <th className="r">{lang === "it" ? "Esito" : "Result"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const r = resultOf(h);
                const resClass = r === "won" || r === "lost" || r === "void" ? r : "pending";
                const resLabel =
                  r === "won" ? (lang === "it" ? "Vinta" : "Won")
                  : r === "lost" ? (lang === "it" ? "Persa" : "Lost")
                  : r === "void" ? "Void"
                  : (lang === "it" ? "Aperta" : "Pending");
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
  const faqItems = lang === "it" ? [
    ["Cosa vede un utente pubblico?", "Solo struttura del prodotto e storico passato. I segnali live restano bloccati."],
    ["Cosa sblocca il piano Free?", "Profilo, lingua e preview account senza prediction operative."],
    ["Cosa sblocca Signal Desk Pro?", "Tennis live, football research, Best Bets, Top Model Signals, spiegazioni modello e track record."],
    ["Gli agenti piazzano bet automaticamente?", "No nel go-live: il piano pubblico è research e signal desk. L'execution resta interna/non venduta."],
    ["Come pago?", "Solo crypto — USDT TRC20. Invia l'importo esatto all'indirizzo USDT indicato nel checkout."],
    ["Come viene attivato il piano?", "Dopo il TX hash il piano viene verificato internamente o attivato secondo la policy operativa configurata."],
  ] : [
    ["What can public users see?", "Only product structure and past history. Live signals stay locked."],
    ["What does Free unlock?", "Profile, language and account preview without operational predictions."],
    ["What does Signal Desk Pro unlock?", "Tennis live, football research, Best Bets, Top Model Signals, model explanations and track record."],
    ["Do agents place bets automatically?", "Not in the go-live: the public plan is research and signal desk. Execution remains internal/not sold."],
    ["How do I pay?", "Crypto only — USDT TRC20. Send the exact amount to the USDT address shown at checkout."],
    ["How is the plan activated?", "After the TX hash, the plan is internally reviewed or activated according to the configured operating policy."],
  ];
  return <FAQSupportSection items={faqItems} />;
}

// ─── Client Area Tab ──────────────────────────────────────────────────────────

function ClientAreaTab({
  profile,
  onOpenDesk,
  onPaymentSubmit,
  onActivateFree,
  onLogout,
}: {
  profile: ClientProfile | null;
  onOpenDesk: () => void;
  onPaymentSubmit: (plan: PublicPlanKey) => void;
  onActivateFree: () => void;
  onLogout: () => void;
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
  const statusCopy = lang === "it" ? {
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
  } : {
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
  };
  const paymentState = plan === "pending_payment"
    ? statusCopy.paymentReview
    : profileHasAccess(profile)
      ? statusCopy.paymentOk
      : plan === "free"
        ? statusCopy.paymentFree
        : statusCopy.paymentMissing;
  return (
    <div className="client-area-view">
      <section className="client-area-hero">
        <div>
          <p className="eyebrow">Client Area</p>
          <h3>{statusCopy.title}</h3>
          <span>{statusCopy.subtitle}</span>
        </div>
        <button onClick={onOpenDesk}>{statusCopy.openDesk}</button>
      </section>

      {profile ? (
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
            <article><span>{statusCopy.exchange}</span><strong>{profile.betfair?.status === "connected" ? statusCopy.connected : statusCopy.notConnected}</strong></article>
            <article><span>{statusCopy.timezone}</span><strong>{profile.timezone ?? "Europe/Rome"}</strong></article>
            <article><span>{statusCopy.notifications}</span><strong>{(["valueBets", "dailyReport", "paymentUpdates", "securityAlerts"] as const).filter(k => notifications[k]).length}/4</strong></article>
          </div>
          {profile.txHash && profile.txHash !== "test" && (
            <div className="client-account-note">
              <span>{t.pending_tx_label}</span>
              <code>{profile.txHash.length > 24 ? `${profile.txHash.slice(0, 12)}...${profile.txHash.slice(-8)}` : profile.txHash}</code>
            </div>
          )}
          {process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" && profileHasAccess(profile) && (
            <button className="btn-secondary" type="button" onClick={openBillingPortal}>
              {lang === "it" ? "Gestisci abbonamento" : "Manage subscription"}
            </button>
          )}
        </section>
      ) : (
        <section className="settings-empty">
          <p className="eyebrow">Client profile</p>
          <h3>{t.settings_empty_title}</h3>
          <button onClick={onActivateFree}>{t.settings_empty_btn}</button>
        </section>
      )}

      <PlansTab
        profile={profile}
        onOpenDesk={onOpenDesk}
        onPaymentSubmit={onPaymentSubmit}
        onActivateFree={onActivateFree}
      />
      {profile && (
        <div className="client-area-footer">
          <button className="btn-secondary" onClick={onLogout}>
            {statusCopy.logout}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Account Tab (unione Client Area + Impostazioni + Assistenza + FAQ) ─────────

function AccountTab({
  profile,
  onOpenDesk,
  onPaymentSubmit,
  onActivateFree,
  onLogout,
  onUnlock,
  onSave,
}: {
  profile: ClientProfile | null;
  onOpenDesk: () => void;
  onPaymentSubmit: (plan: PublicPlanKey) => void;
  onActivateFree: () => void;
  onLogout: () => void;
  onUnlock: () => void;
  onSave: (profile: ClientProfile) => void;
}) {
  const lang = useLang();
  const [section, setSection] = useState<AccountSection>("panoramica");
  const sections: { key: AccountSection; label: string }[] = [
    { key: "panoramica",   label: lang === "it" ? "Panoramica" : "Overview" },
    { key: "impostazioni", label: lang === "it" ? "Impostazioni" : "Settings" },
    { key: "assistenza",   label: lang === "it" ? "Assistenza" : "Assistance" },
    { key: "faq",          label: "FAQ" },
  ];
  return (
    <div className="account-tab">
      <div className="segmented-filter account-subnav">
        {sections.map((s) => (
          <button
            key={s.key}
            className={section === s.key ? "is-active" : ""}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "panoramica" && (
        <ClientAreaTab
          profile={profile}
          onOpenDesk={onOpenDesk}
          onPaymentSubmit={onPaymentSubmit}
          onActivateFree={onActivateFree}
          onLogout={onLogout}
        />
      )}
      {section === "impostazioni" && (
        <SettingsTab profile={profile} onUnlock={onUnlock} onSave={onSave} />
      )}
      {section === "assistenza" && <AssistanceTab />}
      {section === "faq" && <FAQTab />}
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
      <span className="t-lab"><span className="pulse" />{lang === "it" ? "In play" : "In play"}</span>
      <div className="scroll">
        {liveFootball.map(([id, s]) => (
          <span key={`f-${id}`} className="ti">
            <svg className="ig" aria-hidden="true"><use href="#g-ball" /></svg>
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
            <svg className="ig" aria-hidden="true"><use href="#g-tball" /></svg>
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
  let glyph: string;
  let fixtureName: React.ReactNode;
  let league: string;
  let probability: number;
  let pickName: string;
  let modelEdgePts: number;
  let why: string;
  const metrics: { dt: string; dd: React.ReactNode }[] = [];

  if (sport === "football" && topFootball) {
    const p = topFootball;
    const sel = bestFootballSelection(p);
    glyph = "#g-ball";
    fixtureName = (
      <>
        {p.home_team}
        <span className="vsmid"> {it ? "contro" : "vs"} </span>
        {p.away_team}
      </>
    );
    league = p.league_name;
    probability = selectedFootballProbability(p);
    pickName = sel?.name ?? p.home_team;
    // Model edge (margin of the pick over the 2nd-best outcome) — the uniform
    // metric used on every card; a real market edge stays in the Why prose.
    const fProbs = [p.p_home, p.p_draw, p.p_away].filter((v) => Number.isFinite(v)).sort((a, b) => b - a);
    modelEdgePts = fProbs.length >= 2 ? modelEdge(fProbs[0], fProbs[1]) : 0;
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
    glyph = "#g-racket";
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
    probability = selectedTennisProbability(m);
    pickName = m.best_selection === "P1" ? m.player1 : m.best_selection === "P2" ? m.player2 : (m.p1 >= m.p2 ? m.player1 : m.player2);
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
            <svg className="sgi" aria-hidden="true"><use href={glyph} /></svg>
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
          <svg className="sgi" aria-hidden="true"><use href={glyph} /></svg>
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
  tennisMatches,
  history,
  historyStats,
  historyLoading,
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
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  history: HistoryMatch[];
  historyStats: HistoryStats | null;
  historyLoading: boolean;
  onSelect: (s: SlipSelection) => void;
  onBetNow: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  onGate?: () => void;
  isSignalPreviewUnlocked: boolean;
  isFreeClient: boolean;
  isPremiumClient?: boolean;
  isLoggedIn: boolean;
  tennisIsPlaceholder?: boolean;
}) {
  const lang = useLang();
  // #HOUSE-PHOTO-3: dati reali per la versione RICCA del banner topbar (ticker top-edge + chip Edge medio).
  const topbarData = deskBannerData(predictions, tennisMatches);
  const visibleHistory = history
    .filter((h) => h.bet_status && h.bet_status !== "pending")
    .slice(0, 5);

  return (
    <>
      {!isLoggedIn && (
        <div className="flex items-center justify-between gap-3 mx-4 mt-3 mb-0 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-xs font-mono text-gray-300">
          <span>{lang === "it" ? "Registrati per salvare le selezioni, ricevere alert e sbloccare l'execution automatica." : "Register to save selections, get alerts and unlock auto-execution."}</span>
          <div className="flex gap-2 shrink-0">
            <button className="btn-secondary" style={{ fontSize: "11px", padding: "3px 10px" }} onClick={onSignIn}>{lang === "it" ? "Accedi" : "Sign In"}</button>
            <button className="btn-primary" style={{ fontSize: "11px", padding: "3px 10px" }} onClick={onRegister}>{lang === "it" ? "Registrati" : "Register"}</button>
          </div>
        </div>
      )}
      {/* Whole-board access wall: anonymous and free/pending see the board
          blurred behind a single login/plan overlay (the per-card `locked`
          projection already strips the picks server-side; this hides the
          matchups too). Leaderboard and the public Old-bets history stay
          outside the gate. Unlock = active plan (profileHasAccess). */}
      {/* #HOUSE-PHOTO-3: al posto del banner partner sportsbook, il banner Creator Picks
          (house, foto) sopra la board — visibile a tutti i pacchetti. */}
      {/* #HOUSE-PHOTO-3b: versione ricca (ticker edge%) SOLO per chi è sbloccato (base/premium);
          anon/free vedono la versione sobria — niente edge% esposti sopra il gate. */}
      {(() => { const c = pickCampaign("desk-topbar", "premium"); return c ? <div className="topbar-house"><HouseBanner campaign={c} lang={lang} data={isPremiumClient ? topbarData : undefined} /></div> : null; })()}
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
          tennisMatches={tennisMatches}
          onSelect={onSelect}
          onBetNow={onBetNow}
          onGate={onGate}
          isFreeClient={isFreeClient}
          isPremium={isPremiumClient}
          tennisIsPlaceholder={tennisIsPlaceholder}
        />
      </LockedGate>
      <PublicOldBetsPanel history={visibleHistory} stats={historyStats} loading={historyLoading} />
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

const VALID_TABS: readonly Tab[] = ["bets", "account", "history", "partners", "leaderboard", "match-builder"];

// BUG-008: shared/deep links sometimes use the singular ("partner"); map common
// aliases to the canonical tab instead of silently falling back to the board.
const TAB_ALIASES: Record<string, Tab> = { partner: "partners" };

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
  const [betLinksEnabled, setBetLinksEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/bet-links")
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => { if (alive) setBetLinksEnabled(Boolean(j.enabled)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const selectLanguage = (next: Lang) => {
    if (next === uiLanguage) return;
    setUiLanguage(next);
    localStorage.setItem("agentic-lang", next);
    trackEvent("language_change", { language: next });
  };
  // Theme toggle (Cobalt & Coral redesign, F1) — presentation only, no logic change.
  // The pre-paint script in layout.tsx already set data-theme; here we just sync React.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync with the pre-paint data-theme script: a lazy initializer would mismatch the server-rendered markup at hydration.
    if (current === "light" || current === "dark") setTheme(current);
  }, []);
  const toggleTheme = () => {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("agentic-theme", next); } catch {}
    trackEvent("theme_change", { meta: { theme: next } });
  };
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
        if (!window.localStorage.getItem("am_ref")) window.localStorage.setItem("am_ref", ref);
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
  const [founderOpen, setFounderOpen] = useState(false);
  const founderClickRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const [slipSelection, setSlipSelection] = useState<SlipSelection | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [tennisMatches, setTennisMatches] = useState<TennisMatch[]>([]);
  const [tennisIsPlaceholder, setTennisIsPlaceholder] = useState(false);
  const [tennisSummary, setTennisSummary] = useState<TennisSummary | null>(null);
  const [tennisComputedAt, setTennisComputedAt] = useState<string | null>(null);
  const [tennisBets, setTennisBets] = useState<TennisBet[]>([]);
  const [tennisBetSummary, setTennisBetSummary] = useState<TennisBetSummary | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryMatch[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyV2, setHistoryV2] = useState<V2HistoryRow[]>([]);
  const [historyV2Stats, setHistoryV2Stats] = useState<V2HistoryStats | null>(null);
  const [historyV2Loading, setHistoryV2Loading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(true);
  const [tennisLoading, setTennisLoading] = useState(true);
  const [predStale, setPredStale] = useState(false);
  const [predFallback, setPredFallback] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({});
  const [liveTennis, setLiveTennis] = useState<LiveTennisMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const [userTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome");
  useEffect(() => { trackEvent("page_view"); }, []);
  useEffect(() => {
    if (tab === "account") trackEvent("plan_view");
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

  // Proactive access prompt: anonymous visitors used to have to hunt for the
  // "Sign In / Register" buttons in the topbar. Once we've confirmed there is no
  // session, surface the auth modal automatically — once per browser session
  // (dismissible), never for logged-in users. Logging in clears `clientProfile`
  // dependency → cleanup cancels a still-pending prompt.
  useEffect(() => {
    if (!authChecked || clientProfile) return;
    try { if (window.sessionStorage.getItem("am-auth-prompted")) return; } catch { /**/ }
    const id = window.setTimeout(() => {
      try { window.sessionStorage.setItem("am-auth-prompted", "1"); } catch { /**/ }
      setAuthIntent("create");
      setAuthOpen(true);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [authChecked, clientProfile]);

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
    // Plans live in the Account tab (PlansTab). Switching tabs mounts the
    // target on the next render, so scroll after a double rAF (one for the
    // setState flush, one for the mounted DOM) instead of the same frame.
    setTab("account");
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

  const fetchAgents = useCallback(async () => {
    try {
      const resp = await fetch("/api/health");
      if (resp.ok) {
        const data = await resp.json();
        setAgents(data.agents ?? []);
      }
    } catch { /**/ }
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

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const resp = await fetch("/api/history");
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data.history ?? []);
        setHistoryStats(data.stats ?? null);
      }
    } catch { /**/ } finally { setHistoryLoading(false); }
  }, []);

  // Unified multi-sport track record for the History tab (the legacy
  // /api/history feed above stays only for PublicOldBetsPanel).
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
      await Promise.all([fetchPredictions(), fetchTennis(), fetchHistory(), fetchHistoryV2()]);
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
      void fetchPredictions();
      void fetchAgents();
      void fetchTennis();
      void fetchHistory();
      void fetchHistoryV2();
      void fetchLive();
      void fetchTennisLive();
    });
    const dataInt = setInterval(fetchData, 30_000);
    const predInt = setInterval(fetchPredictions, 3_600_000);
    const agentInt = setInterval(fetchAgents, 60_000);
    const tennisInt = setInterval(fetchTennis, 120_000);
    const liveInt = setInterval(fetchLive, 60_000);
    const tennisLiveInt = setInterval(fetchTennisLive, 60_000);
    return () => { clearInterval(dataInt); clearInterval(predInt); clearInterval(agentInt); clearInterval(tennisInt); clearInterval(liveInt); clearInterval(tennisLiveInt); };
  }, [fetchData, fetchPredictions, fetchAgents, fetchTennis, fetchHistory, fetchLive, fetchTennisLive]);

  // Pacchetto utente per i banner house (#HOUSE-PHOTO-1): anon|free|base|premium.
  const houseTier = audienceFromPlan(clientProfile?.plan);
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
  // #HOUSE-BANNERS-2: dati reali per top/bottom/rail (hit rate dallo storico v2).
  const houseData = deskBannerData(predictions, tennisMatches, { hitRate: historyV2Stats?.win_rate });
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
    { tab: "bets",        label: uiLanguage === "it" ? "Bets" : "Bets", value: isSignalPreviewUnlocked ? String(predictions.length + tennisMatches.length) : undefined, tone: "green" },
    { tab: "account",     label: uiLanguage === "it" ? "Account" : "Account", value: clientProfile ? (profileHasPremium(clientProfile) ? "PRO" : isClientUnlocked ? "BASE" : clientProfile.plan === "free" ? "FREE" : "SETUP") : "LOGIN" },
    { tab: "history",      label: tNav.nav_history },
    { tab: "leaderboard", label: uiLanguage === "it" ? "Classifica" : "Leaderboard" },
    // #MB-1: builder visibile solo da loggati (decisione Andrea 2026-06-07);
    // i link condivisi ?mb= aprono comunque il tab anche da anonimi.
    ...(hasClientProfile ? [{ tab: "match-builder" as Tab, label: "Match Builder", tone: "green" }] : []),
    { tab: "partners",    label: tNav.nav_partner },
  ];

  const tUI = TRANSLATIONS[uiLanguage];

  const liveTennisMap = useMemo(() => {
    const map: Record<string, LiveTennisMatch> = {};
    for (const lm of liveTennis) map[tennisPairKey(lm.player1, lm.player2)] = lm;
    return map;
  }, [liveTennis]);

  return (
    <LanguageCtx.Provider value={uiLanguage}>
    <TzCtx.Provider value={userTz}>
    <LiveCtx.Provider value={liveScores}>
    <LiveTennisCtx.Provider value={liveTennisMap}>
    <BetLinksCtx.Provider value={betLinksEnabled}>
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

      {/* ── Top banner ── (#HOUSE-BANNERS-1: house ad contestuale) */}
      {(() => {
        const camp = pickCampaign("desk-top", houseTier);
        return camp
          ? <div className="portal-top-banner"><HouseBanner campaign={camp} lang={uiLanguage} data={houseData} onCta={handleBannerCta} /></div>
          : <div className="portal-top-banner" style={{ visibility: "hidden", height: 0, overflow: "hidden", padding: 0 }} />;
      })()}

      {/* ── Topbar (sleek-coral redesign — logo + topnav + theme/account/lang) ── */}
      <header className="am-topbar">
        <div className="am-topbar-in">
          <Link href="/" className="am-brandmark" aria-label="BetRedge — home" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
            {/* logo: mira/target con cuneo coral = "probabilità di precisione" */}
            <svg className="am-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M5 21A11 11 0 0 1 27 21" stroke="var(--am-muted)" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M5 21A11 11 0 0 1 9.2 13.2" stroke="var(--am-coral)" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="16" y1="21" x2="23.5" y2="12.5" stroke="var(--am-coral)" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="16" cy="21" r="2.2" fill="var(--am-coral)" />
            </svg>
            <span className="am-wm">Bet<span className="r">R</span>edge<span className="chev">›</span></span>
          </Link>

          <nav className="am-topnav">
            {[
              { tab: "bets" as Tab, label: uiLanguage === "it" ? "Mercati" : "Markets" },
              { tab: "history" as Tab, label: tNav.nav_history },
              { tab: "leaderboard" as Tab, label: uiLanguage === "it" ? "Classifica" : "Leaderboard" },
              ...(hasClientProfile ? [{ tab: "match-builder" as Tab, label: "Match Builder" }] : []),
              { tab: "partners" as Tab, label: tNav.nav_partner },
            ].map((item) => (
              <button
                key={item.tab}
                className={tab === item.tab ? "active" : ""}
                onClick={() => { setTab(item.tab); trackEvent("tab_click", { meta: { tab: item.tab } }); }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="am-topright">
            {/* theme toggle segmentato DARK/LIGHT — riusa toggleTheme/theme esistenti */}
            <div className="am-tt" role="group" aria-label={uiLanguage === "it" ? "Tema" : "Theme"}>
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
              <button className="am-acct" onClick={() => setTab("account")}>
                {clientProfile.name}
                <span className="plan">{profileHasPremium(clientProfile) ? "PRO" : isClientUnlocked ? "BASE" : clientProfile.plan === "free" ? "FREE" : "SETUP"}</span>
              </button>
            ) : (
              <>
                <button className="am-auth-secondary" onClick={() => openAuth("login")}>
                  {uiLanguage === "it" ? "Accedi" : "Sign In"}
                </button>
                <button className="am-auth-primary" onClick={() => openAuth("create")}>
                  {uiLanguage === "it" ? "Registrati" : "Register"}
                </button>
              </>
            )}

            <LangDropdown value={uiLanguage} onSelect={selectLanguage} />
          </div>
        </div>
      </header>

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
                  <svg className="rail-ic" aria-hidden="true"><use href={RAIL_GLYPHS[item.tab] ?? "#g-desk"} /></svg>
                  <span className="rail-label">{item.label}</span>
                  {item.value && <strong className="n">{item.value}</strong>}
                </button>
              ))}
              {/* ── IN EVIDENZA group ── */}
              <span className="rail-sep" />
              <span className="rail-lab is-second">{uiLanguage === "it" ? "In evidenza" : "Featured"}</span>
              {/* Track B: World Cup hub is a route, not a tab */}
              <Link className="rail-item" href="/world-cup">
                <svg className="rail-ic" aria-hidden="true"><use href="#g-trophy" /></svg>
                <span className="rail-label">World Cup</span>
              </Link>
              {/* #MB-2: Creator Picks — schedine pubblicate dalla community */}
              <a className="rail-item" href="/community">
                <svg className="rail-ic" aria-hidden="true"><use href="#g-pick" /></svg>
                <span className="rail-label">Creator Picks</span>
              </a>
              <button className="rail-refresh" onClick={handleRefresh} disabled={refreshing}>
                ↻ {refreshing ? "..." : tUI.refresh_odds}
                <span className="sync">live</span>
              </button>
            </aside>

        <section className="book-main">
          <div className="book-main-head am-deskhead">
            <div className="am-deskhead-titles">
              <h2>{navItems.find((n) => n.tab === tab)?.label ?? "Bets"}</h2>
              <p className="am-sub">
                {uiLanguage === "it" ? (
                  <>Probabilità <b>calibrate da un modello</b> su calcio e tennis. Il modello ha <b>una</b> opinione, non opinioni da bar.</>
                ) : (
                  <>Probabilities <b>calibrated by a model</b> on football and tennis. The model holds <b>one</b> opinion, not bar-stool takes.</>
                )}
              </p>
            </div>
            <div className="am-statbar">
              <div className="am-kpi">
                <span className="v">{predictions.length + tennisMatches.length}</span>
                <span className="l">{uiLanguage === "it" ? "Eventi" : "Events"}</span>
              </div>
              <div className="am-kpi">
                <span className="v sig">{withEdgeCount}</span>
                <span className="l">{uiLanguage === "it" ? "Con edge" : "With edge"}</span>
              </div>
              {historyV2Stats?.win_rate && (
                <div className="am-kpi">
                  <span className="v">{historyV2Stats.win_rate}</span>
                  <span className="l">{uiLanguage === "it" ? "Hit · 100g" : "Hit · 100g"}</span>
                </div>
              )}
            </div>
          </div>

          {predFallback && tab === "bets" && (
            <div className="flex items-center gap-3 mx-4 mt-2 mb-0 px-3 py-2 rounded-lg border border-amber-400/30 bg-amber-400/5 text-xs font-mono text-amber-400">
              <span>⚽ {uiLanguage === "it" ? "Stagione in pausa — nessuna partita programmata nelle prossime 48h. Le prediction tornano automaticamente con la ripresa delle leghe (luglio 2026)." : "Season pause — no fixtures in the next 48h. Predictions return automatically when leagues resume (July 2026)."}</span>
            </div>
          )}
          {tab === "bets" && (
            <LiveNowStrip liveScores={liveScores} liveTennis={liveTennis} boardTennisKeys={new Set(tennisMatches.map((m) => tennisPairKey(m.player1, m.player2)))} lang={uiLanguage} />
          )}
          {tab === "bets" && (
            <UnifiedBetsTab
              predictions={predictions}
              tennisMatches={tennisMatches}
              history={history}
              historyStats={historyStats}
              historyLoading={historyLoading}
              onSelect={(s) => setSlipSelection(s)}
              // BUG-011: an anonymous "Place Bet" used to jump to the Partners
              // (affiliate) tab with no context. Prompt sign-in first; a
              // logged-in user keeps the affiliate route.
              onBetNow={() => hasClientProfile ? setTab("partners") : openAuth("login")}
              onSignIn={() => openAuth("login")}
              onRegister={() => openAuth("create")}
              onGate={handleProtectedUnlock}
              isSignalPreviewUnlocked={isSignalPreviewUnlocked}
              isFreeClient={isFreeClient}
              isPremiumClient={isClientUnlocked}
              isLoggedIn={hasClientProfile}
              tennisIsPlaceholder={tennisIsPlaceholder}
            />
          )}
          {tab === "account" && (
            <AccountTab
              profile={clientProfile}
              onOpenDesk={() => setTab("bets")}
              onPaymentSubmit={submitCryptoPayment}
              onActivateFree={activateFreePlan}
              onLogout={logoutClientProfile}
              onUnlock={() => openAuth("login")}
              onSave={handleSettingsSave}
            />
          )}
          {tab === "history" && (
            <TrackRecordView rows={historyV2} lang={uiLanguage === "it" ? "it" : "en"} />
          )}
          {tab === "leaderboard" && (
            <LeaderboardTab
              clientName={clientProfile?.name}
              isOptedIn={clientProfile?.leaderboardOptIn ?? false}
            />
          )}
          {tab === "partners" && <PartnersTab />}
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
            />
          )}
        </section>
        </section>{/* end book-layout */}
        </div>{/* end portal-desk */}

      </div>{/* end portal-columns */}

      {/* ── Bottom banner ── (#HOUSE-BANNERS-1: house billboard contestuale) */}
      {(() => {
        const camp = pickCampaign("desk-bottom", houseTier);
        return camp
          ? <div className="portal-bottom-banner"><HouseBanner campaign={camp} lang={uiLanguage} data={houseData} onCta={handleBannerCta} /></div>
          : <div className="portal-bottom-banner" style={{ visibility: "hidden", height: 0, overflow: "hidden", padding: 0 }} />;
      })()}


      <footer className="text-center text-xs text-gray-500 pb-8 font-mono space-y-2" style={{padding: "16px 24px"}}>
        <div>{tUI.footer_note}</div>
        <div className="flex items-center justify-center gap-4 flex-wrap text-[10px] text-gray-600">
          <span className="border border-gray-600 rounded px-1.5 py-0.5 font-bold">18+</span>
          <span>{uiLanguage === "it" ? "Le performance passate non garantiscono risultati futuri." : "Past performance does not guarantee future results."}</span>
          <span>|</span>
          <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">GamCare</a>
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">BeGambleAware</a>
          <span>|</span>
          <span>{uiLanguage === "it" ? "I link partner sono affiliati commerciali." : "Partner links are commercial affiliates."}</span>
          <span>|</span>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">{uiLanguage === "it" ? "Privacy Policy" : "Privacy Policy"}</a>
        </div>
        <button
          type="button"
          onClick={handleFounderTrigger}
          style={{ background: "none", border: "none", color: "transparent", cursor: "default", userSelect: "none", marginLeft: 8, width: 10, height: 10 }}
          aria-hidden="true"
        >·</button>
      </footer>
      {authOpen && (
        <ClientAuthModal
          intent={authIntent}
          onClose={() => setAuthOpen(false)}
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
    </main>
    </BetLinksCtx.Provider>
    </LiveTennisCtx.Provider>
    </LiveCtx.Provider>
    </TzCtx.Provider>
    </LanguageCtx.Provider>
  );
}
