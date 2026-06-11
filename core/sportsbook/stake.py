"""Stake odds client (#SPORTSBOOK-SCRAPER-1) — PLACEHOLDER.

stake.it = operatore ADM (piattaforma Octavian Lab). Il feed odds è login-gated
(serve sessione autenticata KYC) e non ancora decifrato → vedi spike findings
2026-06-11-sportsbook-scraper-spike-findings.md. Quando il feed sarà catturato,
questo client implementerà fetch_events() come roobet.py, ritornando OddsEvent.
Finché allora ritorna [] (l'agente lo salta senza errori).
"""
import logging

from core.sportsbook.common import OddsEvent  # noqa: F401  (usato dall'impl futura)

logger = logging.getLogger("StakeClient")
_warned = False


async def fetch_events() -> list:
    global _warned
    if not _warned:
        logger.info("stake: feed non ancora implementato (login-gated, stake.it/ADM) — skip")
        _warned = True
    return []
