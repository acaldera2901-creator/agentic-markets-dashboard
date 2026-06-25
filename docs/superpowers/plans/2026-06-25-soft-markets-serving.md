# Mercati Soft (Corner/Cartellini/Falli) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servire corner/cartellini/falli come stima del modello calibrata in un blocco card Pro-only, alimentato da un predictor Python isolato che scrive su Supabase.

**Architecture:** Predictor Python (modello league-agnostic validato) calcola λ/P(over) per i fixture imminenti delle 10 leghe club e fa upsert in `soft_predictions` (Supabase). Un settler Python popola gli esiti reali (forward, per track record). La card TS legge `soft_predictions` matchando per team-norm+data e rende un blocco Pro-gated, isolato dalla pipeline gol.

**Tech Stack:** Python 3.14 (httpx, scipy via venv esistente), Supabase Postgres (RPC `exec_sql`), Next.js 16 App Router (TS), api-football Ultra (`API_FOOTBALL_DIRECT_KEY`).

## Global Constraints

- **Framing onesto (FTC):** i soft sono **stima del modello**, MAI "edge sul bookmaker". Nessun numero di edge sui soft. Corner etichettati come stima **generica** (no claim di skill).
- **Accesso:** **solo Pro**. Free/Base → blocco blurrato via `LockedGate` esistente.
- **Leghe:** SOLO le 10 club — top-5 EU (`PL,SA,PD,BL1,FL1`) + 5 estive (`ELI,ALL,VEI,LOI,CSL`). **WC esclusa.**
- **Isolamento:** nessuna modifica alla pipeline gol/`computeAndStore`/`match_predictions`. Tabella e job nuovi e separati.
- **Chiave dati:** `API_FOOTBALL_DIRECT_KEY` (Ultra, già in `.env` e su main). Mai la RapidAPI morta.
- **Modello validato (backtest walk-forward, 5.346 match):** falli +10.1% Brier, cartellini +1.8%, corner calibrato ma no-skill. Linee standard: corner 8.5/9.5/10.5/11.5; cartellini 3.5/4.5/5.5; falli 20.5/22.5/24.5. SHRINK_K=5, FORM_WINDOW=12, WARMUP=3.
- **Gate prod:** migration Supabase, deploy, launchd → ogni task che tocca prod richiede PROPOSAL + APPROVE umano prima dell'esecuzione.

## File Structure

- Create `core/soft_markets/__init__.py` — package.
- Create `core/soft_markets/model.py` — matematica pura: tassi team-aware + λ + P(over). Stessa logica di `~/Desktop/soft-markets-spike/analyze_backtest.py`, ripulita e testata.
- Create `core/soft_markets/team_rates.py` — costruzione tassi-squadra da storico api-football (ingest recent stats).
- Create `scripts/predict_soft_markets.py` — predictor: fixture imminenti → righe `soft_predictions`.
- Create `scripts/settle_soft_markets.py` — settlement forward (popola `actual`).
- Create `db/migrations/0XX_soft_predictions.sql` — tabella `soft_predictions`.
- Create `tests/test_soft_markets_model.py` — unit del modello.
- Create `tests/test_soft_predictions_writer.py` — unit writer/upsert.
- Modify `app/api/predictions/route.ts` — GET arricchisce ogni riga con `enrichment.soft` da `soft_predictions` (match team-norm+data).
- Modify `app/app/page.tsx` — blocco card "Corner/Cartellini/Falli attesi" Pro-gated (rispecchia il blocco Gol).
- Create `~/Library/LaunchAgents/io.maven.softmarkets.predict.plist` — schedule predictor+settler.
- Create `tests/test_soft_block_render.test.ts` — render blocco + gate Pro.

---

### Task 1: Tabella `soft_predictions` (Supabase) ⚠️ GATED

**Files:**
- Create: `db/migrations/0XX_soft_predictions.sql`

**Interfaces:**
- Produces: tabella `soft_predictions` con unique `(match_key, market)` per upsert idempotente; colonne lette dalla card e scritte dal predictor.

- [ ] **Step 1: Scrivi la migration**

```sql
-- soft_predictions: stima calibrata corner/cartellini/falli (NON edge-vs-book).
CREATE TABLE IF NOT EXISTS soft_predictions (
  id            BIGSERIAL PRIMARY KEY,
  match_key     TEXT NOT NULL,          -- normName(home)|normName(away)|YYYY-MM-DD
  league        TEXT NOT NULL,
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  kickoff       TIMESTAMPTZ NOT NULL,
  market        TEXT NOT NULL CHECK (market IN ('corners','cards','fouls')),
  expected      DOUBLE PRECISION NOT NULL,   -- lambda totale match
  main_line     DOUBLE PRECISION NOT NULL,
  p_over        DOUBLE PRECISION NOT NULL CHECK (p_over >= 0 AND p_over <= 1),
  confidence    DOUBLE PRECISION,            -- 0..1
  is_generic    BOOLEAN NOT NULL DEFAULT FALSE,  -- true per corner (no skill)
  model_version TEXT NOT NULL,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actual        INTEGER,                     -- popolato dal settler
  settled_at    TIMESTAMPTZ,
  UNIQUE (match_key, market)
);
CREATE INDEX IF NOT EXISTS idx_soft_pred_kickoff ON soft_predictions (kickoff);
```

- [ ] **Step 2: PROPOSAL + APPROVE** — posta change-spec (tabella nuova, additiva, zero impatto su tabelle esistenti) su `ch_deploy_gate`; attendi `APPROVE`.

- [ ] **Step 3: Applica** via Supabase MCP `apply_migration` sul progetto prod `izscgffubtakzvwxchqt`.

- [ ] **Step 4: Verifica**

Run (Supabase MCP execute_sql): `SELECT count(*) FROM soft_predictions;`
Expected: `0` (tabella esiste, vuota).

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0XX_soft_predictions.sql
git commit -m "feat(db): soft_predictions table (#SOFT-MARKETS)"
```

---

### Task 2: Modello soft (matematica pura)

**Files:**
- Create: `core/soft_markets/__init__.py`
- Create: `core/soft_markets/model.py`
- Test: `tests/test_soft_markets_model.py`

**Interfaces:**
- Produces:
  - `MARKET_LINES: dict[str, list[float]]` e `MAIN_LINE: dict[str, float]`
  - `team_rate(history: list[int], glob_mean: float, k: float = 5.0) -> float`
  - `predict_lambda(market, attack_h, defence_h, attack_a, defence_a, glob_mean) -> float`
  - `p_over(lam: float, line: float) -> float`
  - `IS_GENERIC: dict[str,bool]` → `{"corners": True, "cards": False, "fouls": False}`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_soft_markets_model.py
from core.soft_markets.model import team_rate, predict_lambda, p_over, MAIN_LINE, IS_GENERIC

def test_team_rate_shrinks_to_global_with_few_games():
    # 1 partita estrema (10) con glob 5 e k=5 → vicino alla media globale, non a 10/5
    r = team_rate([10], glob_mean=5.0, k=5.0)
    assert 1.0 < r < 1.6   # rate normalizzato (mean/glob), tirato verso 1.0

def test_predict_lambda_symmetric_baseline():
    # tutti i tassi neutri (1.0) → lambda = 2*glob_mean
    lam = predict_lambda("fouls", 1.0, 1.0, 1.0, 1.0, glob_mean=12.0)
    assert abs(lam - 24.0) < 1e-9

def test_p_over_monotonic():
    assert p_over(10.0, 8.5) > p_over(10.0, 11.5)

def test_corners_flagged_generic():
    assert IS_GENERIC["corners"] is True
    assert IS_GENERIC["fouls"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/Desktop/agentic-markets/venv/bin/python -m pytest tests/test_soft_markets_model.py -v`
Expected: FAIL `ModuleNotFoundError: core.soft_markets`

- [ ] **Step 3: Write minimal implementation**

```python
# core/soft_markets/__init__.py
```
```python
# core/soft_markets/model.py
import math
from scipy.stats import poisson

MARKET_LINES = {
    "corners": [8.5, 9.5, 10.5, 11.5],
    "cards":   [3.5, 4.5, 5.5],
    "fouls":   [20.5, 22.5, 24.5],
}
MAIN_LINE = {"corners": 9.5, "cards": 4.5, "fouls": 22.5}
IS_GENERIC = {"corners": True, "cards": False, "fouls": False}  # corner: no skill validata

def team_rate(history, glob_mean, k=5.0):
    """Media shrinked verso la media globale, normalizzata (mean/glob)."""
    if not glob_mean:
        return 1.0
    s, n = sum(history), len(history)
    mean = (s + k * glob_mean) / (n + k)
    return mean / glob_mean

def predict_lambda(market, attack_h, defence_h, attack_a, defence_a, glob_mean):
    """lambda totale = glob*(a_h*d_a + a_a*d_h). Per 'corners' i tassi arrivano
    gia' neutralizzati (=1.0) dal chiamante (stima generica calibrata)."""
    return glob_mean * (attack_h * defence_a + attack_a * defence_h)

def p_over(lam, line):
    return float(1.0 - poisson.cdf(int(math.floor(line)), lam))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `~/Desktop/agentic-markets/venv/bin/python -m pytest tests/test_soft_markets_model.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add core/soft_markets/ tests/test_soft_markets_model.py
git commit -m "feat(soft): modello soft puro (lambda/p_over) validato (#SOFT-MARKETS)"
```

---

### Task 3: Costruzione tassi-squadra da api-football

**Files:**
- Create: `core/soft_markets/team_rates.py`
- Test: `tests/test_soft_markets_model.py` (estende)

**Interfaces:**
- Consumes: `core.football_api_client` (host diretto + `API_FOOTBALL_DIRECT_KEY`, già su main).
- Produces:
  - `async fetch_team_recent(team_id: int, before_iso: str, window: int = 12) -> dict[str, list[int]]` → per mercato `{"corners_for":[..],"corners_against":[..], ...}`
  - `async build_rates(home_id, away_id, kickoff_iso) -> dict | None` → `{market: {"a_h":..,"d_h":..,"a_a":..,"d_a":..,"glob":..}}` o `None` se warmup (<3 partite per squadra) non soddisfatto. Per `corners` forza tassi neutri (1.0) ma calcola `glob` reale.

- [ ] **Step 1: Write the failing test** (con stub di rete via monkeypatch)

```python
# append a tests/test_soft_markets_model.py
import asyncio, types
from core.soft_markets import team_rates

def test_build_rates_warmup_returns_none(monkeypatch):
    async def fake_recent(tid, before, window=12):
        return {f"{m}_for": [] for m in ["corners","cards","fouls"]} | \
               {f"{m}_against": [] for m in ["corners","cards","fouls"]}
    monkeypatch.setattr(team_rates, "fetch_team_recent", fake_recent)
    out = asyncio.run(team_rates.build_rates(1, 2, "2026-07-01T18:00:00+00:00"))
    assert out is None  # warmup non soddisfatto

def test_build_rates_corners_generic(monkeypatch):
    async def fake_recent(tid, before, window=12):
        base = {f"{m}_for": [5,6,7,5] for m in ["corners","cards","fouls"]}
        base |= {f"{m}_against": [5,5,6,4] for m in ["corners","cards","fouls"]}
        return base
    monkeypatch.setattr(team_rates, "fetch_team_recent", fake_recent)
    out = asyncio.run(team_rates.build_rates(1, 2, "2026-07-01T18:00:00+00:00"))
    assert out["corners"]["a_h"] == 1.0 and out["corners"]["d_a"] == 1.0  # neutralizzati
    assert out["fouls"]["glob"] > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/Desktop/agentic-markets/venv/bin/python -m pytest tests/test_soft_markets_model.py -v`
Expected: FAIL `ModuleNotFoundError: core.soft_markets.team_rates`

- [ ] **Step 3: Write minimal implementation**

```python
# core/soft_markets/team_rates.py
import httpx
from config.settings import settings
from core.soft_markets.model import team_rate, IS_GENERIC

_DIRECT = "https://v3.football.api-sports.io"
MARKETS = ["corners", "cards", "fouls"]
WARMUP = 3

def _hdr():
    return {"x-apisports-key": settings.API_FOOTBALL_DIRECT_KEY}

async def fetch_team_recent(team_id, before_iso, window=12):
    """Ultima `window` partite FT della squadra prima di before_iso → for/against per mercato."""
    out = {f"{m}_for": [] for m in MARKETS} | {f"{m}_against": [] for m in MARKETS}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(f"{_DIRECT}/fixtures", headers=_hdr(),
                        params={"team": team_id, "last": window + 5, "status": "FT"})
        if r.status_code != 200:
            return out
        fixtures = [f for f in r.json().get("response", [])
                    if f["fixture"]["date"] < before_iso][:window]
        for f in fixtures:
            fid = f["fixture"]["id"]; is_home = f["teams"]["home"]["id"] == team_id
            s = await c.get(f"{_DIRECT}/fixtures/statistics", headers=_hdr(), params={"fixture": fid})
            if s.status_code != 200:
                continue
            resp = s.json().get("response", [])
            mine = next((t for t in resp if t["team"]["id"] == team_id), None)
            opp  = next((t for t in resp if t["team"]["id"] != team_id), None)
            if not mine or not opp:
                continue
            def stat(team, *names):
                for st in team["statistics"]:
                    ty = (st.get("type") or "").lower()
                    if any(n in ty for n in names):
                        v = st.get("value"); return int(v) if isinstance(v,(int,float)) else 0
                return 0
            getters = {"corners": ("corner",), "cards": ("yellow","red"), "fouls": ("foul",)}
            for m, names in getters.items():
                if m == "cards":
                    mf = stat(mine,"yellow")+stat(mine,"red"); af = stat(opp,"yellow")+stat(opp,"red")
                else:
                    mf = stat(mine,*names); af = stat(opp,*names)
                out[f"{m}_for"].append(mf); out[f"{m}_against"].append(af)
    return out

async def build_rates(home_id, away_id, kickoff_iso):
    rh = await fetch_team_recent(home_id, kickoff_iso)
    ra = await fetch_team_recent(away_id, kickoff_iso)
    res = {}
    for m in MARKETS:
        hf, ha = rh[f"{m}_for"], rh[f"{m}_against"]
        af, aa = ra[f"{m}_for"], ra[f"{m}_against"]
        if min(len(hf), len(af)) < WARMUP:
            return None
        glob = (sum(hf)+sum(ha)+sum(af)+sum(aa)) / (len(hf)+len(ha)+len(af)+len(aa))
        if IS_GENERIC[m]:
            res[m] = {"a_h":1.0,"d_h":1.0,"a_a":1.0,"d_a":1.0,"glob":glob}
        else:
            res[m] = {"a_h":team_rate(hf,glob),"d_h":team_rate(ha,glob),
                      "a_a":team_rate(af,glob),"d_a":team_rate(aa,glob),"glob":glob}
    return res
```

- [ ] **Step 4: Run test to verify it passes**

Run: `~/Desktop/agentic-markets/venv/bin/python -m pytest tests/test_soft_markets_model.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/soft_markets/team_rates.py tests/test_soft_markets_model.py
git commit -m "feat(soft): tassi-squadra da api-football Ultra + warmup gate (#SOFT-MARKETS)"
```

---

### Task 4: Writer `soft_predictions` (upsert via exec_sql)

**Files:**
- Create: `core/soft_markets/writer.py`
- Test: `tests/test_soft_predictions_writer.py`

**Interfaces:**
- Consumes: `build_rates`, `predict_lambda`, `p_over`, `MAIN_LINE`, `IS_GENERIC`.
- Produces:
  - `build_rows(home, away, kickoff_iso, league, rates) -> list[dict]` (una riga per mercato; `match_key=normName(home)|normName(away)|date`).
  - `norm_name(s: str) -> str` (allineata a `lib/odds-api.ts normName`: rimuove FC/CF/SC/AC/AS/SV/SS/US/SSC/AFC/Calcio, lower, trim).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_soft_predictions_writer.py
from core.soft_markets.writer import build_rows, norm_name

def test_norm_name_matches_ts_rule():
    assert norm_name("AC Milan") == "milan"
    assert norm_name("Manchester United FC") == "manchester united"

def test_build_rows_one_per_market_with_match_key():
    rates = {m: {"a_h":1.0,"d_h":1.0,"a_a":1.0,"d_a":1.0,"glob":(12.0 if m=="fouls" else 5.0)}
             for m in ["corners","cards","fouls"]}
    rows = build_rows("AC Milan","Inter","2026-07-01T18:00:00+00:00","SA",rates)
    assert len(rows) == 3
    r = {x["market"]: x for x in rows}
    assert r["fouls"]["match_key"] == "milan|inter|2026-07-01"
    assert abs(r["fouls"]["expected"] - 24.0) < 1e-9     # 2*glob
    assert r["corners"]["is_generic"] is True
    assert 0.0 <= r["cards"]["p_over"] <= 1.0
    assert r["cards"]["main_line"] == 4.5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `~/Desktop/agentic-markets/venv/bin/python -m pytest tests/test_soft_predictions_writer.py -v`
Expected: FAIL `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# core/soft_markets/writer.py
import re
from core.soft_markets.model import predict_lambda, p_over, MAIN_LINE, IS_GENERIC

MODEL_VERSION = "soft-leagueagnostic-v1"
_NOISE = re.compile(r"\b(FC|CF|SC|AC|AS|SV|SS|US|SSC|AFC|Calcio)\b", re.I)

def norm_name(s):
    s = _NOISE.sub("", s or "")
    return re.sub(r"\s+", " ", s).strip().lower()

def build_rows(home, away, kickoff_iso, league, rates):
    date = kickoff_iso[:10]
    key = f"{norm_name(home)}|{norm_name(away)}|{date}"
    rows = []
    for m, r in rates.items():
        lam = predict_lambda(m, r["a_h"], r["d_h"], r["a_a"], r["d_a"], r["glob"])
        line = MAIN_LINE[m]
        rows.append({
            "match_key": key, "league": league, "home_team": home, "away_team": away,
            "kickoff": kickoff_iso, "market": m, "expected": round(lam, 2),
            "main_line": line, "p_over": round(p_over(lam, line), 4),
            "confidence": None, "is_generic": IS_GENERIC[m], "model_version": MODEL_VERSION,
        })
    return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `~/Desktop/agentic-markets/venv/bin/python -m pytest tests/test_soft_predictions_writer.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/soft_markets/writer.py tests/test_soft_predictions_writer.py
git commit -m "feat(soft): build_rows + norm_name allineata a odds-api (#SOFT-MARKETS)"
```

---

### Task 5: Predictor script (fixture imminenti → upsert) ⚠️ scrive prod

**Files:**
- Create: `scripts/predict_soft_markets.py`

**Interfaces:**
- Consumes: `build_rates`, `build_rows`, `core.espn_soccer_client`/`core.odds_api_client` per i fixture imminenti delle 10 leghe (riusa la sorgente fixtures già usata dalla board), Supabase via `exec_sql`/PostgREST con service role.
- Produces: righe upsert in `soft_predictions` (`ON CONFLICT (match_key,market)`).

- [ ] **Step 1: Implementa lo script** (fixture imminenti per le 10 leghe → per ciascuno `build_rates`→`build_rows`→upsert; fail-soft per match: warmup/None → skip; log per-lega `[CODE] N predette / M saltate`).

```python
# scripts/predict_soft_markets.py  (scheletro — riusa il fixtures-provider della board)
import asyncio, logging
from core.soft_markets.team_rates import build_rates
from core.soft_markets.writer import build_rows
from core.soft_markets.fixtures import upcoming_club_fixtures   # riusa provider esistente
from core.soft_markets.supabase_upsert import upsert_soft_predictions

log = logging.getLogger("predict_soft")

async def main():
    fixtures = await upcoming_club_fixtures(days=10)   # [{home,away,kickoff,league,home_id,away_id}]
    for f in fixtures:
        try:
            rates = await build_rates(f["home_id"], f["away_id"], f["kickoff"])
            if not rates:
                log.info("[%s] skip warmup: %s vs %s", f["league"], f["home"], f["away"]); continue
            rows = build_rows(f["home"], f["away"], f["kickoff"], f["league"], rates)
            await upsert_soft_predictions(rows)
            log.info("[%s] %s vs %s: %d mercati", f["league"], f["home"], f["away"], len(rows))
        except Exception as e:
            log.warning("[%s] fail %s vs %s: %s", f["league"], f["home"], f["away"], e)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
```

- [ ] **Step 2: Implementa `core/soft_markets/supabase_upsert.py`** (POST PostgREST `soft_predictions` con header `Prefer: resolution=merge-duplicates`, service role key da settings) e `core/soft_markets/fixtures.py` (adatta il provider fixtures già usato in `computeAndStore`/ESPN per le 10 leghe; ritorna anche `home_id/away_id` api-football via `/fixtures?date`).

- [ ] **Step 3: Dry-run locale (NON scrive)** con flag `--dry-run` che stampa le righe invece di upsert.

Run: `~/Desktop/agentic-markets/venv/bin/python -m scripts.predict_soft_markets --dry-run`
Expected: righe sane per match con storico (warmup ok), skip per gli altri.

- [ ] **Step 4: PROPOSAL + APPROVE** per il primo run che SCRIVE su `soft_predictions` prod.

- [ ] **Step 5: Run reale + verifica**

Run: `~/Desktop/agentic-markets/venv/bin/python -m scripts.predict_soft_markets`
Then (Supabase MCP): `SELECT league, market, count(*) FROM soft_predictions GROUP BY 1,2 ORDER BY 1;`
Expected: righe per le leghe in stagione con fixture imminenti.

- [ ] **Step 6: Commit**

```bash
git add scripts/predict_soft_markets.py core/soft_markets/supabase_upsert.py core/soft_markets/fixtures.py
git commit -m "feat(soft): predictor fixture imminenti -> soft_predictions (#SOFT-MARKETS)"
```

---

### Task 6: Settler forward (popola `actual`)

**Files:**
- Create: `scripts/settle_soft_markets.py`

**Interfaces:**
- Consumes: `soft_predictions` con `kickoff < now()` e `actual IS NULL`; api-football `/fixtures/statistics` per gli esiti reali.
- Produces: UPDATE `actual`, `settled_at`.

- [ ] **Step 1: Implementa** (per ogni riga non settlata con kickoff passato: risolvi fixture api-football per team+data, somma il mercato reale, UPDATE). Fail-soft per riga.

- [ ] **Step 2: Test logica di somma** (`tests/test_soft_settle.py`): dato uno stub di `/fixtures/statistics`, la somma corner/cartellini(Y+R)/falli è corretta.

Run: `~/Desktop/agentic-markets/venv/bin/python -m pytest tests/test_soft_settle.py -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/settle_soft_markets.py tests/test_soft_settle.py
git commit -m "feat(soft): settler forward esiti reali (#SOFT-MARKETS)"
```

---

### Task 7: API — arricchisci la board con `enrichment.soft`

**Files:**
- Modify: `app/api/predictions/route.ts` (handler GET)

**Interfaces:**
- Consumes: `soft_predictions` via `dbQuery` (exec_sql); `normName` da `lib/odds-api.ts`.
- Produces: ogni riga board ottiene `enrichment.soft = { corners, cards, fouls }` dove ciascuno è `{ expected, main_line, p_over, is_generic } | null`, matchato per `normName(home)|normName(away)|date`. Solo per richieste con piano Pro (per le altre `enrichment.soft` omesso lato server — non fare leak).

- [ ] **Step 1: Test** (`tests/test_soft_block_render.test.ts` parte API): data una riga board e una `soft_predictions` con stesso match_key, il GET include `enrichment.soft.fouls.p_over`; con piano Base, `enrichment.soft` assente.

- [ ] **Step 2: Implementa** il join in-memory nel GET: una query `SELECT * FROM soft_predictions WHERE kickoff > now()-interval '150 min'`, mappa per `match_key`, allega a ogni riga board; gate per piano (riusa `resolveAccessState`).

- [ ] **Step 3: Run test**

Run: `npm test -- tests/test_soft_block_render.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/predictions/route.ts tests/test_soft_block_render.test.ts
git commit -m "feat(soft): enrichment.soft Pro-only nel GET board (#SOFT-MARKETS)"
```

---

### Task 8: Card — blocco "Corner/Cartellini/Falli attesi" (Pro-gated)

**Files:**
- Modify: `app/app/page.tsx` (rendering enrichment della card, sotto il blocco Gol)

**Interfaces:**
- Consumes: `enrichment.soft` (Task 7); componente `LockedGate` esistente; helper di formato del blocco Gol.

- [ ] **Step 1: Leggi il blocco Gol esistente** in `app/app/page.tsx` (la sezione che usa `enrichment.lambdas`/`computeExtraMarkets`/`goalsPhrase`) per rispecchiarne stile e struttura (readout, niente barre).

- [ ] **Step 2: Implementa `SoftBlock`** che rende, per i mercati presenti in `enrichment.soft`: riga "Falli attesi ~24 · Over 22.5 58%", "Cartellini attesi ~4.3 · Over 4.5 …", "Corner attesi ~9.9 · Over 9.5 … (stima generica)". Mai numero di edge. Avvolto in `LockedGate` requiredPlan="pro".

- [ ] **Step 3: Render test** (`tests/test_soft_block_render.test.ts` parte UI): con `enrichment.soft` e piano Pro → testo "Falli attesi"; piano Base → `LockedGate` (blurrato), nessun valore reale nel DOM.

Run: `npm test -- tests/test_soft_block_render.test.ts`
Expected: PASS

- [ ] **Step 4: Verifica visiva loggato** (Costruito≠Verificato): su prod/preview, card di una lega in stagione, utente Pro → blocco soft visibile; utente Base → blurrato.

- [ ] **Step 5: Commit**

```bash
git add app/app/page.tsx tests/test_soft_block_render.test.ts
git commit -m "feat(soft): blocco card Corner/Cartellini/Falli Pro-only (#SOFT-MARKETS)"
```

---

### Task 9: Schedule (launchd) + go-live ⚠️ GATED

**Files:**
- Create: `~/Library/LaunchAgents/io.maven.softmarkets.predict.plist`

**Interfaces:**
- Produces: job dedicato che lancia `predict_soft_markets` poi `settle_soft_markets` ogni 2h.

- [ ] **Step 1: Scrivi il plist** (ProgramArguments: venv python + un wrapper `run_soft.sh` che esegue predict poi settle; StartInterval 7200; StandardOut/Err log dedicati).

- [ ] **Step 2: PROPOSAL + APPROVE** (nuovo job ricorrente + deploy del blocco card su Vercel `main`).

- [ ] **Step 3: Carica il job + deploy frontend**

```bash
launchctl load ~/Library/LaunchAgents/io.maven.softmarkets.predict.plist
# merge feat/soft-markets-serving -> main -> auto-deploy Vercel
```

- [ ] **Step 4: Verifica end-to-end (reale)**: dopo 1 ciclo, `soft_predictions` popolata; board Pro mostra il blocco; dopo le partite il settler popola `actual`.

- [ ] **Step 5: Commit**

```bash
git add ops/io.maven.softmarkets.predict.plist ops/run_soft.sh
git commit -m "feat(soft): launchd predict+settle ogni 2h (#SOFT-MARKETS)"
```

---

## Self-Review

**Spec coverage:**
- Tutti e 3 i mercati → Task 2/4 (`MARKET_LINES`/`build_rows` coprono corners/cards/fouls). ✅
- Corner generico calibrato → `IS_GENERIC["corners"]=True` neutralizza i tassi (Task 2/3), etichetta in card (Task 8). ✅
- Solo Pro → gate server (Task 7) + `LockedGate` (Task 8). ✅
- Framing stima/no-edge → nessun campo edge in `soft_predictions` (Task 1) né in card (Task 8). ✅
- Predictor Python isolato → Task 5; tabella isolata → Task 1; nessun tocco a `match_predictions`/`computeAndStore`. ✅
- Settlement forward → Task 6. ✅
- 10 leghe, WC esclusa → `upcoming_club_fixtures` (Task 5) limita alle 10 club. ✅
- Schedule launchd dedicato → Task 9. ✅
- Matching team-norm+data → `norm_name` (Task 4) allineata a `lib/odds-api.ts`, usata in writer e API (Task 7). ✅

**Placeholder scan:** Task 5/6/9 hanno step "implementa" descrittivi con scheletro di codice e file esatti; i moduli core (Task 2/3/4) hanno codice completo + test. Le parti scheletro (provider fixtures, supabase_upsert, settler) sono descritte con interfacce esatte; l'esecutore le completa rispecchiando i pattern citati (computeAndStore fixtures, dbQuery/PostgREST). Accettabile: sono integrazioni su codice esistente referenziato, non logica nuova non specificata.

**Type consistency:** `match_key` = `normName(home)|normName(away)|YYYY-MM-DD` coerente tra Task 1 (colonna), Task 4 (`build_rows`), Task 7 (join). `IS_GENERIC` coerente Task 2/3/4. `MAIN_LINE` usato in Task 2/4. ✅

## Note di esecuzione
- Ordine: 2→3→4 (core puro, testabile offline) prima di 1/5/7/8/9 (toccano prod). I task ⚠️ GATED richiedono APPROVE umano.
- I moduli core girano col venv esistente (`scipy`, `httpx` presenti).
