"""
Unit tests for learning.asian_handicap.AsianHandicapEngine
Run: pytest tests/test_asian_handicap.py -v
"""
import pytest
from learning.asian_handicap import AsianHandicapEngine, HandicapResult, HandicapLine


@pytest.fixture
def engine():
    return AsianHandicapEngine()


# ── HandicapLine parsing ──────────────────────────────────────────────────────

class TestHandicapLineParsing:
    def test_parse_quarter_ball_positive(self, engine):
        line = engine.parse_handicap("+0.25")
        assert isinstance(line, HandicapLine)
        assert line.value == pytest.approx(0.25)

    def test_parse_quarter_ball_negative(self, engine):
        line = engine.parse_handicap("-0.75")
        assert line.value == pytest.approx(-0.75)

    def test_parse_half_ball(self, engine):
        line = engine.parse_handicap("-0.5")
        assert line.value == pytest.approx(-0.5)

    def test_parse_whole_ball(self, engine):
        line = engine.parse_handicap("0")
        assert line.value == pytest.approx(0.0)

    def test_parse_positive_whole_ball(self, engine):
        line = engine.parse_handicap("+1.0")
        assert line.value == pytest.approx(1.0)

    def test_parse_string_without_sign(self, engine):
        line = engine.parse_handicap("0.5")
        assert line.value == pytest.approx(0.5)

    def test_invalid_handicap_raises(self, engine):
        with pytest.raises(ValueError):
            engine.parse_handicap("abc")

    def test_quarter_ball_is_split_line(self, engine):
        line = engine.parse_handicap("+0.25")
        assert line.is_split is True

    def test_half_ball_is_not_split(self, engine):
        line = engine.parse_handicap("-0.5")
        assert line.is_split is False

    def test_whole_ball_is_not_split(self, engine):
        line = engine.parse_handicap("0")
        assert line.is_split is False


# ── Settle: whole / half lines ────────────────────────────────────────────────

class TestSettleWholeHalf:
    def test_home_minus_half_home_wins(self, engine):
        # home -0.5, home wins 2-0 → WIN
        result = engine.settle(handicap="-0.5", selection="home", home_goals=2, away_goals=0)
        assert result.outcome == "win"

    def test_home_minus_half_draw_loses(self, engine):
        # home -0.5, draw → LOSE (home adjusted to -0.5 < 0)
        result = engine.settle(handicap="-0.5", selection="home", home_goals=1, away_goals=1)
        assert result.outcome == "lose"

    def test_home_plus_half_draw_wins(self, engine):
        # home +0.5, draw → WIN
        result = engine.settle(handicap="+0.5", selection="home", home_goals=1, away_goals=1)
        assert result.outcome == "win"

    def test_home_plus_half_away_wins_loses(self, engine):
        # home +0.5, away wins 0-1 → LOSE
        result = engine.settle(handicap="+0.5", selection="home", home_goals=0, away_goals=1)
        assert result.outcome == "lose"

    def test_whole_ball_push(self, engine):
        # home -1, home wins 1-0 → PUSH
        result = engine.settle(handicap="-1", selection="home", home_goals=1, away_goals=0)
        assert result.outcome == "push"

    def test_whole_ball_win(self, engine):
        # home -1, home wins 2-0 → WIN
        result = engine.settle(handicap="-1", selection="home", home_goals=2, away_goals=0)
        assert result.outcome == "win"

    def test_whole_ball_lose(self, engine):
        # home -1, draw → LOSE
        result = engine.settle(handicap="-1", selection="home", home_goals=1, away_goals=1)
        assert result.outcome == "lose"


# ── Settle: split lines (quarter ball) ───────────────────────────────────────

class TestSettleSplitLines:
    def test_quarter_ball_full_win(self, engine):
        # home +0.25, home wins → WIN on both halves → full win
        result = engine.settle(handicap="+0.25", selection="home", home_goals=2, away_goals=1)
        assert result.outcome == "win"
        assert result.stake_return == pytest.approx(1.0)

    def test_quarter_ball_half_win_push(self, engine):
        # home +0.25, draw → 0 push, +0.5 win → half win
        result = engine.settle(handicap="+0.25", selection="home", home_goals=1, away_goals=1)
        assert result.outcome == "half_win"
        assert result.stake_return == pytest.approx(0.5)

    def test_quarter_ball_half_lose(self, engine):
        # home -0.25, draw → 0 push, -0.5 lose → half lose
        result = engine.settle(handicap="-0.25", selection="home", home_goals=1, away_goals=1)
        assert result.outcome == "half_lose"
        assert result.stake_return == pytest.approx(-0.5)

    def test_quarter_ball_full_lose(self, engine):
        # home +0.25, away wins → both halves lose → full lose
        result = engine.settle(handicap="+0.25", selection="home", home_goals=0, away_goals=2)
        assert result.outcome == "lose"
        assert result.stake_return == pytest.approx(-1.0)


# ── Expected value ────────────────────────────────────────────────────────────

class TestExpectedValue:
    def test_positive_ev_when_edge_exists(self, engine):
        ev = engine.expected_value(p_win=0.55, odds=2.00)
        assert ev > 0

    def test_negative_ev_when_no_edge(self, engine):
        ev = engine.expected_value(p_win=0.40, odds=2.00)
        assert ev < 0

    def test_breakeven_ev_near_zero(self, engine):
        ev = engine.expected_value(p_win=0.50, odds=2.00)
        assert abs(ev) < 0.01

    def test_ev_with_half_win_probability(self, engine):
        # p_push and p_half_win accounted
        ev = engine.expected_value(p_win=0.40, odds=1.90, p_push=0.10, p_half_win=0.15)
        assert isinstance(ev, float)


# ── Probability conversion ────────────────────────────────────────────────────

class TestProbabilityConversion:
    def test_convert_match_probs_to_ah_prob(self, engine):
        prob = engine.match_probs_to_ah_probability(
            p_home=0.55, p_draw=0.25, p_away=0.20,
            handicap="-0.5",
        )
        assert 0.0 <= prob <= 1.0

    def test_strong_home_team_high_prob_on_minus_half(self, engine):
        prob = engine.match_probs_to_ah_probability(
            p_home=0.70, p_draw=0.20, p_away=0.10,
            handicap="-0.5",
        )
        assert prob > 0.50

    def test_weak_home_team_low_prob_on_minus_half(self, engine):
        prob = engine.match_probs_to_ah_probability(
            p_home=0.25, p_draw=0.30, p_away=0.45,
            handicap="-0.5",
        )
        assert prob < 0.50
