"""Sync free historical datasets used by the prediction backtests.

Sources:
- Jeff Sackmann ATP/WTA match CSVs on GitHub.
- football-data.co.uk season CSVs with results and closing odds.

Run:
  .venv/bin/python -m scripts.sync_historical_data_sources
  .venv/bin/python -m scripts.sync_historical_data_sources --from-year 2021 --to-year 2026
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import DIVISION_MAP, download_csv as download_fd_csv, parse_csv as parse_fd_csv  # noqa: E402
from core.tennis_data import TOURS, download_csv as download_tennis_csv, parse_csv as parse_tennis_csv  # noqa: E402

FOOTBALL_LEAGUES = ("PL", "BL1", "SA", "PD", "FL1")


@dataclass
class SyncResult:
    sport: str
    source: str
    key: str
    year: int
    status: str
    rows: int = 0
    file: str | None = None
    error: str | None = None


def _error_message(exc: Exception) -> str:
    if isinstance(exc, HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, URLError):
        return str(exc.reason)
    return str(exc)


def sync_tennis(from_year: int, to_year: int, dry_run: bool = False) -> list[SyncResult]:
    out_dir = ROOT / "data" / "tennis"
    out_dir.mkdir(parents=True, exist_ok=True)
    results: list[SyncResult] = []

    for tour in TOURS:
        for year in range(from_year, to_year + 1):
            key = tour.upper()
            fp = out_dir / f"{tour}_{year}.csv"
            try:
                text = download_tennis_csv(tour, year)
                rows = len(parse_tennis_csv(text, tour))
                if rows <= 0:
                    results.append(SyncResult("tennis", "jeff_sackmann", key, year, "empty", file=str(fp)))
                    continue
                if not dry_run:
                    fp.write_text(text, encoding="utf-8")
                results.append(SyncResult("tennis", "jeff_sackmann", key, year, "synced", rows, str(fp)))
            except Exception as exc:  # noqa: BLE001
                results.append(SyncResult("tennis", "jeff_sackmann", key, year, "skipped", error=_error_message(exc)))
    return results


def sync_football_data_uk(from_year: int, to_year: int, dry_run: bool = False) -> list[SyncResult]:
    out_dir = ROOT / "data" / "football_data_uk"
    out_dir.mkdir(parents=True, exist_ok=True)
    results: list[SyncResult] = []

    for league in FOOTBALL_LEAGUES:
        division = DIVISION_MAP[league]
        for year in range(from_year, to_year + 1):
            fp = out_dir / f"{league}_{division}_{year}.csv"
            try:
                text = download_fd_csv(league, year)
                rows = len(parse_fd_csv(text, league))
                if rows <= 0:
                    results.append(SyncResult("football", "football-data.co.uk", league, year, "empty", file=str(fp)))
                    continue
                if not dry_run:
                    fp.write_text(text, encoding="utf-8")
                results.append(SyncResult("football", "football-data.co.uk", league, year, "synced", rows, str(fp)))
            except Exception as exc:  # noqa: BLE001
                results.append(SyncResult("football", "football-data.co.uk", league, year, "skipped", error=_error_message(exc)))
    return results


def summarize(results: list[SyncResult]) -> dict:
    synced = [r for r in results if r.status == "synced"]
    skipped = [r for r in results if r.status == "skipped"]
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "synced_files": len(synced),
        "synced_rows": sum(r.rows for r in synced),
        "skipped_files": len(skipped),
        "by_source": {
            source: {
                "files": sum(1 for r in synced if r.source == source),
                "rows": sum(r.rows for r in synced if r.source == source),
            }
            for source in sorted({r.source for r in results})
        },
        "results": [asdict(r) for r in results],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-year", type=int, default=2021)
    parser.add_argument("--to-year", type=int, default=datetime.now(UTC).year)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--tennis-only", action="store_true")
    parser.add_argument("--football-only", action="store_true")
    args = parser.parse_args()

    results: list[SyncResult] = []
    if not args.football_only:
        results.extend(sync_tennis(args.from_year, args.to_year, args.dry_run))
    if not args.tennis_only:
        results.extend(sync_football_data_uk(args.from_year, args.to_year, args.dry_run))

    report = summarize(results)
    out_dir = ROOT / "reports"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / "data_source_sync_latest.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"\nSaved: {out}")


if __name__ == "__main__":
    main()
