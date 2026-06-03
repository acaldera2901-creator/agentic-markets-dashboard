"""Scrape historical match xG from Understat — RUN FROM ANDREA'S NETWORK.

Understat is bot-blocked from the build environment (returns an 18KB stub), so
this script is meant to be run locally by Andrea on his own connection:

    venv/bin/python -m scripts.scrape_understat_xg

It fetches each league/season page, extracts the embedded `datesData` JSON
(per-match xG), and writes one CSV per league/season to data/understat/.
Polite: a delay between requests and a real User-Agent. Output schema:

    date, home_team, away_team, home_xg, away_xg, home_goals, away_goals

Once data/understat/ is populated, the xG feature can be joined to the
football-data.co.uk matches (team-name mapping) and added to the feature backtest.
"""
from __future__ import annotations

import csv
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "understat"

# Understat league slug -> our internal league code (for later joining)
LEAGUES = {
    "EPL": "PL",
    "La_liga": "PD",
    "Bundesliga": "BL1",
    "Serie_A": "SA",
    "Ligue_1": "FL1",
}
SEASONS = [2021, 2022, 2023, 2024]  # start year (2023 = 2023/24)
REQUEST_DELAY_S = 3.0

_DATES_RE = re.compile(r"datesData\s*=\s*JSON\.parse\('(.*?)'\)", re.DOTALL)


def fetch(url: str, timeout: float = 30.0) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return resp.read().decode("utf-8", errors="replace")


def extract_matches(html: str) -> list[dict]:
    m = _DATES_RE.search(html)
    if not m:
        return []
    raw = m.group(1).encode("utf-8").decode("unicode_escape")
    return json.loads(raw)


def scrape_league_season(slug: str, season: int) -> list[dict]:
    html = fetch(f"https://understat.com/league/{slug}/{season}")
    rows: list[dict] = []
    for d in extract_matches(html):
        if not d.get("isResult"):
            continue
        try:
            rows.append({
                "date": (d.get("datetime") or "")[:10],
                "home_team": d["h"]["title"],
                "away_team": d["a"]["title"],
                "home_xg": round(float(d["xG"]["h"]), 3),
                "away_xg": round(float(d["xG"]["a"]), 3),
                "home_goals": int(d["goals"]["h"]),
                "away_goals": int(d["goals"]["a"]),
            })
        except (KeyError, TypeError, ValueError):
            continue
    return rows


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for slug, code in LEAGUES.items():
        for season in SEASONS:
            try:
                rows = scrape_league_season(slug, season)
            except Exception as e:  # noqa: BLE001
                print(f"  ! {slug} {season}: {e}")
                time.sleep(REQUEST_DELAY_S)
                continue
            if not rows:
                print(f"  ? {slug} {season}: no data extracted (blocked?)")
                time.sleep(REQUEST_DELAY_S)
                continue
            fp = OUT / f"{code}_{slug}_{season}.csv"
            with fp.open("w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
            total += len(rows)
            print(f"  ✓ {slug} {season}: {len(rows)} matches -> {fp.name}")
            time.sleep(REQUEST_DELAY_S)
    print(f"\nDone. {total} matches with xG written to {OUT}")
    if total == 0:
        print("If everything was blocked here too, run this from a normal browser network.")


if __name__ == "__main__":
    main()
