"""#LEDGER-SIGILLATA-1007 — gemello Python di lib/ledger-sealed-grading.ts.

Il registro sigillato del calcio (`pick_ledger`) e' immutabile. Fino a qui la
sua chiusura (`pick_settlement.result`) era l'esito della pick SERVITA al
momento del settlement: se la servita era cambiata dopo il sigillo, il registro
agganciava l'esito di un'altra pick (o chiudeva `void` una pick sigillata che
un esito ce l'aveva). Con il flag acceso, per le partite con kickoff da
LEDGER_SEALED_FROM in poi, l'esito nel registro e' quello della pick SIGILLATA.

Flag spento (default) = comportamento di main: ``ledger_settlement_result``
restituisce l'esito servito invariato e il chiamante non fa nessuna lettura in
piu'. Flag acceso con una data illeggibile = spento (fail-closed).

Le regole sono le stesse del lato TS e lo verificano i test di parita'
(tests/test_ledger_sealed_grading.py).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class SealedGradingConfig:
    enabled: bool
    from_dt: datetime | None


OFF = SealedGradingConfig(enabled=False, from_dt=None)


def _parse_iso(raw: str) -> datetime | None:
    s = raw.strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def sealed_grading_config(env: dict | None = None) -> SealedGradingConfig:
    e = os.environ if env is None else env
    if (e.get("LEDGER_SEALED_GRADING") or "").strip() != "1":
        return OFF
    dt = _parse_iso(e.get("LEDGER_SEALED_FROM") or "")
    if dt is None:
        return OFF
    return SealedGradingConfig(enabled=True, from_dt=dt)


def in_sealed_cohort(commence_time, cfg: SealedGradingConfig) -> bool:
    if not cfg.enabled or cfg.from_dt is None or commence_time is None:
        return False
    if isinstance(commence_time, datetime):
        dt = commence_time if commence_time.tzinfo else commence_time.replace(tzinfo=timezone.utc)
    else:
        dt = _parse_iso(str(commence_time))
    return dt is not None and dt >= cfg.from_dt


def realized_outcome(home_goals: int, away_goals: int) -> str:
    if home_goals == away_goals:
        return "DRAW"
    return "HOME" if home_goals > away_goals else "AWAY"


def grade_sealed_pick(pick: str | None, realized: str) -> str:
    p = (pick or "").strip().upper()
    if p not in ("HOME", "DRAW", "AWAY"):
        return "void"
    return "won" if p == realized else "lost"


def ledger_settlement_result(
    *,
    served_result: str,
    sealed_pick: str | None,
    commence_time,
    home_goals: int,
    away_goals: int,
    cfg: SealedGradingConfig,
) -> str:
    """Esito da scrivere in pick_settlement per una partita FINITA."""
    if not in_sealed_cohort(commence_time, cfg):
        return served_result
    if sealed_pick is None or str(sealed_pick).strip() == "":
        return served_result
    return grade_sealed_pick(sealed_pick, realized_outcome(home_goals, away_goals))
