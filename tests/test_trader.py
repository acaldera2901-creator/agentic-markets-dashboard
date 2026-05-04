import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_paper_trade_does_not_call_betfair():
    from agents.trader import TraderAgent
    agent = TraderAgent()

    mock_session = AsyncMock()
    mock_bet = MagicMock()
    mock_bet.id = 42
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock(side_effect=lambda b: setattr(b, 'id', 42))

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
