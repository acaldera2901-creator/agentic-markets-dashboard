"""SportsbookScraperAgent — feed odds Stake/Roobet in tempo reale (#SPORTSBOOK-SCRAPER-1).

Polla i feed dei book a intervalli e scrive le quote correnti in odds_snapshots
(source-tagged 'roobet'/'stake'). La tabella è write-only — nessun consumer live
la rilegge — quindi l'agente NON altera il modello di prediction (isolamento per
costruzione). Fornisce "dati in tempo reale": ogni ciclo aggiorna gli snapshot
che API/analisi/shadow-eval possono leggere.

Sempre attivo; kill-switch per-book (STAKE_ENABLED/ROOBET_ENABLED, default ON) +
auto-disable runtime di un book dopo N fetch falliti consecutivi (segnale ban).

Stato: Roobet operativo (feed BetBy/sptpub pubblico). Stake = client placeholder
finché il feed (login-gated, stake.it/Octavian, nodo ADM) non è decifrato.
"""
import asyncio
import logging

from config.settings import settings
from core.odds_api_client import snapshot_odds_to_supabase
from core.sportsbook import roobet as roobet_client
from core.sportsbook import stake as stake_client

logger = logging.getLogger("SportsbookScraperAgent")

POLL_INTERVAL = getattr(settings, "SPORTSBOOK_POLL_INTERVAL", 300)
MAX_FAILS = getattr(settings, "SPORTSBOOK_MAX_CONSECUTIVE_FAILS", 5)


class SportsbookScraperAgent:
    def __init__(self):
        self.name = "SportsbookScraperAgent"
        self.logger = logger
        self._running = False
        self._fail_counts = {"roobet": 0, "stake": 0}

    def _enabled(self, book: str) -> bool:
        flag = getattr(settings, f"{book.upper()}_ENABLED", True)
        return bool(flag) and self._fail_counts.get(book, 0) < MAX_FAILS

    async def scrape_once(self) -> int:
        """Un ciclo: fetch di ogni book abilitato → write odds_snapshots. Ritorna righe scritte."""
        written = 0
        clients = {"roobet": roobet_client, "stake": stake_client}  # risolti a runtime (patchabili)
        for book, client in clients.items():
            if not self._enabled(book):
                continue
            try:
                events = await client.fetch_events()
                rows = [e.to_snapshot_row() for e in events if e.competitors and e.scheduled]
                self._fail_counts[book] = 0
                if rows:
                    await snapshot_odds_to_supabase(rows)
                    written += len(rows)
                    self.logger.info("[SCRAPER] %s: %d quote → odds_snapshots", book, len(rows))
            except Exception as exc:
                self._fail_counts[book] += 1
                self.logger.warning("[SCRAPER] %s fetch fallito (%d/%d): %s",
                                    book, self._fail_counts[book], MAX_FAILS, exc)
                if self._fail_counts[book] >= MAX_FAILS:
                    self.logger.error("[SCRAPER] %s AUTO-DISABLED dopo %d fail (probabile ban)",
                                      book, MAX_FAILS)
        return written

    async def run(self):
        self._running = True
        self.logger.info("started (poll %ds)", POLL_INTERVAL)
        while self._running:
            try:
                await self.scrape_once()
            except Exception as e:
                self.logger.exception("ciclo crashato: %s", e)
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")
    asyncio.run(SportsbookScraperAgent().run())
