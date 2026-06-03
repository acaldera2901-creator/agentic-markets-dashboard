"""
Tests for the Dixon-Coles -> unified_predictions writer in core/supabase_client.py.

The writer must produce rows that satisfy the unified_predictions schema CHECK
constraints (db/migrations/001_unified_predictions.sql) and align field-for-field
with lib/unified-adapter.ts, while staying isolated from the client-served
Poisson v1 rows (distinct model_version + source_table -> distinct dedup key).
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from config.settings import settings
from core.supabase_client import (
    DCPrediction,
    dc_prediction_to_unified_row,
    upsert_dc_predictions,
)


def _pred(**overrides) -> DCPrediction:
    base = dict(
        match_id="441789",
        league="SA",
        league_name="Serie A",
        home_team="Inter",
        away_team="Milan",
        kickoff="2026-06-10T18:00:00+00:00",
        p_home=0.55,
        p_draw=0.25,
        p_away=0.20,
        home_team_matches=12,
        away_team_matches=11,
        ci_width=0.08,
    )
    base.update(overrides)
    return DCPrediction(**base)


# ─── Mapping (pure) ────────────────────────────────────────────────────────────

def test_row_uses_distinct_model_version_and_source_table():
    row = dc_prediction_to_unified_row(_pred())
    assert row["model_version"] == settings.DC_MODEL_VERSION == "football-dixoncoles-v1"
    assert row["source_table"] == settings.DC_SOURCE_TABLE == "dixon_coles_predictions"
    # Must NOT collide with the Poisson v1 dedup key.
    assert row["source_table"] != "match_predictions"


def test_row_dedup_key_is_match_id():
    row = dc_prediction_to_unified_row(_pred(match_id="999"))
    assert row["source_id"] == "999"
    assert row["external_event_id"] == "999"


def test_pick_is_argmax_outcome():
    assert dc_prediction_to_unified_row(_pred())["pick"] == "HOME"
    assert dc_prediction_to_unified_row(_pred(p_home=0.2, p_draw=0.5, p_away=0.3))["pick"] == "DRAW"
    assert dc_prediction_to_unified_row(_pred(p_home=0.2, p_draw=0.3, p_away=0.5))["pick"] == "AWAY"


def test_fair_odds_is_inverse_of_pick_probability():
    row = dc_prediction_to_unified_row(_pred(p_home=0.50, p_draw=0.25, p_away=0.25))
    assert row["fair_odds"] == 2.0


def test_confidence_is_pick_probability_percent():
    row = dc_prediction_to_unified_row(_pred(p_home=0.55))
    assert row["confidence_score"] == 55


def test_no_market_odds_means_no_edge_and_paper_estimate():
    row = dc_prediction_to_unified_row(_pred())
    # No market odds -> never a fabricated edge/bookmaker, always flagged paper.
    # signal_type stays "signal" for a reliable model lean (honesty is is_paper).
    assert row["odds"] is None
    assert row["edge_percent"] is None
    assert row["is_paper"] is True
    assert row["bookmaker"] == "no market"


def test_signal_type_and_status_satisfy_schema_check_constraints():
    row = dc_prediction_to_unified_row(_pred())
    assert row["signal_type"] in {"paper", "signal", "verified", "live", "demo"}
    assert row["status"] in {
        "open", "upcoming", "expired", "pending_settlement",
        "settled", "won", "lost", "void", "paper",
    }
    assert row["source"] in {"model", "rule", "provider", "manual", "admin"}
    assert row["risk_level"] in {"low", "medium", "high"}
    assert row["plan_access"] in {"public_locked", "free", "base", "premium"}


def test_low_sample_match_flagged_unreliable():
    # below DC_MIN_TEAM_MATCHES on either team -> not a clean signal
    row = dc_prediction_to_unified_row(_pred(home_team_matches=2, away_team_matches=10))
    assert row["signal_type"] in {"paper", "estimate"} or row["is_paper"] is True
    assert "insufficient" in (row["explanation"] or "").lower() or row["is_paper"] is True


def test_wide_conformal_interval_downgrades_to_estimate():
    row = dc_prediction_to_unified_row(_pred(ci_width=settings.DC_MAX_CI_WIDTH + 0.05))
    assert row["is_paper"] is True


def test_starts_at_and_expires_at_are_kickoff():
    row = dc_prediction_to_unified_row(_pred(kickoff="2026-06-10T18:00:00+00:00"))
    assert row["starts_at"] == "2026-06-10T18:00:00+00:00"
    assert row["expires_at"] == "2026-06-10T18:00:00+00:00"


def test_explanation_mentions_dixon_coles():
    row = dc_prediction_to_unified_row(_pred())
    assert "dixon" in row["explanation"].lower()


def test_row_contains_all_columns_required_by_schema():
    row = dc_prediction_to_unified_row(_pred())
    required = {
        "external_event_id", "sport", "competition", "league", "event_name",
        "home_team", "away_team", "market", "pick", "bookmaker",
        "fair_odds", "confidence_score", "risk_level", "status", "signal_type",
        "source", "model_version", "plan_access", "is_historical", "is_live",
        "is_paper", "is_verified", "is_demo", "published_at", "starts_at",
        "expires_at", "explanation", "source_table", "source_id",
    }
    assert required.issubset(row.keys())


# ─── Async upsert (PostgREST) ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upsert_posts_to_unified_predictions_with_merge_header(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "key123")
    import core.supabase_client as sc
    monkeypatch.setattr(sc, "_REST_BASE", None)

    resp = MagicMock()
    resp.status_code = 201
    resp.text = ""
    client = AsyncMock()
    client.post = AsyncMock(return_value=resp)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(sc.httpx, "AsyncClient", lambda *a, **k: ctx)

    n = await upsert_dc_predictions([_pred(), _pred(match_id="2")])

    assert n == 2
    assert client.post.await_count == 2
    url = client.post.await_args_list[0].args[0]
    assert "/unified_predictions" in url
    assert "on_conflict=source_table,source_id" in url
    headers = client.post.await_args_list[0].kwargs["headers"]
    assert "merge-duplicates" in headers["Prefer"]


@pytest.mark.asyncio
async def test_upsert_noop_without_credentials(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
    import core.supabase_client as sc
    monkeypatch.setattr(sc, "_REST_BASE", None)
    n = await upsert_dc_predictions([_pred()])
    assert n == 0
