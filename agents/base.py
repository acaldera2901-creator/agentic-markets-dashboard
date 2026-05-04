import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from config.settings import settings
from core.redis_client import set_heartbeat

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")

class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(name)
        self._running = False

    async def run(self) -> None:
        self._running = True
        self.logger.info("started")
        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        try:
            await self._main_loop()
        except Exception as e:
            self.logger.exception(f"crashed: {e}")
        finally:
            heartbeat_task.cancel()
            self._running = False

    async def _heartbeat_loop(self) -> None:
        while self._running:
            await set_heartbeat(self.name, settings.HEARTBEAT_TIMEOUT, datetime.utcnow().isoformat())
            await asyncio.sleep(settings.HEARTBEAT_INTERVAL)

    @abstractmethod
    async def _main_loop(self) -> None:
        pass

    def stop(self) -> None:
        self._running = False
