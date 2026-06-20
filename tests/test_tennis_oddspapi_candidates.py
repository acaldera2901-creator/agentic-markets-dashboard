from datetime import datetime, timezone, timedelta
from agents.tennis_data_collector import oddspapi_candidates


def _fx(p1, p2, hours_ahead, odds=None):
    return {"player1": p1, "player2": p2,
            "scheduled_at": (datetime.now(timezone.utc)+timedelta(hours=hours_ahead)).isoformat(),
            "odds_p1": odds}


def test_only_uncovered_within_window():
    fx = [
        _fx("A","B",3,odds=None),     # scoperto, fra 3h → candidato
        _fx("C","D",3,odds=1.8),      # ha già odds → NO
        _fx("E","F",20,odds=None),    # scoperto ma fra 20h (>6) → NO
        _fx("G","H",-1,odds=None),    # nel passato → NO
    ]
    tried = {}
    keys = oddspapi_candidates(fx, tried, near_hours=6, max_attempts=3)
    names = {(f["player1"]) for f in fx if _key_of(f) in keys}
    assert "A" in names and "C" not in names and "E" not in names and "G" not in names


def test_respects_attempt_cap():
    fx = [_fx("A","B",3,odds=None)]
    from core.tennis_odds_api_client import _pair_key
    k = _pair_key("A","B",fx[0]["scheduled_at"])
    tried = {k: 3}  # già 3 tentativi
    assert oddspapi_candidates(fx, tried, near_hours=6, max_attempts=3) == set()


def _key_of(f):
    from core.tennis_odds_api_client import _pair_key
    return _pair_key(f["player1"], f["player2"], f["scheduled_at"])
