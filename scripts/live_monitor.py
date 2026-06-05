"""
Live monitor — keeps Agentic Markets observably live.

Complements scripts/agent_watchdog.py (which restarts dead local agents):
this script WATCHES the whole system from the outside and ALERTS Andrea on
Telegram when something changes state. It never mutates anything: read-only
HTTP GETs against prod + PostgREST reads against Supabase.

Checks
  1. prod public endpoints answer 200
  2. prod protected endpoints answer 401 to anonymous requests (auth intact)
  3. World Cup readiness gates (diagnostics endpoint) — alert on any flip
  4. agent heartbeats freshness in Supabase (PostgREST, service role)
  5. Vercel refresh-cron freshness (latest unified_predictions.updated_at)

Alerting
  - Telegram via core.telegram_client.send (TELEGRAM_* already in .env)
  - alerts fire on STATE TRANSITIONS only (ok->fail, fail->ok, gate flips),
    with a per-key cooldown so a flapping check cannot spam
  - full result of every run is appended to logs/live_monitor.log (JSONL)

Run:  venv/bin/python scripts/live_monitor.py [--dry-run]
  --dry-run: print the report, never send Telegram, still updates state file
             unless --no-state is also passed.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

# Derive ROOT from this file's location (same pattern as agent_watchdog.py).
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import httpx

from config.settings import settings
from core import telegram_client

LOG_PATH = ROOT / "logs/live_monitor.log"
STATE_PATH = ROOT / "logs/live_monitor_state.json"

DASHBOARD_URL = (settings.DASHBOARD_URL or "https://agentic-markets-roan.vercel.app").rstrip("/")

# endpoint -> expected HTTP status for an ANONYMOUS GET
PUBLIC_ENDPOINTS = {
    "/": 200,
    "/api/v2/predictions": 200,
    "/api/v2/history": 200,
    "/api/leaderboard": 200,
}
PROTECTED_ENDPOINTS = {
    "/api/data": 401,
    "/api/diagnostics/world-cup": 401,
}

HEARTBEAT_STALE_SECONDS = 15 * 60       # agents heartbeat every cycle (<5 min)
CRON_STALE_SECONDS = 3 * 60 * 60        # refresh cron runs every 2h
ALERT_COOLDOWN_SECONDS = 30 * 60        # per-key alert cooldown
HTTP_TIMEOUT = 15.0

MONITORED_AGENTS = [
    "DataCollector", "ModelAgent", "AnalystAgent", "StrategistAgent",
    "RiskManagerAgent", "TraderAgent", "MonitorAgent", "ResearchAgent",
    "AHCollectorAgent", "ResultSettlementAgent",
    "TennisDataCollectorAgent", "TennisModelAgent", "TennisAnalystAgent",
    "TennisRiskManagerAgent", "TennisTraderAgent", "TennisSettlementAgent",
    "TennisResearchAgent",
]


def log(event: str, **fields) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"ts": datetime.now(UTC).isoformat(), "event": event, **fields}
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, sort_keys=True, default=str) + "\n")


def load_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


async def check_endpoints(client: httpx.AsyncClient) -> dict[str, dict]:
    """GET every endpoint anonymously; ok = status matches expectation."""
    results: dict[str, dict] = {}
    for path, expected in {**PUBLIC_ENDPOINTS, **PROTECTED_ENDPOINTS}.items():
        key = f"endpoint:{path}"
        try:
            r = await client.get(f"{DASHBOARD_URL}{path}")
            results[key] = {
                "ok": r.status_code == expected,
                "detail": f"{path} -> {r.status_code} (expected {expected})",
            }
        except Exception as exc:
            results[key] = {"ok": False, "detail": f"{path} -> {type(exc).__name__}: {exc}"}
    return results


async def check_wc_gates(client: httpx.AsyncClient) -> tuple[dict[str, bool] | None, dict[str, dict]]:
    """Fetch WC readiness with RESEARCH_SECRET. Returns (gates, check_results)."""
    key = "wc:diagnostics"
    if not settings.RESEARCH_SECRET:
        return None, {key: {"ok": False, "detail": "RESEARCH_SECRET not configured locally"}}
    try:
        r = await client.get(
            f"{DASHBOARD_URL}/api/diagnostics/world-cup",
            headers={"Authorization": f"Bearer {settings.RESEARCH_SECRET}"},
        )
        if r.status_code != 200:
            # 401 here means the local secret is stale vs prod — a real incident
            # we have already been bitten by (rotation without .env update).
            return None, {key: {"ok": False, "detail": f"diagnostics -> {r.status_code} (local RESEARCH_SECRET stale?)"}}
        gates = r.json()["world_cup"]["readiness"]
        return {k: bool(v) for k, v in gates.items()}, {key: {"ok": True, "detail": "diagnostics 200"}}
    except Exception as exc:
        return None, {key: {"ok": False, "detail": f"diagnostics -> {type(exc).__name__}: {exc}"}}


def _postgrest_headers() -> dict[str, str]:
    k = settings.SUPABASE_SERVICE_ROLE_KEY
    return {"apikey": k, "Authorization": f"Bearer {k}"}


async def check_heartbeats(client: httpx.AsyncClient) -> dict[str, dict]:
    """Read agent_heartbeats via PostgREST; stale/missing agents fail."""
    key = "agents:heartbeats"
    if not (settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY):
        return {key: {"ok": False, "detail": "SUPABASE_URL/SERVICE_ROLE_KEY not configured"}}
    try:
        r = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/agent_heartbeats",
            params={"select": "agent_name,last_seen"},
            headers=_postgrest_headers(),
        )
        r.raise_for_status()
        now = datetime.now(UTC)
        seen: dict[str, float] = {}
        for row in r.json():
            try:
                ts = datetime.fromisoformat(row["last_seen"].replace("Z", "+00:00"))
                seen[row["agent_name"]] = (now - ts).total_seconds()
            except Exception:
                continue
        stale = [
            f"{name} ({int(seen[name] // 60)}m)" if name in seen else f"{name} (missing)"
            for name in MONITORED_AGENTS
            if seen.get(name, float("inf")) > HEARTBEAT_STALE_SECONDS
        ]
        if stale:
            return {key: {"ok": False, "detail": "stale heartbeats: " + ", ".join(stale)}}
        return {key: {"ok": True, "detail": f"{len(MONITORED_AGENTS)} agents fresh"}}
    except Exception as exc:
        return {key: {"ok": False, "detail": f"heartbeats -> {type(exc).__name__}: {exc}"}}


async def check_cron_freshness(client: httpx.AsyncClient) -> dict[str, dict]:
    """Latest unified_predictions.updated_at must be younger than CRON_STALE_SECONDS."""
    key = "cron:refresh"
    if not (settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY):
        return {key: {"ok": False, "detail": "SUPABASE_URL/SERVICE_ROLE_KEY not configured"}}
    try:
        r = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/unified_predictions",
            params={"select": "updated_at", "order": "updated_at.desc", "limit": "1"},
            headers=_postgrest_headers(),
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return {key: {"ok": True, "detail": "unified_predictions empty (nothing to refresh yet)"}}
        ts = datetime.fromisoformat(rows[0]["updated_at"].replace("Z", "+00:00"))
        age = (datetime.now(UTC) - ts).total_seconds()
        ok = age < CRON_STALE_SECONDS
        return {key: {"ok": ok, "detail": f"latest refresh {int(age // 60)}m ago (limit {CRON_STALE_SECONDS // 60}m)"}}
    except Exception as exc:
        return {key: {"ok": False, "detail": f"cron freshness -> {type(exc).__name__}: {exc}"}}


def diff_and_alert(results: dict[str, dict], gates: dict[str, bool] | None,
                   state: dict, dry_run: bool) -> list[str]:
    """Compare against previous run; return list of alert lines to send."""
    now = time.time()
    prev_results: dict = state.get("results", {})
    prev_gates: dict = state.get("wc_gates", {})
    cooldowns: dict = state.get("alert_ts", {})
    alerts: list[str] = []

    # Cooldown is per (key, direction): a flapping check alerts at most once
    # per direction per window, but a genuine recovery is never suppressed.
    def want_alert(key: str, direction: str) -> bool:
        return now - float(cooldowns.get(f"{key}|{direction}", 0)) > ALERT_COOLDOWN_SECONDS

    for key, res in results.items():
        prev_ok = prev_results.get(key, {}).get("ok")
        if prev_ok is None and res["ok"]:
            continue  # first sighting of a healthy check: stay quiet
        direction = "up" if res["ok"] else "down"
        if res["ok"] != prev_ok and want_alert(key, direction):
            icon = "✅" if res["ok"] else "🔴"
            alerts.append(f"{icon} {res['detail']}")
            cooldowns[f"{key}|{direction}"] = now

    if gates is not None:
        for gate, value in gates.items():
            prev = prev_gates.get(gate)
            direction = "up" if value else "down"
            if prev is not None and prev != value and want_alert(f"gate:{gate}", direction):
                icon = "🟢" if value else "🟠"
                alerts.append(f"{icon} WC gate <b>{gate}</b>: {prev} → {value}")
                cooldowns[f"gate:{gate}|{direction}"] = now
        state["wc_gates"] = gates

    state["results"] = {k: {"ok": v["ok"]} for k, v in results.items()}
    state["alert_ts"] = cooldowns
    state["last_run"] = datetime.now(UTC).isoformat()
    return alerts


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="print report, never send Telegram")
    parser.add_argument("--no-state", action="store_true", help="do not persist state (pure read)")
    args = parser.parse_args()

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=False) as client:
        endpoint_results = await check_endpoints(client)
        gates, wc_results = await check_wc_gates(client)
        hb_results = await check_heartbeats(client)
        cron_results = await check_cron_freshness(client)

    results = {**endpoint_results, **wc_results, **hb_results, **cron_results}
    failures = {k: v for k, v in results.items() if not v["ok"]}

    state = load_state()
    alerts = diff_and_alert(results, gates, state, args.dry_run)
    if not args.no_state:
        save_state(state)

    log("run", ok=not failures, failures={k: v["detail"] for k, v in failures.items()},
        gates=gates, alerts=len(alerts))

    if args.dry_run:
        print(f"== live_monitor {datetime.now(UTC).isoformat()} ==")
        for key, res in sorted(results.items()):
            print(f"  {'OK ' if res['ok'] else 'FAIL'}  {res['detail']}")
        if gates is not None:
            true_gates = sum(gates.values())
            print(f"  WC gates: {true_gates}/{len(gates)} TRUE — false: "
                  + (", ".join(k for k, v in gates.items() if not v) or "none"))
        if alerts:
            print("-- would alert --")
            for a in alerts:
                print(f"  {a}")
    elif alerts:
        text = "<b>Agentic Markets — live monitor</b>\n" + "\n".join(alerts)
        sent = await telegram_client.send(text)
        log("alert_sent" if sent else "alert_failed", lines=len(alerts))

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
