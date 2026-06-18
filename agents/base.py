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
    # Restart supervisor: a transient failure inside _main_loop (e.g. a Redis
    # blip in consume()) must NOT silently kill the agent for good. We restart
    # it with exponential backoff while _running, resetting the backoff once a
    # run has stayed up long enough to be considered healthy.
    RESTART_BACKOFF_MIN: float = 1.0
    RESTART_BACKOFF_MAX: float = 60.0
    RESTART_STABLE_SECS: float = 60.0

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
        loop = asyncio.get_event_loop()
        backoff = self.RESTART_BACKOFF_MIN
        try:
            while self._running:
                started = loop.time()
                try:
                    await self._main_loop()
                    break  # _main_loop returned on its own → nothing to restart
                except asyncio.CancelledError:
                    raise  # cooperative shutdown, never swallow
                except Exception as e:
                    if not self._running:
                        break
                    if loop.time() - started >= self.RESTART_STABLE_SECS:
                        backoff = self.RESTART_BACKOFF_MIN  # was healthy → fresh backoff
                    self.logger.exception(
                        f"_main_loop crashed; restarting in {backoff:.0f}s: {e}"
                    )
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, self.RESTART_BACKOFF_MAX)
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
