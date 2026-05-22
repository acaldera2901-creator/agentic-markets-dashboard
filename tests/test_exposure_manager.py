"""
Unit tests for risk.exposure_manager.ExposureManager

Tracks open exposure per league and per matchday.
Exputes an exposure_factor in [0, 1] passed to CompositeStakeCalculator.

Limits (configurable):
  max_league_exposure_pct:  max fraction of bankroll on one league  (default 0.20)
  max_matchday_exposure_pct: max fraction on one matchday           (default 0.15)
  max_total_exposure_pct:   max total open exposure                 (default 0.40)

exposure_factor logic:
  - If adding new_stake would breach any limit → factor = 0.0 (block)
  - Otherwise → factor = headroom / (limit * bankroll) normalised to [0, 1]
    (1.0 when far from limit, approaching 0 as limit nears)

Tests define the interface BEFORE implementation.
Run: pytest tests/test_exposure_manager.py -v
"""
import pytest
from risk.exposure_manager import ExposureManager, ExposureState


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def em():
    return ExposureManager(
        max_league_pct=0.20,
        max_matchday_pct=0.15,
        max_total_pct=0.40,
    )


# ── ExposureState dataclass ───────────────────────────────────────────────────

class TestExposureState:
    def test_state_returned_by_evaluate(self, em):
        state = em.evaluate(
            bankroll=1000.0,
            new_stake=10.0,
            league_id="PL",
            matchday_id="2024-10-05",
        )
        assert isinstance(state, ExposureState)

    def test_state_has_exposure_factor(self, em):
        state = em.evaluate(1000.0, 10.0, "PL", "2024-10-05")
        assert hasattr(state, "exposure_factor")

    def test_state_has_blocked_flag(self, em):
        state = em.evaluate(1000.0, 10.0, "PL", "2024-10-05")
        assert hasattr(state, "blocked")

    def test_state_has_block_reason(self, em):
        state = em.evaluate(1000.0, 10.0, "PL", "2024-10-05")
        assert hasattr(state, "block_reason")

    def test_state_has_league_exposure(self, em):
        state = em.evaluate(1000.0, 10.0, "PL", "2024-10-05")
        assert hasattr(state, "league_exposure")

    def test_state_has_matchday_exposure(self, em):
        state = em.evaluate(1000.0, 10.0, "PL", "2024-10-05")
        assert hasattr(state, "matchday_exposure")

    def test_state_has_total_exposure(self, em):
        state = em.evaluate(1000.0, 10.0, "PL", "2024-10-05")
        assert hasattr(state, "total_exposure")


# ── Evaluate does NOT commit stake ────────────────────────────────────────────

class TestEvaluateNotCommit:
    def test_evaluate_does_not_increase_exposure(self, em):
        em.evaluate(1000.0, 50.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 50.0, "PL", "2024-10-05")
        # Second evaluate still sees zero existing exposure
        assert state.league_exposure == pytest.approx(0.0)

    def test_commit_increases_exposure(self, em):
        em.commit(stake=50.0, league_id="PL", matchday_id="2024-10-05")
        state = em.evaluate(1000.0, 0.0, "PL", "2024-10-05")
        assert state.league_exposure == pytest.approx(50.0)


# ── League exposure limit ─────────────────────────────────────────────────────

class TestLeagueExposureLimit:
    def test_small_stake_not_blocked(self, em):
        state = em.evaluate(1000.0, 10.0, "PL", "2024-10-05")
        assert state.blocked is False
        assert state.exposure_factor > 0.0

    def test_stake_that_breaches_league_limit_blocked(self, em):
        # 20% league limit = 200 on bankroll 1000
        # Commit 190, then try 15 more → 205 > 200
        em.commit(190.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 15.0, "PL", "2024-10-05")
        assert state.blocked is True
        assert state.exposure_factor == pytest.approx(0.0)

    def test_stake_exactly_at_league_limit_not_blocked(self, em):
        # Commit 180 on one matchday; evaluate the extra 20 on a fresh matchday
        # so only the league limit is the binding constraint (180+20=200=20%)
        em.commit(180.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 20.0, "PL", "2024-10-12")
        assert state.blocked is False

    def test_block_reason_mentions_league(self, em):
        em.commit(195.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 10.0, "PL", "2024-10-05")
        assert state.blocked is True
        assert "league" in state.block_reason.lower() or "PL" in state.block_reason

    def test_different_leagues_tracked_independently(self, em):
        em.commit(190.0, "PL", "2024-10-05")
        # PL is near its league limit; LL on a separate matchday has zero exposure
        state = em.evaluate(1000.0, 20.0, "LL", "2024-10-12")
        assert state.blocked is False


# ── Matchday exposure limit ───────────────────────────────────────────────────

class TestMatchdayExposureLimit:
    def test_matchday_stake_that_breaches_limit_blocked(self, em):
        # 15% matchday limit = 150 on bankroll 1000
        em.commit(140.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 15.0, "LL", "2024-10-05")  # different league, same matchday
        assert state.blocked is True

    def test_different_matchdays_tracked_independently(self, em):
        em.commit(140.0, "PL", "2024-10-05")
        # Oct 5 is near matchday limit, Oct 12 is fresh
        state = em.evaluate(1000.0, 20.0, "PL", "2024-10-12")
        assert state.blocked is False

    def test_block_reason_mentions_matchday(self, em):
        em.commit(145.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 10.0, "LL", "2024-10-05")
        assert state.blocked is True
        assert "matchday" in state.block_reason.lower()


# ── Total exposure limit ──────────────────────────────────────────────────────

class TestTotalExposureLimit:
    def test_total_exposure_breach_blocks_any_league(self, em):
        # 40% total limit = 400 on bankroll 1000
        # Spread across 3 leagues so no single-league limit hit
        em.commit(130.0, "PL", "2024-10-05")
        em.commit(130.0, "LL", "2024-10-05")
        em.commit(130.0, "BL", "2024-10-05")  # total = 390
        # 390 + 15 = 405 > 400 → blocked
        state = em.evaluate(1000.0, 15.0, "SA", "2024-10-05")
        assert state.blocked is True

    def test_total_exposure_block_reason_mentions_total(self, em):
        # Spread across different matchdays so matchday limit is never hit;
        # total = 390 → adding 15 on a fresh matchday triggers the total limit
        em.commit(130.0, "PL", "2024-10-03")
        em.commit(130.0, "LL", "2024-10-04")
        em.commit(130.0, "BL", "2024-10-05")
        state = em.evaluate(1000.0, 15.0, "SA", "2024-10-06")
        assert state.blocked is True
        assert "total" in state.block_reason.lower()


# ── Exposure factor interpolation ─────────────────────────────────────────────

class TestExposureFactorInterpolation:
    def test_zero_exposure_gives_factor_one(self, em):
        state = em.evaluate(1000.0, 0.0, "PL", "2024-10-05")
        assert state.exposure_factor == pytest.approx(1.0)

    def test_factor_decreases_as_exposure_grows(self, em):
        em.commit(100.0, "PL", "2024-10-05")
        state_low = em.evaluate(1000.0, 0.0, "PL", "2024-10-05")
        em.commit(80.0, "PL", "2024-10-05")
        state_high = em.evaluate(1000.0, 0.0, "PL", "2024-10-05")
        assert state_high.exposure_factor < state_low.exposure_factor

    def test_factor_is_between_zero_and_one(self, em):
        em.commit(150.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 0.0, "PL", "2024-10-05")
        assert 0.0 <= state.exposure_factor <= 1.0


# ── Release / settlement ──────────────────────────────────────────────────────

class TestRelease:
    def test_release_reduces_league_exposure(self, em):
        em.commit(80.0, "PL", "2024-10-05")
        em.release(30.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 0.0, "PL", "2024-10-05")
        assert state.league_exposure == pytest.approx(50.0)

    def test_release_reduces_total_exposure(self, em):
        em.commit(80.0, "PL", "2024-10-05")
        em.release(30.0, "PL", "2024-10-05")
        state = em.evaluate(1000.0, 0.0, "PL", "2024-10-05")
        assert state.total_exposure == pytest.approx(50.0)

    def test_release_cannot_make_exposure_negative(self, em):
        em.commit(20.0, "PL", "2024-10-05")
        em.release(50.0, "PL", "2024-10-05")  # release more than committed
        state = em.evaluate(1000.0, 0.0, "PL", "2024-10-05")
        assert state.league_exposure >= 0.0

    def test_release_after_settle_unlocks_capacity(self, em):
        em.commit(190.0, "PL", "2024-10-05")
        # Evaluate on a fresh matchday so only the league limit applies:
        # 190+15=205 > 200 → blocked
        s1 = em.evaluate(1000.0, 15.0, "PL", "2024-10-12")
        assert s1.blocked is True
        em.release(30.0, "PL", "2024-10-05")
        # After release: league = 160; 160+15=175 ≤ 200 → not blocked
        s2 = em.evaluate(1000.0, 15.0, "PL", "2024-10-12")
        assert s2.blocked is False
