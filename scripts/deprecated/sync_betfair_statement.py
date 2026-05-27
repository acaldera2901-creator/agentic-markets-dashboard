"""
Sync settled Betfair account statement rows into the local bets ledger.

This is intentionally conservative:
- existing bets are matched by betfair_bet_id and updated to Betfair's net result;
- missing Betfair statement bets are imported as live, settled audit rows;
- deposits/credits that are not bets are ignored.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.betfair_client import get_account_funds, get_account_statement
from core.db import AsyncSessionLocal, Bet


@dataclass
class StatementBet:
    ref_id: str
    amount: float
    item_date: datetime
    placed_at: datetime
    market_name: str
    selection_name: str
    bet_type: str
    odds: float
    stake: float
    event_id: str
    win_lose: str

    @property
    def status(self) -> str:
        return "won" if self.amount > 0 else "lost"


def _parse_dt(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _clean_market_name(value: str) -> str:
    return value.replace("Fixtures 17 May / ", "").replace("Fixtures 16 May / ", "").replace("/ Match Odds", "").strip()


def _selection(legacy: dict[str, Any]) -> str:
    name = legacy.get("selectionName") or "Unknown"
    if legacy.get("betType") == "L":
        return f"lay {name}"
    return str(name)


def _statement_rows(days: int) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    return get_account_statement({
        "fromRecord": 0,
        "recordCount": 100,
        "itemDateRange": {
            "from": (now - timedelta(days=days)).isoformat().replace("+00:00", "Z"),
            "to": now.isoformat().replace("+00:00", "Z"),
        },
        "includeItem": "ALL",
        "wallet": "UK",
    }).get("accountStatement", [])


def _aggregate_statement_bets(rows: list[dict[str, Any]]) -> list[StatementBet]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        legacy = row.get("legacyData") or {}
        ref_id = str(row.get("refId") or "")
        market = str(legacy.get("fullMarketName") or "")
        if not ref_id or not market or market == "Credit":
            continue
        if legacy.get("eventTypeId") != 1:
            continue
        grouped[ref_id].append(row)

    bets: list[StatementBet] = []
    for ref_id, items in grouped.items():
        amount = round(sum(float(item.get("amount") or 0) for item in items), 2)
        if amount == 0:
            continue
        primary = next(
            (item for item in items if (item.get("legacyData") or {}).get("selectionName")),
            items[0],
        )
        legacy = primary.get("legacyData") or {}
        item_date = max(_parse_dt(item.get("itemDate")) for item in items)
        bets.append(StatementBet(
            ref_id=ref_id,
            amount=amount,
            item_date=item_date,
            placed_at=_parse_dt(legacy.get("placedDate")),
            market_name=_clean_market_name(str(legacy.get("fullMarketName") or ref_id)),
            selection_name=_selection(legacy),
            bet_type=str(legacy.get("betType") or "B"),
            odds=float(legacy.get("avgPrice") or legacy.get("avgPriceRaw") or 0),
            stake=float(legacy.get("betSize") or 0),
            event_id=str(legacy.get("eventId") or ref_id),
            win_lose=str(legacy.get("winLose") or ""),
        ))
    return sorted(bets, key=lambda b: b.item_date)


async def sync(days: int, dry_run: bool) -> dict[str, Any]:
    funds = get_account_funds()
    bets = _aggregate_statement_bets(_statement_rows(days))
    actions: list[dict[str, Any]] = []

    async with AsyncSessionLocal() as session:
      for stmt in bets:
        result = await session.execute(select(Bet).where(Bet.betfair_bet_id == stmt.ref_id))
        bet = result.scalar_one_or_none()
        action = "update" if bet else "insert"

        if not bet:
            bet = Bet(
                match_external_id=f"betfair:{stmt.event_id}:{stmt.ref_id}",
                home_team=stmt.market_name,
                away_team="",
                kickoff=None,
                league="BF",
                matchday_id=stmt.item_date.date().isoformat(),
                selection=stmt.selection_name,
                odds=stmt.odds,
                stake=stmt.stake,
                paper=False,
                betfair_bet_id=stmt.ref_id,
                thesis="Imported from Betfair account statement.",
                placed_at=stmt.placed_at.replace(tzinfo=None),
            )
            session.add(bet)

        bet.status = stmt.status
        bet.profit_loss = stmt.amount
        bet.settled_at = stmt.item_date.replace(tzinfo=None)
        if not bet.home_team:
            bet.home_team = stmt.market_name
        if not bet.league:
            bet.league = "BF"
        if not bet.odds:
            bet.odds = stmt.odds
        if not bet.stake:
            bet.stake = stmt.stake

        actions.append({
            "action": action,
            "ref_id": stmt.ref_id,
            "market": stmt.market_name,
            "selection": stmt.selection_name,
            "status": stmt.status,
            "amount": stmt.amount,
        })

      if dry_run:
        await session.rollback()
      else:
        await session.commit()

    return {"dry_run": dry_run, "funds": funds, "actions": actions}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    result = asyncio.run(sync(days=args.days, dry_run=not args.execute))
    for action in result["actions"]:
        print(action)
    funds = result["funds"]
    print({
        "dry_run": result["dry_run"],
        "availableToBetBalance": funds.get("availableToBetBalance"),
        "exposure": funds.get("exposure"),
        "actions": len(result["actions"]),
    })


if __name__ == "__main__":
    main()
