import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_paper_trade_writes_to_db_and_publishes():
    """TraderAgent routes all orders to paper — writes DB row and publishes to Redis."""
    from agents.trader import TraderAgent
    agent = TraderAgent()

    mock_session = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock(side_effect=lambda b: setattr(b, 'id', 42))
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)

    order = {
        "match_id": "123",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "selection": "home",
        "odds": "2.5",
        "stake": "10.0",
        "thesis": "Test thesis",
        "league": "PL",
    }

    with patch("agents.trader.AsyncSessionLocal", return_value=mock_session), \
         patch("agents.trader.publish", new_callable=AsyncMock) as mock_pub:
        await agent._execute_paper(order)
        mock_pub.assert_called_once()
        args = mock_pub.call_args[0]
        assert args[0] == "trader:executions"
        assert args[1]["paper"] == "true"


@pytest.mark.asyncio
async def test_experiment_mode_does_not_write_bets_table():
    """In EXPERIMENT_MODE the trader publishes but never opens a DB session
    (so the client-served `bets` table is never polluted)."""
    from agents.trader import TraderAgent
    agent = TraderAgent()

    order = {
        "match_id": "123",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "selection": "home",
        "odds": "2.5",
        "stake": "10.0",
        "league": "PL",
    }

    with patch("agents.trader.settings.EXPERIMENT_MODE", True), \
         patch("agents.trader.AsyncSessionLocal") as mock_sessionmaker, \
         patch("agents.trader.publish", new_callable=AsyncMock) as mock_pub:
        await agent._execute_paper(order)
        mock_sessionmaker.assert_not_called()
        mock_pub.assert_called_once()
        assert mock_pub.call_args[0][0] == "trader:executions"
        assert mock_pub.call_args[0][1]["bet_id"] == "experiment"


@pytest.mark.asyncio
async def test_paper_trade_skips_duplicate():
    """TraderAgent skips placing a bet when a pending one already exists for the same match."""
    from agents.trader import TraderAgent
    agent = TraderAgent()

    mock_session = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock()  # existing bet
    mock_session.execute = AsyncMock(return_value=mock_result)

    order = {
        "match_id": "999",
        "home_team": "X",
        "away_team": "Y",
        "selection": "away",
        "odds": "3.0",
        "stake": "5.0",
        "league": "SA",
    }

    with patch("agents.trader.AsyncSessionLocal", return_value=mock_session), \
         patch("agents.trader.publish", new_callable=AsyncMock) as mock_pub:
        await agent._execute_paper(order)
        mock_pub.assert_not_called()
