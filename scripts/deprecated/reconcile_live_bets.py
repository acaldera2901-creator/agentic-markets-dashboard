"""
Reconcile DB rows marked live but missing a Betfair betId.

Only future football bets are eligible. A row is updated as real live only after
Betfair returns a successful instruction report with a betId.
"""
import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from core.betfair_client import (
    find_market,
    get_account_funds,
    get_best_back_price,
)
from core.betfair_gateway import execute_order
from core.db import AsyncSessionLocal, Bet


def _parse_kickoff(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _selection_key(selection: str) -> str:
    normalized = selection.lower()
    if normalized in {"home", "draw", "away"}:
        return normalized
    return {"HOME": "home", "DRAW": "draw", "AWAY": "away"}.get(selection.upper(), normalized)


async def reconcile(execute: bool) -> int:
    now = datetime.now(timezone.utc)
    funds = get_account_funds()
    available = float(funds.get("availableToBetBalance") or 0.0)
    print({"availableToBetBalance": available, "exposure": funds.get("exposure")})

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Bet)
            .where(
                Bet.paper == False,
                Bet.status == "pending",
                (Bet.betfair_bet_id.is_(None)) | (Bet.betfair_bet_id == ""),
            )
            .order_by(Bet.placed_at.asc())
        )
        bets = result.scalars().all()

        placed = 0
        for bet in bets:
            kickoff = _parse_kickoff(bet.kickoff)
            if not kickoff or kickoff <= now:
                print({
                    "id": bet.id,
                    "action": "skip_expired_or_invalid_kickoff",
                    "match": f"{bet.home_team} vs {bet.away_team}",
                    "kickoff": bet.kickoff,
                })
                if execute:
                    bet.status = "expired_unconfirmed"
                continue
            if available < float(bet.stake):
                print({
                    "id": bet.id,
                    "action": "skip_insufficient_balance",
                    "stake": float(bet.stake),
                    "available": available,
                })
                continue

            market = find_market(bet.home_team or "", bet.away_team or "", bet.league or "SA")
            if not market:
                print({
                    "id": bet.id,
                    "action": "skip_market_not_found",
                    "match": f"{bet.home_team} vs {bet.away_team}",
                    "league": bet.league,
                })
                continue

            selection = _selection_key(bet.selection)
            runner_id = int(market["runner_map"].get(selection, 0) or 0)
            if not runner_id:
                print({"id": bet.id, "action": "skip_runner_not_found", "selection": bet.selection})
                continue

            live_odds = get_best_back_price(market["market_id"], runner_id)
            if not live_odds:
                print({"id": bet.id, "action": "skip_no_live_price"})
                continue

            preview = {
                "id": bet.id,
                "action": "place" if execute else "would_place",
                "match": f"{bet.home_team} vs {bet.away_team}",
                "selection": selection,
                "stake": float(bet.stake),
                "db_odds": float(bet.odds),
                "live_odds": float(live_odds),
                "market_id": market["market_id"],
                "runner_id": runner_id,
            }
            print(preview)
            if not execute:
                continue

            execution = execute_order(
                market["market_id"],
                runner_id,
                "BACK",
                float(live_odds),
                float(bet.stake),
                source="script:reconcile_live_bets",
            )
            if not execution.ok:
                if execute:
                    bet.status = "execution_rejected"
                    error = execution.error or "UNKNOWN"
                    note = f"Betfair rejection: {error}"
                    bet.thesis = f"{bet.thesis or ''}\n{note}".strip()
                print({
                    "id": bet.id,
                    "action": "betfair_rejected",
                    "status": execution.raw.get("status"),
                    "errorCode": execution.error,
                })
                continue

            bet.betfair_bet_id = execution.bet_id
            bet.odds = float(execution.odds or live_odds)
            bet.paper = False
            bet.placed_at = datetime.utcnow()
            placed += 1
            available -= float(bet.stake)
            print({"id": bet.id, "action": "confirmed", "betfair_bet_id": execution.bet_id})

        await session.commit()
    return placed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true", help="Actually place eligible Betfair orders")
    args = parser.parse_args()
    placed = asyncio.run(reconcile(execute=args.execute))
    print({"confirmed_live_orders": placed})


if __name__ == "__main__":
    main()
