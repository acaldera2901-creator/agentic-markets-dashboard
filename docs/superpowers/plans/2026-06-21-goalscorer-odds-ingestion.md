# Goalscorer Odds Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Ingerire le quote anytime-goalscorer da The Odds API in una tabella `player_odds`, league-agnostic (World Cup live ora, top-5 ad agosto), verificato contro una risposta API reale.

**Architecture:** Client fail-soft per The Odds API (`/events` gratis + `/events/{id}/odds` 1 credit) → normalizzatore puro testato sul fixture reale → collector quota-aware con resolver match/player → writer idempotente Supabase (PATCH-then-POST). Tabella additiva, migration GATED.

**Tech Stack:** Python async (httpx, asyncio), pytest (asyncio_mode=auto), Supabase REST.

## Global Constraints
- **DB GATED**: la migration `player_odds` scrive sul Supabase condiviso → solo file creato in locale; NO `db push`/`apply_migration` senza APPROVE umano.
- **Fail-soft**: client e collector non sollevano mai; ritornano `{}`/summary con `errors[]`.
- **Quota-aware**: `/events` non consuma quota; `/events/{id}/odds` = 1 credit con dati, 0 senza; collector salta eventi fuori finestra pre-match.
- **Shape API verificata** (fixture `tests/fixtures/odds_api_goalscorer_wc.json`): top-level `{id, sport_key, sport_title, commence_time, home_team, away_team, bookmakers:[{key,title,markets:[{key,last_update,outcomes:[{name,description,price}]}]}]}`. Mercato key = `player_goal_scorer_anytime`; outcome rilevante = `name=="Yes"`, `description`=nome giocatore, `price`=decimale.
- **Regione** `us`; **mercato** `player_goal_scorer_anytime` only.
- **Settings**: `config.settings.settings.ODDS_API_KEY`. Writer via `core.supabase_client._rest_base/_service_headers`.
- **Venv**: `~/Desktop/agentic-markets/venv/bin/python -m pytest`.
- **No riga orfana**: una riga senza `match_id` risolto viene saltata (non scritta).
- **implied_prob = 1/price** (include vig; documentare).

## File Structure
- `core/odds_api_goalscorer.py` (NEW) — client.
- `core/goalscorer_odds_normalize.py` (NEW) — dataclass + parser puro.
- `core/goalscorer_odds_collector.py` (NEW) — orchestratore.
- `core/player_data_writers.py` (MODIFY) — aggiunge `upsert_player_odds`.
- `supabase/migrations/20260621100000_player_odds.sql` (NEW, GATED).
- tests: `tests/test_odds_api_goalscorer.py`, `tests/test_goalscorer_odds_normalize.py`, `tests/test_goalscorer_odds_collector.py` (NEW). Fixture già presente.

---

### Task 1: Client The Odds API goalscorer

**Files:** Create `core/odds_api_goalscorer.py`; Test `tests/test_odds_api_goalscorer.py`

**Interfaces — Produces:**
- `async def get_events(sport_key: str) -> list[dict]` — `GET /v4/sports/{sport_key}/events`; fail-soft `[]`.
- `async def get_event_goalscorer_odds(sport_key: str, event_id: str, region: str = "us") -> dict` — `GET /v4/sports/{sport_key}/events/{event_id}/odds?regions={region}&markets=player_goal_scorer_anytime&oddsFormat=decimal`; fail-soft `{}`.
- Reads `settings.ODDS_API_KEY`; returns empty when key missing.

- [ ] **Step 1: Write the failing test**
```python
# tests/test_odds_api_goalscorer.py
import httpx, pytest
from core import odds_api_goalscorer as g

class _Resp:
    def __init__(self, payload, status=200): self._p, self.status_code = payload, status
    def json(self): return self._p

@pytest.fixture(autouse=True)
def _key(monkeypatch): monkeypatch.setattr(g.settings, "ODDS_API_KEY", "k"*20)

async def test_get_events_returns_list(monkeypatch):
    async def fake_get(self, url, **kw): return _Resp([{"id":"e1","home_team":"Spain","away_team":"Saudi Arabia"}])
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    out = await g.get_events("soccer_fifa_world_cup")
    assert out[0]["id"] == "e1"

async def test_get_event_odds_returns_dict(monkeypatch):
    async def fake_get(self, url, **kw): return _Resp({"id":"e1","bookmakers":[]})
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    out = await g.get_event_goalscorer_odds("soccer_fifa_world_cup", "e1")
    assert out["id"] == "e1"

async def test_fail_soft_without_key(monkeypatch):
    monkeypatch.setattr(g.settings, "ODDS_API_KEY", "")
    assert await g.get_events("x") == []
    assert await g.get_event_goalscorer_odds("x","e") == {}

async def test_fail_soft_on_non_200(monkeypatch):
    async def fake_get(self, url, **kw): return _Resp({"message":"err"}, status=429)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    assert await g.get_events("x") == []
    assert await g.get_event_goalscorer_odds("x","e") == {}
```

- [ ] **Step 2: Run, verify fail** — `pytest tests/test_odds_api_goalscorer.py -v` → ModuleNotFoundError.

- [ ] **Step 3: Implement**
```python
# core/odds_api_goalscorer.py
"""Client The Odds API per le quote anytime-goalscorer. Fail-soft."""
from __future__ import annotations
import httpx
from config.settings import settings

_BASE = "https://api.the-odds-api.com/v4"
_MARKET = "player_goal_scorer_anytime"


async def get_events(sport_key: str) -> list[dict]:
    """Lista eventi (NON consuma quota). Fail-soft -> []."""
    if not settings.ODDS_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.get(f"{_BASE}/sports/{sport_key}/events",
                            params={"apiKey": settings.ODDS_API_KEY})
            if r.status_code != 200:
                return []
            data = r.json()
            return data if isinstance(data, list) else []
    except Exception:
        return []


async def get_event_goalscorer_odds(sport_key: str, event_id: str, region: str = "us") -> dict:
    """Quote anytime-goalscorer per un evento (1 credit con dati). Fail-soft -> {}."""
    if not settings.ODDS_API_KEY:
        return {}
    try:
        async with httpx.AsyncClient(timeout=25.0) as c:
            r = await c.get(
                f"{_BASE}/sports/{sport_key}/events/{event_id}/odds",
                params={"apiKey": settings.ODDS_API_KEY, "regions": region,
                        "markets": _MARKET, "oddsFormat": "decimal"},
            )
            if r.status_code != 200:
                return {}
            data = r.json()
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}
```

- [ ] **Step 4: Run, verify pass** — `pytest tests/test_odds_api_goalscorer.py -v` → 4 pass.
- [ ] **Step 5: Commit** — `git add core/odds_api_goalscorer.py tests/test_odds_api_goalscorer.py && git commit -m "feat(player-odds): client The Odds API anytime-goalscorer"`

---

### Task 2: Normalizzatore puro (test sul fixture reale)

**Files:** Create `core/goalscorer_odds_normalize.py`; Test `tests/test_goalscorer_odds_normalize.py` (usa `tests/fixtures/odds_api_goalscorer_wc.json`)

**Interfaces — Produces:**
- `@dataclass PlayerOddRow(match_id, sport_key, event_id, player_id, player_name, market, bookmaker, region, price, implied_prob)` (`player_id` riempito dal collector → default None).
- `parse_event_odds(event_json: dict, match_id: str, sport_key: str, region: str = "us") -> list[PlayerOddRow]` — appiattisce bookmakers→markets(key==player_goal_scorer_anytime)→outcomes(name=="Yes"); `implied_prob=1/price`; salta `price<=1.0`; `market="anytime_goalscorer"`.

- [ ] **Step 1: Write the failing test**
```python
# tests/test_goalscorer_odds_normalize.py
import json, pathlib
from core.goalscorer_odds_normalize import parse_event_odds, PlayerOddRow

FIX = json.loads((pathlib.Path(__file__).parent / "fixtures" / "odds_api_goalscorer_wc.json").read_text())

def test_parses_real_fixture():
    rows = parse_event_odds(FIX, match_id="wc:spain-ksa", sport_key="soccer_fifa_world_cup")
    assert rows, "deve estrarre righe dal fixture reale"
    # 5 book x 17 giocatori (alcuni book possono variare) -> almeno > 17
    assert len(rows) > 17
    books = {r.bookmaker for r in rows}
    assert {"fanduel", "draftkings"} <= books
    r0 = rows[0]
    assert r0.market == "anytime_goalscorer"
    assert r0.match_id == "wc:spain-ksa"
    assert r0.player_id is None
    assert r0.price > 1.0
    assert abs(r0.implied_prob - 1.0 / r0.price) < 1e-9
    assert all(r.player_name for r in rows)  # description -> player_name sempre presente

def test_skips_non_yes_and_bad_price():
    ev = {"id":"e","bookmakers":[{"key":"bk","markets":[{"key":"player_goal_scorer_anytime","outcomes":[
        {"name":"Yes","description":"Good","price":2.0},
        {"name":"No","description":"Ignored","price":1.5},
        {"name":"Yes","description":"BadPrice","price":1.0},
    ]}]}]}
    rows = parse_event_odds(ev, match_id="m", sport_key="s")
    names = {r.player_name for r in rows}
    assert names == {"Good"}

def test_empty_bookmakers_yields_no_rows():
    assert parse_event_odds({"id":"e","bookmakers":[]}, match_id="m", sport_key="s") == []
```

- [ ] **Step 2: Run, verify fail** — ModuleNotFoundError.

- [ ] **Step 3: Implement**
```python
# core/goalscorer_odds_normalize.py
"""Parser puro delle quote anytime-goalscorer The Odds API."""
from __future__ import annotations
from dataclasses import dataclass

_MARKET_SRC = "player_goal_scorer_anytime"
_MARKET_OUT = "anytime_goalscorer"


@dataclass(frozen=True)
class PlayerOddRow:
    match_id: str
    sport_key: str
    event_id: str
    player_id: str | None
    player_name: str
    market: str
    bookmaker: str
    region: str
    price: float
    implied_prob: float


def parse_event_odds(event_json: dict, match_id: str, sport_key: str, region: str = "us") -> list[PlayerOddRow]:
    out: list[PlayerOddRow] = []
    event_id = event_json.get("id", "")
    for book in event_json.get("bookmakers") or []:
        bk = book.get("key", "")
        for market in book.get("markets") or []:
            if market.get("key") != _MARKET_SRC:
                continue
            for o in market.get("outcomes") or []:
                if o.get("name") != "Yes":
                    continue
                name = (o.get("description") or "").strip()
                price = o.get("price")
                if not name or not isinstance(price, (int, float)) or price <= 1.0:
                    continue
                out.append(PlayerOddRow(
                    match_id=match_id, sport_key=sport_key, event_id=event_id,
                    player_id=None, player_name=name, market=_MARKET_OUT,
                    bookmaker=bk, region=region, price=float(price),
                    implied_prob=1.0 / float(price),
                ))
    return out
```

- [ ] **Step 4: Run, verify pass** — 3 pass.
- [ ] **Step 5: Commit** — `git add core/goalscorer_odds_normalize.py tests/test_goalscorer_odds_normalize.py && git commit -m "feat(player-odds): normalizzatore quote testato su fixture reale"`

---

### Task 3: Migration `player_odds` [GATED] + writer

**Files:** Create `supabase/migrations/20260621100000_player_odds.sql`; Modify `core/player_data_writers.py`; Test `tests/test_player_data_writers.py` (append)

> **[GATED]** Solo creazione file migration. NO db push/apply senza APPROVE.

- [ ] **Step 1: Migration file**
```sql
-- supabase/migrations/20260621100000_player_odds.sql
-- Quote anytime-goalscorer (sotto-progetto B-odds, 2026-06-21). Additivo.
CREATE TABLE IF NOT EXISTS public.player_odds (
  id BIGSERIAL PRIMARY KEY,
  match_id VARCHAR,
  sport_key VARCHAR,
  event_id VARCHAR NOT NULL,
  player_id VARCHAR,
  player_name VARCHAR NOT NULL,
  market VARCHAR NOT NULL DEFAULT 'anytime_goalscorer',
  bookmaker VARCHAR NOT NULL,
  region VARCHAR NOT NULL DEFAULT 'us',
  price FLOAT,
  implied_prob FLOAT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  is_closing BOOLEAN DEFAULT false,
  UNIQUE(event_id, bookmaker, player_name, market)
);
CREATE INDEX IF NOT EXISTS idx_player_odds_match ON public.player_odds(match_id);
CREATE INDEX IF NOT EXISTS idx_player_odds_event ON public.player_odds(event_id);

-- Rollback:
-- DROP TABLE IF EXISTS public.player_odds;
```

- [ ] **Step 2: Verify text** — `python -c "import pathlib; s=pathlib.Path('supabase/migrations/20260621100000_player_odds.sql').read_text(); assert 'CREATE TABLE IF NOT EXISTS public.player_odds' in s and 'Rollback' in s and 'UNIQUE(event_id, bookmaker, player_name, market)' in s; print('ok')"`

- [ ] **Step 3: Write the failing writer test (append to tests/test_player_data_writers.py)**
```python
def _odd(name="Good"):
    from core.goalscorer_odds_normalize import PlayerOddRow
    return PlayerOddRow(match_id="m", sport_key="s", event_id="e", player_id=None,
                        player_name=name, market="anytime_goalscorer", bookmaker="bk",
                        region="us", price=2.0, implied_prob=0.5)

async def test_upsert_player_odds_post_when_patch_empty(monkeypatch):
    async def fake_patch(self, url, **kw): return _Resp(200, [])
    async def fake_post(self, url, **kw): return _Resp(201)
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    assert await w.upsert_player_odds([_odd()]) == 1

async def test_upsert_player_odds_skip_when_db_unconfigured(monkeypatch):
    monkeypatch.setattr(w, "_rest_base", lambda: None)
    assert await w.upsert_player_odds([_odd()]) == 0
```
(NB: `_Resp`, `w`, `httpx` già importati nel file da Task 5 di A.)

- [ ] **Step 4: Run, verify fail** — AttributeError upsert_player_odds.

- [ ] **Step 5: Implement writer (append to core/player_data_writers.py)**
```python
from core.goalscorer_odds_normalize import PlayerOddRow


async def upsert_player_odds(rows: list[PlayerOddRow]) -> int:
    return await _upsert(
        "player_odds",
        [asdict(r) for r in rows],
        lambda r: (f"event_id=eq.{r['event_id']}&bookmaker=eq.{r['bookmaker']}"
                   f"&player_name=eq.{r['player_name']}&market=eq.{r['market']}"),
    )
```
(NB: `asdict` già importato da Task 5 di A. La query usa la dedup key composta; i nomi con spazi sono gestiti da httpx via url-encoding dei params? No — qui è in query string manuale: usa `httpx`'s param non disponibile in `_upsert`. Se `_upsert` costruisce l'URL come `f"{base}/{table}?{q}"`, allora i nomi con spazi DEVONO essere url-encoded. Vedi Step 5b.)

- [ ] **Step 5b: Url-encode i valori nella match-params (importante per nomi giocatore con spazi)**
Verifica come `_upsert` costruisce l'URL. Se concatena `?{q}` grezzo, i nomi tipo "Lamine Yamal" rompono la query. Aggiorna SOLO la lambda di `upsert_player_odds` per url-encodare i valori:
```python
from urllib.parse import quote


async def upsert_player_odds(rows: list[PlayerOddRow]) -> int:
    def params(r):
        ev = quote(str(r["event_id"]), safe="")
        bk = quote(str(r["bookmaker"]), safe="")
        pn = quote(str(r["player_name"]), safe="")
        mk = quote(str(r["market"]), safe="")
        return f"event_id=eq.{ev}&bookmaker=eq.{bk}&player_name=eq.{pn}&market=eq.{mk}"
    return await _upsert("player_odds", [asdict(r) for r in rows], params)
```
Aggiungi un test che il nome con spazio non rompe (la match-params contiene `%20`):
```python
def test_upsert_player_odds_urlencodes_spaces(monkeypatch):
    captured = {}
    async def fake_patch(self, url, **kw):
        captured["url"] = url; return _Resp(200, [{"x":1}])
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    import asyncio
    asyncio.get_event_loop().run_until_complete(w.upsert_player_odds([_odd(name="Lamine Yamal")]))
    assert "Lamine%20Yamal" in captured["url"]
```
(Se preferisci, struttura il test come gli altri async del file con `await`; l'importante è asserire l'url-encoding.)

- [ ] **Step 6: Run, verify pass** — i nuovi test passano.
- [ ] **Step 7: Commit** — `git add supabase/migrations/20260621100000_player_odds.sql core/player_data_writers.py tests/test_player_data_writers.py && git commit -m "feat(player-odds): tabella player_odds [GATED] + writer upsert_player_odds (url-encoded)"`

---

### Task 4: Collector quota-aware

**Files:** Create `core/goalscorer_odds_collector.py`; Test `tests/test_goalscorer_odds_collector.py`

**Interfaces — Consumes:** `get_events`, `get_event_goalscorer_odds` (Task 1), `parse_event_odds` (Task 2), `upsert_player_odds` (Task 3).
**Produces:**
- `async def collect_goalscorer_odds(sport_keys, match_resolver, player_resolver=None, within_hours=48) -> dict`
  - `match_resolver(event: dict) -> str | None` (risolve match_id da home/away/commence; None = salta evento, no riga orfana).
  - `player_resolver(name: str) -> str | None` (opzionale; None default → player_id resta None, fail-open).
  - quota-aware: salta eventi con `commence_time` oltre `within_hours` o nel passato.
  - fail-soft per evento; ritorna `{"events": int, "rows_written": int, "errors": [...]}`.
  - NB: il collector riceve `today_iso`/`now_iso`? No — per testabilità senza orologio, accetta `now_iso: str` esplicito (no Date.now nei test). Firma: `collect_goalscorer_odds(sport_keys, match_resolver, now_iso, player_resolver=None, within_hours=48)`.

- [ ] **Step 1: Write the failing test**
```python
# tests/test_goalscorer_odds_collector.py
import json, pathlib, pytest
from core import goalscorer_odds_collector as col

FIX = json.loads((pathlib.Path(__file__).parent / "fixtures" / "odds_api_goalscorer_wc.json").read_text())

async def test_collect_writes_rows_and_resolves_ids(monkeypatch):
    async def fake_events(sport): return [{"id": FIX["id"], "home_team": "Spain",
                                          "away_team": "Saudi Arabia", "commence_time": FIX["commence_time"]}]
    async def fake_odds(sport, eid, region="us"): return FIX
    captured = {}
    async def fake_upsert(rows): captured["rows"] = rows; return len(rows)
    monkeypatch.setattr(col, "get_events", fake_events)
    monkeypatch.setattr(col, "get_event_goalscorer_odds", fake_odds)
    monkeypatch.setattr(col, "upsert_player_odds", fake_upsert)
    summary = await col.collect_goalscorer_odds(
        ["soccer_fifa_world_cup"],
        match_resolver=lambda e: "wc:spain-ksa",
        now_iso="2026-06-21T00:00:00Z",
        player_resolver=lambda n: "P_"+n[:3],
    )
    assert summary["events"] == 1
    assert summary["rows_written"] > 17
    assert captured["rows"][0].match_id == "wc:spain-ksa"
    assert captured["rows"][0].player_id is not None  # resolver applicato

async def test_collect_skips_unresolved_match(monkeypatch):
    async def fake_events(sport): return [{"id":"e","home_team":"A","away_team":"B","commence_time":"2026-06-21T12:00:00Z"}]
    async def fake_odds(sport, eid, region="us"): return FIX
    async def fake_upsert(rows): return len(rows)
    monkeypatch.setattr(col, "get_events", fake_events)
    monkeypatch.setattr(col, "get_event_goalscorer_odds", fake_odds)
    monkeypatch.setattr(col, "upsert_player_odds", fake_upsert)
    summary = await col.collect_goalscorer_odds(["s"], match_resolver=lambda e: None,
                                                now_iso="2026-06-21T00:00:00Z")
    assert summary["events"] == 0 and summary["rows_written"] == 0

async def test_collect_skips_out_of_window(monkeypatch):
    async def fake_events(sport): return [{"id":"e","home_team":"A","away_team":"B","commence_time":"2026-12-31T12:00:00Z"}]
    async def fake_odds(sport, eid, region="us"): raise AssertionError("non deve chiamare odds fuori finestra")
    monkeypatch.setattr(col, "get_events", fake_events)
    monkeypatch.setattr(col, "get_event_goalscorer_odds", fake_odds)
    monkeypatch.setattr(col, "upsert_player_odds", lambda rows: len(rows))
    summary = await col.collect_goalscorer_odds(["s"], match_resolver=lambda e: "m",
                                                now_iso="2026-06-21T00:00:00Z", within_hours=48)
    assert summary["events"] == 0
```

- [ ] **Step 2: Run, verify fail** — ModuleNotFoundError.

- [ ] **Step 3: Implement**
```python
# core/goalscorer_odds_collector.py
"""Collector quota-aware delle quote anytime-goalscorer. Fail-soft."""
from __future__ import annotations
from datetime import datetime

from core.odds_api_goalscorer import get_events, get_event_goalscorer_odds
from core.goalscorer_odds_normalize import parse_event_odds
from core.player_data_writers import upsert_player_odds


def _parse_iso(s: str) -> datetime | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


async def collect_goalscorer_odds(sport_keys, match_resolver, now_iso: str,
                                  player_resolver=None, within_hours: int = 48) -> dict:
    summary = {"events": 0, "rows_written": 0, "errors": []}
    now = _parse_iso(now_iso)
    for sport in sport_keys:
        try:
            events = await get_events(sport)
        except Exception as exc:
            summary["errors"].append(f"{sport}:events:{exc}")
            continue
        for ev in events:
            try:
                start = _parse_iso(ev.get("commence_time", ""))
                if now and start:
                    delta_h = (start - now).total_seconds() / 3600.0
                    if delta_h < 0 or delta_h > within_hours:
                        continue  # fuori finestra pre-match
                match_id = match_resolver(ev)
                if not match_id:
                    continue  # no riga orfana
                raw = await get_event_goalscorer_odds(sport, ev["id"])
                rows = parse_event_odds(raw, match_id=match_id, sport_key=sport)
                if player_resolver:
                    rows = [PlayerOddRow_with_id(r, player_resolver(r.player_name)) for r in rows]
                if rows:
                    summary["rows_written"] += await upsert_player_odds(rows)
                    summary["events"] += 1
            except Exception as exc:
                summary["errors"].append(f"{sport}:{ev.get('id')}:{exc}")
    return summary
```
NB: `PlayerOddRow` è frozen → per applicare `player_id` crea una copia. Aggiungi in cima al file:
```python
import dataclasses
from core.goalscorer_odds_normalize import PlayerOddRow

def PlayerOddRow_with_id(row: PlayerOddRow, player_id):
    return dataclasses.replace(row, player_id=player_id)
```

- [ ] **Step 4: Run, verify pass** — 3 pass.
- [ ] **Step 5: Commit** — `git add core/goalscorer_odds_collector.py tests/test_goalscorer_odds_collector.py && git commit -m "feat(player-odds): collector quota-aware con resolver match/player"`

---

## Self-Review (eseguita)
- Copertura spec: client (T1), normalizzatore su fixture reale (T2), schema+writer url-encoded (T3), collector quota-aware+resolver+no-orfani (T4). ✓
- Shape verificata: i test T2/T4 girano sul fixture reale catturato dall'API. ✓
- GATED: migration solo file (T3). ✓
- Fail-soft end-to-end; no riga orfana (match_resolver None → skip). ✓
- Url-encoding nomi con spazi (T3 step 5b) — rischio reale dato i nomi giocatore. ✓
- Type consistency: `PlayerOddRow` definito T2, consumato T3/T4 con stesse firme; `get_events/get_event_goalscorer_odds` firme coerenti T1→T4. ✓

## Fuori scope (→ B-model / B-card)
λ squadra, λ giocatore, P(anytime), Edge, de-vig, card UI + redirect, mercati non-anytime.
