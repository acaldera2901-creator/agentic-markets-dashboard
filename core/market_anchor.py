"""#PINNACLE-ANCHOR-1 — sharp market anchor selection.

The market price the model de-vigs and blends (core/market_blend,
core/tennis_market_blend) is only as good as the book it comes from. The legacy
selectors picked the *lowest-margin* book across a mix of soft and sharp
bookmakers (``_best_odds``) or simply the first bookmaker listed (tennis
``parse_tennis_odds_events``). That makes the "market" a soft, vig-heavy
consensus.

Pinnacle is the sharpest publicly priced book, so it is the best single-source
market anchor we have. The Odds API already returns it in the ``eu`` region for
the sports we serve (verified live 2026-06-11: WC 71/72, Brazil Serie B 10/10,
WTA Queen's 4/5). This module selects, per event:

  1. ``pinnacle`` when it quotes a COMPLETE market,
  2. else the highest-priority sharp exchange (Betfair / Smarkets / Matchbook),
  3. else the legacy lowest-margin pick across all books (identical to the old
     behaviour — nothing regresses when no sharp book is present).

Every returned dict carries ``anchor_source`` so the caller can log/persist
which tier fed the blend. PURE functions — no I/O, no side effects. The blend
math is untouched: this only changes WHICH prices reach it.
"""
from __future__ import annotations

# Ordered sharp-book fallback after Pinnacle. Exchanges are the next-sharpest
# consensus (low vig, large liquidity). Region suffixes (_eu/_uk) are distinct
# Odds API book keys for the same exchange, so both are listed.
ANCHOR_PRIORITY: tuple[str, ...] = (
    "pinnacle",
    "betfair_ex_eu",
    "betfair_ex_uk",
    "smarkets",
    "matchbook",
)

_SHARP_FALLBACK = ANCHOR_PRIORITY[1:]  # everything below pinnacle


def anchor_source_for_book(bookmaker: str | None) -> str:
    """Re-derive the anchor TIER from a persisted bookmaker key.

    Used where only the chosen book name survived (e.g. tennis_fixtures has
    odds_bookmaker but no odds_anchor_source column). Mirrors the priority used
    by the selectors: pinnacle → "pinnacle", a sharp exchange → "sharp_exchange",
    anything else (or unknown/missing) → "best_margin".
    """
    if not bookmaker:
        return "best_margin"
    if bookmaker == "pinnacle":
        return "pinnacle"
    if bookmaker in _SHARP_FALLBACK:
        return "sharp_exchange"
    return "best_margin"


def _h2h_outcomes(bookmaker: dict, home: str, away: str) -> tuple[float, float, float] | None:
    for market in bookmaker.get("markets", []):
        if market.get("key") != "h2h":
            continue
        prices = {o.get("name"): o.get("price") for o in market.get("outcomes", [])}
        oh, od, oa = prices.get(home), prices.get("Draw"), prices.get(away)
        if oh and od and oa and oh > 0 and od > 0 and oa > 0:
            return float(oh), float(od), float(oa)
    return None


def _2way_outcomes(bookmaker: dict, p1: str, p2: str) -> tuple[float, float] | None:
    for market in bookmaker.get("markets", []):
        if market.get("key") != "h2h":
            continue
        prices = {o.get("name"): o.get("price") for o in market.get("outcomes", [])}
        o1, o2 = prices.get(p1), prices.get(p2)
        if o1 and o2 and o1 > 1.0 and o2 > 1.0:
            return float(o1), float(o2)
    return None


def select_h2h_anchor(event: dict) -> dict | None:
    """Pick the sharpest complete 1X2 market in an Odds API event.

    Returns ``{odds_home, odds_draw, odds_away, bookmaker, anchor_source}`` or
    None when no bookmaker quotes a complete h2h market. ``anchor_source`` is one
    of ``pinnacle`` | ``sharp_exchange`` | ``best_margin``.
    """
    home = event.get("home_team", "")
    away = event.get("away_team", "")
    by_key: dict[str, dict] = {bm.get("key", ""): bm for bm in event.get("bookmakers", [])}

    pinn = by_key.get("pinnacle")
    if pinn is not None and (o := _h2h_outcomes(pinn, home, away)):
        return _h2h_result(home, away, o, "pinnacle", "pinnacle")

    for key in _SHARP_FALLBACK:
        bm = by_key.get(key)
        if bm is not None and (o := _h2h_outcomes(bm, home, away)):
            return _h2h_result(home, away, o, key, "sharp_exchange")

    return _best_margin_h2h(event)


def _h2h_result(home: str, away: str, odds: tuple[float, float, float],
                bookmaker: str, source: str) -> dict:
    oh, od, oa = odds
    return {
        "home_team": home,
        "away_team": away,
        "odds_home": oh,
        "odds_draw": od,
        "odds_away": oa,
        "bookmaker": bookmaker,
        "anchor_source": source,
        "margin": round(1 / oh + 1 / od + 1 / oa - 1, 4),
    }


def _best_margin_h2h(event: dict) -> dict | None:
    """Legacy lowest-overround pick across all books (final fallback)."""
    home = event.get("home_team", "")
    away = event.get("away_team", "")
    best: dict | None = None
    best_margin = float("inf")
    for bm in event.get("bookmakers", []):
        o = _h2h_outcomes(bm, home, away)
        if not o:
            continue
        oh, od, oa = o
        margin = 1 / oh + 1 / od + 1 / oa - 1
        if margin < best_margin:
            best_margin = margin
            best = _h2h_result(home, away, o, bm.get("key", ""), "best_margin")
    return best


def select_2way_anchor(event: dict) -> dict | None:
    """2-way (tennis) analogue of select_h2h_anchor.

    Returns ``{odds_p1, odds_p2, bookmaker, anchor_source}`` or None.
    """
    p1 = event.get("home_team", "")
    p2 = event.get("away_team", "")
    by_key: dict[str, dict] = {bm.get("key", ""): bm for bm in event.get("bookmakers", [])}

    pinn = by_key.get("pinnacle")
    if pinn is not None and (o := _2way_outcomes(pinn, p1, p2)):
        return _2way_result(o, "pinnacle", "pinnacle")

    for key in _SHARP_FALLBACK:
        bm = by_key.get(key)
        if bm is not None and (o := _2way_outcomes(bm, p1, p2)):
            return _2way_result(o, key, "sharp_exchange")

    best: dict | None = None
    best_margin = float("inf")
    for bm in event.get("bookmakers", []):
        o = _2way_outcomes(bm, p1, p2)
        if not o:
            continue
        margin = 1 / o[0] + 1 / o[1] - 1
        if margin < best_margin:
            best_margin = margin
            best = _2way_result(o, bm.get("key", ""), "best_margin")
    return best


def _2way_result(odds: tuple[float, float], bookmaker: str, source: str) -> dict:
    o1, o2 = odds
    return {
        "odds_p1": o1,
        "odds_p2": o2,
        "bookmaker": bookmaker,
        "anchor_source": source,
        "margin": round(1 / o1 + 1 / o2 - 1, 4),
    }
