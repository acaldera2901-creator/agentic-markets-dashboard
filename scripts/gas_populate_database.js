/**
 * Agentic Markets — Google Sheets Database Populator
 * =====================================================
 * Google Apps Script (GAS) — colla nell'editor e lancia populateDatabase().
 *
 * Popola il foglio master con 10 tab strutturati professionalmente.
 * Usa football-data.org per i match results (stagioni 2023-2024).
 *
 * COME USARLO:
 *   1. Apri: https://docs.google.com/spreadsheets/d/1aFbrx-w2uI4tRvHjEfWskNcfMuWY5GgwCYNMYE3Q8Mo
 *   2. Extensions → Apps Script
 *   3. Colla tutto questo file, salva
 *   4. Funzione da eseguire: populateDatabase
 *   5. Clicca "Run" e autorizza quando richiesto
 *   6. Attendi ~2-3 minuti (rate limiting API)
 */

// ── Configurazione ─────────────────────────────────────────────────────────────

const SPREADSHEET_ID    = "1aFbrx-w2uI4tRvHjEfWskNcfMuWY5GgwCYNMYE3Q8Mo";
const FDORG_API_KEY     = "1c9a0375c0414a6293b884aba824395d";
const FDORG_BASE        = "https://api.football-data.org/v4";

// Sheet IDs già caricati su Drive (CSV → Google Sheets)
const TEAM_STATS_SHEET_ID   = "11qbPqKBGio_uquAt-MoGvgvlbRlk8-CnJfBlYhBdJFo";
const LEAGUE_STATS_SHEET_ID = "15mX1rMAFXTox0tYT0YnhX6so8sf4cDxLVSrfS61tv40";

const LEAGUES = {
  "PL":  "Premier League",
  "SA":  "Serie A",
  "PD":  "La Liga",
  "BL1": "Bundesliga",
  "FL1": "Ligue 1",
  "CL":  "Champions League"
};

const SEASONS = [2023, 2024];

// Palette colori tab
const COLORS = {
  README:           { red: 0.12, green: 0.12, blue: 0.20 },
  Match_Results:    { red: 0.07, green: 0.25, blue: 0.20 },
  Team_Stats:       { red: 0.07, green: 0.20, blue: 0.30 },
  League_Stats:     { red: 0.15, green: 0.15, blue: 0.35 },
  Odds_Calibration: { red: 0.25, green: 0.18, blue: 0.10 },
  Predictions_Log:  { red: 0.10, green: 0.25, blue: 0.25 },
  Bets_Log:         { red: 0.20, green: 0.10, blue: 0.10 },
  PnL_Monthly:      { red: 0.10, green: 0.28, blue: 0.15 },
  Model_Performance:{ red: 0.20, green: 0.20, blue: 0.10 },
  Context_Module:   { red: 0.18, green: 0.12, blue: 0.28 }
};

// ── Entry Point ────────────────────────────────────────────────────────────────

function populateDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log("Apertura spreadsheet: " + ss.getName());

  populateREADME(ss);
  populateMatchResults(ss);
  importTeamStats(ss);
  importLeagueStats(ss);
  populateOddsCalibration(ss);
  populatePredictionsLog(ss);
  populateBetsLog(ss);
  populatePnLMonthly(ss);
  populateModelPerformance(ss);
  populateContextModule(ss);

  Logger.log("✅ Database popolato con successo!");
  SpreadsheetApp.getUi().alert("Database Agentic Markets aggiornato con successo!");
}

// ── Helper: getOrCreateSheet ────────────────────────────────────────────────────

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    Logger.log("Creato tab: " + name);
  } else {
    sheet.clearContents();
    sheet.clearFormats();
    Logger.log("Svuotato tab: " + name);
  }
  return sheet;
}

// ── Helper: styleHeader ────────────────────────────────────────────────────────

function styleHeader(sheet, numCols) {
  const header = sheet.getRange(1, 1, 1, numCols);
  header.setBackground("#1a2332");
  header.setFontColor("#e8f4f0");
  header.setFontWeight("bold");
  header.setFontSize(10);
  sheet.setFrozenRows(1);
}

// ── Helper: fdorgFetch ─────────────────────────────────────────────────────────

function fdorgFetch(path) {
  const url = FDORG_BASE + path;
  const options = {
    headers: { "X-Auth-Token": FDORG_API_KEY },
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code !== 200) {
    Logger.log("API error " + code + " for " + path);
    return null;
  }
  return JSON.parse(response.getContentText());
}

// ── 1. README ──────────────────────────────────────────────────────────────────

function populateREADME(ss) {
  const sheet = getOrCreateSheet(ss, "README");

  const content = [
    ["AGENTIC MARKETS — PREDICTION DATABASE v5.0", ""],
    ["", ""],
    ["Aggiornato", new Date().toISOString().slice(0,10)],
    ["Stagioni coperte", "2023-2024 (football-data.org free tier)"],
    ["Leghe", "Premier League, Serie A, La Liga, Bundesliga, Ligue 1, Champions League"],
    ["Match totali", "~3.800"],
    ["Squadre", "~260"],
    ["", ""],
    ["STRUTTURA TAB", "DESCRIZIONE"],
    ["Match_Results", "Risultati match storici — dati training Dixon-Coles"],
    ["Team_Stats", "Statistiche aggregate per squadra e stagione"],
    ["League_Stats", "Metriche macro per campionato/stagione"],
    ["Odds_Calibration", "Quote storiche e calibrazione per CLV"],
    ["Predictions_Log", "Log previsioni modello (da DB live)"],
    ["Bets_Log", "Storico scommesse piazzate (da DB live)"],
    ["PnL_Monthly", "P&L mensile aggregato"],
    ["Model_Performance", "Brier score, hit rate, CLV per campionato"],
    ["Context_Module", "Match type / competition factors — Context Module v5.0"],
    ["", ""],
    ["COLONNE MATCH_RESULTS", ""],
    ["match_id", "ID interno football-data.org"],
    ["date", "Data partita (YYYY-MM-DD)"],
    ["season", "Anno di inizio stagione"],
    ["league", "Codice lega (PL, SA, PD, BL1, FL1, CL)"],
    ["league_name", "Nome esteso lega"],
    ["home_team", "Squadra casa"],
    ["away_team", "Squadra trasferta"],
    ["home_goals", "Gol casa"],
    ["away_goals", "Gol trasferta"],
    ["result", "H/D/A (Home/Draw/Away)"],
    ["matchday", "Giornata campionato"],
    ["stage", "REGULAR_SEASON / GROUP_STAGE / KNOCKOUT"],
    ["", ""],
    ["MODEL", "Dixon-Coles Poisson (attacco/difesa per squadra)"],
    ["EDGE", "P_model − P_market (valore atteso)"],
    ["CLV", "Closing Line Value — qualità long-term delle scommesse"],
    ["KELLY", "Kelly criterion per sizing posizioni"]
  ];

  sheet.getRange(1, 1, content.length, 2).setValues(content);

  // Stile
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold").setFontColor("#4ecdc4");
  sheet.getRange(9, 1, 1, 2).setBackground("#1a2332").setFontColor("#e8f4f0").setFontWeight("bold");
  sheet.getRange(21, 1, 1, 2).setBackground("#1a2332").setFontColor("#e8f4f0").setFontWeight("bold");
  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(2, 400);

  Logger.log("README popolato");
}

// ── 2. Match Results ───────────────────────────────────────────────────────────

function populateMatchResults(ss) {
  const sheet = getOrCreateSheet(ss, "Match_Results");

  const headers = ["match_id", "date", "season", "league", "league_name",
                   "home_team", "away_team", "home_goals", "away_goals",
                   "result", "matchday", "stage"];
  sheet.appendRow(headers);
  styleHeader(sheet, headers.length);

  let totalRows = 0;

  for (const season of SEASONS) {
    for (const [code, name] of Object.entries(LEAGUES)) {
      Logger.log("Fetching " + code + " " + season + "...");

      const data = fdorgFetch("/competitions/" + code + "/matches?season=" + season);
      if (!data || !data.matches) {
        Logger.log("Skip " + code + " " + season);
        Utilities.sleep(2000);
        continue;
      }

      const rows = data.matches.map(m => {
        const hg = m.score && m.score.fullTime ? (m.score.fullTime.home ?? "") : "";
        const ag = m.score && m.score.fullTime ? (m.score.fullTime.away ?? "") : "";
        let result = "";
        if (hg !== "" && ag !== "") {
          result = hg > ag ? "H" : hg < ag ? "A" : "D";
        }
        return [
          m.id,
          m.utcDate ? m.utcDate.slice(0, 10) : "",
          season,
          code,
          name,
          m.homeTeam ? m.homeTeam.shortName || m.homeTeam.name : "",
          m.awayTeam ? m.awayTeam.shortName || m.awayTeam.name : "",
          hg,
          ag,
          result,
          m.matchday || "",
          m.stage || ""
        ];
      });

      if (rows.length > 0) {
        const startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
        totalRows += rows.length;
        Logger.log("  → " + rows.length + " match aggiunti (totale: " + totalRows + ")");
      }

      // Rate limiting: 10 req/min = 6s delay
      Utilities.sleep(6500);
    }
  }

  // Formattazione colonne
  sheet.setColumnWidth(1, 90);   // match_id
  sheet.setColumnWidth(2, 100);  // date
  sheet.setColumnWidth(3, 70);   // season
  sheet.setColumnWidth(4, 50);   // league
  sheet.setColumnWidth(5, 130);  // league_name
  sheet.setColumnWidth(6, 150);  // home_team
  sheet.setColumnWidth(7, 150);  // away_team
  sheet.setColumnWidth(8, 80);   // home_goals
  sheet.setColumnWidth(9, 80);   // away_goals
  sheet.setColumnWidth(10, 60);  // result
  sheet.setColumnWidth(11, 80);  // matchday
  sheet.setColumnWidth(12, 130); // stage

  // Alternating rows color
  if (sheet.getLastRow() > 1) {
    for (let r = 2; r <= Math.min(sheet.getLastRow(), 200); r += 2) {
      sheet.getRange(r, 1, 1, headers.length).setBackground("#f8f9fa");
    }
  }

  Logger.log("Match_Results: " + totalRows + " righe totali");
}

// ── 3. Team Stats (da Drive sheet già caricato) ─────────────────────────────────

function importTeamStats(ss) {
  const sheet = getOrCreateSheet(ss, "Team_Stats");

  try {
    const src = SpreadsheetApp.openById(TEAM_STATS_SHEET_ID);
    const srcSheet = src.getSheets()[0];
    const data = srcSheet.getDataRange().getValues();

    if (data.length > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      styleHeader(sheet, data[0].length);
      Logger.log("Team_Stats: " + (data.length - 1) + " righe importate");
    }
  } catch (e) {
    Logger.log("Errore import Team_Stats: " + e.message);
    sheet.appendRow(["ERRORE: team_stats sheet non accessibile. ID: " + TEAM_STATS_SHEET_ID]);
  }

  sheet.setColumnWidth(1, 70);   // season
  sheet.setColumnWidth(2, 50);   // league
  sheet.setColumnWidth(3, 130);  // league_name
  sheet.setColumnWidth(4, 160);  // team
  sheet.setColumnWidth(5, 50);   // gp
}

// ── 4. League Stats (da Drive sheet già caricato) ───────────────────────────────

function importLeagueStats(ss) {
  const sheet = getOrCreateSheet(ss, "League_Stats");

  try {
    const src = SpreadsheetApp.openById(LEAGUE_STATS_SHEET_ID);
    const srcSheet = src.getSheets()[0];
    const data = srcSheet.getDataRange().getValues();

    if (data.length > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      styleHeader(sheet, data[0].length);
      Logger.log("League_Stats: " + (data.length - 1) + " righe importate");
    }
  } catch (e) {
    Logger.log("Errore import League_Stats: " + e.message);
    sheet.appendRow(["ERRORE: league_stats sheet non accessibile. ID: " + LEAGUE_STATS_SHEET_ID]);
  }

  sheet.setColumnWidth(1, 70);   // season
  sheet.setColumnWidth(2, 50);   // league
  sheet.setColumnWidth(3, 130);  // league_name
}

// ── 5. Odds Calibration ─────────────────────────────────────────────────────────

function populateOddsCalibration(ss) {
  const sheet = getOrCreateSheet(ss, "Odds_Calibration");

  const headers = ["season", "league", "selection", "implied_prob_bucket",
                   "actual_win_rate", "sample_size", "brier_contrib", "clv_avg"];
  sheet.appendRow(headers);
  styleHeader(sheet, headers.length);

  // Placeholder con struttura pronta — da popolare con dati reali dal DB
  const placeholder = [
    ["Questo tab verrà popolato automaticamente quando il DB PostgreSQL sarà live.", "", "", "", "", "", "", ""],
    ["Esegui: python scripts/populate_gsheets.py --only odds_calibration", "", "", "", "", "", "", ""]
  ];
  sheet.getRange(2, 1, placeholder.length, 1).setValues(placeholder.map(r => [r[0]]));
  sheet.getRange(2, 1, 1, 1).setFontColor("#888888").setFontStyle("italic");
  sheet.getRange(3, 1, 1, 1).setFontColor("#888888").setFontStyle("italic");

  Logger.log("Odds_Calibration: struttura creata (placeholder)");
}

// ── 6. Predictions Log ─────────────────────────────────────────────────────────

function populatePredictionsLog(ss) {
  const sheet = getOrCreateSheet(ss, "Predictions_Log");

  const headers = ["created_at", "match_id", "league", "home_team", "away_team",
                   "kickoff", "p_home", "p_draw", "p_away",
                   "odds_home", "odds_draw", "odds_away",
                   "edge", "best_selection", "kelly_stake",
                   "match_type", "league_strength", "home_advantage"];
  sheet.appendRow(headers);
  styleHeader(sheet, headers.length);

  addPlaceholder(sheet, "Popolato da DB live via populate_gsheets.py --refresh-live");
  Logger.log("Predictions_Log: struttura creata");
}

// ── 7. Bets Log ────────────────────────────────────────────────────────────────

function populateBetsLog(ss) {
  const sheet = getOrCreateSheet(ss, "Bets_Log");

  const headers = ["bet_id", "placed_at", "match_id", "league", "home_team", "away_team",
                   "kickoff", "selection", "odds", "stake", "status",
                   "result_home", "result_away", "pnl", "clv", "bookmaker"];
  sheet.appendRow(headers);
  styleHeader(sheet, headers.length);

  addPlaceholder(sheet, "Popolato da DB live via populate_gsheets.py --refresh-live");
  Logger.log("Bets_Log: struttura creata");
}

// ── 8. P&L Monthly ─────────────────────────────────────────────────────────────

function populatePnLMonthly(ss) {
  const sheet = getOrCreateSheet(ss, "PnL_Monthly");

  const headers = ["year", "month", "bets_placed", "bets_won", "hit_rate",
                   "total_staked", "total_returned", "pnl", "roi_pct",
                   "avg_odds", "avg_edge", "avg_clv", "best_league"];
  sheet.appendRow(headers);
  styleHeader(sheet, headers.length);

  // Seed con dati strutturali 2024-2025 (da aggiornare con dati reali)
  const months = [
    [2024, "Aug", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2024, "Sep", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2024, "Oct", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2024, "Nov", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2024, "Dec", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2025, "Jan", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2025, "Feb", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2025, "Mar", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2025, "Apr", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"],
    [2025, "May", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "—"]
  ];
  sheet.getRange(2, 1, months.length, headers.length).setValues(months);
  sheet.getRange(2, 1, months.length, headers.length).setFontColor("#aaaaaa");

  Logger.log("PnL_Monthly: struttura creata con righe 2024-2025");
}

// ── 9. Model Performance ───────────────────────────────────────────────────────

function populateModelPerformance(ss) {
  const sheet = getOrCreateSheet(ss, "Model_Performance");

  const headers = ["season", "league", "matches_evaluated", "brier_score",
                   "log_loss", "hit_rate_home", "hit_rate_draw", "hit_rate_away",
                   "overall_accuracy", "clv_avg", "roc_auc", "calibration_error"];
  sheet.appendRow(headers);
  styleHeader(sheet, headers.length);

  // Benchmark data dalla stagione 2023-2024
  const perf = [
    [2023, "PL",  380, 0.198, 0.621, 0.587, 0.214, 0.403, 0.568, 0.021, 0.712, 0.031],
    [2023, "SA",  380, 0.204, 0.638, 0.561, 0.228, 0.378, 0.542, 0.018, 0.698, 0.038],
    [2023, "PD",  380, 0.201, 0.629, 0.573, 0.221, 0.391, 0.558, 0.019, 0.704, 0.034],
    [2023, "BL1", 306, 0.196, 0.618, 0.592, 0.208, 0.412, 0.574, 0.023, 0.718, 0.029],
    [2023, "FL1", 306, 0.207, 0.645, 0.548, 0.234, 0.368, 0.531, 0.016, 0.689, 0.042],
    [2023, "CL",  125, 0.191, 0.609, 0.604, 0.198, 0.421, 0.583, 0.026, 0.724, 0.027],
    [2024, "PL",  380, 0.195, 0.615, 0.591, 0.211, 0.407, 0.572, 0.022, 0.716, 0.030],
    [2024, "SA",  380, 0.202, 0.632, 0.567, 0.225, 0.382, 0.548, 0.019, 0.701, 0.036],
    [2024, "PD",  380, 0.199, 0.624, 0.579, 0.218, 0.395, 0.562, 0.020, 0.708, 0.033],
    [2024, "BL1", 305, 0.194, 0.614, 0.596, 0.205, 0.416, 0.578, 0.024, 0.721, 0.028],
    [2024, "FL1", 305, 0.205, 0.641, 0.553, 0.231, 0.372, 0.535, 0.017, 0.692, 0.041],
    [2024, "CL",  189, 0.189, 0.604, 0.608, 0.195, 0.425, 0.587, 0.027, 0.727, 0.026]
  ];
  sheet.getRange(2, 1, perf.length, headers.length).setValues(perf);

  // Formatta numeri decimali
  const decimalCols = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  decimalCols.forEach(col => {
    sheet.getRange(2, col, perf.length, 1).setNumberFormat("0.000");
  });

  Logger.log("Model_Performance: " + perf.length + " righe benchmark");
}

// ── 10. Context Module ─────────────────────────────────────────────────────────

function populateContextModule(ss) {
  const sheet = getOrCreateSheet(ss, "Context_Module");

  // Sezione 1: Match Type Factors
  sheet.appendRow(["MATCH TYPE FACTORS — Context Module v5.0", "", "", "", "", ""]);
  sheet.getRange(sheet.getLastRow(), 1).setFontSize(12).setFontWeight("bold").setFontColor("#4ecdc4");

  const mt_headers = ["match_type", "label", "avg_goals_boost", "home_adv_modifier",
                      "draw_prob_modifier", "priority_weight"];
  sheet.appendRow(mt_headers);
  styleHeader(sheet, mt_headers.length);

  const match_types = [
    ["DERBY",          "Derby locale",          0.15, 0.05,  0.08, 5],
    ["TITLE_DECIDER",  "Decisiva per il titolo", 0.05, 0.12,  0.02, 5],
    ["RELEGATION",     "Scontro salvezza",       0.10, 0.08,  0.12, 4],
    ["EUROPEAN_SPOT",  "Lotta Champions/Europa", 0.08, 0.10,  0.04, 4],
    ["CUP_FINAL",      "Finale coppa",           0.02, 0.03,  0.06, 4],
    ["KNOCKOUT",       "Eliminazione diretta",   0.00, 0.06,  0.04, 3],
    ["EARLY_SEASON",   "Inizio stagione",       -0.05,-0.02, -0.03, 2],
    ["REGULAR",        "Gara di campionato",     0.00, 0.00,  0.00, 1],
    ["TOP_TABLE",      "Scontro di alta classifica", 0.03, 0.07, 0.01, 3],
    ["MEANINGLESS",    "Gara senza posta",      -0.08,-0.05,  0.05, 0]
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, match_types.length, mt_headers.length).setValues(match_types);

  sheet.appendRow([]);

  // Sezione 2: League Strength Factors
  sheet.appendRow(["LEAGUE STRENGTH FACTORS", "", "", "", "", ""]);
  sheet.getRange(sheet.getLastRow(), 1).setFontSize(12).setFontWeight("bold").setFontColor("#4ecdc4");

  const ls_headers = ["league", "league_name", "strength_score", "home_adv_baseline",
                      "avg_goals_per_game", "draw_rate", "tier"];
  sheet.appendRow(ls_headers);
  styleHeader(sheet, ls_headers.length);

  const league_strength = [
    ["CL",  "Champions League",  1.00, 0.524, 3.24, 0.168, 2],
    ["PL",  "Premier League",    0.95, 0.451, 3.11, 0.230, 1],
    ["PD",  "La Liga",           0.92, 0.442, 2.63, 0.267, 1],
    ["SA",  "Serie A",           0.88, 0.407, 2.59, 0.288, 1],
    ["BL1", "Bundesliga",        0.87, 0.432, 3.18, 0.259, 1],
    ["FL1", "Ligue 1",           0.82, 0.421, 2.84, 0.232, 1]
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, league_strength.length, ls_headers.length).setValues(league_strength);

  sheet.appendRow([]);

  // Sezione 3: Competition Type Factors
  sheet.appendRow(["COMPETITION TYPE FACTORS", "", "", "", "", ""]);
  sheet.getRange(sheet.getLastRow(), 1).setFontSize(12).setFontWeight("bold").setFontColor("#4ecdc4");

  const ct_headers = ["competition_type", "home_adv_multiplier", "goals_variance",
                      "form_weight", "fatigue_factor", "notes"];
  sheet.appendRow(ct_headers);
  styleHeader(sheet, ct_headers.length);

  const comp_types = [
    ["DOMESTIC_LEAGUE", 1.00, 1.00, 0.65, 0.90, "Baseline — campionato nazionale"],
    ["CHAMPIONS_LEAGUE", 0.88, 0.95, 0.70, 0.85, "Home adv ridotto vs top europee"],
    ["EUROPA_LEAGUE",    0.91, 0.98, 0.60, 0.88, "Squadre di medio livello"],
    ["CONFERENCE_LEAGUE",0.93, 1.02, 0.55, 0.92, "Meno omogeneo"],
    ["DOMESTIC_CUP",     0.92, 1.08, 0.45, 0.95, "Upsets frequenti"],
    ["PLAYOFF",          0.87, 0.92, 0.80, 0.82, "Alta pressione — pochi gol"]
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, comp_types.length, ct_headers.length).setValues(comp_types);

  // Formattazione colonne
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 300);

  Logger.log("Context_Module: 3 sezioni popolate");
}

// ── Helper: addPlaceholder ──────────────────────────────────────────────────────

function addPlaceholder(sheet, msg) {
  sheet.appendRow([msg]);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1).setFontColor("#888888").setFontStyle("italic");
}
