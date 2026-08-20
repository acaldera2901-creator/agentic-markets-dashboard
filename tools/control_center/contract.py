"""Il contratto fra il collector e i check.

Un check e' un dato, non una funzione speciale: questo tiene il collector
piccolo e rende ogni fase successiva additiva (spec #BRCC-0820, sezione 4).
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

LEVELS = ("green", "amber", "red", "unknown")


def now_iso(now: datetime | None = None) -> str:
    """Istante in UTC, formato Z. Iniettabile per rendere i test deterministici."""
    moment = now or datetime.now(timezone.utc)
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class Verdict:
    level: str
    headline: str
    source: str
    measured_at: str
    value: object | None = None
    evidence: dict | None = None

    def __post_init__(self) -> None:
        # La validazione sta nel costruttore per un motivo: un Verdict senza
        # fonte o senza istante non deve essere rappresentabile. Se fosse un
        # controllo a valle, qualcuno prima o poi lo salterebbe.
        if self.level not in LEVELS:
            raise ValueError(f"livello non ammesso: {self.level!r}")
        if not self.headline:
            raise ValueError("headline obbligatoria")
        if not self.source:
            raise ValueError("source obbligatoria: ogni numero deve essere tracciabile")
        if not self.measured_at:
            raise ValueError("measured_at obbligatoria: ogni numero deve avere un'eta'")

    def to_dict(self) -> dict:
        return {
            "level": self.level,
            "headline": self.headline,
            "source": self.source,
            "measured_at": self.measured_at,
            "value": self.value,
            "evidence": self.evidence,
        }


def verdict_from_dict(d: dict) -> Verdict:
    return Verdict(
        level=d["level"],
        headline=d["headline"],
        source=d["source"],
        measured_at=d["measured_at"],
        value=d.get("value"),
        evidence=d.get("evidence"),
    )


@dataclass
class Check:
    id: str
    group: str
    label: str
    fn: Callable[[], Verdict]
    ttl_seconds: int = 0
    timeout_seconds: float = 10.0


def _mk(level: str, headline: str, source: str, value, evidence, now) -> Verdict:
    return Verdict(
        level=level,
        headline=headline,
        source=source,
        measured_at=now_iso(now),
        value=value,
        evidence=evidence,
    )


def green(headline, source, *, value=None, evidence=None, now=None) -> Verdict:
    return _mk("green", headline, source, value, evidence, now)


def amber(headline, source, *, value=None, evidence=None, now=None) -> Verdict:
    return _mk("amber", headline, source, value, evidence, now)


def red(headline, source, *, value=None, evidence=None, now=None) -> Verdict:
    return _mk("red", headline, source, value, evidence, now)


def unknown(reason, source, *, evidence=None, now=None) -> Verdict:
    """Non misurato, col motivo. Distinto da red: red significa 'ho misurato ed e' rotto'."""
    return _mk("unknown", reason, source, None, evidence, now)
