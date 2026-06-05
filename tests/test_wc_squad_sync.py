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


def test_diff_handles_duplicate_names_without_collapsing():
    # two distinct players sharing a displayName (realistic across 48 squads):
    # the duplicate must not be silently dropped from the diff
    prev = [_p("Dup", "G"), _p("Dup", "D"), _p("Solo")]
    new = [_p("Dup", "G"), _p("Solo")]
    d = diff_rosters(prev, new)
    assert d["removed"] == ["Dup"]
    assert d["added"] == []


def test_diff_injury_change_on_duplicate_name_position():
    prev = [_p("Dup", "G", injured=False), _p("Dup", "D", injured=False)]
    new = [_p("Dup", "G", injured=False), _p("Dup", "D", injured=True)]
    d = diff_rosters(prev, new)
    assert d["injury_changes"] == ["Dup"]
    assert d["added"] == [] and d["removed"] == []


def test_roster_hash_deterministic_for_non_ascii_names():
    # guards json.dumps ensure_ascii determinism across runs/platforms
    roster = [_p("Müller", "F"), _p("Ødegaard", "M")]
    assert roster_hash(roster) == roster_hash(list(reversed(roster)))
    assert roster_hash(roster) == "504e9b13dadb271f8a3a5f760d18de465553c26b3d7300a8e9e06c8b24b93f61"


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

    async def patch(self, url, params=None, json=None, headers=None):
        return await self.request("PATCH", url, params=params, json=json)


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
        (("GET", "wc_squad_snapshots"), _resp([{"roster": [_p("Alpha", "G"), _p("Cut")], "roster_hash": "OLD"}])),
        (("POST", "wc_squad_players"), _resp([], 201)),
        (("POST", "wc_squad_snapshots"), _resp([], 201)),
        (("PATCH", "wc_squads"), _resp([], 204)),
    ])
    with patch.object(wc_squad_sync.httpx, "AsyncClient", return_value=_fake_client_cm(fake)):
        summary = await wc_squad_sync.sync_rosters()
    assert summary["teams_synced"] == 1
    assert summary["snapshots_written"] == 1
    assert summary["errors"] == []
    # upsert body must NOT carry roster_hash — the hash commits LAST via PATCH
    squads_post = next(c for c in fake.calls if c[0] == "POST" and "wc_squads" in c[1] and "players" not in c[1] and "snapshots" not in c[1])
    assert "roster_hash" not in squads_post[3]
    hash_patch = next(c for c in fake.calls if c[0] == "PATCH" and "wc_squads" in c[1])
    assert hash_patch[3]["roster_hash"] == roster_hash(_SQUAD["players"])
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
    assert len(player_post[3]) == 2
    # PATCH (hash commit) must be the LAST write
    write_methods = [c[0] for c in fake.calls if c[0] in ("POST", "DELETE", "PATCH")]
    assert write_methods[-1] == "PATCH"


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


async def test_sync_players_409_aborts_before_snapshot_and_hash(monkeypatch):
    """UNIQUE violation on the players bulk -> no snapshot, no hash commit,
    error visible in summary -> next cycle retries (self-healing)."""
    _patch_espn(monkeypatch)
    monkeypatch.setattr(wc_squad_sync, "_rest_base", lambda: "http://sb/rest/v1")
    monkeypatch.setattr(wc_squad_sync, "_service_headers", dict)
    fake = _FakeHttpClient([
        (("GET", "wc_squads"), _resp([{"id": "u1", "team_canonical": "Italy", "roster_hash": "OLD"}])),
        (("POST", "wc_squads"), _resp([{"id": "u1"}], 201)),
        (("GET", "wc_squad_snapshots"), _resp([])),
        (("POST", "wc_squad_players"), _resp([], 409)),
    ])
    with patch.object(wc_squad_sync.httpx, "AsyncClient", return_value=_fake_client_cm(fake)):
        summary = await wc_squad_sync.sync_rosters()
    assert summary["teams_synced"] == 0
    assert summary["snapshots_written"] == 0
    assert summary["errors"] == ["Italy:write_failed"]
    assert not any(c[0] == "POST" and "wc_squad_snapshots" in c[1] for c in fake.calls)
    assert not any(c[0] == "PATCH" for c in fake.calls)


def test_player_rows_dedupes_duplicate_names_with_warning():
    rows = wc_squad_sync._player_rows(
        "s", [_p("Dup", "G"), _p("Dup", "D"), _p("Solo")]
    )
    assert [r["player_name"] for r in rows] == ["Dup", "Solo"]
    assert rows[0]["position"] == "G"  # first occurrence wins


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
