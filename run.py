import asyncio
import logging
from agents.data_collector import DataCollectorAgent
from agents.model import ModelAgent
from agents.analyst import AnalystAgent
from agents.strategist import StrategistAgent
from agents.risk_manager import RiskManagerAgent
from agents.trader import TraderAgent
from agents.monitor import MonitorAgent
from agents.research import ResearchAgent
from agents.ah_collector import AHCollectorAgent
from agents.result_settlement import ResultSettlementAgent
from agents.tennis_data_collector import TennisDataCollectorAgent
from agents.tennis_model_agent import TennisModelAgent
from agents.tennis_analyst import TennisAnalystAgent
from agents.tennis_risk_manager import TennisRiskManagerAgent
from agents.tennis_trader import TennisTraderAgent
from agents.tennis_settlement import TennisSettlementAgent
from agents.tennis_research_agent import TennisResearchAgent
from core.db import init_db

logging.basicConfig(level=logging.INFO)


async def main():
    await init_db()
    agents = [
        # Football pipeline
        DataCollectorAgent(),
        ModelAgent(),
        AnalystAgent(),
        StrategistAgent(),
        RiskManagerAgent(),
        TraderAgent(),
        MonitorAgent(),
        ResearchAgent(),
        AHCollectorAgent(),
        ResultSettlementAgent(),
        # Tennis pipeline
        TennisDataCollectorAgent(),
        TennisModelAgent(),
        TennisAnalystAgent(),
        TennisRiskManagerAgent(),
        TennisTraderAgent(),
        TennisSettlementAgent(),
        TennisResearchAgent(),
    ]
    await asyncio.gather(*[agent.run() for agent in agents])


if __name__ == "__main__":
    asyncio.run(main())
