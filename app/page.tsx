"use client";

import { useEffect, useState, useCallback, useRef, createContext, useContext } from "react";
import {
  PUBLIC_PAID_PLAN,
  type PublicPlanKey,
  planAmountUsdt,
  planPriceCopy as publicPlanPriceCopy,
} from "@/lib/commercial-plan";
import { buildBestBetRows, type BestBetCandidate } from "@/lib/best-bets";

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
    plans_base_f5: "Storico, track record e paper monitoring",
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
    pred_why_title: "Perché questa previsione",
    // Tennis card
    tennis_why_show: "▼ perché", tennis_why_hide: "▲ meno",
    tennis_ai_label: "Analisi AI",
    tennis_elo_label: "Analisi Elo Surface",
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
    loading_predictions: "Calcolo Dixon-Coles + Pi Rating + xG in corso…",
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
    page_sports: "Sports predictions", page_tennis: "Tennis · Elo Surface v2", page_bets: "Execution log",
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
    pred_model_badge: "Dixon-Coles · Pi Rating · xG · Form · prossimi 30 giorni",
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
    pred_no_edge: "no edge",
    // Tennis tab
    tennis_badge: "Tennis AI v2.0 · ATP + WTA · Signal Layer",
    tennis_computed: "calcolato", tennis_matches_loaded: "partite caricate",
    tennis_kpi_today: "Partite Oggi", tennis_kpi_value: "Value Bets", tennis_kpi_markets: "Mercati Attivi",
    tennis_surface_label: "Superficie",
    tennis_loading: "Caricamento previsioni tennis…", tennis_no_matches: "Nessuna partita disponibile",
    tennis_no_edge: "no edge",
    // Partners tab
    partners_eyebrow: "Rete commerciale", partners_title: "Casino & Scommesse Partner",
    partners_desc: "Piattaforme di gioco e scommesse con cui Agentic Markets collabora — integrazione segnali, edge e strumenti AI per gli operatori del settore.",
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
    tennis_elo_data: "Dati Elo",
    tennis_pipeline_title: "Tennis Pipeline · 6 Agenti",
    tennis_last_seen: "Ultimo heartbeat",
    tennis_no_heartbeat: "Nessun heartbeat ancora",
    tennis_footer: "Tennis AI v2.0 · Elo Surface v2 · 2.966 giocatori · settlement loop live · paper mode",
    agent_arch_title: "Architettura ibrida v5.0",
    agent_arch_dashboard_title: "Dashboard (Vercel)",
    agent_arch_dashboard_desc: "Dixon-Coles · Pi Rating · xG · API-Football · Odds. Sempre online, non dipende dagli agenti Python.",
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
    plans_base_f5: "History, track record and paper monitoring",
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
    pred_why_title: "Why this prediction",
    // Tennis card
    tennis_why_show: "▼ why", tennis_why_hide: "▲ less",
    tennis_ai_label: "AI Analysis",
    tennis_elo_label: "Elo Surface Analysis",
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
    loading_predictions: "Computing Dixon-Coles + Pi Rating + xG predictions…",
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
    page_sports: "Sports predictions", page_tennis: "Tennis · Elo Surface v2", page_bets: "Execution log",
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
    pred_model_badge: "Dixon-Coles · Pi Rating · xG · Form · next 30 days",
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
    pred_no_edge: "no edge",
    // Tennis tab
    tennis_badge: "Tennis AI v2.0 · ATP + WTA · Signal Layer",
    tennis_computed: "computed", tennis_matches_loaded: "matches loaded",
    tennis_kpi_today: "Matches Today", tennis_kpi_value: "Value Bets", tennis_kpi_markets: "Active Markets",
    tennis_surface_label: "Surface",
    tennis_loading: "Loading tennis predictions…", tennis_no_matches: "No matches available",
    tennis_no_edge: "no edge",
    // Partners tab
    partners_eyebrow: "Commercial network", partners_title: "Casino & Sportsbook Partners",
    partners_desc: "Gaming and betting platforms Agentic Markets collaborates with — signal integration, edge and AI tools for operators.",
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
    tennis_elo_data: "Elo data",
    tennis_pipeline_title: "Tennis Pipeline · 6 Agents",
    tennis_last_seen: "Last seen",
    tennis_no_heartbeat: "No heartbeat yet",
    tennis_footer: "Tennis AI v2.0 · Elo Surface v2 · 2,966 players · settlement loop live · paper mode",
    agent_arch_title: "Hybrid architecture v5.0",
    agent_arch_dashboard_title: "Dashboard (Vercel)",
    agent_arch_dashboard_desc: "Dixon-Coles · Pi Rating · xG · API-Football · Odds. Always online, independent from local Python agents.",
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
    nav_dashboard: "Panel", nav_bestbets: "Mejores apuestas", nav_sports: "Deportes", nav_bets: "Apuestas",
    header_login: "Login / Crear perfil",
    preaccess_login: "Login", preaccess_create: "Crear perfil",
    auth_create_title: "Crea tu perfil Signal Desk", auth_create_sub: "Crea el perfil y elige un plan para desbloquear los datos.",
    auth_name_label: "Nombre", auth_name_placeholder: "Tu nombre", auth_create_btn: "Continuar a planes",
    plans_eyebrow: "Planes cliente", plans_title: "Tres niveles, una sola experiencia",
    page_overview: "Panel cliente", page_bestbets: "Mejores apuestas", page_sports: "Predicciones deportivas", page_bets: "Registro de ejecución",
    locked_eyebrow: "Signal Desk bloqueado", locked_title: "Inicia sesión para ver predicciones, edge y explicaciones",
    locked_desc: "Los datos sensibles permanecen ocultos hasta que inicies sesión y actives un plan.", locked_btn: "Login / Crear perfil",
    locked_plan_eyebrow: "Upgrade requerido", locked_plan_title: "Actualiza tu paquete para desbloquear esta función",
    locked_plan_desc: "Tu perfil está activo. Esta vista requiere un nivel superior.", locked_plan_btn: "Ver planes",
    gate_eyebrow: "Plan Premium", gate_bets_title: "Registro de ejecución", gate_bets_desc: "Las apuestas automáticas y el registro de ejecución están disponibles solo con Premium.",
    gate_upgrade_btn: "Pasar a Premium",
    topbar_private: "desk privado", topbar_scanning: "analizando", topbar_plans: "planes activos", topbar_syncing: "sincronizando",
    refresh_odds: "ACTUALIZAR ODDS", rail_exec_note: "Ejecución live solo con bet ID confirmado. Tennis en capa de señal.",
    language_it: "Italiano", language_en: "Inglés", language_es: "Español", language_fr: "Francés", language_ru: "Ruso",
    footer_note: "Sportsbook Edge Desk · ejecución verificada · interfaz cliente",
    rg_footer: "18+. Juega con responsabilidad. El contenido es informativo; cuotas y bonos son ofertas de socios afiliados.",
  },
  fr: {
    ...BASE_TRANSLATIONS.en,
    nav_dashboard: "Tableau", nav_bestbets: "Meilleurs bets", nav_sports: "Sports", nav_bets: "Paris",
    header_login: "Connexion / Créer profil",
    preaccess_login: "Connexion", preaccess_create: "Créer profil",
    auth_create_title: "Crée ton profil Signal Desk", auth_create_sub: "Crée ton profil puis choisis un plan pour débloquer les données.",
    auth_name_label: "Nom", auth_name_placeholder: "Ton nom", auth_create_btn: "Continuer vers les plans",
    plans_eyebrow: "Plans client", plans_title: "Trois niveaux, une seule expérience",
    page_overview: "Tableau client", page_bestbets: "Meilleurs bets", page_sports: "Prédictions sportives", page_bets: "Journal d'exécution",
    locked_eyebrow: "Signal Desk verrouillé", locked_title: "Connecte-toi pour voir predictions, edge et explications",
    locked_desc: "Les données sensibles restent masquées jusqu'à connexion et activation du plan.", locked_btn: "Connexion / Créer profil",
    locked_plan_eyebrow: "Upgrade requis", locked_plan_title: "Passe à un niveau supérieur pour débloquer cette vue",
    locked_plan_desc: "Ton profil est actif. Cette section demande un niveau supérieur.", locked_plan_btn: "Voir les plans",
    gate_eyebrow: "Plan Premium", gate_bets_title: "Journal d'exécution", gate_bets_desc: "Les agents automatiques et le journal d'exécution sont disponibles uniquement avec Premium.",
    gate_upgrade_btn: "Passer à Premium",
    topbar_private: "desk privé", topbar_scanning: "analyse", topbar_plans: "plans actifs", topbar_syncing: "sync",
    refresh_odds: "RAFRAICHIR ODDS", rail_exec_note: "Exécution live seulement avec bet ID confirmé. Tennis en couche signal.",
    language_it: "Italien", language_en: "Anglais", language_es: "Espagnol", language_fr: "Français", language_ru: "Russe",
    footer_note: "Sportsbook Edge Desk · exécution vérifiée · interface client",
    rg_footer: "18+. Jouez de façon responsable. Le contenu est informatif; les cotes et bonus sont des offres de partenaires affiliés.",
  },
  ru: {
    ...BASE_TRANSLATIONS.en,
    nav_dashboard: "Панель", nav_bestbets: "Лучшие ставки", nav_sports: "Спорт", nav_bets: "Ставки",
    header_login: "Войти / Создать профиль",
    preaccess_login: "Войти", preaccess_create: "Создать профиль",
    auth_create_title: "Создай профиль Signal Desk", auth_create_sub: "Создай профиль и выбери план, чтобы открыть данные.",
    auth_name_label: "Имя", auth_name_placeholder: "Твое имя", auth_create_btn: "Перейти к планам",
    plans_eyebrow: "Планы клиента", plans_title: "Три уровня, один опыт",
    page_overview: "Панель клиента", page_bestbets: "Лучшие ставки", page_sports: "Спортивные прогнозы", page_bets: "Журнал исполнения",
    locked_eyebrow: "Signal Desk заблокирован", locked_title: "Войди, чтобы увидеть прогнозы, edge и объяснения",
    locked_desc: "Чувствительные данные скрыты до входа и активации плана.", locked_btn: "Войти / Создать профиль",
    locked_plan_eyebrow: "Нужен апгрейд", locked_plan_title: "Обнови пакет, чтобы открыть этот раздел",
    locked_plan_desc: "Профиль активен. Этот раздел требует более высокого уровня.", locked_plan_btn: "Смотреть планы",
    gate_eyebrow: "Premium план", gate_bets_title: "Журнал исполнения", gate_bets_desc: "Автоматические агенты и журнал исполнения доступны только в Premium.",
    gate_upgrade_btn: "Перейти на Premium",
    topbar_private: "приватный desk", topbar_scanning: "анализ", topbar_plans: "планы активны", topbar_syncing: "синхронизация",
    refresh_odds: "ОБНОВИТЬ ODDS", rail_exec_note: "Live execution только с подтвержденным bet ID. Tennis в signal layer.",
    language_it: "Итальянский", language_en: "Английский", language_es: "Испанский", language_fr: "Французский", language_ru: "Русский",
    footer_note: "Sportsbook Edge Desk · проверенное исполнение · клиентский интерфейс",
    rg_footer: "18+. Играй ответственно. Контент носит информационный характер; котировки и бонусы — предложения партнёров.",
  },
} as const;

const TRANSLATIONS = {
  ...BASE_TRANSLATIONS,
  ...EXTRA_TRANSLATIONS,
} as const;

type Lang = keyof typeof TRANSLATIONS;
const LANGUAGES: Lang[] = ["it", "en"];
const TOPBAR_SUBTITLE: Record<Lang, string> = {
  it: "Un’unica console per segnali, analisi predittiva e live execution.",
  en: "One console for signals, predictive analytics and live execution.",
  es: "Una consola unica para señales, analisis predictivo y ejecucion live.",
  fr: "Une console unique pour signaux, analyse predictive et execution live.",
  ru: "Единая консоль для сигналов, предиктивной аналитики и live execution.",
};

const LanguageCtx = createContext<Lang>("it");
function useLang() { return useContext(LanguageCtx); }

const TzCtx = createContext("Europe/Rome");
const useTz = () => useContext(TzCtx);

interface LiveScore { home_score: number | null; away_score: number | null; match_status: string; minute: number | null; }
const LiveCtx = createContext<Record<string, LiveScore>>({});
const useLive = () => useContext(LiveCtx);
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


interface PredictionEnrichment {
  pi_home?: number;
  pi_away?: number;
  xg_home?: number;
  xga_home?: number;
  xg_away?: number;
  xga_away?: number;
  npxg_home?: number;
  npxg_away?: number;
  form_home?: string;
  form_away?: string;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAGUE_FLAGS: Record<string, string> = {
  PL: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", SA: "🇮🇹", PD: "🇪🇸", BL1: "🇩🇪", FL1: "🇫🇷", CL: "⭐", EL: "🟠",
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

type Tab = "bets" | "client-area" | "settings" | "assistance" | "faq" | "history" | "partners" | "leaderboard";

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

function fmtKickoff(utc: string, lang: Lang = "it", tz = "Europe/Rome") {
  const d = new Date(utc);
  const locale = lang === "en" ? "en-GB" : "it-IT";
  // Hide time when midnight UTC — kickoff not yet confirmed by any source
  const timeUnknown = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
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

function ProbBar({ label, pct: p, color, odds, isValue }: {
  label: string; pct: number; color: string; odds?: number | null; isValue?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono w-10 shrink-0 ${color}`}>{label}</span>
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color.replace("text-", "bg-")}`}
          style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${color}`}>{pct(p)}</span>
      {isValue && (
        <span className="text-xs px-1.5 py-0.5 rounded border border-green-400/40 text-green-400 bg-green-400/10 font-mono">
          VALUE
        </span>
      )}
    </div>
  );
}

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

function isFootballBestBet(p: Prediction) {
  const odds = selectedFootballOdds(p);
  return isFutureMarket(p.kickoff)
    && Boolean(p.best_selection)
    && odds != null
    && odds >= MIN_BEST_BET_ODDS
    && (p.edge ?? 0) >= FOOTBALL_BEST_EDGE_THRESHOLD;
}

function isTennisBestBet(m: TennisMatch) {
  const odds = selectedTennisOdds(m);
  return isTennisMarketVisible(m.scheduled)
    && Boolean(m.best_selection)
    && odds != null
    && odds >= MIN_BEST_BET_ODDS
    && (m.edge ?? 0) >= TENNIS_BEST_EDGE_THRESHOLD;
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
  const query = searchTerm.trim().toLowerCase();

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
    if (sortMode === "time") return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
    if (sortMode === "odds") return (selectedFootballOdds(b) ?? 0) - (selectedFootballOdds(a) ?? 0);
    if (sortMode === "probability") return selectedFootballProbability(b) - selectedFootballProbability(a);
    return (b.edge ?? -1) - (a.edge ?? -1);
  });

  const sortTennis = (rows: TennisMatch[]) => rows.sort((a, b) => {
    if (sortMode === "time") return new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime();
    if (sortMode === "odds") return (selectedTennisOdds(b) ?? 0) - (selectedTennisOdds(a) ?? 0);
    if (sortMode === "probability") return selectedTennisProbability(b) - selectedTennisProbability(a);
    return (b.edge ?? -1) - (a.edge ?? -1);
  });

  const footballRows = sortFootball(predictions
    .filter((p) => sportFilter !== "tennis")
    .filter(() => surfaceFilter === "all")
    .filter((p) => isFutureMarket(p.kickoff))
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

      <div className="sports-filter-bar">
        <div className="segmented-filter" aria-label="Sport filter">
          {[
            ["all", labels.allSports],
            ["football", labels.football],
            ["tennis", labels.tennis],
          ].map(([key, label]) => (
            <button
              key={key}
              className={sportFilter === key ? "is-active" : ""}
              onClick={() => setSportFilter(key as "all" | "football" | "tennis")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="segmented-filter" aria-label="Signal filter">
          <button className={signalFilter === "all" ? "is-active" : ""} onClick={() => setSignalFilter("all")}>{labels.allSignals}</button>
          <button className={signalFilter === "value" ? "is-active" : ""} onClick={() => setSignalFilter("value")}>{labels.valueOnly}</button>
        </div>

        <label>
          <span>{labels.competition}</span>
          <select value={competitionFilter} onChange={(e) => setCompetitionFilter(e.target.value)}>
            <option value="all">{labels.allCompetitions}</option>
            {competitionOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>{labels.surface}</span>
          <select value={surfaceFilter} onChange={(e) => setSurfaceFilter(e.target.value as "all" | TennisMatch["surface"])} disabled={sportFilter === "football"}>
            <option value="all">{labels.allSurfaces}</option>
            {surfaceOptions.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
          </select>
        </label>

        <label>
          <span>{labels.sort}</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "edge" | "time" | "odds" | "probability")}>
            <option value="edge">{labels.edge}</option>
            <option value="time">{labels.time}</option>
            <option value="odds">{labels.odds}</option>
            <option value="probability">{labels.probability}</option>
          </select>
        </label>

        <input
          className="sports-search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={labels.search}
        />
      </div>

      {filteredTotal === 0 ? (
        <div className="book-empty">{labels.noResults}</div>
      ) : (
        <>
          {isFreeClient && (
            <div className="free-tier-banner">
              <strong>{lang === "it" ? "Piano Free — 1 prediction per sport" : "Free Plan — 1 prediction per sport"}</strong>
              <span>{lang === "it"
                ? "Vedi 1 anteprima per sport. Sblocca prediction, edge% e analisi con Signal Desk Pro (49.50 USDT/mese)."
                : "You see 1 preview per sport. Unlock predictions, edge% and analysis with Signal Desk Pro (49.50 USDT/month)."
              }</span>
            </div>
          )}

          {showFootballSection && (
            <section className="market-section">
              <div className="market-section-title">
                <span>{t.board_football}</span>
                <em>{footballRows.length} {t.board_markets} · {footballValue.length} {t.board_value}</em>
              </div>
              {footballRows.length ? (
                <div className="market-list">
                  {(isFreeClient ? footballRows.slice(0, 1) : footballRows).map((p) => (
                    <PredictionCard key={p.match_id} p={p} onSelect={onSelect} onBetNow={onBetNow} onGate={onGate} isPreview={isFreeClient} isPremium={isPremium} />
                  ))}
                  {isFreeClient && footballRows.length > 1 && (
                    <div className="free-preview-wall">
                      <div className="fpw-lock">🔒</div>
                      <div className="fpw-count">+{footballRows.length - 1} {lang === "it" ? "prediction bloccate" : "predictions locked"}</div>
                      <div className="fpw-sub">{lang === "it" ? "Sblocca tutto con Signal Desk Pro (49.50 USDT/mese)" : "Unlock all with Signal Desk Pro (49.50 USDT/month)"}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="book-empty">{t.board_football_empty}</div>
              )}
            </section>
          )}

          {showTennisSection && (
            <section className="market-section">
              <div className="market-section-title amber">
                <span>{t.board_tennis}</span>
                <em>{tennisRows.length} {t.board_matches} · {tennisValue.length} {t.board_value}</em>
              </div>
              {tennisRows.length ? (
                <div className="market-list">
                  {(isFreeClient ? tennisRows.slice(0, 1) : tennisRows).map((m) => (
                    <TennisMatchCard key={m.id} m={m} onSelect={onSelect} onBetNow={onBetNow} onGate={onGate} isPreview={isFreeClient} isPremium={isPremium} />
                  ))}
                  {isFreeClient && tennisRows.length > 1 && (
                    <div className="free-preview-wall">
                      <div className="fpw-lock">🔒</div>
                      <div className="fpw-count">+{tennisRows.length - 1} {lang === "it" ? "match bloccati" : "matches locked"}</div>
                      <div className="fpw-sub">{lang === "it" ? "Sblocca tutto con Signal Desk Pro (49.50 USDT/mese)" : "Unlock all with Signal Desk Pro (49.50 USDT/month)"}</div>
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
    noEdge: "nessun edge mercato",
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
    noEdge: "no market edge",
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
  }));
  const tennisCandidates: BestBetCandidate[] = tennisMatches.map((m) => ({
    kind: "tennis",
    id: m.id,
    startsAt: m.scheduled,
    label: `${m.player1} ${m.player2} ${m.tournament} ${m.surface}`,
    probability: selectedTennisProbability(m),
    odds: selectedTennisOdds(m),
    edge: m.edge,
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
  const modeLabel = bestRows.mode === "value" ? labels.valueMode : bestRows.mode === "model_signal" ? labels.modelMode : "+EV";

  return (
    <div className="sportsbook-board best-bets-board">
      <div className="board-subhead">
        <span>{labels.showing} {totalValue} {modeLabel}</span>
        <span>Football {visibleFootballValue.length}</span>
        <span>Tennis {visibleTennisValue.length}</span>
      </div>

      <div className="sports-filter-bar best-bets-filter-bar">
        <div className="segmented-filter" aria-label="Best bets sport filter">
          {[
            ["all", labels.all],
            ["football", labels.football],
            ["tennis", labels.tennis],
          ].map(([key, label]) => (
            <button
              key={key}
              className={sportFilter === key ? "is-active" : ""}
              onClick={() => setSportFilter(key as "all" | "football" | "tennis")}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          <span>{labels.sort}</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "probability" | "edge" | "time")}>
            <option value="probability">{labels.probability}</option>
            <option value="edge">{labels.edge}</option>
            <option value="time">{labels.time}</option>
          </select>
        </label>
        <input
          className="sports-search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={labels.search}
        />
      </div>

      {totalValue ? (
        <>
          {visibleFootballValue.length > 0 && (
            <section className="market-section">
              <div className="market-section-title">
                <span>{t.board_football}</span>
                <em>{visibleFootballValue.length} {bestRows.mode === "model_signal" ? labels.noEdge : t.board_value}</em>
              </div>
              <div className="market-list">
                {visibleFootballValue.map((p) => <PredictionCard key={p.match_id} p={p} onSelect={onSelect} onBetNow={onBetNow} isPreview={isFreeClient} isPremium={isPremium} />)}
              </div>
            </section>
          )}

          {visibleTennisValue.length > 0 && (
            <section className="market-section">
              <div className="market-section-title amber">
                <span>{t.board_tennis}</span>
                <em>{visibleTennisValue.length} {bestRows.mode === "model_signal" ? labels.noEdge : t.board_value}</em>
              </div>
              <div className="market-list">
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
          <p className="eyebrow">Agentic Markets</p>
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
        <div><span>Tennis</span><em>Elo Surface V4</em><strong>Pro</strong></div>
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
      <div className="public-history-stats">
        <div><span>{lang === "it" ? "Partite" : "Matches"}</span><strong>{stats?.total_matches ?? "..."}</strong></div>
        <div><span>{lang === "it" ? "Bets" : "Bets"}</span><strong>{stats?.bets_placed ?? "..."}</strong></div>
        <div><span>{lang === "it" ? "Hit Rate" : "Hit Rate"}</span><strong>{stats ? `${stats.accuracy}%` : "..."}</strong></div>
      </div>
      <div className="public-old-bets">
        {loading ? (
          <div className="book-empty">{lang === "it" ? "Caricamento storico..." : "Loading history..."}</div>
        ) : history.length ? history.map((row, index) => (
          <div key={`${row.match_id}-${row.bet_selection ?? row.best_selection ?? index}`}>
            <span>{LEAGUE_FLAGS[row.league] ?? "FB"} {row.league}</span>
            <strong>{row.home_team} vs {row.away_team}</strong>
            <em>{row.bet_selection ?? row.best_selection ?? "signal"} · {row.bet_status}</em>
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
          ? "Nota rischio: Agentic Markets mostra analisi probabilistiche. Non garantisce profitti e non sostituisce gestione del rischio personale."
          : "Risk note: Agentic Markets shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management."}
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
  const isCurrentPlan = profileHasAccess(profile);
  return (
    <div className="crypto-pay-box">
      <div>
        <span>USDT TRC20</span>
        <strong>{planPriceCopy(plan, lang)}</strong>
        {!profile && <em>{t.crypto_profile_required}</em>}
      </div>
      <button disabled={!profile || isCurrentPlan} onClick={() => onSubmit(plan)}>
        {isCurrentPlan
          ? (lang === "it" ? "Piano attuale" : "Current plan")
          : profile
            ? `${t.crypto_activate} ${PUBLIC_PAID_PLAN.label[lang === "it" ? "it" : "en"]}`
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
  onConfirm: (txHash: string) => void;
  onClose: () => void;
}) {
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const price = planAmountUsdt(plan);
  const t = useT();
  const lang = useLang();

  const handleCopy = () => {
    navigator.clipboard.writeText(USDT_TRC20_ADDRESS).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-head">
          <p className="eyebrow">Checkout · USDT TRC20</p>
          <h3>{PUBLIC_PAID_PLAN.label[lang === "it" ? "it" : "en"]}</h3>
          <span>
            {lang === "it" ? <>Invia esattamente <strong style={{ color: "var(--green)" }}>{price.toFixed(2)} USDT</strong> all&apos;indirizzo qui sotto. Il piano passerà in verifica.</> : <>Send exactly <strong style={{ color: "var(--green)" }}>{price.toFixed(2)} USDT</strong> to the address below. The plan will move to review.</>}
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
        <p style={{ fontSize: "11px", fontFamily: "monospace", color: "#94a3b8", lineHeight: 1.5, margin: "4px 0 0" }}>
          {t.checkout_sla}{" "}
          <a href="mailto:info@agenticmarkets.com?subject=Pagamento%20-%20attivazione" style={{ color: "#67e8f9", textDecoration: "underline" }}>
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
          disabled={txHash.length < 10}
          onClick={() => onConfirm(txHash)}
          style={{ marginTop: 4 }}
        >
          {t.checkout_confirm} · {price.toFixed(2)} USDT
        </button>

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
    <div className="plans-view">
      <section className="plans-hero">
        <div>
          <p className="eyebrow">{t.plans_eyebrow}</p>
          <h3>{t.plans_title}</h3>
          <span>{t.plans_subtitle}</span>
        </div>
        <button onClick={onOpenDesk}>{t.plans_cta}</button>
      </section>

      <section className="plans-grid">
        <article className="plan-card">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">Free</p>
              <h4>Public Preview</h4>
            </div>
            <span>Profile</span>
          </div>
          <p className="plan-description">
            {lang === "it"
              ? "Per creare il profilo, scegliere lingua e vedere solo preview, storico pubblico e struttura del prodotto."
              : "Create your profile, choose language and see only previews, public history and product structure."}
          </p>
          <div className="price-line">
            <strong>€0</strong>
            <span>{lang === "it" ? "Nessun segnale operativo" : "No operational signals"}</span>
          </div>
          <div className="plan-core-line">
            <strong>{lang === "it" ? "Guardi, non operi" : "Watch, no trading"}</strong>
            <em>{lang === "it" ? "Prediction live, edge e spiegazioni restano bloccati." : "Live predictions, edge and explanations stay locked."}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{lang === "it" ? "Profilo cliente e lingua salvati" : "Client profile and language saved"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Storico pubblico passato" : "Public past history"}</PlanFeature>
            <PlanFeature locked>{t.plans_base_f1}</PlanFeature>
            <PlanFeature locked>{lang === "it" ? "Tennis live e football research" : "Tennis live and football research"}</PlanFeature>
          </ul>
          <button className="plan-action" disabled={!profile || profile.plan === "free"} onClick={onActivateFree}>
            {!profile ? t.crypto_create_first : profile.plan === "free" ? (lang === "it" ? "Free attivo" : "Free active") : (lang === "it" ? "Attiva Free" : "Activate Free")}
          </button>
        </article>

        <article className="plan-card">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">{lang === "it" ? "Piano unico" : "Single plan"}</p>
              <h4>Signal Desk Pro</h4>
            </div>
            <span>49.50 USDT</span>
          </div>
          <p className="plan-description">{t.plans_base_desc}</p>
          <div className="price-line">
            <strong>{planPriceCopy("base", lang)}</strong>
            <span>Crypto only · USDT TRC20</span>
          </div>
          <div className="plan-core-line">
            <strong>{t.plans_base_core}</strong>
            <em>{t.plans_base_sub}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{t.plans_base_f1}</PlanFeature>
            <PlanFeature>{t.plans_base_f2}</PlanFeature>
            <PlanFeature>{t.plans_base_f3}</PlanFeature>
            <PlanFeature>{t.plans_base_f4}</PlanFeature>
            <PlanFeature>{t.plans_base_f5}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Tennis live V4 e Football Live V4 research" : "Tennis Live V4 and Football Live V4 research"}</PlanFeature>
            <PlanFeature>{lang === "it" ? "Best Bets +EV oppure Top Model Signals quando il mercato è vuoto" : "Best Bets +EV or Top Model Signals when markets are quiet"}</PlanFeature>
          </ul>
          <CryptoPaymentBox profile={profile} plan="base" onSubmit={onPaymentSubmit} />
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

  const risk = draft.risk ?? { maxStake: 10, dailyStopLoss: 50, maxBetsPerDay: 5, mode: "automatic" as const };
  const notifications = draft.notifications ?? defaultNotifications();
  const settingsTimezone = draft.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sportPrefs = draft.sportPreferences ?? ["football", "tennis"];
  const leaderboard = draft.leaderboardOptIn ?? false;
  const isPremium = profileHasPremium(draft);

  const toggleSport = (sport: string) => {
    const current = draft.sportPreferences ?? ["football", "tennis"];
    const next = current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport];
    setDraft({ ...draft, sportPreferences: next });
  };

  const SPORTS = lang === "it"
    ? [["football", "⚽ Football"], ["tennis", "🎾 Tennis"], ["basketball", "🏀 Basketball"], ["other", "Altri sport"]]
    : [["football", "⚽ Football"], ["tennis", "🎾 Tennis"], ["basketball", "🏀 Basketball"], ["other", "Other sports"]];

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
    riskProfile: "Risk profile",
    autopilotLimits: "Limiti autopilot",
    premiumOnly: "Premium",
    maxStake: "Stake massimo per bet",
    stopLoss: "Stop loss giornaliero",
    maxBets: "Max bet al giorno",
    mode: "Modalità",
    automatic: "Automatico",
    approval: "Richiede conferma",
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
    riskProfile: "Risk profile",
    autopilotLimits: "Autopilot limits",
    premiumOnly: "Premium",
    maxStake: "Max stake per bet",
    stopLoss: "Daily stop loss",
    maxBets: "Max bets per day",
    mode: "Mode",
    automatic: "Automatic",
    approval: "Approval required",
    sportPrefs: "Sport preferences",
    sportPrefsDesc: "Receive predictions only for selected sports.",
    leaderboardTitle: "Leaderboard",
    leaderboardDesc: "Appear in the public leaderboard ranked by hit rate.",
    leaderboardOn: "Opted in",
    leaderboardOff: "Opted out",
  };

  const updateNotification = (key: keyof NonNullable<ClientProfile["notifications"]>) => {
    setDraft({ ...draft, notifications: { ...notifications, [key]: !notifications[key] } });
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
            <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          </label>
          <label>
            <span>{copy.language}</span>
            <select value={draft.language ?? "it"} onChange={(event) => setDraft({ ...draft, language: event.target.value as Lang })}>
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
            <p className="eyebrow">{copy.notifications}</p>
            <h3>{lang === "it" ? "Canali e trigger" : "Channels and triggers"}</h3>
          </div>
          <span>{(["valueBets", "dailyReport", "paymentUpdates", "securityAlerts"] as const).filter(k => notifications[k]).length}/4</span>
        </div>
        <div className="settings-notification-list">
          {([
            ["valueBets", copy.valueBets],
            ["dailyReport", copy.dailyReport],
            ["paymentUpdates", copy.paymentUpdates],
            ["securityAlerts", copy.securityAlerts],
          ] as [keyof NonNullable<ClientProfile["notifications"]>, string][]).map(([key, label]) => (
            <button key={key} type="button" className={notifications[key] ? "is-on" : ""} onClick={() => updateNotification(key)}>
              <span>{label}</span>
              <strong>{notifications[key] ? copy.enabled : copy.disabled}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="eyebrow">{copy.sportPrefs}</p>
            <h3>{copy.sportPrefsDesc}</h3>
          </div>
          <span>{sportPrefs.length}</span>
        </div>
        <div className="settings-notification-list">
          {SPORTS.map(([key, label]) => (
            <button key={key} type="button"
              className={sportPrefs.includes(key) ? "is-on" : ""}
              onClick={() => toggleSport(key)}
            >
              <span>{label}</span>
              <strong>{sportPrefs.includes(key) ? copy.enabled : copy.disabled}</strong>
            </button>
          ))}
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

      <section className={`settings-panel ${isPremium ? "" : "is-locked"}`}>
        <div className="settings-panel-head">
          <div>
            <p className="eyebrow">{copy.riskProfile}</p>
            <h3>{copy.autopilotLimits}</h3>
          </div>
          <span>{isPremium ? risk.mode : copy.premiumOnly}</span>
        </div>
        <div className="settings-grid">
          <label>
            <span>{copy.maxStake}</span>
            <input disabled={!isPremium} type="number" value={risk.maxStake} onChange={(event) => setDraft({ ...draft, risk: { ...risk, maxStake: Number(event.target.value) } })} />
          </label>
          <label>
            <span>{copy.stopLoss}</span>
            <input disabled={!isPremium} type="number" value={risk.dailyStopLoss} onChange={(event) => setDraft({ ...draft, risk: { ...risk, dailyStopLoss: Number(event.target.value) } })} />
          </label>
          <label>
            <span>{copy.maxBets}</span>
            <input disabled={!isPremium} type="number" value={risk.maxBetsPerDay} onChange={(event) => setDraft({ ...draft, risk: { ...risk, maxBetsPerDay: Number(event.target.value) } })} />
          </label>
          <label>
            <span>{copy.mode}</span>
            <select disabled={!isPremium} value={risk.mode} onChange={(event) => setDraft({ ...draft, risk: { ...risk, mode: event.target.value as "approval" | "automatic" } })}>
              <option value="automatic">{copy.automatic}</option>
              <option value="approval">{copy.approval}</option>
            </select>
          </label>
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
  const [busy, setBusy] = useState(false);
  const t = useT();
  const lang = useLang();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome";
  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = normalizedEmail.includes("@");
  const pwValid = password.length >= 8;
  const canSubmit = mode === "login"
    ? emailValid && pwValid
    : name.trim().length > 1 && emailValid && pwValid;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true); setError("");
    try {
      const resp = await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({
          action: mode === "login" ? "login" : "register",
          identifier: normalizedEmail, password,
          name: mode === "create" ? name.trim() : undefined,
          language: lang, timezone: tz,
        }),
      });
      if (resp.ok) {
        const server = await resp.json() as { plan?: ClientProfile["plan"]; name?: string | null };
        onAuthed({
          name: (server.name ?? name.trim()) || normalizedEmail,
          email: normalizedEmail, plan: "free", language: lang, timezone: tz,
          risk: { maxStake: 10, dailyStopLoss: 50, maxBetsPerDay: 5, mode: "automatic" },
          betfair: { status: "not_connected" }, notifications: defaultNotifications(),
        }, server.plan);
      } else if (resp.status === 401) setError(t.auth_err_wrongpw);
      else if (resp.status === 404) setError(t.auth_err_noaccount);
      else if (resp.status === 409) setError(t.auth_err_exists);
      else if (resp.status === 403) setError(t.auth_err_founder);
      else if (resp.status === 400) setError(t.auth_err_pwshort);
      else setError(t.auth_err_generic);
    } catch { setError(t.auth_err_generic); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <form className="auth-modal" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); submit(); }}>
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
        {error && <p className="auth-error">{error}</p>}
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
    ? Math.ceil((new Date(profile.planExpiresAt).getTime() - Date.now()) / 86_400_000)
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
        <div className="upgrade-card" style={daysLeft <= 5 ? { borderColor: "rgba(251,191,36,0.4)" } : undefined}>
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

interface Reason { icon: string; text: string; highlight?: boolean }

function buildEnglishFootballResearch(p: Prediction) {
  const selected = bestFootballSelection(p);
  const side = selected?.name ?? (p.best_selection === "DRAW" ? "Draw" : "the model's leading outcome");
  const modelProbability = selected ? pct(selected.probability) : pct(Math.max(p.p_home, p.p_draw, p.p_away));
  const marketProbability = selected?.odds ? pct(1 / selected.odds) : "unavailable market probability";
  const edge = p.edge == null ? "edge unavailable" : `${p.edge > 0 ? "+" : ""}${(p.edge * 100).toFixed(1)}% edge`;
  const e = p.enrichment ?? {};

  const riskSignals = [];
  if (e.form_home || e.form_away) {
    riskSignals.push(`recent form is ${p.home_team} ${e.form_home || "n/a"} vs ${p.away_team} ${e.form_away || "n/a"}`);
  }
  if (e.xg_home != null && e.xg_away != null) {
    riskSignals.push(`chance creation sits at ${e.xg_home.toFixed(2)} home xG vs ${e.xg_away.toFixed(2)} away xG`);
  }
  if ((e.injuries_home?.length ?? 0) || (e.injuries_away?.length ?? 0)) {
    riskSignals.push(`injury load is ${e.injuries_home?.length ?? 0} home vs ${e.injuries_away?.length ?? 0} away players out`);
  }

  const risk = riskSignals.length
    ? riskSignals.join("; ")
    : "the main risk is that market price, team news or late liquidity can move before execution";

  return `${p.home_team} vs ${p.away_team} points to ${side} as the preferred model angle. Dixon-Coles prices it at ${modelProbability} versus ${marketProbability} implied by the market, leaving ${edge}. Main risk: ${risk}.`;
}

function buildReasons(p: Prediction, lang: Lang): Reason[] {
  const e = p.enrichment ?? {};
  const reasons: Reason[] = [];
  const isEnglish = lang === "en";

  const leader = p.p_home > p.p_draw && p.p_home > p.p_away ? "HOME" : p.p_draw > p.p_away ? "DRAW" : "AWAY";
  const leaderPct = leader === "HOME" ? p.p_home : leader === "DRAW" ? p.p_draw : p.p_away;
  reasons.push({
    icon: "🧠",
    text: `Dixon-Coles model: ${leader} favoured at ${pct(leaderPct)} — λ ${p.lambda_home?.toFixed(2) ?? "?"} (home) vs ${p.lambda_away?.toFixed(2) ?? "?"} (away)`,
  });

  if (p.edge != null && p.odds_home != null) {
    if (isFootballBestBet(p)) {
      reasons.push({
        icon: "💰",
        text: `Value bet: model sees +${(p.edge * 100).toFixed(1)}% edge on ${p.best_selection} (model ${pct(leaderPct)} vs market implied ${pct(1 / (p.best_selection === "HOME" ? p.odds_home! : p.best_selection === "DRAW" ? p.odds_draw! : p.odds_away!))})`,
        highlight: true,
      });
    } else if (Math.abs(p.edge) < 0.01) {
      reasons.push({ icon: "⚖️", text: `Model and market roughly agree — edge near zero (${(p.edge * 100).toFixed(1)}%)` });
    } else {
      reasons.push({ icon: "📉", text: `Market offers better price: model sees ${(p.edge * 100).toFixed(1)}% edge on ${p.best_selection} (no value currently)` });
    }
  } else {
    reasons.push({ icon: "❓", text: "No market odds available — edge cannot be computed" });
  }

  if (e.pi_home != null || e.pi_away != null) {
    const piH = e.pi_home ?? 0;
    const piA = e.pi_away ?? 0;
    const diff = piH - piA;
    if (Math.abs(diff) > 20) {
      reasons.push({
        icon: "⚡",
        text: `Pi Rating: ${diff > 0 ? "HOME" : "AWAY"} stronger by ${Math.abs(diff)} points (home ${piH > 0 ? "+" : ""}${piH} / away ${piA > 0 ? "+" : ""}${piA})`,
        highlight: Math.abs(diff) > 80,
      });
    } else {
      reasons.push({ icon: "⚡", text: `Pi Rating: teams evenly matched (home ${piH > 0 ? "+" : ""}${piH} / away ${piA > 0 ? "+" : ""}${piA})` });
    }
  }

  if (e.xg_home != null && e.xg_away != null) {
    const diff = e.xg_home - e.xg_away;
    if (Math.abs(diff) > 0.3) {
      reasons.push({
        icon: "⚽",
        text: `xG trend: ${diff > 0 ? "HOME" : "AWAY"} creating more chances — home ${e.xg_home.toFixed(2)} xG vs away ${e.xg_away.toFixed(2)} xG per game`,
        highlight: Math.abs(diff) > 0.6,
      });
    } else {
      reasons.push({ icon: "⚽", text: `xG balanced: home ${e.xg_home.toFixed(2)} vs away ${e.xg_away.toFixed(2)} xG per game` });
    }
    if (e.xga_home != null && e.xga_away != null) {
      const defDiff = e.xga_away - e.xga_home;
      if (Math.abs(defDiff) > 0.3) {
        reasons.push({
          icon: "🛡️",
          text: `Defense: ${defDiff > 0 ? "HOME concedes less" : "AWAY concedes less"} — home concedes ${e.xga_home.toFixed(2)} vs away ${e.xga_away.toFixed(2)} xGA`,
        });
      }
    }
  }

  const formH = e.form_home ?? "";
  const formA = e.form_away ?? "";
  if (formH || formA) {
    const homeWins = (formH.match(/W/g) || []).length;
    const awayWins = (formA.match(/W/g) || []).length;
    const homeLosses = (formH.match(/L/g) || []).length;
    const awayLosses = (formA.match(/L/g) || []).length;
    if (homeWins >= 4) {
      reasons.push({ icon: "🔥", text: `Home on fire: ${homeWins}W in last ${formH.length} games (${formH.split("").join(" ")})`, highlight: true });
    } else if (awayWins >= 4) {
      reasons.push({ icon: "🔥", text: `Away on fire: ${awayWins}W in last ${formA.length} games (${formA.split("").join(" ")})`, highlight: true });
    } else if (homeLosses >= 4) {
      reasons.push({ icon: "📉", text: `Home poor form: ${homeLosses}L in last ${formH.length} games (${formH.split("").join(" ")})` });
    } else if (awayLosses >= 4) {
      reasons.push({ icon: "📉", text: `Away poor form: ${awayLosses}L in last ${formA.length} games (${formA.split("").join(" ")})` });
    } else {
      reasons.push({ icon: "📋", text: `Form: HOME ${formH.split("").join(" ") || "n/a"} · AWAY ${formA.split("").join(" ") || "n/a"}` });
    }
  }

  const injH = e.injuries_home?.length ?? 0;
  const injA = e.injuries_away?.length ?? 0;
  if (injH > 0 || injA > 0) {
    if (injH > injA + 1) {
      reasons.push({ icon: "🚑", text: `Home significantly more injured: ${injH} vs ${injA} — ${e.injuries_home!.slice(0, 2).join(", ")}`, highlight: injH > 3 });
    } else if (injA > injH + 1) {
      reasons.push({ icon: "🚑", text: `Away significantly more injured: ${injA} vs ${injH} — ${e.injuries_away!.slice(0, 2).join(", ")}`, highlight: injA > 3 });
    } else {
      reasons.push({ icon: "🚑", text: `Injuries balanced: home ${injH} · away ${injA} players out` });
    }
  }

  if (e.api_pct_home != null) {
    const dixonHome = Math.round(p.p_home * 100);
    const apiHome = e.api_pct_home;
    const discrepancy = Math.abs(dixonHome - apiHome);
    if (discrepancy >= 8) {
      reasons.push({
        icon: "🔎",
        text: `Models diverge on HOME: Dixon-Coles says ${dixonHome}% vs API-Football ${apiHome}% — discrepancy of ${discrepancy}pp warrants extra caution`,
        highlight: discrepancy >= 15,
      });
    } else {
      reasons.push({ icon: "✅", text: `API-Football confirms: HOME ${apiHome}% (our model: ${dixonHome}%) — models agree` });
    }
    if (e.api_advice && !isEnglish) {
      reasons.push({ icon: "💬", text: `API-Football advice: "${e.api_advice}"` });
    }
  }

  if (e.weather) {
    const w = e.weather;
    if (w.wind > 8 || w.rain > 3) {
      reasons.push({
        icon: "🌧️",
        text: `Weather risk: ${w.temp}°C, wind ${w.wind}m/s, rain ${w.rain}mm — may reduce total goals scored`,
        highlight: w.wind > 12 || w.rain > 8,
      });
    }
  }

  if (e.research && !isEnglish) {
    reasons.push({ icon: "🤖", text: `AI research: ${e.research}` });
  } else if (e.research && isEnglish) {
    reasons.push({
      icon: "🤖",
      text: `AI research: ${buildEnglishFootballResearch(p)}`,
      highlight: isFootballBestBet(p),
    });
  }

  return reasons;
}


const LEAGUE_BADGE_COLORS: Record<string, string> = {
  PL:  "text-violet-400 border-violet-400/40 bg-violet-400/10",
  SA:  "text-blue-400 border-blue-400/40 bg-blue-400/10",
  PD:  "text-red-400 border-red-400/40 bg-red-400/10",
  BL1: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  FL1: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  CL:  "text-amber-300 border-amber-300/40 bg-amber-300/10",
  EL:  "text-orange-400 border-orange-400/40 bg-orange-400/10",
};

function PredictionCard({ p, onSelect, onBetNow, isPreview, isPremium, onGate }: { p: Prediction; onSelect?: (s: SlipSelection) => void; onBetNow?: () => void; isPreview?: boolean; isPremium?: boolean; onGate?: () => void }) {
  const [showWhy, setShowWhy] = useState(false);
  const t = useT();
  const lang = useLang();
  const tz = useTz();
  const live = useLive()[p.match_id];
  const isLive = live?.match_status === "IN_PLAY";
  const isPaused = live?.match_status === "PAUSED";
  const isFinished = live?.match_status === "FINISHED";
  const hasScore = live && (live.home_score != null || live.away_score != null);
  const hasOdds = p.odds_home != null;
  const isValueBet = isFootballBestBet(p);
  const e = p.enrichment ?? {};
  const leagueBadgeColor = LEAGUE_BADGE_COLORS[p.league] ?? "text-gray-400 border-gray-400/40 bg-gray-400/10";
  const reasons = buildReasons(p, lang);

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

  return (
    <div className={`glass-card p-4 space-y-3 ${isValueBet ? "border-green-400/40" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${leagueBadgeColor}`}>
              {p.league}
            </span>
            <span className="text-xs text-gray-500 font-mono">{LEAGUE_FLAGS[p.league] ?? "⚽"} {p.league_name}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-400/70 bg-amber-400/5">PAPER</span>
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {p.home_team}<span className="text-gray-500 font-normal mx-2">vs</span>{p.away_team}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-0.5">{fmtKickoff(p.kickoff, lang, tz)}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isValueBet && p.best_selection && !isPreview && (
            <button
              className="text-xs px-2 py-0.5 rounded-full border border-green-400/50 text-green-400 bg-green-400/10 font-mono hover:bg-green-400/20 transition-colors"
              onClick={handleSelect}
            >
              +EV {p.best_selection}
            </button>
          )}
          {p.match_type && p.match_type !== "STANDARD" && <MatchTypeBadge matchType={p.match_type} />}
          {e.research && (
            <span className="text-xs px-1.5 py-0.5 rounded border border-purple-400/40 text-purple-400 bg-purple-400/5 font-mono">AI</span>
          )}
        </div>
      </div>

      {/* Live / Final Score */}
      {hasScore && (
        <div className={`live-score-bar ${isLive ? "live" : isPaused ? "paused" : isFinished ? "finished" : ""}`}>
          <span className={`live-badge ${isLive ? "blink" : ""}`}>
            {isLive ? "● LIVE" : isPaused ? "HT" : "FT"}
            {isLive && live.minute != null && ` ${live.minute}'`}
          </span>
          <span className="live-result">
            {live.home_score ?? 0} — {live.away_score ?? 0}
          </span>
          {isFinished && live.home_score != null && live.away_score != null && (() => {
            const actual = live.home_score > live.away_score ? "HOME" : live.home_score < live.away_score ? "AWAY" : "DRAW";
            const correct = p.best_selection === actual;
            return p.best_selection ? (
              <span className={`live-verdict ${correct ? "correct" : "wrong"}`}>
                {correct ? "✓ Modello corretto" : "✗ Modello errato"}
              </span>
            ) : null;
          })()}
        </div>
      )}

      {/* Per-card reveal gating (Task 7) */}
      {p.locked ? (
        <div className="card-lock-overlay" role="button" onClick={() => onGate?.()}>
          <span className="blurred">▒▒ HOME ▒▒▒%</span>
          <span className="blurred">▒▒ DRAW ▒▒▒%</span>
          <span className="blurred">▒▒ AWAY ▒▒▒%</span>
          <span className="locked-cta">{t.locked_title}</span>
        </div>
      ) : (
        <>
          {/* Probability bars */}
          <div className="space-y-1.5">
            <ProbBar label="HOME" pct={p.p_home} color="text-cyan-400"
              odds={p.odds_home} isValue={hasOdds && p.best_selection === "HOME" && isValueBet} />
            <ProbBar label="DRAW" pct={p.p_draw} color="text-yellow-400"
              odds={p.odds_draw} isValue={hasOdds && p.best_selection === "DRAW" && isValueBet} />
            <ProbBar label="AWAY" pct={p.p_away} color="text-fuchsia-400"
              odds={p.odds_away} isValue={hasOdds && p.best_selection === "AWAY" && isValueBet} />
          </div>
          {p.pick && <div className="text-xs font-mono text-cyan-400 mt-1">Pick: <strong>{p.pick}</strong>{p.confidence_score != null && <span className="ml-1 text-gray-400">{p.confidence_score}%</span>}</div>}
          {p.explanation && <p className="text-[10px] font-mono text-gray-400 mt-1 leading-relaxed">{p.explanation}</p>}
          {p.affiliate && (
            <a className="bonus-cta" href={p.affiliate.url} target="_blank" rel="nofollow sponsored noopener">
              {p.affiliate.bonus} · {p.affiliate.bookmaker} →
            </a>
          )}
          {p.pick_of_day && <span className="badge-potd">Pick of the Day</span>}
        </>
      )}

      {/* Extra markets — schedina optimizer */}
      {e.extra_markets && e.extra_markets.length > 0 && (() => {
        // Sort by probability descending, show only markets with p >= 55%
        const picks = [...e.extra_markets]
          .filter((m) => m.p >= 0.55)
          .sort((a, b) => b.p - a.p)
          .slice(0, 5);
        if (!picks.length) return null;
        return (
          <div className="extra-markets">
            <span className="extra-markets-label">{lang === "it" ? "Schedina" : "Acca picks"}</span>
            {picks.map((m) => {
              const strength = m.p >= 0.80 ? "high" : m.p >= 0.65 ? "mid" : "low";
              return (
                <span key={m.key} className={`extra-market-pill ${strength}`}>
                  <span className="extra-market-name">{m.label}</span>
                  <span className="extra-market-pct">{Math.round(m.p * 100)}%</span>
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* Footer: model + edge + why toggle */}
      <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
        {isPreview ? (
          <span className="why-locked-preview">{t.pred_why_show}</span>
        ) : (
          <button
            className="text-gray-500 hover:text-cyan-400 transition-colors text-[10px] uppercase tracking-wider"
            onClick={() => setShowWhy(!showWhy)}
          >
            {showWhy ? t.pred_why_hide : t.pred_why_show}
          </button>
        )}
        <span className="text-gray-600">Dixon-Coles</span>
        {isPreview ? (
          <span className="plan-lock-badge">🔒 Pro</span>
        ) : p.edge != null ? (
          <span className={`px-2 py-0.5 rounded border font-mono text-[10px] ${isFootballBestBet(p) ? "text-green-400 border-green-400/40 bg-green-400/10" : p.edge > 0 ? "text-gray-400 border-gray-400/30" : "text-red-400 border-red-400/30"}`}>
            {p.edge > 0 ? "+" : ""}{(p.edge * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-600">no edge</span>
        )}
      </div>

      {/* Preview upgrade nudge (free plan) */}
      {isPreview && (
        <div className="plan-upgrade-nudge">
          <span>🔒</span>
          <strong>{lang === "it" ? "Edge e analisi richiedono Signal Desk Pro" : "Edge and analysis require Signal Desk Pro"}</strong>
          <em>{lang === "it" ? "Sblocca edge%, ragionamento AI e segnali con Pro (49.50 USDT/mese)." : "Unlock edge%, AI reasoning and signals with Pro (49.50 USDT/month)."}</em>
        </div>
      )}

      {/* Inline Why section */}
      {!isPreview && showWhy && (
        <div className="space-y-2 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="text-[9px] font-mono text-cyan-400/60 uppercase tracking-widest">{t.pred_why_title}</div>
          {reasons.map((r, i) => (
            <div key={i} className={`flex gap-2 text-[10px] font-mono leading-relaxed ${r.highlight ? "text-white" : "text-gray-500"}`}>
              <span className="shrink-0">{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-[9px] text-gray-600 font-mono pt-1 border-t border-white/5">
            <span>λ home {p.lambda_home?.toFixed(2) ?? "?"}</span>
            <span>λ away {p.lambda_away?.toFixed(2) ?? "?"}</span>
            <span>{p.model_matches ?? "?"} matches</span>
          </div>
        </div>
      )}

      {onBetNow && !isPreview && (
        <button
          className="w-full mt-1 py-1.5 rounded-lg border border-green-400/30 bg-green-400/8 text-green-400 text-xs font-mono tracking-wider hover:bg-green-400/15 hover:border-green-400/50 transition-colors"
          onClick={onBetNow}
        >
          {t.bet_now}
        </button>
      )}

      {/* Deep Analysis — Premium only */}
      {isPremium && (
        <div className="deep-analysis-panel">
          <div className="da-header">
            <span className="da-badge">⚡ Pro</span>
            <span className="da-title">{lang === "it" ? "Analisi approfondita" : "Deep Analysis"}</span>
          </div>
          {(e.xg_home != null || e.xg_away != null) && (
            <div className="da-row">
              <span className="da-label">xG</span>
              <span className="da-value">{e.xg_home?.toFixed(2) ?? "–"} vs {e.xg_away?.toFixed(2) ?? "–"}</span>
            </div>
          )}
          {(e.pi_home != null || e.pi_away != null) && (
            <div className="da-row">
              <span className="da-label">Pi Rating</span>
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

      {/* Deep Analysis locked teaser — Base users only */}
      {!isPremium && !isPreview && (
        <div className="deep-analysis-locked">
          <span>⚡</span>
          <span>{lang === "it" ? "Analisi approfondita disponibile con Signal Desk Pro (49.50 USDT/mese)" : "Deep analysis available with Signal Desk Pro (49.50 USDT/month)"}</span>
        </div>
      )}
    </div>
  );
}

// ─── Tennis Tab ───────────────────────────────────────────────────────────────

const SURFACE_META: Record<string, { label: string; color: string }> = {
  CLAY:  { label: "CLAY",  color: "text-orange-400 border-orange-400/40 bg-orange-400/10" },
  GRASS: { label: "GRASS", color: "text-green-400 border-green-400/40 bg-green-400/10" },
  HARD:  { label: "HARD",  color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
};

type TennisReason = { icon: string; text: string; highlight?: boolean };

function buildTennisReasons(m: TennisMatch, lang: Lang): TennisReason[] {
  const reasons: TennisReason[] = [];
  const surfLabel = lang === "it"
    ? (m.surface === "CLAY" ? "terra battuta" : m.surface === "GRASS" ? "erba" : "cemento")
    : (m.surface === "CLAY" ? "clay" : m.surface === "GRASS" ? "grass" : "hard court");
  const p1last = m.player1.split(" ").pop() ?? m.player1;
  const p2last = m.player2.split(" ").pop() ?? m.player2;

  // Elo surface ratings
  if (m.elo_p1 != null && m.elo_p2 != null) {
    const delta = m.elo_p1 - m.elo_p2;
    const leader = delta > 0 ? p1last : p2last;
    const stronger = lang === "it"
      ? (Math.abs(delta) > 80 ? "nettamente superiore" : Math.abs(delta) > 30 ? "superiore" : "leggermente avanti")
      : (Math.abs(delta) > 80 ? "clearly stronger" : Math.abs(delta) > 30 ? "stronger" : "slightly ahead");
    reasons.push({
      icon: "🎾",
      text: `Elo ${surfLabel}: ${p1last} ${m.elo_p1} · ${p2last} ${m.elo_p2} — ${leader} ${stronger} (Δ${Math.abs(delta).toFixed(0)} pt)`,
      highlight: Math.abs(delta) > 80,
    });
  } else {
    reasons.push({ icon: "🎾", text: lang === "it" ? `Elo surface-adjusted su ${surfLabel} — modello ${m.model}` : `Surface-adjusted Elo on ${surfLabel} — model ${m.model}` });
  }

  // Overall vs surface rating (shows surface specialisation)
  if (m.elo_p1 != null && m.elo_p1_overall != null && m.elo_p2 != null && m.elo_p2_overall != null) {
    const p1surfAdv = m.elo_p1 - m.elo_p1_overall;
    const p2surfAdv = m.elo_p2 - m.elo_p2_overall;
    const hasSpec = Math.abs(p1surfAdv) > 20 || Math.abs(p2surfAdv) > 20;
    if (hasSpec) {
      const parts: string[] = [];
      if (Math.abs(p1surfAdv) > 20) parts.push(`${p1last} ${p1surfAdv > 0 ? "+" : ""}${p1surfAdv.toFixed(0)} ${lang === "it" ? "su" : "on"} ${surfLabel}`);
      if (Math.abs(p2surfAdv) > 20) parts.push(`${p2last} ${p2surfAdv > 0 ? "+" : ""}${p2surfAdv.toFixed(0)} ${lang === "it" ? "su" : "on"} ${surfLabel}`);
      reasons.push({ icon: "📊", text: lang === "it" ? `Specializzazione superficie: ${parts.join(" · ")} (vs rating overall)` : `Surface specialization: ${parts.join(" · ")} (vs overall rating)`, highlight: Math.abs(p1surfAdv) > 60 || Math.abs(p2surfAdv) > 60 });
    } else {
      reasons.push({ icon: "📊", text: lang === "it" ? `Overall: ${p1last} ${m.elo_p1_overall} · ${p2last} ${m.elo_p2_overall} — prestazioni simili su tutte le superfici` : `Overall: ${p1last} ${m.elo_p1_overall} · ${p2last} ${m.elo_p2_overall} — similar performance across surfaces` });
    }
  }

  // Surface match count (data reliability)
  if (m.surface_matches_p1 != null && m.surface_matches_p2 != null) {
    const minMatches = Math.min(m.surface_matches_p1, m.surface_matches_p2);
    const reliability = lang === "it"
      ? (minMatches >= 50 ? "alta" : minMatches >= 20 ? "media" : "bassa")
      : (minMatches >= 50 ? "high" : minMatches >= 20 ? "medium" : "low");
    reasons.push({
      icon: "📈",
      text: lang === "it" ? `Partite su ${surfLabel}: ${p1last} ${m.surface_matches_p1} · ${p2last} ${m.surface_matches_p2} — affidabilità rating ${reliability}` : `Matches on ${surfLabel}: ${p1last} ${m.surface_matches_p1} · ${p2last} ${m.surface_matches_p2} — ${reliability} rating reliability`,
    });
  }

  if (m.serve_form_p1 != null && m.serve_form_p2 != null && m.return_form_p1 != null && m.return_form_p2 != null) {
    const serveEdge = (m.serve_form_p1 - m.serve_form_p2) * 100;
    const returnEdge = (m.return_form_p1 - m.return_form_p2) * 100;
    const serveLeader = serveEdge >= 0 ? p1last : p2last;
    const returnLeader = returnEdge >= 0 ? p1last : p2last;
    reasons.push({
      icon: "🎯",
      text: lang === "it"
        ? `Forma serve/return: servizio ${serveLeader} ${Math.abs(serveEdge).toFixed(1)}pp · risposta ${returnLeader} ${Math.abs(returnEdge).toFixed(1)}pp`
        : `Serve/return form: serve ${serveLeader} ${Math.abs(serveEdge).toFixed(1)}pp · return ${returnLeader} ${Math.abs(returnEdge).toFixed(1)}pp`,
      highlight: Math.abs(serveEdge) > 4 || Math.abs(returnEdge) > 3,
    });
  }

  if (m.feature_quality != null) {
    const q = Math.round(m.feature_quality * 100);
    reasons.push({
      icon: "🧪",
      text: lang === "it"
        ? `Qualità feature live: ${q}% — campione tecnico ${q >= 70 ? "solido" : q >= 40 ? "medio" : "limitato"}`
        : `Live feature quality: ${q}% — ${q >= 70 ? "solid" : q >= 40 ? "medium" : "limited"} technical sample`,
      highlight: q >= 70,
    });
  }

  if (m.p1_rest_days != null && m.p2_rest_days != null) {
    const recent1 = m.p1_recent_matches_14d ?? null;
    const recent2 = m.p2_recent_matches_14d ?? null;
    const restDelta = m.p1_rest_days - m.p2_rest_days;
    if (Math.abs(restDelta) >= 2 || (recent1 != null && recent2 != null && recent1 !== recent2)) {
      reasons.push({
        icon: "⚡",
        text: lang === "it"
          ? `Carico recente: riposo ${p1last} ${m.p1_rest_days}g · ${p2last} ${m.p2_rest_days}g, match 14g ${recent1 ?? "?"}-${recent2 ?? "?"}`
          : `Recent load: rest ${p1last} ${m.p1_rest_days}d · ${p2last} ${m.p2_rest_days}d, 14d matches ${recent1 ?? "?"}-${recent2 ?? "?"}`,
      });
    }
  }

  // Fatigue adjustment (shown only when meaningful)
  if (m.elo_raw_p1 != null) {
    const delta = Math.abs(m.p1 - m.elo_raw_p1);
    if (delta > 0.003) {
      const dir = m.p1 > m.elo_raw_p1 ? "favorisce" : "penalizza";
      reasons.push({
        icon: "⚡",
        text: lang === "it" ? `Fatica: Elo puro ${Math.round(m.elo_raw_p1 * 100)}% → ${Math.round(m.p1 * 100)}% dopo aggiustamento — stanchezza ${dir} ${p1last}` : `Fatigue: raw Elo ${Math.round(m.elo_raw_p1 * 100)}% → ${Math.round(m.p1 * 100)}% after adjustment — fatigue ${dir === "favorisce" ? "helps" : "hurts"} ${p1last}`,
      });
    }
  }

  // Model vs market odds
  const mktP1 = m.odds_p1 && m.odds_p1 > 1 ? Math.round((1 / m.odds_p1) * 100) : null;
  const mktP2 = m.odds_p2 && m.odds_p2 > 1 ? Math.round((1 / m.odds_p2) * 100) : null;
  if (m.best_selection === "P1" && mktP1 != null) {
    reasons.push({
      icon: "🧠",
      text: lang === "it" ? `Modello: ${p1last} ${Math.round(m.p1 * 100)}% · Mercato: ${mktP1}% — modello vede ${Math.round(m.p1 * 100) - mktP1}pp in più` : `Model: ${p1last} ${Math.round(m.p1 * 100)}% · Market: ${mktP1}% — model sees ${Math.round(m.p1 * 100) - mktP1}pp more`,
      highlight: Math.round(m.p1 * 100) - mktP1 > 4,
    });
  } else if (m.best_selection === "P2" && mktP2 != null) {
    reasons.push({
      icon: "🧠",
      text: lang === "it" ? `Modello: ${p2last} ${Math.round(m.p2 * 100)}% · Mercato: ${mktP2}% — modello vede ${Math.round(m.p2 * 100) - mktP2}pp in più` : `Model: ${p2last} ${Math.round(m.p2 * 100)}% · Market: ${mktP2}% — model sees ${Math.round(m.p2 * 100) - mktP2}pp more`,
      highlight: Math.round(m.p2 * 100) - mktP2 > 4,
    });
  } else {
    reasons.push({ icon: "⚖️", text: lang === "it" ? `${p1last} ${Math.round(m.p1 * 100)}% vs ${p2last} ${Math.round(m.p2 * 100)}% — nessun edge netto` : `${p1last} ${Math.round(m.p1 * 100)}% vs ${p2last} ${Math.round(m.p2 * 100)}% — no clear edge` });
  }

  // Edge conclusion
  if (isTennisBestBet(m)) {
    const edgePct = ((m.edge ?? 0) * 100).toFixed(1);
    reasons.push({ icon: "💰", text: lang === "it" ? `Value bet: edge +${edgePct}% su ${m.best_selection === "P1" ? m.player1 : m.player2} — supera soglia minima 2.5%` : `Value bet: edge +${edgePct}% on ${m.best_selection === "P1" ? m.player1 : m.player2} — clears the 2.5% minimum threshold`, highlight: true });
  } else if (m.edge != null && m.edge > 0) {
    reasons.push({ icon: "📉", text: lang === "it" ? `Edge marginale +${(m.edge * 100).toFixed(1)}% — sotto soglia value (2.5%), segnale non attivato` : `Marginal edge +${(m.edge * 100).toFixed(1)}% — below value threshold (2.5%), signal not activated` });
  } else {
    reasons.push({ icon: "❌", text: lang === "it" ? "Nessun edge positivo — il mercato prezza già correttamente questa partita" : "No positive edge — market is already pricing this match correctly" });
  }

  return reasons;
}

function TennisMatchCard({ m, onSelect, onBetNow, isPreview, isPremium, onGate }: { m: TennisMatch; onSelect?: (s: SlipSelection) => void; onBetNow?: () => void; isPreview?: boolean; isPremium?: boolean; onGate?: () => void }) {
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

  const handleSelect = (player: "P1" | "P2") => {
    if (!onSelect) return;
    const isP1 = player === "P1";
    const odds = isP1 ? m.odds_p1 : m.odds_p2;
    const probability = isP1 ? m.p1 : m.p2;
    const name = isP1 ? m.player1 : m.player2;
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

  return (
    <div className={`glass-card p-4 space-y-3 ${isValue ? "border-green-400/40" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${surface.color}`}>
              {surface.label}
            </span>
            <span className="text-xs text-gray-500 font-mono">{m.tournament}</span>
            <span className="text-[10px] text-gray-600 font-mono">{m.round}</span>
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {m.player1} <span className="text-gray-500 font-normal">vs</span> {m.player2}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-0.5">{scheduledDate}</div>
        </div>
        {isValue && m.best_selection && !isPreview && (
          <button
            className="text-xs px-2 py-0.5 rounded-full border border-green-400/50 text-green-400 bg-green-400/10 font-mono shrink-0 hover:bg-green-400/20 transition-colors"
            onClick={() => handleSelect(m.best_selection as "P1" | "P2")}
          >
            +EV {m.best_selection}
          </button>
        )}
      </div>

      {/* Per-card reveal gating (Task 7) */}
      {m.locked ? (
        <div className="card-lock-overlay" role="button" onClick={() => onGate?.()}>
          <span className="blurred">▒▒▒▒▒▒▒▒ ▒▒▒%</span>
          <span className="blurred">▒▒▒▒▒▒▒▒ ▒▒▒%</span>
          <span className="locked-cta">{t.locked_title}</span>
        </div>
      ) : (
        <>
          {/* Probability bars */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelect && handleSelect("P1")}>
              <span className="text-xs font-mono w-24 shrink-0 text-cyan-400 truncate">{m.player1.split(" ").pop()}</span>
              <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.round(m.p1 * 100)}%` }} />
              </div>
              <span className="text-xs font-mono w-8 text-right text-cyan-400">{Math.round(m.p1 * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelect && handleSelect("P2")}>
              <span className="text-xs font-mono w-24 shrink-0 text-fuchsia-400 truncate">{m.player2.split(" ").pop()}</span>
              <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-fuchsia-400 transition-all" style={{ width: `${Math.round(m.p2 * 100)}%` }} />
              </div>
              <span className="text-xs font-mono w-8 text-right text-fuchsia-400">{Math.round(m.p2 * 100)}%</span>
            </div>
          </div>
          {m.pick && <div className="text-xs font-mono text-cyan-400 mt-1">Pick: <strong>{m.pick}</strong>{m.confidence_score != null && <span className="ml-1 text-gray-400">{m.confidence_score}%</span>}</div>}
          {m.explanation && <p className="text-[10px] font-mono text-gray-400 mt-1 leading-relaxed">{m.explanation}</p>}
          {m.affiliate && (
            <a className="bonus-cta" href={m.affiliate.url} target="_blank" rel="nofollow sponsored noopener">
              {m.affiliate.bonus} · {m.affiliate.bookmaker} →
            </a>
          )}
          {m.pick_of_day && <span className="badge-potd">Pick of the Day</span>}
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
        {isPreview ? (
          <span className="why-locked-preview">{t.tennis_why_show}</span>
        ) : (
          <button
            className="text-gray-500 hover:text-cyan-400 transition-colors text-[10px] uppercase tracking-wider"
            onClick={handleWhyClick}
          >
            {loadingAnalysis ? "⏳ ..." : showWhy ? t.tennis_why_hide : t.tennis_why_show}
          </button>
        )}
        <span className="text-gray-600">{m.model}</span>
        {isPreview ? (
          <span className="plan-lock-badge">🔒 Pro</span>
        ) : m.edge != null && m.edge > 0 ? (
          <span className={`px-2 py-0.5 rounded border font-mono text-[10px] ${isValue ? "text-green-400 border-green-400/40 bg-green-400/10" : "text-gray-400 border-gray-400/30"}`}>
            edge +{(m.edge * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-600">no edge</span>
        )}
      </div>

      {/* Preview upgrade nudge (free plan) */}
      {isPreview && (
        <div className="plan-upgrade-nudge">
          <span>🔒</span>
          <strong>{lang === "it" ? "Edge Elo e analisi richiedono Signal Desk Pro" : "Elo edge and analysis require Signal Desk Pro"}</strong>
          <em>{lang === "it" ? "Sblocca edge%, analisi Elo Surface e segnali tennis con Pro (49.50 USDT/mese)." : "Unlock edge%, Elo Surface analysis and tennis signals with Pro (49.50 USDT/month)."}</em>
        </div>
      )}

      {onBetNow && !isPreview && (
        <button
          className="w-full mt-1 py-1.5 rounded-lg border border-green-400/30 bg-green-400/8 text-green-400 text-xs font-mono tracking-wider hover:bg-green-400/15 hover:border-green-400/50 transition-colors"
          onClick={onBetNow}
        >
          {t.bet_now}
        </button>
      )}

      {/* Inline Why */}
      {!isPreview && showWhy && (
        <div className="space-y-2 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* AI analysis — shown first when available */}
          {aiAnalysis && lang === "it" ? (
            <>
              <div className="text-[9px] font-mono text-cyan-400/60 uppercase tracking-widest flex items-center gap-1.5">
                <span>🤖</span> {t.tennis_ai_label}
              </div>
              <p className="text-[10px] font-mono text-gray-300 leading-relaxed whitespace-pre-line">
                {aiAnalysis}
              </p>
              <div className="text-[9px] font-mono text-white/20 uppercase tracking-widest pt-1 border-t border-white/5">{t.tennis_elo_data}</div>
            </>
          ) : loadingAnalysis ? (
            <div className="text-[10px] font-mono text-cyan-400/50 animate-pulse">{t.tennis_ai_loading}</div>
          ) : (
            <div className="text-[9px] font-mono text-cyan-400/60 uppercase tracking-widest">{t.tennis_elo_label}</div>
          )}
          {/* Structured Elo reasons — always shown */}
          {buildTennisReasons(m, lang).map((r, i) => (
            <div key={i} className={`text-[10px] font-mono leading-relaxed ${r.highlight ? "text-green-400" : "text-gray-400"}`}>
              {r.icon} {r.text}
            </div>
          ))}
        </div>
      )}

      {/* Deep Analysis — Premium only */}
      {isPremium && (
        <div className="deep-analysis-panel">
          <div className="da-header">
            <span className="da-badge">⚡ Pro</span>
            <span className="da-title">{lang === "it" ? "Analisi Elo" : "Elo Analysis"}</span>
          </div>
          <div className="da-row">
            <span className="da-label">Elo {surface.label}</span>
            <span className="da-value">{m.elo_p1?.toFixed(0) ?? "–"} vs {m.elo_p2?.toFixed(0) ?? "–"}</span>
          </div>
          {(m.elo_p1_overall != null || m.elo_p2_overall != null) && (
            <div className="da-row">
              <span className="da-label">Elo Overall</span>
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
              <span className="da-label">Elo raw prob.</span>
              <span className="da-value">{m.elo_raw_p1 != null ? `${Math.round(m.elo_raw_p1 * 100)}%` : "–"} vs {m.elo_raw_p2 != null ? `${Math.round(m.elo_raw_p2 * 100)}%` : "–"}</span>
            </div>
          )}
        </div>
      )}

      {/* Deep Analysis locked teaser — Base users only */}
      {!isPremium && !isPreview && (
        <div className="deep-analysis-locked">
          <span>⚡</span>
          <span>{lang === "it" ? "Analisi Elo approfondita disponibile con Signal Desk Pro (49.50 USDT/mese)" : "Deep Elo analysis available with Signal Desk Pro (49.50 USDT/month)"}</span>
        </div>
      )}
    </div>
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
      <div className="glass-card p-4 border-cyan-400/10">
        <div className="text-xs font-mono text-gray-400 space-y-1 leading-relaxed">
          <div className="text-cyan-400 font-bold mb-2">{t.agent_arch_title}</div>
          <div>
            <span className="text-cyan-300">{t.agent_arch_dashboard_title}</span> — {t.agent_arch_dashboard_desc}
          </div>
          <div>
            <span className="text-fuchsia-300">{t.agent_arch_agents_title}</span> — {t.agent_arch_agents_desc} <code className="text-yellow-300">python run.py</code>.
          </div>
          {!anyOnline && (
            <div className="mt-2 text-yellow-400 border border-yellow-400/20 rounded px-2 py-1">
              {t.agent_arch_none} <code>python run.py</code> {t.agent_arch_none_suffix}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.name} className={`glass-card p-4 space-y-2 ${
            agent.status === "alive" ? "border-green-400/20" :
            agent.status === "stale" ? "border-yellow-400/20" : "border-red-400/20"
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white font-mono">{agent.name}</span>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  agent.status === "alive" ? "bg-green-400 animate-pulse" :
                  agent.status === "stale" ? "bg-yellow-400" : "bg-red-400"
                }`} />
                <span className={`text-xs font-mono ${
                  agent.status === "alive" ? "text-green-400" :
                  agent.status === "stale" ? "text-yellow-400" : "text-red-400"
                }`}>
                  {agent.status.toUpperCase()}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-mono leading-relaxed">
              {AGENT_ROLES[agent.name] ?? "Multi-agent system component"}
            </p>
            <div className="text-[10px] text-gray-600 font-mono">
              {agent.last_seen ? `${t.agent_last_seen}: ${timeAgo(agent.last_seen)}` : t.agent_no_heartbeat}
              {agent.age_seconds != null && ` (${agent.age_seconds}s ago)`}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-xs font-mono text-cyan-400/70 uppercase tracking-wider mb-3">Pipeline Flow · 16 Agents</h3>
        <div className="text-[10px] text-gray-500 font-mono mb-1 uppercase tracking-wider">⚽ Football</div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400">
          {[
            "DataCollector", "→", "ModelAgent", "→", "ContextService", "→",
            "AnalystAgent", "→", "StrategistAgent", "→", "RiskManagerAgent", "→", "TraderAgent", "→", "ResultSettlement",
          ].map((item, i) => (
            <span key={i} className={
              item === "→" ? "text-gray-600" :
              item === "ContextService" ? "text-green-300" :
              item === "ResultSettlement" ? "text-emerald-400" :
              "text-cyan-300"
            }>{item}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400 mt-1">
          {["AHCollectorAgent", "→", "AH Odds", "·", "ResearchAgent", "→", "AI Summaries", "·", "MonitorAgent", "→", "Alerts + PSI"].map((item, i) => (
            <span key={i} className={["→", "·"].includes(item) ? "text-gray-600" : "text-fuchsia-300"}>{item}</span>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 font-mono mb-1 mt-3 uppercase tracking-wider">🎾 Tennis</div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400">
          {[
            "TennisDataCollector", "→", "TennisModel", "→", "TennisAnalyst", "→",
            "TennisRiskManager", "→", "TennisTrader", "→", "TennisSettlement",
          ].map((item, i) => (
            <span key={i} className={item === "→" ? "text-gray-600" : "text-amber-300"}>{item}</span>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-gray-600 font-mono">
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


// ─── Partners Tab ─────────────────────────────────────────────────────────────

type PartnerType = "Casino & Sportsbook" | "Sportsbook" | "Exchange" | "Casino" | "Crypto Casino";
type PartnerStatus = "featured" | "active" | "coming_soon" | "in_discussion";

interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  description: string;
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
    description: "Casino e piattaforma di scommesse sportive — partnership in fase di definizione. Integrazione con Agentic Markets per segnali e probabilità calibrate.",
    url: "mailto:info@agenticmarkets.com?subject=Partner%20Inquiry",
    since: "2026",
    logo_initials: "P1",
    logo_color: "from-amber-500 to-orange-600",
    featured: true,
    tags: ["Esclusivo", "Sport", "Casino", "Live"],
  },
];

const PARTNER_STATUS_COLORS: Record<PartnerStatus, string> = {
  featured:      "text-amber-400 border-amber-400/40 bg-amber-400/10",
  active:        "text-green-400 border-green-400/40 bg-green-400/10",
  coming_soon:   "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  in_discussion: "text-gray-400 border-gray-400/30 bg-gray-400/5",
};

function PartnerCard({ p }: { p: Partner }) {
  const t = useT();
  const statusColor = PARTNER_STATUS_COLORS[p.status];
  const partnerName = p.id === "partner-01" ? t.partner_primary_name : p.name;
  const partnerDescription = p.id === "partner-01" ? t.partner_primary_desc : p.description;
  const partnerTags = p.id === "partner-01" ? [t.partner_tag_exclusive, "Sport", "Casino", "Live"] : (p.tags ?? []);
  const statusLabel: Record<PartnerStatus, string> = {
    featured:      t.partners_exclusive_badge,
    active:        t.partners_status_active,
    coming_soon:   t.partners_status_coming,
    in_discussion: t.partners_status_negotiation,
  };
  return (
    <div className={`glass-card p-5 space-y-4 flex flex-col ${p.featured ? "border-amber-400/30" : ""}`}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.logo_color} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
          {p.logo_initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{partnerName}</span>
            {p.featured && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-400/50 text-amber-400 bg-amber-400/10 font-mono uppercase tracking-wider">{t.partners_status_featured}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-mono text-gray-500">{p.type}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${statusColor}`}>{statusLabel[p.status]}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs font-mono text-gray-400 leading-relaxed flex-1">{partnerDescription}</p>

      {/* Tags */}
      {partnerTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {partnerTags.map((tag) => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-500 font-mono">{tag}</span>
          ))}
        </div>
      )}

      {/* Affiliate disclosure — only for real outbound (non-mailto) links */}
      {p.url && !p.url.startsWith("mailto:") && (
        <p className="text-[9px] font-mono text-gray-700 italic">
          {t.partners_affiliate_note}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] font-mono text-gray-600">{t.partners_since} {p.since}</span>
        {p.url ? (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("partner_click", { partner_id: p.id })}
            className="text-[10px] font-mono px-3 py-1 rounded border border-cyan-400/40 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/15 transition-colors"
          >
            {t.partners_visit}
          </a>
        ) : (
          <span className="text-[10px] font-mono text-gray-600 italic">{t.partners_link_soon}</span>
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
  const [form, setForm] = useState({ company: "", site: "", category: "sportsbook" as PartnerCategory, email: "", message: "" });
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const categoryLabels: Record<PartnerCategory, string> = lang === "it"
    ? { sportsbook: "Sportsbook", casino: "Casino", exchange: "Exchange", data_provider: "Data Provider" }
    : { sportsbook: "Sportsbook", casino: "Casino", exchange: "Exchange", data_provider: "Data Provider" };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company || !form.email) return;
    setFormStatus("sending");
    try {
      const res = await fetch("/api/partner-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setFormStatus(res.ok ? "sent" : "error");
    } catch {
      setFormStatus("error");
    }
  };

  const featured = PARTNERS.filter((p) => p.featured);
  const others = PARTNERS.filter((p) => !p.featured);

  return (
    <div className="space-y-8 p-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="eyebrow">{t.partners_eyebrow}</p>
        <h2 className="text-xl font-bold text-white">{t.partners_title}</h2>
        <p className="text-xs font-mono text-gray-500 max-w-lg">{t.partners_desc}</p>
        <p className="text-[10px] font-mono text-gray-600 mt-1">
          {lang === "it"
            ? "I link partner sono relazioni commerciali affiliate. AgenticMarkets riceve compenso per referral qualificati."
            : "Partner links are commercial affiliate relationships. AgenticMarkets receives compensation for qualified referrals."}
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t.partners_active,      value: String(PARTNERS.filter((p) => ["featured", "active"].includes(p.status)).length), color: "text-green-400" },
          { label: t.partners_negotiation, value: String(PARTNERS.filter((p) => p.status === "in_discussion").length), color: "text-amber-300" },
          { label: t.partners_coming,      value: String(PARTNERS.filter((p) => p.status === "coming_soon").length), color: "text-cyan-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3 text-center">
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <div className="space-y-3">
          <div className="text-[9px] font-mono text-amber-400/70 uppercase tracking-widest">{t.partners_section_exclusive}</div>
          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {featured.map((p) => <PartnerCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {/* Others */}
      {others.length > 0 && (
        <div className="space-y-3">
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">{t.partners_section_network}</div>
          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {others.map((p) => <PartnerCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {/* Collaboration form */}
      <div className="operators-collab">
        <div className="operators-collab-head">
          <p className="eyebrow">{lang === "it" ? "Sei un operatore?" : "Are you an operator?"}</p>
          <h4>{t.partners_invite_title}</h4>
          <p>{t.partners_invite_desc}</p>
        </div>
        {formStatus === "sent" ? (
          <div className="operators-sent">
            <span>✓</span>
            <p>{lang === "it" ? "Richiesta inviata. Ti contatteremo entro 48 ore." : "Request sent. We'll contact you within 48 hours."}</p>
          </div>
        ) : (
          <form className="operators-form" onSubmit={handleSubmit}>
            <div className="operators-form-row">
              <label>
                <span>{lang === "it" ? "Azienda / Brand" : "Company / Brand"}</span>
                <input type="text" required value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder={lang === "it" ? "Es. Bet365, PokerStars…" : "e.g. Bet365, PokerStars…"} />
              </label>
              <label>
                <span>{lang === "it" ? "Sito web" : "Website"}</span>
                <input type="url" value={form.site}
                  onChange={(e) => setForm({ ...form, site: e.target.value })}
                  placeholder="https://…" />
              </label>
            </div>
            <div className="operators-form-row">
              <label>
                <span>{lang === "it" ? "Tipo operatore" : "Operator type"}</span>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PartnerCategory })}>
                  {PARTNER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{categoryLabels[c]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Email</span>
                <input type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="partnerships@yoursite.com" />
              </label>
            </div>
            <label>
              <span>{lang === "it" ? "Messaggio (opzionale)" : "Message (optional)"}</span>
              <textarea rows={3} value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={lang === "it" ? "Descrivi brevemente la tua proposta…" : "Briefly describe your proposal…"} />
            </label>
            <button type="submit" className="btn-primary" disabled={formStatus === "sending"}>
              {formStatus === "sending"
                ? (lang === "it" ? "Invio…" : "Sending…")
                : (lang === "it" ? "Invia richiesta di partnership" : "Send partnership request")}
            </button>
            {formStatus === "error" && (
              <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>
                {lang === "it" ? "Errore nell'invio. Riprova." : "Send error. Please try again."}
              </p>
            )}
          </form>
        )}
      </div>
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
    "from-amber-400 to-yellow-500 border-amber-400/40",
    "from-slate-300 to-slate-400 border-slate-300/40",
    "from-amber-700 to-amber-800 border-amber-700/40",
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 className="text-xl font-bold text-white">{copy.title}</h2>
        <p className="text-xs font-mono text-gray-500 max-w-lg">{copy.subtitle}</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-black text-green-400 font-mono">{systemWins}</div>
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{copy.systemWins}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-black text-cyan-400 font-mono">{systemWins * 10}</div>
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{copy.pointsFormula}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-black font-mono text-cyan-400">
            {systemHitRate}%
          </div>
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{copy.systemHitRate}</div>
        </div>
      </div>

      {/* Hall of Fame */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">{lang === "it" ? "Hall of Fame" : "Hall of Fame"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4 space-y-1">
              <div className="text-[10px] font-mono text-yellow-400/70 uppercase tracking-wider">
                {lang === "it" ? "🏆 Top hit rate" : "🏆 Top hit rate"}
              </div>
              {(() => {
                const top = [...entries].sort((a, b) => b.hit_rate - a.hit_rate)[0];
                return top ? (
                  <>
                    <div className="text-sm font-bold text-white truncate">{top.name}</div>
                    <div className="text-lg font-black font-mono text-green-400">
                      {top.hit_rate}%
                    </div>
                    <div className="text-[10px] font-mono text-gray-500">{top.bets_won}W / {top.bets_total}</div>
                  </>
                ) : null;
              })()}
            </div>
            <div className="glass-card p-4 space-y-1">
              <div className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-wider">
                {lang === "it" ? "🔥 Più attivo" : "🔥 Most active"}
              </div>
              {(() => {
                const top = [...entries].sort((a, b) => b.bets_total - a.bets_total)[0];
                return top ? (
                  <>
                    <div className="text-sm font-bold text-white truncate">{top.name}</div>
                    <div className="text-lg font-black font-mono text-cyan-400">{top.bets_total}</div>
                    <div className="text-[10px] font-mono text-gray-500">{lang === "it" ? "scommesse totali" : "total bets"}</div>
                  </>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs font-mono text-gray-500 animate-pulse py-8 text-center">{copy.loading}</div>
      ) : entries.length === 0 ? (
        <div className="text-xs font-mono text-gray-500 py-8 text-center">{copy.noData}</div>
      ) : (
        <>
          {/* Podium */}
          {podium.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {podium.map((e, i) => (
                <div key={e.rank} className={`glass-card p-4 text-center space-y-2 border bg-gradient-to-b ${medalColors[i]}`}>
                  <div className="text-lg">{copy.podiumLabel[i].split(" ")[0]}</div>
                  <div className="text-sm font-bold text-white truncate">{e.name}</div>
                  <div className="text-xl font-black font-mono text-white">{e.points} pt</div>
                  <div className="text-[10px] font-mono text-white/60">{e.bets_won}W · {e.hit_rate}%</div>
                </div>
              ))}
            </div>
          )}

          {/* Full table */}
          {rest.length > 0 && (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500 uppercase tracking-wider">
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
                      className={`border-b border-white/5 hover:bg-white/3 transition-colors ${yourEntry?.rank === e.rank ? "bg-green-400/5 border-green-400/20" : ""}`}
                    >
                      <td className="px-4 py-3 text-gray-500">{e.rank}</td>
                      <td className="px-4 py-3 text-white font-semibold">
                        {e.name}
                        {yourEntry?.rank === e.rank && <span className="ml-2 text-[9px] text-green-400 border border-green-400/40 px-1 py-0.5 rounded">YOU</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-bold">{e.points}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{e.bets_won}/{e.bets_total}</td>
                      <td className="px-4 py-3 text-right text-cyan-400">{e.hit_rate}%</td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell capitalize">{e.sport}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Your rank / opt-in CTA */}
      <div className="glass-card p-5 space-y-2">
        <p className="eyebrow">{copy.yourRank}</p>
        {isOptedIn && yourEntry ? (
          <div className="flex items-center gap-4">
            <div className="text-3xl font-black font-mono text-green-400">#{yourEntry.rank}</div>
            <div>
              <div className="text-sm font-bold text-white">{yourEntry.name}</div>
              <div className="text-xs font-mono text-gray-500">
                {yourEntry.points} {copy.points} · {yourEntry.hit_rate}% {copy.hitRate}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-gray-500">{copy.notOptedIn}</p>
        )}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ history, stats, loading }: {
  history: HistoryMatch[];
  stats: HistoryStats | null;
  loading: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const tz = useTz();
  const liveScores = useLive();
  const [leagueFilter, setLeagueFilter] = useState("ALL");
  const [resultFilter, setResultFilter] = useState("all");

  const allLeagues = [...new Set(history.map((h) => h.league))];

  const filtered = history.filter((h) => {
    if (leagueFilter !== "ALL" && h.league !== leagueFilter) return false;
    if (resultFilter === "bet" && !h.bet_status) return false;
    if (resultFilter === "won" && h.bet_status !== "won") return false;
    if (resultFilter === "lost" && h.bet_status !== "lost") return false;
    if (resultFilter === "no-bet" && h.bet_status) return false;
    return true;
  });

  const getBetOutcomeColor = (h: HistoryMatch) => {
    if (!h.bet_status) return "border-white/10";
    if (h.bet_status === "won") return "border-green-400/30";
    if (h.bet_status === "lost") return "border-red-400/30";
    return "border-yellow-400/20";
  };

  const getModelCorrectness = (h: HistoryMatch) => {
    if (!h.bet_status || h.bet_status === "pending") return null;
    return h.bet_status === "won";
  };

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: t.hist_matches,  value: String(stats.total_matches), color: "text-white" },
            { label: t.hist_bets,     value: String(stats.bets_placed), color: "text-cyan-300" },
            { label: t.hist_won,      value: String(stats.won), color: "text-green-400" },
            { label: t.hist_lost,     value: String(stats.lost), color: "text-red-400" },
            { label: t.hist_hit_rate, value: `${stats.accuracy}%`, color: "text-yellow-400" },
            { label: lang === "it" ? "Acc. modello" : "Model Acc.", value: `${stats.model_accuracy}%`, color: "text-purple-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card p-3 text-center">
              <div className={`text-lg font-black ${kpi.color}`}>{kpi.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "all",    label: t.hist_filter_all },
            { key: "bet",    label: t.hist_filter_with_bet },
            { key: "won",    label: t.hist_filter_won },
            { key: "lost",   label: t.hist_filter_lost },
            { key: "no-bet", label: t.hist_filter_no_bet },
          ].map((f) => (
            <button key={f.key} onClick={() => setResultFilter(f.key)}
              className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
                resultFilter === f.key ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-gray-400 hover:border-cyan-400/40"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {["ALL", ...allLeagues].map((l) => (
            <button key={l} onClick={() => setLeagueFilter(l)}
              className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
                leagueFilter === l ? "border-fuchsia-400 text-fuchsia-300 bg-fuchsia-400/10" : "border-white/10 text-gray-400 hover:border-fuchsia-400/40"
              }`}>
              {LEAGUE_FLAGS[l] ?? ""} {l}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] font-mono text-gray-500">
        <span><span className="inline-block w-3 h-3 rounded-full bg-green-400/50 mr-1 align-middle"></span>{t.hist_legend_won}</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-400/50 mr-1 align-middle"></span>{t.hist_legend_lost}</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-400/50 mr-1 align-middle"></span>{t.hist_legend_pending}</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-gray-600 mr-1 align-middle"></span>{t.hist_legend_no_bet}</span>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-gray-400 font-mono">
          <div className="animate-pulse">{t.hist_loading}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400 font-mono">
          {history.length === 0 ? t.hist_empty : t.no_match_filters}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => {
            const correct = getModelCorrectness(h);
            return (
              <div key={h.match_id} className={`glass-card p-3 ${getBetOutcomeColor(h)}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 font-mono">{LEAGUE_FLAGS[h.league] ?? "⚽"} {h.league}</span>
                      <span className="text-sm font-bold text-white">
                        {h.home_team} <span className="text-gray-500 font-normal text-xs">vs</span> {h.away_team}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono mt-0.5">{fmtKickoff(h.kickoff, lang, tz)}</div>
                  </div>

                  {/* Final / Live score */}
                  {(() => {
                    const ls = liveScores[h.match_id];
                    const homeScore = ls?.home_score ?? h.home_score;
                    const awayScore = ls?.away_score ?? h.away_score;
                    const status = ls?.match_status ?? h.match_status;
                    if (homeScore == null || awayScore == null) return null;
                    const isLiveNow = status === "IN_PLAY" || status === "PAUSED";
                    const actual = homeScore > awayScore ? "HOME" : homeScore < awayScore ? "AWAY" : "DRAW";
                    const correct = h.best_selection != null && h.best_selection === actual;
                    return (
                      <div className={`hist-score shrink-0 ${isLiveNow ? "live" : ""}`}>
                        {isLiveNow && <span className="live-badge blink">● LIVE</span>}
                        <span className="hist-score-val">{homeScore} — {awayScore}</span>
                        {!isLiveNow && h.best_selection && (
                          <span className={`live-verdict ${correct ? "correct" : "wrong"}`}>
                            {correct ? "✓" : "✗"}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Model prediction */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-600 font-mono">{t.hist_model_pred}</div>
                      <div className="text-xs font-mono text-cyan-300">{h.best_selection ?? "—"}</div>
                      {h.edge != null && (
                        <div className={`text-[10px] font-mono ${h.edge > 0 ? "text-green-500" : "text-gray-500"}`}>
                          edge {h.edge > 0 ? "+" : ""}{(h.edge * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bet info + result */}
                  <div className="flex items-center gap-2 shrink-0">
                    {h.bet_status ? (
                      <div className="text-right">
                        <div className="text-[10px] text-gray-600 font-mono">
                          Bet: {h.bet_selection} @ {h.bet_odds?.toFixed(2)}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <StatusBadge status={h.bet_status} />
                          {correct !== null && (
                            <span className={`text-[10px] font-mono ${correct ? "text-green-400" : "text-red-400"}`}>
                              {correct ? t.hist_model_correct : t.hist_model_wrong}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600 font-mono">{t.hist_no_bet}</span>
                    )}
                  </div>
                </div>

                {/* Probability mini-bar */}
                <div className="flex gap-1 mt-2">
                  {[
                    { label: "H", p: h.p_home, color: "bg-cyan-400" },
                    { label: "D", p: h.p_draw, color: "bg-yellow-400" },
                    { label: "A", p: h.p_away, color: "bg-fuchsia-400" },
                  ].map(({ label, p, color }) => (
                    <div key={label} className="flex items-center gap-1 flex-1">
                      <span className="text-[9px] text-gray-600 font-mono w-3">{label}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-1 overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(p * 100)}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-600 font-mono w-6 text-right">{Math.round(p * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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

// ─── Unified Bets Tab ─────────────────────────────────────────────────────────

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
      <PublicOldBetsPanel history={visibleHistory} stats={historyStats} loading={historyLoading} />
    </>
  );
}

// ─── GDPR Cookie Consent Banner ──────────────────────────────────────────────

function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const lang = useLang();
  useEffect(() => {
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

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("bets");
  const [uiLanguage, setUiLanguage] = useState<Lang>(() => {
    if (typeof window === "undefined") return "it";
    const stored = window.localStorage.getItem("agentic-lang") as Lang | null;
    return stored && LANGUAGES.includes(stored) ? stored : "it";
  });
  const toggleLanguage = () => {
    const next: Lang = LANGUAGES[(LANGUAGES.indexOf(uiLanguage) + 1) % LANGUAGES.length];
    setUiLanguage(next);
    localStorage.setItem("agentic-lang", next);
    trackEvent("language_change", { language: next });
  };
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [storedProfiles, setStoredProfiles] = useState<ClientProfile[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<ClientAuthIntent>("login");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PublicPlanKey | null>(null);
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
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(true);
  const [tennisLoading, setTennisLoading] = useState(true);
  const [predStale, setPredStale] = useState(false);
  const [predFallback, setPredFallback] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const [userTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome");
  useEffect(() => { trackEvent("page_view"); }, []);
  useEffect(() => {
    if (tab === "client-area") trackEvent("plan_view");
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
            if (!prev) return prev;
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
    })();
    return () => { cancelled = true; };
  }, []);

  const saveClientProfile = (profile: ClientProfile) => {
    const normalizedProfile = { ...profile, email: profile.email.trim().toLowerCase() };
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

  const handleCheckoutConfirm = async (txHash: string) => {
    if (!clientProfile || !checkoutPlan) return;
    const { txHash: _tx, requestedPlan: _rp, ...rest } = clientProfile;
    // Submitting a tx_hash does NOT unlock access. The server moves the profile to
    // 'pending_payment' until payment is confirmed; the client mirrors that waiting state.
    try {
      const resp = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "checkout", requested_plan: checkoutPlan, tx_hash: txHash }),
      });
      if (resp.ok) {
        const server = await resp.json() as { plan?: ClientProfile["plan"] };
        saveClientProfile({ ...rest, plan: server.plan ?? "pending_payment", txHash, requestedPlan: checkoutPlan });
      } else {
        saveClientProfile({ ...rest, plan: "pending_payment", txHash, requestedPlan: checkoutPlan });
      }
    } catch {
      saveClientProfile({ ...rest, plan: "pending_payment", txHash, requestedPlan: checkoutPlan });
    }
    trackEvent("conversion", { plan: checkoutPlan, meta: { tx: txHash } });
    setCheckoutOpen(false);
    setCheckoutPlan(null);
    setTab("bets");
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
    setTab("bets");
    requestAnimationFrame(() => {
      document.getElementById("client-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/predictions", { method: "POST" });
      await Promise.all([fetchPredictions(), fetchTennis(), fetchHistory()]);
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
      void fetchPredictions();
      void fetchAgents();
      void fetchTennis();
      void fetchHistory();
      void fetchLive();
    });
    const dataInt = setInterval(fetchData, 30_000);
    const predInt = setInterval(fetchPredictions, 3_600_000);
    const agentInt = setInterval(fetchAgents, 60_000);
    const tennisInt = setInterval(fetchTennis, 120_000);
    const liveInt = setInterval(fetchLive, 60_000);
    return () => { clearInterval(dataInt); clearInterval(predInt); clearInterval(agentInt); clearInterval(tennisInt); clearInterval(liveInt); };
  }, [fetchData, fetchPredictions, fetchAgents, fetchTennis, fetchHistory, fetchLive]);

  const valueBets = predictions.filter(isFootballBestBet);
  const hasClientProfile = Boolean(clientProfile);
  const isClientUnlocked = profileHasAccess(clientProfile);
  const isSignalPreviewUnlocked = profileHasSignalPreview(clientProfile);
  const isFreeClient = clientProfile?.plan === "free";
  const tennisValueBets = tennisMatches.filter(isTennisBestBet);
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
    { tab: "client-area", label: uiLanguage === "it" ? "Client Area" : "Client Area", value: clientProfile ? (isClientUnlocked ? "PRO" : clientProfile.plan === "free" ? "FREE" : "SETUP") : "LOGIN" },
    { tab: "history",      label: tNav.nav_history },
    { tab: "leaderboard", label: uiLanguage === "it" ? "Classifica" : "Leaderboard" },
    { tab: "partners",    label: tNav.nav_partner },
    { tab: "settings",    label: uiLanguage === "it" ? "Impostazioni" : "Settings" },
    { tab: "assistance",  label: uiLanguage === "it" ? "Assistenza" : "Assistance" },
    { tab: "faq",         label: "FAQ" },
  ];

  const tUI = TRANSLATIONS[uiLanguage];

  return (
    <LanguageCtx.Provider value={uiLanguage}>
    <TzCtx.Provider value={userTz}>
    <LiveCtx.Provider value={liveScores}>
    <main className="portal-root">
      <CookieBanner />

      {/* ── Top banner ── */}
      <div className="portal-top-banner" style={{ visibility: "hidden", height: 0, overflow: "hidden", padding: 0 }} />

      {/* ── Brand row ── */}
      <div className="portal-brand-row">
        <div>
          <div className="brand-name">AgenticMarkets</div>
          <div className="brand-tagline">Bets the Future · Predictive Intelligence for Sports Markets</div>
        </div>
        <div className="portal-brand-actions">
          {clientProfile ? (
            <button className="client-access-button" onClick={() => setTab("client-area")}>
              {clientProfile.name} · {isClientUnlocked ? "Signal Desk Pro" : clientProfile.plan === "free" ? "Free" : "Setup"}
            </button>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => openAuth("login")}>
                {uiLanguage === "it" ? "Accedi" : "Sign In"}
              </button>
              <button className="btn-primary" onClick={() => openAuth("create")}>
                {uiLanguage === "it" ? "Registrati" : "Register / Get Access"}
              </button>
            </>
          )}
          <button className="lang-toggle" onClick={toggleLanguage}>{uiLanguage.toUpperCase()}</button>
        </div>
      </div>

      {/* ── 3-column layout ── */}
      <div className="portal-columns">

        {/* Left ad column — Operator B2B */}
        <aside className="portal-ad-col left">
          <div className="portal-ad-slot" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <p className="ad-eyebrow">Operator</p>
            <div className="ad-name" style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 700, lineHeight: 1.3 }}>API Access</div>
            <div className="ad-desc" style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.5 }}>
              {uiLanguage === "it" ? "Integra le probabilità calibrate nella tua piattaforma. Modello Dixon-Coles + xG via REST API." : "Integrate calibrated probabilities into your platform. Dixon-Coles + xG model via REST API."}
            </div>
            <a href="mailto:info@agenticmarkets.com?subject=Operator%20API%20Access"
              className="text-[10px] font-mono px-3 py-1.5 rounded border border-cyan-400/40 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/15 transition-colors text-center block mt-1"
              onClick={() => trackEvent("operator_sidebar_click", {})}>
              {uiLanguage === "it" ? "Richiedi accesso →" : "Request access →"}
            </a>
          </div>
          <div className="portal-ad-slot tall" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <p className="ad-eyebrow" style={{ color: "#64748b", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em" }}>B2B</p>
            <div className="ad-name" style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 700, lineHeight: 1.3 }}>White-label Desk</div>
            <div className="ad-desc" style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.5 }}>
              {uiLanguage === "it" ? "Un signal desk col tuo brand sul tuo dominio. Reporting dati incluso." : "A branded signal desk on your domain. Full data reporting included."}
            </div>
            <button type="button" onClick={() => { setTab("partners"); trackEvent("operator_b2b_click", {}); }}
              className="text-[10px] font-mono px-3 py-1.5 rounded border border-fuchsia-400/40 text-fuchsia-400 bg-fuchsia-400/5 hover:bg-fuchsia-400/15 transition-colors text-center mt-1 w-full">
              {uiLanguage === "it" ? "Partner Program →" : "Partner Program →"}
            </button>
          </div>
        </aside>

        {/* ── Desk (nav + content) ── */}
        <div className="portal-desk">
          <section className="book-layout">
            <aside className="sports-rail">
              <div className="rail-title">DESK</div>
              {navItems.map((item) => (
                <button
                  key={item.tab}
                  className={`rail-item ${tab === item.tab ? "is-active" : ""} ${item.tone ?? ""}`}
                  onClick={() => { setTab(item.tab); trackEvent("tab_click", { meta: { tab: item.tab } }); }}
                >
                  <span>{item.label}</span>
                  {item.value && <strong>{item.value}</strong>}
                </button>
              ))}
              <button className="rail-refresh" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? "..." : tUI.refresh_odds}
              </button>
            </aside>

        <section className="book-main">
          <div className="book-main-head">
            <div>
              <p className="eyebrow">Agentic Markets</p>
              <h2>{navItems.find((n) => n.tab === tab)?.label ?? "Bets"}</h2>
            </div>
            <div className="book-head-kpis">
              <span>{predictions.length + tennisMatches.length} {tUI.kpi_events}</span>
              <span>{valueBets.length + tennisValueBets.length} {tUI.kpi_ev}</span>
            </div>
          </div>

          {predFallback && tab === "bets" && (
            <div className="flex items-center gap-3 mx-4 mt-2 mb-0 px-3 py-2 rounded-lg border border-amber-400/30 bg-amber-400/5 text-xs font-mono text-amber-400">
              <span>⚽ {uiLanguage === "it" ? "Stagione in pausa — nessuna partita programmata nelle prossime 48h. Le prediction tornano automaticamente con la ripresa delle leghe (luglio 2026)." : "Season pause — no fixtures in the next 48h. Predictions return automatically when leagues resume (July 2026)."}</span>
            </div>
          )}
          {tab === "bets" && (
            <UnifiedBetsTab
              predictions={predictions}
              tennisMatches={tennisMatches}
              history={history}
              historyStats={historyStats}
              historyLoading={historyLoading}
              onSelect={(s) => setSlipSelection(s)}
              onBetNow={() => setTab("partners")}
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
          {tab === "client-area" && (
            <ClientAreaTab
              profile={clientProfile}
              onOpenDesk={() => setTab("bets")}
              onPaymentSubmit={submitCryptoPayment}
              onActivateFree={activateFreePlan}
              onLogout={logoutClientProfile}
            />
          )}
          {tab === "settings" && (
            <SettingsTab
              profile={clientProfile}
              onUnlock={() => openAuth("login")}
              onSave={saveClientProfile}
            />
          )}
          {tab === "assistance" && <AssistanceTab />}
          {tab === "faq" && <FAQTab />}
          {tab === "history" && (
            <HistoryTab history={history} stats={historyStats} loading={historyLoading} />
          )}
          {tab === "leaderboard" && (
            <LeaderboardTab
              clientName={clientProfile?.name}
              isOptedIn={clientProfile?.leaderboardOptIn ?? false}
            />
          )}
          {tab === "partners" && <PartnersTab />}
        </section>
        </section>{/* end book-layout */}
        </div>{/* end portal-desk */}

        {/* Right ad column — Sportsbook affiliate */}
        <aside className="portal-ad-col right">
          <div className="portal-ad-slot" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <p className="ad-eyebrow">Sportsbook</p>
            <div className="ad-name" style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 700, lineHeight: 1.3 }}>
              {uiLanguage === "it" ? "Gioca informato" : "Bet Smarter"}
            </div>
            <div className="ad-desc" style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.5 }}>
              {uiLanguage === "it" ? "Le nostre probabilità sono calibrate per i bookmaker partner. Confronta le quote prima di giocare." : "Our probabilities are calibrated for partner sportsbooks. Compare odds before you play."}
            </div>
            <button type="button" onClick={() => { setTab("partners"); trackEvent("sportsbook_sidebar_click", {}); }}
              className="text-[10px] font-mono px-3 py-1.5 rounded border border-amber-400/40 text-amber-400 bg-amber-400/5 hover:bg-amber-400/15 transition-colors text-center block mt-1 w-full">
              {uiLanguage === "it" ? "Vedi partner →" : "View partners →"}
            </button>
          </div>
          <div className="portal-ad-slot tall" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <p className="ad-eyebrow" style={{ color: "#64748b", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{uiLanguage === "it" ? "Esclusivo" : "Exclusive"}</p>
            <div className="ad-name" style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 700, lineHeight: 1.3 }}>Partner Sportsbook</div>
            <div className="ad-desc" style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.5 }}>
              {uiLanguage === "it" ? "Integrazione partner ufficiale in arrivo. Quote migliori, payout veloci." : "Official partner integration coming soon. Best odds, fastest payouts."}
            </div>
            <span className="text-[9px] font-mono px-2 py-1 rounded border border-cyan-400/30 text-cyan-500 bg-cyan-400/5 text-center mt-1 block">
              {uiLanguage === "it" ? "In arrivo" : "Coming Soon"}
            </span>
          </div>
        </aside>

      </div>{/* end portal-columns */}

      {/* ── Bottom banner ── */}
      <div className="portal-bottom-banner" style={{ visibility: "hidden", height: 0, overflow: "hidden", padding: 0 }} />

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
    </LiveCtx.Provider>
    </TzCtx.Provider>
    </LanguageCtx.Provider>
  );
}
