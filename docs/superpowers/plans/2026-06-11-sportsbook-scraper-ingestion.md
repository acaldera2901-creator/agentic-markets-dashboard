# Sportsbook Scraper — Piano Ingestione (Plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far affluire in modo continuo le quote pre-match di Stake e Roobet (calcio 1X2 + tennis match-winner, + over/under) nella tabella `odds_snapshots`, taggate per fonte, con marcatura della closing line — senza toccare il modello live.

**Architecture:** Un agente isolato (`SportsbookScraperAgent`) gira nello stack LaunchAgent locale. Per ogni book abilitato chiama un client dedicato (`stake_client`/`roobet_client`) che estrae e normalizza le quote, poi scrive via l'esistente `snapshot_odds_to_supabase` (tabella write-only, nessun consumer live → isolamento per costruzione). Closing line via l'esistente `mark_closing_lines`. Metodo di estrazione (API-interna vs DOM) deciso allo Step 1 (spike) e incapsulato nel client.

**Tech Stack:** Python async, httpx, BaseAgent esistente, `core/odds_api_client.py` (riuso `snapshot_odds_to_supabase`, `to_snapshot_rows`, `football_pair_key`, `mark_closing_lines`), `core/tennis_names.canonical_player_key`, browser headless solo se lo spike lo richiede. pytest con fixture registrate.

> **Scope:** Questo è il Piano 1 (ingestione). Lo shadow-eval del modello e il display edge-vs-book/CLV sono il **Piano 2**, da scrivere quando i dati si saranno accumulati (servono giorni di snapshot prima di poter confrontare). L'isolamento (`odds_snapshots` write-only) garantisce che il Piano 1 non alteri le prediction live.

---

### Task 1: Spike di estrazione — investigare e catturare fixture reali

**Files:**
- Create: `docs/superpowers/specs/2026-06-11-sportsbook-scraper-spike-findings.md`
- Create: `tests/fixtures/stake_football_sample.json`, `tests/fixtures/stake_tennis_sample.json`
- Create: `tests/fixtures/roobet_football_sample.json`, `tests/fixtures/roobet_tennis_sample.json`

Task investigativo (non TDD). Usa il browser headless (tool `mcp__claude-in-chrome__*`: `navigate`, `read_network_requests`) per aprire le sezioni calcio e tennis di Stake e Roobet.

- [ ] **Step 1: Ispeziona il traffico di rete di Stake (calcio + tennis)**

Apri le pagine sport di Stake, registra le richieste XHR/fetch/WS con `read_network_requests`. Cerca la chiamata che restituisce le quote (di solito JSON verso un endpoint `*/graphql` o `*/api/*`).

- [ ] **Step 2: Ripeti per Roobet**

Stesso procedimento sul sito Roobet.

- [ ] **Step 3: Cattura un payload reale per book×sport come fixture**

Salva il corpo JSON grezzo di una risposta odds reale in ciascun file fixture (es. `tests/fixtures/stake_football_sample.json`). Se un sito serve le quote solo via DOM (nessun JSON), salva invece l'HTML rilevante e annotalo. Questi sono i campioni reali contro cui scriveremo i parser.

- [ ] **Step 4: Scrivi il findings doc**

In `...-spike-findings.md`, per ciascun sito: endpoint URL + metodo, serve login? serve proxy/geo? formato (JSON/WS/DOM), dove stanno odds 1X2 / match-winner / over-under nel payload, nomi squadra/giocatore come appaiono (per la normalizzazione), copertura mercati osservata. Concludi con: metodo di estrazione scelto per book (API-interna httpx | DOM headless) e match-rate atteso.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-11-sportsbook-scraper-spike-findings.md tests/fixtures/stake_*.json tests/fixtures/roobet_*.json
git commit -m "spike(odds): findings estrazione Stake/Roobet + fixture reali (#SPORTSBOOK-SCRAPER-1)"
```

**CHECKPOINT:** I Task 3/4 (parser) si scrivono CONTRO queste fixture reali. Non scrivere parser prima di avere le fixture.

---

### Task 2: Modello dati comune `OddsEvent` + proiezione su riga snapshot

**Files:**
- Create: `core/sportsbook_common.py`
- Test: `tests/test_sportsbook_common.py`

Definisce la struttura normalizzata che ogni client produce e la sua proiezione sulle colonne `odds_snapshots` (riusa le chiavi pair esistenti). Indipendente dallo spike.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_sportsbook_common.py
from core.sportsbook_common import OddsEvent, event_to_snapshot_row

def test_football_event_to_snapshot_row():
    ev = OddsEvent(
        source="stake", sport="football", market="1X2",
        home="Inter", away="AC Milan", commence_time="2026-06-12T18:00:00Z",
        player1=None, player2=None,
        odds_home=2.10, odds_draw=3.40, odds_away=3.20,
        total_line=2.5, total_over=1.90, total_under=1.95,
    )
    row = event_to_snapshot_row(ev)
    assert row["source"] == "stake"
    assert row["bookmaker"] == "stake"
    assert row["market"] == "1X2"
    assert row["odds_home"] == 2.10 and row["odds_draw"] == 3.40 and row["odds_away"] == 3.20
    assert row["total_line"] == 2.5
    # team_pair_key: ricetta esistente (data:sorted(norm names))
    assert row["team_pair_key"] == "2026-06-12:ac milan|inter"
    assert row["match_id"] == "stake:football:2026-06-12:ac milan|inter"

def test_tennis_event_uses_canonical_player_keys():
    ev = OddsEvent(
        source="roobet", sport="tennis", market="match_winner",
        home=None, away=None, commence_time="2026-06-12T10:00:00Z",
        player1="Carlos Alcaraz", player2="Jannik Sinner",
        odds_home=1.80, odds_draw=None, odds_away=2.05,
        total_line=None, total_over=None, total_under=None,
    )
    row = event_to_snapshot_row(ev)
    from core.tennis_names import canonical_player_key
    expected_pair = ":".join(sorted([canonical_player_key("Carlos Alcaraz"),
                                      canonical_player_key("Jannik Sinner")]))
    assert row["team_pair_key"] == f"2026-06-12:{expected_pair}"
    assert row["odds_draw"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_sportsbook_common.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'core.sportsbook_common'`

- [ ] **Step 3: Write minimal implementation**

```python
# core/sportsbook_common.py
"""Normalized cross-book odds event + projection to the odds_snapshots row.

Every sportsbook client (stake/roobet) returns OddsEvent objects; this module
is the single place that maps them to the existing odds_snapshots column set,
reusing the SAME pair-key recipe as core/odds_api_client so Stake/Roobet rows
join to predictions exactly like The Odds API rows do.
"""
from dataclasses import dataclass

from core.odds_api_client import normalize_name
from core.tennis_names import canonical_player_key


@dataclass
class OddsEvent:
    source: str            # 'stake' | 'roobet'
    sport: str             # 'football' | 'tennis'
    market: str            # '1X2' | 'match_winner' | 'totals'
    home: str | None
    away: str | None
    commence_time: str     # ISO8601 UTC
    player1: str | None
    player2: str | None
    odds_home: float | None
    odds_draw: float | None
    odds_away: float | None
    total_line: float | None
    total_over: float | None
    total_under: float | None


def _utc_day(commence_time: str) -> str:
    # '2026-06-12T18:00:00Z' -> '2026-06-12'
    return commence_time[:10]


def _pair_key(ev: OddsEvent) -> str:
    day = _utc_day(ev.commence_time)
    if ev.sport == "tennis":
        a = canonical_player_key(ev.player1 or "")
        b = canonical_player_key(ev.player2 or "")
    else:
        a = normalize_name(ev.home or "")
        b = normalize_name(ev.away or "")
    return f"{day}:{'|'.join(sorted([a, b]))}"


def event_to_snapshot_row(ev: OddsEvent) -> dict:
    pair = _pair_key(ev)
    return {
        "match_id": f"{ev.source}:{ev.sport}:{pair}",
        "team_pair_key": pair,
        "commence_time": ev.commence_time,
        "bookmaker": ev.source,
        "source": ev.source,
        "market": ev.market,
        "odds_home": ev.odds_home,
        "odds_draw": ev.odds_draw,
        "odds_away": ev.odds_away,
        "ah_line": None, "ah_home": None, "ah_away": None, "overround": None,
        "total_line": ev.total_line,
        "total_over": ev.total_over,
        "total_under": ev.total_under,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_sportsbook_common.py -v`
Expected: PASS (entrambi i test). Se `normalize_name`/`canonical_player_key` normalizzano diversamente da quanto atteso, allinea le asserzioni del test ai valori reali (non forzare l'implementazione).

- [ ] **Step 5: Commit**

```bash
git add core/sportsbook_common.py tests/test_sportsbook_common.py
git commit -m "feat(odds): OddsEvent + proiezione su odds_snapshots (#SPORTSBOOK-SCRAPER-1)"
```

---

### Task 3: `core/stake_client.py` — fetch + parse (contro la fixture reale)

**Files:**
- Create: `core/stake_client.py`
- Test: `tests/test_stake_client.py`

Il parser si scrive CONTRO `tests/fixtures/stake_football_sample.json` catturata al Task 1. La struttura sotto assume payload JSON con lista eventi; adatta i path dei campi (`_parse_*`) ai nomi reali osservati nella fixture/findings.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_stake_client.py
import json, pathlib
from core import stake_client
from core.sportsbook_common import OddsEvent

FIX = pathlib.Path(__file__).parent / "fixtures"

def test_parse_football_fixture_returns_oddsevents():
    payload = json.loads((FIX / "stake_football_sample.json").read_text())
    events = stake_client.parse_football(payload)
    assert len(events) >= 1
    ev = events[0]
    assert isinstance(ev, OddsEvent)
    assert ev.source == "stake" and ev.sport == "football"
    assert ev.home and ev.away and ev.commence_time
    assert ev.odds_home and ev.odds_away          # 1X2 presente
    # i valori esatti vanno asseriti sui dati reali della fixture (riempire dopo Task 1)

def test_parse_handles_empty_payload():
    assert stake_client.parse_football({}) == []
    assert stake_client.parse_tennis({}) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_stake_client.py -v`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Write minimal implementation**

```python
# core/stake_client.py
"""Stake odds client. Estrazione decisa dallo spike (Task 1): se Stake espone
un endpoint JSON interno -> fetch via httpx; altrimenti DOM headless. La logica
di rete è incapsulata qui: l'arrivo dell'API ufficiale (post-contratto) richiede
di riscrivere SOLO questo file.
"""
import logging
import httpx

from core.sportsbook_common import OddsEvent

logger = logging.getLogger("StakeClient")

# URL/headers REALI dallo spike findings (Task 1). Placeholder finché lo spike
# non li fissa — il parser sotto è già testabile sulla fixture.
_FOOTBALL_URL = None  # set from spike findings
_TENNIS_URL = None
_HEADERS = {"User-Agent": "Mozilla/5.0"}


def parse_football(payload: dict) -> list[OddsEvent]:
    """Mappa il payload calcio reale -> OddsEvent. Adatta i path ai campi reali
    osservati nella fixture (Task 1)."""
    out: list[OddsEvent] = []
    for ev in payload.get("events", []):           # adatta la chiave reale
        try:
            out.append(OddsEvent(
                source="stake", sport="football", market="1X2",
                home=ev["home"], away=ev["away"],          # adatta i path reali
                commence_time=ev["startTime"],
                player1=None, player2=None,
                odds_home=_f(ev, "home"), odds_draw=_f(ev, "draw"), odds_away=_f(ev, "away"),
                total_line=None, total_over=None, total_under=None,
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return out


def parse_tennis(payload: dict) -> list[OddsEvent]:
    out: list[OddsEvent] = []
    for ev in payload.get("events", []):
        try:
            out.append(OddsEvent(
                source="stake", sport="tennis", market="match_winner",
                home=None, away=None, commence_time=ev["startTime"],
                player1=ev["p1"], player2=ev["p2"],
                odds_home=_f(ev, "p1"), odds_draw=None, odds_away=_f(ev, "p2"),
                total_line=None, total_over=None, total_under=None,
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return out


def _f(ev: dict, key: str) -> float | None:
    """Estrai la quota decimale per `key` dal dict evento. Adatta alla struttura
    reale (es. ev['markets']['1X2'][key]) dallo spike."""
    try:
        return float(ev["odds"][key])
    except (KeyError, TypeError, ValueError):
        return None


async def fetch_odds(sport: str) -> list[OddsEvent]:
    """Fetch live + parse. Ritorna [] su qualsiasi errore (mai solleva)."""
    url = _FOOTBALL_URL if sport == "football" else _TENNIS_URL
    if not url:
        logger.warning("stake %s URL non configurato (spike pending)", sport)
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=_HEADERS) as c:
            resp = await c.get(url)
            if resp.status_code != 200:
                logger.warning("stake %s HTTP %s", sport, resp.status_code)
                return []
            payload = resp.json()
    except Exception as exc:
        logger.warning("stake %s fetch error: %s", sport, exc)
        return []
    return parse_football(payload) if sport == "football" else parse_tennis(payload)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_stake_client.py -v`
Expected: PASS. Adatta i path dei campi in `parse_*`/`_f` finché il test sulla fixture reale passa, poi completa le asserzioni di valore nel test coi valori reali.

- [ ] **Step 5: Commit**

```bash
git add core/stake_client.py tests/test_stake_client.py
git commit -m "feat(odds): stake_client fetch+parse su fixture reale (#SPORTSBOOK-SCRAPER-1)"
```

---

### Task 4: `core/roobet_client.py` — fetch + parse (contro la fixture reale)

**Files:**
- Create: `core/roobet_client.py`
- Test: `tests/test_roobet_client.py`

Identico al Task 3 ma per Roobet, contro `tests/fixtures/roobet_*.json`. Stessa interfaccia (`parse_football`, `parse_tennis`, `fetch_odds`), `source="roobet"`. Ripeti la struttura del Task 3 sostituendo `stake`→`roobet` e adattando i path dei campi al payload Roobet reale (i due siti hanno formati diversi — NON assumere siano uguali).

- [ ] **Step 1:** Scrivi `tests/test_roobet_client.py` come il test del Task 3 (sost. `stake`→`roobet`).
- [ ] **Step 2:** Run `venv/bin/python -m pytest tests/test_roobet_client.py -v` → FAIL.
- [ ] **Step 3:** Scrivi `core/roobet_client.py` come `stake_client.py` (sost. `source="roobet"`, URL/headers/path Roobet dallo spike).
- [ ] **Step 4:** Run il test → PASS (adatta i path ai dati reali).
- [ ] **Step 5:** Commit:

```bash
git add core/roobet_client.py tests/test_roobet_client.py
git commit -m "feat(odds): roobet_client fetch+parse su fixture reale (#SPORTSBOOK-SCRAPER-1)"
```

---

### Task 5: Flag di configurazione (kill-switch per-book + intervalli)

**Files:**
- Modify: `config/settings.py`
- Test: `tests/test_sportsbook_settings.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_sportsbook_settings.py
from config.settings import settings

def test_sportsbook_flags_exist_with_defaults():
    # scraper sempre attivo; kill-switch PER-BOOK default ON
    assert settings.STAKE_ENABLED is True
    assert settings.ROOBET_ENABLED is True
    assert settings.SPORTSBOOK_POLL_INTERVAL >= 60
    assert settings.SPORTSBOOK_MAX_CONSECUTIVE_FAILS >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_sportsbook_settings.py -v`
Expected: FAIL — attributi inesistenti.

- [ ] **Step 3: Write minimal implementation**

In `config/settings.py`, dentro la classe `Settings` (segui lo stile pydantic-settings esistente, stesso pattern degli altri flag bool/int):

```python
    # #SPORTSBOOK-SCRAPER-1: scraper sempre attivo; kill-switch per-book (default ON)
    STAKE_ENABLED: bool = True
    ROOBET_ENABLED: bool = True
    SPORTSBOOK_POLL_INTERVAL: int = 300          # sec tra refresh pre-match
    SPORTSBOOK_MAX_CONSECUTIVE_FAILS: int = 5     # auto-disable book dopo N fail
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_sportsbook_settings.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add config/settings.py tests/test_sportsbook_settings.py
git commit -m "feat(odds): flag kill-switch per-book + intervalli scraper (#SPORTSBOOK-SCRAPER-1)"
```

---

### Task 6: `agents/sportsbook_scraper.py` — agente loop + kill-switch + auto-disable

**Files:**
- Create: `agents/sportsbook_scraper.py`
- Test: `tests/test_sportsbook_scraper.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_sportsbook_scraper.py
import logging
from unittest.mock import AsyncMock, patch
import pytest

from agents.sportsbook_scraper import SportsbookScraperAgent
from core.sportsbook_common import OddsEvent


def _agent():
    a = SportsbookScraperAgent.__new__(SportsbookScraperAgent)
    a.logger = logging.getLogger("test")
    a._fail_counts = {"stake": 0, "roobet": 0}
    return a


def _ev(src):
    return OddsEvent(source=src, sport="football", market="1X2",
                     home="A", away="B", commence_time="2026-06-12T18:00:00Z",
                     player1=None, player2=None, odds_home=2.0, odds_draw=3.0,
                     odds_away=3.5, total_line=None, total_over=None, total_under=None)


@pytest.mark.asyncio
async def test_disabled_book_is_skipped():
    agent = _agent()
    with patch("agents.sportsbook_scraper.settings") as s, \
         patch("agents.sportsbook_scraper.stake_client") as stake, \
         patch("agents.sportsbook_scraper.snapshot_odds_to_supabase", new=AsyncMock()) as snap:
        s.STAKE_ENABLED = False; s.ROOBET_ENABLED = False
        s.SPORTSBOOK_MAX_CONSECUTIVE_FAILS = 5
        await agent._scrape_once()
        stake.fetch_odds.assert_not_called()
        snap.assert_not_called()


@pytest.mark.asyncio
async def test_enabled_book_writes_snapshot_rows():
    agent = _agent()
    with patch("agents.sportsbook_scraper.settings") as s, \
         patch("agents.sportsbook_scraper.stake_client") as stake, \
         patch("agents.sportsbook_scraper.roobet_client") as roobet, \
         patch("agents.sportsbook_scraper.snapshot_odds_to_supabase", new=AsyncMock()) as snap:
        s.STAKE_ENABLED = True; s.ROOBET_ENABLED = False
        s.SPORTSBOOK_MAX_CONSECUTIVE_FAILS = 5
        stake.fetch_odds = AsyncMock(side_effect=lambda sport: [_ev("stake")])
        await agent._scrape_once()
        # ha scritto righe proiettate (calcio+tennis) per stake
        assert snap.await_count >= 1
        rows = snap.await_args.args[0]
        assert rows and rows[0]["source"] == "stake"


@pytest.mark.asyncio
async def test_auto_disable_after_consecutive_fails():
    agent = _agent()
    with patch("agents.sportsbook_scraper.settings") as s, \
         patch("agents.sportsbook_scraper.stake_client") as stake, \
         patch("agents.sportsbook_scraper.roobet_client"), \
         patch("agents.sportsbook_scraper.snapshot_odds_to_supabase", new=AsyncMock()):
        s.STAKE_ENABLED = True; s.ROOBET_ENABLED = False
        s.SPORTSBOOK_MAX_CONSECUTIVE_FAILS = 2
        stake.fetch_odds = AsyncMock(side_effect=RuntimeError("blocked"))
        await agent._scrape_once()   # fail 1
        await agent._scrape_once()   # fail 2 -> raggiunge soglia
        assert agent._book_disabled("stake") is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_sportsbook_scraper.py -v`
Expected: FAIL — modulo/agente inesistente.

- [ ] **Step 3: Write minimal implementation**

```python
# agents/sportsbook_scraper.py
"""SportsbookScraperAgent — raccoglie quote pre-match Stake/Roobet in
odds_snapshots (source-tagged). Tabella write-only: nessun consumer live la
rilegge, quindi l'agente NON altera il modello (#SPORTSBOOK-SCRAPER-1, Plan 1).

Sempre attivo; kill-switch per-book (STAKE_ENABLED/ROOBET_ENABLED). Auto-disable
runtime di un book dopo N fetch falliti consecutivi (segnale di ban) + log.
"""
import asyncio

from agents.base import BaseAgent
from config.settings import settings
from core import stake_client, roobet_client
from core.odds_api_client import snapshot_odds_to_supabase, mark_closing_lines
from core.sportsbook_common import event_to_snapshot_row

SPORTS = ("football", "tennis")
_CLIENTS = {"stake": stake_client, "roobet": roobet_client}


class SportsbookScraperAgent(BaseAgent):
    def __init__(self):
        super().__init__("SportsbookScraperAgent")
        self._fail_counts = {"stake": 0, "roobet": 0}

    async def _main_loop(self):
        while self._running:
            await self._scrape_once()
            await mark_closing_lines()
            await asyncio.sleep(settings.SPORTSBOOK_POLL_INTERVAL)

    def _book_enabled(self, book: str) -> bool:
        flag = settings.STAKE_ENABLED if book == "stake" else settings.ROOBET_ENABLED
        return bool(flag) and not self._book_disabled(book)

    def _book_disabled(self, book: str) -> bool:
        return self._fail_counts.get(book, 0) >= settings.SPORTSBOOK_MAX_CONSECUTIVE_FAILS

    async def _scrape_once(self):
        for book, client in _CLIENTS.items():
            if not self._book_enabled(book):
                continue
            try:
                rows = []
                for sport in SPORTS:
                    events = await client.fetch_odds(sport)
                    rows.extend(event_to_snapshot_row(ev) for ev in events)
                self._fail_counts[book] = 0
                if rows:
                    await snapshot_odds_to_supabase(rows)
                    self.logger.info("[SCRAPER] %s: %d righe scritte", book, len(rows))
            except Exception as exc:
                self._fail_counts[book] += 1
                self.logger.warning("[SCRAPER] %s fetch fallito (%d/%d): %s",
                                    book, self._fail_counts[book],
                                    settings.SPORTSBOOK_MAX_CONSECUTIVE_FAILS, exc)
                if self._book_disabled(book):
                    self.logger.error("[SCRAPER] %s AUTO-DISABLED dopo %d fail consecutivi "
                                      "(probabile ban) — riavvio o fix manuale richiesto", book,
                                      self._fail_counts[book])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_sportsbook_scraper.py -v`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add agents/sportsbook_scraper.py tests/test_sportsbook_scraper.py
git commit -m "feat(odds): SportsbookScraperAgent loop + kill-switch + auto-disable (#SPORTSBOOK-SCRAPER-1)"
```

---

### Task 7: Registrazione agente in `run.py` + test di isolamento

**Files:**
- Modify: `run.py` (import + lista `agents`)
- Test: `tests/test_sportsbook_isolation.py`

- [ ] **Step 1: Write the failing test (isolamento)**

```python
# tests/test_sportsbook_isolation.py
import ast, pathlib

def test_scraper_only_writes_odds_snapshots_not_predictions():
    """Isolamento Plan 1: l'agente scrive SOLO su odds_snapshots (write-only sink),
    mai su unified_predictions / prediction_log / tennis_predictions."""
    src = pathlib.Path("agents/sportsbook_scraper.py").read_text()
    for forbidden in ("unified_predictions", "prediction_log", "tennis_predictions",
                      "settle_unified", "blend_with_market", "blend_tennis"):
        assert forbidden not in src, f"scraper non deve toccare {forbidden}"

def test_scraper_registered_in_run():
    src = pathlib.Path("run.py").read_text()
    assert "SportsbookScraperAgent" in src
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/bin/python -m pytest tests/test_sportsbook_isolation.py -v`
Expected: FAIL su `test_scraper_registered_in_run` (non ancora in run.py).

- [ ] **Step 3: Modifica `run.py`**

Aggiungi l'import accanto agli altri agenti:

```python
from agents.sportsbook_scraper import SportsbookScraperAgent
```

E aggiungi `SportsbookScraperAgent(),` alla lista `agents = [ ... ]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/bin/python -m pytest tests/test_sportsbook_isolation.py -v`
Expected: PASS (entrambi)

- [ ] **Step 5: Commit**

```bash
git add run.py tests/test_sportsbook_isolation.py
git commit -m "feat(odds): registra SportsbookScraperAgent + test isolamento (#SPORTSBOOK-SCRAPER-1)"
```

---

### Task 8: Verifica colonna `source` su odds_snapshots (migration solo se vincolata)

**Files:**
- (condizionale) Create: `supabase/migrations/<ts>_odds_snapshots_source_sportsbook.sql`

- [ ] **Step 1: Verifica che `source` accetti 'stake'/'roobet'**

Query (via Supabase MCP o psql) per eventuale CHECK constraint su `odds_snapshots.source`:

```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='odds_snapshots'::regclass AND contype='c';
```

- [ ] **Step 2: Decidi**

Se NESSUN constraint limita `source` (free text) → nessuna migration necessaria; salta al commit del findings nel diario. Se un CHECK elenca valori ammessi e 'stake'/'roobet' mancano → crea la migration additiva:

```sql
-- <ts>_odds_snapshots_source_sportsbook.sql
ALTER TABLE odds_snapshots DROP CONSTRAINT IF EXISTS <nome_constraint>;
ALTER TABLE odds_snapshots ADD CONSTRAINT <nome_constraint>
  CHECK (source = ANY(ARRAY[<valori_esistenti>, 'stake', 'roobet']));
```

- [ ] **Step 3: Applica (solo se migration creata) + commit**

Applica con APPROVE DB-change (additivo, reversibile), poi:

```bash
git add supabase/migrations/*_odds_snapshots_source_sportsbook.sql
git commit -m "chore(odds): consenti source stake/roobet su odds_snapshots (#SPORTSBOOK-SCRAPER-1)"
```

---

## Verifica finale del Piano 1 (dopo tutti i task)
- `venv/bin/python -m pytest tests/ -k "sportsbook or stake or roobet" -v` → tutti verdi.
- Avvio agente in locale (o restart LaunchAgent) → log `[SCRAPER] stake/roobet: N righe scritte`, nessun errore.
- Query `odds_snapshots WHERE source IN ('stake','roobet')` → righe presenti con `team_pair_key` valorizzato; match-rate vs `unified_predictions` calcolato e loggato nel diario.
- Conferma isolamento: le prediction live (`/api/v2/predictions`) invariate (le righe nuove sono in una tabella write-only).

## Handoff → Piano 2 (NON in questo piano)
Quando ci sono ≥ qualche giorno di snapshot Stake/Roobet: scrivere il Piano 2 — shadow-eval (blend con-vs-senza, confronto Brier/CLV/edge realizzato + gate di promozione) e display edge-vs-book/CLV.
