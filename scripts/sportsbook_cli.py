#!/usr/bin/env python3
"""CLI scraping odds Stake/Roobet (#SPORTSBOOK-SCRAPER-1).

Uso:
  python scripts/sportsbook_cli.py --book roobet [--sport soccer|tennis|all] [--json] [--limit N]

Misura interim (scraping non autorizzato) fino ai contratti — vedi
docs/superpowers/specs/2026-06-11-sportsbook-scraper-design.md.
Roobet: implementato (feed BetBy/sptpub). Stake: in corso (stake.it ADM).
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.sportsbook.roobet import fetch_events as roobet_fetch


async def _gather(book: str):
    events = []
    if book in ("roobet", "all"):
        events += await roobet_fetch()
    if book in ("stake", "all"):
        print("[stake] non ancora implementato (spike stake.it/ADM in corso)", file=sys.stderr)
    return events


def _fmt(ev) -> str:
    a, b = (ev.competitors + ["?", "?"])[:2]
    parts = [f"[{ev.source}/{ev.sport}] {a} vs {b}"]
    if ev.sport == "soccer" and ev.odds_home:
        parts.append(f"1X2 {ev.odds_home}/{ev.odds_draw}/{ev.odds_away}")
    elif ev.odds_home:
        parts.append(f"ML {ev.odds_home}/{ev.odds_away}")
    if ev.total_line is not None:
        parts.append(f"O/U {ev.total_line}: {ev.total_over}/{ev.total_under}")
    return "  ".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description="Scraping odds Stake/Roobet")
    ap.add_argument("--book", choices=["roobet", "stake", "all"], default="roobet")
    ap.add_argument("--sport", choices=["soccer", "tennis", "all"], default="all")
    ap.add_argument("--json", action="store_true", help="output JSON invece di tabella")
    ap.add_argument("--limit", type=int, default=0, help="max eventi (0 = tutti)")
    args = ap.parse_args()

    events = asyncio.run(_gather(args.book))
    if args.sport != "all":
        events = [e for e in events if e.sport == args.sport]
    if args.limit:
        events = events[: args.limit]

    if args.json:
        json.dump([e.to_dict() for e in events], sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    else:
        for e in events:
            print(_fmt(e))
        print(f"\n{len(events)} eventi.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
