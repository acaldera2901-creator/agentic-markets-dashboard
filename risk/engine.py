from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import yaml

from risk.kelly import kelly_stake
from context.competition_factors import competition_type_factors
from risk.circuit_breaker import DrawdownCircuitBreaker, CircuitBreakerState
from risk.composite_stake import CompositeStakeCalculator, StakeDecision
from risk.exposure_manager import ExposureManager, ExposureState
from risk.variance_budget import WeeklyVarianceBudget, VarianceBudgetState

_DEFAULT_CONFIG = Path(__file__).parent.parent / "config" / "risk_config.yaml"

_COMPLETENESS_FIELDS = [
    "match_id", "league", "home_team", "away_team", "kickoff",
    "edge", "odds", "selection", "confidence", "p_home", "p_draw", "p_away",
]


@dataclass
class RiskDecision:
    approved: bool
    final_stake: float
    base_stake: float
    composite_multiplier: float
    skip_reason: Optional[str]
    factors: dict                      # the 7 clamped factors passed to CompositeStake
    circuit_state: CircuitBreakerState
    exposure_state: ExposureState
    variance_state: VarianceBudgetState
    match_id: str
    league_id: str


class RiskManagerEngine:
    """
    Decision layer between ValueEngine and order execution.

    evaluate()  — read-only check; returns RiskDecision without changing exposure
    commit()    — call after a bet is placed to register open stake + variance
    release()   — call after bet settlement to free exposure
    """

    def __init__(
        self,
        initial_bankroll: float,
        config_path: Optional[str] = None,
    ) -> None:
        cfg = self._load_config(config_path or str(_DEFAULT_CONFIG))

        cb_thresholds = {
            k: dict(v) for k, v in cfg["circuit_breaker"].items()
        }
        exp_cfg = cfg["exposure"]
        var_cfg = cfg["variance_budget"]
        stake_cfg = cfg["stake"]
        ci_cfg = cfg.get("ci_width", {})

        self._circuit_breaker = DrawdownCircuitBreaker(
            initial_bankroll=initial_bankroll,
            thresholds=cb_thresholds,
        )
        self._exposure = ExposureManager(
            max_league_pct=exp_cfg["max_league_pct"],
            max_matchday_pct=exp_cfg["max_matchday_pct"],
            max_total_pct=exp_cfg["max_total_pct"],
        )
        self._variance = WeeklyVarianceBudget(
            max_weekly_variance=var_cfg["max_weekly_variance"],
        )
        self._stake_calc = CompositeStakeCalculator(
            max_bet_abs=stake_cfg["max_bet_abs"],
        )

        self._kelly_fraction: float = stake_cfg["kelly_fraction"]
        self._max_bet_pct: float = stake_cfg.get("max_bet_pct", 0.05)
        self._min_stake: float = stake_cfg["min_stake"]
        self._stake_floor: float = stake_cfg.get("stake_floor", self._min_stake)
        self._max_ci_width: float = ci_cfg.get("max_ci_width", 1.0)

    # ── Public interface ──────────────────────────────────────────────────────

    def evaluate(
        self,
        value_bet: dict,
        bankroll: float,
        matchday_id: str,
    ) -> RiskDecision:
        """
        Compute final stake for a candidate bet without changing state.

        The circuit breaker watermark IS updated (it mirrors bankroll movement),
        but exposure and variance budget are NOT modified until commit() is called.
        """
        match_id = str(value_bet.get("match_id", ""))
        league_id = str(value_bet.get("league", ""))
        edge = float(value_bet.get("edge", 0.0))
        odds = float(value_bet.get("odds", 1.0))
        selection = str(value_bet.get("selection", "home"))

        # 1. Circuit breaker: update watermark, get drawdown multiplier
        circuit_state = self._circuit_breaker.update(bankroll)

        # 2. Early exit if circuit breaker blocks this league tier
        league_tier = value_bet.get("league_tier")
        if league_tier is not None and not self._circuit_breaker.can_place_bet(int(league_tier)):
            return self._blocked_decision(
                match_id, league_id, bankroll, edge, odds, matchday_id,
                skip_reason=f"circuit breaker {circuit_state.level.value} — "
                            f"bets on tier {league_tier} blocked",
                circuit_state=circuit_state,
            )

        # 3. Kelly base stake
        base_stake = kelly_stake(
            edge=edge,
            odds=odds,
            bankroll=bankroll,
            kelly_fraction=self._kelly_fraction,
            max_bet_pct=self._max_bet_pct,
        )

        # 4. Build the 7 factors (+ season phase as 8th multiplicative factor)
        win_prob = self._win_probability(value_bet, selection)
        season_phase_factor = min(1.0, max(0.0, float(value_bet.get("phase_stake_multiplier") or 1.0)))
        factors = {
            "data_completeness": self._data_completeness_factor(value_bet),
            "ci_width": self._ci_width_factor(value_bet),
            "league_predictability": float(value_bet.get("league_predictability_score") or 1.0),
            "match_type": self._match_type_factor(value_bet),
            "drawdown": circuit_state.stake_multiplier,
            "exposure": self._exposure.evaluate(bankroll, base_stake, league_id, matchday_id).exposure_factor,
            "variance_budget": self._variance.evaluate(win_prob).variance_budget_factor,
            "season_phase": season_phase_factor,
        }

        # Grab full states for the decision record
        exposure_state = self._exposure.evaluate(bankroll, base_stake, league_id, matchday_id)
        variance_state = self._variance.evaluate(win_prob)

        # 5. Composite stake
        stake_decision: StakeDecision = self._stake_calc.compute(base_stake, factors)

        # 6. Stake floor: Kelly on a small bankroll often produces sub-exchange-minimum
        # amounts. If the system approved the bet (multiplier > 0) but stake is below the
        # exchange floor, bump it up rather than rejecting a valid signal.
        final_computed = stake_decision.final_stake
        if stake_decision.composite_multiplier > 0.0 and 0.0 < final_computed < self._stake_floor:
            final_computed = self._stake_floor

        # 7. Min-stake gate
        skip_reason = stake_decision.skip_reason
        approved = final_computed >= self._min_stake and skip_reason is None
        if not approved and skip_reason is None:
            skip_reason = f"final stake {final_computed:.2f} below minimum {self._min_stake:.2f}"

        return RiskDecision(
            approved=approved,
            final_stake=final_computed if approved else 0.0,
            base_stake=base_stake,
            composite_multiplier=stake_decision.composite_multiplier,
            skip_reason=skip_reason,
            factors=stake_decision.factors,
            circuit_state=circuit_state,
            exposure_state=exposure_state,
            variance_state=variance_state,
            match_id=match_id,
            league_id=league_id,
        )

    def commit(
        self,
        league_id: str,
        matchday_id: str,
        stake: float,
        win_probability: float,
    ) -> None:
        """Register a placed bet: consume exposure and variance budget."""
        self._exposure.commit(stake, league_id, matchday_id)
        self._variance.commit(win_probability)

    def release(
        self,
        league_id: str,
        matchday_id: str,
        stake: float,
    ) -> None:
        """Release open exposure after bet settlement or cancellation."""
        self._exposure.release(stake, league_id, matchday_id)

    def restore_exposure(self, open_stakes: list) -> None:
        """Rebuild exposure books from still-open bets after a restart (#19)."""
        self._exposure.restore_from_pending(open_stakes)

    def clear_circuit_breaker(self) -> None:
        """Manual operator action to lift RED block after review."""
        self._circuit_breaker.clear_manual_review()

    # ── Factor helpers ────────────────────────────────────────────────────────

    def _data_completeness_factor(self, bet: dict) -> float:
        missing = [f for f in _COMPLETENESS_FIELDS if not bet.get(f)]
        return round((len(_COMPLETENESS_FIELDS) - len(missing)) / len(_COMPLETENESS_FIELDS), 3)

    def _ci_width_factor(self, bet: dict) -> float:
        ci_width = float(bet.get("ci_width", 0.0))
        if self._max_ci_width <= 0:
            return 1.0
        return max(0.0, min(1.0, 1.0 - ci_width / self._max_ci_width))

    def _match_type_factor(self, bet: dict) -> float:
        match_type = str(bet.get("match_type", "STANDARD"))
        factors = competition_type_factors.get(match_type, competition_type_factors["STANDARD"])
        return float(factors.get("stake_multiplier", 1.0))

    @staticmethod
    def _win_probability(bet: dict, selection: str) -> float:
        key = f"p_{selection}"
        val = bet.get(key) or bet.get("confidence", 0.5)
        return max(0.0, min(1.0, float(val)))

    # ── Blocked decision helper ───────────────────────────────────────────────

    def _blocked_decision(
        self,
        match_id: str,
        league_id: str,
        bankroll: float,
        edge: float,
        odds: float,
        matchday_id: str,
        skip_reason: str,
        circuit_state: CircuitBreakerState,
    ) -> RiskDecision:
        base_stake = kelly_stake(edge, odds, bankroll, self._kelly_fraction, self._max_bet_pct)
        return RiskDecision(
            approved=False,
            final_stake=0.0,
            base_stake=base_stake,
            composite_multiplier=0.0,
            skip_reason=skip_reason,
            factors={k: 0.0 for k in (
                "data_completeness", "ci_width", "league_predictability",
                "match_type", "drawdown", "exposure", "variance_budget", "season_phase",
            )},
            circuit_state=circuit_state,
            exposure_state=self._exposure.evaluate(bankroll, 0.0, league_id, matchday_id),
            variance_state=self._variance.evaluate(0.5),
            match_id=match_id,
            league_id=league_id,
        )

    # ── Config loading ────────────────────────────────────────────────────────

    @staticmethod
    def _load_config(path: str) -> dict:
        with open(path) as f:
            return yaml.safe_load(f)
