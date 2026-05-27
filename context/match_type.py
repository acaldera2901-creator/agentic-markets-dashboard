"""
MatchTypeClassifier — classifies a match into one of 10 strategic types.

Detection is purely rule-based: no external calls, no DB, deterministic.
Input: the enriched data dict flowing through the pipeline.
"""
import difflib
import unicodedata
from enum import Enum
from config.settings import settings


class MatchType(str, Enum):
    DERBY_NATIONAL    = "DERBY_NATIONAL"     # city/regional rivalry, high emotional variance
    TITLE_DECIDER     = "TITLE_DECIDER"      # top-2 teams within 3 pts, late season
    RELEGATION_BATTLE = "RELEGATION_BATTLE"  # bottom-3 teams, must-win pressure
    DEAD_RUBBER       = "DEAD_RUBBER"        # nothing at stake (already relegated/promoted/eliminated)
    SHORT_REST        = "SHORT_REST"         # ≤ 3 days since last match → likely rotation
    ROTATION_EXPECTED = "ROTATION_EXPECTED"  # 2nd leg of KO tie with first-leg lead > 2
    EUROPEAN_HANGOVER = "EUROPEAN_HANGOVER"  # midweek European game + weekend league
    NEUTRAL_VENUE     = "NEUTRAL_VENUE"      # finals / playoff semi/finals
    CUP_SPILLOVER     = "CUP_SPILLOVER"      # domestic cup tie mid-league run
    STANDARD          = "STANDARD"           # none of the above


# ---------------------------------------------------------------------------
# Known derbies: list of (team_a_fragment, team_b_fragment) — lowercase, no accents
# Matching is fuzzy so "münchen" and "munich" both hit "munich"
# ---------------------------------------------------------------------------
_KNOWN_DERBIES: list[tuple[str, str]] = [
    # Italia — Serie A
    ("milan", "inter"),
    ("juventus", "torino"),
    ("roma", "lazio"),
    ("napoli", "salernitana"),
    ("fiorentina", "empoli"),
    ("atalanta", "brescia"),
    # Inghilterra — Premier League
    ("manchester united", "manchester city"),
    ("arsenal", "tottenham"),
    ("liverpool", "everton"),
    ("chelsea", "fulham"),
    ("newcastle", "sunderland"),
    ("leeds", "sheffield"),
    # Spagna — La Liga
    ("barcelona", "espanyol"),
    ("real madrid", "atletico madrid"),
    ("sevilla", "betis"),
    ("valencia", "villarreal"),
    # Germania — Bundesliga
    ("dortmund", "schalke"),
    ("hamburg", "werder"),
    ("munchen", "nurnberg"),
    # Francia — Ligue 1
    ("marseille", "psg"),
    ("lyon", "saint-etienne"),
    ("bordeaux", "toulouse"),
    # Champions / Europa (always possible to meet)
    ("celtic", "rangers"),
    ("ajax", "feyenoord"),
    ("benfica", "porto"),
    ("galatasaray", "fenerbahce"),
    ("river", "boca"),
]


def _normalize(name: str) -> str:
    """NFKD normalize + strip accents + lowercase."""
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def _fuzzy_contains(haystack: str, needle: str, threshold: float = None) -> bool:
    threshold = threshold if threshold is not None else settings.DERBY_THRESHOLD
    ratio = difflib.SequenceMatcher(None, needle, haystack).ratio()
    return ratio >= threshold or needle in haystack


def _is_derby(home: str, away: str) -> bool:
    h = _normalize(home)
    a = _normalize(away)
    for ta, tb in _KNOWN_DERBIES:
        if (
            (_fuzzy_contains(h, ta) and _fuzzy_contains(a, tb))
            or (_fuzzy_contains(h, tb) and _fuzzy_contains(a, ta))
        ):
            return True
    return False


class MatchTypeClassifier:
    """
    Stateless classifier. Call `classify(data)` with the pipeline data dict.

    Required fields consumed (all optional — graceful degradation):
      home_team, away_team, league,
      home_position, away_position, total_teams,      # standings
      home_days_since_last, away_days_since_last,     # fixture congestion
      home_last_goal_diff, away_last_goal_diff,        # knockout leg context
      is_cup, is_neutral,                              # competition metadata
      home_points, away_points, points_gap,           # title race
      season_week, total_weeks,                       # season progression
    """

    def classify(self, data: dict) -> MatchType:
        home = data.get("home_team", "")
        away = data.get("away_team", "")

        if data.get("is_neutral"):
            return MatchType.NEUTRAL_VENUE

        if data.get("is_cup"):
            return MatchType.CUP_SPILLOVER

        if _is_derby(home, away):
            return MatchType.DERBY_NATIONAL

        mt = self._check_short_rest(data)
        if mt:
            return mt

        mt = self._check_rotation_expected(data)
        if mt:
            return mt

        mt = self._check_european_hangover(data)
        if mt:
            return mt

        mt = self._check_title_decider(data)
        if mt:
            return mt

        mt = self._check_relegation_battle(data)
        if mt:
            return mt

        mt = self._check_dead_rubber(data)
        if mt:
            return mt

        return MatchType.STANDARD

    # ------------------------------------------------------------------
    # Individual detection rules
    # ------------------------------------------------------------------

    def _check_short_rest(self, data: dict) -> MatchType | None:
        h_days = data.get("home_days_since_last")
        a_days = data.get("away_days_since_last")
        if h_days is not None and h_days <= 3:
            return MatchType.SHORT_REST
        if a_days is not None and a_days <= 3:
            return MatchType.SHORT_REST
        return None

    def _check_rotation_expected(self, data: dict) -> MatchType | None:
        # 2nd leg knockout with aggregate lead > 2 goals → probable B-team
        is_second_leg = data.get("is_second_leg", False)
        agg_diff = data.get("home_aggregate_diff")  # positive = home team leads
        if is_second_leg and agg_diff is not None and abs(agg_diff) > 2:
            return MatchType.ROTATION_EXPECTED
        return None

    def _check_european_hangover(self, data: dict) -> MatchType | None:
        # either team played European midweek (Thu/Wed) before this weekend match
        h_euro = data.get("home_european_midweek", False)
        a_euro = data.get("away_european_midweek", False)
        if h_euro or a_euro:
            return MatchType.EUROPEAN_HANGOVER
        return None

    def _check_title_decider(self, data: dict) -> MatchType | None:
        h_pos = data.get("home_position")
        a_pos = data.get("away_position")
        pts_gap = data.get("points_gap")          # abs pts between the two
        season_pct = self._season_progress(data)

        if h_pos is None or a_pos is None:
            return None
        # Both in top 2, late season (≥70%), within 3 points of each other
        top2 = {h_pos, a_pos}.issubset({1, 2})
        close = pts_gap is not None and pts_gap <= 3
        late = season_pct is not None and season_pct >= 0.70
        if top2 and close and late:
            return MatchType.TITLE_DECIDER
        return None

    def _check_relegation_battle(self, data: dict) -> MatchType | None:
        total = data.get("total_teams")
        h_pos = data.get("home_position")
        a_pos = data.get("away_position")
        if total is None or h_pos is None or a_pos is None:
            return None
        relegation_zone = total - 2  # bottom 3 in 20-team league → pos ≥ 18
        if h_pos >= relegation_zone or a_pos >= relegation_zone:
            return MatchType.RELEGATION_BATTLE
        return None

    def _check_dead_rubber(self, data: dict) -> MatchType | None:
        # Both teams with mathematically secure positions (nothing to gain/lose)
        h_safe = data.get("home_position_confirmed")   # bool: promotion/safe/relegated
        a_safe = data.get("away_position_confirmed")
        if h_safe and a_safe:
            return MatchType.DEAD_RUBBER
        # Knockout: already eliminated
        if data.get("home_eliminated") or data.get("away_eliminated"):
            return MatchType.DEAD_RUBBER
        return None

    def _season_progress(self, data: dict) -> float | None:
        week = data.get("season_week")
        total = data.get("total_weeks")
        if week is None or total is None or total == 0:
            return None
        return week / total
