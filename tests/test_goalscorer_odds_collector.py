import json, pathlib, pytest
from core import goalscorer_odds_collector as col

FIX = json.loads((pathlib.Path(__file__).parent / "fixtures" / "odds_api_goalscorer_wc.json").read_text())

async def test_collect_writes_rows_and_resolves_ids(monkeypatch):
    async def fake_events(sport): return [{"id": FIX["id"], "home_team": "Spain",
                                          "away_team": "Saudi Arabia", "commence_time": FIX["commence_time"]}]
    async def fake_odds(sport, eid, region="us"): return FIX
    captured = {}
    async def fake_upsert(rows): captured["rows"] = rows; return len(rows)
    monkeypatch.setattr(col, "get_events", fake_events)
    monkeypatch.setattr(col, "get_event_goalscorer_odds", fake_odds)
    monkeypatch.setattr(col, "upsert_player_odds", fake_upsert)
    summary = await col.collect_goalscorer_odds(
        ["soccer_fifa_world_cup"],
        match_resolver=lambda e: "wc:spain-ksa",
        now_iso="2026-06-21T00:00:00Z",
        player_resolver=lambda n: "P_"+n[:3],
    )
    assert summary["events"] == 1
    assert summary["rows_written"] > 17
    assert captured["rows"][0].match_id == "wc:spain-ksa"
    assert captured["rows"][0].player_id is not None  # resolver applicato

async def test_collect_skips_unresolved_match(monkeypatch):
    async def fake_events(sport): return [{"id":"e","home_team":"A","away_team":"B","commence_time":"2026-06-21T12:00:00Z"}]
    async def fake_odds(sport, eid, region="us"): return FIX
    async def fake_upsert(rows): return len(rows)
    monkeypatch.setattr(col, "get_events", fake_events)
    monkeypatch.setattr(col, "get_event_goalscorer_odds", fake_odds)
    monkeypatch.setattr(col, "upsert_player_odds", fake_upsert)
    summary = await col.collect_goalscorer_odds(["s"], match_resolver=lambda e: None,
                                                now_iso="2026-06-21T00:00:00Z")
    assert summary["events"] == 0 and summary["rows_written"] == 0

class _FakeQuota:
    """Minimal QuotaTracker double: can_call gated + increment counted."""
    def __init__(self, allowed):
        self.allowed = allowed
        self.increments = 0
    def can_call(self, provider):
        return self.allowed
    async def increment(self, provider, count=1):
        self.increments += count


async def test_collect_skips_fetch_when_quota_exhausted(monkeypatch):
    # #ODDS-QUOTA-GUARD: sotto il cap NON deve chiamare l'endpoint event-level.
    async def fake_events(sport): return [{"id": FIX["id"], "home_team": "Spain",
                                          "away_team": "Saudi Arabia", "commence_time": FIX["commence_time"]}]
    async def fake_odds(sport, eid, region="us"): raise AssertionError("non deve chiamare odds sotto cap")
    monkeypatch.setattr(col, "get_events", fake_events)
    monkeypatch.setattr(col, "get_event_goalscorer_odds", fake_odds)
    monkeypatch.setattr(col, "upsert_player_odds", lambda rows: len(rows))
    q = _FakeQuota(allowed=False)
    summary = await col.collect_goalscorer_odds(
        ["soccer_fifa_world_cup"], match_resolver=lambda e: "wc:spain-ksa",
        now_iso="2026-06-21T00:00:00Z", quota=q,
    )
    assert summary["events"] == 0
    assert summary["quota_skipped"] == 1
    assert q.increments == 0


async def test_collect_counts_credits_when_quota_ok(monkeypatch):
    async def fake_events(sport): return [{"id": FIX["id"], "home_team": "Spain",
                                          "away_team": "Saudi Arabia", "commence_time": FIX["commence_time"]}]
    async def fake_odds(sport, eid, region="us"): return FIX
    async def fake_upsert(rows): return len(rows)
    monkeypatch.setattr(col, "get_events", fake_events)
    monkeypatch.setattr(col, "get_event_goalscorer_odds", fake_odds)
    monkeypatch.setattr(col, "upsert_player_odds", fake_upsert)
    q = _FakeQuota(allowed=True)
    summary = await col.collect_goalscorer_odds(
        ["soccer_fifa_world_cup"], match_resolver=lambda e: "wc:spain-ksa",
        now_iso="2026-06-21T00:00:00Z", quota=q,
    )
    assert summary["events"] == 1
    assert q.increments == 1  # 1 credito/evento contato sul budget condiviso


async def test_collect_skips_out_of_window(monkeypatch):
    async def fake_events(sport): return [{"id":"e","home_team":"A","away_team":"B","commence_time":"2026-12-31T12:00:00Z"}]
    async def fake_odds(sport, eid, region="us"): raise AssertionError("non deve chiamare odds fuori finestra")
    monkeypatch.setattr(col, "get_events", fake_events)
    monkeypatch.setattr(col, "get_event_goalscorer_odds", fake_odds)
    monkeypatch.setattr(col, "upsert_player_odds", lambda rows: len(rows))
    summary = await col.collect_goalscorer_odds(["s"], match_resolver=lambda e: "m",
                                                now_iso="2026-06-21T00:00:00Z", within_hours=48)
    assert summary["events"] == 0
