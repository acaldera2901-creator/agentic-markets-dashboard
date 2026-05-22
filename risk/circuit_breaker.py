from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

DEFAULT_THRESHOLDS: dict = {
    "YELLOW": {
        "trigger": -0.10,
        "stake_multiplier": 0.75,
        "action": "reduce_stake",
    },
    "ORANGE": {
        "trigger": -0.20,
        "stake_multiplier": 0.50,
        "action": "reduce_and_restrict",
        "restrict_tiers": [4, 5],
    },
    "RED": {
        "trigger": -0.30,
        "stake_multiplier": 0.0,
        "action": "full_stop",
        "requires_manual_review": True,
    },
}

# Evaluated worst-first so the highest active level always wins
_LEVEL_PRIORITY = ("RED", "ORANGE", "YELLOW")


class CircuitBreakerLevel(Enum):
    NONE = "NONE"
    YELLOW = "YELLOW"
    ORANGE = "ORANGE"
    RED = "RED"


@dataclass
class CircuitBreakerState:
    level: CircuitBreakerLevel
    stake_multiplier: float
    action: str
    drawdown: float
    peak_bankroll: float
    current_bankroll: float
    restricted_tiers: list
    requires_manual_review: bool
    level_changed: bool


class DrawdownCircuitBreaker:
    """
    Tiered drawdown circuit breaker.

    High watermark tracks the all-time peak bankroll (moves up only).
    Drawdown = (peak - current) / peak, always ≥ 0.
    Levels escalate/de-escalate automatically on each update().
    RED is sticky: can_place_bet() stays False until clear_manual_review()
    is explicitly called, even after full bankroll recovery.
    State is serializable for DB persistence via to_dict/from_dict.
    """

    def __init__(
        self,
        initial_bankroll: float,
        thresholds: Optional[dict] = None,
    ) -> None:
        self.thresholds: dict = thresholds or DEFAULT_THRESHOLDS
        self.peak_bankroll: float = initial_bankroll
        self._current_bankroll: float = initial_bankroll
        self.level: CircuitBreakerLevel = CircuitBreakerLevel.NONE
        self._manual_review_pending: bool = False

    # ── Core logic ────────────────────────────────────────────────────────────

    def update(self, current_bankroll: float) -> CircuitBreakerState:
        """Update state with latest bankroll figure. Returns current state snapshot."""
        self._current_bankroll = current_bankroll

        if current_bankroll > self.peak_bankroll:
            self.peak_bankroll = current_bankroll

        drawdown = self._compute_drawdown(current_bankroll)
        new_level, multiplier, action, restricted_tiers, requires_manual_review = (
            self._evaluate(drawdown)
        )

        level_changed = new_level != self.level
        self.level = new_level

        if new_level == CircuitBreakerLevel.RED:
            self._manual_review_pending = True

        return CircuitBreakerState(
            level=self.level,
            stake_multiplier=multiplier,
            action=action,
            drawdown=drawdown,
            peak_bankroll=self.peak_bankroll,
            current_bankroll=current_bankroll,
            restricted_tiers=restricted_tiers,
            requires_manual_review=requires_manual_review,
            level_changed=level_changed,
        )

    def can_place_bet(self, league_tier: int) -> bool:
        """Return False if this bet should be blocked given current circuit state."""
        if self._manual_review_pending:
            return False
        if self.level == CircuitBreakerLevel.RED:
            return False
        if self.level == CircuitBreakerLevel.ORANGE:
            restricted = self.thresholds.get("ORANGE", {}).get("restrict_tiers", [])
            return league_tier not in restricted
        return True

    def clear_manual_review(self) -> None:
        """Explicit operator action to lift the RED-triggered trading block."""
        self._manual_review_pending = False

    # ── Persistence ───────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        drawdown = self._compute_drawdown(self._current_bankroll)
        _, multiplier, action, restricted_tiers, requires_manual_review = self._evaluate(drawdown)
        return {
            "level": self.level.value,
            "peak_bankroll": self.peak_bankroll,
            "current_bankroll": self._current_bankroll,
            "drawdown": drawdown,
            "stake_multiplier": multiplier,
            "action": action,
            "restricted_tiers": restricted_tiers,
            "requires_manual_review": requires_manual_review,
            "manual_review_pending": self._manual_review_pending,
        }

    @classmethod
    def from_dict(
        cls,
        data: dict,
        thresholds: Optional[dict] = None,
    ) -> "DrawdownCircuitBreaker":
        instance = cls.__new__(cls)
        instance.thresholds = thresholds or DEFAULT_THRESHOLDS
        instance.peak_bankroll = float(data["peak_bankroll"])
        instance._current_bankroll = float(data["current_bankroll"])
        instance.level = CircuitBreakerLevel(data["level"])
        instance._manual_review_pending = bool(data.get("manual_review_pending", False))
        return instance

    # ── Internal helpers ─────────────────────────────────────────────────────

    def _compute_drawdown(self, current_bankroll: float) -> float:
        if self.peak_bankroll <= 0:
            return 0.0
        return max(0.0, (self.peak_bankroll - current_bankroll) / self.peak_bankroll)

    def _evaluate(self, drawdown: float):
        for level_name in _LEVEL_PRIORITY:
            t = self.thresholds.get(level_name)
            if t is None:
                continue
            if drawdown >= abs(t["trigger"]):
                return (
                    CircuitBreakerLevel[level_name],
                    float(t.get("stake_multiplier", 1.0)),
                    str(t.get("action", "none")),
                    list(t.get("restrict_tiers", [])),
                    bool(t.get("requires_manual_review", False)),
                )
        return CircuitBreakerLevel.NONE, 1.0, "none", [], False
