"""Backfill per-player per-match stats to LOCAL disk (NO DB writes) for the
goalscorer calibration backtest.

Legit source (API-Football /fixtures/players, Ultra plan 75k/day) — no scraping,
no bot bypass (FBref/Understat are Cloudflare-locked). Fixture IDs come from the
LOCAL fixtures cache (data/api_football/fixtures_*.json) → 0 calls to list them.
Writes goals+minutes per player per fixture to data/player_backfill/<league>_<season>.json.

NB: distinct from scripts/backfill_player_stats.py (that one writes PROFILES to the
shared Supabase and is GATED). This one is read-only w.r.t. the DB — local files only.

Resumable (skips cached fixtures). Run:
  .venv/bin/python -m scripts.backfill_player_match_local PL 2023 2024
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.player_data_sync import _parse_fixture_players  # noqa: E402

FIX_CACHE = ROOT / "data" / "api_football"
OUT_DIR = ROOT / "data" / "player_backfill"

# /fixtures/players is EMPTY on the RapidAPI host the client uses; the DIRECT host
# (Ultra plan) returns full player stats. Fetch directly here.
_DIRECT = "v3.football.api-sports.io"


def _key() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.strip() and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))
    return os.environ.get("API_FOOTBALL_DIRECT_KEY") or os.environ.get("API_FOOTBALL_KEY") or ""


def get_fixture_player_stats(fixture_id: int, key: str) -> list[dict]:
    req = urllib.request.Request(
        f"https://{_DIRECT}/fixtures/players?fixture={fixture_id}",
        headers={"x-apisports-key": key},
    )
    with urllib.request.urlopen(req, timeout=25) as r:  # noqa: S310 (trusted host)
        return json.loads(r.read()).get("response", [])


def fixtures_from_cache(league: str, season: int) -> list[dict]:
    fp = FIX_CACHE / f"fixtures_{league}_{season}.json"
    if not fp.exists():
        print(f"  ! no fixtures cache {fp.name}")
        return []
    data = json.loads(fp.read_text())
    arr = data.get("response") if isinstance(data, dict) else data
    out = []
    for r in arr or []:
        fx = r.get("fixture") or {}
        if (fx.get("status") or {}).get("short") != "FT":
            continue
        out.append({
            "fixture_id": fx.get("id"), "date": (fx.get("date") or "")[:10],
            "home": ((r.get("teams") or {}).get("home") or {}).get("name"),
            "away": ((r.get("teams") or {}).get("away") or {}).get("name"),
            "gh": (r.get("goals") or {}).get("home"), "ga": (r.get("goals") or {}).get("away"),
        })
    out.sort(key=lambda x: x["date"])
    return [x for x in out if x["fixture_id"]]


async def backfill(league: str, season: int) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_fp = OUT_DIR / f"{league}_{season}.json"
    existing = json.loads(out_fp.read_text()) if out_fp.exists() else {}
    key = _key()
    fixtures = fixtures_from_cache(league, season)
    print(f"{league} {season}: {len(fixtures)} FT fixtures, {len(existing)} cached", flush=True)
    done = 0
    for fx in fixtures:
        fid = str(fx["fixture_id"])
        if fid in existing:
            continue
        try:
            raw = get_fixture_player_stats(fx["fixture_id"], key)
            rows = _parse_fixture_players(fx["fixture_id"], league, fx["date"], raw)
            existing[fid] = {
                "date": fx["date"], "home": fx["home"], "away": fx["away"],
                "gh": fx["gh"], "ga": fx["ga"],
                "players": [{"id": r.player_id, "team": r.team, "min": r.minutes, "goals": r.goals} for r in rows],
            }
            done += 1
            if done % 25 == 0:
                out_fp.write_text(json.dumps(existing))
                print(f"  … {done} fetched (last {fx['date']}: {len(rows)} players)", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"  ! {fid}: {exc!r}", flush=True)
    out_fp.write_text(json.dumps(existing))
    print(f"{league} {season}: DONE, {len(existing)} fixtures -> {out_fp.name}", flush=True)


async def main() -> None:
    args = sys.argv[1:]
    if len(args) < 2:
        print("usage: backfill_player_match_local.py <LEAGUE> <SEASON> [<SEASON> ...]")
        return
    for s in args[1:]:
        await backfill(args[0], int(s))


if __name__ == "__main__":
    asyncio.run(main())
