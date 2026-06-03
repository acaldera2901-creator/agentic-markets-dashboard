"""Fetch historical match xG from Understat via its JSON endpoint (Playwright).

Understat dropped the old inline `datesData`; the data now comes from the XHR
endpoint /getLeagueData/{slug}/{season}, which requires the X-Requested-With
header and a Cloudflare-cleared session. We drive a real Chromium (Playwright):
navigate to the league page (clears Cloudflare), then fetch the endpoint from the
page context with the right header and parse the `dates` array (per-match xG).

    venv/bin/playwright install chromium   # one-off
    venv/bin/python -m scripts.scrape_understat_xg

Output (one CSV per league/season in data/understat/):
    date, home_team, away_team, home_xg, away_xg, home_goals, away_goals
"""
from __future__ import annotations

import csv
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "understat"

# Understat league slug -> our internal league code (for joining to football-data.co.uk)
LEAGUES = {"EPL": "PL", "La_liga": "PD", "Bundesliga": "BL1", "Serie_A": "SA", "Ligue_1": "FL1"}
SEASONS = [2021, 2022, 2023, 2024]  # start year (2023 = 2023/24)
REQUEST_DELAY_S = 2.0
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

_FETCH_JS = """async (u) => {
  const r = await fetch(u, {headers: {'X-Requested-With': 'XMLHttpRequest'}});
  return await r.text();
}"""


def _team_history_index(payload: dict) -> dict[tuple[str, str], dict]:
    """(date, team_title) -> {npxg, npxga, ppda} from the per-team history blocks."""
    idx: dict[tuple[str, str], dict] = {}
    for t in payload.get("teams", {}).values():
        title = t.get("title")
        for h in t.get("history", []):
            d = (h.get("date") or "")[:10]
            ppda = h.get("ppda") or {}
            att, dfn = ppda.get("att"), ppda.get("def")
            idx[(d, title)] = {
                "npxg": h.get("npxG"),
                "npxga": h.get("npxGA"),
                "ppda": (att / dfn) if att and dfn else None,  # passes allowed per def action (low=press)
            }
    return idx


def parse_payload(payload: dict) -> list[dict]:
    th = _team_history_index(payload)
    rows: list[dict] = []
    for d in payload.get("dates", []):
        if not d.get("isResult"):
            continue
        try:
            day = (d.get("datetime") or "")[:10]
            ht, at = d["h"]["title"], d["a"]["title"]
            h_stats, a_stats = th.get((day, ht), {}), th.get((day, at), {})
            rows.append({
                "date": day,
                "home_team": ht,
                "away_team": at,
                "home_xg": round(float(d["xG"]["h"]), 3),
                "away_xg": round(float(d["xG"]["a"]), 3),
                "home_goals": int(d["goals"]["h"]),
                "away_goals": int(d["goals"]["a"]),
                "home_npxg": h_stats.get("npxg"),
                "away_npxg": a_stats.get("npxg"),
                "home_ppda": h_stats.get("ppda"),
                "away_ppda": a_stats.get("ppda"),
            })
        except (KeyError, TypeError, ValueError):
            continue
    return rows


def fetch_league_season(page, slug: str, season: int) -> list[dict]:
    page.goto(f"https://understat.com/league/{slug}/{season}",
              wait_until="domcontentloaded", timeout=60000)
    text = page.evaluate(_FETCH_JS, f"https://understat.com/getLeagueData/{slug}/{season}")
    return parse_payload(json.loads(text))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=UA)
        for slug, code in LEAGUES.items():
            for season in SEASONS:
                try:
                    rows = fetch_league_season(page, slug, season)
                except Exception as e:  # noqa: BLE001
                    print(f"  ! {slug} {season}: {repr(e)[:120]}")
                    time.sleep(REQUEST_DELAY_S)
                    continue
                if not rows:
                    print(f"  ? {slug} {season}: no results yet")
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
        browser.close()
    print(f"\nDone. {total} matches with xG written to {OUT}")


if __name__ == "__main__":
    main()
