"""Shadow-eval collector — join served predictions to Stake/Roobet, emit rows.

Pure assembly (build_rows_for_*) + a thin async runner (collect_once). The
assembly joins a served prediction to the latest per-book quotes by
team_pair_key (SAME recipe as the scraper's _pair_key) and produces one
sportsbook_shadow_eval row per book leg: 'stake', 'roobet', and 'combined'
(best line per outcome across both books — the "if we shopped both" case).

Forward-only and read-only w.r.t. the served path: it READS unified/tennis
predictions and odds_snapshots, WRITES only sportsbook_shadow_eval. The model
never reads any of this.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx

from config.settings import settings
from core.odds_api_client import football_pair_key, normalize_name
from core.tennis_names import canonical_player_key
from core import sportsbook_shadow as ss

logger = logging.getLogger("shadow_collector")

BOOKS = ("stake", "roobet")
_ALL_LEGS = ("stake", "roobet", "combined")


def tennis_pair_key_for(p1: str, p2: str, scheduled_at: str | None) -> str | None:
    if not p1 or not p2:
        return None
    day = str(scheduled_at or "")[:10]
    if not day:
        return None
    k = sorted([canonical_player_key(p1), canonical_player_key(p2)])
    if not k[0] or not k[1] or k[0] == k[1]:
        return None
    return f"{day}:{k[0]}|{k[1]}"


def football_pair_key_for(home: str, away: str, starts_at: str | None) -> str | None:
    # Reuse the served recipe (canonical_team_name + normalize_name). NB: the
    # scraper builds its football key from normalize_name WITHOUT
    # canonical_team_name; for clubs that map is a passthrough so keys align,
    # for national teams they may diverge (surfaced in the coverage report).
    return football_pair_key(home, away, starts_at)


def _combined_football(books: dict) -> dict | None:
    """Best (highest) decimal odds per outcome across the available books."""
    legs = [b for b in (books.get(x) for x in BOOKS) if b]
    if not legs:
        return None
    out = {}
    for k in ("odds_home", "odds_draw", "odds_away"):
        vals = [b.get(k) for b in legs if _pos(b.get(k))]
        out[k] = max(vals) if vals else None
    return out


def _combined_tennis(books: dict) -> dict | None:
    legs = [b for b in (books.get(x) for x in BOOKS) if b]
    if not legs:
        return None
    out = {}
    for k in ("odds_p1", "odds_p2"):
        vals = [b.get(k) for b in legs if _pos(b.get(k))]
        out[k] = max(vals) if vals else None
    return out


def _pos(v) -> bool:
    try:
        return float(v) > 1.0
    except (TypeError, ValueError):
        return False


def _odds_on_pick_football(book: dict | None, pick_idx: int) -> float | None:
    if not book:
        return None
    return [book.get("odds_home"), book.get("odds_draw"), book.get("odds_away")][pick_idx]


def _odds_on_pick_tennis(book: dict | None, pick_idx: int) -> float | None:
    if not book:
        return None
    return [book.get("odds_p1"), book.get("odds_p2")][pick_idx]


def build_rows_for_football(pred: dict, books: dict) -> list[dict]:
    """books: {'stake': {...}, 'roobet': {...}} (missing key = no quote)."""
    base = (
        float(pred.get("p_home") or 0.0),
        float(pred.get("p_draw") or 0.0),
        float(pred.get("p_away") or 0.0),
    )
    base_pick = ss.argmax_pick(base)
    pair = football_pair_key_for(
        pred.get("home_team") or "", pred.get("away_team") or "", pred.get("starts_at")
    )
    legs = {"stake": books.get("stake"), "roobet": books.get("roobet"),
            "combined": _combined_football(books)}
    captured = datetime.now(timezone.utc).isoformat()
    rows = []
    for book_name in _ALL_LEGS:
        book = legs.get(book_name)
        leg = ss.build_football_shadow(base_probs=base, book=book)
        shadow = (leg["shadow_p_home"], leg["shadow_p_draw"], leg["shadow_p_away"])
        shadow_pick = ss.argmax_pick(shadow)
        rows.append({
            "prediction_ref": str(pred.get("id") or pred.get("external_event_id") or ""),
            "ref_source": "unified_predictions",
            "sport": "football",
            "team_pair_key": pair,
            "league": pred.get("league"),
            "home_team": pred.get("home_team"),
            "away_team": pred.get("away_team"),
            "commence_time": pred.get("starts_at"),
            "base_p_home": base[0], "base_p_draw": base[1], "base_p_away": base[2],
            "base_pick": base_pick,
            "base_pick_odds": _odds_on_pick_football(book, base_pick),
            "book": book_name,
            "matched": leg["matched"],
            "book_p_home": leg["book_p_home"], "book_p_draw": leg["book_p_draw"],
            "book_p_away": leg["book_p_away"],
            "shadow_p_home": shadow[0], "shadow_p_draw": shadow[1], "shadow_p_away": shadow[2],
            "shadow_pick": shadow_pick,
            "taken_odds": _odds_on_pick_football(book, shadow_pick),
            "blend_alpha": ss.MARKET_BLEND_ALPHA if leg["matched"] else None,
            "captured_at": captured,
        })
    return rows


def build_rows_for_tennis(pred: dict, books: dict) -> list[dict]:
    base = (float(pred.get("p1") or 0.0), float(pred.get("p2") or 0.0))
    base_pick = ss.argmax_pick(base)
    pair = tennis_pair_key_for(
        pred.get("player1") or "", pred.get("player2") or "", pred.get("scheduled_at")
    )
    legs = {"stake": books.get("stake"), "roobet": books.get("roobet"),
            "combined": _combined_tennis(books)}
    captured = datetime.now(timezone.utc).isoformat()
    rows = []
    for book_name in _ALL_LEGS:
        book = legs.get(book_name)
        leg = ss.build_tennis_shadow(base_probs=base, book=book)
        shadow = (leg["shadow_p1"], leg["shadow_p2"])
        shadow_pick = ss.argmax_pick(shadow)
        # tennis stores p1/p2 in the home/away slots (draw=NULL), outcome_idx
        # 0=p1, 2=p2 so the metric helpers reuse the 3-way machinery; map the
        # 2-way pick (0/1) onto 0/2.
        shadow_pick_3 = 0 if shadow_pick == 0 else 2
        base_pick_3 = 0 if base_pick == 0 else 2
        rows.append({
            "prediction_ref": str(pred.get("match_id") or ""),
            "ref_source": "tennis_predictions",
            "sport": "tennis",
            "team_pair_key": pair,
            "league": pred.get("tournament"),
            "home_team": pred.get("player1"),
            "away_team": pred.get("player2"),
            "commence_time": pred.get("scheduled_at"),
            "base_p_home": base[0], "base_p_draw": None, "base_p_away": base[1],
            "base_pick": base_pick_3,
            "base_pick_odds": _odds_on_pick_tennis(book, base_pick),
            "book": book_name,
            "matched": leg["matched"],
            "book_p_home": leg["book_p1"], "book_p_draw": None,
            "book_p_away": leg["book_p2"],
            "shadow_p_home": shadow[0], "shadow_p_draw": None, "shadow_p_away": shadow[1],
            "shadow_pick": shadow_pick_3,
            "taken_odds": _odds_on_pick_tennis(book, shadow_pick),
            "blend_alpha": ss.TENNIS_MARKET_BLEND_ALPHA if leg["matched"] else None,
            "captured_at": captured,
        })
    return rows


# ─── async runner (DB I/O) ─────────────────────────────────────────────────────

def _headers() -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def _rest() -> str | None:
    url = (settings.SUPABASE_URL or "").rstrip("/")
    if not url or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    return f"{url}/rest/v1"


async def _latest_book_quotes(
    client: httpx.AsyncClient, base: str, pair_keys: list[str]
) -> dict[str, dict[str, dict]]:
    """Latest non-closing Stake/Roobet quote per (pair_key, book).

    Returns {pair_key: {book: {odds_...}}}. One PostgREST call per chunk of
    keys; we keep only the most recent capture per (key, book).
    """
    out: dict[str, dict[str, dict]] = {}
    if not pair_keys:
        return out
    CHUNK = 40
    for i in range(0, len(pair_keys), CHUNK):
        chunk = pair_keys[i:i + CHUNK]
        in_list = ",".join(f'"{k}"' for k in chunk)
        params = {
            "select": "team_pair_key,source,odds_home,odds_draw,odds_away,captured_at",
            "source": "in.(stake,roobet)",
            "team_pair_key": f"in.({in_list})",
            "order": "captured_at.desc",
            "limit": "2000",
        }
        try:
            resp = await client.get(
                f"{base}/odds_snapshots", params=params, headers=_headers()
            )
            if resp.status_code != 200:
                logger.warning("book-quote fetch failed: %s %s",
                               resp.status_code, resp.text[:200])
                continue
            for r in resp.json() or []:
                key, book = r["team_pair_key"], r["source"]
                slot = out.setdefault(key, {})
                if book in slot:  # already have a more recent capture (desc order)
                    continue
                if r.get("odds_draw") is None:  # tennis 2-way row
                    slot[book] = {"odds_p1": r.get("odds_home"), "odds_p2": r.get("odds_away")}
                else:
                    slot[book] = {
                        "odds_home": r.get("odds_home"),
                        "odds_draw": r.get("odds_draw"),
                        "odds_away": r.get("odds_away"),
                    }
        except Exception as exc:
            logger.warning("book-quote fetch error: %s", exc)
    return out


async def _fetch_served_football(client: httpx.AsyncClient, base: str) -> list[dict]:
    params = {
        "select": "id,external_event_id,league,home_team,away_team,starts_at,notes,pick",
        "sport": "eq.football",
        "is_historical": "eq.false",
        "starts_at": f"gt.{datetime.now(timezone.utc).isoformat()}",
        "order": "starts_at.asc",
        "limit": "200",
    }
    resp = await client.get(f"{base}/unified_predictions", params=params, headers=_headers())
    if resp.status_code != 200:
        return []
    out = []
    for r in resp.json() or []:
        try:
            n = json.loads(r.get("notes") or "{}")
        except (TypeError, ValueError):
            n = {}
        if not all(k in n for k in ("p_home", "p_draw", "p_away")):
            continue  # no served distribution -> nothing to shadow
        out.append({**r, "p_home": n["p_home"], "p_draw": n["p_draw"], "p_away": n["p_away"]})
    return out


async def _fetch_served_tennis(client: httpx.AsyncClient, base: str) -> list[dict]:
    params = {
        "select": "match_id,player1,player2,scheduled_at,tournament,p1,p2",
        "scheduled_at": f"gt.{datetime.now(timezone.utc).isoformat()}",
        "outcome": "is.null",
        "order": "scheduled_at.asc",
        "limit": "300",
    }
    resp = await client.get(f"{base}/tennis_predictions", params=params, headers=_headers())
    if resp.status_code != 200:
        return []
    return [r for r in (resp.json() or [])
            if r.get("p1") is not None and r.get("p2") is not None
            and "TBD" not in (r.get("player1") or "", r.get("player2") or "")]


# insert-on-change state, keyed by (prediction_ref, book) -> probability signature
_state: dict[tuple[str, str], tuple] = {}


def _changed(row: dict) -> bool:
    key = (row["prediction_ref"], row["book"])
    sig = (
        round(row.get("shadow_p_home") or 0, 4),
        round(row.get("shadow_p_away") or 0, 4),
        bool(row["matched"]),
    )
    if _state.get(key) == sig:
        return False
    _state[key] = sig
    return True


async def collect_once() -> int:
    """One collection cycle: join served preds to latest book quotes, write
    shadow rows (insert-on-change). Returns rows written. Fail-soft."""
    base = _rest()
    if not base:
        return 0
    from core.supabase_client import insert_shadow_eval_rows

    written = 0
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            football = await _fetch_served_football(client, base)
            tennis = await _fetch_served_tennis(client, base)

            fb_keys = {football_pair_key_for(p["home_team"], p["away_team"], p["starts_at"])
                       for p in football}
            tn_keys = {tennis_pair_key_for(p["player1"], p["player2"], p["scheduled_at"])
                       for p in tennis}
            all_keys = [k for k in (fb_keys | tn_keys) if k]
            quotes = await _latest_book_quotes(client, base, all_keys)

            rows: list[dict] = []
            for p in football:
                pair = football_pair_key_for(p["home_team"], p["away_team"], p["starts_at"])
                rows += build_rows_for_football(p, quotes.get(pair, {}))
            for p in tennis:
                pair = tennis_pair_key_for(p["player1"], p["player2"], p["scheduled_at"])
                rows += build_rows_for_tennis(p, quotes.get(pair, {}))

            fresh = [r for r in rows if _changed(r)]
            if fresh:
                written = await insert_shadow_eval_rows(fresh)
                logger.info("shadow-eval: %d rows written (%d candidates)", written, len(fresh))
    except Exception as exc:
        logger.warning("shadow collect_once failed (non-fatal): %s", exc)
    return written
