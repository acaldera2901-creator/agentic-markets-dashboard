"""ShadowEvalAgent — forward-only Stake/Roobet shadow-eval loop (#SPORTSBOOK-SHADOW-1).

Every cycle: join the served predictions to the latest Stake/Roobet quotes and
log per-book SHADOW probabilities to sportsbook_shadow_eval, then settle any
shadow rows whose match has resolved. Read-only w.r.t. the served path — it
NEVER touches the prediction the customer sees; it only logs a parallel A/B so
Andrea can decide keep/drop on the numbers (scripts/shadow_eval_report.py).

Gated by SHADOW_EVAL_ENABLED (default ON). Fail-soft: a cycle crash never
propagates. Promotion of any book into the served model is a separate, explicit
deploy gated by a human APPROVE.
"""
import asyncio
import logging

from config.settings import settings

logger = logging.getLogger("ShadowEvalAgent")

POLL_INTERVAL = getattr(settings, "SHADOW_EVAL_POLL_INTERVAL", 600)


class ShadowEvalAgent:
    def __init__(self):
        self.name = "ShadowEvalAgent"
        self.logger = logger
        self._running = False

    def _enabled(self) -> bool:
        return bool(getattr(settings, "SHADOW_EVAL_ENABLED", True))

    async def cycle_once(self) -> tuple[int, int]:
        """One cycle: collect + settle. Returns (rows_written, rows_settled)."""
        if not self._enabled():
            return (0, 0)
        from core.shadow_collector import collect_once
        from core.shadow_settlement import settle_once

        written = 0
        settled = 0
        try:
            written = await collect_once()
        except Exception as exc:
            self.logger.warning("shadow collect failed (non-fatal): %s", exc)
        try:
            settled = await settle_once()
        except Exception as exc:
            self.logger.warning("shadow settle failed (non-fatal): %s", exc)
        return (written, settled)

    async def run(self):
        self._running = True
        self.logger.info("started (poll %ds, enabled=%s)", POLL_INTERVAL, self._enabled())
        while self._running:
            try:
                await self.cycle_once()
            except Exception as e:
                self.logger.exception("cycle crashed: %s", e)
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")
    asyncio.run(ShadowEvalAgent().run())
