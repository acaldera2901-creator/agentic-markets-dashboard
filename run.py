import asyncio
import logging
import os
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
from agents.sportsbook_scraper import SportsbookScraperAgent
from agents.shadow_eval_agent import ShadowEvalAgent
from core.db import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
log = logging.getLogger("run")


async def _health_server(port: int = 8080) -> None:
    """Minimal HTTP health server so Fly.io knows the process is alive."""
    from aiohttp import web

    async def handle(request):
        return web.Response(text='{"status":"ok"}', content_type="application/json")

    app = web.Application()
    app.router.add_get("/health", handle)
    app.router.add_get("/", handle)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    log.info("health server listening on :%d", port)


async def main():
    try:
        await init_db()
        log.info("DB initialized")
    except Exception as e:
        log.error("DB init failed (non-fatal): %s", e)

    # Player data foundation (sotto-progetto A) — fail-soft, no-op se tabelle assenti
    from datetime import date
    from core.player_data_sync import sync_player_profiles
    try:
        psum = await sync_player_profiles(season=date.today().year, today_iso=date.today().isoformat())
        log.info("player_profiles sync: %s", psum)
    except Exception as exc:
        log.warning("player_profiles sync failed (non-blocking): %s", exc)

    port = int(os.environ.get("PORT", 8080))
    await _health_server(port)

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
        # Sportsbook odds scraper (Stake/Roobet → odds_snapshots, real-time)
        SportsbookScraperAgent(),
        # Stake/Roobet shadow-eval (forward-only A/B → sportsbook_shadow_eval; never serves)
        ShadowEvalAgent(),
    ]
    log.info("Starting %d agents", len(agents))
    await asyncio.gather(*[agent.run() for agent in agents])


if __name__ == "__main__":
    asyncio.run(main())
