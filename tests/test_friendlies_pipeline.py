# tests/test_friendlies_pipeline.py
"""FRIENDLY (international friendlies) — pre-WC dry-run of the national model.

Covers the contract end-to-end at unit level:
  routing helpers (FRIENDLY is national, never Dixon-Coles),
  the unified mapper re-tags friendly rows (competition/model_version/
  source_table) and the caller keeps them on paper,
  the ModelAgent persist gate publishes ONLY on national-model quality >= 0.75
  and NEVER as signal,
  ESPN summary result parsing for settlement (the only provider that covers
  friendlies — fail-closed while the match is not completed).
"""
import json
from unittest.mock import AsyncMock, patch

import pytest

from config.settings import settings
from core.espn_soccer_client import ESPN_LEAGUE_CODES, parse_summary_result
from core.supabase_client import DCPrediction, wc_prediction_to_unified_row
from core.world_cup_registry import (
    FRIENDLIES_CODE,
    is_friendlies_code,
    is_national_team_code,
    is_world_cup_code,
)


def _pred(league=FRIENDLIES_CODE, league_name="International Friendly",
          home_team="Greece", away_team="Italy"):
    return DCPrediction(
        match_id="espn:740123", league=league, league_name=league_name,
        home_team=home_team, away_team=away_team,
        kickoff="2026-06-07T19:00:00Z",
        p_home=0.30, p_draw=0.28, p_away=0.42,
        home_team_matches=20, away_team_matches=22,
    )


def test_national_team_names_are_canonicalized():
    """Root fix: non-canonical feed spellings ("Congo DR" / "Cabo Verde") must
    be stored as the dataset canonical ("DR Congo" / "Cape Verde") so the board
    agrees with the deduped squads tab and no new duplicates are introduced."""
    row = wc_prediction_to_unified_row(
        _pred(league="WC", league_name="FIFA World Cup 2026",
              home_team="Congo DR", away_team="Cabo Verde")
    )
    assert row["home_team"] == "DR Congo"
    assert row["away_team"] == "Cape Verde"
    assert row["event_name"] == "DR Congo vs Cape Verde"


# ── routing helpers ───────────────────────────────────────────────────────────

def test_friendly_codes_route_as_national_not_world_cup():
    assert is_friendlies_code("FRIENDLY") and is_friendlies_code("friendly")
    assert not is_friendlies_code("WC") and not is_friendlies_code(None)
    assert is_national_team_code("FRIENDLY") and is_national_team_code("WC")
    assert not is_national_team_code("PL")
    assert not is_world_cup_code("FRIENDLY")


def test_friendly_has_espn_mapping_but_no_api_football_league_id():
    from core.football_api_client import LEAGUE_IDS
    assert ESPN_LEAGUE_CODES["FRIENDLY"] == "fifa.friendly"
    # Quota guard: FRIENDLY must never enter the API-Football/DataHub maps.
    assert "FRIENDLY" not in LEAGUE_IDS


# ── unified mapper re-tagging ─────────────────────────────────────────────────

def test_friendly_row_is_retagged_and_stays_paper():
    row = wc_prediction_to_unified_row(
        _pred(), neutral_venue=False, signal_allowed=False, friendly=True
    )
    assert row["competition"] == "International Friendly"
    assert row["model_version"] == settings.FRIENDLY_MODEL_VERSION
    assert row["source_table"] == settings.FRIENDLY_SOURCE_TABLE
    assert row["world_cup_stage"] is None
    assert row["neutral_venue"] is False
    assert row["signal_type"] == "paper"
    assert row["is_paper"] is True
    assert row["edge_percent"] is None
    notes = json.loads(row["notes"])
    assert {"p_home", "p_draw", "p_away"} <= set(notes)  # board fallback contract


def test_wc_row_untouched_by_friendly_default():
    row = wc_prediction_to_unified_row(_pred(league="WC", league_name="FIFA World Cup 2026"))
    assert row["competition"] == "World Cup"
    assert row["model_version"] == settings.WC_MODEL_VERSION
    assert row["source_table"] == settings.WC_SOURCE_TABLE


# ── ModelAgent persist gate ───────────────────────────────────────────────────

def _payload():
    return {
        "match_id": "espn:740123",
        "league": FRIENDLIES_CODE,
        "home_team": "Greece",
        "away_team": "Italy",
        "kickoff": "2026-06-07T19:00:00Z",
        "odds": {},
    }


def _wc_result(nm_quality: float, probs: dict | None):
    return {
        "world_cup_publication_tier": "monitor_only",  # WC tier ignored for friendlies
        "world_cup_national_model_quality": str(nm_quality),
        "world_cup_probabilities": json.dumps(probs or {}),
        "world_cup_context": "{}",
        "world_cup_stage": "unknown",
        "neutral_venue": "True",
    }


_PROBS = {"p_team_a": 0.30, "p_draw": 0.28, "p_team_b": 0.42,
          "team_a_matches": 20, "team_b_matches": 22}


@pytest.mark.asyncio
async def test_friendly_persist_writes_paper_row_when_quality_ok():
    from agents.model import ModelAgent
    agent = ModelAgent.__new__(ModelAgent)
    agent._history = {"WC": []}
    agent._wc_snapshot_state = {}
    import logging
    agent.logger = logging.getLogger("test")
    # v1-pipeline intent: con la promozione #ELO-V2 il servito di default è il
    # v2 — qui testiamo il path v1 (friendly version), quindi serve/shadow off.
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)) as up, \
         patch("agents.model.log_prediction_snapshot", new=AsyncMock()) as snap, \
         patch.object(settings, "WC_ELO_V2_SERVE_ENABLED", False), \
         patch.object(settings, "WC_ELO_V2_SHADOW_ENABLED", False):
        await agent._persist_world_cup_paper(_payload(), _wc_result(0.9, _PROBS))
        assert up.await_count == 1
        row = up.await_args.args[0][0]
        assert row["competition"] == "International Friendly"
        assert row["signal_type"] == "paper" and row["is_paper"] is True
        assert row["source_table"] == settings.FRIENDLY_SOURCE_TABLE
        # calibration snapshot logged under the friendly model version
        assert snap.await_args.kwargs["model_version"] == settings.FRIENDLY_MODEL_VERSION


@pytest.mark.asyncio
async def test_friendly_persist_blocked_below_quality_bar():
    from agents.model import ModelAgent
    agent = ModelAgent.__new__(ModelAgent)
    agent._history = {"WC": []}
    agent._wc_snapshot_state = {}
    import logging
    agent.logger = logging.getLogger("test")
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)) as up:
        await agent._persist_world_cup_paper(_payload(), _wc_result(0.5, _PROBS))
        assert up.await_count == 0  # fail-closed: weak national profile, no row


@pytest.mark.asyncio
async def test_wc_monitor_only_still_blocked():
    from agents.model import ModelAgent
    agent = ModelAgent.__new__(ModelAgent)
    agent._history = {"WC": []}
    agent._wc_snapshot_state = {}
    import logging
    agent.logger = logging.getLogger("test")
    payload = {**_payload(), "league": "WC"}
    with patch("agents.model.upsert_unified_rows", new=AsyncMock(return_value=1)) as up:
        await agent._persist_world_cup_paper(payload, _wc_result(0.9, _PROBS))
        assert up.await_count == 0  # WC keeps the tier gate: monitor_only writes nothing


# ── #WC-DEDUP-1: provider-agnostic dedup key ─────────────────────────────────

def test_national_dedup_key_stable_across_providers():
    from core.supabase_client import national_dedup_key
    # same matchup, different provider spellings/ids -> same key
    k1 = national_dedup_key("WC", "2026-06-12T03:00:00+00:00", "Korea Republic", "Czechia")
    k2 = national_dedup_key("wc", "2026-06-12T05:00Z", "South Korea", "Czech Republic")
    assert k1 == k2 == "WC:2026-06-12:south korea|czech republic"
    # friendly rows get their own namespace; reversed fixture is a different key
    kf = national_dedup_key("FRIENDLY", "2026-06-07T19:00Z", "Greece", "Italy")
    assert kf == "FRIENDLY:2026-06-07:greece|italy"
    assert national_dedup_key("WC", "2026-06-12", "Czechia", "South Korea") != k1


def test_unified_row_uses_canonical_source_id_but_keeps_provider_event_id():
    row = wc_prediction_to_unified_row(_pred(), friendly=True)
    assert row["source_id"] == "FRIENDLY:2026-06-07:greece|italy"
    assert row["external_event_id"] == "espn:740123"  # settlement still needs it


# ── ESPN settlement parsing ───────────────────────────────────────────────────

def _summary(completed: bool, hs="2", as_="1"):
    return {
        "header": {
            "competitions": [{
                "status": {"type": {"completed": completed, "name": "STATUS_FULL_TIME"}},
                "competitors": [
                    {"homeAway": "home", "score": hs, "team": {"displayName": "Greece"}},
                    {"homeAway": "away", "score": as_, "team": {"displayName": "Italy"}},
                ],
            }]
        }
    }


def test_espn_result_parses_final_score():
    result = parse_summary_result(_summary(True))
    assert result == {
        "home_goals": 2, "away_goals": 1, "status": "STATUS_FULL_TIME",
        "home_team": "Greece", "away_team": "Italy",
    }


def test_espn_result_fails_closed():
    assert parse_summary_result(_summary(False)) is None          # not finished
    assert parse_summary_result({}) is None                       # empty payload
    assert parse_summary_result(_summary(True, hs="x")) is None   # bad score
