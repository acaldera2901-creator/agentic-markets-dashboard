"""Backfill (referee, total cards) per fixture for ALL leagues + WC → local file.

Extends the referee card-rate table beyond the Premier League (football-data.co.uk had
Referee only for PL). Referee comes from the local fixtures cache; total cards (yellow+red,
both teams) from API-Football /fixtures/statistics (DIRECT host, Ultra). Writes
data/referee_cards_backfill.json = {fixture_id: {league, date, referee, cards}}.
Feeds scripts/build_referee_rates.py to cover every league + the World Cup.

Resumable. Run:  .venv/bin/python -m scripts.backfill_referee_cards PL BL1 FL1 PD SA WC
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / "data" / "api_football"
OUT = ROOT / "data" / "referee_cards_backfill.json"
_DIRECT = "v3.football.api-sports.io"
SEASONS = {"WC": [2026], "_default": [2022, 2023, 2024, 2025]}


def _key() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.strip() and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))
    return os.environ.get("API_FOOTBALL_DIRECT_KEY") or os.environ.get("API_FOOTBALL_KEY") or ""


def total_cards(fixture_id: int, key: str) -> int | None:
    req = urllib.request.Request(f"https://{_DIRECT}/fixtures/statistics?fixture={fixture_id}",
                                 headers={"x-apisports-key": key})
    resp = json.loads(urllib.request.urlopen(req, timeout=25).read()).get("response", [])  # noqa: S310
    if not resp:
        return None
    tot = 0
    for tb in resp:
        for s in tb.get("statistics") or []:
            if s.get("type") in ("Yellow Cards", "Red Cards"):
                tot += int(s.get("value") or 0)
    return tot


def run(leagues: list[str]) -> None:
    key = _key()
    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    for lg in leagues:
        for season in SEASONS.get(lg, SEASONS["_default"]):
            fp = FIX / f"fixtures_{lg}_{season}.json"
            if not fp.exists():
                continue
            data = json.loads(fp.read_text())
            arr = data.get("response") if isinstance(data, dict) else data
            n = 0
            for r in arr or []:
                fx = r.get("fixture") or {}
                if (fx.get("status") or {}).get("short") != "FT":
                    continue
                fid = str(fx.get("id"))
                ref = (fx.get("referee") or "").strip()
                if not fid or not ref or fid in existing:
                    continue
                try:
                    c = total_cards(int(fid), key)
                    if c is None:
                        continue
                    existing[fid] = {"league": lg, "date": (fx.get("date") or "")[:10], "referee": ref, "cards": c}
                    n += 1
                    if n % 50 == 0:
                        OUT.write_text(json.dumps(existing)); print(f"  {lg} {season}: {n} …", flush=True)
                except Exception as exc:  # noqa: BLE001
                    print(f"  ! {fid}: {exc!r}", flush=True)
            OUT.write_text(json.dumps(existing))
            print(f"{lg} {season}: +{n} (total {len(existing)})", flush=True)
    print(f"DONE — {len(existing)} fixtures with (referee, cards) -> {OUT.name}", flush=True)


if __name__ == "__main__":
    run(sys.argv[1:] or ["PL", "BL1", "FL1", "PD", "SA", "WC"])
