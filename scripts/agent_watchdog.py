import asyncio
import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

# Derive ROOT from this file's location so a project move never breaks the watchdog.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config.settings import settings
from core.redis_client import get_redis


AGENT_LABEL = "com.agentic-markets.agents"
AGENT_PLIST = Path.home() / "Library/LaunchAgents/com.agentic-markets.agents.plist"
LOG_PATH = ROOT / "logs/agent_watchdog.log"
STATE_PATH = ROOT / "logs/agent_watchdog_state.json"
RESTART_COOLDOWN_SECONDS = 180
STALE_AFTER_SECONDS = max(settings.HEARTBEAT_TIMEOUT * 2, 120)

MONITORED_AGENTS = [
    "DataCollector",
    "ModelAgent",
    "AnalystAgent",
    "StrategistAgent",
    "RiskManagerAgent",
    "TraderAgent",
    "MonitorAgent",
    "ResearchAgent",
    "AHCollectorAgent",
    "ResultSettlementAgent",
    "TennisDataCollectorAgent",
    "TennisModelAgent",
    "TennisAnalystAgent",
    "TennisRiskManagerAgent",
    "TennisTraderAgent",
    "TennisSettlementAgent",
]


def log(event: str, **fields) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "ts": datetime.now(UTC).isoformat(),
        "event": event,
        **fields,
    }
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, sort_keys=True) + "\n")


def load_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def run_cmd(args: list[str], timeout: int = 10) -> subprocess.CompletedProcess:
    return subprocess.run(
        args,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def launchctl_label() -> str:
    return f"gui/{os.getuid()}/{AGENT_LABEL}"


def service_running() -> bool:
    result = run_cmd(["launchctl", "print", launchctl_label()])
    return result.returncode == 0 and "state = running" in result.stdout


def run_process_count() -> int:
    result = run_cmd(["pgrep", "-fl", "python.*run.py"])
    if result.returncode != 0:
        return 0
    lines = [line for line in result.stdout.splitlines() if "agent_watchdog.py" not in line]
    return len(lines)


async def heartbeat_ages() -> tuple[dict[str, float | None], list[str]]:
    r = await get_redis()
    now = datetime.now(UTC)
    ages: dict[str, float | None] = {}
    stale: list[str] = []
    for name in MONITORED_AGENTS:
        value = await r.get(f"health:{name}")
        if not value:
            ages[name] = None
            stale.append(name)
            continue
        try:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
            age = (now - parsed).total_seconds()
            ages[name] = round(age, 1)
            if age > STALE_AFTER_SECONDS:
                stale.append(name)
        except Exception:
            ages[name] = None
            stale.append(name)
    return ages, stale


def restart_service(reason: str, details: dict) -> bool:
    state = load_state()
    now = time.time()
    last_restart = float(state.get("last_restart_ts", 0))
    if now - last_restart < RESTART_COOLDOWN_SECONDS:
        log("restart_suppressed", reason=reason, cooldown_remaining=round(RESTART_COOLDOWN_SECONDS - (now - last_restart)), **details)
        return False

    if service_running():
        result = run_cmd(["launchctl", "kickstart", "-k", launchctl_label()], timeout=20)
    else:
        result = run_cmd(["launchctl", "bootstrap", f"gui/{os.getuid()}", str(AGENT_PLIST)], timeout=20)

    state["last_restart_ts"] = now
    state["last_reason"] = reason
    save_state(state)
    log(
        "restart_requested",
        reason=reason,
        returncode=result.returncode,
        stdout=result.stdout[-500:],
        stderr=result.stderr[-500:],
        **details,
    )
    return result.returncode == 0


async def main() -> int:
    running = service_running()
    process_count = run_process_count()
    details: dict = {"service_running": running, "run_process_count": process_count}

    if not running or process_count == 0:
        restart_service("service_or_process_down", details)
        return 1

    if process_count > 1:
        restart_service("duplicate_orchestrators", details)
        return 1

    try:
        ages, stale = await heartbeat_ages()
        details["heartbeat_ages"] = ages
    except Exception as exc:
        details["error"] = repr(exc)
        restart_service("redis_or_heartbeat_check_failed", details)
        return 1

    if stale:
        details["stale_agents"] = stale
        restart_service("stale_heartbeats", details)
        return 1

    log("ok", **details)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
