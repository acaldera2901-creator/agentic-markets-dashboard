"""#FLEET-CODE-SHA-0908 — which commit is the fleet actually running?

The defect this closes, measured 07/09/2026: the settlement fix #361 was on
`main` for hours while the fleet on Andrea's Mac kept grading with the old
code, and nothing in the heartbeat said so. `/api/health` reports the WEB
commit (Vercel injects it) but had no idea which commit the Python processes
were built from — the two halves of the product deploy separately, and the
fleet half is a manual restart. The only way to know was to read the log
timestamps and infer.

So every heartbeat now carries the SHA the process was started from, read
ONCE at import (a restart is the only way it can change, which is exactly
the event we want to see). Resolution order:

  1. `FLEET_CODE_SHA` env — for a packaged deploy with no `.git`;
  2. `git rev-parse --short=8 HEAD` in the repo root (works from a worktree,
     which is how the fleet is checked out);
  3. None — the health route then shows `fleet.code_sha: null`, which is an
     honest "unknown", not a made-up value.

`boot_at` rides along: with it a restart is measurable (the value jumps)
instead of inferred from PIDs, and the watchdog's second restart after a
manual one (see #FLOTTA-ALLINEATA-0907) becomes a visible pair of jumps.
"""
from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_HEX = set("0123456789abcdef")

# Frozen at import: a process has exactly one boot.
BOOT_AT: str = datetime.now(timezone.utc).isoformat(timespec="seconds")


def _read_git_sha(root: Path) -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short=8", "HEAD"],
            cwd=root, capture_output=True, text=True, timeout=5,
        )
    except Exception:
        return None
    if out.returncode != 0:
        return None
    sha = out.stdout.strip().lower()
    return sha if 7 <= len(sha) <= 40 and set(sha) <= _HEX else None


@lru_cache(maxsize=1)
def code_sha() -> str | None:
    env = os.environ.get("FLEET_CODE_SHA", "").strip().lower()
    if env and 7 <= len(env) <= 40 and set(env) <= _HEX:
        return env
    return _read_git_sha(_ROOT)


def version_stamp() -> dict:
    """The keys every heartbeat detail carries. Put FIRST in the payload:
    `status_detail` is cut at 4000 chars and DataCollector's detail was
    measured at 3263 on prod (08/09) — a key appended at the end would be
    the first thing the truncation eats."""
    return {"code_sha": code_sha(), "boot_at": BOOT_AT}
