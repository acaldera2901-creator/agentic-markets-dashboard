"""
Squad Condition Watch — storage writer + collector piggyback (① of the spec).

Pulls the condition inputs that are already free + cached in the stack (ESPN
squads/injuries via espn_soccer_client, Track A wc_squad_snapshots diff,
optional transfermarkt valuations), builds a per-team report with the pure
core.squad_condition functions, and appends it to squad_condition_reports
ONLY when the condition fingerprint changes (insert-on-change, like
prediction_log / wc_squad_snapshots).

Fail-soft contract (identical to wc_squad_sync.sync_rosters): provider /
Supabase / data errors are logged and reported in the returned summary —
sync_squad_condition() NEVER raises into the DataCollector cycle, and a single
team's failure never sinks the sweep. Zero extra HTTP for squads (the coverage
pass already warmed the 6h ESPN cache); the only new round trips are the small
Supabase reads/writes.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

import httpx

from core import squad_condition as sc
from core.espn_soccer_client import get_team_squad, get_world_cup_teams
from core.supabase_client import _rest_base, _service_headers
from core.world_cup_history import canonical_team_name

logger = logging.getLogger("squad_condition_sync")

SOURCE = "espn"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def report_hash(report: dict) -> str:
    """Order-insensitive fingerprint over the meaningful condition fields.

    Insert-on-change key: a row is appended only when injuries, callup diff or
    the availability bucket changes. Availability is bucketed to 2 decimals so
    valuation noise (€-level wobble) does not flap a new snapshot every cycle.
    """
    avail = report.get("availability_ratio")
    fingerprint = {
        "injuries": sorted(report.get("injuries") or []),
        "diff": report.get("recent_diff"),
        "avail_bucket": round(avail, 2) if isinstance(avail, (int, float)) else None,
        "rotation": bool(report.get("rotation_flag")),
    }
    return hashlib.sha256(
        json.dumps(fingerprint, sort_keys=True, ensure_ascii=True).encode()
    ).hexdigest()


async def _latest_diff(client, base, headers, team_canonical) -> dict | None:
    """Latest Track A snapshot diff for one team (None when no history)."""
    resp = await client.get(
        f"{base}/wc_squad_snapshots",
        params={
            "select": "diff",
            "team_canonical": f"eq.{team_canonical}",
            "source": f"eq.{SOURCE}",
            "order": "captured_at.desc",
            "limit": "1",
        },
        headers=headers,
    )
    if resp.status_code != 200:
        return None
    rows = resp.json() or []
    return rows[0].get("diff") if rows else None


def _build_report(team_canonical: str, squad: dict, recent_diff: dict | None) -> dict:
    """Build the condition report from a cached ESPN squad + Track A diff.

    XI-value math runs only if local transfermarkt valuations are present and
    cover enough of the roster; otherwise xi_value/best11/availability stay None
    (fail-soft). For nationals the valuation is per-player by name (spec §1).
    """
    players = squad.get("players") or []
    injured = [p.get("name") for p in players if p.get("injured") and p.get("name")]
    names = [p.get("name") for p in players if p.get("name")]

    vals = sc.load_valuations()
    xi_v = best11_v = None
    if vals.loaded and names:
        vmap = vals.as_map(names)
        # No confirmed XI pre-lineup: the expected-XI proxy is the squad's
        # TOP-11 BY VALUE (ratio = 1.0 -> availability KNOWN, rotation flag
        # honestly off: without a confirmed lineup there is no rotation
        # information). BUG FIX (review 2026-06-07): names[:11] era l'ordine
        # lista ESPN, non il top-11 -> ratio ~0.3-0.5 e "rotation" falso su
        # ogni squadra. Il ratio diventa informativo solo quando un XI
        # CONFERMATO (ESPN T-1h) sostituisce il proxy.
        ranked = sorted(names, key=lambda n: vmap.get(n, 0.0), reverse=True)
        xi_v = sc.xi_value(ranked[:11] if len(ranked) >= 11 else ranked, vmap)
        best11_v = sc.best11_value(names, vmap)

    return sc.condition_report(
        team_canonical,
        injured_players=injured,
        squad_size=squad.get("squad_size"),
        recent_diff=recent_diff,
        xi_value=xi_v,
        best11_value=best11_v,
    )


def _report_row(team_canonical: str, report: dict, new_hash: str) -> dict:
    return {
        "team_canonical": team_canonical,
        "source": SOURCE,
        "report_hash": new_hash,
        "injured_count": report.get("injured_count"),
        "squad_size": report.get("squad_size"),
        "missing_players": report.get("injuries") or [],
        "recent_diff": report.get("recent_diff"),
        "xi_value": report.get("xi_value"),
        "best11_value": report.get("best11_value"),
        "availability_ratio": report.get("availability_ratio"),
        "rotation_flag": bool(report.get("rotation_flag")),
        "model_consumed": False,
        "captured_at": _now(),
    }


async def build_condition_map() -> dict[str, dict]:
    """In-memory {canonical_team -> condition report} from the cached squads.

    Diff-free (no DB): the why-layer needs injuries / XI-value ratio / rotation
    flag, all derivable from the cached ESPN roster + optional local valuations.
    Fail-soft: any team error is skipped, the function never raises. Reuses the
    6h ESPN cache warmed by the coverage pass — zero extra HTTP.
    """
    out: dict[str, dict] = {}
    try:
        teams = await get_world_cup_teams()
    except Exception:
        return out
    for team in teams or []:
        try:
            squad = await get_team_squad(team["id"])
            if not squad or not squad.get("players"):
                continue
            team_canonical = canonical_team_name(squad.get("team") or team["name"])
            out[team_canonical] = _build_report(team_canonical, squad, recent_diff=None)
        except Exception:
            continue
    return out


async def sync_squad_condition() -> dict:
    """Append a fresh condition report per changed team. Returns a summary;
    NEVER raises (fail-soft contract with the collector cycle)."""
    summary = {
        "teams_seen": 0,
        "reports_written": 0,
        "errors": [],
        "skipped": False,
    }
    base = _rest_base()
    if not base:
        summary["skipped"] = True
        return summary
    headers = _service_headers()

    try:
        teams = await get_world_cup_teams()
    except Exception as exc:
        summary["errors"].append(f"teams:{exc}")
        return summary
    if not teams:
        summary["skipped"] = True
        return summary

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # current report hashes in one round trip (<=48 rows, latest per team
            # via a generous order+limit is overkill; we read the dedup key set)
            known: dict[str, set[str]] = {}
            resp = await client.get(
                f"{base}/squad_condition_reports",
                params={"select": "team_canonical,report_hash", "source": f"eq.{SOURCE}",
                        "order": "captured_at.desc", "limit": "2000"},
                headers=headers,
            )
            if resp.status_code == 200:
                for r in resp.json() or []:
                    known.setdefault(r["team_canonical"], set()).add(r["report_hash"])
            else:
                summary["errors"].append(f"scr_get:{resp.status_code}")

            for team in teams:
                try:
                    squad = await get_team_squad(team["id"])
                    if not squad or not squad.get("players"):
                        continue
                    summary["teams_seen"] += 1
                    team_canonical = canonical_team_name(squad.get("team") or team["name"])
                    recent_diff = await _latest_diff(client, base, headers, team_canonical)
                    report = _build_report(team_canonical, squad, recent_diff)
                    new_hash = report_hash(report)
                    if new_hash in known.get(team_canonical, set()):
                        continue  # condition unchanged — zero writes
                    row = _report_row(team_canonical, report, new_hash)
                    resp = await client.post(
                        f"{base}/squad_condition_reports",
                        params={"on_conflict": "team_canonical,source,report_hash"},
                        json=row,
                        headers={**headers, "Prefer": "resolution=ignore-duplicates"},
                    )
                    if resp.status_code in (200, 201, 204):
                        summary["reports_written"] += 1
                    else:
                        summary["errors"].append(f"{team_canonical}:write_{resp.status_code}")
                except Exception as exc:  # one team must not sink the sweep
                    summary["errors"].append(f"{team.get('name')}:{exc}")
    except Exception as exc:
        summary["errors"].append(f"client:{exc}")

    if summary["reports_written"]:
        logger.info(
            "Squad condition sync: %d/%d teams changed -> reports written",
            summary["reports_written"], summary["teams_seen"],
        )
    return summary
