from __future__ import annotations

import uuid
import datetime
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class LiveEventType(Enum):
    GOAL = "GOAL"
    RED_CARD = "RED_CARD"
    INJURY = "INJURY"
    SUBSTITUTION = "SUBSTITUTION"
    VAR_DECISION = "VAR_DECISION"
    PENALTY_AWARDED = "PENALTY_AWARDED"
    WEATHER_CHANGE = "WEATHER_CHANGE"


@dataclass
class EventImpact:
    home_delta: float = 0.0
    confidence_adjustment: float = 0.0
    stake_action: str = "keep"   # "keep" | "reduce" | "skip"


@dataclass
class LiveEvent:
    event_id: str
    match_id: str
    event_type: LiveEventType
    team: str
    minute: int
    received_at: datetime.datetime
    impact: EventImpact
    is_critical: bool
    extra: dict = field(default_factory=dict)


# Delta magnitudes per event type
_GOAL_DELTA = 0.08
_RED_CARD_DELTA = 0.12
_INJURY_KEY_DELTA = -0.06
_INJURY_NORMAL_DELTA = -0.02


class LiveEventsHandler:
    """
    Tracks live events for in-play matches and computes probability/stake impact.
    """

    def __init__(self, minutes_before_kickoff_threshold: int = 120) -> None:
        self.minutes_before_kickoff_threshold = minutes_before_kickoff_threshold
        self._events: dict[str, list[LiveEvent]] = {}

    def register(
        self,
        match_id: str,
        event_type: LiveEventType,
        team: str,
        minute: int,
        received_at: datetime.datetime,
        extra: Optional[dict] = None,
    ) -> LiveEvent:
        extra = extra or {}
        impact = self._compute_impact(event_type, team, extra)
        is_critical = self._is_critical(received_at, event_type, extra)

        event = LiveEvent(
            event_id=str(uuid.uuid4()),
            match_id=match_id,
            event_type=event_type,
            team=team,
            minute=minute,
            received_at=received_at,
            impact=impact,
            is_critical=is_critical,
            extra=extra,
        )
        self._events.setdefault(match_id, []).append(event)
        return event

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def get_events(self, match_id: str) -> list[LiveEvent]:
        return list(self._events.get(match_id, []))

    def get_critical_events(self, match_id: str) -> list[LiveEvent]:
        return [e for e in self.get_events(match_id) if e.is_critical]

    def aggregate_impact(self, match_id: str) -> dict:
        events = self.get_events(match_id)
        if not events:
            return {"home_delta": 0.0, "confidence_adjustment": 0.0, "stake_action": "keep"}

        total_home_delta = sum(e.impact.home_delta for e in events)
        total_conf_adj = sum(e.impact.confidence_adjustment for e in events)

        # Worst stake_action wins: skip > reduce > keep
        priority = {"skip": 2, "reduce": 1, "keep": 0}
        worst = max(events, key=lambda e: priority.get(e.impact.stake_action, 0))
        stake_action = worst.impact.stake_action

        return {
            "home_delta": total_home_delta,
            "confidence_adjustment": total_conf_adj,
            "stake_action": stake_action,
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    def _compute_impact(
        self, event_type: LiveEventType, team: str, extra: dict
    ) -> EventImpact:
        sign = 1.0 if team == "home" else -1.0

        if event_type == LiveEventType.GOAL:
            return EventImpact(
                home_delta=sign * _GOAL_DELTA,
                confidence_adjustment=0.0,
                stake_action="keep",
            )

        if event_type == LiveEventType.RED_CARD:
            return EventImpact(
                home_delta=-sign * _RED_CARD_DELTA,
                confidence_adjustment=-0.05,
                stake_action="reduce",
            )

        if event_type == LiveEventType.INJURY:
            is_key = extra.get("is_key_player", False)
            delta = _INJURY_KEY_DELTA if is_key else _INJURY_NORMAL_DELTA
            return EventImpact(
                home_delta=sign * delta,
                confidence_adjustment=delta,
                stake_action="reduce" if is_key else "keep",
            )

        return EventImpact(home_delta=0.0, confidence_adjustment=0.0, stake_action="keep")

    def _is_critical(
        self,
        received_at: datetime.datetime,
        event_type: LiveEventType,
        extra: dict,
    ) -> bool:
        now = datetime.datetime.now(datetime.timezone.utc)
        if received_at.tzinfo is None:
            received_at = received_at.replace(tzinfo=datetime.timezone.utc)
        minutes_ago = (now - received_at).total_seconds() / 60
        return minutes_ago <= self.minutes_before_kickoff_threshold
