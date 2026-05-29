# core/football_data_co_uk.py
"""
Football-data.co.uk — free historical match results + closing odds CSVs.
No API key. Rate limit: be polite (0.5s between requests).
URL: https://www.football-data.co.uk/mmz4281/{season}/{code}.csv
Season format: "2526" for 2025/26, "2425" for 2024/25.
"""
from __future__ import annotations
import io
import logging
import asyncio
from datetime import datetime
from typing import List, Dict

import httpx
import pandas as pd

logger = logging.getLogger("football_data_co_uk")
BASE = "https://www.football-data.co.uk/mmz4281"

LEAGUE_FILE_MAP = {
    "PL":  "E0",
    "SA":  "I1",
    "PD":  "SP1",
    "BL1": "D1",
    "FL1": "F1",
}

_ODDS_COLS = ["B365H", "BWH", "IWH", "PSH", "WHH"]


def _current_seasons(years_back: int = 3) -> List[str]:
    today = datetime.today()
    year = today.year % 100
    seasons = []
    for i in range(years_back):
        y2 = year - i
        y1 = y2 - 1
        seasons.append(f"{y1:02d}{y2:02d}")
    return seasons


async def fetch_historical(league_code: str, years_back: int = 3) -> List[Dict]:
    """
    Download historical CSVs for a league.
    Returns [{home_team, away_team, league, home_goals, away_goals, date,
              odds_home?, odds_draw?, odds_away?}].
    """
    file_code = LEAGUE_FILE_MAP.get(league_code)
    if not file_code:
        return []

    all_rows: List[Dict] = []
    seasons = _current_seasons(years_back)

    async with httpx.AsyncClient(timeout=20.0) as c:
        for season in seasons:
            url = f"{BASE}/{season}/{file_code}.csv"
            try:
                resp = await c.get(url)
                if resp.status_code != 200:
                    logger.debug("football-data.co.uk: %s → %s", url, resp.status_code)
                    continue
                df = pd.read_csv(io.StringIO(resp.text), on_bad_lines="skip")
                all_rows.extend(_parse_df(df, league_code))
                await asyncio.sleep(0.5)
            except Exception as exc:
                logger.debug("CSV fetch error %s: %s", url, exc)

    logger.info("football_data_co_uk: %d rows for %s", len(all_rows), league_code)
    return all_rows


def _parse_df(df: pd.DataFrame, league_code: str) -> List[Dict]:
    rows = []
    odds_col_h = next((c for c in _ODDS_COLS if c in df.columns), None)
    odds_col_d = odds_col_h.replace("H", "D") if odds_col_h else None
    odds_col_a = odds_col_h.replace("H", "A") if odds_col_h else None

    for _, row in df.iterrows():
        try:
            home = str(row.get("HomeTeam", "") or "").strip()
            away = str(row.get("AwayTeam", "") or "").strip()
            fthg = row.get("FTHG")
            ftag = row.get("FTAG")
            if not home or not away or pd.isna(fthg) or pd.isna(ftag):
                continue
            entry: Dict = {
                "home_team": home, "away_team": away, "league": league_code,
                "home_goals": int(fthg), "away_goals": int(ftag),
                "date": str(row.get("Date", "")),
            }
            if odds_col_h and odds_col_d and odds_col_a:
                oh = row.get(odds_col_h)
                od = row.get(odds_col_d)
                oa = row.get(odds_col_a)
                if not (pd.isna(oh) or pd.isna(od) or pd.isna(oa)):
                    entry["odds_home"] = float(oh)
                    entry["odds_draw"] = float(od)
                    entry["odds_away"] = float(oa)
            rows.append(entry)
        except (ValueError, TypeError):
            continue
    return rows
