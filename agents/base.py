import asyncio
import json
import logging
import httpx
from abc import ABC, abstractmethod
from datetime import datetime
from config.settings import settings
from core.redis_client import set_heartbeat
from core.supabase_client import upsert_heartbeat

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(name)
        self._running = False
        self._researched: set = set()  # used by ResearchAgent
        self._status_detail: dict | str | None = None

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
            detail = self._serialize_status_detail()
            await asyncio.gather(
                self._post_dashboard_heartbeat(detail),
                upsert_heartbeat(self.name, detail),
                return_exceptions=True,
            )
            await asyncio.sleep(settings.HEARTBEAT_INTERVAL)

    def set_status_detail(self, detail: dict | str | None) -> None:
        """Expose structured, non-secret runtime state to health/diagnostics."""
        self._status_detail = detail

    def _serialize_status_detail(self) -> str | None:
        if self._status_detail is None:
            return None
        if isinstance(self._status_detail, str):
            return self._status_detail[:4000]
        try:
            return json.dumps(self._status_detail, separators=(",", ":"), default=str)[:4000]
        except Exception:
            return str(self._status_detail)[:4000]

    async def _post_dashboard_heartbeat(self, detail: str | None = None) -> None:
        """POST heartbeat to dashboard DB so agent status is visible in the web UI."""
        if not settings.DASHBOARD_URL:
            return
        try:
            headers = {}
            if settings.RESEARCH_SECRET:
                headers["Authorization"] = f"Bearer {settings.RESEARCH_SECRET}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{settings.DASHBOARD_URL}/api/health",
                    json={"agent_name": self.name, "detail": detail},
                    headers=headers,
                )
        except Exception:
            pass  # heartbeat failure is non-fatal

    @abstractmethod
    async def _main_loop(self) -> None:
        pass

    def stop(self) -> None:
        self._running = False
