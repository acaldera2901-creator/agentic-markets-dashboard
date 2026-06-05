"""P1/P3 wiring tests: tennis odds merge in the collector and snapshot projection.

PostgREST bulk writes require uniform keys per row and reject unknown columns —
these tests pin both invariants so the wiring can never silently break writes.
"""
import pytest

from agents.tennis_data_collector import TennisDataCollectorAgent, _ODDS_FIELDS
from core.odds_api_client import to_snapshot_rows


# ─── P3: snapshot row projection ──────────────────────────────────────────────

def test_to_snapshot_rows_strips_unknown_columns():
    rows = to_snapshot_rows([
        {
            "match_id": "WC:abc", "home_team": "USA", "away_team": "Mexico",
            "bookmaker": "pinnacle", "source": "odds_api", "market": "h2h",
            "odds_home": 2.1, "odds_draw": 3.2, "odds_away": 3.8, "overround": 0.04,
        }
    ])
    assert len(rows) == 1
    assert "home_team" not in rows[0] and "away_team" not in rows[0]
    assert rows[0]["match_id"] == "WC:abc"
    assert rows[0]["odds_home"] == 2.1


def test_to_snapshot_rows_uniform_keys_across_h2h_and_ah():
    rows = to_snapshot_rows([
        {"match_id": "WC:1", "bookmaker": "bet365", "source": "odds_api", "market": "h2h",
         "odds_home": 2.0, "odds_draw": 3.0, "odds_away": 4.0, "overround": 0.05,
         "home_team": "X", "away_team": "Y"},
        {"match_id": "WC:1", "bookmaker": "bet365", "source": "odds_api", "market": "ah",
         "ah_line": -0.5, "ah_home": 1.9, "ah_away": 1.95, "home_team": "X", "away_team": "Y"},
    ])
    assert len(rows) == 2
    assert set(rows[0].keys()) == set(rows[1].keys())  # uniform → bulk insert safe


def test_to_snapshot_rows_drops_incomplete():
    rows = to_snapshot_rows([
        {"match_id": "", "bookmaker": "bet365"},
        {"match_id": "WC:1", "bookmaker": None},
    ])
    assert rows == []


# ─── P1: tennis odds merge in the collector ───────────────────────────────────

@pytest.fixture
def collector():
    return TennisDataCollectorAgent()


async def test_merge_without_key_normalizes_fields(collector, monkeypatch):
    monkeypatch.setattr("agents.tennis_data_collector.settings.ODDS_API_KEY", "")
    fixtures = [{"match_id": "t1", "player1": "A", "player2": "B", "scheduled_at": "2026-06-06T10:00:00Z"}]
    merged, count = await collector._merge_market_odds(fixtures)
    assert count == 0
    for field in _ODDS_FIELDS:
        assert field in merged[0] and merged[0][field] is None  # uniform keys, explicit nulls


async def test_merge_with_odds_enriches_matched_and_normalizes_rest(collector, monkeypatch):
    monkeypatch.setattr("agents.tennis_data_collector.settings.ODDS_API_KEY", "test-key")

    async def fake_odds():
        return [{
            "odds_event_id": "ev1", "sport_key": "tennis_wta_french_open",
            "player1": "Iga Swiatek", "player2": "Aryna Sabalenka",
            "scheduled_at": "2026-06-06T10:00:00Z",
            "odds_p1": 1.55, "odds_p2": 2.45, "bookmaker": "pinnacle",
        }]

    monkeypatch.setattr("agents.tennis_data_collector.get_tennis_odds", fake_odds)
    fixtures = [
        {"match_id": "t1", "player1": "Iga Swiatek", "player2": "Aryna Sabalenka",
         "scheduled_at": "2026-06-06T10:00:00Z"},
        {"match_id": "t2", "player1": "Coco Gauff", "player2": "Elena Rybakina",
         "scheduled_at": "2026-06-06T12:00:00Z"},
    ]
    merged, count = await collector._merge_market_odds(fixtures)
    assert count == 1
    by_id = {f["match_id"]: f for f in merged}
    assert by_id["t1"]["odds_p1"] == 1.55 and by_id["t1"]["odds_provider"] == "the_odds_api"
    # Unmatched fixture still carries every odds key (uniform bulk upsert).
    for field in _ODDS_FIELDS:
        assert field in by_id["t2"] and by_id["t2"][field] is None


async def test_merge_failure_is_non_fatal(collector, monkeypatch):
    monkeypatch.setattr("agents.tennis_data_collector.settings.ODDS_API_KEY", "test-key")

    async def boom():
        raise RuntimeError("odds api down")

    monkeypatch.setattr("agents.tennis_data_collector.get_tennis_odds", boom)
    fixtures = [{"match_id": "t1", "player1": "A", "player2": "B", "scheduled_at": "2026-06-06T10:00:00Z"}]
    merged, count = await collector._merge_market_odds(fixtures)
    assert count == 0 and len(merged) == 1  # fixtures survive, odds fields nulled
    for field in _ODDS_FIELDS:
        assert merged[0][field] is None
