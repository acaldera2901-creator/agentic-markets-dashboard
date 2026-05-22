"""
Local Betfair CLI for Agentic Markets.

Examples:
  .venv/bin/python scripts/betfair_cli.py funds
  .venv/bin/python scripts/betfair_cli.py statement --days 7
  .venv/bin/python scripts/betfair_cli.py markets --league SA
  .venv/bin/python scripts/betfair_cli.py find --home "Inter" --away "Verona" --league SA
  .venv/bin/python scripts/betfair_cli.py book --market-id 1.23456789
  .venv/bin/python scripts/betfair_cli.py place --market-id 1.234 --selection-id 123 --side BACK --odds 2.1 --stake 2
  .venv/bin/python scripts/betfair_cli.py place --market-id 1.234 --selection-id 123 --side BACK --odds 2.1 --stake 2 --execute --yes
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.betfair_client import (  # noqa: E402
    cancel_orders,
    find_market,
    get_account_funds,
    get_account_statement,
    get_market_odds,
    list_cleared_orders,
    list_current_orders,
    list_markets,
)
from core.betfair_gateway import execute_order  # noqa: E402
from core.tennis_betfair_client import list_tennis_markets  # noqa: E402
from scripts.sync_betfair_statement import sync as sync_statement  # noqa: E402


def _print_json(value: Any) -> None:
    print(json.dumps(value, indent=2, ensure_ascii=False, default=str))


def _fmt_money(value: Any) -> str:
    try:
        return f"€{float(value):.2f}"
    except Exception:
        return "—"


def _rows(headers: list[str], rows: list[list[Any]]) -> None:
    widths = [len(h) for h in headers]
    rendered = [[str(cell) for cell in row] for row in rows]
    for row in rendered:
        widths = [max(widths[i], len(row[i])) for i in range(len(headers))]
    fmt = "  ".join("{:<" + str(w) + "}" for w in widths)
    print(fmt.format(*headers))
    print(fmt.format(*["-" * w for w in widths]))
    for row in rendered:
        print(fmt.format(*row))


def _date_range(days: int) -> dict[str, str]:
    now = datetime.now(timezone.utc)
    return {
        "from": (now - timedelta(days=days)).isoformat().replace("+00:00", "Z"),
        "to": now.isoformat().replace("+00:00", "Z"),
    }


def cmd_funds(args: argparse.Namespace) -> None:
    funds = get_account_funds()
    if args.json:
        _print_json(funds)
        return
    _rows(["metric", "value"], [
        ["available", _fmt_money(funds.get("availableToBetBalance"))],
        ["exposure", _fmt_money(funds.get("exposure"))],
        ["retained commission", _fmt_money(funds.get("retainedCommission"))],
        ["wallet", funds.get("wallet", "—")],
    ])


def cmd_statement(args: argparse.Namespace) -> None:
    statement = get_account_statement({
        "fromRecord": 0,
        "recordCount": args.limit,
        "itemDateRange": _date_range(args.days),
        "includeItem": "ALL",
        "wallet": "UK",
    })
    rows = statement.get("accountStatement", [])
    if args.json:
        _print_json(statement)
        return
    table = []
    for row in rows:
        legacy = row.get("legacyData") or {}
        table.append([
            row.get("itemDate", "")[:19].replace("T", " "),
            row.get("refId", ""),
            _fmt_money(row.get("amount")),
            _fmt_money(row.get("balance")),
            legacy.get("winLose", ""),
            legacy.get("selectionName") or "",
            (legacy.get("fullMarketName") or "Credit").replace("Fixtures ", ""),
        ])
    _rows(["date", "ref", "amount", "balance", "result", "selection", "market"], table)


def cmd_markets(args: argparse.Namespace) -> None:
    markets = list_markets(args.league, days_ahead=args.days)
    if args.json:
        _print_json(markets)
        return
    table = []
    for market in markets[:args.limit]:
        runners = ", ".join(r.get("runnerName", "") for r in market.get("runners", []))
        table.append([
            market.get("marketId", ""),
            market.get("marketStartTime", ""),
            market.get("event", {}).get("name", ""),
            runners,
        ])
    _rows(["market_id", "start", "event", "runners"], table)


def cmd_tennis_markets(args: argparse.Namespace) -> None:
    markets = list_tennis_markets(days_ahead=args.days)
    if args.json:
        _print_json(markets[:args.limit])
        return
    table = []
    for market in markets[:args.limit]:
        runners = ", ".join(r.get("runnerName", "") for r in market.get("runners", []))
        table.append([
            market.get("marketId", ""),
            market.get("marketStartTime", ""),
            market.get("event", {}).get("name", ""),
            market.get("competition", {}).get("name", ""),
            runners,
        ])
    _rows(["market_id", "start", "event", "competition", "runners"], table)


def cmd_find(args: argparse.Namespace) -> None:
    market = find_market(args.home, args.away, args.league)
    if args.json:
        _print_json(market or {})
        return
    if not market:
        print("No market found.")
        return
    _rows(["field", "value"], [
        ["market_id", market.get("market_id", "")],
        ["event", market.get("event_name", "")],
        ["start", market.get("start_time", "")],
        ["home selection", market.get("runner_map", {}).get("home", "")],
        ["draw selection", market.get("runner_map", {}).get("draw", "")],
        ["away selection", market.get("runner_map", {}).get("away", "")],
    ])


def cmd_book(args: argparse.Namespace) -> None:
    book = get_market_odds(args.market_id)
    if args.json:
        _print_json(book)
        return
    rows = []
    for runner in (book[0].get("runners", []) if book else []):
        ex = runner.get("ex") or {}
        back = (ex.get("availableToBack") or [{}])[0]
        lay = (ex.get("availableToLay") or [{}])[0]
        rows.append([
            runner.get("selectionId", ""),
            runner.get("status", ""),
            back.get("price", "—"),
            back.get("size", "—"),
            lay.get("price", "—"),
            lay.get("size", "—"),
        ])
    _rows(["selection_id", "status", "back", "back_size", "lay", "lay_size"], rows)


def cmd_orders(args: argparse.Namespace) -> None:
    orders = list_current_orders([args.bet_id] if args.bet_id else None)
    if args.json:
        _print_json(orders)
        return
    rows = []
    for order in orders.get("currentOrders", []):
        rows.append([
            order.get("betId", ""),
            order.get("marketId", ""),
            order.get("selectionId", ""),
            order.get("side", ""),
            order.get("priceSize", {}).get("price", ""),
            order.get("priceSize", {}).get("size", ""),
            order.get("status", ""),
        ])
    _rows(["bet_id", "market_id", "selection", "side", "price", "size", "status"], rows)


def cmd_cleared(args: argparse.Namespace) -> None:
    cleared = list_cleared_orders({
        "betStatus": args.status,
        "settledDateRange": _date_range(args.days),
    })
    if args.json:
        _print_json(cleared)
        return
    rows = []
    for order in cleared.get("clearedOrders", [])[:args.limit]:
        rows.append([
            order.get("betId", ""),
            order.get("marketId", ""),
            order.get("selectionId", ""),
            order.get("side", ""),
            order.get("priceRequested", ""),
            order.get("sizeSettled", ""),
            order.get("profit", ""),
        ])
    _rows(["bet_id", "market_id", "selection", "side", "price", "settled", "profit"], rows)


def cmd_place(args: argparse.Namespace) -> None:
    payload = {
        "market_id": args.market_id,
        "selection_id": args.selection_id,
        "side": args.side.upper(),
        "odds": args.odds,
        "stake": args.stake,
    }
    if not args.execute:
        print("DRY RUN. Add --execute --yes to place this order.")
        _print_json(payload)
        return
    if not args.yes:
        raise SystemExit("Refusing live order without --yes.")
    execution = execute_order(
        args.market_id,
        args.selection_id,
        args.side,
        args.odds,
        args.stake,
        source="manual-cli",
    )
    if not execution.ok:
        raise SystemExit(f"Betfair order not confirmed: {execution.error} | {execution.raw}")
    _print_json({
        "ok": execution.ok,
        "bet_id": execution.bet_id,
        "market_id": execution.market_id,
        "selection_id": execution.selection_id,
        "side": execution.side,
        "odds": execution.odds,
        "stake": execution.stake,
        "source": execution.source,
        "raw": execution.raw,
    })


def cmd_cancel(args: argparse.Namespace) -> None:
    payload = {"market_id": args.market_id, "bet_ids": args.bet_ids or "ALL cancellable in market"}
    if not args.execute:
        print("DRY RUN. Add --execute --yes to cancel.")
        _print_json(payload)
        return
    if not args.yes:
        raise SystemExit("Refusing cancel without --yes.")
    _print_json(cancel_orders(args.market_id, args.bet_ids))


def cmd_sync_statement(args: argparse.Namespace) -> None:
    result = asyncio.run(sync_statement(args.days, dry_run=not args.execute))
    if args.json:
        _print_json(result)
        return
    rows = [
        [a["action"], a["ref_id"], a["market"], a["selection"], a["status"], _fmt_money(a["amount"])]
        for a in result["actions"]
    ]
    _rows(["action", "ref", "market", "selection", "status", "amount"], rows)
    print({
        "dry_run": result["dry_run"],
        "availableToBetBalance": result["funds"].get("availableToBetBalance"),
        "exposure": result["funds"].get("exposure"),
        "actions": len(result["actions"]),
    })


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="betfair-cli")
    parser.add_argument("--json", action="store_true", help="Print raw JSON.")
    sub = parser.add_subparsers(dest="command", required=True)

    funds = sub.add_parser("funds", help="Show account funds.")
    funds.set_defaults(func=cmd_funds)

    statement = sub.add_parser("statement", help="Show account statement.")
    statement.add_argument("--days", type=int, default=7)
    statement.add_argument("--limit", type=int, default=25)
    statement.set_defaults(func=cmd_statement)

    markets = sub.add_parser("markets", help="List MATCH_ODDS markets by league.")
    markets.add_argument("--league", default="SA")
    markets.add_argument("--days", type=int, default=14)
    markets.add_argument("--limit", type=int, default=25)
    markets.set_defaults(func=cmd_markets)

    tennis_markets = sub.add_parser("tennis-markets", help="List Betfair tennis MATCH_ODDS markets.")
    tennis_markets.add_argument("--days", type=int, default=3)
    tennis_markets.add_argument("--limit", type=int, default=25)
    tennis_markets.set_defaults(func=cmd_tennis_markets)

    find = sub.add_parser("find", help="Find a market by teams.")
    find.add_argument("--home", required=True)
    find.add_argument("--away", required=True)
    find.add_argument("--league", default="SA")
    find.set_defaults(func=cmd_find)

    book = sub.add_parser("book", help="Show best prices for one market.")
    book.add_argument("--market-id", required=True)
    book.set_defaults(func=cmd_book)

    orders = sub.add_parser("orders", help="Show current orders.")
    orders.add_argument("--bet-id")
    orders.set_defaults(func=cmd_orders)

    cleared = sub.add_parser("cleared", help="Show cleared order history.")
    cleared.add_argument("--status", default="SETTLED", choices=["SETTLED", "VOIDED", "LAPSED", "CANCELLED"])
    cleared.add_argument("--days", type=int, default=7)
    cleared.add_argument("--limit", type=int, default=25)
    cleared.set_defaults(func=cmd_cleared)

    place = sub.add_parser("place", help="Place BACK/LAY order. Dry-run unless --execute --yes.")
    place.add_argument("--market-id", required=True)
    place.add_argument("--selection-id", type=int, required=True)
    place.add_argument("--side", choices=["BACK", "LAY", "back", "lay"], required=True)
    place.add_argument("--odds", type=float, required=True)
    place.add_argument("--stake", type=float, required=True)
    place.add_argument("--execute", action="store_true")
    place.add_argument("--yes", action="store_true")
    place.set_defaults(func=cmd_place)

    cancel = sub.add_parser("cancel", help="Cancel orders. Dry-run unless --execute --yes.")
    cancel.add_argument("--market-id", required=True)
    cancel.add_argument("--bet-ids", nargs="*")
    cancel.add_argument("--execute", action="store_true")
    cancel.add_argument("--yes", action="store_true")
    cancel.set_defaults(func=cmd_cancel)

    sync = sub.add_parser("sync-statement", help="Sync Betfair statement into DB ledger.")
    sync.add_argument("--days", type=int, default=7)
    sync.add_argument("--execute", action="store_true")
    sync.set_defaults(func=cmd_sync_statement)

    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
