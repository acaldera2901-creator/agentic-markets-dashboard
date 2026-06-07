"""
Squad Condition Watch storage writer tests (① — core/squad_condition_sync):
insert-on-change fingerprint, fail-soft on missing sources, and the
DataCollector piggyback hook (fail-soft: a sync exception lands in
source_errors, never breaks the cycle).
"""
from unittest.mock import AsyncMock, MagicMock, patch

from core import squad_condition_sync as scs


def _p(name, position="M", injured=False):
    return {"name": name, "position": position, "injured": injured}


# ─── report_hash (insert-on-change) ──────────────────────────────────────────

def test_report_hash_stable_for_same_condition():
    r1 = {"injuries": ["A", "B"], "recent_diff": None, "availability_ratio": None, "rotation_flag": False}
    r2 = {"injuries": ["B", "A"], "recent_diff": None, "availability_ratio": None, "rotation_flag": False}
    assert scs.report_hash(r1) == scs.report_hash(r2)


def test_report_hash_changes_on_new_injury():
    r1 = {"injuries": ["A"], "recent_diff": None, "availability_ratio": None, "rotation_flag": False}
    r2 = {"injuries": ["A", "B"], "recent_diff": None, "availability_ratio": None, "rotation_flag": False}
    assert scs.report_hash(r1) != scs.report_hash(r2)


def test_report_hash_buckets_availability_noise():
    # €-level wobble inside the same 2-decimal bucket -> SAME hash (no flap)
    r1 = {"injuries": [], "recent_diff": None, "availability_ratio": 0.621, "rotation_flag": False}
    r2 = {"injuries": [], "recent_diff": None, "availability_ratio": 0.624, "rotation_flag": False}
    assert scs.report_hash(r1) == scs.report_hash(r2)
    r3 = {"injuries": [], "recent_diff": None, "availability_ratio": 0.71, "rotation_flag": False}
    assert scs.report_hash(r1) != scs.report_hash(r3)


# ─── _build_report fail-soft (no valuation data -> null value fields) ────────

def test_build_report_no_valuations_has_null_value_fields(monkeypatch):
    monkeypatch.setattr(scs.sc, "load_valuations",
                        lambda: scs.sc._Valuations({}))
    squad = {"team": "Argentina", "squad_size": 26,
             "players": [_p("Star", injured=True), _p("Sub")]}
    rep = scs._build_report("Argentina", squad, recent_diff=None)
    assert rep["injuries"] == ["Star"]
    assert rep["xi_value"] is None
    assert rep["availability_ratio"] is None
    assert rep["rotation_flag"] is False


def test_build_report_carries_track_a_diff(monkeypatch):
    monkeypatch.setattr(scs.sc, "load_valuations",
                        lambda: scs.sc._Valuations({}))
    diff = {"added": ["X"], "removed": ["Y"], "injury_changes": []}
    rep = scs._build_report("Spain", {"team": "Spain", "players": [_p("A")]}, diff)
    assert rep["recent_diff"] == diff


# ─── sync_squad_condition ────────────────────────────────────────────────────

def _resp(payload, status=200):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = payload
    return r


class _FakeHttpClient:
    def __init__(self, routes):
        self.routes = routes
        self.calls = []

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


def _fake_cm(fake):
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


_TEAMS = [{"id": "1", "name": "Argentina"}]
_SQUAD = {"team": "Argentina", "squad_size": 2, "injured": 1,
          "players": [_p("Alpha", "G", injured=True), _p("Beta", "D")]}


def _patch_espn(monkeypatch):
    monkeypatch.setattr(scs, "get_world_cup_teams", AsyncMock(return_value=_TEAMS))
    monkeypatch.setattr(scs, "get_team_squad", AsyncMock(return_value=_SQUAD))
    monkeypatch.setattr(scs.sc, "load_valuations", lambda: scs.sc._Valuations({}))


async def test_sync_skips_when_supabase_unconfigured(monkeypatch):
    monkeypatch.setattr(scs, "_rest_base", lambda: None)
    summary = await scs.sync_squad_condition()
    assert summary["skipped"] is True
    assert summary["reports_written"] == 0


async def test_sync_writes_report_on_first_capture(monkeypatch):
    _patch_espn(monkeypatch)
    monkeypatch.setattr(scs, "_rest_base", lambda: "http://sb/rest/v1")
    monkeypatch.setattr(scs, "_service_headers", dict)
    fake = _FakeHttpClient([
        (("GET", "squad_condition_reports"), _resp([])),          # no prior reports
        (("GET", "wc_squad_snapshots"), _resp([])),               # no Track A diff yet
        (("POST", "squad_condition_reports"), _resp([], 201)),
    ])
    with patch.object(scs.httpx, "AsyncClient", return_value=_fake_cm(fake)):
        summary = await scs.sync_squad_condition()
    assert summary["teams_seen"] == 1
    assert summary["reports_written"] == 1
    assert summary["errors"] == []
    post = next(c for c in fake.calls if c[0] == "POST" and "squad_condition_reports" in c[1])
    body = post[3]
    assert body["team_canonical"] == "Argentina"
    assert body["missing_players"] == ["Alpha"]
    assert body["availability_ratio"] is None
    assert body["model_consumed"] is False


async def test_sync_unchanged_condition_writes_nothing(monkeypatch):
    _patch_espn(monkeypatch)
    monkeypatch.setattr(scs, "_rest_base", lambda: "http://sb/rest/v1")
    monkeypatch.setattr(scs, "_service_headers", dict)
    # Pre-compute the hash the writer will produce for this squad/diff
    report = scs._build_report("Argentina", _SQUAD, recent_diff=None)
    existing = scs.report_hash(report)
    fake = _FakeHttpClient([
        (("GET", "squad_condition_reports"),
         _resp([{"team_canonical": "Argentina", "report_hash": existing}])),
        (("GET", "wc_squad_snapshots"), _resp([])),
    ])
    with patch.object(scs.httpx, "AsyncClient", return_value=_fake_cm(fake)):
        summary = await scs.sync_squad_condition()
    assert summary["teams_seen"] == 1
    assert summary["reports_written"] == 0
    assert not any(c[0] == "POST" for c in fake.calls)


async def test_sync_fail_soft_on_network_error(monkeypatch):
    _patch_espn(monkeypatch)
    monkeypatch.setattr(scs, "_rest_base", lambda: "http://sb/rest/v1")
    monkeypatch.setattr(scs, "_service_headers", dict)
    boom = MagicMock()
    boom.__aenter__ = AsyncMock(side_effect=RuntimeError("net down"))
    boom.__aexit__ = AsyncMock(return_value=False)
    with patch.object(scs.httpx, "AsyncClient", return_value=boom):
        summary = await scs.sync_squad_condition()  # MUST NOT raise
    assert summary["errors"]


async def test_sync_one_team_error_does_not_sink_sweep(monkeypatch):
    monkeypatch.setattr(scs, "get_world_cup_teams",
                        AsyncMock(return_value=[{"id": "1", "name": "A"}, {"id": "2", "name": "Spain"}]))

    async def _squad(team_id):
        if team_id == "1":
            raise RuntimeError("espn 500")
        return {"team": "Spain", "squad_size": 1, "injured": 0, "players": [_p("X")]}

    monkeypatch.setattr(scs, "get_team_squad", AsyncMock(side_effect=_squad))
    monkeypatch.setattr(scs.sc, "load_valuations", lambda: scs.sc._Valuations({}))
    monkeypatch.setattr(scs, "_rest_base", lambda: "http://sb/rest/v1")
    monkeypatch.setattr(scs, "_service_headers", dict)
    fake = _FakeHttpClient([
        (("GET", "squad_condition_reports"), _resp([])),
        (("GET", "wc_squad_snapshots"), _resp([])),
        (("POST", "squad_condition_reports"), _resp([], 201)),
    ])
    with patch.object(scs.httpx, "AsyncClient", return_value=_fake_cm(fake)):
        summary = await scs.sync_squad_condition()
    assert summary["reports_written"] == 1            # Spain still written
    assert any("espn 500" in e for e in summary["errors"])


# ─── DataCollector hook (fail-soft piggyback) ────────────────────────────────

async def test_collector_cycle_invokes_squad_condition_sync(monkeypatch):
    from agents import data_collector as dc

    monkeypatch.setattr(dc, "LEAGUE_IDS", {})
    monkeypatch.setattr(dc, "get_squad_coverage", AsyncMock(return_value={"Italy": {"squad_size": 26, "injured": 1}}))
    monkeypatch.setattr(dc, "get_world_cup_teams", AsyncMock(return_value=[{"id": "1", "name": "Italy"}]))
    monkeypatch.setattr(dc, "national_model_ready", lambda: False)
    monkeypatch.setattr(dc, "sync_rosters", AsyncMock(return_value={"snapshots_written": 0, "errors": []}))
    cond_mock = AsyncMock(return_value={"teams_seen": 1, "reports_written": 0, "errors": [], "skipped": False})
    monkeypatch.setattr(dc, "sync_squad_condition", cond_mock)

    agent = dc.DataCollectorAgent.__new__(dc.DataCollectorAgent)
    agent._upcoming_kickoffs = []
    agent._consecutive_empty_cycles = 0
    agent._last_offseason_log = 0.0
    agent._hub = MagicMock()
    agent._hub.collect_all_fixtures = AsyncMock(return_value=[])
    agent._hub.collect_all_odds = AsyncMock(return_value=None)
    agent.logger = MagicMock()
    agent.set_status_detail = MagicMock()

    await agent._collect_cycle()
    cond_mock.assert_awaited_once()

    # fail-soft: condition sync raising must not propagate
    monkeypatch.setattr(dc, "sync_squad_condition", AsyncMock(side_effect=RuntimeError("boom")))
    await agent._collect_cycle()  # MUST NOT raise
