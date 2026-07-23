"""Add the Italian Serie B (I2) entry to data/summer_leagues/history.json.

#SERIE-B-1. Serie B is NOT on the football-data.org free tier, so it rides the
same "off-free-tier" club pipeline as the summer leagues (lib/summer-leagues.ts):
shipped history snapshot + ESPN fixtures + The Odds API 1X2. This script builds
ONLY the history snapshot input.

Source: football-data.co.uk division I2 (results + closing odds), parsed by the
existing core/football_data_uk.py. Team names are remapped to ESPN `ita.2`
displayNames (fuzzy, normalized) so the Poisson model built on this history finds
exactly the names ESPN returns at serve-time; unmapped names stay as the CSV name
(harmless — those teams simply won't match a fixture) and are reported for review.

Window: last 365 days (same as gen_summer_league_history.py) -> the current
Serie B season. Merges into the EXISTING snapshot without regenerating the other
five leagues (their source CSVs live on the lab machine, not here): reads the
file, replaces/creates the "SB" league, preserves everything else and the
top-level generated_at.

Run: venv/bin/python scripts/gen_serie_b_history.py
No new deps (stdlib + core/). Network: football-data.co.uk I2, ESPN ita.2/teams.
"""
from __future__ import annotations

import json
import sys
import unicodedata
import urllib.request
from datetime import date, timedelta
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core import football_data_uk as fd  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "data" / "summer_leagues" / "history.json"
ESPN_SLUG = "ita.2"
WINDOW_DAYS = 365
# Seasons to scan for last-365d coverage (start years). Two seasons so the window
# is fully covered whatever the calendar date.
SEASONS = [date.today().year - 1, date.today().year]
STOP = {"fc", "if", "ik", "bk", "afc", "sk", "fk", "ff", "aif", "cf", "sc",
        "club", "cd", "us", "ac", "as", "ssc", "ss", "calcio", "hellas"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    words = [w for w in s.lower().replace("/", " ").replace("-", " ").split() if w not in STOP]
    return " ".join(words)


def espn_teams(slug: str) -> list[str]:
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = json.load(r)
    out = []
    for lg in data.get("sports", [{}])[0].get("leagues", []):
        for t in lg.get("teams", []):
            dn = t.get("team", {}).get("displayName")
            if dn:
                out.append(dn)
    return out


def make_mapper(espn: list[str]):
    espn_norm = {norm(n): n for n in espn}

    def map_name(csv_name: str) -> tuple[str, bool]:
        n = norm(csv_name)
        if n in espn_norm:
            return espn_norm[n], True
        for en, orig in espn_norm.items():
            if n and (n in en or en in n):
                return orig, True
        best, score = None, 0.0
        for en, orig in espn_norm.items():
            r = SequenceMatcher(None, n, en).ratio()
            if r > score:
                best, score = orig, r
        if best and score >= 0.72:
            return best, True
        return csv_name, False

    return map_name


def main() -> None:
    since = date.today() - timedelta(days=WINDOW_DAYS)
    espn = espn_teams(ESPN_SLUG)
    print(f"ESPN {ESPN_SLUG}: {len(espn)} teams")
    map_name = make_mapper(espn)

    fdms: list[fd.FDMatch] = []
    for yr in SEASONS:
        try:
            fdms.extend(fd.parse_csv(fd.download_csv("SB", yr), "SB"))
        except Exception as e:  # noqa: BLE001
            print(f"  ! I2 {yr} download failed: {e}")

    matches, unmatched = [], set()
    for m in fdms:
        if m.date < since:
            continue
        h, hm = map_name(m.home_team)
        a, am = map_name(m.away_team)
        if not hm:
            unmatched.add(m.home_team)
        if not am:
            unmatched.add(m.away_team)
        matches.append({
            "homeTeam": h, "awayTeam": a,
            "homeGoals": m.home_goals, "awayGoals": m.away_goals,
            "date": m.date.isoformat(),
        })

    print(f"SB: {len(matches)} matches in last {WINDOW_DAYS}d "
          f"({since} .. {date.today()}) · unmatched CSV names: {sorted(unmatched) or 'NONE'}")
    if len(matches) < 100:
        print("  ! WARNING: unexpectedly few matches — check the season window.")

    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    snapshot.setdefault("leagues", {})["SB"] = {"espn_slug": ESPN_SLUG, "matches": matches}
    snapshot.setdefault("unmatched", {})["SB"] = sorted(unmatched)
    SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")
    print(f"merged SB into {SNAPSHOT} ({SNAPSHOT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
