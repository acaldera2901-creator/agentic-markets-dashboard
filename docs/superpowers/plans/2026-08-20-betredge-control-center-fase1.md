# BetRedge Control Center — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una torre di controllo locale che ogni 5 minuti misura piattaforma e daemon di BetRedge, scrive uno snapshot su disco, lo serve su `127.0.0.1:8790` e notifica quando un check passa a rosso.

**Architecture:** Due processi e un file di stato. `collector.py` (launchd, ogni 5 min) esegue check isolati, ognuno dei quali restituisce un `Verdict`, scrive `state.json` in modo atomico e appende una riga a `history.jsonl`, poi confronta con lo stato precedente e notifica solo le transizioni. `server.py` (launchd, KeepAlive) serve la pagina e legge **solo** lo snapshot: non interroga mai le fonti.

**Tech Stack:** Python 3.14 dal `venv` del repo · `psycopg2` (già installato — nessuna dipendenza nuova) · `requests` (già installato) · `http.server` dalla stdlib · pytest 9 con `pytest-mock` · launchd.

**Spec:** `docs/superpowers/specs/2026-08-20-betredge-control-center-design.md` (#BRCC-0820, approvata)

## Global Constraints

Questi vincoli valgono per **ogni** task, anche quando il task non li ripete.

- **Sola lettura sul DB.** Ogni connessione si apre con `SET TRANSACTION READ ONLY`. Nessuna INSERT, UPDATE, DELETE, DDL. Mai.
- **Solo loopback.** Il server fa `bind` esclusivamente su `127.0.0.1`. Mai `0.0.0.0`, mai un tunnel.
- **Nessun segreto in output.** Token, password e URL con credenziali non finiscono in `state.json`, `history.jsonl`, nella pagina o nei log. In `evidence` si scrive il nome della variabile mancante, non il suo valore.
- **`measured_at` e `source` sono obbligatori** su ogni `Verdict`, imposti dal costruttore: un `Verdict` senza fonte o senza istante non si può costruire.
- **`unknown` non è `red`.** Fonte non disponibile, credenziale mancante, tabella vuota, timeout → `unknown` con il motivo. Mai uno zero al posto di un dato non misurato.
- **Si giudica l'artefatto, non l'invocazione.** Un cron è verde se ha prodotto la sua scrittura, non se ha risposto 200.
- **Le rotte dietro feature flag non si sorvegliano.** `/risultati` e `/oggi` fanno `notFound()` quando `NEXT_PUBLIC_UX_NEW != "1"`: sono escluse dal check di disponibilità, non aggiungerle.
- **Python:** usare sempre `venv/bin/python` e `venv/bin/python -m pytest`. `psycopg2`, non `psycopg`. **Gli script del venv hanno lo shebang rotto** (punta a `~/Desktop/sistema-andrea/agentic-markets/venv`, percorso di prima di uno spostamento): usare sempre `venv/bin/python -m pytest`, mai `venv/bin/pytest`.
- **Interprete e paths:** il codice vive in `tools/control_center/` (versionato); lo stato runtime in `~/.betredge-cc/`. Deviazione deliberata dalla spec, che collocava anche il codice nella home: codice fuori da git non è versionato né testabile.
- **Lingua:** commenti e stringhe utente in italiano, identificatori in inglese, come il resto del repo.

## File Structure

    tools/__init__.py                        (vuoto, rende importabile il package)
    tools/control_center/__init__.py         (vuoto)
    tools/control_center/contract.py         Verdict, Check, livelli, helper di costruzione
    tools/control_center/db.py               normalizzazione DATABASE_URL, connessione read-only
    tools/control_center/runner.py           esecuzione isolata dei check, timeout, TTL
    tools/control_center/snapshot.py         scrittura atomica di state.json, append su history.jsonl
    tools/control_center/alerting.py         diff dei livelli, isteresi, dedup — funzione pura
    tools/control_center/notify.py           consegna: notifica macOS + Telegram
    tools/control_center/collector.py        entrypoint del collector
    tools/control_center/server.py           HTTP su 127.0.0.1:8790
    tools/control_center/checks/__init__.py  REGISTRY: la lista dei check attivi
    tools/control_center/checks/platform.py  web_pages, api_version, db_latency, errors_24h
    tools/control_center/checks/daemons.py   launchd_* e cron_* (giudizio sull'artefatto)
    tools/control_center/static/index.html   la pagina

    tests/test_cc_contract.py
    tests/test_cc_db.py
    tests/test_cc_runner.py
    tests/test_cc_snapshot.py
    tests/test_cc_alerting.py
    tests/test_cc_checks_platform.py
    tests/test_cc_checks_daemons.py
    tests/test_cc_server.py

    ops/launchd/com.betredge.control-center.collector.plist
    ops/launchd/com.betredge.control-center.server.plist

Ogni modulo ha una responsabilità sola e nessuno importa il collector: le
dipendenze puntano verso il basso. `alerting.py` e `contract.py` sono funzioni
pure, quindi testabili senza rete, senza DB e senza orologio reale.

---

### Task 1: Il contratto — Verdict e Check

**Files:**
- Create: `tools/__init__.py`, `tools/control_center/__init__.py`
- Create: `tools/control_center/contract.py`
- Test: `tests/test_cc_contract.py`

**Interfaces:**
- Consumes: nulla.
- Produces:
  - `LEVELS: tuple[str, ...]` = `("green", "amber", "red", "unknown")`
  - `class Verdict` — dataclass congelata con campi `level: str`, `headline: str`, `source: str`, `measured_at: str`, `value: object | None = None`, `evidence: dict | None = None`; metodo `to_dict() -> dict`
  - `class Check` — dataclass con `id: str`, `group: str`, `label: str`, `fn: Callable[[], Verdict]`, `ttl_seconds: int = 0`, `timeout_seconds: float = 10.0`
  - `def now_iso(now: datetime | None = None) -> str`
  - `def green(headline, source, *, value=None, evidence=None, now=None) -> Verdict`
  - `def amber(...) -> Verdict`, `def red(...) -> Verdict` — stessa firma di `green`
  - `def unknown(reason, source, *, evidence=None, now=None) -> Verdict`
  - `def verdict_from_dict(d: dict) -> Verdict`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_contract.py`:

```python
from datetime import datetime, timezone

import pytest

from tools.control_center.contract import (
    Check,
    Verdict,
    amber,
    green,
    red,
    unknown,
    verdict_from_dict,
)

FIXED = datetime(2026, 8, 20, 17, 45, 0, tzinfo=timezone.utc)


def test_verdict_richiede_source():
    with pytest.raises(ValueError, match="source"):
        Verdict(level="green", headline="ok", source="", measured_at="2026-08-20T17:45:00Z")


def test_verdict_richiede_measured_at():
    with pytest.raises(ValueError, match="measured_at"):
        Verdict(level="green", headline="ok", source="db:x", measured_at="")


def test_verdict_rifiuta_livello_inventato():
    with pytest.raises(ValueError, match="livello"):
        Verdict(level="giallino", headline="ok", source="db:x", measured_at="2026-08-20T17:45:00Z")


def test_helper_impostano_il_livello_e_l_istante():
    v = green("ultimo run 2 min fa", "db:pick_settlement", value=42, now=FIXED)
    assert v.level == "green"
    assert v.value == 42
    assert v.measured_at == "2026-08-20T17:45:00Z"
    assert amber("x", "s", now=FIXED).level == "amber"
    assert red("x", "s", now=FIXED).level == "red"


def test_unknown_porta_il_motivo_e_nessun_valore():
    v = unknown("credenziale mancante: IG_TOKEN", "ig graph api", now=FIXED)
    assert v.level == "unknown"
    assert v.value is None
    assert "IG_TOKEN" in v.headline


def test_roundtrip_dict():
    v = red("settle fermo da 12h", "db:pick_settlement", value="12h04m", evidence={"age_s": 43440}, now=FIXED)
    assert verdict_from_dict(v.to_dict()) == v


def test_check_ha_timeout_di_default():
    c = Check(id="x", group="piattaforma", label="X", fn=lambda: green("ok", "s"))
    assert c.timeout_seconds == 10.0
    assert c.ttl_seconds == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/agentic-markets && venv/bin/python -m pytest tests/test_cc_contract.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/__init__.py` and `tools/control_center/__init__.py`, both empty.

Create `tools/control_center/contract.py`:

```python
"""Il contratto fra il collector e i check.

Un check e' un dato, non una funzione speciale: questo tiene il collector
piccolo e rende ogni fase successiva additiva (spec #BRCC-0820, sezione 4).
"""

from dataclasses import dataclass, field
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_contract.py -v`
Expected: PASS, 7 test

- [ ] **Step 5: Commit**

```bash
git add tools/__init__.py tools/control_center/__init__.py tools/control_center/contract.py tests/test_cc_contract.py
git commit -m "feat(cc): contratto Verdict/Check con measured_at e source obbligatori (#BRCC-0820)"
```

---

### Task 2: DATABASE_URL normalizzato e connessione in sola lettura

**Files:**
- Create: `tools/control_center/db.py`
- Test: `tests/test_cc_db.py`

**Interfaces:**
- Consumes: nulla da task precedenti.
- Produces:
  - `def normalize_db_url(raw: str | None) -> str`
  - `def load_env(path: str | None = None) -> dict[str, str]` — legge il `.env` del repo senza dipendenze
  - `def fetch_all(sql: str, params: tuple = ()) -> list[tuple]` — apre, esegue in sola lettura, chiude
  - `class DbUnavailable(Exception)`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_db.py`:

```python
import pytest

from tools.control_center.db import load_env, normalize_db_url


def test_converte_la_forma_sqlalchemy():
    # La trappola misurata il 2026-08-20: psql e psycopg2 ignorano questo
    # schema in silenzio e cadono sul socket locale, dando un errore che
    # sembra "database giu'".
    raw = "postgresql+asyncpg://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
    assert normalize_db_url(raw) == "postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"


def test_lascia_intatto_un_url_gia_valido():
    raw = "postgresql://u:p@host:5432/postgres"
    assert normalize_db_url(raw) == raw


def test_toglie_le_virgolette_dal_valore_env():
    assert normalize_db_url('"postgresql://u:p@h:5432/d"') == "postgresql://u:p@h:5432/d"


def test_url_assente_e_un_errore_non_un_default():
    with pytest.raises(ValueError, match="assente"):
        normalize_db_url("")
    with pytest.raises(ValueError, match="assente"):
        normalize_db_url(None)


def test_schema_sconosciuto_non_passa_in_silenzio():
    with pytest.raises(ValueError, match="schema"):
        normalize_db_url("mysql://u:p@h/d")


def test_load_env_legge_le_coppie_e_salta_i_commenti(tmp_path):
    f = tmp_path / ".env"
    f.write_text('# commento\nDATABASE_URL="postgresql://a"\nVUOTO=\nTELEGRAM_BOT_TOKEN=abc\n\n')
    env = load_env(str(f))
    assert env["DATABASE_URL"] == "postgresql://a"
    assert env["TELEGRAM_BOT_TOKEN"] == "abc"
    assert env["VUOTO"] == ""
    assert "# commento" not in env
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_db.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools.control_center.db'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/control_center/db.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_db.py -v`
Expected: PASS, 6 test

- [ ] **Step 5: Verifica manuale contro il DB vero**

Run:
```bash
venv/bin/python -c "
from tools.control_center.db import fetch_all
print(fetch_all('select count(*) from agent_heartbeats')[0][0])
"
```
Expected: un intero. Se compare `DbUnavailable` con "socket", la normalizzazione non ha funzionato: fermarsi e correggere prima di proseguire.

- [ ] **Step 6: Verifica che READ ONLY morda davvero**

Run:
```bash
venv/bin/python -c "
from tools.control_center.db import fetch_all, DbUnavailable
try:
    fetch_all('create table cc_probe_delete_me (x int)')
    print('ERRORE: la scrittura e passata')
except DbUnavailable as e:
    print('ok, scrittura respinta:', e)
"
```
Expected: `ok, scrittura respinta: cannot execute CREATE TABLE in a read-only transaction`. Se stampa "la scrittura e passata", il vincolo non è attivo: fermarsi.

- [ ] **Step 7: Commit**

```bash
git add tools/control_center/db.py tests/test_cc_db.py
git commit -m "feat(cc): DATABASE_URL normalizzato e query in sola lettura (#BRCC-0820)"
```

---

### Task 3: Il runner — isolamento, timeout, TTL

**Files:**
- Create: `tools/control_center/runner.py`
- Test: `tests/test_cc_runner.py`

**Interfaces:**
- Consumes: `Check`, `Verdict`, `unknown`, `verdict_from_dict` da `contract`.
- Produces:
  - `def run_checks(checks: list[Check], previous: dict | None = None, now: datetime | None = None) -> dict[str, Verdict]`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_runner.py`:

```python
from datetime import datetime, timedelta, timezone

from tools.control_center.contract import Check, green
from tools.control_center.runner import run_checks

FIXED = datetime(2026, 8, 20, 17, 45, 0, tzinfo=timezone.utc)


def _chk(cid, fn, **kw):
    return Check(id=cid, group="g", label=cid, fn=fn, **kw)


def test_un_check_che_esplode_non_affonda_gli_altri():
    def boom():
        raise RuntimeError("provider giu'")

    out = run_checks(
        [_chk("rotto", boom), _chk("sano", lambda: green("ok", "s", now=FIXED))],
        now=FIXED,
    )
    assert out["rotto"].level == "unknown"
    assert "provider giu'" in out["rotto"].headline
    assert "traceback" in out["rotto"].evidence
    assert out["sano"].level == "green"


def test_un_check_lento_diventa_unknown_non_blocca_lo_snapshot():
    import time

    out = run_checks([_chk("lento", lambda: time.sleep(5), timeout_seconds=0.2)], now=FIXED)
    assert out["lento"].level == "unknown"
    assert "timeout" in out["lento"].headline.lower()


def test_un_check_che_non_restituisce_un_verdict_e_unknown():
    out = run_checks([_chk("bugiardo", lambda: {"level": "green"})], now=FIXED)
    assert out["bugiardo"].level == "unknown"
    assert "Verdict" in out["bugiardo"].headline


def test_il_ttl_riusa_la_misura_precedente_senza_richiamare_la_fonte():
    chiamate = []

    def costoso():
        chiamate.append(1)
        return green("fresco", "api", now=FIXED)

    previous = {
        "caro": green("vecchio ma valido", "api", now=FIXED - timedelta(minutes=10)).to_dict()
    }
    out = run_checks([_chk("caro", costoso, ttl_seconds=3600)], previous=previous, now=FIXED)
    assert chiamate == []
    assert out["caro"].headline == "vecchio ma valido"


def test_il_ttl_scaduto_richiama_la_fonte():
    previous = {
        "caro": green("scaduto", "api", now=FIXED - timedelta(hours=3)).to_dict()
    }
    out = run_checks(
        [_chk("caro", lambda: green("fresco", "api", now=FIXED), ttl_seconds=3600)],
        previous=previous,
        now=FIXED,
    )
    assert out["caro"].headline == "fresco"


def test_un_check_appeso_non_ritarda_lo_snapshot():
    # Il timeout del singolo check non serve a niente se poi lo spegnimento
    # del pool attende comunque il thread lento: lo snapshot arriverebbe in
    # ritardo esattamente quando qualcosa e' rotto.
    import time as _t

    inizio = _t.monotonic()
    out = run_checks([_chk("appeso", lambda: _t.sleep(8), timeout_seconds=0.2)], now=FIXED)
    trascorso = _t.monotonic() - inizio
    assert out["appeso"].level == "unknown"
    assert trascorso < 2.0, f"run_checks ha atteso {trascorso:.1f}s"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_runner.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools.control_center.runner'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/control_center/runner.py`:

```python
"""Esecuzione dei check: isolata, con timeout, e con riuso a TTL."""

import traceback
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from datetime import datetime, timezone

from .contract import Check, Verdict, unknown, verdict_from_dict


def _age_seconds(verdict_dict: dict, now: datetime) -> float:
    stamp = verdict_dict.get("measured_at")
    if not stamp:
        return float("inf")
    try:
        measured = datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return float("inf")
    return (now - measured).total_seconds()


def run_checks(
    checks: list[Check],
    previous: dict | None = None,
    now: datetime | None = None,
) -> dict[str, Verdict]:
    """Esegue i check e restituisce un verdict per ognuno, sempre.

    Nessun check puo' impedire allo snapshot di uscire: un'eccezione o un
    timeout diventano unknown col motivo. Una dashboard che va in bianco
    perche' un provider e' giu' e' peggio di non averla.
    """
    moment = now or datetime.now(timezone.utc)
    prev = previous or {}
    out: dict[str, Verdict] = {}
    pending: dict = {}

    pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="cc")
    try:
        for chk in checks:
            cached = prev.get(chk.id)
            if chk.ttl_seconds and cached and _age_seconds(cached, moment) < chk.ttl_seconds:
                # Riuso: un check giornaliero non deve consumare 288 chiamate.
                out[chk.id] = verdict_from_dict(cached)
                continue
            pending[chk.id] = (pool.submit(chk.fn), chk)

        for check_id, (future, chk) in pending.items():
            try:
                result = future.result(timeout=chk.timeout_seconds)
            except FutureTimeout:
                # Il thread resta appeso fino a che la sua I/O non scade, ma
                # non trattiene lo snapshot: lo shutdown qui sotto e' senza
                # attesa. Accettato: i check fanno HTTP e DB con timeout
                # propri. Se un giorno un check bloccasse per sempre,
                # servirebbe un processo separato, non un thread.
                out[check_id] = unknown(
                    f"timeout dopo {chk.timeout_seconds:g}s", f"check:{check_id}", now=moment
                )
                continue
            except Exception as exc:  # noqa: BLE001 - qualsiasi errore diventa unknown
                out[check_id] = unknown(
                    str(exc) or exc.__class__.__name__,
                    f"check:{check_id}",
                    evidence={"traceback": traceback.format_exc(limit=4)},
                    now=moment,
                )
                continue
            if not isinstance(result, Verdict):
                out[check_id] = unknown(
                    f"il check non ha restituito un Verdict ma {type(result).__name__}",
                    f"check:{check_id}",
                    now=moment,
                )
                continue
            out[check_id] = result
    finally:
        # wait=False e' il punto: un check appeso non deve ritardare la
        # scrittura dello snapshot. Senza questo, il context manager
        # attenderebbe il thread lento e vanificherebbe il timeout.
        pool.shutdown(wait=False, cancel_futures=True)

    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_runner.py -v`
Expected: PASS, 6 test

- [ ] **Step 5: Commit**

```bash
git add tools/control_center/runner.py tests/test_cc_runner.py
git commit -m "feat(cc): runner con isolamento, timeout e riuso a TTL (#BRCC-0820)"
```

---

### Task 4: Snapshot atomico e storico

**Files:**
- Create: `tools/control_center/snapshot.py`
- Test: `tests/test_cc_snapshot.py`

**Interfaces:**
- Consumes: `Verdict` da `contract`.
- Produces:
  - `STATE_DIR: Path` (`~/.betredge-cc`), `STATE_FILE: Path`, `HISTORY_FILE: Path`
  - `def read_state(path: Path | None = None) -> dict`
  - `def write_state(state: dict, path: Path | None = None) -> None`
  - `def append_history(verdicts: dict[str, Verdict], generated_at: str, path: Path | None = None) -> None`
  - `def build_state(verdicts: dict[str, Verdict], groups: dict[str, str], alert_state: dict, generated_at: str) -> dict`
  - `def verdict_summary(verdicts: dict[str, Verdict]) -> dict` — conteggi per livello e la frase del verdetto

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_snapshot.py`:

```python
import json
from datetime import datetime, timezone

from tools.control_center.contract import amber, green, red, unknown
from tools.control_center.snapshot import (
    append_history,
    build_state,
    read_state,
    verdict_summary,
    write_state,
)

FIXED = datetime(2026, 8, 20, 17, 45, 0, tzinfo=timezone.utc)


def test_read_state_su_file_assente_e_un_dict_vuoto(tmp_path):
    assert read_state(tmp_path / "manca.json") == {}


def test_read_state_su_file_corrotto_non_solleva(tmp_path):
    p = tmp_path / "state.json"
    p.write_text("{ meta json")
    assert read_state(p) == {}


def test_write_state_non_lascia_mai_un_file_a_meta(tmp_path):
    p = tmp_path / "state.json"
    write_state({"a": 1}, p)
    assert json.loads(p.read_text()) == {"a": 1}
    # nessun file temporaneo residuo accanto al bersaglio
    assert [f.name for f in tmp_path.iterdir()] == ["state.json"]


def test_write_state_sovrascrive_senza_perdere_il_precedente_in_caso_di_errore(tmp_path):
    p = tmp_path / "state.json"
    write_state({"gen": 1}, p)
    write_state({"gen": 2}, p)
    assert read_state(p)["gen"] == 2


def test_history_appende_una_riga_per_run(tmp_path):
    h = tmp_path / "history.jsonl"
    append_history({"a": green("ok", "s", value=3, now=FIXED)}, "2026-08-20T17:45:00Z", h)
    append_history({"a": red("ko", "s", value=9, now=FIXED)}, "2026-08-20T17:50:00Z", h)
    righe = [json.loads(r) for r in h.read_text().splitlines()]
    assert len(righe) == 2
    assert righe[0]["checks"]["a"] == {"level": "green", "value": 3}
    assert righe[1]["checks"]["a"]["level"] == "red"


def test_summary_conta_i_livelli_e_scrive_la_frase():
    verdicts = {
        "cron_settle": red("settle fermo da 12h", "db", now=FIXED),
        "launchd_sm": red("exit 126", "launchctl", now=FIXED),
        "quota": amber("51%", "db", now=FIXED),
        "ig": unknown("token mancante", "ig", now=FIXED),
        "home": green("200", "http", now=FIXED),
    }
    s = verdict_summary(verdicts)
    assert s["counts"] == {"green": 1, "amber": 1, "red": 2, "unknown": 1}
    assert s["level"] == "red"
    assert s["headline"].startswith("2 rossi")
    assert "settle fermo da 12h" in s["detail"]


def test_summary_tutto_verde_dice_tutto_a_posto():
    s = verdict_summary({"a": green("200", "http", now=FIXED)})
    assert s["level"] == "green"
    assert s["counts"]["red"] == 0
    assert "tutto" in s["headline"].lower()


def test_build_state_espone_i_gruppi_e_il_riassunto():
    verdicts = {"home": green("200", "http", now=FIXED)}
    st = build_state(verdicts, {"home": "piattaforma"}, {}, "2026-08-20T17:45:00Z")
    assert st["generated_at"] == "2026-08-20T17:45:00Z"
    assert st["checks"]["home"]["group"] == "piattaforma"
    assert st["summary"]["level"] == "green"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_snapshot.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools.control_center.snapshot'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/control_center/snapshot.py`:

```python
"""Lo stato su disco: uno snapshot corrente e uno storico append-only."""

import json
import os
import tempfile
from pathlib import Path

from .contract import Verdict

STATE_DIR = Path.home() / ".betredge-cc"
STATE_FILE = STATE_DIR / "state.json"
HISTORY_FILE = STATE_DIR / "history.jsonl"

_ORDER = {"red": 0, "amber": 1, "unknown": 2, "green": 3}


def read_state(path: Path | None = None) -> dict:
    """Lo stato precedente, o un dict vuoto. Non solleva mai.

    Un collector che muore perche' lo snapshot precedente e' illeggibile non
    riesce nemmeno a riscriverlo: il fallimento diventa permanente.
    """
    target = Path(path) if path else STATE_FILE
    try:
        return json.loads(target.read_text())
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def write_state(state: dict, path: Path | None = None) -> None:
    """Scrive su temporaneo e rinomina: il server non legge mai un file a meta'."""
    target = Path(path) if path else STATE_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(target.parent), prefix=".state-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(state, fh, indent=1, ensure_ascii=False, default=str)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, target)  # atomico sullo stesso filesystem
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def append_history(
    verdicts: dict[str, Verdict], generated_at: str, path: Path | None = None
) -> None:
    """Una riga per run, coi soli campi che servono agli sparkline.

    Lo storico resta piccolo apposta: serve a rispondere "da quando e' rotto",
    non a essere un secondo database.
    """
    target = Path(path) if path else HISTORY_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "at": generated_at,
        "checks": {cid: {"level": v.level, "value": v.value} for cid, v in verdicts.items()},
    }
    with target.open("a") as fh:
        fh.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")


def verdict_summary(verdicts: dict[str, Verdict]) -> dict:
    """Il contenuto della barra del verdetto: un livello e una frase sola."""
    counts = {level: 0 for level in ("green", "amber", "red", "unknown")}
    for verdict in verdicts.values():
        counts[verdict.level] += 1

    if counts["red"]:
        level = "red"
    elif counts["amber"]:
        level = "amber"
    elif counts["unknown"] and not counts["green"]:
        level = "unknown"
    else:
        level = "green"

    pezzi = []
    if counts["red"]:
        pezzi.append(f"{counts['red']} {'rosso' if counts['red'] == 1 else 'rossi'}")
    if counts["amber"]:
        pezzi.append(f"{counts['amber']} ambra")
    if counts["unknown"]:
        pezzi.append(f"{counts['unknown']} non misurati")
    headline = ", ".join(pezzi) if pezzi else "tutto a posto"

    gravi = sorted(
        (v for v in verdicts.values() if v.level in ("red", "amber")),
        key=lambda v: _ORDER[v.level],
    )
    detail = " · ".join(v.headline for v in gravi[:3])

    return {"level": level, "counts": counts, "headline": headline, "detail": detail}


def build_state(
    verdicts: dict[str, Verdict],
    groups: dict[str, str],
    alert_state: dict,
    generated_at: str,
) -> dict:
    return {
        "generated_at": generated_at,
        "summary": verdict_summary(verdicts),
        "checks": {
            cid: {**v.to_dict(), "group": groups.get(cid, "altro")}
            for cid, v in verdicts.items()
        },
        "alerts": alert_state,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_snapshot.py -v`
Expected: PASS, 8 test

- [ ] **Step 5: Commit**

```bash
git add tools/control_center/snapshot.py tests/test_cc_snapshot.py
git commit -m "feat(cc): snapshot atomico, storico append-only e barra del verdetto (#BRCC-0820)"
```

---

### Task 5: Allerta con isteresi — funzione pura

**Files:**
- Create: `tools/control_center/alerting.py`
- Test: `tests/test_cc_alerting.py`

**Interfaces:**
- Consumes: `Verdict` da `contract`.
- Produces:
  - `CONFIRM_RUNS: int = 2`, `REPEAT_AFTER_SECONDS: int = 21600`
  - `def decide_alerts(prev: dict, verdicts: dict[str, Verdict], now: datetime) -> tuple[list[dict], dict]`
    - ritorna `(notifiche, nuovo_stato)`; ogni notifica è `{"check_id", "kind", "title", "body"}` con `kind ∈ {"down", "up"}`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_alerting.py`:

```python
from datetime import datetime, timedelta, timezone

from tools.control_center.contract import amber, green, red, unknown
from tools.control_center.alerting import decide_alerts

T0 = datetime(2026, 8, 20, 17, 0, 0, tzinfo=timezone.utc)


def test_un_solo_run_rosso_non_notifica_ancora():
    notifiche, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    assert notifiche == []
    assert stato["c"]["red_runs"] == 1


def test_il_secondo_run_rosso_notifica():
    _, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    t1 = T0 + timedelta(minutes=5)
    notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t1)}, t1)
    assert len(notifiche) == 1
    assert notifiche[0]["kind"] == "down"
    assert notifiche[0]["check_id"] == "c"
    assert "giu'" in notifiche[0]["body"]
    assert stato["c"]["notified_at"] is not None


def test_un_rosso_lampeggiante_non_notifica():
    # rosso, poi verde, poi rosso: la conferma su due run consecutivi
    # e' esattamente cio' che uccide il falso positivo da timeout singolo.
    _, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    t1 = T0 + timedelta(minutes=5)
    _, stato = decide_alerts(stato, {"c": green("ok", "s", now=t1)}, t1)
    t2 = T0 + timedelta(minutes=10)
    notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t2)}, t2)
    assert notifiche == []
    assert stato["c"]["red_runs"] == 1


def test_ambra_e_unknown_non_notificano_mai():
    stato = {}
    for _ in range(5):
        notifiche, stato = decide_alerts(
            stato,
            {"a": amber("51%", "s", now=T0), "u": unknown("token mancante", "s", now=T0)},
            T0,
        )
        assert notifiche == []


def test_il_rientro_notifica_una_volta():
    _, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    t1 = T0 + timedelta(minutes=5)
    _, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t1)}, t1)
    t2 = T0 + timedelta(minutes=10)
    notifiche, stato = decide_alerts(stato, {"c": green("ok", "s", now=t2)}, t2)
    assert [n["kind"] for n in notifiche] == ["up"]
    t3 = T0 + timedelta(minutes=15)
    notifiche, stato = decide_alerts(stato, {"c": green("ok", "s", now=t3)}, t3)
    assert notifiche == []


def test_un_rosso_persistente_tace_per_sei_ore():
    stato = {}
    t = T0
    for _ in range(2):
        notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t)}, t)
        t += timedelta(minutes=5)
    assert len(notifiche) == 1
    # cinque ore di rossi: silenzio
    for _ in range(12):
        t += timedelta(minutes=25)
        notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t)}, t)
        assert notifiche == []
    # oltre le sei ore: ripete
    t += timedelta(hours=2)
    notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t)}, t)
    assert len(notifiche) == 1


def test_un_check_scomparso_non_resta_nello_stato():
    _, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    _, stato = decide_alerts(stato, {"altro": green("ok", "s", now=T0)}, T0)
    assert "c" not in stato
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_alerting.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools.control_center.alerting'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/control_center/alerting.py`:

```python
"""Chi merita una notifica. Funzione pura: nessuna rete, nessun orologio interno."""

from datetime import datetime, timezone

from .contract import Verdict

CONFIRM_RUNS = 2
REPEAT_AFTER_SECONDS = 6 * 3600


def _parse(stamp: str | None) -> datetime | None:
    if not stamp:
        return None
    try:
        return datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def decide_alerts(
    prev: dict, verdicts: dict[str, Verdict], now: datetime
) -> tuple[list[dict], dict]:
    """Decide le notifiche confrontando i livelli col run precedente.

    Le regole, dalla spec sezione 7:
      - verso rosso: notifica solo dopo CONFIRM_RUNS run consecutivi;
      - da rosso notificato a non-rosso: una notifica di rientro;
      - ambra e unknown: mai notificati, vivono sulla pagina;
      - un rosso gia' notificato tace per REPEAT_AFTER_SECONDS.

    Lo stato ritornato va salvato nello snapshot: e' cio' che fa sopravvivere
    l'isteresi a un riavvio, evitando la raffica di allarmi gia' noti al primo
    run dopo un reboot.
    """
    notifiche: list[dict] = []
    nuovo: dict = {}

    for check_id, verdict in verdicts.items():
        before = prev.get(check_id, {})
        red_runs = int(before.get("red_runs", 0))
        notified_at = before.get("notified_at")

        if verdict.level == "red":
            red_runs += 1
            last = _parse(notified_at)
            scaduto = last is None or (now - last).total_seconds() >= REPEAT_AFTER_SECONDS
            if red_runs >= CONFIRM_RUNS and scaduto:
                notifiche.append(
                    {
                        "check_id": check_id,
                        "kind": "down",
                        "title": f"BetRedge · {check_id} è rosso",
                        "body": verdict.headline,
                    }
                )
                notified_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            if notified_at:
                notifiche.append(
                    {
                        "check_id": check_id,
                        "kind": "up",
                        "title": f"BetRedge · {check_id} è rientrato",
                        "body": verdict.headline,
                    }
                )
            red_runs = 0
            notified_at = None

        nuovo[check_id] = {
            "level": verdict.level,
            "red_runs": red_runs,
            "notified_at": notified_at,
        }

    # I check scomparsi non restano nello stato: altrimenti un check rinominato
    # trascinerebbe per sempre il suo vecchio rosso.
    return notifiche, nuovo
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_alerting.py -v`
Expected: PASS, 7 test

- [ ] **Step 5: Commit**

```bash
git add tools/control_center/alerting.py tests/test_cc_alerting.py
git commit -m "feat(cc): allerta con isteresi a due run, rientro e silenzio di 6h (#BRCC-0820)"
```

---

### Task 6: Check piattaforma

**Files:**
- Create: `tools/control_center/checks/__init__.py`
- Create: `tools/control_center/checks/platform.py`
- Test: `tests/test_cc_checks_platform.py`

**Interfaces:**
- Consumes: `Check`, `green/amber/red/unknown` da `contract`; `fetch_all`, `DbUnavailable` da `db`.
- Produces:
  - `WATCHED_PAGES: tuple[str, ...]` = `("/", "/predictions", "/plans", "/weekly-pick")`
  - `FLAG_GATED_PAGES: dict[str, str]` — documenta le rotte escluse e il flag che le governa
  - `def check_web_pages() -> Verdict`
  - `def check_api_version() -> Verdict`
  - `def check_db_latency() -> Verdict`
  - `def check_errors_24h() -> Verdict`
  - `def checks() -> list[Check]`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_checks_platform.py`:

```python
import pytest

from tools.control_center.checks import platform
from tools.control_center.db import DbUnavailable


class FakeResp:
    def __init__(self, code):
        self.status_code = code


def test_tutte_le_pagine_ok_e_verde(mocker):
    mocker.patch.object(platform.requests, "get", return_value=FakeResp(200))
    v = platform.check_web_pages()
    assert v.level == "green"
    assert v.source.startswith("http")


def test_una_pagina_rotta_e_rossa_e_dice_quale(mocker):
    def fake_get(url, **kw):
        return FakeResp(500 if url.endswith("/plans") else 200)

    mocker.patch.object(platform.requests, "get", side_effect=fake_get)
    v = platform.check_web_pages()
    assert v.level == "red"
    assert "/plans" in v.headline
    assert v.evidence["/plans"] == 500


def test_un_308_non_e_una_rottura(mocker):
    mocker.patch.object(platform.requests, "get", return_value=FakeResp(308))
    assert platform.check_web_pages().level == "green"


def test_le_rotte_dietro_feature_flag_non_sono_sorvegliate():
    # Regola #BRCC-0820: /risultati e /oggi fanno notFound() quando
    # NEXT_PUBLIC_UX_NEW != "1". Sorvegliarle significa nascere con un rosso
    # falso e permanente, cioe' insegnare a ignorare i rossi.
    assert "/risultati" not in platform.WATCHED_PAGES
    assert "/oggi" not in platform.WATCHED_PAGES
    assert platform.FLAG_GATED_PAGES["/risultati"] == "NEXT_PUBLIC_UX_NEW"


def test_rete_giu_e_unknown_non_red(mocker):
    mocker.patch.object(platform.requests, "get", side_effect=OSError("dns"))
    v = platform.check_web_pages()
    assert v.level == "unknown"
    assert "dns" in v.headline


def test_latenza_db_soglie(mocker):
    tempi = iter([0.0, 0.2])
    mocker.patch.object(platform.time, "monotonic", side_effect=lambda: next(tempi))
    mocker.patch.object(platform, "fetch_all", return_value=[(1,)])
    assert platform.check_db_latency().level == "green"

    tempi = iter([0.0, 1.5])
    mocker.patch.object(platform.time, "monotonic", side_effect=lambda: next(tempi))
    assert platform.check_db_latency().level == "amber"

    tempi = iter([0.0, 4.0])
    mocker.patch.object(platform.time, "monotonic", side_effect=lambda: next(tempi))
    assert platform.check_db_latency().level == "red"


def test_db_giu_e_unknown(mocker):
    mocker.patch.object(platform, "fetch_all", side_effect=DbUnavailable("timeout"))
    v = platform.check_db_latency()
    assert v.level == "unknown"
    assert "timeout" in v.headline


def test_errori_24h(mocker):
    mocker.patch.object(platform, "fetch_all", return_value=[(0,)])
    assert platform.check_errors_24h().level == "green"
    mocker.patch.object(platform, "fetch_all", return_value=[(7,)])
    v = platform.check_errors_24h()
    assert v.level == "amber"
    assert v.value == 7


def test_il_registro_espone_id_stabili():
    ids = [c.id for c in platform.checks()]
    assert ids == ["web_pages", "api_version", "db_latency", "errors_24h"]
    assert all(c.group == "piattaforma" for c in platform.checks())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_checks_platform.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools.control_center.checks'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/control_center/checks/__init__.py`:

```python
"""Registro dei check attivi.

Le fasi 2 e 3 aggiungono moduli qui e non toccano il collector. Se una fase
costringe a modificare il collector, il contratto del check era sbagliato.
"""

from . import daemons, platform


def all_checks() -> list:
    return [*platform.checks(), *daemons.checks()]
```

Create `tools/control_center/checks/platform.py`:

```python
"""Il sito, il deploy, il database: cio' che rende BetRedge raggiungibile."""

import time

import requests

from ..contract import Check, Verdict, amber, green, red, unknown
from ..db import DbUnavailable, fetch_all

BASE = "https://www.betredge.com"

WATCHED_PAGES = ("/", "/predictions", "/plans", "/weekly-pick")

# Rotte deliberatamente NON sorvegliate. Esistono su main e sono nello sha
# deployato, ma rispondono 404 per progetto: fanno notFound() quando il flag
# non e' attivo. Sorvegliarle significa nascere con un rosso falso permanente.
FLAG_GATED_PAGES = {
    "/risultati": "NEXT_PUBLIC_UX_NEW",
    "/oggi": "NEXT_PUBLIC_UX_NEW",
}

DB_LATENCY_AMBER_S = 0.8
DB_LATENCY_RED_S = 3.0
ERRORS_AMBER = 1


def _ok(code: int) -> bool:
    return 200 <= code < 400


def check_web_pages() -> Verdict:
    codici: dict[str, int] = {}
    try:
        for path in WATCHED_PAGES:
            codici[path] = requests.get(
                BASE + path, timeout=12, allow_redirects=False
            ).status_code
    except Exception as exc:  # rete, DNS, TLS: non misurato, non rotto
        return unknown(f"impossibile raggiungere il sito: {exc}", f"http:{BASE}")

    rotte = [p for p, c in codici.items() if not _ok(c)]
    if rotte:
        return red(
            f"non rispondono: {', '.join(rotte)}",
            f"http:{BASE}",
            value=f"{len(WATCHED_PAGES) - len(rotte)}/{len(WATCHED_PAGES)}",
            evidence=codici,
        )
    return green(
        f"{len(WATCHED_PAGES)} pagine su {len(WATCHED_PAGES)} rispondono",
        f"http:{BASE}",
        value=f"{len(WATCHED_PAGES)}/{len(WATCHED_PAGES)}",
        evidence=codici,
    )


def check_api_version() -> Verdict:
    try:
        resp = requests.get(f"{BASE}/api/version", timeout=12)
        sha = (resp.json() or {}).get("id", "")
    except Exception as exc:
        return unknown(f"/api/version non risponde: {exc}", f"http:{BASE}/api/version")
    if not sha:
        return red("risponde senza sha", f"http:{BASE}/api/version", evidence={"body": resp.text[:200]})
    return green(f"deployato {sha[:7]}", f"http:{BASE}/api/version", value=sha[:7])


def check_db_latency() -> Verdict:
    inizio = time.monotonic()
    try:
        fetch_all("select 1")
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:select 1")
    trascorso = time.monotonic() - inizio
    ms = f"{trascorso * 1000:.0f} ms"
    if trascorso >= DB_LATENCY_RED_S:
        return red(f"pooler lentissimo: {ms}", "db:select 1", value=ms)
    if trascorso >= DB_LATENCY_AMBER_S:
        return amber(f"pooler lento: {ms}", "db:select 1", value=ms)
    return green(f"risponde in {ms}", "db:select 1", value=ms)


def check_errors_24h() -> Verdict:
    try:
        righe = fetch_all(
            "select count(*) from error_patterns_log where logged_at > now() - interval '24 hours'"
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:error_patterns_log")
    n = int(righe[0][0]) if righe else 0
    if n >= ERRORS_AMBER:
        return amber(f"{n} pattern di errore nelle 24h", "db:error_patterns_log", value=n)
    return green("nessun pattern di errore nelle 24h", "db:error_patterns_log", value=0)


def checks() -> list[Check]:
    return [
        Check("web_pages", "piattaforma", "Pagine chiave", check_web_pages, timeout_seconds=60),
        Check("api_version", "piattaforma", "Sha deployato", check_api_version, timeout_seconds=20),
        Check("db_latency", "piattaforma", "Latenza database", check_db_latency, timeout_seconds=20),
        Check("errors_24h", "piattaforma", "Errori 24h", check_errors_24h, timeout_seconds=20),
    ]
```

Nota: `Check` è una dataclass, quindi accetta anche argomenti posizionali nell'ordine `id, group, label, fn`.

- [ ] **Step 4: Creare il segnaposto di daemons.py**

`checks/__init__.py` importa `daemons`, che nasce completo nel Task 7. Senza
questo file l'import fallisce e i test di questo task non partono. Create
`tools/control_center/checks/daemons.py` con esattamente questo contenuto — il
Task 7 lo sostituisce integralmente:

```python
"""I daemon locali e i cron. Implementato nel Task 7 del piano #BRCC-0820."""


def checks() -> list:
    return []
```

- [ ] **Step 5: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_checks_platform.py -v`
Expected: PASS, 9 test

- [ ] **Step 6: Commit**

```bash
git add tools/control_center/checks/ tests/test_cc_checks_platform.py
git commit -m "feat(cc): check piattaforma con rotte flag-gated escluse (#BRCC-0820)"
```

---

### Task 7: Check daemon e cron — l'artefatto, non l'exit code

**Files:**
- Modify: `tools/control_center/checks/daemons.py` (sostituisce il segnaposto del Task 6)
- Test: `tests/test_cc_checks_daemons.py`

**Interfaces:**
- Consumes: `Check`, helper di `contract`; `fetch_all`, `DbUnavailable` da `db`.
- Produces:
  - `SCOPE: tuple[str, ...]` — le label launchd di perimetro BetRedge
  - `CRONS: tuple[CronSpec, ...]` con `CronSpec = namedtuple("CronSpec", "id label table column interval_seconds")`
  - `def parse_launchctl(output: str) -> dict[str, dict]`
  - `def check_launchd(label: str) -> Verdict`
  - `def check_cron(spec: CronSpec) -> Verdict`
  - `def checks() -> list[Check]`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_checks_daemons.py`:

```python
import pytest

from tools.control_center.checks import daemons
from tools.control_center.db import DbUnavailable

OUTPUT = """PID\tStatus\tLabel
-\t0\tcom.agentic-markets.live-monitor
73946\t-15\tcom.agentic-markets.agents
-\t1\tcom.agentic-markets.weeklypick-morning
-\t126\tio.maven.softmarkets.collect
"""


def test_parse_estrae_pid_e_stato():
    tabella = daemons.parse_launchctl(OUTPUT)
    assert tabella["com.agentic-markets.agents"]["pid"] == 73946
    assert tabella["com.agentic-markets.agents"]["status"] == -15
    assert tabella["com.agentic-markets.live-monitor"]["pid"] is None
    assert tabella["io.maven.softmarkets.collect"]["status"] == 126
    assert "Label" not in tabella


def test_exit_zero_senza_pid_e_verde(mocker):
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(OUTPUT))
    v = daemons.check_launchd("com.agentic-markets.live-monitor")
    assert v.level == "green"


def test_processo_vivo_e_verde(mocker):
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(OUTPUT))
    v = daemons.check_launchd("com.agentic-markets.agents")
    assert v.level == "green"
    assert "73946" in str(v.evidence)


def test_exit_diverso_da_zero_e_rosso(mocker):
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(OUTPUT))
    v = daemons.check_launchd("io.maven.softmarkets.collect")
    assert v.level == "red"
    assert "126" in v.headline
    assert v.value == 126


def test_label_non_caricata_e_rossa(mocker):
    mocker.patch.object(daemons, "_launchctl_table", return_value=daemons.parse_launchctl(OUTPUT))
    v = daemons.check_launchd("com.betredge.non-esiste")
    assert v.level == "red"
    assert "non caricato" in v.headline


def test_launchctl_non_disponibile_e_unknown(mocker):
    mocker.patch.object(daemons, "_launchctl_table", side_effect=OSError("no launchctl"))
    assert daemons.check_launchd("qualsiasi").level == "unknown"


def test_cron_verde_se_l_artefatto_e_recente(mocker):
    spec = daemons.CronSpec("cron_settle", "Settle", "pick_settlement", "settled_at", 1800)
    mocker.patch.object(daemons, "fetch_all", return_value=[(600,)])
    v = daemons.check_cron(spec)
    assert v.level == "green"


def test_cron_rosso_se_l_artefatto_manca_oltre_il_doppio_dell_intervallo(mocker):
    # Il cron settle gira ogni 30 minuti: 12 ore di silenzio sono rosse
    # anche se Vercel risponde 200. Un processo puo' uscire con codice zero
    # e non produrre niente.
    spec = daemons.CronSpec("cron_settle", "Settle", "pick_settlement", "settled_at", 1800)
    mocker.patch.object(daemons, "fetch_all", return_value=[(43440,)])
    v = daemons.check_cron(spec)
    assert v.level == "red"
    assert "12h" in v.headline


def test_cron_su_tabella_vuota_e_rosso_non_unknown(mocker):
    # None significa "nessuna riga": il cron non ha mai prodotto nulla.
    # E' un'assenza di artefatto, quindi rosso, non "non misurato".
    spec = daemons.CronSpec("cron_crm", "CRM", "crm_trigger_sends", "sent_at", 86400)
    mocker.patch.object(daemons, "fetch_all", return_value=[(None,)])
    v = daemons.check_cron(spec)
    assert v.level == "red"
    assert "mai" in v.headline


def test_cron_con_db_giu_e_unknown(mocker):
    spec = daemons.CronSpec("cron_crm", "CRM", "crm_trigger_sends", "sent_at", 86400)
    mocker.patch.object(daemons, "fetch_all", side_effect=DbUnavailable("timeout"))
    assert daemons.check_cron(spec).level == "unknown"


def test_lo_scope_esclude_i_progetti_non_betredge():
    testo = " ".join(daemons.SCOPE)
    assert "lumio" not in testo
    assert "maketelier" not in testo
    assert "mia-valentina" not in testo
    assert any("agentic-markets" in label for label in daemons.SCOPE)


def test_il_registro_copre_scope_e_cron():
    ids = [c.id for c in daemons.checks()]
    assert len(ids) == len(daemons.SCOPE) + len(daemons.CRONS)
    assert len(set(ids)) == len(ids)
    assert "cron_settle" in ids
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_checks_daemons.py -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'parse_launchctl'`

- [ ] **Step 3: Write minimal implementation**

Replace `tools/control_center/checks/daemons.py` with:

```python
"""I daemon locali e i cron su Vercel.

Principio guida: si giudica l'artefatto, non l'invocazione. Un processo puo'
uscire con codice zero e non produrre niente; un cron puo' rispondere 200 e non
scrivere una riga. Il 2026-08-20 tre daemon di questo elenco erano morti in
silenzio, incluso il controllore di salute.
"""

import subprocess
from collections import namedtuple

from ..contract import Check, Verdict, green, red, unknown
from ..db import DbUnavailable, fetch_all

SCOPE = (
    "com.agentic-markets.agents",
    "com.agentic-markets.watchdog",
    "com.agentic-markets.live-monitor",
    "com.agentic-markets.daemon-health",
    "com.agentic-markets.goalscorer-odds",
    "com.agentic-markets.weeklypick-morning",
    "io.maven.softmarkets.collect",
    "io.maven.softmarkets.predict",
)

CronSpec = namedtuple("CronSpec", "id label table column interval_seconds")

CRONS = (
    CronSpec("cron_settle", "Cron settle", "pick_settlement", "settled_at", 1800),
    CronSpec("cron_predictions", "Cron predictions/refresh", "match_predictions", "computed_at", 7200),
    CronSpec("cron_crm", "Cron CRM", "crm_trigger_sends", "sent_at", 86400),
    CronSpec("cron_paygate", "Cron paygate-reconcile", "paygate_orders", "created_at", 300),
)

# Tabelle e colonne provengono da una lista chiusa scritta qui sopra, mai
# dall'esterno: e' cio' che rende sicura l'interpolazione nella query.
_AGE_SQL = "select extract(epoch from now() - max({col})) from {tbl}"


def _launchctl_table() -> dict[str, dict]:
    out = subprocess.run(
        ["launchctl", "list"], capture_output=True, text=True, timeout=10, check=True
    ).stdout
    return parse_launchctl(out)


def parse_launchctl(output: str) -> dict[str, dict]:
    """Tre colonne separate da tab: PID, ultimo stato, label."""
    tabella: dict[str, dict] = {}
    for line in output.splitlines():
        parti = line.split("\t")
        if len(parti) < 3:
            continue
        pid_raw, status_raw, label = parti[0].strip(), parti[1].strip(), parti[2].strip()
        if label == "Label" or not label:
            continue
        try:
            status = int(status_raw)
        except ValueError:
            continue
        tabella[label] = {
            "pid": int(pid_raw) if pid_raw.isdigit() else None,
            "status": status,
        }
    return tabella


def _human(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h {(seconds % 3600) // 60:02d}m"
    return f"{seconds // 86400}g {(seconds % 86400) // 3600}h"


def check_launchd(label: str) -> Verdict:
    try:
        tabella = _launchctl_table()
    except Exception as exc:
        return unknown(f"launchctl non interrogabile: {exc}", "launchctl list")

    riga = tabella.get(label)
    if riga is None:
        return red("non caricato in launchd", f"launchctl:{label}")

    if riga["status"] not in (0, -15):
        # -15 e' SIGTERM: un'uscita ordinata su richiesta, non un guasto.
        return red(
            f"ultimo exit {riga['status']}",
            f"launchctl:{label}",
            value=riga["status"],
            evidence=riga,
        )

    if riga["pid"] is not None:
        return green(f"in esecuzione, pid {riga['pid']}", f"launchctl:{label}", evidence=riga)
    return green("caricato, ultimo run pulito", f"launchctl:{label}", evidence=riga)


def check_cron(spec: CronSpec) -> Verdict:
    sql = _AGE_SQL.format(col=spec.column, tbl=spec.table)
    try:
        righe = fetch_all(sql)
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", f"db:{spec.table}")

    eta = righe[0][0] if righe else None
    if eta is None:
        return red(
            f"nessuna riga in {spec.table}: mai prodotto nulla",
            f"db:{spec.table}",
            evidence={"atteso_ogni_s": spec.interval_seconds},
        )

    eta = float(eta)
    limite = spec.interval_seconds * 2
    testo = _human(eta)
    if eta > limite:
        return red(
            f"nessuna scrittura da {testo} (atteso ogni {_human(spec.interval_seconds)})",
            f"db:{spec.table}",
            value=testo,
            evidence={"age_s": int(eta), "limite_s": limite},
        )
    return green(
        f"ultima scrittura {testo} fa",
        f"db:{spec.table}",
        value=testo,
        evidence={"age_s": int(eta)},
    )


def checks() -> list[Check]:
    fatti = [
        Check(
            f"launchd_{label.rsplit('.', 1)[-1]}",
            "daemon",
            label,
            lambda lbl=label: check_launchd(lbl),
            timeout_seconds=15,
        )
        for label in SCOPE
    ]
    fatti += [
        Check(spec.id, "cron", spec.label, lambda s=spec: check_cron(s), timeout_seconds=20)
        for spec in CRONS
    ]
    return fatti
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_checks_daemons.py -v`
Expected: PASS, 12 test

- [ ] **Step 5: Verifica contro la macchina vera**

Run:
```bash
venv/bin/python -c "
from tools.control_center.checks import daemons
for c in daemons.checks():
    v = c.fn()
    print(f'{v.level:8} {c.id:32} {v.headline}')
"
```
Expected: almeno tre `red` — `softmarkets_collect` con exit 126, `daemon-health` con exit 1, `weeklypick-morning` con exit 1 — e `cron_settle` rosso se `pick_settlement` è ancora fermo. Se escono tutti verdi, il parsing di `launchctl` non funziona: fermarsi e correggere.

- [ ] **Step 6: Commit**

```bash
git add tools/control_center/checks/daemons.py tests/test_cc_checks_daemons.py
git commit -m "feat(cc): check daemon e cron giudicati sull'artefatto (#BRCC-0820)"
```

---

### Task 8: Consegna delle notifiche

**Files:**
- Create: `tools/control_center/notify.py`
- Test: `tests/test_cc_notify.py`

**Interfaces:**
- Consumes: `load_env` da `db`.
- Produces:
  - `def send(notifiche: list[dict], env: dict | None = None) -> list[str]` — ritorna i canali usati

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_notify.py`:

```python
from tools.control_center import notify


def test_niente_notifiche_niente_chiamate(mocker):
    run = mocker.patch.object(notify.subprocess, "run")
    post = mocker.patch.object(notify.requests, "post")
    assert notify.send([], env={}) == []
    run.assert_not_called()
    post.assert_not_called()


def test_manda_su_macos_e_telegram(mocker):
    run = mocker.patch.object(notify.subprocess, "run")
    post = mocker.patch.object(notify.requests, "post")
    canali = notify.send(
        [{"check_id": "c", "kind": "down", "title": "T", "body": "B"}],
        env={"TELEGRAM_BOT_TOKEN": "tok", "TELEGRAM_CHAT_ID": "42"},
    )
    assert set(canali) == {"macos", "telegram"}
    assert run.call_args[0][0][0] == "osascript"
    assert post.call_args[1]["json"]["chat_id"] == "42"


def test_senza_token_resta_solo_macos(mocker):
    mocker.patch.object(notify.subprocess, "run")
    post = mocker.patch.object(notify.requests, "post")
    canali = notify.send([{"check_id": "c", "kind": "down", "title": "T", "body": "B"}], env={})
    assert canali == ["macos"]
    post.assert_not_called()


def test_il_token_non_finisce_mai_nel_messaggio(mocker):
    mocker.patch.object(notify.subprocess, "run")
    post = mocker.patch.object(notify.requests, "post")
    notify.send(
        [{"check_id": "c", "kind": "down", "title": "T", "body": "B"}],
        env={"TELEGRAM_BOT_TOKEN": "SEGRETO", "TELEGRAM_CHAT_ID": "42"},
    )
    assert "SEGRETO" not in post.call_args[1]["json"]["text"]


def test_un_canale_che_esplode_non_blocca_l_altro(mocker):
    mocker.patch.object(notify.subprocess, "run", side_effect=OSError("no osascript"))
    mocker.patch.object(notify.requests, "post")
    canali = notify.send(
        [{"check_id": "c", "kind": "down", "title": "T", "body": "B"}],
        env={"TELEGRAM_BOT_TOKEN": "tok", "TELEGRAM_CHAT_ID": "42"},
    )
    assert canali == ["telegram"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_notify.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools.control_center.notify'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/control_center/notify.py`:

```python
"""Consegna delle notifiche. Mai sul canale pubblico, solo a Andrea."""

import subprocess

import requests

from .db import load_env

_ICONA = {"down": "🔴", "up": "🟢"}


def _testo(notifiche: list[dict]) -> str:
    return "\n".join(
        f"{_ICONA.get(n['kind'], '•')} {n['title']}\n{n['body']}" for n in notifiche
    )


def _macos(notifiche: list[dict]) -> None:
    titolo = notifiche[0]["title"] if len(notifiche) == 1 else f"BetRedge · {len(notifiche)} cambi"
    corpo = notifiche[0]["body"] if len(notifiche) == 1 else "; ".join(n["check_id"] for n in notifiche)
    script = f'display notification {corpo!r} with title {titolo!r}'
    subprocess.run(["osascript", "-e", script], capture_output=True, timeout=10, check=False)


def _telegram(notifiche: list[dict], token: str, chat_id: str) -> None:
    requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": _testo(notifiche), "disable_notification": False},
        timeout=15,
    )


def send(notifiche: list[dict], env: dict | None = None) -> list[str]:
    """Manda su tutti i canali disponibili. Un canale rotto non blocca gli altri."""
    if not notifiche:
        return []
    valori = env if env is not None else load_env()
    usati: list[str] = []

    try:
        _macos(notifiche)
        usati.append("macos")
    except Exception:  # noqa: BLE001 — la notifica e' best effort, non un check
        pass

    token = valori.get("TELEGRAM_BOT_TOKEN")
    chat_id = valori.get("TELEGRAM_CHAT_ID")
    if token and chat_id:
        try:
            _telegram(notifiche, token, chat_id)
            usati.append("telegram")
        except Exception:  # noqa: BLE001
            pass

    return usati
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_notify.py -v`
Expected: PASS, 5 test

- [ ] **Step 5: Commit**

```bash
git add tools/control_center/notify.py tests/test_cc_notify.py
git commit -m "feat(cc): consegna notifiche su macOS e Telegram, canali indipendenti (#BRCC-0820)"
```

---

### Task 9: Il collector — entrypoint

**Files:**
- Create: `tools/control_center/collector.py`
- Test: `tests/test_cc_collector.py`

**Interfaces:**
- Consumes: `all_checks` da `checks`; `run_checks`; `read_state`/`write_state`/`append_history`/`build_state`; `decide_alerts`; `notify.send`.
- Produces:
  - `def collect(checks_list=None, now=None, state_path=None, history_path=None, notifier=None) -> dict`
  - `def main(argv: list[str] | None = None) -> int` — supporta `--dry-run` (nessuna scrittura, nessuna notifica, stampa il riassunto)

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_collector.py`:

```python
from datetime import datetime, timedelta, timezone

from tools.control_center.collector import collect
from tools.control_center.contract import Check, green, red

T0 = datetime(2026, 8, 20, 17, 0, 0, tzinfo=timezone.utc)


def _chk(cid, verdict_fn):
    return Check(id=cid, group="test", label=cid, fn=verdict_fn)


def test_collect_scrive_stato_e_storico(tmp_path):
    sp, hp = tmp_path / "state.json", tmp_path / "history.jsonl"
    stato = collect(
        [_chk("a", lambda: green("ok", "s", now=T0))],
        now=T0, state_path=sp, history_path=hp, notifier=lambda n, env=None: [],
    )
    assert stato["summary"]["level"] == "green"
    assert sp.exists() and hp.exists()
    assert stato["checks"]["a"]["group"] == "test"


def test_collect_notifica_solo_al_secondo_rosso(tmp_path):
    sp, hp = tmp_path / "state.json", tmp_path / "history.jsonl"
    inviate = []

    def spia(notifiche, env=None):
        inviate.extend(notifiche)
        return ["test"]

    args = dict(state_path=sp, history_path=hp, notifier=spia)
    collect([_chk("a", lambda: red("giu'", "s", now=T0))], now=T0, **args)
    assert inviate == []

    t1 = T0 + timedelta(minutes=5)
    collect([_chk("a", lambda: red("giu'", "s", now=t1))], now=t1, **args)
    assert len(inviate) == 1
    assert inviate[0]["check_id"] == "a"


def test_lo_stato_di_allerta_sopravvive_al_riavvio(tmp_path):
    # Il conteggio dei run rossi vive nello snapshot, non in memoria: al primo
    # run dopo un reboot non deve arrivare una raffica di allarmi gia' noti.
    sp, hp = tmp_path / "state.json", tmp_path / "history.jsonl"
    args = dict(state_path=sp, history_path=hp, notifier=lambda n, env=None: [])
    collect([_chk("a", lambda: red("giu'", "s", now=T0))], now=T0, **args)
    from tools.control_center.snapshot import read_state
    assert read_state(sp)["alerts"]["a"]["red_runs"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_collector.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools.control_center.collector'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/control_center/collector.py`:

```python
"""Entrypoint del collector: misura, salva, confronta, avvisa."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .alerting import decide_alerts
from .checks import all_checks
from .contract import now_iso
from .notify import send
from .runner import run_checks
from .snapshot import append_history, build_state, read_state, write_state


def collect(
    checks_list=None,
    now: datetime | None = None,
    state_path: Path | None = None,
    history_path: Path | None = None,
    notifier=None,
) -> dict:
    moment = now or datetime.now(timezone.utc)
    lista = checks_list if checks_list is not None else all_checks()
    consegna = notifier if notifier is not None else send

    precedente = read_state(state_path)
    verdicts = run_checks(lista, previous=precedente.get("checks"), now=moment)
    notifiche, alert_state = decide_alerts(precedente.get("alerts", {}), verdicts, moment)

    gruppi = {c.id: c.group for c in lista}
    stato = build_state(verdicts, gruppi, alert_state, now_iso(moment))

    write_state(stato, state_path)
    append_history(verdicts, now_iso(moment), history_path)
    if notifiche:
        consegna(notifiche)
    return stato


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="BetRedge Control Center — collector")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="misura e stampa senza scrivere lo stato ne' notificare",
    )
    args = parser.parse_args(argv)

    if args.dry_run:
        from .runner import run_checks as _run

        lista = all_checks()
        verdicts = _run(lista)
        for cid, verdict in sorted(verdicts.items(), key=lambda kv: kv[1].level):
            print(f"{verdict.level:8} {cid:34} {verdict.headline}")
        return 0

    stato = collect()
    print(json.dumps(stato["summary"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_collector.py -v`
Expected: PASS, 3 test

- [ ] **Step 5: Prova a secco contro il sistema vero**

Run: `venv/bin/python -m tools.control_center.collector --dry-run`
Expected: una riga per check, con i rossi in cima. Nessun file scritto in `~/.betredge-cc/`, nessuna notifica.

- [ ] **Step 6: Commit**

```bash
git add tools/control_center/collector.py tests/test_cc_collector.py
git commit -m "feat(cc): collector con snapshot, allerta e modalita' dry-run (#BRCC-0820)"
```

---

### Task 10: Server locale e pagina

**Files:**
- Create: `tools/control_center/server.py`
- Create: `tools/control_center/static/index.html`
- Test: `tests/test_cc_server.py`

**Interfaces:**
- Consumes: `read_state`, `HISTORY_FILE` da `snapshot`.
- Produces:
  - `HOST = "127.0.0.1"`, `PORT = 8790`
  - `def make_server(port: int = PORT) -> ThreadingHTTPServer`
  - `def main(argv=None) -> int`

- [ ] **Step 1: Write the failing test**

Create `tests/test_cc_server.py`:

```python
import json
import threading
import urllib.error
import urllib.request

import pytest

from tools.control_center import server as srv
from tools.control_center.snapshot import write_state


@pytest.fixture
def in_piedi(tmp_path, mocker):
    stato = tmp_path / "state.json"
    write_state({"generated_at": "2026-08-20T17:45:00Z", "summary": {"level": "green"}, "checks": {}}, stato)
    mocker.patch.object(srv, "STATE_FILE", stato)
    mocker.patch.object(srv, "HISTORY_FILE", tmp_path / "history.jsonl")
    httpd = srv.make_server(port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def test_ascolta_solo_su_loopback():
    httpd = srv.make_server(port=0)
    assert httpd.server_address[0] == "127.0.0.1"
    httpd.server_close()


def test_api_state_restituisce_lo_snapshot(in_piedi):
    with urllib.request.urlopen(in_piedi + "/api/state", timeout=5) as r:
        body = json.loads(r.read())
    assert body["summary"]["level"] == "green"


def test_la_radice_serve_la_pagina(in_piedi):
    with urllib.request.urlopen(in_piedi + "/", timeout=5) as r:
        html = r.read().decode()
    assert "<title>" in html
    assert "api/state" in html


def test_api_history_su_file_assente_e_una_lista_vuota(in_piedi):
    with urllib.request.urlopen(in_piedi + "/api/history", timeout=5) as r:
        assert json.loads(r.read()) == []


def test_ogni_altro_percorso_e_404(in_piedi):
    for path in ("/etc/passwd", "/../../etc/passwd", "/static/../server.py", "/qualsiasi"):
        with pytest.raises(urllib.error.HTTPError) as exc:
            urllib.request.urlopen(in_piedi + path, timeout=5)
        assert exc.value.code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_cc_server.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'tools.control_center.server'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/control_center/server.py`:

```python
"""Il server della pagina. Legge lo snapshot, mai le fonti."""

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .snapshot import HISTORY_FILE, STATE_FILE, read_state

HOST = "127.0.0.1"
PORT = 8790
PAGE = Path(__file__).resolve().parent / "static" / "index.html"
HISTORY_LIMIT = 500


class Handler(BaseHTTPRequestHandler):
    server_version = "betredge-cc"

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 — firma imposta da BaseHTTPRequestHandler
        path = self.path.split("?", 1)[0]
        # Whitelist esplicita di tre percorsi: nessuna mappatura path->file,
        # quindi nessun traversal possibile per costruzione.
        if path in ("/", "/index.html"):
            self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
        elif path == "/api/state":
            body = json.dumps(read_state(STATE_FILE), ensure_ascii=False).encode()
            self._send(200, body, "application/json; charset=utf-8")
        elif path == "/api/history":
            self._send(200, self._history(), "application/json; charset=utf-8")
        else:
            self._send(404, b'{"error":"not found"}', "application/json; charset=utf-8")

    def _history(self) -> bytes:
        try:
            righe = Path(HISTORY_FILE).read_text().splitlines()[-HISTORY_LIMIT:]
        except (FileNotFoundError, OSError):
            return b"[]"
        out = []
        for riga in righe:
            try:
                out.append(json.loads(riga))
            except json.JSONDecodeError:
                continue
        return json.dumps(out, ensure_ascii=False).encode()

    def log_message(self, fmt, *args) -> None:
        """Silenzio: il server gira sotto launchd e non deve gonfiare i log."""


def make_server(port: int = PORT) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((HOST, port), Handler)


def main(argv=None) -> int:
    httpd = make_server()
    print(f"control center su http://{HOST}:{httpd.server_address[1]}")
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

Create `tools/control_center/static/index.html` — la pagina usa gli stessi token dell'Artifact della spec, e disegna le zone dallo snapshot:

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BetRedge Control Center</title>
<style>
  :root{
    --paper:#F5F7F8; --surface:#FFF; --surface-2:#EDF1F3; --ink:#15191D;
    --ink-2:#4E5964; --ink-3:#77838E; --rule:#D8DEE3; --rule-soft:#E6EBEE;
    --signal:#1B5C70;
    --ok:#2C6A4C; --ok-bg:#E4EFE8; --warn:#8A6110; --warn-bg:#F6EDDA;
    --bad:#A03027; --bad-bg:#F7E5E2; --unk:#625C72; --unk-bg:#EBE9EF;
    --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  }
  @media (prefers-color-scheme:dark){:root{
    --paper:#0F1418; --surface:#161C21; --surface-2:#1D242A; --ink:#E7EBEE;
    --ink-2:#A3AEB7; --ink-3:#7C8892; --rule:#283138; --rule-soft:#1F272D;
    --signal:#74B8CE;
    --ok:#7FC49E; --ok-bg:#16261E; --warn:#D9AE5E; --warn-bg:#292014;
    --bad:#E28A80; --bad-bg:#2B1917; --unk:#A9A2BB; --unk-bg:#201E28;
  }}
  *{box-sizing:border-box}
  body{margin:0;padding:0 20px 80px;background:var(--paper);color:var(--ink);
       font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
  .wrap{max-width:1080px;margin:0 auto}
  header{padding:32px 0 18px;display:flex;flex-wrap:wrap;gap:12px 24px;
         align-items:baseline;border-bottom:2px solid var(--ink)}
  h1{font:700 22px/1.1 var(--mono);margin:0;letter-spacing:-.02em}
  .stamp{font:12px var(--mono);color:var(--ink-3)}
  .verdict{display:flex;gap:14px;align-items:center;margin:22px 0 8px;
           padding:16px 18px;background:var(--surface);border:1px solid var(--rule);
           border-left:4px solid var(--ink-3)}
  .verdict.red{border-left-color:var(--bad)} .verdict.amber{border-left-color:var(--warn)}
  .verdict.green{border-left-color:var(--ok)} .verdict.unknown{border-left-color:var(--unk)}
  .lamp{width:13px;height:13px;border-radius:50%;background:var(--ink-3);flex:none}
  .verdict.red .lamp{background:var(--bad)} .verdict.amber .lamp{background:var(--warn)}
  .verdict.green .lamp{background:var(--ok)} .verdict.unknown .lamp{background:var(--unk)}
  .verdict b{display:block;font:600 15px var(--mono)}
  .verdict span{font-size:13.5px;color:var(--ink-2)}
  h2{font:600 12px var(--mono);letter-spacing:.12em;text-transform:uppercase;
     color:var(--signal);margin:34px 0 10px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:1px;
        background:var(--rule-soft);border:1px solid var(--rule-soft)}
  .tile{background:var(--surface);padding:13px 15px;display:flex;flex-direction:column;gap:5px;
        cursor:pointer;border:none;text-align:left;font:inherit;color:inherit}
  .tile:focus-visible{outline:2px solid var(--signal);outline-offset:-2px}
  .tile-hd{display:flex;justify-content:space-between;gap:8px;align-items:center}
  .tile-hd b{font:600 11.5px var(--mono);color:var(--ink-2);letter-spacing:.03em}
  .val{font:700 24px/1.15 var(--mono);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .line{font-size:13px;color:var(--ink-2);line-height:1.4}
  .src{font:10.5px var(--mono);color:var(--ink-3)}
  .pill{display:inline-flex;align-items:center;gap:5px;font:600 10.5px var(--mono);
        letter-spacing:.07em;text-transform:uppercase;padding:2px 7px 2px 5px;border-radius:2px}
  .pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
  .pill.green{color:var(--ok);background:var(--ok-bg)}
  .pill.amber{color:var(--warn);background:var(--warn-bg)}
  .pill.red{color:var(--bad);background:var(--bad-bg)}
  .pill.unknown{color:var(--unk);background:var(--unk-bg)}
  .empty{padding:16px 18px;background:var(--surface);border:1px solid var(--rule);
         font-size:14px;color:var(--ink-2)}
  pre.ev{margin:6px 0 0;font:11.5px var(--mono);background:var(--surface-2);
         padding:10px 12px;overflow-x:auto;color:var(--ink-2);white-space:pre-wrap}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>BetRedge Control Center</h1>
    <div class="stamp" id="stamp">carico…</div>
  </header>
  <div class="verdict" id="verdict"><div class="lamp"></div>
    <div><b id="vh">—</b><span id="vd"></span></div></div>
  <div id="zone"></div>
</div>
<script>
const GRUPPI = [
  ["rotto",       "Cosa è rotto adesso"],
  ["piattaforma", "Piattaforma"],
  ["daemon",      "Daemon locali"],
  ["cron",        "Cron su Vercel"],
];
const eta = (iso) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!isFinite(s)) return "?";
  return s < 90 ? `${s}s fa` : s < 5400 ? `${Math.round(s/60)} min fa` : `${Math.round(s/3600)}h fa`;
};
function tile(id, c) {
  const el = document.createElement("button");
  el.className = "tile";
  el.type = "button";
  el.innerHTML = `<div class="tile-hd"><b></b><span class="pill ${c.level}">${c.level}</span></div>
    <div class="val"></div><div class="line"></div><div class="src"></div>`;
  el.querySelector("b").textContent = id;
  el.querySelector(".val").textContent = c.value ?? "—";
  el.querySelector(".line").textContent = c.headline;
  el.querySelector(".src").textContent = `misurato ${eta(c.measured_at)} · ${c.source}`;
  el.addEventListener("click", () => {
    let pre = el.querySelector("pre.ev");
    if (pre) { pre.remove(); return; }
    pre = document.createElement("pre");
    pre.className = "ev";
    pre.textContent = JSON.stringify(c.evidence ?? {}, null, 1);
    el.appendChild(pre);
  });
  return el;
}
async function render() {
  const st = await (await fetch("/api/state", {cache: "no-store"})).json();
  if (!st.generated_at) { document.getElementById("stamp").textContent = "nessuno snapshot: il collector non ha ancora girato"; return; }
  document.getElementById("stamp").textContent = `snapshot di ${eta(st.generated_at)}`;
  const v = document.getElementById("verdict");
  v.className = "verdict " + (st.summary?.level ?? "unknown");
  document.getElementById("vh").textContent = st.summary?.headline ?? "—";
  document.getElementById("vd").textContent = st.summary?.detail ?? "";
  const zone = document.getElementById("zone");
  zone.textContent = "";
  const voci = Object.entries(st.checks ?? {});
  for (const [key, titolo] of GRUPPI) {
    const sel = key === "rotto"
      ? voci.filter(([, c]) => c.level === "red" || c.level === "amber")
      : voci.filter(([, c]) => c.group === key);
    const h = document.createElement("h2");
    h.textContent = `${titolo} · ${sel.length}`;
    zone.appendChild(h);
    if (!sel.length) {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = key === "rotto" ? "Niente. Tutto a posto." : "Nessun check in questa zona.";
      zone.appendChild(e);
      continue;
    }
    const g = document.createElement("div");
    g.className = "grid";
    const ordine = {red: 0, amber: 1, unknown: 2, green: 3};
    sel.sort((a, b) => ordine[a[1].level] - ordine[b[1].level]);
    for (const [id, c] of sel) g.appendChild(tile(id, c));
    zone.appendChild(g);
  }
}
render();
setInterval(render, 60000);
</script>
</body>
</html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_cc_server.py -v`
Expected: PASS, 5 test

- [ ] **Step 5: Verifica visiva reale**

Run:
```bash
venv/bin/python -m tools.control_center.collector
venv/bin/python -m tools.control_center.server &
sleep 1 && open http://127.0.0.1:8790
```
Expected: la pagina mostra la barra del verdetto in rosso, la zona "cosa è rotto adesso" popolata con i daemon a exit non-zero, e ogni tile con età della misura e fonte. Cliccare un tile apre l'`evidence`. Controllare anche il tema scuro (Impostazioni di sistema → Aspetto): il testo deve restare leggibile. Fermare il server con `kill %1` al termine.

- [ ] **Step 6: Commit**

```bash
git add tools/control_center/server.py tools/control_center/static/index.html tests/test_cc_server.py
git commit -m "feat(cc): server su loopback con whitelist di percorsi e pagina (#BRCC-0820)"
```

---

### Task 11: launchd e verifica end-to-end

**Files:**
- Create: `ops/launchd/com.betredge.control-center.collector.plist`
- Create: `ops/launchd/com.betredge.control-center.server.plist`
- Create: `tools/control_center/README.md`

**Interfaces:**
- Consumes: `collector.main`, `server.main`.
- Produces: due LaunchAgent installati e la verifica del criterio "Done quando" della spec.

- [ ] **Step 1: Scrivere i plist**

Create `ops/launchd/com.betredge.control-center.collector.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.betredge.control-center.collector</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/calde/Desktop/agentic-markets/venv/bin/python</string>
    <string>-m</string>
    <string>tools.control_center.collector</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/calde/Desktop/agentic-markets</string>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/Users/calde/Library/Logs/betredge-cc/collector.out.log</string>
  <key>StandardErrorPath</key><string>/Users/calde/Library/Logs/betredge-cc/collector.err.log</string>
</dict>
</plist>
```

Create `ops/launchd/com.betredge.control-center.server.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.betredge.control-center.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/calde/Desktop/agentic-markets/venv/bin/python</string>
    <string>-m</string>
    <string>tools.control_center.server</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/calde/Desktop/agentic-markets</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/calde/Library/Logs/betredge-cc/server.out.log</string>
  <key>StandardErrorPath</key><string>/Users/calde/Library/Logs/betredge-cc/server.err.log</string>
</dict>
</plist>
```

- [ ] **Step 2: Installare e caricare**

Run:
```bash
mkdir -p ~/Library/Logs/betredge-cc
cp ops/launchd/com.betredge.control-center.*.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.betredge.control-center.collector.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.betredge.control-center.server.plist
sleep 20
launchctl list | grep betredge
```
Expected: due righe con exit status `0` (il collector) e un pid vivo (il server).

- [ ] **Step 3: Verificare che la pagina risponda dal servizio**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8790/`
Expected: `200`

- [ ] **Step 4: Verificare il criterio "Done quando" — l'allerta funziona davvero**

Questo è il test che conta: la spec dice che una rottura iniettata a mano deve produrre una notifica entro due cicli.

Run:
```bash
launchctl bootout gui/$(id -u)/com.agentic-markets.live-monitor
cd ~/Desktop/agentic-markets
venv/bin/python -m tools.control_center.collector   # run 1: rileva, non notifica
venv/bin/python -m tools.control_center.collector   # run 2: conferma e notifica
```
Expected: al primo run nessuna notifica; al secondo una notifica macOS e un messaggio Telegram con `launchd_live-monitor è rosso`. Poi ripristinare:
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.agentic-markets.live-monitor.plist
venv/bin/python -m tools.control_center.collector   # notifica di rientro
```
Expected: una notifica di rientro. Se non arriva nulla, controllare `~/Library/Logs/betredge-cc/collector.err.log` prima di dichiarare fatto.

- [ ] **Step 5: Verificare che nessun segreto sia finito nello snapshot**

Run:
```bash
grep -ciE "eyJ|bearer|password|token=|:[a-z0-9]{20,}@" ~/.betredge-cc/state.json ~/.betredge-cc/history.jsonl
```
Expected: `0` per entrambi i file. Qualsiasi risultato diverso da zero è un blocco: trovare il campo e togliere il valore prima di proseguire.

- [ ] **Step 6: Scrivere il README operativo**

Create `tools/control_center/README.md`:

```markdown
# BetRedge Control Center

Torre di controllo locale. Spec: `docs/superpowers/specs/2026-08-20-betredge-control-center-design.md`.

**Aprire:** http://127.0.0.1:8790 (il server gira sotto launchd, KeepAlive)

**Misurare a mano senza scrivere niente:**
    venv/bin/python -m tools.control_center.collector --dry-run

**Stato su disco:** `~/.betredge-cc/state.json` e `history.jsonl`
**Log:** `~/Library/Logs/betredge-cc/`

**Aggiungere un check:** una funzione che ritorna un `Verdict` in
`checks/<gruppo>.py`, più una riga in `checks()`. Il collector non si tocca —
se un check nuovo costringe a modificarlo, il contratto è sbagliato.

**Cosa NON fa:** non scrive sul DB, non ascolta fuori da loopback, non
sorveglia le rotte dietro feature flag (`/risultati` e `/oggi` fanno
`notFound()` quando `NEXT_PUBLIC_UX_NEW != "1"`), non notifica gli ambra.

**Fasi 2 e 3** (pipeline, risultati, business, canali): sezione 9 della spec.
```

- [ ] **Step 7: Suite completa e commit**

Run: `venv/bin/python -m pytest tests/test_cc_*.py -v`
Expected: PASS su tutti i file (61 test)

```bash
git add ops/launchd/ tools/control_center/README.md
git commit -m "feat(cc): launchd per collector e server, verifica end-to-end (#BRCC-0820)"
```

---

## Self-Review

**Copertura della spec (Fase 1).** Sezione 4 architettura → Task 1, 3, 4;
contratto del check → Task 1; `unknown` distinto → Task 1 e 6; isolamento →
Task 3; TTL → Task 3; scrittura atomica → Task 4; zone della pagina → Task 10;
check piattaforma → Task 6; regola sulle rotte flag-gated → Task 6 (test
dedicato); check daemon e cron sull'artefatto → Task 7; allerta con isteresi →
Task 5; consegna → Task 8; solo loopback → Task 10 (test dedicato); sola
lettura → Task 2 (verifica manuale con CREATE TABLE respinta); nessun segreto in
output → Task 11 step 5; trappola `DATABASE_URL` → Task 2 (test dedicato).

Fuori dalla Fase 1 per progetto, come da sezione 9 della spec: `vercel_deploy`
(richiede un token), i check di pipeline, risultati, business e canali.
`vercel_deploy` è nominato nella spec fra i check di piattaforma ma richiede una
credenziale che non è in `.env`: entra in Fase 2 assieme al resto, e fino ad
allora non esiste come tile — meglio assente che verde per finta.

**Coerenza dei nomi.** `Verdict.to_dict` / `verdict_from_dict` (Task 1) usati in
Task 3 e 4. `fetch_all` (Task 2) usato in Task 6 e 7 e mockato con quel nome nei
test. `decide_alerts(prev, verdicts, now) -> (notifiche, stato)` (Task 5) chiamato
con quella firma in Task 9. `read_state`/`write_state`/`append_history`/
`build_state` (Task 4) usati in Task 9 e 10. `all_checks()` (Task 6) usato in
Task 9. `send(notifiche, env=None)` (Task 8) e il `notifier` iniettabile di
`collect` hanno la stessa firma, e i test di Task 9 la rispettano.

**Nessun placeholder.** Ogni step ha codice o comandi eseguibili; ogni criterio
di verifica è un output osservabile, non "controllare che funzioni".

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-20-betredge-control-center-fase1.md`.
