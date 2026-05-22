"use client";

import { useEffect, useState, useCallback, useRef, createContext, useContext } from "react";

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
    preaccess_s2_title: "Scegli piano", preaccess_s2_desc: "Base per segnali manuali, Premium per agenti automatici.",
    preaccess_s3_title: "Invia USDT", preaccess_s3_desc: "Il wallet compare solo dentro il checkout cliente.",
    preaccess_s4_title: "Sblocca desk", preaccess_s4_desc: "Dati reali visibili solo dopo piano attivo o approval interno.",
    preaccess_base_desc: "Best bets, edge e spiegazioni",
    preaccess_premium_desc: "Agenti automatici con execution live",
    // Auth modal
    auth_eyebrow: "Client access",
    auth_login_title: "Login Signal Desk",
    auth_create_title: "Crea il tuo profilo Signal Desk",
    auth_login_sub: "Accedi con l'email usata per il tuo profilo cliente.",
    auth_create_sub: "Crea il profilo, poi scegli Base o Premium per sbloccare i dati.",
    auth_name_label: "Nome", auth_name_placeholder: "Il tuo nome",
    auth_not_found: "Profilo non trovato. Crea un profilo cliente per continuare.",
    auth_create_btn: "Continue to plans",
    auth_footer: "Base e Premium sono crypto-only. I dati prediction restano bloccati finché il piano non è attivo.",
    // Plans
    plans_eyebrow: "Client plans",
    plans_title: "Due livelli, una sola esperienza",
    plans_subtitle: "Il piano Base mostra i migliori bet e il razionale. Il Premium sblocca gli agenti che eseguono da soli, con risk control e execution verificata.",
    plans_cta: "View live edges",
    plans_base_desc: "Per il cliente che vuole vedere le migliori opportunità, capire il perché e decidere se entrare.",
    plans_base_core: "Ti mostro cosa fare", plans_base_sub: "Decisione finale al cliente",
    plans_base_f1: "Best bets ordinati per edge, confidenza e quota",
    plans_base_f2: "Spiegazione del razionale modello per ogni bet",
    plans_base_f3: "Probabilità modello vs quota di mercato",
    plans_base_f4: "Storico dei suggerimenti e performance",
    plans_base_f5: "Notifiche quando esce un nuovo value bet",
    plans_base_f6: "Bet automatici degli agenti",
    plans_base_f7: "Stake sizing automatico live",
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
    plans_flow3_title: "Decide", plans_flow3_desc: "Base: il cliente decide. Premium: l'agente esegue.",
    plans_flow4_title: "Execute", plans_flow4_desc: "Live solo con bet ID verificato sul conto reale.",
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
    board_football_empty: "Football markets loading. Hit refresh if the board stays empty.",
    board_tennis_empty: "Tennis markets loading. Fallback data appears when API is ready.",
    // Profile panel
    profile_upgrade_eyebrow: "Passa a Pro",
    profile_upgrade_title: "Autopilot Agents",
    profile_upgrade_desc: "Sblocca agenti automatici, stake sizing, stop loss e live execution verificata sul tuo conto exchange.",
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
    checkout_tx_label: "TX Hash",
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
    summary_session_pnl: "P&L Sessione", summary_football_edge: "Football Edge",
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
    locked_plan_desc: "Il profilo è attivo, ma prediction, edge e spiegazioni si sbloccano solo dopo aver selezionato Base o Premium.",
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
    partners_since: "Partner dal", partners_visit: "Visita →", partners_link_soon: "Link in arrivo",
    partners_status_active: "Attivo", partners_status_featured: "⭐ In Evidenza",
    partners_status_negotiation: "In Trattativa", partners_status_coming: "Coming Soon",
    partners_exclusive_badge: "Partner Esclusivo",
    // Portfolio/Bets/Agents premium gates
    gate_eyebrow: "Piano Premium", gate_portfolio_title: "Portfolio live",
    gate_portfolio_desc: "Il portfolio live, il grafico equity e il P&L dettagliato per sport sono disponibili solo con il Piano Premium.",
    gate_bets_title: "Execution log",
    gate_bets_desc: "Il log scommesse degli agenti è disponibile solo con il Piano Premium. Il tuo conto exchange viene collegato durante l'onboarding Premium e le bet vengono piazzate automaticamente dagli agenti.",
    gate_agents_title: "Status agenti",
    gate_agents_desc: "Il monitor degli agenti è disponibile solo con il Piano Premium. Mostra heartbeat, errori e stato di ogni agente del tuo conto.",
    gate_upgrade_btn: "Passa a Premium",
    // Footer
    footer_note: "Sportsbook Edge Desk · solo execution verificata · interfaccia client-grade",
    // History
    hist_matches: "Partite", hist_bets: "Scommesse", hist_won: "Vinte", hist_lost: "Perse",
    hist_hit_rate: "Hit Rate", hist_roi: "ROI", hist_return: "Ritorno",
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
    partner_primary_name: "Partner Principale",
    partner_primary_desc: "Casino e piattaforma di scommesse sportive — partner esclusivo del progetto. Integrazione diretta con Agentic Markets per segnali e edge calcolati in tempo reale.",
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
    preaccess_s2_title: "Choose plan", preaccess_s2_desc: "Base for manual signals, Premium for automated agents.",
    preaccess_s3_title: "Send USDT", preaccess_s3_desc: "Wallet address appears only inside the client checkout.",
    preaccess_s4_title: "Unlock desk", preaccess_s4_desc: "Live data visible only after plan is active or internal approval.",
    preaccess_base_desc: "Best bets, edge & explanations",
    preaccess_premium_desc: "Automated agents with live execution",
    // Auth modal
    auth_eyebrow: "Client access",
    auth_login_title: "Login Signal Desk",
    auth_create_title: "Create your Signal Desk profile",
    auth_login_sub: "Sign in with the email used for your client profile.",
    auth_create_sub: "Create your profile, then choose Base or Premium to unlock data.",
    auth_name_label: "Name", auth_name_placeholder: "Your name",
    auth_not_found: "Profile not found. Create a client profile to continue.",
    auth_create_btn: "Continue to plans",
    auth_footer: "Base and Premium are crypto-only. Prediction data stays locked until a plan is active.",
    // Plans
    plans_eyebrow: "Client plans",
    plans_title: "Two tiers, one experience",
    plans_subtitle: "The Base plan shows the best bets and the rationale. Premium unlocks agents that execute autonomously, with risk control and verified execution.",
    plans_cta: "View live edges",
    plans_base_desc: "For the client who wants to see the best opportunities, understand the reasoning and decide whether to enter.",
    plans_base_core: "I show you what to do", plans_base_sub: "Final decision is yours",
    plans_base_f1: "Best bets ranked by edge, confidence and odds",
    plans_base_f2: "Model rationale explained for each bet",
    plans_base_f3: "Model probability vs market odds",
    plans_base_f4: "History of suggestions and performance",
    plans_base_f5: "Notifications when a new value bet appears",
    plans_base_f6: "Automated agent bets",
    plans_base_f7: "Live automatic stake sizing",
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
    plans_flow3_title: "Decide", plans_flow3_desc: "Base: client decides. Premium: agent executes.",
    plans_flow4_title: "Execute", plans_flow4_desc: "Live only with verified bet ID on real account.",
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
    board_football_empty: "Football markets loading. Hit refresh if the board stays empty.",
    board_tennis_empty: "Tennis markets loading. Fallback data appears when API is ready.",
    // Profile panel
    profile_upgrade_eyebrow: "Upgrade to Pro",
    profile_upgrade_title: "Autopilot Agents",
    profile_upgrade_desc: "Unlock automated agents, stake sizing, stop loss and verified live execution on your exchange account.",
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
    checkout_tx_label: "TX Hash",
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
    summary_session_pnl: "Session P&L", summary_football_edge: "Football Edge",
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
    locked_plan_desc: "Your profile is active, but predictions, edge and explanations unlock only after choosing Base or Premium.",
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
    partners_since: "Partner since", partners_visit: "Visit →", partners_link_soon: "Link coming soon",
    partners_status_active: "Active", partners_status_featured: "⭐ Featured",
    partners_status_negotiation: "In Negotiation", partners_status_coming: "Coming Soon",
    partners_exclusive_badge: "Exclusive Partner",
    // Portfolio/Bets/Agents premium gates
    gate_eyebrow: "Premium Plan", gate_portfolio_title: "Live portfolio",
    gate_portfolio_desc: "The live portfolio, equity chart and detailed P&L by sport are available with the Premium Plan only.",
    gate_bets_title: "Execution log",
    gate_bets_desc: "The agent bet log is available with the Premium Plan only. Your exchange account is linked during Premium onboarding and bets are placed automatically by agents.",
    gate_agents_title: "Agent status",
    gate_agents_desc: "The agent monitor is available with the Premium Plan only. Shows heartbeat, errors and status of every agent on your account.",
    gate_upgrade_btn: "Upgrade to Premium",
    // Footer
    footer_note: "Sportsbook Edge Desk · verified execution only · client-grade interface",
    // History
    hist_matches: "Matches", hist_bets: "Bets Placed", hist_won: "Won", hist_lost: "Lost",
    hist_hit_rate: "Hit Rate", hist_roi: "ROI", hist_return: "Return",
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
    partner_primary_name: "Primary Partner",
    partner_primary_desc: "Casino and sportsbook platform — exclusive project partner. Direct integration with Agentic Markets for real-time signals and edge calculations.",
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
  },
} as const;

const TRANSLATIONS = {
  ...BASE_TRANSLATIONS,
  ...EXTRA_TRANSLATIONS,
} as const;

type Lang = keyof typeof TRANSLATIONS;
const LANGUAGES: Lang[] = ["it", "en", "es", "fr", "ru"];
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
  pnl: number;
  win_rate: string;
  avg_odds: string;
  avg_stake: string;
}

interface Bet {
  id: number;
  match_external_id: string;
  selection: string;
  odds: number;
  stake: number;
  paper: boolean;
  status: string;
  profit_loss: number | null;
  betfair_bet_id?: string | null;
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

interface LeaguePnl {
  league: string;
  total: number;
  won: number;
  lost: number;
  pnl: number;
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
  bet_stake: number | null;
  bet_odds: number | null;
}

interface HistoryStats {
  total_matches: number;
  bets_placed: number;
  won: number;
  lost: number;
  pending: number;
  accuracy: string;
  roi: string;
  model_accuracy: string;
  total_return: string;
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
  elo_raw_p1?: number | null;
  elo_raw_p2?: number | null;
}

interface TennisSummary {
  total_today: number;
  value_bets: number;
  markets_active: number;
  pnl: number;
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
  stake: number;
  paper: boolean;
  status: string;
  profit_loss: number | null;
  placed_at: string;
  settled_at?: string | null;
  betfair_bet_id: string | null;
  tournament: string | null;
  surface: string | null;
  player1: string | null;
  player2: string | null;
  scheduled_at: string | null;
}

type PortfolioBet = {
  id: string;
  sport: "Football" | "Tennis";
  event: string;
  selection: string;
  odds: number;
  stake: number;
  status: string;
  profitLoss: number;
  placedAt: string;
  settledAt: string | null;
};

type ClientProfile = {
  name: string;
  email: string;
  plan: "free" | "unpaid" | "pending_payment" | "base" | "premium" | "admin_full";
  language?: Lang;
  timezone?: string;
  txHash?: string;
  requestedPlan?: "base" | "premium";
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

const USDT_TRC20_ADDRESS = "TDUeCx7BBVySkZ8M9eC5Cocq87K2TcmkRf";
const PLAN_CONFIG = {
  base: {
    eur: Number(process.env.NEXT_PUBLIC_BASE_PLAN_EUR ?? 29),
    label: "Level 1 · Signal Desk",
    envKey: "NEXT_PUBLIC_BASE_PLAN_EUR",
  },
  premium: {
    eur: Number(process.env.NEXT_PUBLIC_PREMIUM_PLAN_EUR ?? 199),
    label: "Level 2 · Autopilot Agents",
    envKey: "NEXT_PUBLIC_PREMIUM_PLAN_EUR",
  },
} as const;
type PlanKey = keyof typeof PLAN_CONFIG;

function planPriceCopy(plan: PlanKey, lang: Lang) {
  const amount = PLAN_CONFIG[plan].eur;
  const suffix = lang === "it" ? "mese" : "month";
  return amount > 0 ? `€${amount}/${suffix}` : "Configured at checkout";
}
const CLIENT_PROFILE_KEY = "agentic-client-profile";
const CLIENT_PROFILES_KEY = "agentic-client-profiles";
const PRIVATE_BALANCE_PLACEHOLDER = "LOCK";
const EMPTY_SUMMARY: Summary = {
  total_bets: 0,
  won: 0,
  lost: 0,
  pending: 0,
  pnl: 0,
  win_rate: "0.0",
  avg_odds: "0.00",
  avg_stake: "0.00",
};
const EMPTY_TENNIS_BET_SUMMARY: TennisBetSummary = {
  total: 0,
  won: 0,
  lost: 0,
  pending: 0,
  pnl: 0,
};

interface TennisBetSummary {
  total: number;
  won: number;
  lost: number;
  pending: number;
  pnl: number;
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
  previewLimit,
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  onSelect: (selection: SlipSelection) => void;
  onBetNow?: () => void;
  previewLimit?: number;
}) {
  const [sportFilter, setSportFilter] = useState<"all" | "football" | "tennis">("all");
  const [signalFilter, setSignalFilter] = useState<"all" | "value">("value");
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
    .slice(0, previewLimit ?? (signalFilter === "value" ? BEST_BETS_CAP : Number.POSITIVE_INFINITY));

  const tennisRows = sortTennis(tennisMatches
    .filter((m) => sportFilter !== "football")
    .filter((m) => isTennisMarketVisible(m.scheduled))
    .filter((m) => signalFilter === "all" || isTennisBestBet(m))
    .filter((m) => competitionFilter === "all" || competitionFilter === `tennis:${m.tournament}`)
    .filter((m) => surfaceFilter === "all" || m.surface === surfaceFilter)
    .filter((m) => !query || `${m.player1} ${m.player2} ${m.tournament} ${m.surface}`.toLowerCase().includes(query)))
    .slice(0, previewLimit ?? (signalFilter === "value" ? BEST_BETS_CAP : Number.POSITIVE_INFINITY));

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
          {showFootballSection && (
            <section className="market-section">
              <div className="market-section-title">
                <span>{t.board_football}</span>
                <em>{footballRows.length} {t.board_markets} · {footballValue.length} {t.board_value}</em>
              </div>
              {footballRows.length ? (
                <div className="market-list">
                  {footballRows.map((p) => <PredictionCard key={p.match_id} p={p} onSelect={onSelect} onBetNow={onBetNow} />)}
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
                  {tennisRows.map((m) => <TennisMatchCard key={m.id} m={m} onSelect={onSelect} onBetNow={onBetNow} />)}
                </div>
              ) : (
                <div className="book-empty">{t.board_tennis_empty}</div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BestBetsBoard({
  predictions,
  tennisMatches,
  onSelect,
  onBetNow,
  previewLimit,
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  onSelect: (selection: SlipSelection) => void;
  onBetNow?: () => void;
  previewLimit?: number;
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
  };
  const sortFootballBest = (rows: Prediction[]) => rows.sort((a, b) => (
    sortMode === "time"
      ? new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      : sortMode === "edge"
        ? (b.edge ?? 0) - (a.edge ?? 0)
      : selectedFootballProbability(b) - selectedFootballProbability(a)
  ));
  const sortTennisBest = (rows: TennisMatch[]) => rows.sort((a, b) => (
    sortMode === "time"
      ? new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime()
      : sortMode === "edge"
        ? (b.edge ?? 0) - (a.edge ?? 0)
      : selectedTennisProbability(b) - selectedTennisProbability(a)
  ));
  const footballValue = predictions
    .filter(isFootballBestBet)
    .filter((p) => sportFilter !== "tennis")
    .filter((p) => !query || `${p.home_team} ${p.away_team} ${p.league_name} ${p.league}`.toLowerCase().includes(query));
  const tennisValue = tennisMatches
    .filter(isTennisBestBet)
    .filter((m) => sportFilter !== "football")
    .filter((m) => !query || `${m.player1} ${m.player2} ${m.tournament} ${m.surface}`.toLowerCase().includes(query));
  const visibleFootballValue = sortFootballBest([...footballValue])
    .slice(0, previewLimit ?? 21);
  const visibleTennisValue = sortTennisBest([...tennisValue])
    .slice(0, previewLimit ?? 21);
  const totalValue = visibleFootballValue.length + visibleTennisValue.length;

  return (
    <div className="sportsbook-board best-bets-board">
      <div className="board-subhead">
        <span>{labels.showing} {totalValue} +EV</span>
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
                <em>{visibleFootballValue.length} {t.board_value}</em>
              </div>
              <div className="market-list">
                {visibleFootballValue.map((p) => <PredictionCard key={p.match_id} p={p} onSelect={onSelect} onBetNow={onBetNow} />)}
              </div>
            </section>
          )}

          {visibleTennisValue.length > 0 && (
            <section className="market-section">
              <div className="market-section-title amber">
                <span>{t.board_tennis}</span>
                <em>{visibleTennisValue.length} {t.board_value}</em>
              </div>
              <div className="market-list">
                {visibleTennisValue.map((m) => <TennisMatchCard key={m.id} m={m} onSelect={onSelect} onBetNow={onBetNow} />)}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="book-empty">
          {lang === "it"
            ? "Nessun best bet attivo ora. Le predizioni complete restano nella scheda Sports."
            : "No active best bets right now. Full predictions remain available in the Sports tab."}
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

function ClientInsightStrip({
  summary,
  predictions,
  tennisMatches,
  bets,
  computedAt,
  tennisComputedAt,
}: {
  summary: Summary | null;
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  bets: Bet[];
  computedAt: string | null;
  tennisComputedAt: string | null;
}) {
  const footballValue = predictions.filter(isFootballBestBet).length;
  const tennisValue = tennisMatches.filter(isTennisBestBet).length;
  const liveConfirmed = bets.filter((b) => !b.paper && Boolean(b.betfair_bet_id)).length;
  const rejected = bets.filter((b) => FAILED_STATUSES.includes(b.status)).length;
  const pnl = summary?.pnl ?? 0;

  const t = useT();
  return (
    <section className="client-summary-strip" aria-label="Client desk summary">
      <div>
        <span className="metric-label">{t.summary_session_pnl}</span>
        <strong className={pnl >= 0 ? "text-green-300" : "text-red-300"}>{`${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`}</strong>
        <em>{summary?.pending ?? 0} {t.summary_pending_bets}</em>
      </div>
      <div>
        <span className="metric-label">{t.summary_football_edge}</span>
        <strong>{footballValue}</strong>
        <em>{computedAt ? `updated ${timeAgo(computedAt)}` : t.summary_waiting_markets}</em>
      </div>
      <div>
        <span className="metric-label">{t.summary_tennis_signals}</span>
        <strong>{tennisValue}</strong>
        <em>{tennisComputedAt ? `updated ${timeAgo(tennisComputedAt)}` : t.summary_signal_active}</em>
      </div>
      <div>
        <span className="metric-label">{t.summary_exec_quality}</span>
        <strong>{liveConfirmed}</strong>
        <em>{rejected ? `${rejected} ${t.summary_blocked}` : t.summary_id_required}</em>
      </div>
    </section>
  );
}

function money(value: number) {
  return `€${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function betEventName(bet: Bet) {
  if (bet.home_team && bet.away_team) return `${bet.home_team} vs ${bet.away_team}`;
  return bet.match_external_id || `Bet #${bet.id}`;
}

function buildPortfolioBets(bets: Bet[], tennisBets: TennisBet[]): PortfolioBet[] {
  const football: PortfolioBet[] = bets
    .filter((bet) => ["pending", "won", "lost"].includes(bet.status))
    .map((bet) => ({
      id: `football-${bet.id}`,
      sport: "Football",
      event: betEventName(bet),
      selection: bet.selection,
      odds: Number(bet.odds || 0),
      stake: Number(bet.stake || 0),
      status: bet.status,
      profitLoss: Number(bet.profit_loss || 0),
      placedAt: bet.placed_at,
      settledAt: bet.settled_at || null,
    }));

  const tennis: PortfolioBet[] = tennisBets
    .filter((bet) => ["pending", "won", "lost"].includes(bet.status))
    .map((bet) => ({
      id: `tennis-${bet.id}`,
      sport: "Tennis",
      event: bet.player1 && bet.player2 ? `${bet.player1} vs ${bet.player2}` : bet.match_id,
      selection: bet.player_name || bet.selection,
      odds: Number(bet.odds || 0),
      stake: Number(bet.stake || 0),
      status: bet.status,
      profitLoss: Number(bet.profit_loss || 0),
      placedAt: bet.placed_at,
      settledAt: bet.settled_at || null,
    }));

  return [...football, ...tennis].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
}

function buildEquityPoints(portfolioBets: PortfolioBet[], startingBalance: number) {
  const settled = portfolioBets
    .filter((bet) => bet.status !== "pending" && bet.profitLoss !== 0)
    .sort((a, b) => new Date(a.settledAt || a.placedAt).getTime() - new Date(b.settledAt || b.placedAt).getTime());

  const points = [{ label: "Start", balance: startingBalance }];
  let balance = startingBalance;
  for (const bet of settled) {
    balance = Math.round((balance + bet.profitLoss) * 100) / 100;
    points.push({
      label: new Date(bet.settledAt || bet.placedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
      balance,
    });
  }
  return points;
}

function PortfolioChart({ points }: { points: Array<{ label: string; balance: number }> }) {
  const width = 720;
  const height = 220;
  const padX = 28;
  const padY = 24;
  const values = points.map((point) => point.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(0.01, max - min);
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? padX : padX + (index / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.balance - min) / spread) * (height - padY * 2);
    return { ...point, x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;
  const positive = points[points.length - 1]?.balance >= points[0]?.balance;
  const stroke = positive ? "#22C55E" : "#EF4444";

  return (
    <div className="portfolio-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Portfolio equity chart">
        <defs>
          <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const y = padY + i * ((height - padY * 2) / 3);
          return <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} className="portfolio-grid-line" />;
        })}
        <polygon points={area} fill="url(#portfolioFill)" />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" fill={stroke} />
        ))}
      </svg>
      <div className="portfolio-chart-axis">
        <span>{points[0]?.label ?? "Start"}</span>
        <strong>{money(points[points.length - 1]?.balance ?? 0)}</strong>
        <span>{points[points.length - 1]?.label ?? "Now"}</span>
      </div>
    </div>
  );
}

function PortfolioTab({
  summary,
  bets,
  tennisBetSummary,
  tennisBets,
  onOpenDesk,
  startingBalance = 0,
}: {
  summary: Summary | null;
  bets: Bet[];
  tennisBetSummary: TennisBetSummary | null;
  tennisBets: TennisBet[];
  onOpenDesk: () => void;
  startingBalance?: number;
}) {
  const t = useT();
  const lang = useLang();
  const tz = useTz();
  const portfolioBets = buildPortfolioBets(bets, tennisBets);
  const footballPnl = Number(summary?.pnl || 0);
  const tennisPnl = Number(tennisBetSummary?.pnl || 0);
  const pnl = Math.round((footballPnl + tennisPnl) * 100) / 100;
  const currentBalance = Math.round((startingBalance + pnl) * 100) / 100;
  const settled = portfolioBets.filter((bet) => bet.status !== "pending");
  const won = settled.filter((bet) => bet.status === "won").length;
  const winRate = settled.length ? (won / settled.length) * 100 : 0;
  const activeBets = portfolioBets.filter((bet) => bet.status === "pending").length;
  const totalPnLPct = startingBalance ? (pnl / startingBalance) * 100 : 0;
  const equityPoints = buildEquityPoints(portfolioBets, startingBalance);
  const footballCount = portfolioBets.filter((bet) => bet.sport === "Football").length;
  const tennisCount = portfolioBets.filter((bet) => bet.sport === "Tennis").length;
  const totalSports = footballCount + tennisCount || 1;

  return (
    <div className="portfolio-view">
      <section className="portfolio-hero">
        <div>
          <p className="eyebrow">Client dashboard</p>
          <h3>{t.portfolio_hero_title}</h3>
          <span>{t.portfolio_hero_desc}</span>
        </div>
        <button onClick={onOpenDesk}>{t.portfolio_open_desk}</button>
      </section>

      <section className="portfolio-balance">
        <div>
          <span className="metric-label">Net Asset Value</span>
          <strong>{money(currentBalance)}</strong>
          <em className={pnl >= 0 ? "text-green-300" : "text-red-300"}>
            {pnl >= 0 ? "+" : ""}{money(pnl)} · {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%
          </em>
        </div>
        <div className="portfolio-stat-strip">
          <div>
            <span>Win Rate</span>
            <strong>{winRate.toFixed(1)}%</strong>
          </div>
          <div>
            <span>{t.portfolio_open_positions}</span>
            <strong>{activeBets}</strong>
          </div>
          <div>
            <span>{t.portfolio_starting_capital}</span>
            <strong>{money(startingBalance)}</strong>
          </div>
        </div>
      </section>

      <section className="portfolio-grid">
        <div className="portfolio-panel portfolio-panel-wide">
          <div className="portfolio-panel-head">
            <div>
              <p className="eyebrow">Equity line</p>
              <h4>{t.portfolio_trend}</h4>
            </div>
            <span className={pnl >= 0 ? "is-positive" : "is-negative"}>{totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%</span>
          </div>
          <PortfolioChart points={equityPoints} />
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-panel-head">
            <div>
              <p className="eyebrow">Allocation</p>
              <h4>Sport mix</h4>
            </div>
          </div>
          <div className="allocation-bars">
            <div>
              <span>Football</span>
              <strong>{Math.round((footballCount / totalSports) * 100)}%</strong>
              <em style={{ width: `${(footballCount / totalSports) * 100}%` }} />
            </div>
            <div>
              <span>Tennis</span>
              <strong>{Math.round((tennisCount / totalSports) * 100)}%</strong>
              <em style={{ width: `${(tennisCount / totalSports) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="portfolio-panel">
        <div className="portfolio-panel-head">
          <div>
            <p className="eyebrow">{t.portfolio_recent_eyebrow}</p>
            <h4>{t.portfolio_recent_title}</h4>
          </div>
          <span>{portfolioBets.length} {t.portfolio_total}</span>
        </div>
        <div className="portfolio-bet-list">
          {portfolioBets.slice(0, 6).map((bet) => (
            <div key={bet.id} className="portfolio-bet-row">
              <div>
                <span>{bet.sport}</span>
                <strong>{bet.event}</strong>
                <em>{bet.selection} · {bet.odds.toFixed(2)} · {fmtKickoff(bet.placedAt, lang, tz)}</em>
              </div>
              <div>
                <StatusBadge status={bet.status} />
                <strong className={bet.profitLoss >= 0 ? "text-green-300" : "text-red-300"}>
                  {bet.status === "pending" ? money(bet.stake) : `${bet.profitLoss >= 0 ? "+" : ""}${money(bet.profitLoss)}`}
                </strong>
              </div>
            </div>
          ))}
          {!portfolioBets.length && <div className="book-empty">{t.portfolio_empty}</div>}
        </div>
      </section>
    </div>
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
    ["Cosa sblocca il Livello 1?", "Best Bets, spiegazioni e board sportivo per decisione manuale."],
    ["Cosa sblocca il Livello 2?", "Dashboard Premium, execution log e agenti automatici quando il conto è collegato."],
  ] : [
    ["What can public users see?", "Only homepage, product structure and past/educational history. Live signals stay locked."],
    ["What does Free unlock?", "Profile, language, account preview and product structure, without operational predictions."],
    ["What does Level 1 unlock?", "Best Bets, explanations and sports board for manual decision-making."],
    ["What does Level 2 unlock?", "Premium dashboard, execution log and automated agents once the account is linked."],
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
        <div><span>Football</span><em>Best Bets</em><strong>Level 1</strong></div>
        <div><span>Tennis</span><em>Elo Surface</em><strong>Level 1</strong></div>
        <div><span>Agents</span><em>Auto execution</em><strong>Level 2</strong></div>
      </div>
      <p>{lang === "it" ? "Preview pubblica: dati sensibili oscurati fino al piano." : "Public preview: sensitive data hidden until plan activation."}</p>
    </div>
  );
}

function AccessLevels({ onCreate, onPlans }: { onCreate: () => void; onPlans: () => void }) {
  const lang = useLang();
  const priceCopy = {
    base: planPriceCopy("base", lang),
    premium: planPriceCopy("premium", lang),
  };
  const levels = lang === "it" ? [
    { name: "Free", price: "€0", desc: "Profilo, lingua, preview e storico pubblico. Nessun segnale operativo.", cta: "Crea profilo", action: onCreate },
    { name: "Livello 1", price: priceCopy.base, desc: "Best Bets, spiegazioni, board football/tennis e decisione manuale.", cta: "Vai ai piani", action: onPlans },
    { name: "Livello 2", price: priceCopy.premium, desc: "Agent automation, execution log, account linking e controlli premium.", cta: "Vai ai piani", action: onPlans },
  ] : [
    { name: "Free", price: "€0", desc: "Profile, language, preview and public history. No operational signals.", cta: "Create profile", action: onCreate },
    { name: "Level 1", price: priceCopy.base, desc: "Best Bets, explanations, football/tennis board and manual decisions.", cta: "View plans", action: onPlans },
    { name: "Level 2", price: priceCopy.premium, desc: "Agent automation, execution log, account linking and premium controls.", cta: "View plans", action: onPlans },
  ];
  return (
    <section className="public-section">
      <div className="public-section-head">
        <p className="eyebrow">{lang === "it" ? "Accesso clienti" : "Client access"}</p>
        <h3>{lang === "it" ? "Tre livelli chiari, zero ambiguità" : "Three clear levels, zero ambiguity"}</h3>
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
        <div><span>ROI</span><strong>{stats ? `${stats.roi}%` : "..."}</strong></div>
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
  plan: "base" | "premium";
  onSubmit: (plan: "base" | "premium") => void;
}) {
  const price = PLAN_CONFIG[plan];
  const t = useT();
  const lang = useLang();
  return (
    <div className="crypto-pay-box">
      <div>
        <span>USDT TRC20</span>
        <strong>{planPriceCopy(plan, lang)}</strong>
        {!profile && <em>{t.crypto_profile_required}</em>}
      </div>
      <button disabled={!profile} onClick={() => onSubmit(plan)}>
        {profile ? `${t.crypto_activate} ${price.label}` : t.crypto_create_first}
      </button>
    </div>
  );
}

function CheckoutModal({
  plan,
  onConfirm,
  onClose,
}: {
  plan: "base" | "premium";
  onConfirm: (txHash: string) => void;
  onClose: () => void;
}) {
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const price = PLAN_CONFIG[plan];
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
          <h3>{price.label}</h3>
          <span>
            {lang === "it" ? <>Invia esattamente <strong style={{ color: "var(--green)" }}>{price.eur} USDT</strong> all&apos;indirizzo qui sotto. Il piano passerà in verifica.</> : <>Send exactly <strong style={{ color: "var(--green)" }}>{price.eur} USDT</strong> to the address below. The plan will move to review.</>}
          </span>
        </div>

        <div className="checkout-wallet-block">
          <span>Network: TRC20 (Tron) · USDT</span>
          <div className="checkout-address">
            <code>{USDT_TRC20_ADDRESS}</code>
            <button type="button" onClick={handleCopy}>{copied ? t.checkout_copied : t.checkout_copy}</button>
          </div>
          <em>{t.checkout_amount}: {price.eur} USDT · {t.checkout_monthly}</em>
        </div>

        <div className="checkout-steps">
          <div><span>1</span><span>{t.checkout_step1}</span></div>
          <div><span>2</span><span>{t.checkout_step2}</span></div>
          <div><span>3</span><span>{t.checkout_step3}</span></div>
        </div>

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
          {t.checkout_confirm} · {price.eur} USDT
        </button>

        <p>
          {t.checkout_note_prefix} {price.eur} {t.checkout_note_suffix}{" "}
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
      {profile.txHash && (
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
  onPaymentSubmit: (plan: "base" | "premium") => void;
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
            <PlanFeature locked>{t.plans_premium_f2}</PlanFeature>
          </ul>
          <button className="plan-action" disabled={!profile || profile.plan === "free"} onClick={onActivateFree}>
            {!profile ? t.crypto_create_first : profile.plan === "free" ? (lang === "it" ? "Free attivo" : "Free active") : (lang === "it" ? "Attiva Free" : "Activate Free")}
          </button>
        </article>

        <article className="plan-card">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">{lang === "it" ? "Livello 1" : "Level 1"}</p>
              <h4>Signal Desk</h4>
            </div>
            <span>Manual</span>
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
            <PlanFeature locked>{t.plans_base_f6}</PlanFeature>
            <PlanFeature locked>{t.plans_base_f7}</PlanFeature>
          </ul>
          <CryptoPaymentBox profile={profile} plan="base" onSubmit={onPaymentSubmit} />
        </article>

        <article className="plan-card is-premium">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">{lang === "it" ? "Livello 2" : "Level 2"}</p>
              <h4>Autopilot Agents</h4>
            </div>
            <span>Unlocked</span>
          </div>
          <p className="plan-description">{t.plans_premium_desc}</p>
          <div className="price-line">
            <strong>{planPriceCopy("premium", lang)}</strong>
            <span>Crypto only · USDT TRC20</span>
          </div>
          <div className="plan-core-line">
            <strong>{t.plans_premium_core}</strong>
            <em>{t.plans_premium_sub}</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>{t.plans_premium_f1}</PlanFeature>
            <PlanFeature>{t.plans_premium_f2}</PlanFeature>
            <PlanFeature>{t.plans_premium_f3}</PlanFeature>
            <PlanFeature>{t.plans_premium_f4}</PlanFeature>
            <PlanFeature>{t.plans_premium_f5}</PlanFeature>
            <PlanFeature>{t.plans_premium_f6}</PlanFeature>
            <PlanFeature>{t.plans_premium_f7}</PlanFeature>
            <PlanFeature>{t.plans_premium_f8}</PlanFeature>
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
    leaderboardDesc: "Appari nella classifica pubblica dei clienti per hit rate e ROI.",
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
    leaderboardDesc: "Appear in the public leaderboard ranked by hit rate and ROI.",
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
          <span>{Object.values(notifications).filter(Boolean).length}/4</span>
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
  storedProfiles,
  onClose,
  onSave,
  onNotFound,
}: {
  intent: ClientAuthIntent;
  storedProfiles: ClientProfile[];
  onClose: () => void;
  onSave: (profile: ClientProfile) => void;
  onNotFound: (email: string) => void;
}) {
  const [mode, setMode] = useState<ClientAuthIntent>(intent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const t = useT();
  const lang = useLang();
  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = mode === "login" ? normalizedEmail.includes("@") : name.trim().length > 1 && normalizedEmail.includes("@");

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <form
        className="auth-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          if (mode === "login") {
            const found = storedProfiles.find((profile) => profile.email.toLowerCase() === normalizedEmail);
            if (!found) {
              setError(t.auth_not_found);
              onNotFound(normalizedEmail);
              return;
            }
            onSave(found);
            return;
          }
          onSave({
            name: name.trim(),
            email: normalizedEmail,
            plan: "free",
            language: lang,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome",
            risk: { maxStake: 10, dailyStopLoss: 50, maxBetsPerDay: 5, mode: "automatic" },
            betfair: { status: "not_connected" },
            notifications: defaultNotifications(),
          });
        }}
      >
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
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.auth_name_placeholder} autoComplete="name" />
          </label>
        )}
        <label>
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" inputMode="email" />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button disabled={!canSubmit}>{mode === "login" ? "Login" : t.auth_create_btn}</button>
        <p>{t.auth_footer}</p>
      </form>
    </div>
  );
}

function profileHasAccess(profile: ClientProfile | null) {
  return Boolean(profile && (["base", "premium", "admin_full"].includes(profile.plan) || (profile.plan === "pending_payment" && profile.requestedPlan)));
}

function profileHasSignalPreview(profile: ClientProfile | null) {
  return Boolean(profile && (profile.plan === "free" || profileHasAccess(profile)));
}

function profileHasPremium(profile: ClientProfile | null) {
  return Boolean(profile && (["premium", "admin_full"].includes(profile.plan) || (profile.plan === "pending_payment" && profile.requestedPlan === "premium")));
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

function ClientDashboardTab({
  profile,
  isPremiumClient,
  summary,
  bets,
  tennisBetSummary,
  tennisBets,
  agents,
  tennisSummary,
  computedAt,
  tennisComputedAt,
  onLogout,
  onUpgrade,
  onOpenDesk,
  onPaymentSubmit,
  onActivateFree,
  onUnlock,
  onSaveProfile,
}: {
  profile: ClientProfile | null;
  isPremiumClient: boolean;
  summary: Summary;
  bets: Bet[];
  tennisBetSummary: TennisBetSummary;
  tennisBets: TennisBet[];
  agents: AgentStatus[];
  tennisSummary: TennisSummary | null;
  computedAt: string | null;
  tennisComputedAt: string | null;
  onLogout: () => void;
  onUpgrade: () => void;
  onOpenDesk: () => void;
  onPaymentSubmit: (plan: "base" | "premium") => void;
  onActivateFree: () => void;
  onUnlock: () => void;
  onSaveProfile: (profile: ClientProfile) => void;
}) {
  const t = useT();
  const accountPlan = profile?.plan === "admin_full" ? "premium" : profile?.plan ?? "unpaid";
  const activeAgents = agents.filter((agent) => agent.status === "alive").length;

  return (
    <div className="client-dashboard-view">
      {profile ? (
        <ProfilePanel profile={profile} onLogout={onLogout} onUpgrade={onUpgrade} />
      ) : (
        <section className="settings-empty">
          <p className="eyebrow">Client profile</p>
          <h3>{t.settings_empty_title}</h3>
          <button onClick={onUnlock}>{t.settings_empty_btn}</button>
        </section>
      )}

      <section className="client-dashboard-overview">
        <div>
          <span className="metric-label">Current plan</span>
          <strong>{accountPlan.replace("_", " ")}</strong>
          <em>{isPremiumClient ? "Autopilot and execution controls enabled" : "Signal access enabled · Premium controls locked"}</em>
        </div>
        <div>
          <span className="metric-label">Service health</span>
          <strong>{activeAgents || "OK"}</strong>
          <em>{activeAgents ? "agents reporting heartbeat" : "client data layer online"}</em>
        </div>
        <div>
          <span className="metric-label">Account status</span>
          <strong>{profile?.betfair?.status === "connected" ? "Connected" : "Setup"}</strong>
          <em>{profile?.betfair?.status === "connected" ? "exchange account linked" : t.account_pending_detail}</em>
        </div>
      </section>

      <section className="client-dashboard-section">
        <div className="client-dashboard-section-head">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h3>{t.portfolio_hero_title}</h3>
          </div>
          {!isPremiumClient && <span>Premium</span>}
        </div>
        {isPremiumClient ? (
          <PortfolioTab
            summary={summary}
            bets={bets}
            tennisBetSummary={tennisBetSummary}
            tennisBets={tennisBets}
            onOpenDesk={onOpenDesk}
          />
        ) : (
          <div className="premium-gate-card in-dashboard">
            <p className="eyebrow">{t.gate_eyebrow}</p>
            <h3>{t.gate_portfolio_title}</h3>
            <p>{t.gate_portfolio_desc}</p>
            <button onClick={onUpgrade}>{t.gate_upgrade_btn}</button>
          </div>
        )}
      </section>

      <section id="client-plans" className="client-dashboard-section">
        <div className="client-dashboard-section-head">
          <div>
            <p className="eyebrow">{t.plans_eyebrow}</p>
            <h3>{t.plans_title}</h3>
          </div>
          <span>{profile ? accountPlan.replace("_", " ") : "Login"}</span>
        </div>
        <PlansTab profile={profile} onOpenDesk={onOpenDesk} onPaymentSubmit={onPaymentSubmit} onActivateFree={onActivateFree} />
      </section>

      <section className="client-dashboard-section">
        <div className="client-dashboard-section-head">
          <div>
            <p className="eyebrow">Account</p>
            <h3>{t.page_settings}</h3>
          </div>
          <span>{isPremiumClient ? "Premium controls" : "Base controls"}</span>
        </div>
        <SettingsTab profile={profile} onUnlock={onUnlock} onSave={onSaveProfile} />
      </section>

      <section className="client-dashboard-section">
        <div className="client-dashboard-section-head">
          <div>
            <p className="eyebrow">{t.partners_eyebrow}</p>
            <h3>{t.partners_title}</h3>
          </div>
          <span>{PARTNERS.length}</span>
        </div>
        <PartnersTab />
      </section>

      <section className="client-dashboard-section">
        <div className="client-dashboard-section-head">
          <div>
            <p className="eyebrow">System</p>
            <h3>{t.page_agents}</h3>
          </div>
          <span>{isPremiumClient ? "Live audit" : "Service health"}</span>
        </div>
        {isPremiumClient ? (
          <ClientStatusTab
            agents={agents}
            bets={bets}
            tennisSummary={tennisSummary}
            computedAt={computedAt}
            tennisComputedAt={tennisComputedAt}
          />
        ) : (
          <div className="client-status">
            <section className="client-status-grid compact">
              <article className="client-status-card good">
                <span>Signal desk</span>
                <strong>Online</strong>
                <em>Best Bets and Tennis signal layers are available on Base.</em>
              </article>
              <article className="client-status-card warn">
                <span>Execution</span>
                <strong>Premium</strong>
                <em>Automatic agents, exchange audit and risk controls unlock with Premium.</em>
              </article>
              <article className="client-status-card neutral">
                <span>Freshness</span>
                <strong>{computedAt ? timeAgo(computedAt) : "syncing"}</strong>
                <em>{tennisComputedAt ? `Tennis updated ${timeAgo(tennisComputedAt)}.` : "Waiting for tennis sync."}</em>
              </article>
            </section>
          </div>
        )}
      </section>
    </div>
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

function PredictionCard({ p, onSelect, onBetNow }: { p: Prediction; onSelect?: (s: SlipSelection) => void; onBetNow?: () => void }) {
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
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {p.home_team}<span className="text-gray-500 font-normal mx-2">vs</span>{p.away_team}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-0.5">{fmtKickoff(p.kickoff, lang, tz)}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isValueBet && p.best_selection && (
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

      {/* Probability bars */}
      <div className="space-y-1.5">
        <ProbBar label="HOME" pct={p.p_home} color="text-cyan-400"
          odds={p.odds_home} isValue={hasOdds && p.best_selection === "HOME" && isValueBet} />
        <ProbBar label="DRAW" pct={p.p_draw} color="text-yellow-400"
          odds={p.odds_draw} isValue={hasOdds && p.best_selection === "DRAW" && isValueBet} />
        <ProbBar label="AWAY" pct={p.p_away} color="text-fuchsia-400"
          odds={p.odds_away} isValue={hasOdds && p.best_selection === "AWAY" && isValueBet} />
      </div>

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
        <button
          className="text-gray-500 hover:text-cyan-400 transition-colors text-[10px] uppercase tracking-wider"
          onClick={() => setShowWhy(!showWhy)}
        >
          {showWhy ? t.pred_why_hide : t.pred_why_show}
        </button>
        <span className="text-gray-600">Dixon-Coles</span>
        {p.edge != null ? (
          <span className={`px-2 py-0.5 rounded border font-mono text-[10px] ${isFootballBestBet(p) ? "text-green-400 border-green-400/40 bg-green-400/10" : p.edge > 0 ? "text-gray-400 border-gray-400/30" : "text-red-400 border-red-400/30"}`}>
            {p.edge > 0 ? "+" : ""}{(p.edge * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-600">no edge</span>
        )}
      </div>

      {/* Inline Why section */}
      {showWhy && (
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

      {onBetNow && (
        <button
          className="w-full mt-1 py-1.5 rounded-lg border border-green-400/30 bg-green-400/8 text-green-400 text-xs font-mono tracking-wider hover:bg-green-400/15 hover:border-green-400/50 transition-colors"
          onClick={onBetNow}
        >
          {t.bet_now}
        </button>
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

function TennisMatchCard({ m, onSelect, onBetNow }: { m: TennisMatch; onSelect?: (s: SlipSelection) => void; onBetNow?: () => void }) {
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
        {isValue && m.best_selection && (
          <button
            className="text-xs px-2 py-0.5 rounded-full border border-green-400/50 text-green-400 bg-green-400/10 font-mono shrink-0 hover:bg-green-400/20 transition-colors"
            onClick={() => handleSelect(m.best_selection as "P1" | "P2")}
          >
            +EV {m.best_selection}
          </button>
        )}
      </div>

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

      {/* Footer */}
      <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
        <button
          className="text-gray-500 hover:text-cyan-400 transition-colors text-[10px] uppercase tracking-wider"
          onClick={handleWhyClick}
        >
          {loadingAnalysis ? "⏳ ..." : showWhy ? t.tennis_why_hide : t.tennis_why_show}
        </button>
        <span className="text-gray-600">{m.model}</span>
        {m.edge != null && m.edge > 0 ? (
          <span className={`px-2 py-0.5 rounded border font-mono text-[10px] ${isValue ? "text-green-400 border-green-400/40 bg-green-400/10" : "text-gray-400 border-gray-400/30"}`}>
            edge +{(m.edge * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-600">no edge</span>
        )}
      </div>

      {onBetNow && (
        <button
          className="w-full mt-1 py-1.5 rounded-lg border border-green-400/30 bg-green-400/8 text-green-400 text-xs font-mono tracking-wider hover:bg-green-400/15 hover:border-green-400/50 transition-colors"
          onClick={onBetNow}
        >
          {t.bet_now}
        </button>
      )}

      {/* Inline Why */}
      {showWhy && (
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
    </div>
  );
}

function TennisTab({
  matches,
  summary,
  loading,
  computedAt,
  agents = [],
  showPnl = false,
  onBetNow,
}: {
  matches: TennisMatch[];
  summary: TennisSummary | null;
  loading: boolean;
  computedAt: string | null;
  agents?: AgentStatus[];
  showPnl?: boolean;
  onBetNow?: () => void;
}) {
  const [surfaceFilter, setSurfaceFilter] = useState<string>("ALL");

  const surfaces = ["ALL", ...Array.from(new Set(matches.map((m) => m.surface)))];
  const filtered = surfaceFilter === "ALL" ? matches : matches.filter((m) => m.surface === surfaceFilter);
  const valueBets = matches.filter(isTennisBestBet);
  const pnl = summary?.pnl ?? 0;
  const t = useT();
  const lang = useLang();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="inline-block px-3 py-0.5 rounded-full border border-amber-400/50 text-amber-300 text-xs font-mono tracking-wider">
            {t.tennis_badge}
          </div>
          {computedAt && (
            <p className="text-xs text-gray-500 font-mono mt-1">
              {t.tennis_computed} {timeAgo(computedAt)} · {matches.length} {t.tennis_matches_loaded}
            </p>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t.tennis_kpi_today,   value: String(summary?.total_today ?? matches.length), color: "text-white" },
          { label: t.tennis_kpi_value,   value: String(valueBets.length),  color: "text-green-400" },
          { label: "P&L Tennis",         value: showPnl ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€` : "—", color: showPnl ? (pnl >= 0 ? "text-green-400" : "text-red-400") : "text-gray-500" },
          { label: t.tennis_kpi_markets, value: String(summary?.markets_active ?? 0), color: "text-amber-300" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4 text-center">
            <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Surface filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">{t.tennis_surface_label}</span>
        {surfaces.map((s) => (
          <button key={s} onClick={() => setSurfaceFilter(s)}
            className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
              surfaceFilter === s
                ? "border-amber-400 text-amber-300 bg-amber-400/10"
                : "border-white/10 text-gray-400 hover:border-amber-400/40"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Match list */}
      {loading ? (
        <div className="glass-card p-12 text-center text-gray-400 font-mono">
          <div className="animate-pulse">{t.tennis_loading}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400 font-mono">{t.tennis_no_matches}</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => <TennisMatchCard key={m.id} m={m} onBetNow={onBetNow} />)}
        </div>
      )}

      {/* Agent status — live from heartbeat DB */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-mono text-amber-400/70 uppercase tracking-wider mb-3">
          {t.tennis_pipeline_title}
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { key: "TennisDataCollectorAgent", label: "DataCollector",  desc: lang === "it" ? "Mercati tennis · ciclo polling 5min" : "Tennis markets · 5min polling cycle" },
            { key: "TennisModelAgent",          label: "ModelAgent",     desc: lang === "it" ? "Elo Surface v2 · terra/erba/cemento · 2966 giocatori" : "Elo Surface v2 · clay/grass/hard · 2966 players" },
            { key: "TennisAnalystAgent",         label: "Analyst",       desc: lang === "it" ? "Value edge · soglia 4% · confronto mercato" : "Value edge · 4% threshold · market comparison" },
            { key: "TennisRiskManagerAgent",     label: "RiskManager",   desc: lang === "it" ? "Quarter-Kelly sizing · cap 20% · drawdown gate" : "Quarter-Kelly sizing · 20% cap · drawdown gate" },
            { key: "TennisTraderAgent",          label: "Trader",        desc: lang === "it" ? "Paper bets · Neon DB · alert Telegram" : "Paper bets · Neon DB · Telegram alerts" },
            { key: "TennisSettlementAgent",      label: "Settlement",    desc: lang === "it" ? "CLOSED → update Elo → loop P&L" : "CLOSED → Elo update → P&L loop" },
          ].map(({ key, label, desc }) => {
            const a = agents.find((ag) => ag.name === key);
            const st = a?.status ?? "offline";
            const dotCls = st === "alive" ? "bg-green-400 animate-pulse" : st === "stale" ? "bg-yellow-400" : "bg-red-400";
            const txtCls = st === "alive" ? "text-green-400" : st === "stale" ? "text-yellow-400" : "text-red-400";
            const borderCls = st === "alive" ? "border-green-400/20" : st === "stale" ? "border-yellow-400/20" : "border-red-400/20";
            return (
              <div key={key} className={`glass-card p-3 space-y-1 ${borderCls}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-mono">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${dotCls}`} />
                    <span className={`text-xs font-mono ${txtCls}`}>{st.toUpperCase()}</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 font-mono">{desc}</p>
                {a?.last_seen
                  ? <div className="text-[9px] text-gray-600 font-mono">{t.tennis_last_seen}: {timeAgo(a.last_seen)}</div>
                  : <div className="text-[9px] text-gray-600 font-mono">{t.tennis_no_heartbeat}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <footer className="text-center text-xs text-gray-600 font-mono pb-4">
        {t.tennis_footer}
      </footer>
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
  const confirmedLive = bets.filter((b) => !b.paper && Boolean(b.betfair_bet_id)).length;
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

type UnifiedBet = {
  id: string;
  sport: "Football" | "Tennis";
  event: string;
  competition: string;
  market: string;
  pick: string;
  odds: number;
  stake: number;
  status: string;
  profitLoss: number | null;
  placedAt: string;
  startsAt: string | null;
  source: "live" | "paper" | "signal";
  category: "execution" | "signal" | "settled" | "failed";
  betId: string | null;
};

function statusCategory(status: string): UnifiedBet["category"] {
  if (FAILED_STATUSES.includes(status)) return "failed";
  if (["won", "lost", "settled"].includes(status)) return "settled";
  if (["pending", "matched", "open"].includes(status)) return "execution";
  return "signal";
}

function aggregateUnifiedBets(bets: Bet[], tennisBets: TennisBet[]): UnifiedBet[] {
  const footballRows: UnifiedBet[] = bets.map((bet) => {
    const isLive = !bet.paper && Boolean(bet.betfair_bet_id);
    return {
      id: `football-${bet.id}`,
      sport: "Football",
      event: bet.home_team && bet.away_team
        ? `${bet.home_team} vs ${bet.away_team}`
        : `Match #${bet.match_external_id}`,
      competition: bet.league_name || bet.league || "Football",
      market: "1X2",
      pick: bet.selection,
      odds: Number(bet.odds ?? 0),
      stake: Number(bet.stake ?? 0),
      status: bet.status,
      profitLoss: bet.profit_loss,
      placedAt: bet.placed_at,
      startsAt: bet.kickoff ?? null,
      source: bet.paper ? "paper" : isLive ? "live" : "signal",
      category: statusCategory(bet.status),
      betId: bet.betfair_bet_id ?? null,
    };
  });

  const tennisRows: UnifiedBet[] = tennisBets.map((bet) => ({
    id: `tennis-${bet.id}`,
    sport: "Tennis",
    event: bet.player1 && bet.player2 ? `${bet.player1} vs ${bet.player2}` : bet.match_id,
    competition: bet.tournament || bet.surface || "Tennis",
    market: "Match Winner",
    pick: bet.player_name ?? bet.selection,
    odds: Number(bet.odds ?? 0),
    stake: Number(bet.stake ?? 0),
    status: bet.status,
    profitLoss: bet.profit_loss,
    placedAt: bet.placed_at,
    startsAt: bet.scheduled_at ?? null,
    source: bet.paper ? "paper" : bet.betfair_bet_id ? "live" : "signal",
    category: statusCategory(bet.status),
    betId: bet.betfair_bet_id ?? null,
  }));

  return [...footballRows, ...tennisRows].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
}

function BetsTab({ bets, summary, leaguePnl, tennisBets = [], tennisBetSummary }: {
  bets: Bet[];
  summary: Summary;
  leaguePnl: LeaguePnl[];
  tennisBets?: TennisBet[];
  tennisBetSummary?: TennisBetSummary | null;
}) {
  const [sportFilter, setSportFilter] = useState<"all" | "Football" | "Tennis">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | UnifiedBet["category"]>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | UnifiedBet["source"]>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const lang = useLang();
  const tz = useTz();
  const rows = aggregateUnifiedBets(bets, tennisBets);
  const query = searchTerm.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (sportFilter !== "all" && row.sport !== sportFilter) return false;
    if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
    if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
    if (query && !`${row.event} ${row.competition} ${row.pick} ${row.market} ${row.status}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const pnl = summary.pnl + (tennisBetSummary?.pnl ?? 0);
  const openRows = rows.filter((row) => ["execution", "signal"].includes(row.category)).length;
  const verifiedRows = rows.filter((row) => row.source === "live" && row.betId).length;
  const failedRows = rows.filter((row) => row.category === "failed").length;
  const labels = lang === "it" ? {
    eyebrow: "Unified Bets",
    title: "Dashboard scommesse multi-sport",
    subtitle: "Football, tennis e prossimi sport finiscono nello stesso registro operativo. Nessuna sezione separata, un solo audit.",
    allSports: "Tutti",
    category: "Categoria",
    allCategories: "Tutte",
    execution: "Execution",
    signal: "Signal",
    settled: "Settled",
    failed: "Failed",
    source: "Fonte",
    allSources: "Tutte",
    live: "Live",
    paper: "Paper",
    search: "Cerca evento, lega, pick...",
    total: "Totale",
    open: "Aperte",
    verified: "Verificate",
    empty: "Nessuna scommessa rispetta questi filtri.",
    placed: "Inserita",
  } : {
    eyebrow: "Unified Bets",
    title: "Multi-sport bets dashboard",
    subtitle: "Football, tennis and future sports land in one operating ledger. No split sections, one audit trail.",
    allSports: "All",
    category: "Category",
    allCategories: "All",
    execution: "Execution",
    signal: "Signal",
    settled: "Settled",
    failed: "Failed",
    source: "Source",
    allSources: "All",
    live: "Live",
    paper: "Paper",
    search: "Search event, league, pick...",
    total: "Total",
    open: "Open",
    verified: "Verified",
    empty: "No bets match these filters.",
    placed: "Placed",
  };

  return (
    <div className="unified-bets-view">
      <section className="client-callout unified-bets-hero">
        <div>
          <p className="eyebrow">{labels.eyebrow}</p>
          <h3>{labels.title}</h3>
        </div>
        <p>{labels.subtitle}</p>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: labels.total, value: String(rows.length), color: "text-white" },
          { label: labels.open, value: String(openRows), color: "text-cyan-300" },
          { label: "P&L", value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`, color: pnl >= 0 ? "text-green-400" : "text-red-400" },
          { label: labels.verified, value: String(verifiedRows), color: "text-fuchsia-300" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4 text-center">
            <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {leaguePnl.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-mono text-cyan-400/70 uppercase tracking-wider mb-3">P&L by League</h3>
          <div className="space-y-2">
            {leaguePnl.map((l) => (
              <div key={l.league} className="flex items-center gap-3">
                <span className="text-xs font-mono w-8 text-gray-400">{LEAGUE_FLAGS[l.league] ?? "⚽"}</span>
                <span className="text-xs font-mono text-gray-300 w-8">{l.league}</span>
                <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${Number(l.pnl) >= 0 ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(Math.abs(Number(l.pnl)) / 20, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-16 text-right ${Number(l.pnl) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {Number(l.pnl) >= 0 ? "+" : ""}{Number(l.pnl).toFixed(2)}€
                </span>
                <span className="text-xs text-gray-600 font-mono">{l.won}W/{l.lost}L</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bets-filter-bar">
        <div className="segmented-filter" aria-label="Bets sport filter">
          {[
            ["all", labels.allSports],
            ["Football", "Football"],
            ["Tennis", "Tennis"],
          ].map(([key, label]) => (
            <button key={key} className={sportFilter === key ? "is-active" : ""} onClick={() => setSportFilter(key as "all" | "Football" | "Tennis")}>{label}</button>
          ))}
        </div>
        <label>
          <span>{labels.category}</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | UnifiedBet["category"])}>
            <option value="all">{labels.allCategories}</option>
            <option value="execution">{labels.execution}</option>
            <option value="signal">{labels.signal}</option>
            <option value="settled">{labels.settled}</option>
            <option value="failed">{labels.failed}{failedRows ? ` (${failedRows})` : ""}</option>
          </select>
        </label>
        <label>
          <span>{labels.source}</span>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as "all" | UnifiedBet["source"])}>
            <option value="all">{labels.allSources}</option>
            <option value="live">{labels.live}</option>
            <option value="paper">{labels.paper}</option>
            <option value="signal">Signal</option>
          </select>
        </label>
        <input className="sports-search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={labels.search} />
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400 font-mono">{labels.empty}</div>
      ) : (
        <div className="unified-bet-list">
          {filtered.map((bet) => {
            const executionLabel = bet.source === "paper" ? "PAPER" : bet.source === "live" ? "LIVE" : "SIGNAL";
            const executionClass = bet.source === "paper"
              ? "text-yellow-400"
              : bet.source === "live"
                ? "text-green-400"
                : "text-cyan-300";
            return (
            <div key={bet.id} className={`glass-card p-4 ${
              bet.status === "won" ? "border-green-400/20" :
              bet.status === "lost" || bet.category === "failed" ? "border-red-400/20" : ""
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{bet.event}</span>
                    <span className="text-xs text-gray-500 font-mono">{bet.sport === "Football" ? "⚽" : "🎾"} {bet.competition}</span>
                    <span className="text-xs text-gray-500 font-mono">{bet.market}</span>
                    <span className={`text-xs font-mono ${executionClass}`}>
                      [{executionLabel}]
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs font-mono text-cyan-300 font-bold">{bet.pick}</span>
                    <span className="text-xs font-mono text-gray-400">@ {bet.odds.toFixed(2)}</span>
                    <span className="text-xs font-mono text-gray-400">stake: {bet.stake.toFixed(2)}€</span>
                    {bet.startsAt && (
                      <span className="text-xs font-mono text-gray-600">{fmtKickoff(bet.startsAt, lang, tz)}</span>
                    )}
                  </div>
                  {bet.betId && <p className="text-[10px] text-green-400/70 mt-1 font-mono">Betfair ID: {bet.betId}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={bet.status} />
                  {bet.profitLoss != null ? (
                    <span className={`text-sm font-bold font-mono ${bet.profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {bet.profitLoss >= 0 ? "+" : ""}{bet.profitLoss.toFixed(2)}€
                    </span>
                  ) : bet.category === "failed" ? (
                    <span className="text-xs text-gray-600 font-mono">—</span>
                  ) : (
                    <span className="text-xs text-gray-600 font-mono">pending</span>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-gray-700 font-mono mt-2">{labels.placed}: {timeAgo(bet.placedAt)}</div>
            </div>
            );
          })}
        </div>
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
    name: "Partner Principale",
    type: "Casino & Sportsbook",
    status: "featured",
    description: "Casino e piattaforma di scommesse sportive — partner esclusivo del progetto. Integrazione diretta con Agentic Markets per segnali e edge calcolati in tempo reale.",
    url: null,
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] font-mono text-gray-600">{t.partners_since} {p.since}</span>
        {p.url ? (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.leaderboard ?? []);
        setSystemWins(d.system_wins ?? 0);
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
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-black text-green-400 font-mono">{systemWins}</div>
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{copy.systemWins}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-black text-cyan-400 font-mono">{systemWins * 10}</div>
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{copy.pointsFormula}</div>
        </div>
      </div>

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
                  <div className="text-xl font-black font-mono text-white">{e.points}</div>
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
              <div className="text-xs font-mono text-gray-500">{yourEntry.points} {copy.points} · {yourEntry.hit_rate}% {copy.hitRate}</div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {[
            { label: t.hist_matches,  value: String(stats.total_matches), color: "text-white" },
            { label: t.hist_bets,     value: String(stats.bets_placed), color: "text-cyan-300" },
            { label: t.hist_won,      value: String(stats.won), color: "text-green-400" },
            { label: t.hist_lost,     value: String(stats.lost), color: "text-red-400" },
            { label: t.hist_hit_rate, value: `${stats.accuracy}%`, color: "text-yellow-400" },
            { label: t.hist_roi,      value: `${Number(stats.roi) >= 0 ? "+" : ""}${stats.roi}%`, color: Number(stats.roi) >= 0 ? "text-green-400" : "text-red-400" },
            { label: t.hist_return,   value: `${Number(stats.total_return) >= 0 ? "+" : ""}${stats.total_return}€`, color: Number(stats.total_return) >= 0 ? "text-green-400" : "text-red-400" },
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
    ["Cosa sblocca il Livello 1 (Base)?", "Best Bets, spiegazioni e board sportivo per decisione manuale."],
    ["Cosa sblocca il Livello 2 (Premium)?", "Dashboard completa, execution log e agenti automatici quando il conto è collegato."],
    ["Come pago?", "Solo crypto — USDT TRC20. Invia l'importo esatto all'indirizzo USDT indicato nel checkout."],
    ["Come viene attivato il piano?", "Dopo il TX hash il piano viene verificato internamente o attivato secondo la policy operativa configurata."],
  ] : [
    ["What can public users see?", "Only product structure and past history. Live signals stay locked."],
    ["What does Free unlock?", "Profile, language and account preview without operational predictions."],
    ["What does Level 1 (Base) unlock?", "Best Bets, explanations and sports board for manual decision-making."],
    ["What does Level 2 (Premium) unlock?", "Full dashboard, execution log and automated agents once account is linked."],
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
  onPaymentSubmit: (plan: "base" | "premium") => void;
  onActivateFree: () => void;
  onLogout: () => void;
}) {
  const lang = useLang();
  const t = useT();
  const plan = profile?.plan ?? "unpaid";
  const accessState = profileHasPremium(profile)
    ? "Premium"
    : profileHasAccess(profile)
      ? "Base"
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
            <article><span>{statusCopy.notifications}</span><strong>{Object.values(notifications).filter(Boolean).length}/4</strong></article>
          </div>
          {profile.txHash && (
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
  isSignalPreviewUnlocked,
  isFreeClient,
  isLoggedIn,
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
  isSignalPreviewUnlocked: boolean;
  isFreeClient: boolean;
  isLoggedIn: boolean;
}) {
  const lang = useLang();
  const visibleHistory = history
    .filter((h) => h.bet_status && h.bet_status !== "pending")
    .slice(0, 5);

  if (!isLoggedIn) {
    return (
      <>
        <div className="bets-auth-gate">
          <div className="bets-auth-gate-icon">🔒</div>
          <h3>{lang === "it" ? "Accedi per vedere le prediction" : "Sign in to see predictions"}</h3>
          <p>{lang === "it"
            ? "Crea un profilo gratuito o accedi per sbloccare le best bets del giorno selezionate dall'agente."
            : "Create a free profile or sign in to unlock today's best bets selected by the agent."
          }</p>
          <div className="bets-auth-gate-actions">
            <button className="btn-primary" onClick={onRegister}>
              {lang === "it" ? "Registrati gratis" : "Register for free"}
            </button>
            <button className="btn-secondary" onClick={onSignIn}>
              {lang === "it" ? "Accedi" : "Sign In"}
            </button>
          </div>
          <span className="bets-auth-gate-hint">
            {lang === "it" ? "Piano Free incluso — nessuna carta richiesta" : "Free plan included — no card required"}
          </span>
        </div>
        <PublicOldBetsPanel history={visibleHistory} stats={historyStats} loading={historyLoading} />
      </>
    );
  }

  // Free plan: 1 per category. Base/Premium: unlimited.
  const previewLimit = isFreeClient ? 1 : undefined;
  return (
    <>
      <SportsbookBoard
        predictions={predictions}
        tennisMatches={tennisMatches}
        onSelect={onSelect}
        onBetNow={onBetNow}
        previewLimit={previewLimit}
      />
      <PublicOldBetsPanel history={visibleHistory} stats={historyStats} loading={historyLoading} />
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("bets");
  const [uiLanguage, setUiLanguage] = useState<Lang>(() => {
    if (typeof window === "undefined") return "it";
    const stored = localStorage.getItem("agentic-lang") as Lang | null;
    return stored && LANGUAGES.includes(stored) ? stored : "it";
  });
  const toggleLanguage = () => {
    const next: Lang = LANGUAGES[(LANGUAGES.indexOf(uiLanguage) + 1) % LANGUAGES.length];
    setUiLanguage(next);
    localStorage.setItem("agentic-lang", next);
  };
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [storedProfiles, setStoredProfiles] = useState<ClientProfile[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<ClientAuthIntent>("login");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"base" | "premium" | null>(null);
  const [founderOpen, setFounderOpen] = useState(false);
  const founderClickRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const [slipSelection, setSlipSelection] = useState<SlipSelection | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [leaguePnl, setLeaguePnl] = useState<LeaguePnl[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [tennisMatches, setTennisMatches] = useState<TennisMatch[]>([]);
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
  const [userTz, setUserTz] = useState("Europe/Rome");
  useEffect(() => { setUserTz(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);

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

  const handleAuthSave = (profile: ClientProfile) => {
    saveClientProfile(profile);
    setTab("bets");
  };

  const submitCryptoPayment = (plan: "base" | "premium") => {
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

  const handleCheckoutConfirm = (txHash: string) => {
    if (!clientProfile || !checkoutPlan) return;
    const { txHash: _tx, requestedPlan: _rp, ...rest } = clientProfile;
    saveClientProfile({ ...rest, plan: checkoutPlan, txHash, requestedPlan: checkoutPlan });
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
  };

  const focusClientPlans = () => {
    setTab("bets");
    requestAnimationFrame(() => {
      document.getElementById("client-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const fetchData = useCallback(async () => {
    try {
      const [dataResp, tennisBetsResp] = await Promise.all([
        fetch("/api/data"),
        fetch("/api/tennis-bets"),
      ]);
      if (dataResp.ok) {
        const data = await dataResp.json();
        setSummary(data.summary);
        setBets(data.bets ?? []);
        setLeaguePnl(data.league_pnl ?? []);
        setLastUpdate(new Date().toLocaleTimeString());
      }
      if (tennisBetsResp.ok) {
        const tb = await tennisBetsResp.json();
        setTennisBets(tb.bets ?? []);
        setTennisBetSummary(tb.summary ?? null);
      }
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  const fetchPredictions = useCallback(async () => {
    setPredLoading(true);
    try {
      const resp = await fetch("/api/predictions");
      if (resp.ok) {
        const data = await resp.json();
        setPredictions(data.predictions ?? []);
        setComputedAt(data.computed_at ?? null);
        setPredStale(data.is_stale ?? false);
        setPredFallback(data.source === "fallback");
      }
    } catch { /**/ } finally { setPredLoading(false); }
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
    setTennisLoading(true);
    try {
      const resp = await fetch("/api/tennis");
      if (resp.ok) {
        const data = await resp.json();
        const isPlaceholder = data.source === "placeholder" || data.is_placeholder === true;
        setTennisMatches(isPlaceholder ? [] : (data.matches ?? []));
        setTennisSummary(isPlaceholder ? null : (data.summary ?? null));
        setTennisComputedAt(isPlaceholder ? null : (data.computed_at ?? null));
      }
    } catch { /**/ } finally { setTennisLoading(false); }
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
    try {
      const r = await fetch("/api/live");
      if (!r.ok) return;
      const d = await r.json() as { live: Record<string, LiveScore> };
      setLiveScores(d.live ?? {});
    } catch { /* silent */ }
  }, []);

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

  const pnl = (summary?.pnl ?? 0) + (tennisBetSummary?.pnl ?? 0);
  const valueBets = predictions.filter(isFootballBestBet);
  const hasClientProfile = Boolean(clientProfile);
  const isClientUnlocked = profileHasAccess(clientProfile);
  const isSignalPreviewUnlocked = profileHasSignalPreview(clientProfile);
  const isPremiumClient = profileHasPremium(clientProfile);
  const isFreeClient = clientProfile?.plan === "free";
  const isFounderAccount = clientProfile?.plan === "admin_full";
  const accountSummary = isFounderAccount ? (summary ?? EMPTY_SUMMARY) : EMPTY_SUMMARY;
  const accountBets = isFounderAccount ? bets : [];
  const accountLeaguePnl = isFounderAccount ? leaguePnl : [];
  const accountTennisBets = isFounderAccount ? tennisBets : [];
  const accountTennisBetSummary = isFounderAccount ? (tennisBetSummary ?? EMPTY_TENNIS_BET_SUMMARY) : EMPTY_TENNIS_BET_SUMMARY;
  const accountTennisSummary = tennisSummary
    ? { ...tennisSummary, pnl: isFounderAccount ? tennisSummary.pnl : 0 }
    : null;
  const accountPnl = accountSummary.pnl + accountTennisBetSummary.pnl;
  const accountPendingBets = accountSummary.pending + accountTennisBetSummary.pending;

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
    { tab: "client-area", label: uiLanguage === "it" ? "Client Area" : "Client Area", value: clientProfile ? (isPremiumClient ? "PRO" : isClientUnlocked ? "BASE" : clientProfile.plan === "free" ? "FREE" : "SETUP") : "LOGIN" },
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
              {clientProfile.name} · {isPremiumClient ? "Premium" : isClientUnlocked ? "Base" : clientProfile.plan === "free" ? "Free" : "Setup"}
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

        {/* Left ad column */}
        <aside className="portal-ad-col left">
          <div className="portal-ad-slot">
            <p className="ad-eyebrow">Operator</p>
            <div className="ad-name" style={{ color: "transparent" }}>·</div>
            <div className="ad-desc" style={{ color: "transparent" }}>·</div>
          </div>
          <div className="portal-ad-slot tall">
            <p className="ad-eyebrow" style={{ color: "transparent" }}>·</p>
            <div className="ad-name" style={{ color: "transparent" }}>·</div>
            <div className="ad-desc" style={{ color: "transparent" }}>·</div>
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
                  onClick={() => setTab(item.tab)}
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
              <span>⚠️ {uiLanguage === "it" ? "Dati demo — nessuna partita nel database. Questi sono esempi di output del modello, non prediction operative." : "Demo data — no matches in database. These are model output examples, not live predictions."}</span>
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
              isSignalPreviewUnlocked={isSignalPreviewUnlocked}
              isFreeClient={isFreeClient}
              isLoggedIn={hasClientProfile}
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

        {/* Right ad column */}
        <aside className="portal-ad-col right">
          <div className="portal-ad-slot">
            <p className="ad-eyebrow">Sportsbook</p>
            <div className="ad-name" style={{ color: "transparent" }}>·</div>
            <div className="ad-desc" style={{ color: "transparent" }}>·</div>
          </div>
          <div className="portal-ad-slot tall">
            <p className="ad-eyebrow" style={{ color: "transparent" }}>·</p>
            <div className="ad-name" style={{ color: "transparent" }}>·</div>
            <div className="ad-desc" style={{ color: "transparent" }}>·</div>
          </div>
        </aside>

      </div>{/* end portal-columns */}

      {/* ── Bottom banner ── */}
      <div className="portal-bottom-banner" style={{ visibility: "hidden", height: 0, overflow: "hidden", padding: 0 }} />

      <footer className="text-center text-xs text-gray-600 pb-8 font-mono" style={{padding: "16px 24px"}}>
        {tUI.footer_note}
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
          storedProfiles={storedProfiles}
          onClose={() => setAuthOpen(false)}
          onSave={handleAuthSave}
          onNotFound={(_email: string) => undefined}
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
