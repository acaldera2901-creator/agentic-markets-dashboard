import pytest
from agents.monitor import is_heartbeat_stale, compute_pnl


def test_heartbeat_stale_when_old():
    from datetime import datetime, timedelta
    old = (datetime.utcnow() - timedelta(seconds=90)).isoformat()
    assert is_heartbeat_stale(old, timeout_seconds=60) is True


def test_heartbeat_fresh():
    from datetime import datetime
    fresh = datetime.utcnow().isoformat()
    assert is_heartbeat_stale(fresh, timeout_seconds=60) is False


def test_compute_pnl():
    bets = [
        {"stake": 10.0, "odds": 2.5, "status": "won"},
        {"stake": 10.0, "odds": 2.0, "status": "lost"},
    ]
    pnl = compute_pnl(bets)
    assert abs(pnl - 5.0) < 0.01
