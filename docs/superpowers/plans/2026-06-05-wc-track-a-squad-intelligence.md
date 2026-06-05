# WC Track A — Squad Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the WC squad rosters (today only in the ESPN 6h in-process cache) into Supabase: current state + an append-only reveal history, with a one-shot backfill script and a ~5-line DataCollector hook.

**Architecture:** New tables `wc_squads` / `wc_squad_players` / `wc_squad_snapshots` (migration). New module `core/wc_squad_sync.py` reads the already-cached ESPN rosters, upserts current state, and appends a snapshot ONLY when a team's roster hash changes. The DataCollector calls it once per cycle right after the existing `get_squad_coverage()` block (fail-soft: errors land in `source_errors`, never break the cycle). `scripts/backfill_wc_squads.py` runs the same sync standalone (Andrea runs it post-migration — APPROVE `msg_mq1ek03x`).

**Tech Stack:** Python 3.12, httpx → Supabase PostgREST (same pattern as `core/supabase_client.py`), pytest (`asyncio_mode = auto`), pytest-mock.

**Branch:** `michele/wc-track-a` (created from `michele/wc-wing-design`, so spec + plan + code travel in one reviewable branch). Patch-for-review: NO deploy, NO env changes, NO migration execution Michele-side.

**Spec:** `docs/superpowers/specs/2026-06-05-world-cup-wing-design.md` (Track A). One delta vs spec: `wc_squads` gains a `roster_hash` column — it lets the sync detect changes with ONE 48-row GET instead of querying the snapshot table per team.

**Out of scope (declared follow-up):** the API-Football `/squads` enrichment (shirt_number, club_team, age). The Pro key is not in env yet and the endpoint needs a team-ID mapping pass that burns quota. The schema and `_player_rows` already carry the fields (explicit NULLs); enrichment lands as a separate small patch once the key is live. State this plainly in the Task 7 council ping.

**Key repo facts the engineer must know:**
- ESPN client (`core/espn_soccer_client.py`): `get_world_cup_teams() -> [{id, name}]`, `get_team_squad(id) -> {team, squad_size, injured, players: [{name, position, injured}]}` — both TTL-cached 6h in-process, so calling them from the sync right after the collector's coverage pass costs ZERO extra HTTP.
- Supabase access (`core/supabase_client.py`): `_rest_base()` returns `https://.../rest/v1` or `None` when env is missing; `_service_headers()` builds apikey/Bearer headers. All writes are fail-soft (log + continue).
- **PostgREST silent-reject pitfall (P1/P3 lesson, 2026-06-05):** bulk inserts with NON-uniform row keys are rejected silently. Every bulk row must have identical keys with explicit `None` for missing values.
- `canonical_team_name(name)` from `core/world_cup_history.py` normalizes team spellings ("USA" → "United States").
- Tests: `pytest.ini` has `asyncio_mode = auto` (plain `async def test_*` works), fixtures in `tests/conftest.py`, mocking style in `tests/test_p4_squad_settlement.py` (`_resp`/`_client_with` helpers for httpx).

---

### Task 0: Local Python environment (one-time, this PC has no Python)

**Files:** none (environment only)

- [ ] **Step 0.1: Install Python 3.12**

Run: `winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements`
Expected: installs; then verify with the full path (PATH refresh needs a new shell):
`& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" --version` → `Python 3.12.x`

- [ ] **Step 0.2: Create venv + install deps** (from repo root `C:\Users\bragh\Desktop\agentic-markets\agentic-markets-dashboard-production`)

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Expected: clean install. `.venv` is already in pytest `norecursedirs`; verify it is git-ignored (`git status` must NOT list it — if it does, add `.venv/` to `.gitignore` in the first commit).

- [ ] **Step 0.3: Baseline — existing WC tests green**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_paper_writer.py tests/test_p4_squad_settlement.py tests/test_world_cup_history.py -v`
Expected: ALL PASS. If anything fails, STOP — the baseline is broken, do not build on it.

- [ ] **Step 0.4: Create the branch**

```powershell
git checkout michele/wc-wing-design
git checkout -b michele/wc-track-a
```

---

### Task 1: Migration `003_wc_squads.sql`

**Files:**
- Create: `db/migrations/003_wc_squads.sql`

- [ ] **Step 1.1: Write the migration** (no local DB — verified by review + Andrea applies it)

```sql
-- 003_wc_squads.sql — WC Track A (design: docs/superpowers/specs/2026-06-05-world-cup-wing-design.md)
-- Persist WC squad reveals: current state (wc_squads + wc_squad_players) and an
-- append-only snapshot history (wc_squad_snapshots) written only on roster change.
-- Applied by Andrea (deploy gate). Idempotent: IF NOT EXISTS everywhere.

CREATE TABLE IF NOT EXISTS wc_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_canonical TEXT NOT NULL,          -- canonical_team_name() spelling
  team_id_espn TEXT,
  squad_size INT,
  injured_count INT,
  roster_hash TEXT,                      -- change detection in one GET (delta vs spec)
  source TEXT NOT NULL DEFAULT 'espn',   -- 'espn' | 'api-football'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_canonical, source)
);

CREATE TABLE IF NOT EXISTS wc_squad_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES wc_squads(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  position TEXT,
  is_injured BOOLEAN NOT NULL DEFAULT FALSE,
  shirt_number INT,                      -- API-Football only (NULL from ESPN)
  club_team TEXT,                        -- API-Football only
  age INT,                               -- API-Football only
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (squad_id, player_name)
);

CREATE TABLE IF NOT EXISTS wc_squad_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_canonical TEXT NOT NULL,
  source TEXT NOT NULL,
  roster_hash TEXT NOT NULL,
  roster JSONB NOT NULL,                 -- full player list at capture time
  diff JSONB,                            -- {added:[], removed:[], injury_changes:[]} vs previous; NULL on first capture
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wcss_team_time
  ON wc_squad_snapshots (team_canonical, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_wcsp_squad
  ON wc_squad_players (squad_id);
```

- [ ] **Step 1.2: Commit**

```powershell
git add db/migrations/003_wc_squads.sql
git commit -m "feat(wc): migration for squad intelligence tables (Track A)"
```

---

### Task 2: `roster_hash` + `diff_rosters` (pure functions, TDD)

**Files:**
- Create: `core/wc_squad_sync.py`
- Create: `tests/test_wc_squad_sync.py`

- [ ] **Step 2.1: Write the failing tests**

```python
# tests/test_wc_squad_sync.py
"""Track A squad sync tests (design 2026-06-05-world-cup-wing-design.md):
hash/diff logic, uniform-row invariant, snapshot-on-change, fail-soft."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core import wc_squad_sync
from core.wc_squad_sync import diff_rosters, roster_hash


def _p(name, position="M", injured=False):
    return {"name": name, "position": position, "injured": injured}


# ─── roster_hash ────────────────────────────────────────────────────────────────

def test_roster_hash_is_order_insensitive():
    a = [_p("Alpha"), _p("Beta", "D")]
    b = [_p("Beta", "D"), _p("Alpha")]
    assert roster_hash(a) == roster_hash(b)


def test_roster_hash_changes_on_injury_flip():
    a = [_p("Alpha"), _p("Beta")]
    b = [_p("Alpha"), _p("Beta", injured=True)]
    assert roster_hash(a) != roster_hash(b)


def test_roster_hash_changes_on_player_swap():
    assert roster_hash([_p("Alpha")]) != roster_hash([_p("Gamma")])


# ─── diff_rosters ───────────────────────────────────────────────────────────────

def test_diff_none_on_first_capture():
    assert diff_rosters(None, [_p("Alpha")]) is None


def test_diff_added_removed_injury():
    prev = [_p("Stays"), _p("Cut"), _p("Knee")]
    new = [_p("Stays"), _p("Called Up"), _p("Knee", injured=True)]
    d = diff_rosters(prev, new)
    assert d == {
        "added": ["Called Up"],
        "removed": ["Cut"],
        "injury_changes": ["Knee"],
    }


def test_diff_empty_when_unchanged():
    roster = [_p("Alpha"), _p("Beta")]
    assert diff_rosters(roster, roster) == {
        "added": [], "removed": [], "injury_changes": [],
    }
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.wc_squad_sync'`

- [ ] **Step 2.3: Write the module skeleton with the two pure functions**

```python
# core/wc_squad_sync.py
"""
WC squad persistence (Track A — docs/superpowers/specs/2026-06-05-world-cup-wing-design.md).

Persists the ESPN squad rosters that otherwise live only in the 6h in-process
cache: current state in wc_squads/wc_squad_players, append-only reveal history
in wc_squad_snapshots — a snapshot is written ONLY when a team's roster hash
changes (squad announcement, cut, injury flip). That history is the data the
convocazioni analysis layer is built on; it cannot be reconstructed later.

Fail-soft like core/supabase_client.py: provider/Supabase errors are logged
and reported in the returned summary — sync_rosters() never raises into the
collector cycle.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

import httpx

from core.espn_soccer_client import get_team_squad, get_world_cup_teams
from core.supabase_client import _rest_base, _service_headers
from core.world_cup_history import canonical_team_name

logger = logging.getLogger("wc_squad_sync")

SOURCE = "espn"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def roster_hash(players: list[dict]) -> str:
    """Order-insensitive sha256 over (name, position, injured) per player."""
    canon = sorted(
        [p.get("name") or "", p.get("position") or "", bool(p.get("injured"))]
        for p in players
    )
    return hashlib.sha256(json.dumps(canon).encode()).hexdigest()


def diff_rosters(prev: list[dict] | None, new: list[dict]) -> dict | None:
    """Reveal diff vs the previous roster; None on first capture (no diff)."""
    if prev is None:
        return None
    prev_by_name = {p.get("name"): p for p in prev if p.get("name")}
    new_by_name = {p.get("name"): p for p in new if p.get("name")}
    return {
        "added": sorted(n for n in new_by_name if n not in prev_by_name),
        "removed": sorted(n for n in prev_by_name if n not in new_by_name),
        "injury_changes": sorted(
            n
            for n in new_by_name
            if n in prev_by_name
            and bool(new_by_name[n].get("injured"))
            != bool(prev_by_name[n].get("injured"))
        ),
    }
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -v`
Expected: 6 PASS

- [ ] **Step 2.5: Commit**

```powershell
git add core/wc_squad_sync.py tests/test_wc_squad_sync.py
git commit -m "feat(wc): roster hash + reveal diff for squad sync (Track A)"
```

---

### Task 3: Uniform player rows (`_player_rows`)

**Files:**
- Modify: `core/wc_squad_sync.py`
- Modify: `tests/test_wc_squad_sync.py`

- [ ] **Step 3.1: Write the failing tests** (append to `tests/test_wc_squad_sync.py`)

```python
# ─── _player_rows: uniform-row invariant (P1/P3 PostgREST lesson) ──────────────

def test_player_rows_have_identical_keys_with_explicit_nulls():
    rows = wc_squad_sync._player_rows(
        "squad-uuid",
        [
            {"name": "Alpha", "position": "G", "injured": False},
            # richer row (future API-Football enrichment) — keys must still match
            {"name": "Beta", "position": "D", "injured": True,
             "shirt_number": 4, "club_team": "FC X", "age": 27},
        ],
    )
    assert len(rows) == 2
    keysets = {tuple(sorted(r.keys())) for r in rows}
    assert len(keysets) == 1  # IDENTICAL keys on every row
    assert rows[0]["shirt_number"] is None  # explicit NULL, not missing
    assert rows[1]["shirt_number"] == 4
    assert all(r["squad_id"] == "squad-uuid" for r in rows)


def test_player_rows_skip_nameless_entries():
    rows = wc_squad_sync._player_rows("s", [{"name": None}, {"name": "Ok"}])
    assert [r["player_name"] for r in rows] == ["Ok"]
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -v`
Expected: 2 new FAIL with `AttributeError: ... has no attribute '_player_rows'`

- [ ] **Step 3.3: Implement** (append to `core/wc_squad_sync.py`)

```python
def _player_rows(squad_id: str, players: list[dict]) -> list[dict]:
    """Bulk rows with IDENTICAL keys and explicit None for missing values —
    non-uniform keys make PostgREST silently reject the whole bulk insert
    (P1/P3 lesson, 2026-06-05)."""
    return [
        {
            "squad_id": squad_id,
            "player_name": p["name"],
            "position": p.get("position"),
            "is_injured": bool(p.get("injured")),
            "shirt_number": p.get("shirt_number"),
            "club_team": p.get("club_team"),
            "age": p.get("age"),
            "updated_at": _now(),
        }
        for p in players
        if p.get("name")
    ]
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -v`
Expected: 8 PASS

- [ ] **Step 3.5: Commit**

```powershell
git add core/wc_squad_sync.py tests/test_wc_squad_sync.py
git commit -m "feat(wc): uniform player rows with explicit nulls (Track A)"
```

---

### Task 4: `sync_rosters()` — the full sync (TDD with mocked httpx + ESPN)

**Files:**
- Modify: `core/wc_squad_sync.py`
- Modify: `tests/test_wc_squad_sync.py`

- [ ] **Step 4.1: Write the failing tests** (append to `tests/test_wc_squad_sync.py`)

```python
# ─── sync_rosters ───────────────────────────────────────────────────────────────

def _resp(payload, status=200):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = payload
    return r


class _FakeHttpClient:
    """Records every request; routes responses by (method, path-fragment)."""

    def __init__(self, routes):
        self.routes = routes  # list of ((method, fragment), response) consumed in order
        self.calls = []  # (method, url, params, json)

    async def request(self, method, url, params=None, json=None, headers=None):
        self.calls.append((method, url, params, json))
        for i, ((m, frag), resp) in enumerate(self.routes):
            if m == method and frag in url + "?" + str(params):
                self.routes.pop(i)
                return resp
        return _resp([], 200)

    async def get(self, url, params=None, headers=None):
        return await self.request("GET", url, params=params)

    async def post(self, url, params=None, json=None, headers=None):
        return await self.request("POST", url, params=params, json=json)

    async def delete(self, url, params=None, headers=None):
        return await self.request("DELETE", url, params=params)


def _fake_client_cm(fake):
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


_TEAMS = [{"id": "1", "name": "Italy"}]
_SQUAD = {
    "team": "Italy",
    "squad_size": 2,
    "injured": 0,
    "players": [_p("Alpha", "G"), _p("Beta", "D")],
}


def _patch_espn(monkeypatch, squad=_SQUAD):
    monkeypatch.setattr(wc_squad_sync, "get_world_cup_teams", AsyncMock(return_value=_TEAMS))
    monkeypatch.setattr(wc_squad_sync, "get_team_squad", AsyncMock(return_value=squad))


async def test_sync_skips_when_supabase_unconfigured(monkeypatch):
    monkeypatch.setattr(wc_squad_sync, "_rest_base", lambda: None)
    summary = await wc_squad_sync.sync_rosters()
    assert summary["skipped"] is True
    assert summary["snapshots_written"] == 0


async def test_sync_unchanged_hash_writes_nothing(monkeypatch):
    _patch_espn(monkeypatch)
    monkeypatch.setattr(wc_squad_sync, "_rest_base", lambda: "http://sb/rest/v1")
    monkeypatch.setattr(wc_squad_sync, "_service_headers", dict)
    same_hash = roster_hash(_SQUAD["players"])
    fake = _FakeHttpClient(
        [(("GET", "wc_squads"), _resp([{"id": "u1", "team_canonical": "Italy", "roster_hash": same_hash}]))]
    )
    with patch.object(wc_squad_sync.httpx, "AsyncClient", return_value=_fake_client_cm(fake)):
        summary = await wc_squad_sync.sync_rosters()
    assert summary["teams_seen"] == 1
    assert summary["teams_synced"] == 0
    assert summary["snapshots_written"] == 0
    writes = [c for c in fake.calls if c[0] in ("POST", "DELETE")]
    assert writes == []  # unchanged roster -> ZERO writes


async def test_sync_changed_hash_upserts_and_snapshots(monkeypatch):
    _patch_espn(monkeypatch)
    monkeypatch.setattr(wc_squad_sync, "_rest_base", lambda: "http://sb/rest/v1")
    monkeypatch.setattr(wc_squad_sync, "_service_headers", dict)
    fake = _FakeHttpClient([
        (("GET", "wc_squads"), _resp([{"id": "u1", "team_canonical": "Italy", "roster_hash": "OLD"}])),
        (("POST", "wc_squads"), _resp([{"id": "u1"}], 201)),
        (("GET", "wc_squad_snapshots"), _resp([{"roster": [_p("Alpha", "G"), _p("Cut")]}])),
        (("POST", "wc_squad_players"), _resp([], 201)),
        (("POST", "wc_squad_snapshots"), _resp([], 201)),
    ])
    with patch.object(wc_squad_sync.httpx, "AsyncClient", return_value=_fake_client_cm(fake)):
        summary = await wc_squad_sync.sync_rosters()
    assert summary["teams_synced"] == 1
    assert summary["snapshots_written"] == 1
    snapshot_post = next(
        c for c in fake.calls if c[0] == "POST" and "wc_squad_snapshots" in c[1]
    )
    body = snapshot_post[3]
    assert body["team_canonical"] == "Italy"
    assert body["roster_hash"] == roster_hash(_SQUAD["players"])
    assert body["diff"] == {"added": ["Beta"], "removed": ["Cut"], "injury_changes": []}
    # players were replaced for the changed team
    assert any(c[0] == "DELETE" and "wc_squad_players" in c[1] for c in fake.calls)
    player_post = next(c for c in fake.calls if c[0] == "POST" and "wc_squad_players" in c[1])
    assert {tuple(sorted(r.keys())) for r in player_post[3]} != set() and len(player_post[3]) == 2


async def test_sync_is_fail_soft_on_network_error(monkeypatch):
    _patch_espn(monkeypatch)
    monkeypatch.setattr(wc_squad_sync, "_rest_base", lambda: "http://sb/rest/v1")
    monkeypatch.setattr(wc_squad_sync, "_service_headers", dict)
    boom = MagicMock()
    boom.__aenter__ = AsyncMock(side_effect=RuntimeError("net down"))
    boom.__aexit__ = AsyncMock(return_value=False)
    with patch.object(wc_squad_sync.httpx, "AsyncClient", return_value=boom):
        summary = await wc_squad_sync.sync_rosters()  # MUST NOT raise
    assert summary["errors"]
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -v`
Expected: 4 new FAIL with `AttributeError: ... has no attribute 'sync_rosters'`

- [ ] **Step 4.3: Implement `sync_rosters` + write helpers** (append to `core/wc_squad_sync.py`)

```python
async def _latest_snapshot_roster(client, base, headers, team_canonical) -> list[dict] | None:
    resp = await client.get(
        f"{base}/wc_squad_snapshots",
        params={
            "select": "roster",
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
    return rows[0].get("roster") if rows else None


async def _write_team(client, base, headers, *, team_canonical, team_id, squad, new_hash) -> bool:
    """Upsert current state + append the reveal snapshot for ONE changed team.
    Returns True when the snapshot was written."""
    players = squad["players"]

    # 1) upsert wc_squads (full unique index -> on_conflict works, unlike
    #    unified_predictions whose index is partial)
    resp = await client.post(
        f"{base}/wc_squads",
        params={"on_conflict": "team_canonical,source"},
        json={
            "team_canonical": team_canonical,
            "team_id_espn": str(team_id),
            "squad_size": squad.get("squad_size"),
            "injured_count": squad.get("injured"),
            "roster_hash": new_hash,
            "source": SOURCE,
            "updated_at": _now(),
        },
        headers={**headers, "Prefer": "resolution=merge-duplicates,return=representation"},
    )
    if resp.status_code not in (200, 201):
        logger.warning("wc_squads upsert failed for %s: %s %s",
                       team_canonical, resp.status_code, str(resp.json())[:200])
        return False
    rows = resp.json() or []
    if not rows or not rows[0].get("id"):
        logger.warning("wc_squads upsert returned no id for %s", team_canonical)
        return False
    squad_id = rows[0]["id"]

    # 2) diff vs the last snapshot BEFORE appending the new one
    prev_roster = await _latest_snapshot_roster(client, base, headers, team_canonical)
    diff = diff_rosters(prev_roster, players)

    # 3) replace current players (delete + uniform bulk insert)
    await client.delete(
        f"{base}/wc_squad_players",
        params={"squad_id": f"eq.{squad_id}"},
        headers=headers,
    )
    rows_payload = _player_rows(squad_id, players)
    if rows_payload:
        resp = await client.post(
            f"{base}/wc_squad_players", json=rows_payload, headers=headers
        )
        if resp.status_code not in (200, 201, 204):
            logger.warning("wc_squad_players insert failed for %s: %s",
                           team_canonical, resp.status_code)

    # 4) append-only reveal snapshot
    resp = await client.post(
        f"{base}/wc_squad_snapshots",
        json={
            "team_canonical": team_canonical,
            "source": SOURCE,
            "roster_hash": new_hash,
            "roster": players,
            "diff": diff,
            "captured_at": _now(),
        },
        headers=headers,
    )
    if resp.status_code not in (200, 201, 204):
        logger.warning("wc_squad_snapshots insert failed for %s: %s",
                       team_canonical, resp.status_code)
        return False
    return True


async def sync_rosters() -> dict:
    """Sync every cached WC roster to Supabase. Returns a summary dict;
    NEVER raises (fail-soft contract with the collector cycle)."""
    summary = {
        "teams_seen": 0,
        "teams_synced": 0,
        "snapshots_written": 0,
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
            # current hashes in ONE round trip (<=48 rows)
            current: dict[str, dict] = {}
            resp = await client.get(
                f"{base}/wc_squads",
                params={"select": "id,team_canonical,roster_hash", "source": f"eq.{SOURCE}"},
                headers=headers,
            )
            if resp.status_code == 200:
                current = {r["team_canonical"]: r for r in resp.json() or []}
            else:
                summary["errors"].append(f"wc_squads_get:{resp.status_code}")

            for team in teams:
                try:
                    squad = await get_team_squad(team["id"])
                    if not squad or not squad.get("players"):
                        continue
                    summary["teams_seen"] += 1
                    team_canonical = canonical_team_name(squad.get("team") or team["name"])
                    new_hash = roster_hash(squad["players"])
                    prev = current.get(team_canonical)
                    if prev and prev.get("roster_hash") == new_hash:
                        continue  # unchanged — zero writes
                    if await _write_team(
                        client, base, headers,
                        team_canonical=team_canonical,
                        team_id=team["id"], squad=squad, new_hash=new_hash,
                    ):
                        summary["teams_synced"] += 1
                        summary["snapshots_written"] += 1
                except Exception as exc:  # one team must not sink the sweep
                    summary["errors"].append(f"{team.get('name')}:{exc}")
    except Exception as exc:
        summary["errors"].append(f"client:{exc}")

    if summary["snapshots_written"]:
        logger.info(
            "WC squad sync: %d/%d teams changed -> snapshots written",
            summary["snapshots_written"], summary["teams_seen"],
        )
    return summary
```

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -v`
Expected: 12 PASS

- [ ] **Step 4.5: Commit**

```powershell
git add core/wc_squad_sync.py tests/test_wc_squad_sync.py
git commit -m "feat(wc): squad sync to Supabase — snapshot on roster change (Track A)"
```

---

### Task 5: DataCollector hook

**Files:**
- Modify: `agents/data_collector.py` (import block ~line 26-30; squad block ~line 198-215)
- Modify: `tests/test_wc_squad_sync.py`

- [ ] **Step 5.1: Write the failing test** (append to `tests/test_wc_squad_sync.py`)

```python
# ─── DataCollector hook ─────────────────────────────────────────────────────────

async def test_collector_cycle_invokes_squad_sync(monkeypatch):
    """The collect cycle calls sync_rosters once, fail-soft: a sync exception
    must land in source_errors, not break the cycle."""
    from agents import data_collector as dc

    monkeypatch.setattr(dc, "LEAGUE_IDS", {})  # skip the league loop entirely
    monkeypatch.setattr(dc, "get_squad_coverage", AsyncMock(return_value={"Italy": {"squad_size": 26, "injured": 1}}))
    monkeypatch.setattr(dc, "get_world_cup_teams", AsyncMock(return_value=[{"id": "1", "name": "Italy"}]))
    monkeypatch.setattr(dc, "national_model_ready", lambda: False)
    sync_mock = AsyncMock(return_value={"teams_seen": 1, "teams_synced": 0, "snapshots_written": 0, "errors": [], "skipped": False})
    monkeypatch.setattr(dc, "sync_rosters", sync_mock)

    agent = dc.DataCollectorAgent.__new__(dc.DataCollectorAgent)  # skip __init__ (Redis/DataHub)
    agent._upcoming_kickoffs = []
    agent._consecutive_empty_cycles = 0
    agent._last_offseason_log = 0.0
    agent._hub = MagicMock()
    agent._hub.collect_all_fixtures = AsyncMock(return_value=[])
    agent._hub.collect_all_odds = AsyncMock(return_value=None)
    agent.logger = MagicMock()
    agent.set_status_detail = MagicMock()

    await agent._collect_cycle()
    sync_mock.assert_awaited_once()

    # fail-soft: sync raising must not propagate
    monkeypatch.setattr(dc, "sync_rosters", AsyncMock(side_effect=RuntimeError("boom")))
    await agent._collect_cycle()  # MUST NOT raise
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py::test_collector_cycle_invokes_squad_sync -v`
Expected: FAIL with `AttributeError: module 'agents.data_collector' has no attribute 'sync_rosters'`

- [ ] **Step 5.3: Implement the hook**

In `agents/data_collector.py`, extend the espn import block (line 26-30):

```python
from core.espn_soccer_client import (
    get_squad_coverage,
    get_world_cup_teams,
    get_league_fixtures as espn_league_fixtures,
)
from core.wc_squad_sync import sync_rosters
```

Then, inside `_collect_cycle`, immediately AFTER the existing `except` of the squad-coverage block (after line `source_errors.append(f"WC:squad_news:{e}")`) and BEFORE the `settlement_ready = ...` line, add:

```python
        # Track A: persist squad reveals (snapshot only on roster change).
        # ESPN data is already TTL-cached by the coverage pass above — this
        # costs zero extra HTTP. Fail-soft: never breaks the cycle.
        try:
            sync_summary = await sync_rosters()
            if sync_summary.get("snapshots_written"):
                self.logger.info(
                    "WC squad sync: %d reveal snapshot(s) captured",
                    sync_summary["snapshots_written"],
                )
        except Exception as e:
            source_errors.append(f"WC:squad_sync:{e}")
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -v`
Expected: 13 PASS

- [ ] **Step 5.5: Commit**

```powershell
git add agents/data_collector.py tests/test_wc_squad_sync.py
git commit -m "feat(wc): wire squad sync into DataCollector cycle (Track A)"
```

---

### Task 6: One-shot backfill script

**Files:**
- Create: `scripts/backfill_wc_squads.py`
- Modify: `tests/test_wc_squad_sync.py`

- [ ] **Step 6.1: Write the failing test** (append to `tests/test_wc_squad_sync.py`)

```python
# ─── backfill script ────────────────────────────────────────────────────────────

async def test_backfill_main_returns_summary(monkeypatch, capsys):
    from scripts import backfill_wc_squads

    monkeypatch.setattr(
        backfill_wc_squads, "sync_rosters",
        AsyncMock(return_value={"teams_seen": 48, "teams_synced": 48,
                                "snapshots_written": 48, "errors": [], "skipped": False}),
    )
    code = await backfill_wc_squads.main()
    out = capsys.readouterr().out
    assert code == 0
    assert "snapshots_written=48" in out


async def test_backfill_exit_code_1_when_skipped(monkeypatch, capsys):
    from scripts import backfill_wc_squads

    monkeypatch.setattr(
        backfill_wc_squads, "sync_rosters",
        AsyncMock(return_value={"teams_seen": 0, "teams_synced": 0,
                                "snapshots_written": 0, "errors": [], "skipped": True}),
    )
    code = await backfill_wc_squads.main()
    assert code == 1
    assert "SUPABASE env missing or ESPN unavailable" in capsys.readouterr().out
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -k backfill -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.backfill_wc_squads'`

- [ ] **Step 6.3: Implement the script**

```python
# scripts/backfill_wc_squads.py
"""
One-shot WC squad capture (Track A).

Captures the CURRENT 48 rosters into wc_squads/wc_squad_players and writes the
first wc_squad_snapshots rows, without waiting for the collector deploy. Run it
once right after applying db/migrations/003_wc_squads.sql (APPROVE msg_mq1ek03x:
Andrea-side runs this), then the DataCollector hook keeps it current:

    python -m scripts.backfill_wc_squads

Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
Exit code: 0 = synced, 1 = skipped (missing env / ESPN unavailable).
"""
import asyncio

from core.wc_squad_sync import sync_rosters


async def main() -> int:
    summary = await sync_rosters()
    if summary["skipped"]:
        print("SKIPPED: SUPABASE env missing or ESPN unavailable — nothing written.")
        return 1
    print(
        f"WC squad backfill: teams_seen={summary['teams_seen']} "
        f"teams_synced={summary['teams_synced']} "
        f"snapshots_written={summary['snapshots_written']}"
    )
    for err in summary["errors"]:
        print(f"  error: {err}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
```

- [ ] **Step 6.4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_wc_squad_sync.py -v`
Expected: 15 PASS

- [ ] **Step 6.5: Commit**

```powershell
git add scripts/backfill_wc_squads.py tests/test_wc_squad_sync.py
git commit -m "feat(wc): one-shot squad backfill script (Track A)"
```

---

### Task 7: Full suite, push, Council ping

- [ ] **Step 7.1: Run the FULL Python test suite**

Run: `.venv\Scripts\python.exe -m pytest -q`
Expected: every pre-existing test PASS + the 15 new ones. Zero failures. If anything pre-existing fails, fix before pushing — the 655-green invariant is part of the review contract.

- [ ] **Step 7.2: Push the branch**

```powershell
git push -u origin michele/wc-track-a
```

- [ ] **Step 7.3: Council ping** (per APPROVE `msg_mq1ek03x`: "Quando la patch Track A è pronta, ping qui")

POST to Council Chat (`council-main`, messageType `chat`): Track A pronta su `michele/wc-track-a` — migration 003 + sync + hook + backfill + N test; richiesta review→merge→migration→backfill lato Andrea (backfill = `python -m scripts.backfill_wc_squads`, priorità massima per i reveal events). Correzione vs proposal: l'enrichment API-Football /squads (numero/club/età) NON è in questa patch — è un follow-up a key Pro attiva (lo schema ha già i campi); da ESPN arrivano nome/posizione/flag infortunio.
