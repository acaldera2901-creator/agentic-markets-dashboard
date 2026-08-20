"""Accesso al DB di produzione, in sola lettura e senza sorprese di schema."""

import os
import time
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


# Le credenziali non vivono tutte nello stesso posto, e copiarle qui sarebbe
# duplicarle: la dashboard legge le fonti dove sono, in ordine di priorita'
# crescente (l'ultima vince). Ogni voce dice perche' esiste.
FONTI_ENV = (
    REPO_ROOT / ".env",
    # I profili Instagram di BetRedge sono pubblicati da questo progetto:
    # IG_ACCESS_TOKEN_EN/IT e IG_USER_ID_EN/IT vivono qui.
    Path.home() / "Desktop/00-SISTEMA/accelerator/studio-instagram/.env",
    # TELEGRAM_CHAT_ID_FREE: l'id del canale pubblico, distinto dalla chat
    # personale di Andrea che sta in TELEGRAM_CHAT_ID.
    Path.home() / "Desktop/00-SISTEMA/accelerator/studio/.env",
    # Chiavi che non stanno in nessun repo: RESEND_API_KEY, che Vercel marca
    # sensitive e non restituisce (verificato: 28 valori su 106 nel pull).
    Path.home() / ".betredge-cc/credentials.env",
)


def load_all_env() -> dict[str, str]:
    """Unione delle fonti dichiarate. I valori vuoti non sovrascrivono i pieni."""
    unione: dict[str, str] = {}
    for fonte in FONTI_ENV:
        for chiave, valore in load_env(str(fonte)).items():
            if valore or chiave not in unione:
                unione[chiave] = valore
    return unione


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
                # Senza params NON si passa la tupla vuota: psycopg2 farebbe
                # comunque l'interpolazione e ogni % letterale nel SQL
                # (ilike '%x%') diventerebbe un segnaposto, con IndexError.
                if params:
                    cur.execute(sql, params)
                else:
                    cur.execute(sql)
                return cur.fetchall()
    except psycopg2.Error as exc:
        raise DbUnavailable(str(exc).strip().splitlines()[0]) from exc


def measure_latency() -> tuple[float, float]:
    """Ritorna (secondi di connessione, secondi di query) separati.

    Misurarli insieme non dice niente sulla salute del DB: verso il pooler in
    eu-west-1 l'handshake TLS costa ~650 ms stabili mentre la query costa ~65
    ms. Una soglia sulla somma segnala la distanza geografica, non un problema,
    e lampeggia per sempre a poche decine di ms dal confine.
    """
    inizio = time.monotonic()
    try:
        with psycopg2.connect(_dsn(), connect_timeout=8) as conn:
            connesso = time.monotonic()
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                cur.execute("select 1")
                cur.fetchall()
            return connesso - inizio, time.monotonic() - connesso
    except psycopg2.Error as exc:
        raise DbUnavailable(str(exc).strip().splitlines()[0]) from exc
