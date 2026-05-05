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
from core.db import init_db

logging.basicConfig(level=logging.INFO)


async def main():
    await init_db()
    agents = [
        DataCollectorAgent(),
        ModelAgent(),
        AnalystAgent(),
        StrategistAgent(),
        RiskManagerAgent(),
        TraderAgent(),
        MonitorAgent(),
        ResearchAgent(),
        AHCollectorAgent(),
    ]
    await asyncio.gather(*[agent.run() for agent in agents])


if __name__ == "__main__":
    asyncio.run(main())
