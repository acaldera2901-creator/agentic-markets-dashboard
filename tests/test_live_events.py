"""
Unit tests for learning.live_events.LiveEventsHandler
Run: pytest tests/test_live_events.py -v
"""
import datetime
import pytest
from learning.live_events import LiveEventsHandler, LiveEvent, LiveEventType, EventImpact


@pytest.fixture
def handler():
    return LiveEventsHandler(minutes_before_kickoff_threshold=120)


def _ts(minutes_before_kickoff: int = 60) -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        minutes=minutes_before_kickoff
    )


def _kickoff() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)


# ── LiveEvent structure ───────────────────────────────────────────────────────

class TestLiveEventStructure:
    def test_register_returns_live_event(self, handler):
        ev = handler.register(
            match_id="m-001",
            event_type=LiveEventType.RED_CARD,
            team="home",
            minute=45,
            received_at=_ts(30),
            extra={},
        )
        assert isinstance(ev, LiveEvent)

    def test_event_has_match_id(self, handler):
        ev = handler.register("m-001", LiveEventType.RED_CARD, "home", 45, _ts(30))
        assert ev.match_id == "m-001"

    def test_event_has_type(self, handler):
        ev = handler.register("m-001", LiveEventType.GOAL, "away", 60, _ts(20))
        assert ev.event_type == LiveEventType.GOAL

    def test_event_has_impact(self, handler):
        ev = handler.register("m-001", LiveEventType.RED_CARD, "home", 30, _ts(50))
        assert isinstance(ev.impact, EventImpact)

    def test_event_has_event_id(self, handler):
        ev = handler.register("m-001", LiveEventType.GOAL, "home", 10, _ts(80))
        assert ev.event_id is not None


# ── EventImpact ───────────────────────────────────────────────────────────────

class TestEventImpact:
    def test_red_card_home_negative_impact(self, handler):
        ev = handler.register("m-001", LiveEventType.RED_CARD, "home", 30, _ts(50))
        assert ev.impact.home_delta < 0

    def test_red_card_away_positive_home_impact(self, handler):
        ev = handler.register("m-001", LiveEventType.RED_CARD, "away", 30, _ts(50))
        assert ev.impact.home_delta > 0

    def test_goal_home_positive_impact(self, handler):
        ev = handler.register("m-001", LiveEventType.GOAL, "home", 30, _ts(50))
        assert ev.impact.home_delta > 0

    def test_goal_away_negative_home_impact(self, handler):
        ev = handler.register("m-001", LiveEventType.GOAL, "away", 30, _ts(50))
        assert ev.impact.home_delta < 0

    def test_injury_key_player_reduces_confidence(self, handler):
        ev = handler.register(
            "m-001", LiveEventType.INJURY, "home", 20, _ts(60),
            extra={"is_key_player": True},
        )
        assert ev.impact.confidence_adjustment < 0

    def test_impact_has_stake_action(self, handler):
        ev = handler.register("m-001", LiveEventType.RED_CARD, "home", 30, _ts(50))
        assert hasattr(ev.impact, "stake_action")
        assert ev.impact.stake_action in ("keep", "reduce", "skip")

    def test_red_card_recommends_reduce_or_skip(self, handler):
        ev = handler.register("m-001", LiveEventType.RED_CARD, "home", 30, _ts(50))
        assert ev.impact.stake_action in ("reduce", "skip")


# ── Pre-kickoff threshold ─────────────────────────────────────────────────────

class TestPreKickoffThreshold:
    def test_event_within_threshold_is_critical(self, handler):
        ev = handler.register(
            "m-001", LiveEventType.INJURY, "home", 0, _ts(30),
            extra={"is_key_player": True},
        )
        assert ev.is_critical is True

    def test_event_outside_threshold_not_critical(self, handler):
        handler2 = LiveEventsHandler(minutes_before_kickoff_threshold=10)
        ev = handler2.register(
            "m-001", LiveEventType.INJURY, "home", 0, _ts(60),
            extra={"is_key_player": True},
        )
        assert ev.is_critical is False


# ── Event retrieval ───────────────────────────────────────────────────────────

class TestEventRetrieval:
    def test_get_events_for_match(self, handler):
        handler.register("m-001", LiveEventType.GOAL, "home", 20, _ts(50))
        handler.register("m-001", LiveEventType.RED_CARD, "away", 35, _ts(40))
        events = handler.get_events("m-001")
        assert len(events) == 2

    def test_get_events_returns_empty_for_unknown_match(self, handler):
        events = handler.get_events("no-such-match")
        assert events == []

    def test_get_events_isolated_by_match(self, handler):
        handler.register("m-001", LiveEventType.GOAL, "home", 20, _ts(50))
        handler.register("m-002", LiveEventType.RED_CARD, "away", 35, _ts(40))
        assert len(handler.get_events("m-001")) == 1
        assert len(handler.get_events("m-002")) == 1

    def test_get_critical_events_only_critical(self, handler):
        handler.register("m-001", LiveEventType.GOAL, "home", 20, _ts(50))
        handler.register("m-001", LiveEventType.RED_CARD, "home", 30, _ts(30))
        critical = handler.get_critical_events("m-001")
        assert all(e.is_critical for e in critical)


# ── Aggregate impact ──────────────────────────────────────────────────────────

class TestAggregateImpact:
    def test_aggregate_returns_dict(self, handler):
        handler.register("m-001", LiveEventType.GOAL, "home", 20, _ts(50))
        agg = handler.aggregate_impact("m-001")
        assert isinstance(agg, dict)

    def test_aggregate_has_home_delta(self, handler):
        handler.register("m-001", LiveEventType.GOAL, "home", 20, _ts(50))
        agg = handler.aggregate_impact("m-001")
        assert "home_delta" in agg

    def test_aggregate_sums_deltas(self, handler):
        handler.register("m-001", LiveEventType.GOAL, "home", 20, _ts(50))
        handler.register("m-001", LiveEventType.GOAL, "home", 60, _ts(30))
        agg = handler.aggregate_impact("m-001")
        assert agg["home_delta"] > 0

    def test_aggregate_empty_match_returns_zero(self, handler):
        agg = handler.aggregate_impact("no-match")
        assert agg["home_delta"] == pytest.approx(0.0)

    def test_aggregate_stake_action_skip_if_any_red_card_home(self, handler):
        handler.register("m-001", LiveEventType.RED_CARD, "home", 15, _ts(50))
        agg = handler.aggregate_impact("m-001")
        assert agg["stake_action"] in ("reduce", "skip")
