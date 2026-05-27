"""
Agentic Markets — Google Sheets Database Populator
====================================================
Crea e popola il foglio Google con 5 anni di dati storici (2020-2024).

Foglio ID: 1aFbrx-w2uI4tRvHjEfWskNcfMuWY5GgwCYNMYE3Q8Mo

Tab creati:
  1. README            — guida e legenda
  2. Match_Results     — risultati storici (training data Dixon-Coles)
  3. Team_Stats        — statistiche aggregate per squadra/stagione
  4. League_Stats      — metriche per campionato/stagione
  5. Odds_Calibration  — quote storiche per CLV
  6. Predictions_Log   — previsioni del modello (live dal DB)
  7. Bets_Log          — storico scommesse (live dal DB)
  8. PnL_Monthly       — P&L mensile aggregato
  9. Model_Performance — Brier, hit rate, CLV per campionato
 10. Context_Module    — statistiche match type / competition factors

Autenticazione:
  Crea credentials/oauth_client.json scaricando da:
  https://console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID (Desktop)
  Scopes necessari: spreadsheets, drive.readonly

Uso:
  pip install gspread google-auth-oauthlib
  python scripts/populate_gsheets.py
  python scripts/populate_gsheets.py --only match_results
  python scripts/populate_gsheets.py --refresh-live   # aggiorna Predictions/Bets dal DB
"""

import os
import sys
import time
import json
import argparse
import asyncio
from datetime import datetime, timezone
from pathlib import Path

import requests
import gspread
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

# ── Config ────────────────────────────────────────────────────────────────────

SPREADSHEET_ID = "1aFbrx-w2uI4tRvHjEfWskNcfMuWY5GgwCYNMYE3Q8Mo"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

CREDENTIALS_PATH = Path(__file__).parent.parent / "credentials" / "oauth_client.json"
TOKEN_PATH = Path(__file__).parent.parent / "credentials" / "token.json"

# football-data.org: leghe supportate free tier
LEAGUES = {
    "PL":  {"name": "Premier League",    "country": "England"},
    "SA":  {"name": "Serie A",            "country": "Italy"},
    "PD":  {"name": "La Liga",            "country": "Spain"},
    "BL1": {"name": "Bundesliga",         "country": "Germany"},
    "FL1": {"name": "Ligue 1",            "country": "France"},
    "CL":  {"name": "Champions League",   "country": "Europe"},
    "EL":  {"name": "Europa League",      "country": "Europe"},
}

SEASONS = [2020, 2021, 2022, 2023, 2024]

FDORG_API_KEY = os.getenv("FOOTBALL_DATA_ORG_API_KEY", "")
FDORG_BASE    = "https://api.football-data.org/v4"

# Colori intestazioni per ogni tab
TAB_COLORS = {
    "README":           {"red": 0.12, "green": 0.12, "blue": 0.20},
    "Match_Results":    {"red": 0.07, "green": 0.25, "blue": 0.20},
    "Team_Stats":       {"red": 0.07, "green": 0.20, "blue": 0.30},
    "League_Stats":     {"red": 0.15, "green": 0.15, "blue": 0.35},
    "Odds_Calibration": {"red": 0.25, "green": 0.18, "blue": 0.10},
    "Predictions_Log":  {"red": 0.10, "green": 0.25, "blue": 0.25},
    "Bets_Log":         {"red": 0.20, "green": 0.10, "blue": 0.10},
    "PnL_Monthly":      {"red": 0.10, "green": 0.28, "blue": 0.15},
    "Model_Performance":{"red": 0.20, "green": 0.20, "blue": 0.10},
    "Context_Module":   {"red": 0.18, "green": 0.12, "blue": 0.28},
}

# ── Auth ──────────────────────────────────────────────────────────────────────

def get_gspread_client() -> gspread.Client:
    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_PATH.exists():
                print(
                    "\n❌ File credentials non trovato.\n"
                    "   1. Vai su https://console.cloud.google.com\n"
                    "   2. APIs & Services → Credentials → Create → OAuth 2.0 Client ID (Desktop)\n"
                    "   3. Abilita: Google Sheets API + Google Drive API\n"
                    f"   4. Scarica e salva in: {CREDENTIALS_PATH}\n"
                    "   5. Riesegui questo script\n"
                )
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_PATH.write_text(creds.to_json())
    return gspread.authorize(creds)

# ── Helpers football-data.org ─────────────────────────────────────────────────

def fdorg_get(endpoint: str, params: dict = None, retries: int = 3) -> dict | None:
    """GET con rate-limit handling (10 req/min free tier)."""
    url = f"{FDORG_BASE}{endpoint}"
    headers = {"X-Auth-Token": FDORG_API_KEY} if FDORG_API_KEY else {}
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=headers, params=params, timeout=15)
            if r.status_code == 429:
                wait = int(r.headers.get("X-RequestCounter-Reset", 65))
                print(f"  ⏳ rate limit — attendo {wait}s …")
                time.sleep(wait)
                continue
            if r.status_code == 200:
                return r.json()
            print(f"  ⚠️  {endpoint} → HTTP {r.status_code}")
            return None
        except Exception as e:
            print(f"  ⚠️  {endpoint} errore: {e}")
            if attempt < retries - 1:
                time.sleep(5)
    return None

def fetch_matches(league: str, season: int) -> list[dict]:
    """Recupera tutti i match finiti di un campionato/stagione."""
    data = fdorg_get(f"/competitions/{league}/matches", {"season": season, "status": "FINISHED"})
    if not data:
        return []
    matches = []
    for m in data.get("matches", []):
        score = m.get("score", {}).get("fullTime", {})
        home_g = score.get("home")
        away_g = score.get("away")
        if home_g is None or away_g is None:
            continue
        result = "H" if home_g > away_g else "A" if away_g > home_g else "D"
        matches.append({
            "match_id":    str(m.get("id", "")),
            "date":        (m.get("utcDate") or "")[:10],
            "season":      season,
            "league":      league,
            "league_name": LEAGUES.get(league, {}).get("name", league),
            "home_team":   m.get("homeTeam", {}).get("shortName") or m.get("homeTeam", {}).get("name", ""),
            "away_team":   m.get("awayTeam", {}).get("shortName") or m.get("awayTeam", {}).get("name", ""),
            "home_goals":  home_g,
            "away_goals":  away_g,
            "result":      result,
            "home_xg":     "",
            "away_xg":     "",
            "home_shots":  "",
            "away_shots":  "",
            "matchday":    m.get("matchday", ""),
            "stage":       m.get("stage", "REGULAR_SEASON"),
            "source":      "football-data.org",
            "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        })
    return matches

def compute_team_stats(all_matches: list[dict]) -> list[dict]:
    """Calcola statistiche aggregate per squadra×stagione."""
    from collections import defaultdict
    stats: dict[tuple, dict] = defaultdict(lambda: {
        "gp":0,"wins":0,"draws":0,"losses":0,"gf":0,"ga":0,"pts":0
    })
    for m in all_matches:
        hk = (m["season"], m["league"], m["home_team"])
        ak = (m["season"], m["league"], m["away_team"])
        hg, ag = int(m["home_goals"]), int(m["away_goals"])
        stats[hk]["gp"] += 1;  stats[hk]["gf"] += hg;  stats[hk]["ga"] += ag
        stats[ak]["gp"] += 1;  stats[ak]["gf"] += ag;  stats[ak]["ga"] += hg
        if hg > ag:
            stats[hk]["wins"]+=1;  stats[hk]["pts"]+=3
            stats[ak]["losses"]+=1
        elif ag > hg:
            stats[ak]["wins"]+=1;  stats[ak]["pts"]+=3
            stats[hk]["losses"]+=1
        else:
            stats[hk]["draws"]+=1; stats[hk]["pts"]+=1
            stats[ak]["draws"]+=1; stats[ak]["pts"]+=1

    rows = []
    for (season, league, team), s in sorted(stats.items()):
        gd = s["gf"] - s["ga"]
        rows.append([
            season, league, LEAGUES.get(league, {}).get("name", league), team,
            s["gp"], s["wins"], s["draws"], s["losses"],
            s["gf"], s["ga"], gd, s["pts"],
            "", "", "",   # xg, xga, xgd (da Understat, popolati separatamente)
            "", "",       # ppda_att, ppda_def
            "",           # form_last5
        ])
    return rows

def compute_league_stats(all_matches: list[dict]) -> list[dict]:
    """Calcola statistiche aggregate per campionato×stagione."""
    from collections import defaultdict
    buckets: dict[tuple, list] = defaultdict(list)
    for m in all_matches:
        buckets[(m["season"], m["league"])].append(m)

    rows = []
    for (season, league), ms in sorted(buckets.items()):
        n = len(ms)
        if n == 0:
            continue
        total_g = sum(int(m["home_goals"]) + int(m["away_goals"]) for m in ms)
        home_g  = sum(int(m["home_goals"]) for m in ms)
        away_g  = sum(int(m["away_goals"]) for m in ms)
        hw = sum(1 for m in ms if m["result"] == "H")
        dw = sum(1 for m in ms if m["result"] == "D")
        aw = sum(1 for m in ms if m["result"] == "A")
        rows.append([
            season, league, LEAGUES.get(league, {}).get("name", league),
            n,
            round(total_g / n, 3),
            round(home_g / n, 3),
            round(away_g / n, 3),
            round(hw / n * 100, 1),
            round(dw / n * 100, 1),
            round(aw / n * 100, 1),
            "", "",   # avg_xg_home, avg_xg_away (Understat)
            "",       # predictability_score
            "1" if league in ("PL","SA","PD","BL1","FL1") else "2",  # tier
            datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        ])
    return rows

# ── DB helpers (opzionale — se DATABASE_URL è settato) ───────────────────────

async def fetch_predictions_from_db() -> list[list]:
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        return []
    try:
        from neon_serverless import neon  # type: ignore
    except ImportError:
        pass
    try:
        import asyncpg
        conn = await asyncpg.connect(db_url)
        rows = await conn.fetch("""
            SELECT match_id, league, league_name, home_team, away_team,
                   kickoff, p_home, p_draw, p_away,
                   lambda_home, lambda_away,
                   odds_home, odds_draw, odds_away,
                   edge, best_selection, model_matches, computed_at
            FROM match_predictions
            ORDER BY computed_at DESC
            LIMIT 2000
        """)
        await conn.close()
        return [
            [
                str(r["match_id"]), r["league"], r["league_name"],
                r["home_team"], r["away_team"],
                str(r["kickoff"])[:16] if r["kickoff"] else "",
                round(float(r["p_home"] or 0), 4),
                round(float(r["p_draw"] or 0), 4),
                round(float(r["p_away"] or 0), 4),
                round(float(r["lambda_home"] or 0), 3) if r["lambda_home"] else "",
                round(float(r["lambda_away"] or 0), 3) if r["lambda_away"] else "",
                round(float(r["odds_home"] or 0), 2) if r["odds_home"] else "",
                round(float(r["odds_draw"] or 0), 2) if r["odds_draw"] else "",
                round(float(r["odds_away"] or 0), 2) if r["odds_away"] else "",
                round(float(r["edge"] or 0), 4) if r["edge"] else "",
                r["best_selection"] or "",
                r["model_matches"] or "",
                str(r["computed_at"])[:16] if r["computed_at"] else "",
            ]
            for r in rows
        ]
    except Exception as e:
        print(f"  ⚠️  DB predictions: {e}")
        return []

async def fetch_bets_from_db() -> list[list]:
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        return []
    try:
        import asyncpg
        conn = await asyncpg.connect(db_url)
        rows = await conn.fetch("""
            SELECT b.id, b.placed_at, b.match_external_id,
                   mp.league, mp.league_name, mp.home_team, mp.away_team, mp.kickoff,
                   b.selection, b.odds, b.stake, b.status, b.paper,
                   CASE WHEN b.status='won' THEN b.stake*(b.odds-1)
                        WHEN b.status='lost' THEN -b.stake
                        ELSE 0 END as profit_loss
            FROM bets b
            LEFT JOIN match_predictions mp ON b.match_external_id = mp.match_id
            ORDER BY b.placed_at DESC
            LIMIT 2000
        """)
        await conn.close()
        return [
            [
                r["id"],
                str(r["placed_at"])[:16] if r["placed_at"] else "",
                r["match_external_id"] or "",
                r["league"] or "",
                r["league_name"] or "",
                r["home_team"] or "",
                r["away_team"] or "",
                str(r["kickoff"])[:16] if r["kickoff"] else "",
                r["selection"] or "",
                round(float(r["odds"] or 0), 2),
                round(float(r["stake"] or 0), 2),
                r["status"] or "",
                "PAPER" if r["paper"] else "LIVE",
                round(float(r["profit_loss"] or 0), 2),
            ]
            for r in rows
        ]
    except Exception as e:
        print(f"  ⚠️  DB bets: {e}")
        return []

# ── Sheet builders ────────────────────────────────────────────────────────────

def fmt_header(ws: gspread.Worksheet, n_cols: int, tab_key: str):
    """Formatta la prima riga come intestazione."""
    color = TAB_COLORS.get(tab_key, {"red": 0.10, "green": 0.10, "blue": 0.20})
    ws.format(f"A1:{chr(64+n_cols)}1", {
        "backgroundColor": color,
        "textFormat": {
            "bold": True,
            "foregroundColor": {"red": 1, "green": 1, "blue": 1},
            "fontSize": 10,
        },
        "horizontalAlignment": "CENTER",
    })
    ws.freeze(rows=1)

def get_or_create_ws(sh: gspread.Spreadsheet, title: str) -> gspread.Worksheet:
    try:
        ws = sh.worksheet(title)
        ws.clear()
        return ws
    except gspread.exceptions.WorksheetNotFound:
        return sh.add_worksheet(title=title, rows=5000, cols=30)

# ── 1. README ────────────────────────────────────────────────────────────────

def build_readme(sh: gspread.Spreadsheet):
    print("  📋 README …")
    ws = get_or_create_ws(sh, "README")
    rows = [
        ["AGENTIC MARKETS — PREDICTION DATABASE v5.0"],
        [],
        ["Ultimo aggiornamento", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")],
        ["Foglio ID", SPREADSHEET_ID],
        ["Repository",  "https://github.com/acaldera2901/agentic-markets"],
        ["Dashboard",   "https://agentic-markets-roan.vercel.app"],
        [],
        ["TAB", "DESCRIZIONE", "FONTE", "AGGIORNAMENTO"],
        ["Match_Results",    "Risultati storici 2020-2024 (training Dixon-Coles)", "football-data.org", "settimanale"],
        ["Team_Stats",       "Statistiche aggregate per squadra×stagione",         "football-data.org + Understat", "settimanale"],
        ["League_Stats",     "Metriche campionato×stagione (gol, home-win%, xG…)", "football-data.org + Understat", "settimanale"],
        ["Odds_Calibration", "Quote storiche per CLV e calibrazione modello",      "The Odds API / Betfair",        "live"],
        ["Predictions_Log",  "Previsioni Dixon-Coles prodotte dal sistema",        "DB Neon (match_predictions)",   "ogni ora"],
        ["Bets_Log",         "Storico completo scommesse (paper + live)",          "DB Neon (bets)",               "live"],
        ["PnL_Monthly",      "P&L aggregato per mese e campionato",               "calcolato da Bets_Log",         "live"],
        ["Model_Performance","Brier score, hit rate, CLV per campionato",         "calcolato da Bets_Log + Pred.", "settimanale"],
        ["Context_Module",   "Statistiche per match type (derby, relegation…)",   "contesto Python v5.0",          "live"],
        [],
        ["CAMPIONATI", "", "STAGIONI"],
        ["PL",  "Premier League (Inghilterra)",  "2020–2024"],
        ["SA",  "Serie A (Italia)",               "2020–2024"],
        ["PD",  "La Liga (Spagna)",               "2020–2024"],
        ["BL1", "Bundesliga (Germania)",          "2020–2024"],
        ["FL1", "Ligue 1 (Francia)",              "2020–2024"],
        ["CL",  "Champions League",               "2020–2024"],
        ["EL",  "Europa League",                  "2020–2024"],
        [],
        ["ARCHITETTURA PIPELINE (v5.0)"],
        ["DataCollector → ModelAgent → ContextService → AnalystAgent → StrategistAgent → RiskManagerAgent → TraderAgent"],
        [],
        ["CONTEXT MODULE v5.0"],
        ["LeagueStrengthAnalyzer",       "Tier 1-5 per campionato basato su efficienza mercato + liquidità"],
        ["LeagueOddsProfiler",           "Anomaly detection quote (z-score σ=1.5)"],
        ["LeaguePredictabilityTracker",  "Hit rate + CLV tracking; auto-suspend se CLV < 0"],
        ["MatchTypeClassifier",          "10 tipi: DERBY, TITLE_DECIDER, RELEGATION, SHORT_REST …"],
        ["CompetitionTypeFactors",       "Penalità stake: DERBY -30%, DEAD_RUBBER -50%, STANDARD ±0%"],
    ]
    ws.update("A1", rows, value_input_option="RAW")
    ws.format("A1", {"textFormat": {"bold": True, "fontSize": 14}})
    ws.format("A8:D8", {"textFormat": {"bold": True}})
    ws.format("A20:C20", {"textFormat": {"bold": True}})
    ws.format("A27", {"textFormat": {"bold": True}})
    ws.format("A30", {"textFormat": {"bold": True}})
    ws.set_column_width(0, 220)
    ws.set_column_width(1, 380)

# ── 2. Match Results ──────────────────────────────────────────────────────────

def build_match_results(sh: gspread.Spreadsheet, all_matches: list[dict]):
    print(f"  ⚽ Match_Results — {len(all_matches)} righe …")
    ws = get_or_create_ws(sh, "Match_Results")
    headers = [
        "match_id", "date", "season", "league", "league_name",
        "home_team", "away_team", "home_goals", "away_goals", "result",
        "home_xg", "away_xg", "home_shots", "away_shots",
        "matchday", "stage", "source", "last_updated",
    ]
    rows = [headers]
    for m in sorted(all_matches, key=lambda x: (x["season"], x["league"], x["date"])):
        rows.append([m.get(h, "") for h in headers])
    ws.update("A1", rows, value_input_option="RAW")
    fmt_header(ws, len(headers), "Match_Results")

# ── 3. Team Stats ─────────────────────────────────────────────────────────────

def build_team_stats(sh: gspread.Spreadsheet, all_matches: list[dict]):
    rows_data = compute_team_stats(all_matches)
    print(f"  👕 Team_Stats — {len(rows_data)} righe …")
    ws = get_or_create_ws(sh, "Team_Stats")
    headers = [
        "season", "league", "league_name", "team",
        "gp", "wins", "draws", "losses",
        "goals_for", "goals_against", "goal_diff", "points",
        "xg", "xga", "xgd",
        "ppda_att", "ppda_def",
        "form_last5",
    ]
    ws.update("A1", [headers] + rows_data, value_input_option="RAW")
    fmt_header(ws, len(headers), "Team_Stats")

# ── 4. League Stats ───────────────────────────────────────────────────────────

def build_league_stats(sh: gspread.Spreadsheet, all_matches: list[dict]):
    rows_data = compute_league_stats(all_matches)
    print(f"  🏆 League_Stats — {len(rows_data)} righe …")
    ws = get_or_create_ws(sh, "League_Stats")
    headers = [
        "season", "league", "league_name",
        "matches_played",
        "avg_goals", "avg_home_goals", "avg_away_goals",
        "home_win_pct", "draw_pct", "away_win_pct",
        "avg_xg_home", "avg_xg_away",
        "predictability_score",
        "league_tier",
        "last_updated",
    ]
    ws.update("A1", [headers] + rows_data, value_input_option="RAW")
    fmt_header(ws, len(headers), "League_Stats")

# ── 5. Odds Calibration ───────────────────────────────────────────────────────

def build_odds_calibration(sh: gspread.Spreadsheet):
    print("  📊 Odds_Calibration — struttura (dati da The Odds API in live) …")
    ws = get_or_create_ws(sh, "Odds_Calibration")
    headers = [
        "match_id", "date", "league", "league_name",
        "home_team", "away_team",
        "bookmaker",
        "opening_home", "opening_draw", "opening_away",
        "closing_home", "closing_draw", "closing_away",
        "market_margin_pct",
        "clv_home", "clv_draw", "clv_away",
        "source",
    ]
    note = [
        ["# Questo tab viene popolato in live dall'AgentSystem Python quando vengono registrate scommesse."],
        ["# Contiene le quote di apertura e chiusura per il calcolo del CLV (Closing Line Value)."],
        ["# CLV > 0 = scommessa piazzata a valore migliore del mercato di chiusura (edge reale)."],
        [],
        headers,
    ]
    ws.update("A1", note, value_input_option="RAW")
    fmt_header(ws, len(headers), "Odds_Calibration")

# ── 6. Predictions Log ────────────────────────────────────────────────────────

def build_predictions_log(sh: gspread.Spreadsheet, pred_rows: list[list]):
    print(f"  🧠 Predictions_Log — {len(pred_rows)} righe …")
    ws = get_or_create_ws(sh, "Predictions_Log")
    headers = [
        "match_id", "league", "league_name",
        "home_team", "away_team", "kickoff",
        "p_home", "p_draw", "p_away",
        "lambda_home", "lambda_away",
        "odds_home", "odds_draw", "odds_away",
        "edge", "best_selection",
        "model_matches", "computed_at",
    ]
    ws.update("A1", [headers] + pred_rows, value_input_option="RAW")
    fmt_header(ws, len(headers), "Predictions_Log")

# ── 7. Bets Log ───────────────────────────────────────────────────────────────

def build_bets_log(sh: gspread.Spreadsheet, bets_rows: list[list]):
    print(f"  🎰 Bets_Log — {len(bets_rows)} righe …")
    ws = get_or_create_ws(sh, "Bets_Log")
    headers = [
        "bet_id", "placed_at",
        "match_id", "league", "league_name",
        "home_team", "away_team", "kickoff",
        "selection", "odds", "stake",
        "status", "mode",
        "profit_loss",
    ]
    ws.update("A1", [headers] + bets_rows, value_input_option="RAW")
    fmt_header(ws, len(headers), "Bets_Log")

# ── 8. P&L Monthly ───────────────────────────────────────────────────────────

def build_pnl_monthly(sh: gspread.Spreadsheet, bets_rows: list[list]):
    print("  💰 PnL_Monthly …")
    ws = get_or_create_ws(sh, "PnL_Monthly")
    # Raggruppa per mese da bets_rows (indici: 1=placed_at, 3=league, 9=odds, 10=stake, 11=status, 13=pnl)
    from collections import defaultdict
    monthly: dict[str, dict] = defaultdict(lambda: {
        "bets":0,"won":0,"lost":0,"pending":0,
        "pnl":0.0,"staked":0.0,"odds_sum":0.0,"leagues":set()
    })
    for r in bets_rows:
        if len(r) < 14:
            continue
        month = str(r[1])[:7] if r[1] else "unknown"
        s = monthly[month]
        s["bets"] += 1
        status = str(r[11]).lower()
        if status == "won":   s["won"] += 1
        elif status == "lost": s["lost"] += 1
        else:                  s["pending"] += 1
        s["pnl"] += float(r[13] or 0)
        s["staked"] += float(r[10] or 0)
        s["odds_sum"] += float(r[9] or 0)
        s["leagues"].add(str(r[3] or ""))

    headers = [
        "month", "bets", "won", "lost", "pending",
        "win_rate_%", "gross_pnl_eur", "roi_%",
        "avg_odds", "total_staked",
        "leagues",
    ]
    rows = [headers]
    for month in sorted(monthly):
        s = monthly[month]
        n = s["bets"]
        wr = round(s["won"] / n * 100, 1) if n else 0
        roi = round(s["pnl"] / s["staked"] * 100, 1) if s["staked"] else 0
        avg_odds = round(s["odds_sum"] / n, 2) if n else 0
        rows.append([
            month, n, s["won"], s["lost"], s["pending"],
            wr, round(s["pnl"], 2), roi,
            avg_odds, round(s["staked"], 2),
            " | ".join(sorted(s["leagues"] - {""})),
        ])
    ws.update("A1", rows, value_input_option="RAW")
    fmt_header(ws, len(headers), "PnL_Monthly")

# ── 9. Model Performance ──────────────────────────────────────────────────────

def build_model_performance(sh: gspread.Spreadsheet, bets_rows: list[list], pred_rows: list[list]):
    print("  📈 Model_Performance …")
    ws = get_or_create_ws(sh, "Model_Performance")
    # Raggruppa per campionato
    from collections import defaultdict
    per_league: dict[str, dict] = defaultdict(lambda: {"bets":0,"won":0,"pnl":0.0,"edge_sum":0.0,"edge_n":0})
    for r in bets_rows:
        if len(r) < 14: continue
        lg = str(r[3] or "UNK")
        s = per_league[lg]
        s["bets"] += 1
        if str(r[11]).lower() == "won":
            s["won"] += 1
        s["pnl"] += float(r[13] or 0)

    pred_edge: dict[str, list] = defaultdict(list)
    for r in pred_rows:
        if len(r) < 15: continue
        lg = str(r[1] or "")
        edge = r[14]
        if edge != "" and edge is not None:
            try:
                pred_edge[lg].append(float(edge))
            except Exception:
                pass

    headers = [
        "league", "league_name",
        "bets_evaluated", "won", "hit_rate_%",
        "gross_pnl_eur",
        "avg_edge_%",
        "brier_score",        # placeholder
        "clv_avg",            # placeholder
        "value_bets_pct",     # placeholder
        "model_version",
        "notes",
    ]
    rows = [headers]
    for lg in sorted(per_league):
        s = per_league[lg]
        n = s["bets"]
        wr = round(s["won"] / n * 100, 1) if n else 0
        edges = pred_edge.get(lg, [])
        avg_edge = round(sum(edges) / len(edges) * 100, 2) if edges else ""
        rows.append([
            lg, LEAGUES.get(lg, {}).get("name", lg),
            n, s["won"], wr,
            round(s["pnl"], 2),
            avg_edge,
            "", "", "",  # brier, clv, value_bets (calcolati separatamente)
            "Dixon-Coles v5.0",
            "",
        ])

    # Se nessun dato: aggiungi riga placeholder
    if len(rows) == 1:
        for lg, meta in LEAGUES.items():
            rows.append([lg, meta["name"], 0, 0, 0, 0, "", "", "", "", "Dixon-Coles v5.0", "no bets yet"])

    ws.update("A1", rows, value_input_option="RAW")
    fmt_header(ws, len(headers), "Model_Performance")

# ── 10. Context Module ────────────────────────────────────────────────────────

def build_context_module(sh: gspread.Spreadsheet):
    print("  🧩 Context_Module …")
    ws = get_or_create_ws(sh, "Context_Module")

    match_type_headers = [
        "match_type", "description",
        "stake_multiplier", "model_confidence_penalty",
        "typical_leagues", "auto_skip", "notes",
    ]
    match_type_data = [
        ["DERBY_NATIONAL",   "Derby nazionale/cittadino",                  0.70, -0.10, "PL/SA/PD/BL1/FL1", "No",  "Alta variabilità emotiva"],
        ["DERBY_REGIONAL",   "Derby regionale",                            0.80, -0.08, "Tutti",             "No",  ""],
        ["TITLE_DECIDER",    "Match decisivo per il titolo",               0.85, -0.05, "Top 5",             "No",  "Alta attenzione mediatica"],
        ["RELEGATION",       "Scontro diretto per salvezza",               0.80, -0.08, "Tutti",             "No",  "Alta motivazione squadre"],
        ["DEAD_RUBBER",      "Partita ininfluente a fine stagione",        0.50, -0.15, "Tutti",             "No",  "Rotazioni probabili"],
        ["CUP_SPILLOVER",    "Effetto Coppa (giocato su campo neutro o dopo coppa)", 0.75, -0.10, "CL/EL",  "No",  ""],
        ["NEUTRAL_VENUE",    "Campo neutro (finale/gara unica)",           0.75, -0.08, "CL/EL",             "No",  ""],
        ["SHORT_REST",       "Una squadra con <72h da ultimo match",       0.75, -0.08, "Tutti",             "No",  ""],
        ["EUROPEAN_HANGOVER","Dopo gara europea infrasettimanale",         0.80, -0.06, "Tutti",             "No",  ""],
        ["ROTATION",         "Rotazioni attese (coppa/stanchezza)",        0.60, -0.12, "Tutti",             "No",  ""],
        ["STANDARD",         "Partita standard senza fattori speciali",    1.00,  0.00, "Tutti",             "No",  ""],
    ]

    league_tier_headers = [
        "league", "league_name", "tier",
        "avg_market_efficiency", "liquidity_score",
        "recommended_edge_min_%",
        "notes",
    ]
    league_tier_data = [
        ["PL",  "Premier League",  1, 0.97, 0.95, 2.0, "Top 1 per liquidità Betfair"],
        ["SA",  "Serie A",         1, 0.95, 0.88, 2.0, ""],
        ["PD",  "La Liga",         1, 0.96, 0.90, 2.0, ""],
        ["BL1", "Bundesliga",      1, 0.95, 0.87, 2.0, ""],
        ["FL1", "Ligue 1",         1, 0.93, 0.82, 2.5, ""],
        ["CL",  "Champions League",2, 0.96, 0.85, 2.5, "Alta efficienza pre-match"],
        ["EL",  "Europa League",   2, 0.90, 0.70, 3.0, ""],
    ]

    rows = (
        [["=== MATCH TYPE FACTORS (v5.0) ==="]]
        + [match_type_headers]
        + match_type_data
        + [[]]
        + [["=== LEAGUE TIER CONFIGURATION ==="]]
        + [league_tier_headers]
        + league_tier_data
    )
    ws.update("A1", rows, value_input_option="RAW")
    ws.format("A1", {"textFormat": {"bold": True, "fontSize": 12}})
    ws.format("A2:G2", {
        "backgroundColor": TAB_COLORS["Context_Module"],
        "textFormat": {"bold": True, "foregroundColor": {"red":1,"green":1,"blue":1}},
    })
    header_row_league = len(match_type_data) + 4
    ws.format(f"A{header_row_league}:G{header_row_league}", {
        "backgroundColor": TAB_COLORS["Context_Module"],
        "textFormat": {"bold": True, "foregroundColor": {"red":1,"green":1,"blue":1}},
    })
    note_row = len(match_type_data) + 3
    ws.format(f"A{note_row}", {"textFormat": {"bold": True, "fontSize": 12}})

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Popola il Google Sheets database di Agentic Markets")
    parser.add_argument("--only", choices=[
        "readme","match_results","team_stats","league_stats",
        "odds","predictions","bets","pnl","performance","context"
    ], help="Aggiorna solo un tab specifico")
    parser.add_argument("--refresh-live", action="store_true",
                        help="Aggiorna solo Predictions_Log e Bets_Log dal DB")
    parser.add_argument("--no-fetch", action="store_true",
                        help="Non scaricare dati da football-data.org (usa solo struttura)")
    args = parser.parse_args()

    if not FDORG_API_KEY and not args.no_fetch:
        print("⚠️  FOOTBALL_DATA_ORG_API_KEY non impostata. Uso --no-fetch automaticamente.")
        args.no_fetch = True

    print("🔐 Autenticazione Google Sheets …")
    gc = get_gspread_client()
    sh = gc.open_by_key(SPREADSHEET_ID)
    print(f"✅ Connesso a: {sh.title}")

    # ── Fetch 5 anni di match data ────────────────────────────────────────────
    all_matches: list[dict] = []

    if not args.no_fetch and not args.refresh_live:
        print("\n📡 Download dati storici da football-data.org …")
        total_calls = len(LEAGUES) * len(SEASONS)
        call_n = 0
        t_batch_start = time.time()

        for league in LEAGUES:
            for season in SEASONS:
                call_n += 1
                print(f"  [{call_n}/{total_calls}] {league} {season} …", end=" ", flush=True)
                ms = fetch_matches(league, season)
                print(f"{len(ms)} match")
                all_matches.extend(ms)
                # Rate limit: 10 req/min → 6s/req
                elapsed = time.time() - t_batch_start
                if call_n % 10 == 0 and elapsed < 62:
                    wait = 62 - elapsed
                    print(f"  ⏳ rate limit window — attendo {wait:.0f}s …")
                    time.sleep(wait)
                    t_batch_start = time.time()
                else:
                    time.sleep(6.5)

        print(f"\n✅ {len(all_matches)} match totali scaricati")

    # ── Fetch dati live dal DB ────────────────────────────────────────────────
    pred_rows, bets_rows = [], []
    if args.refresh_live or (not args.only) or args.only in ("predictions","bets","pnl","performance"):
        print("\n🗄️  Fetch dal DB Neon …")
        pred_rows = asyncio.run(fetch_predictions_from_db())
        bets_rows = asyncio.run(fetch_bets_from_db())
        print(f"  → {len(pred_rows)} predictions, {len(bets_rows)} bets")

    # ── Populate sheets ───────────────────────────────────────────────────────
    print("\n📝 Scrittura Google Sheets …")
    only = args.only

    if not only or only == "readme":
        build_readme(sh)

    if not only or only == "match_results":
        build_match_results(sh, all_matches)

    if not only or only == "team_stats":
        build_team_stats(sh, all_matches)

    if not only or only == "league_stats":
        build_league_stats(sh, all_matches)

    if not only or only == "odds":
        build_odds_calibration(sh)

    if not only or only == "predictions":
        build_predictions_log(sh, pred_rows)

    if not only or only == "bets":
        build_bets_log(sh, bets_rows)

    if not only or only == "pnl":
        build_pnl_monthly(sh, bets_rows)

    if not only or only == "performance":
        build_model_performance(sh, bets_rows, pred_rows)

    if not only or only == "context":
        build_context_module(sh)

    # Rimuovi Sheet1 default se esiste
    try:
        sh.del_worksheet(sh.worksheet("Sheet1"))
    except Exception:
        pass

    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
    print(f"\n✅ Done! Apri il foglio:\n   {url}\n")

if __name__ == "__main__":
    main()
