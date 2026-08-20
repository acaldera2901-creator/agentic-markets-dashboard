"""Accesso al DB di produzione, in sola lettura e senza sorprese di schema."""

import os
from pathlib import Path

import psycopg2

REPO_ROOT = Path(__file__).resolve().parents[2]

_SQLALCHEMY_PREFIXES = (
    "postgresql+asyncpg://",
    "postgres+asyncpg://",
    "postgresql+psycopg2://",
    "postgresql+psycopg://",
)


class DbUnavailable(Exception):
    """Il DB non risponde. Diventa un verdict unknown, non un red."""


def normalize_db_url(raw: str | None) -> str:
    """Riporta l'URL alla forma che libpq capisce.

    Trappola #BRCC-0820: il .env del repo tiene DATABASE_URL in forma
    SQLAlchemy (postgresql+asyncpg://). psycopg2 non riconosce quello schema,
    non solleva un errore di schema, e cade sul socket unix locale: l'errore
    che vedi e' "connection to server on socket /tmp/.s.PGSQL.5432 failed",
    cioe' sembra che il database sia giu' quando invece e' l'URL a essere
    nella forma sbagliata.
    """
    if raw is None or not raw.strip():
        raise ValueError("DATABASE_URL assente")
    url = raw.strip().strip('"').strip("'")
    for prefix in _SQLALCHEMY_PREFIXES:
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix):]
    if not url.startswith(("postgresql://", "postgres://")):
        head = url.split("://", 1)[0]
        raise ValueError(f"schema non riconosciuto: {head!r}")
    return url


def load_env(path: str | None = None) -> dict[str, str]:
    """Legge un file .env in un dict. Nessuna dipendenza, nessuna espansione."""
    target = Path(path) if path else REPO_ROOT / ".env"
    out: dict[str, str] = {}
    if not target.exists():
        return out
    for line in target.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def _dsn() -> str:
    raw = os.environ.get("DATABASE_URL") or load_env().get("DATABASE_URL")
    return normalize_db_url(raw)


def fetch_all(sql: str, params: tuple = ()) -> list[tuple]:
    """Esegue una query in una transazione dichiarata di sola lettura.

    READ ONLY non e' decorativo: e' il vincolo che rende impossibile a questo
    strumento di osservazione di scrivere su produzione, anche per errore di
    chi aggiungera' un check fra sei mesi.
    """
    try:
        with psycopg2.connect(_dsn(), connect_timeout=8) as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                cur.execute(sql, params)
                return cur.fetchall()
    except psycopg2.Error as exc:
        raise DbUnavailable(str(exc).strip().splitlines()[0]) from exc
