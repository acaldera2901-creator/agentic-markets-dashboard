# Integrazione OddsPapi (quote tennis) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere OddsPapi come 2ª sorgente quote tennis (solo match non coperti da The Odds API), così le card tennis mostrano Market % ed Edge reali, restando nel free tier.

**Architecture:** Nuovo client `core/tennis_oddspapi_client.py` che produce righe quote nella STESSA shape di `parse_tennis_odds_events` (player1/player2/scheduled_at/odds_p1/odds_p2/bookmaker/odds_event_id), così si riusa `merge_tennis_odds`. Il collector tennis, dopo il merge The Odds API, per i match ancora scoperti e vicini al kickoff chiama OddsPapi con policy **fetch-once-on-success + retry cap** (consumo nel free). Fail-soft ovunque, niente migration.

**Tech Stack:** Python async (httpx), pytest, pipeline agenti esistente.

## Global Constraints

- **Solo tennis non coperto:** OddsPapi viene chiamato SOLO per fixture nostri **senza `odds_p1/p2`** dopo il merge The Odds API (The Odds API resta anchor primario).
- **Policy consumo (free 250/mese):** per ogni match scoperto, chiama `/odds` SOLO se kickoff entro `NEAR_KICKOFF_HOURS=6` e nel futuro. **Marca "completato" solo quando ottieni odds reali**; se `/odds` torna vuoto (succede: `hasOdds` di `/fixtures` è inaffidabile, le quote escono vicino al match), **ritenta** nei cicli successivi fino a `MAX_ODDSPAPI_ATTEMPTS=3`, poi smetti. Stato in **set in-process** (no schema/migration).
- **Anchor Pinnacle:** in `/odds`, market match-winner, prezzo da **Pinnacle**; se assente, miglior 2-way; se nessun 2-way → scarta quel match.
- **Matching:** per nome normalizzato (`canonical_player_key` da `core/tennis_names.py`) + giorno, riusando `_pair_key` di `core/tennis_odds_api_client.py`. OddsPapi dà i nomi in `/fixtures` (`participant1Name`/`participant2Name`, formato "Cognome, Nome").
- **Config:** `ODDSPAPI_KEY` da env; se assente → client no-op (log una volta, nessun crash), tennis invariato.
- **Fail-soft:** ogni errore/timeout/HTTP≠200/403/429 → ritorna vuoto/None, mai eccezioni che bloccano il collector, mai quote inventate.
- **Non toccare:** schema DB (colonne `odds_p1/p2/odds_provider/odds_bookmaker/odds_event_id` esistenti), modello, `_market_edge`, frontend, The Odds API.
- **API OddsPapi:** base `https://api.oddspapi.io/v4`, auth `apiKey` query param, tennis `sportId=12`. Endpoint: `/fixtures?sportId=12&from&to&hasOdds=true`, `/odds?fixtureId=<id>`. **Serve User-Agent** (urllib default → 403; usare httpx che manda un UA, o impostarlo).
- **Branch:** `feat/tennis-oddspapi` (worktree `~/Desktop/agentic-markets-oddspapi`, da `origin/main`).

---

### Task 0: Setup — GIÀ FATTO

Worktree `~/Desktop/agentic-markets-oddspapi` su `feat/tennis-oddspapi` (da `origin/main` @738f584), spec committata. Nessuna azione.

---

### Task 1: `core/tennis_oddspapi_client.py` — client + parser quote

**Files:**
- Create: `core/tennis_oddspapi_client.py`
- Create: `tests/test_tennis_oddspapi_client.py`
- Create (fixture di test): `tests/fixtures/oddspapi_odds_sample.json` (sample reale popolato — vedi Step 1)

**Interfaces:**
- Consumes: `canonical_player_key` da `core.tennis_names`; `_pair_key` da `core.tennis_odds_api_client`; `select_2way_anchor` da `core.market_anchor` (per coerenza anchor Pinnacle, se applicabile alla struttura OddsPapi — altrimenti anchor inline su 'pinnacle').
- Produces:
  - `async def get_oddspapi_fixtures(date_from: str, date_to: str) -> list[dict]` — fixture tennis con odds: ognuno `{fixtureId, player1, player2, scheduled_at, tournament, category}` (mappati da participant*Name/startTime/tournamentName/categoryName).
  - `def parse_oddspapi_match_odds(odds_payload: dict) -> dict | None` — da un payload `/odds` estrae `{odds_p1, odds_p2, bookmaker}` (match-winner, Pinnacle-anchored) o `None`. **Pura** (testabile).
  - `async def get_oddspapi_match_odds(fixture_id: str) -> dict | None` — fetch `/odds?fixtureId` + `parse_oddspapi_match_odds`.
  - `async def get_oddspapi_tennis_odds(wanted_keys: set[str]) -> list[dict]` — orchestratore: `get_oddspapi_fixtures`, tieni i fixture il cui `_pair_key` ∈ `wanted_keys`, per ciascuno `get_oddspapi_match_odds`, ritorna righe shape-`parse_tennis_odds_events`: `{odds_event_id, player1, player2, scheduled_at, odds_p1, odds_p2, bookmaker, anchor_source}`.

- [ ] **Step 1: Catturare un sample `/odds` REALE popolato (schema lock)**

Le quote tennis su OddsPapi sono popolate solo vicino al match (di giorno, tornei erba). Catturare un payload reale con bookmaker e Pinnacle:

```bash
KEY=<ODDSPAPI_KEY>; BASE="https://api.oddspapi.io/v4"
FROM=$(date -u +%Y-%m-%d); TO=$(date -u -v+2d +%Y-%m-%d 2>/dev/null || date -u -d '+2 days' +%Y-%m-%d)
curl -s "$BASE/fixtures?apiKey=$KEY&sportId=12&from=$FROM&to=$TO&hasOdds=true" > /tmp/fx.json
# prova /odds finché uno torna bookmakerOdds non vuoto:
for FID in $(python3 -c "import json;d=json.load(open('/tmp/fx.json'));i=d if isinstance(d,list) else d.get('data',[]);[print(f['fixtureId']) for f in i[:30]]"); do
  R=$(curl -s "$BASE/odds?apiKey=$KEY&fixtureId=$FID")
  N=$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('bookmakerOdds',{})))")
  if [ "${N:-0}" -gt 0 ]; then echo "$R" > tests/fixtures/oddspapi_odds_sample.json; echo "saved $FID ($N books)"; break; fi
done
```

Ispezionare la struttura e ANNOTARE nel codice: il path esatto del market match-winner e degli outcomes. Struttura osservata: `payload["bookmakerOdds"][<book_slug>]["markets"][<marketId>]["outcomes"][<outcomeId>]` con prezzo dentro l'outcome. Confermare quale `marketId` è il match-winner (candidati visti: `"121"` referenziato; un book mostrava id numerici tipo `"12245"`) e come si distingue p1 vs p2 (ordine outcomes / participant mapping). **Il parser dello Step 3 si aggancia a QUESTA struttura confermata.** Se la struttura reale differisce dallo scaffold sotto, adattare il parser e i test al sample salvato (è la fonte di verità).

- [ ] **Step 2: Scrivere i test (sul sample reale)**

Create `tests/test_tennis_oddspapi_client.py`:

```python
import json, pathlib
from core.tennis_oddspapi_client import parse_oddspapi_match_odds

SAMPLE = json.loads((pathlib.Path(__file__).parent / "fixtures" / "oddspapi_odds_sample.json").read_text())

def test_parse_real_sample_returns_two_way():
    r = parse_oddspapi_match_odds(SAMPLE)
    assert r is not None
    assert r["odds_p1"] > 1.0 and r["odds_p2"] > 1.0
    assert "bookmaker" in r

def test_parse_prefers_pinnacle_when_present():
    bk = SAMPLE.get("bookmakerOdds", {})
    r = parse_oddspapi_match_odds(SAMPLE)
    if "pinnacle" in bk:
        assert r["bookmaker"] == "pinnacle"

def test_parse_empty_or_no_market_returns_none():
    assert parse_oddspapi_match_odds({"bookmakerOdds": {}}) is None
    assert parse_oddspapi_match_odds({}) is None
```

(Aggiorna gli assert ai valori reali letti dal sample salvato — es. odds_p1 esatti — così il test è ancorato a dati veri.)

- [ ] **Step 3: Run test → fallisce**

Run: `./venv/bin/python -m pytest tests/test_tennis_oddspapi_client.py -v`
Expected: FAIL (`ModuleNotFoundError` / funzione assente).

- [ ] **Step 4: Implementare `core/tennis_oddspapi_client.py`**

Scaffold (adattare i path del parser alla struttura REALE confermata nello Step 1):

```python
# core/tennis_oddspapi_client.py
import os
import logging
from typing import Any
import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.oddspapi.io/v4"
SPORT_ID = 12  # tennis
# Market match-winner: confermare l'id reale dal sample (Step 1).
MATCH_WINNER_MARKET_IDS = {"121", "1"}  # set di candidati; aggiornare al valore reale
_UA = {"User-Agent": "betredge/1.0"}  # urllib default → 403; httpx manda un UA ma fissiamolo


def _key() -> str | None:
    return os.environ.get("ODDSPAPI_KEY") or None


def parse_oddspapi_match_odds(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Estrae il 2-way match-winner, anchored su Pinnacle. Puro, fail-soft.
    Struttura: payload['bookmakerOdds'][book]['markets'][marketId]['outcomes'][outcomeId] -> prezzo.
    ADATTARE i nomi di campo del prezzo/outcome alla struttura confermata nello Step 1."""
    bk = (payload or {}).get("bookmakerOdds") or {}
    if not bk:
        return None
    # Pinnacle prima, poi qualunque book con un 2-way completo.
    order = (["pinnacle"] if "pinnacle" in bk else []) + [b for b in bk if b != "pinnacle"]
    for book in order:
        markets = (bk.get(book) or {}).get("markets") or {}
        m = next((markets[mid] for mid in markets if str(mid) in MATCH_WINNER_MARKET_IDS), None)
        if not m:
            continue
        outcomes = m.get("outcomes") or {}
        prices = []
        for _, oc in outcomes.items():
            # ADATTARE: chiave del prezzo confermata nello Step 1 (es. oc['price'] o oc['p'] o oc['odds']).
            p = oc.get("price") if isinstance(oc, dict) else None
            if p is None and isinstance(oc, dict):
                p = oc.get("odds") or oc.get("p")
            if p:
                prices.append(float(p))
        if len(prices) == 2 and all(x > 1.0 for x in prices):
            return {"odds_p1": prices[0], "odds_p2": prices[1], "bookmaker": book}
    return None


async def get_oddspapi_fixtures(date_from: str, date_to: str) -> list[dict[str, Any]]:
    key = _key()
    if not key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=_UA) as client:
            resp = await client.get(
                f"{BASE_URL}/fixtures",
                params={"apiKey": key, "sportId": SPORT_ID, "from": date_from, "to": date_to, "hasOdds": "true"},
            )
        if resp.status_code != 200:
            logger.warning("oddspapi fixtures HTTP %s", resp.status_code)
            return []
        data = resp.json()
        items = data if isinstance(data, list) else data.get("data", [])
        out = []
        for f in items:
            out.append({
                "fixtureId": f.get("fixtureId"),
                "player1": f.get("participant1Name"),
                "player2": f.get("participant2Name"),
                "scheduled_at": f.get("startTime"),
                "tournament": f.get("tournamentName"),
                "category": f.get("categoryName"),
            })
        return out
    except Exception as exc:
        logger.warning("oddspapi fixtures failed (non-fatal): %s", exc)
        return []


async def get_oddspapi_match_odds(fixture_id: str) -> dict[str, Any] | None:
    key = _key()
    if not key or not fixture_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=_UA) as client:
            resp = await client.get(f"{BASE_URL}/odds", params={"apiKey": key, "fixtureId": fixture_id})
        if resp.status_code != 200:
            return None
        return parse_oddspapi_match_odds(resp.json())
    except Exception as exc:
        logger.warning("oddspapi odds failed (non-fatal): %s", exc)
        return None


async def get_oddspapi_tennis_odds(wanted_keys: set[str]) -> list[dict[str, Any]]:
    """Per i match nostri scoperti (wanted_keys = _pair_key), recupera quote da OddsPapi.
    Ritorna righe nella shape di parse_tennis_odds_events (riusabili da merge_tennis_odds)."""
    from datetime import datetime, timezone, timedelta
    from core.tennis_odds_api_client import _pair_key
    if not wanted_keys or not _key():
        return []
    now = datetime.now(timezone.utc)
    dfrom = now.date().isoformat()
    dto = (now + timedelta(days=2)).date().isoformat()
    fixtures = await get_oddspapi_fixtures(dfrom, dto)
    rows: list[dict[str, Any]] = []
    for f in fixtures:
        k = _pair_key(f.get("player1"), f.get("player2"), f.get("scheduled_at"))
        if not k or k not in wanted_keys:
            continue
        odds = await get_oddspapi_match_odds(f["fixtureId"])
        if not odds:
            continue
        rows.append({
            "odds_event_id": f["fixtureId"],
            "player1": f["player1"],
            "player2": f["player2"],
            "scheduled_at": f["scheduled_at"],
            "odds_p1": odds["odds_p1"],
            "odds_p2": odds["odds_p2"],
            "bookmaker": odds["bookmaker"],
            "anchor_source": "pinnacle" if odds["bookmaker"] == "pinnacle" else "best_margin",
        })
    return rows
```

- [ ] **Step 5: Run test → passa**

Run: `./venv/bin/python -m pytest tests/test_tennis_oddspapi_client.py -v`
Expected: PASS (3 test). Se il parser non estrae dal sample reale → adattare i path al sample (Step 1) finché passa.

- [ ] **Step 6: Commit**

```bash
git add core/tennis_oddspapi_client.py tests/test_tennis_oddspapi_client.py tests/fixtures/oddspapi_odds_sample.json
git commit -m "feat(tennis): OddsPapi client + parser quote match-winner (Pinnacle anchor)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Integrazione nel collector (policy near-kickoff + retry cap)

**Files:**
- Modify: `agents/tennis_data_collector.py`
- Modify: `config/settings.py` (aggiungere `ODDSPAPI_KEY`)
- Test: `tests/test_tennis_oddspapi_candidates.py` (nuovo — helper di selezione candidati, puro)

**Interfaces:**
- Consumes: `get_oddspapi_tennis_odds` (Task 1); `merge_tennis_odds`, `_pair_key` da `core.tennis_odds_api_client`; `canonical_player_key`.
- Produces: nessuna API pubblica nuova; arricchisce i fixture con `odds_p1/p2` da OddsPapi quando The Odds API non li ha.

- [ ] **Step 1: Aggiungere `ODDSPAPI_KEY` a `config/settings.py`**

Vicino a `ODDS_API_KEY` (cerca `ODDS_API_KEY` nel file), aggiungere:

```python
    ODDSPAPI_KEY: str = os.environ.get("ODDSPAPI_KEY", "")
```

(adattare allo stile del settings esistente — se usa pydantic BaseSettings, dichiarare il campo come gli altri; se assente, `""` → client no-op.)

- [ ] **Step 2: Test del selettore candidati (puro)**

Create `tests/test_tennis_oddspapi_candidates.py`:

```python
from datetime import datetime, timezone, timedelta
from agents.tennis_data_collector import oddspapi_candidates

def _fx(p1, p2, hours_ahead, odds=None):
    return {"player1": p1, "player2": p2,
            "scheduled_at": (datetime.now(timezone.utc)+timedelta(hours=hours_ahead)).isoformat(),
            "odds_p1": odds}

def test_only_uncovered_within_window():
    fx = [
        _fx("A","B",3,odds=None),     # scoperto, fra 3h → candidato
        _fx("C","D",3,odds=1.8),      # ha già odds → NO
        _fx("E","F",20,odds=None),    # scoperto ma fra 20h (>6) → NO
        _fx("G","H",-1,odds=None),    # nel passato → NO
    ]
    tried = {}
    keys = oddspapi_candidates(fx, tried, near_hours=6, max_attempts=3)
    names = {(f["player1"]) for f in fx if _key_of(f) in keys}
    assert "A" in names and "C" not in names and "E" not in names and "G" not in names

def test_respects_attempt_cap():
    fx = [_fx("A","B",3,odds=None)]
    from core.tennis_odds_api_client import _pair_key
    k = _pair_key("A","B",fx[0]["scheduled_at"])
    tried = {k: 3}  # già 3 tentativi
    assert oddspapi_candidates(fx, tried, near_hours=6, max_attempts=3) == set()

def _key_of(f):
    from core.tennis_odds_api_client import _pair_key
    return _pair_key(f["player1"], f["player2"], f["scheduled_at"])
```

- [ ] **Step 3: Run test → fallisce**

Run: `./venv/bin/python -m pytest tests/test_tennis_oddspapi_candidates.py -v`
Expected: FAIL (`oddspapi_candidates` non definita).

- [ ] **Step 4: Implementare `oddspapi_candidates` + `_merge_oddspapi_fallback` nel collector**

In `agents/tennis_data_collector.py`, aggiungere in testa al modulo le costanti e l'helper puro:

```python
from datetime import datetime, timezone, timedelta
from core.tennis_odds_api_client import _pair_key, merge_tennis_odds
from core.tennis_oddspapi_client import get_oddspapi_tennis_odds

NEAR_KICKOFF_HOURS = 6
MAX_ODDSPAPI_ATTEMPTS = 3


def oddspapi_candidates(fixtures: list[dict], tried: dict[str, int],
                        near_hours: int = NEAR_KICKOFF_HOURS,
                        max_attempts: int = MAX_ODDSPAPI_ATTEMPTS) -> set[str]:
    """Pair-key dei match SCOPERTI (no odds_p1) entro `near_hours` dal kickoff e
    sotto il cap tentativi. Puro/testabile."""
    now = datetime.now(timezone.utc)
    out: set[str] = set()
    for f in fixtures:
        if f.get("odds_p1") is not None:
            continue
        sa = f.get("scheduled_at")
        try:
            ko = datetime.fromisoformat(str(sa).replace("Z", "+00:00"))
        except Exception:
            continue
        if ko < now or ko > now + timedelta(hours=near_hours):
            continue
        k = _pair_key(f.get("player1"), f.get("player2"), sa)
        if not k or tried.get(k, 0) >= max_attempts:
            continue
        out.add(k)
    return out
```

Aggiungere un attributo di stato nel `__init__` della classe: `self._oddspapi_tried: dict[str, int] = {}`.

Aggiungere il metodo che fa il fallback (riusa `merge_tennis_odds`):

```python
    async def _merge_oddspapi_fallback(self, fixtures: list[dict]) -> tuple[list[dict], int]:
        """Per i match ancora scoperti vicini al kickoff, prova OddsPapi (fetch-once
        on-success + retry cap). Fail-soft."""
        if not settings.ODDSPAPI_KEY:
            return fixtures, 0
        wanted = oddspapi_candidates(fixtures, self._oddspapi_tried)
        if not wanted:
            return fixtures, 0
        for k in wanted:
            self._oddspapi_tried[k] = self._oddspapi_tried.get(k, 0) + 1  # conta il tentativo
        added = 0
        try:
            rows = await get_oddspapi_tennis_odds(wanted)
            if rows:
                before = sum(1 for f in fixtures if f.get("odds_p1") is not None)
                fixtures = merge_tennis_odds(fixtures, rows)
                # provider override per le righe arricchite da OddsPapi
                got_keys = {_pair_key(r["player1"], r["player2"], r["scheduled_at"]) for r in rows}
                for f in fixtures:
                    fk = _pair_key(f.get("player1"), f.get("player2"), f.get("scheduled_at"))
                    if fk in got_keys and f.get("odds_provider") == "the_odds_api" and f.get("odds_event_id") in {r["odds_event_id"] for r in rows}:
                        f["odds_provider"] = "oddspapi"
                after = sum(1 for f in fixtures if f.get("odds_p1") is not None)
                added = after - before
                # successo → non ritentare questi
                for r in rows:
                    rk = _pair_key(r["player1"], r["player2"], r["scheduled_at"])
                    if rk:
                        self._oddspapi_tried[rk] = MAX_ODDSPAPI_ATTEMPTS
        except Exception as exc:
            self.logger.warning("oddspapi fallback failed (non-fatal): %s", exc)
        return fixtures, added
```

Nota: `merge_tennis_odds` setta `odds_provider="the_odds_api"`; il loop sopra corregge a `"oddspapi"` per le righe arricchite da OddsPapi (match per `odds_event_id` = fixtureId OddsPapi). Mantenere semplice: se la correzione provider risulta fragile, in alternativa passare un parametro provider a una piccola variante locale del merge — ma preferire il riuso.

- [ ] **Step 5: Wire nel `_collect_cycle`**

In `_collect_cycle`, dopo `fixtures, odds_merged = await self._merge_market_odds(fixtures)` e PRIMA di `await self._client.write_fixtures_to_supabase(fixtures)`, inserire:

```python
                fixtures, oddspapi_added = await self._merge_oddspapi_fallback(fixtures)
                if oddspapi_added:
                    self.logger.info("tennis: +%d quote da OddsPapi (match erba/250 scoperti)", oddspapi_added)
                    odds_merged += oddspapi_added
```

- [ ] **Step 6: Run test → passa**

Run: `./venv/bin/python -m pytest tests/test_tennis_oddspapi_candidates.py -v`
Expected: PASS.

- [ ] **Step 7: Sanity import dell'intera pipeline**

Run: `./venv/bin/python -c "import agents.tennis_data_collector"`
Expected: nessun errore di import.

- [ ] **Step 8: Commit**

```bash
git add agents/tennis_data_collector.py config/settings.py tests/test_tennis_oddspapi_candidates.py
git commit -m "feat(tennis): fallback OddsPapi near-kickoff per i match non coperti da The Odds API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verifica finale (controller / gated)

- Suite pytest tennis verde: `./venv/bin/python -m pytest tests/test_tennis_oddspapi_client.py tests/test_tennis_oddspapi_candidates.py -v`.
- **Verifica live (con `ODDSPAPI_KEY` in env, gated):** in shadow/staging far girare un ciclo del collector quando un match erba-250 è entro 6h e prezzato → il fixture riceve `odds_p1/p2` (provider `oddspapi`); la card tennis mostra Market% + Edge; contare le richieste consumate (atteso ~1/match).
- **Deploy = gate APPROVE** + governance Tommy (scrive su `tennis_predictions`, DB condiviso → portare in council). Config: `ODDSPAPI_KEY` nell'env del runtime del collector.
- Dopo il deploy: **misurare il consumo reale** ~2-4 settimane (vs free 250/mese).

## Note finali

- Lo **schema esatto del market `/odds`** va confermato su un sample reale popolato (Task 1 Step 1): a quest'ora notturna nessun match tennis ha quote in `/odds`; l'implementer cattura il sample quando i match erba sono imminenti (di giorno). Lo scaffold del parser è sulla struttura osservata (`bookmakerOdds→book→markets→outcomes`); adattare al sample.
- `MATCH_WINNER_MARKET_IDS` e la chiave del prezzo nell'outcome sono i due punti da bloccare sul sample reale.
