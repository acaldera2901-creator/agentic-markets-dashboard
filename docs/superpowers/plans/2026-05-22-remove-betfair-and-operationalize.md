# Remove Betfair & Full Operationalization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Betfair completely from the system, fix all critical bugs, and make Agentic Markets fully operational in paper-trading mode, ready to plug in a new exchange.

**Architecture:** Betfair (exchange client, gateway, tennis client) is deleted. All live betting paths fall back to paper. TennisSettlementAgent is rewritten to bulk-expire stale predictions and resolve new ones without an exchange. The football pipeline handles off-season gracefully. ELO model gets a minimum-odds filter to improve win rate.

**Tech Stack:** Python 3.14, asyncpg, SQLAlchemy async, Redis, Neon PostgreSQL, Next.js (dashboard), API-Football (RapidAPI), football-data.org, Matchbook (odds fallback)

**Working directory for all commands:** `~/Desktop/sistema-andrea/agentic-markets/`

---

## File Map

| Action | File | What changes |
|---|---|---|
| DELETE | `core/betfair_client.py` | Entire file removed |
| DELETE | `core/betfair_gateway.py` | Entire file removed |
| DELETE | `core/tennis_betfair_client.py` | Entire file removed |
| MODIFY | `config/settings.py` | Remove BETFAIR_* fields |
| MODIFY | `.env` | Remove BETFAIR_* vars |
| MODIFY | `requirements.txt` | Remove betfairlightweight |
| MODIFY | `agents/data_collector.py` | Remove betfair_client import + betfair odds block |
| MODIFY | `agents/analyst.py` | Remove "betfair" from sharp keywords |
| MODIFY | `agents/risk_manager.py` | Remove "betfair" from sharp keywords |
| MODIFY | `agents/trader.py` | Remove `_execute_live` and `_lookup_betfair`, paper-only |
| MODIFY | `agents/tennis_trader.py` | Remove `_execute_live_betfair`, non-MB → paper |
| REWRITE | `agents/tennis_settlement.py` | Bulk-expire stale, resolve via Matchbook when available |
| MODIFY | `agents/data_collector.py` | Off-season: track empty cycles, log once per hour |
| MODIFY | `agents/tennis_analyst.py` | Add min odds filter (>= 1.50) |
| MODIFY | `agents/tennis_model_agent.py` | Persist only predictions with odds present |
| MODIFY | `dashboard-web/app/api/predictions/route.ts` | Trigger kickoff refresh for midnight UTC dates |

---

## Task 1: Delete the three Betfair core files

**Files:**
- Delete: `core/betfair_client.py`
- Delete: `core/betfair_gateway.py`
- Delete: `core/tennis_betfair_client.py`

- [ ] **Step 1: Delete the three files**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
rm core/betfair_client.py core/betfair_gateway.py core/tennis_betfair_client.py
```

- [ ] **Step 2: Verify they're gone**

```bash
ls core/betfair* 2>/dev/null && echo "STILL EXISTS" || echo "DELETED OK"
```
Expected: `DELETED OK`

---

## Task 2: Remove BETFAIR_* from settings and .env

**Files:**
- Modify: `config/settings.py`
- Modify: `.env`
- Modify: `requirements.txt`

- [ ] **Step 1: Edit config/settings.py — remove three BETFAIR fields**

In `config/settings.py`, remove these three lines (lines 13-15):
```python
    BETFAIR_APP_KEY: str = ""
    BETFAIR_USERNAME: str = ""
    BETFAIR_PASSWORD: str = ""
```

- [ ] **Step 2: Edit .env — remove BETFAIR_* lines**

In `.env`, remove all lines starting with `BETFAIR_`:
```
BETFAIR_USERNAME=braghimichele5@gmail.com
BETFAIR_APP_KEY=...
BETFAIR_PASSWORD=...
BETFAIR_CERTS_PATH=...
```

- [ ] **Step 3: Edit requirements.txt — remove betfairlightweight**

Remove this line from `requirements.txt`:
```
betfairlightweight>=2.0.0
```

- [ ] **Step 4: Verify import error is gone**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "from config.settings import settings; print('OK settings')" 2>&1
```
Expected: `OK settings`

---

## Task 3: Fix agents/data_collector.py — remove Betfair imports and odds block

**Files:**
- Modify: `agents/data_collector.py` lines 12-13 and lines 79-91

- [ ] **Step 1: Write the failing test first**

```python
# tests/test_data_collector_no_betfair.py
import importlib, sys

def test_data_collector_has_no_betfair_import():
    """DataCollector must not import betfair_client after removal."""
    import ast, pathlib
    src = pathlib.Path("agents/data_collector.py").read_text()
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [a.name for a in getattr(node, 'names', [])]
            module = getattr(node, 'module', '') or ''
            assert 'betfair' not in module.lower(), f"Found betfair import: {module}"
            for n in names:
                assert 'betfair' not in n.lower(), f"Found betfair name: {n}"
```

Run: `pytest tests/test_data_collector_no_betfair.py -v`
Expected: FAIL with `Found betfair import`

- [ ] **Step 2: Edit agents/data_collector.py**

Remove line 12:
```python
from core.betfair_client import get_all_odds_for_league, is_configured as betfair_configured
```

In `_collect_cycle` method, remove the entire Betfair odds block (lines ~79-91):
```python
                # Primary odds source: Betfair Exchange (live, sharpest prices)
                # The Odds API is a fallback (monthly quota often exhausted)
                odds_map: dict = {}
                if betfair_configured():
                    try:
                        bf_list = await asyncio.to_thread(get_all_odds_for_league, league_code)
                    except Exception as bf_err:
                        self.logger.warning(f"Betfair odds error {league_code}: {bf_err}")
                        bf_list = []
                    if bf_list:
                        self.logger.info(f"Betfair {league_code}: {len(bf_list)} markets")
                        odds_map = {
                            o["home_team_normalized"] + "|" + o["away_team_normalized"]: o
                            for o in bf_list
                        }
```

Replace those removed lines with just:
```python
                odds_map: dict = {}
```

So the flow becomes: odds_map starts empty → Matchbook fills it (if configured) → OddsAPI fills it (if Matchbook empty).

Also update the comment on the Matchbook block to reflect the new priority:
```python
                # Primary odds source: Matchbook Exchange
                if not odds_map and mb_configured():
```
Change "Second fallback: Matchbook Exchange" to "Primary odds source: Matchbook Exchange".

- [ ] **Step 3: Run test — expect PASS**

```bash
pytest tests/test_data_collector_no_betfair.py -v
```
Expected: PASS

---

## Task 4: Fix analyst.py and risk_manager.py — remove "betfair" from sharp keywords

**Files:**
- Modify: `agents/analyst.py` line 13
- Modify: `agents/risk_manager.py` line 25

- [ ] **Step 1: Edit agents/analyst.py**

Line 13, change:
```python
    if any(k in notes or k in source for k in ("pinnacle", "betfair", "exchange", "sharp")):
```
to:
```python
    if any(k in notes or k in source for k in ("pinnacle", "matchbook", "exchange", "sharp")):
```

- [ ] **Step 2: Edit agents/risk_manager.py**

Line 25, change:
```python
    sharp_keywords = ("pinnacle", "betfair", "exchange", "sharp")
```
to:
```python
    sharp_keywords = ("pinnacle", "matchbook", "exchange", "sharp")
```

- [ ] **Step 3: Quick smoke test**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "from agents.analyst import AnalystAgent; from agents.risk_manager import RiskManagerAgent; print('OK')"
```
Expected: `OK`

---

## Task 5: Fix agents/trader.py — paper-only, remove Betfair execution

**Files:**
- Modify: `agents/trader.py` — remove `_lookup_betfair`, `_execute_live`, and all betfair imports

- [ ] **Step 1: Write failing test**

```python
# tests/test_trader_no_betfair.py
import ast, pathlib

def test_trader_has_no_betfair():
    src = pathlib.Path("agents/trader.py").read_text()
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = getattr(node, 'module', '') or ''
            assert 'betfair' not in module.lower(), f"betfair import found: {module}"
```

Run: `pytest tests/test_trader_no_betfair.py -v`
Expected: FAIL

- [ ] **Step 2: Rewrite agents/trader.py**

Replace the entire file with this cleaned version (removes `_lookup_betfair`, `_execute_live`, betfair imports; all orders go to `_execute_paper`):

```python
import asyncio
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.db import AsyncSessionLocal, Bet
from config.settings import settings
from sqlalchemy import select


class TraderAgent(BaseAgent):
    def __init__(self):
        super().__init__("TraderAgent")
        self._bot = None

    async def _main_loop(self) -> None:
        await self._init_telegram()
        while self._running:
            messages = await consume("risk:orders", "trader_group", "TraderAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _init_telegram(self) -> None:
        if settings.TELEGRAM_BOT_TOKEN:
            try:
                from telegram import Bot
                self._bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
            except Exception as e:
                self.logger.warning(f"Telegram init failed: {e}")

    async def _send_bet_placed_alert(self, order: dict, bet_id: str) -> None:
        if not self._bot or not settings.TELEGRAM_CHAT_ID:
            return
        try:
            edge = float(order.get("edge", 0))
            if edge < settings.TELEGRAM_VALUE_EDGE_THRESHOLD:
                return
            match = f"{order.get('home_team')} vs {order.get('away_team')}"
            sel = order.get("selection", "?").upper()
            odds = float(order.get("odds", 0))
            stake = float(order.get("stake", 0))
            p_sel = float(order.get("p_home" if sel == "HOME" else "p_draw" if sel == "DRAW" else "p_away", 0))
            msg = (
                f"✅ [PAPER] {match}\n"
                f"{sel} @ {odds:.2f}  |  p={p_sel:.2f}  |  Edge +{edge*100:.1f}%\n"
                f"Stake: {stake:.2f}€  |  DB#{bet_id}"
            )
            await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=msg)
        except Exception as e:
            self.logger.warning(f"Telegram alert failed: {e}")

    async def _process(self, data: dict) -> None:
        try:
            await self._execute_paper(data)
        except Exception as e:
            self.logger.error(f"trader error: {e}")

    async def _execute_paper(self, order: dict) -> None:
        kickoff = str(order.get("kickoff", ""))
        async with AsyncSessionLocal() as session:
            existing = await session.execute(
                select(Bet).where(
                    Bet.match_external_id == order["match_id"],
                    Bet.status == "pending",
                )
            )
            if existing.scalar_one_or_none():
                self.logger.warning(
                    f"[PAPER] duplicate skipped: pending bet already exists for "
                    f"{order.get('home_team')} vs {order.get('away_team')} ({order['match_id']})"
                )
                return
            bet = Bet(
                match_external_id=order["match_id"],
                home_team=order.get("home_team", ""),
                away_team=order.get("away_team", ""),
                kickoff=kickoff,
                league=order.get("league", ""),
                matchday_id=kickoff[:10] if kickoff else "",
                selection=order["selection"],
                odds=float(order["odds"]),
                stake=float(order["stake"]),
                paper=True,
                status="pending",
                thesis=order.get("thesis", ""),
                placed_at=datetime.utcnow(),
            )
            session.add(bet)
            await session.commit()
            await session.refresh(bet)

        execution = {
            **order,
            "bet_id": str(bet.id),
            "paper": "true",
            "executed_at": datetime.utcnow().isoformat(),
        }
        await publish("trader:executions", execution)
        await self._send_bet_placed_alert(order, str(bet.id))
        self.logger.info(
            f"[PAPER] placed: {order['home_team']} vs {order['away_team']} "
            f"{order['selection']} @ {order['odds']} stake={order['stake']}"
        )
```

- [ ] **Step 3: Run test — expect PASS**

```bash
pytest tests/test_trader_no_betfair.py -v
```
Expected: PASS

- [ ] **Step 4: Run existing trader tests**

```bash
pytest tests/test_trader.py -v 2>&1 | tail -20
```
Expected: all pass (or skip — these tests mock the DB layer, not betfair)

---

## Task 6: Fix agents/tennis_trader.py — remove Betfair live path

**Files:**
- Modify: `agents/tennis_trader.py` — remove `_execute_live_betfair`, route `_execute_live` to paper when no Matchbook

- [ ] **Step 1: Edit agents/tennis_trader.py**

Remove the entire `_execute_live_betfair` method (lines ~111-184).

Replace `_execute_live` method with:
```python
    async def _execute_live(self, order: dict):
        """Route to Matchbook if configured, otherwise paper."""
        match_id = order.get("match_id", "")
        if match_id.startswith("mb_"):
            await self._execute_live_matchbook(order)
        else:
            # No live exchange configured — paper trade
            self.logger.info(
                f"[TENNIS] no exchange for market {match_id} — routing to paper"
            )
            await self._execute_paper(order)
```

Also update `_send_alert` to remove the "Betfair" reference in `exchange_tag`:
```python
    async def _send_alert(self, order: dict, player: str | None, odds: float | None, mode: str = "LIVE"):
        if not self._bot or not settings.TELEGRAM_CHAT_ID:
            return
        edge = order.get("edge", 0)
        if edge < 0.04:
            return
        try:
            emoji = "🟢" if mode.startswith("LIVE") else "🟡"
            exchange_tag = "Matchbook" if "MB" in mode else "Paper"
            msg = (
                f"🎾 [{mode}] TENNIS BET — {exchange_tag}\n"
                f"{order.get('player1')} vs {order.get('player2')}\n"
                f"▶ {player} @ {odds:.2f}  |  Edge +{edge*100:.1f}%\n"
                f"Stake: {order.get('stake', 0):.2f}€  |  {order.get('tournament', '')} ({order.get('surface', '').upper()})\n"
                f"{emoji} Mode: {mode}"
            )
            await self._bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=msg)
        except Exception as e:
            self.logger.warning(f"Telegram alert failed: {e}")
```

- [ ] **Step 2: Smoke test**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "from agents.tennis_trader import TennisTraderAgent; print('OK')"
```
Expected: `OK`

---

## Task 7: Rewrite agents/tennis_settlement.py — no Betfair, bulk-expire stale

This is the file causing thousands of error logs per minute. Remove Betfair entirely. Add:
1. One-shot DB migration that expires all predictions older than 10 days
2. A soft settlement that uses Matchbook's settled markets if configured
3. Graceful "expire" for predictions that can't be resolved

**Files:**
- Modify: `agents/tennis_settlement.py` — complete rewrite

- [ ] **Step 1: Write the failing test**

```python
# tests/test_tennis_settlement_no_betfair.py
import ast, pathlib

def test_tennis_settlement_has_no_betfair():
    src = pathlib.Path("agents/tennis_settlement.py").read_text()
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = getattr(node, 'module', '') or ''
            assert 'betfair' not in module.lower(), f"betfair import: {module}"
```

Run: `pytest tests/test_tennis_settlement_no_betfair.py -v`
Expected: FAIL

- [ ] **Step 2: Rewrite agents/tennis_settlement.py**

Replace the entire file with:

```python
"""
TennisSettlementAgent — resolves tennis match outcomes and settles paper bets.

Without a live exchange:
  1. On first run, bulk-expires all predictions older than STALE_DAYS (no outcome possible).
  2. For recent predictions (< STALE_DAYS, > SETTLEMENT_DELAY_HOURS), tries to resolve
     outcome via Matchbook settled markets if configured.
  3. Predictions that can't be resolved within EXPIRE_AFTER_DAYS are marked "expired".

Runs every POLL_INTERVAL seconds.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from agents.base import BaseAgent
from core.db import AsyncSessionLocal, TennisPrediction, TennisBet, EloRating
from models.elo_surface import EloSurfaceModel
from sqlalchemy import select, update

SETTLEMENT_DELAY_HOURS = 4
EXPIRE_AFTER_DAYS = 7
POLL_INTERVAL = 300

logger = logging.getLogger(__name__)


class TennisSettlementAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisSettlementAgent")
        self._elo = EloSurfaceModel()
        self._stale_expired = False  # run bulk-expire once per process lifetime

    async def _main_loop(self):
        while self._running:
            await self._settlement_cycle()
            await asyncio.sleep(POLL_INTERVAL)

    async def _settlement_cycle(self):
        if not self._stale_expired:
            await self._bulk_expire_stale()
            self._stale_expired = True

        await self._settle_recent()

    async def _bulk_expire_stale(self):
        """Mark all predictions older than EXPIRE_AFTER_DAYS as 'expired' in one query."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=EXPIRE_AFTER_DAYS)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                update(TennisPrediction)
                .where(
                    TennisPrediction.outcome.is_(None),
                    TennisPrediction.computed_at < cutoff,
                )
                .values(outcome="expired", settled_at=datetime.now(timezone.utc))
            )
            await session.commit()
            n = result.rowcount
        if n:
            self.logger.info(f"[SETTLEMENT] bulk-expired {n} stale predictions (> {EXPIRE_AFTER_DAYS}d old)")

    async def _settle_recent(self):
        """Attempt settlement for predictions in the last EXPIRE_AFTER_DAYS days."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=SETTLEMENT_DELAY_HOURS)
        max_age = now - timedelta(days=EXPIRE_AFTER_DAYS)

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisPrediction).where(
                    TennisPrediction.outcome.is_(None),
                    TennisPrediction.computed_at <= cutoff,
                    TennisPrediction.computed_at >= max_age,
                )
            )
            pending = result.scalars().all()

        if not pending:
            return

        resolved = await self._resolve_via_matchbook(pending)
        if not resolved:
            return

        async with AsyncSessionLocal() as session:
            await self._elo.load_from_db_async(session)

        updated = 0
        for pred, winner_position in resolved:
            outcome = "P1_WIN" if winner_position == "P1" else "P2_WIN"
            winner_name = pred.player1 if winner_position == "P1" else pred.player2
            loser_name = pred.player2 if winner_position == "P1" else pred.player1
            surface = pred.surface or "hard"
            self._elo.update(winner_name, loser_name, surface)
            await self._update_prediction(pred.id, outcome, winner_name)
            await self._settle_bets(pred.match_id, outcome)
            updated += 1

        if updated:
            async with AsyncSessionLocal() as session:
                await self._elo.save_to_db_async(session)
            self.logger.info(f"[SETTLEMENT] settled {updated} recent match(es), Elo updated")

    async def _resolve_via_matchbook(self, pending: list) -> list[tuple]:
        """
        Try to resolve outcomes from Matchbook settled markets.
        Returns list of (TennisPrediction, "P1"|"P2") tuples for resolved matches.
        """
        try:
            from core import matchbook_client
            if not matchbook_client.is_configured():
                return []
        except Exception:
            return []

        resolved = []
        for pred in pending:
            try:
                result = await asyncio.to_thread(
                    matchbook_client.get_settled_tennis_result,
                    pred.player1,
                    pred.player2,
                    pred.computed_at,
                )
                if result in ("P1", "P2"):
                    resolved.append((pred, result))
            except Exception as e:
                self.logger.debug(f"matchbook settle lookup failed: {e}")
        return resolved

    async def _update_prediction(self, pred_id: int, outcome: str, winner: str):
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisPrediction).where(TennisPrediction.id == pred_id)
            )
            pred = result.scalar_one_or_none()
            if pred:
                pred.outcome = outcome
                pred.winner = winner
                pred.settled_at = datetime.now(timezone.utc)
                await session.commit()

    async def _settle_bets(self, match_id: str, outcome: str):
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisBet).where(
                    TennisBet.match_id == match_id,
                    TennisBet.status == "pending",
                )
            )
            bets = result.scalars().all()
            for bet in bets:
                won = bet.selection == outcome[:2]
                bet.status = "won" if won else "lost"
                bet.profit_loss = round(bet.stake * (bet.odds - 1), 4) if won else -bet.stake
            if bets:
                await session.commit()
```

- [ ] **Step 3: Run test — expect PASS**

```bash
pytest tests/test_tennis_settlement_no_betfair.py -v
```
Expected: PASS

- [ ] **Step 4: Smoke test import chain**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "from agents.tennis_settlement import TennisSettlementAgent; print('OK')"
```
Expected: `OK`

---

## Task 8: Fix agents/tennis_data_collector.py — remove Betfair, Matchbook-only

**Files:**
- Modify: `agents/tennis_data_collector.py`

- [ ] **Step 1: Edit agents/tennis_data_collector.py**

Remove the entire Betfair block (lines ~24-35):
```python
        # Betfair (primary source — always try even if tennis betting is blocked)
        try:
            bf_markets = await asyncio.to_thread(tennis_betfair_client.get_all_tennis_markets)
            ...
        except Exception as e:
            self.logger.error(f"tennis: Betfair collection error: {e}")
```

Also remove `from core import tennis_betfair_client` from the imports inside `_collect_cycle`.

The new `_collect_cycle` starts directly with Matchbook:
```python
    async def _collect_cycle(self):
        from core import matchbook_client

        markets: list[dict] = []

        if matchbook_client.is_configured():
            try:
                mb_markets = await asyncio.to_thread(matchbook_client.get_tennis_markets)
                if mb_markets:
                    markets.extend(mb_markets)
                    self.logger.info(f"tennis: {len(mb_markets)} markets from Matchbook")
            except Exception as e:
                self.logger.error(f"tennis: Matchbook collection error: {e}")
        else:
            self.logger.debug("tennis: no exchange configured — no tennis markets")

        if markets:
            r = await get_redis()
            payload = json.dumps({
                "markets": markets,
                "collected_at": datetime.utcnow().isoformat(),
                "count": len(markets),
            })
            await r.set("market:tennis", payload, ex=600)
            self.logger.info(f"tennis: {len(markets)} total markets cached")
        else:
            self.logger.debug("tennis: no markets available")
```

- [ ] **Step 2: Smoke test**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "from agents.tennis_data_collector import TennisDataCollectorAgent; print('OK')"
```
Expected: `OK`

---

## Task 9: Full import check — ensure no betfair references remain

- [ ] **Step 1: Grep for remaining betfair references in Python files**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
grep -rn "betfair" --include="*.py" . 2>/dev/null | grep -v "__pycache__" | grep -v "test_"
```
Expected: zero results (or only in test files that are testing the removal)

- [ ] **Step 2: Fix any remaining references found in step 1**

For each result found, open the file, remove the reference. Common locations missed:
- `matchbook_client.py` may have comments mentioning Betfair — remove those too
- Any `context/` files

- [ ] **Step 3: Import the full run.py chain**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "
import run
print('run.py imports OK')
" 2>&1
```
Expected: `run.py imports OK` (no ImportError)

---

## Task 10: Off-season football — data_collector graceful handling

**Files:**
- Modify: `agents/data_collector.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_offseason_handling.py
import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from agents.data_collector import DataCollectorAgent

@pytest.mark.asyncio
async def test_empty_cycles_increase_sleep_interval():
    """After 3 consecutive empty cycles, DataCollector should report off-season and sleep longer."""
    agent = DataCollectorAgent()
    agent._running = True
    agent._consecutive_empty_cycles = 3
    interval = agent._next_interval()
    assert interval >= 1800, f"Expected >= 1800s off-season interval, got {interval}"
```

Run: `pytest tests/test_offseason_handling.py -v`
Expected: FAIL (`AttributeError: _consecutive_empty_cycles` doesn't exist yet)

- [ ] **Step 2: Edit agents/data_collector.py**

In `DataCollectorAgent.__init__`, add:
```python
        self._consecutive_empty_cycles: int = 0
        self._last_offseason_log: float = 0.0
```

Update `_collect_cycle` to track empty cycles. At the end of the loop body, after the `if published:` block, add tracking:
```python
                if published:
                    self._consecutive_empty_cycles = 0
                # else: don't increment here — done per-league isn't right
```

After the for loop over leagues ends (at the end of `_collect_cycle`), add:
```python
        # Track off-season: if no league produced any fixtures this cycle
        total_published = sum(
            1 for _ in range(0)  # placeholder — we'll track via _upcoming_kickoffs length delta
        )
```

Actually, the cleanest approach is to track `published_this_cycle` as a counter:

Replace the entire `_collect_cycle` method signature opening to add a counter:

At the top of `_collect_cycle`, add `published_this_cycle = 0`.

For each `if published:` block, also add `published_this_cycle += published`.

At the **end** of `_collect_cycle`, after the for loop:
```python
        if published_this_cycle == 0:
            self._consecutive_empty_cycles += 1
            import time
            now = time.time()
            if now - self._last_offseason_log >= 3600:
                self.logger.info(
                    f"[OFF-SEASON] no fixtures found ({self._consecutive_empty_cycles} consecutive empty cycles). "
                    "System idle — waiting for new matches."
                )
                self._last_offseason_log = now
        else:
            self._consecutive_empty_cycles = 0
```

Update `_next_interval` to use a longer sleep when off-season:
```python
    def _next_interval(self) -> int:
        if self._consecutive_empty_cycles >= 3:
            return 1800  # 30 minutes — check twice an hour during off-season
        return settings.PREMATCH_REFRESH_INTERVAL if self._has_imminent_match() else settings.DATA_REFRESH_INTERVAL
```

- [ ] **Step 3: Run test — expect PASS**

```bash
pytest tests/test_offseason_handling.py -v
```
Expected: PASS

---

## Task 11: Fix ELO tennis model — add minimum odds filter and better edge threshold

The paper win rate was 33% (226L / 112W). Root cause: the model was betting on markets with no valid odds (odds_p1 = 0.0 → edge calculation becomes `None`, then `None >= 0.04` fails and best_selection is None — but also edge can be None and slip through). Also: 4% edge on tennis is too low given variance. Raise to 6% and add minimum odds filter.

**Files:**
- Modify: `agents/tennis_analyst.py`
- Modify: `agents/tennis_model_agent.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_tennis_edge_filter.py
from agents.tennis_model_agent import TennisModelAgent

def test_prediction_with_no_odds_has_no_best_selection():
    agent = TennisModelAgent()
    market = {
        "player1": "Rafael Nadal",
        "player2": "Novak Djokovic",
        "market_id": "test_123",
        "competition": "Roland Garros",
        "start_time": "2026-06-01T14:00:00Z",
        "odds_p1": 0.0,
        "odds_p2": 0.0,
    }
    pred = agent._predict_match(market)
    assert pred is None or pred.get("best_selection") is None

def test_prediction_low_odds_filtered():
    """Predictions with odds < 1.50 should not be selected even with edge > 0."""
    agent = TennisModelAgent()
    market = {
        "player1": "Carlos Alcaraz",
        "player2": "Unknown Player",
        "market_id": "test_456",
        "competition": "Roland Garros",
        "start_time": "2026-06-01T15:00:00Z",
        "odds_p1": 1.20,  # below minimum 1.50
        "odds_p2": 5.00,
    }
    pred = agent._predict_match(market)
    # P1 has odds 1.20 — should be filtered out regardless of edge
    if pred and pred.get("best_selection") == "P1":
        assert False, "Should not bet on P1 with odds 1.20 (below minimum)"
```

Run: `pytest tests/test_tennis_edge_filter.py -v`
Expected: FAIL (no filter logic exists yet)

- [ ] **Step 2: Edit agents/tennis_model_agent.py — add MIN_ODDS constant and filter**

At the top of the file, after imports, add:
```python
MIN_ODDS = 1.50  # don't bet on heavy favourites — compounded variance kills EV
```

In `_predict_match`, replace the edge selection logic (lines ~114-122):
```python
        if edge_p1 is not None and edge_p2 is not None:
            if edge_p1 >= edge_p2 and edge_p1 > 0:
                best_selection, edge = "P1", edge_p1
            elif edge_p2 > 0:
                best_selection, edge = "P2", edge_p2
            else:
                best_selection, edge = None, max(edge_p1, edge_p2)
        else:
            best_selection, edge = None, None
```

Replace with:
```python
        best_selection = None
        edge = None
        if edge_p1 is not None and edge_p2 is not None:
            # Apply minimum odds filter: skip heavy favourites
            p1_eligible = odds_p1 >= MIN_ODDS
            p2_eligible = odds_p2 >= MIN_ODDS

            if p1_eligible and p2_eligible:
                if edge_p1 >= edge_p2 and edge_p1 > 0:
                    best_selection, edge = "P1", edge_p1
                elif edge_p2 > 0:
                    best_selection, edge = "P2", edge_p2
                else:
                    edge = max(edge_p1, edge_p2)
            elif p1_eligible and edge_p1 > 0:
                best_selection, edge = "P1", edge_p1
            elif p2_eligible and edge_p2 > 0:
                best_selection, edge = "P2", edge_p2
            else:
                edge = max(edge_p1 or 0, edge_p2 or 0)
```

- [ ] **Step 3: Edit agents/tennis_analyst.py — raise min edge to 6%**

Change line 27:
```python
        TENNIS_MIN_EDGE = 0.04
```
to:
```python
        TENNIS_MIN_EDGE = 0.06  # raised from 4% — reduces false positives on low-volume markets
```

Also add an odds filter in the analyst's opportunity check. Replace:
```python
        for pred in predictions:
            edge = pred.get("edge")
            if edge and edge >= TENNIS_MIN_EDGE and pred.get("best_selection"):
                opportunities.append({
```
with:
```python
        TENNIS_MIN_ODDS = 1.50
        for pred in predictions:
            edge = pred.get("edge")
            sel = pred.get("best_selection")
            if not (edge and edge >= TENNIS_MIN_EDGE and sel):
                continue
            odds_key = "odds_p1" if sel == "P1" else "odds_p2"
            if (pred.get(odds_key) or 0.0) < TENNIS_MIN_ODDS:
                continue
            opportunities.append({
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pytest tests/test_tennis_edge_filter.py -v
```
Expected: PASS

- [ ] **Step 5: Also run all tennis-related tests**

```bash
pytest tests/ -k "tennis" -v 2>&1 | tail -20
```
Expected: all pass

---

## Task 12: Fix kickoff refresh — trigger and verify dashboard predictions

**Context:** `app/api/predictions/route.ts` has a `finalKickoff` fix that replaces midnight UTC with api-football.com times. But existing DB records still show midnight. Need to trigger a refresh.

**Files:**
- Modify: `dashboard-web/app/api/predictions/route.ts` — verify the `finalKickoff` logic is active

- [ ] **Step 1: Read and verify the existing fix**

```bash
grep -n "finalKickoff\|midnight\|fmtKickoff\|00:00:00" dashboard-web/app/api/predictions/route.ts | head -20
```

Confirm that the `finalKickoff` variable exists and is used in the upsert INSERT.

- [ ] **Step 2: Trigger a refresh via curl (backend must be running)**

```bash
curl -X POST http://localhost:3000/api/predictions/refresh \
  -H "Content-Type: application/json" \
  -d '{}' 2>&1
```

If the dashboard is running locally. If not, do the refresh directly in the DB:

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "
import asyncio, os
from dotenv import load_dotenv; load_dotenv()
import asyncpg

async def main():
    url = os.getenv('DATABASE_URL','').replace('postgresql+asyncpg','postgresql')
    conn = await asyncpg.connect(url)
    # Reset midnight UTC kickoffs so they get re-fetched
    n = await conn.execute(
        \"UPDATE predictions SET kickoff = NULL WHERE EXTRACT(hour FROM kickoff) = 0 AND EXTRACT(minute FROM kickoff) = 0\"
    )
    print(f'Reset kickoffs: {n}')
    await conn.close()

asyncio.run(main())
"
```

- [ ] **Step 3: Verify predictions have correct kickoffs after the next backend cycle**

Wait one cycle (~15 minutes after backend restart), then:

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "
import asyncio, os
from dotenv import load_dotenv; load_dotenv()
import asyncpg

async def main():
    url = os.getenv('DATABASE_URL','').replace('postgresql+asyncpg','postgresql')
    conn = await asyncpg.connect(url)
    rows = await conn.fetch('SELECT home_team, away_team, kickoff FROM predictions ORDER BY kickoff LIMIT 10')
    for r in rows: print(r['home_team'], 'vs', r['away_team'], '@', r['kickoff'])
    await conn.close()

asyncio.run(main())
"
```

Expected: kickoff times are NOT midnight (00:00 UTC).

---

## Task 13: Full system restart and smoke test

- [ ] **Step 1: Stop the current agents (launchd will restart them)**

```bash
launchctl unload ~/Library/LaunchAgents/com.agentic-markets.agents.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.agentic-markets.watchdog.plist 2>/dev/null
sleep 3
```

- [ ] **Step 2: Test run.py manually — confirm no errors on startup**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
timeout 30 python3 run.py 2>&1 | grep -E "ERROR|WARNING|started|betfair" | head -30
```

Expected output should contain:
- `[DataCollector] INFO started`
- `[TennisModelAgent] INFO started`
- NO lines containing `betfair` or `403`

- [ ] **Step 3: Reload launchd agents**

```bash
launchctl load ~/Library/LaunchAgents/com.agentic-markets.agents.plist
launchctl load ~/Library/LaunchAgents/com.agentic-markets.watchdog.plist
```

- [ ] **Step 4: Verify agents running**

```bash
sleep 5
launchctl print gui/$(id -u)/com.agentic-markets.agents | grep -E "state|pid"
pgrep -f "run.py" && echo "AGENTS RUNNING" || echo "NOT RUNNING"
```

Expected: `state = running` and `AGENTS RUNNING`

- [ ] **Step 5: Check logs for clean startup**

```bash
sleep 15
tail -50 ~/Desktop/sistema-andrea/agentic-markets/logs/launchd.err.log | grep -v "DEBUG"
```

Expected: agent `started` messages, NO `403`, NO `betfair` errors.

- [ ] **Step 6: Verify TennisSettlement ran bulk-expire**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
python3 -c "
import asyncio, os
from dotenv import load_dotenv; load_dotenv()
import asyncpg

async def main():
    url = os.getenv('DATABASE_URL','').replace('postgresql+asyncpg','postgresql')
    conn = await asyncpg.connect(url)
    n = await conn.fetchval(\"SELECT COUNT(*) FROM tennis_predictions WHERE outcome IS NULL\")
    expired = await conn.fetchval(\"SELECT COUNT(*) FROM tennis_predictions WHERE outcome = 'expired'\")
    print(f'still null: {n}, expired: {expired}')
    await conn.close()

asyncio.run(main())
"
```

Expected: `still null` dropped from 55k, `expired` count is high.

---

## Task 14: Run full test suite

- [ ] **Step 1: Run full pytest**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
source venv/bin/activate
pytest tests/ -v --tb=short 2>&1 | tail -40
```

Expected: all tests pass (or only tests that require live Betfair skip/fail — those should now be gone)

- [ ] **Step 2: Commit all changes**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
git add -A
git commit -m "$(cat <<'EOF'
feat: remove Betfair, operationalize paper trading system

- Delete betfair_client.py, betfair_gateway.py, tennis_betfair_client.py
- All trades routed to paper mode until new exchange is connected
- TennisSettlementAgent: bulk-expire 55k stale predictions, remove 403 spam
- DataCollector: off-season handling with 30min sleep when no fixtures
- ELO model: minimum odds filter (>= 1.50), edge raised to 6%
- Analyst + RiskManager: replace 'betfair' with 'matchbook' in sharp keywords

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `grep -r "betfair" --include="*.py" . | grep -v __pycache__` → zero results
- [ ] `python3 run.py` starts without ImportError
- [ ] No `403` errors in logs after 15 minutes
- [ ] `TennisSettlementAgent: bulk-expired N stale predictions` appears in log on first startup
- [ ] DataCollector logs `[OFF-SEASON] no fixtures` once per hour (not every 15 minutes)
- [ ] `pytest tests/ -v` → all pass
- [ ] Tennis analyst uses 6% edge minimum and 1.50 minimum odds
- [ ] Football trader places paper bets (no exchange lookup attempted)
