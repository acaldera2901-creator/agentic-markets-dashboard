import httpx
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from config.settings import settings
from core.market_anchor import select_h2h_anchor, _best_margin_h2h

BASE_URL = "https://api.the-odds-api.com/v4"

logger = logging.getLogger("odds_api_client")

# ─── Active-sports filter (quota guard) ───────────────────────────────────────
# The /sports endpoint is FREE on The Odds API and lists in-season sport keys.
# Querying odds for an out-of-season key still burns paid credits, so every
# odds call first checks this cached set. Fail-open: if the listing call
# fails, behave as before (query everything) rather than blinding the system.

_ACTIVE_KEYS_TTL_SECONDS = 30 * 60
_active_keys_cache: tuple[float, frozenset[str]] | None = None


async def get_active_sport_keys() -> frozenset[str] | None:
    """Return the in-season sport keys, or None when the free listing fails."""
    global _active_keys_cache
    if not settings.ODDS_API_KEY:
        return None
    now = time.monotonic()
    if _active_keys_cache and now - _active_keys_cache[0] < _ACTIVE_KEYS_TTL_SECONDS:
        return _active_keys_cache[1]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BASE_URL}/sports",
                params={"apiKey": settings.ODDS_API_KEY},
            )
        if resp.status_code != 200:
            return None
        keys = frozenset(
            s.get("key", "") for s in resp.json() if s.get("active") is True
        )
        _active_keys_cache = (now, keys)
        return keys
    except Exception:
        return None

SPORT_KEYS = {
    "PL": "soccer_epl",
    "SA": "soccer_italy_serie_a",
    "PD": "soccer_spain_la_liga",
    "BL1": "soccer_germany_bundesliga",
    "FL1": "soccer_france_ligue_one",
    "CL": "soccer_uefa_champs_league",
    "EL": "soccer_uefa_europa_league",
    "ECL": "soccer_uefa_europa_conference_league",
    # Provider key must be probed before live use. If The Odds API changes the key,
    # diagnostics will show odds_markets=0 and keep World Cup in monitor_only.
    "WC": "soccer_fifa_world_cup",
    # Summer-calendar leagues (#SUMMER-LEAGUES-1, APPROVE Andrea 2026-06-12).
    # All five keys VERIFIED ACTIVE on /v4/sports with the live plan on
    # 2026-06-12 (mid WC-break: these are exactly the leagues running now).
    "ELI": "soccer_norway_eliteserien",
    "ALL": "soccer_sweden_allsvenskan",
    "VEI": "soccer_finland_veikkausliiga",
    "LOI": "soccer_league_of_ireland",
    "CSL": "soccer_china_superleague",
}

_SUFFIXES = re.compile(r"\b(FC|CF|SC|AC|AS|SV|1\. ?FC|VfB|VfL|TSG|RB|SS|US|SSC|AFC)\b", re.IGNORECASE)


def normalize_name(name: str) -> str:
    """Strip common club suffixes so 'Arsenal FC' matches 'Arsenal'."""
    return _SUFFIXES.sub("", name).strip().lower()


def football_pair_key(home: str, away: str, commence_time: str | None) -> str | None:
    """Provider-agnostic match identity: '<utc-date>:<teamA>|<teamB>' (sorted pair).

    Same recipe as the tennis adapter's _pair_key — computable from both
    odds_snapshots and our prediction tables, so snapshots become joinable
    (#ODDS-1). National-team names go through canonical_team_name first
    (passthrough for clubs), so 'Czechia'/'Czech Republic', 'USA'/'United
    States', 'Bosnia-Herzegovina'/... land on the same key — verified against
    live WC rows where 6/28 pairs missed the join on raw provider spellings.
    Returns None when either name is missing.
    """
    from core.world_cup_history import canonical_team_name

    h = normalize_name(canonical_team_name(home) or "")
    a = normalize_name(canonical_team_name(away) or "")
    if not h or not a or h == a:
        return None
    day = ""
    if commence_time:
        try:
            day = (
                datetime.fromisoformat(str(commence_time).replace("Z", "+00:00"))
                .astimezone(timezone.utc)
                .date()
                .isoformat()
            )
        except ValueError:
            day = str(commence_time)[:10]
    return f"{day}:{'|'.join(sorted([h, a]))}"


def _best_odds(event: dict) -> Optional[dict]:
    """Extract the market 1X2 anchor odds for an event.

    #PINNACLE-ANCHOR-1: when MARKET_ANCHOR_ENABLED, the anchor is Pinnacle (else
    a sharp exchange, else legacy best-margin) via core.market_anchor; otherwise
    the legacy lowest-margin pick across all books. The returned dict adds
    ``anchor_source`` so the collector can persist which tier fed the blend. The
    normalized-name fields are kept for the collector's odds_map join key.
    """
    home = event.get("home_team", "")
    away = event.get("away_team", "")
    if settings.MARKET_ANCHOR_ENABLED:
        anchor = select_h2h_anchor(event)
    else:
        anchor = _best_margin_h2h(event)
    if not anchor:
        return None
    return {
        "home_team": home,
        "away_team": away,
        "home_team_normalized": normalize_name(home),
        "away_team_normalized": normalize_name(away),
        "odds_home": anchor["odds_home"],
        "odds_draw": anchor["odds_draw"],
        "odds_away": anchor["odds_away"],
        "bookmaker": anchor["bookmaker"],
        "anchor_source": anchor.get("anchor_source", "best_margin"),
        "margin": anchor["margin"],
    }


async def get_odds(league: str) -> List[Dict]:
    """Return list of normalized odds dicts; empty list if key missing or API error."""
    if not settings.ODDS_API_KEY:
        return []
    sport_key = SPORT_KEYS.get(league)
    if not sport_key:
        return []
    # Quota guard: never burn paid credits on an out-of-season league.
    active = await get_active_sport_keys()
    if active is not None and sport_key not in active:
        return []
    # Network errors must degrade to [] like every other failure here: an
    # unhandled timeout aborts the collector's whole per-league cycle
    # (agents/data_collector.py catches only at the league level).
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/sports/{sport_key}/odds",
                params={
                    "apiKey": settings.ODDS_API_KEY,
                    # #ODDS-BURN-OPT: eu-only (Pinnacle è in 'eu') → -50% crediti.
                    "regions": "eu",
                    "markets": "h2h",
                    "oddsFormat": "decimal",
                },
                timeout=15.0,
            )
    except httpx.HTTPError as e:
        logger.warning(f"odds-api get_odds({league}) network error: {e}")
        return []
    if resp.status_code == 429:
        logger.warning(f"odds-api get_odds({league}) rate-limited (429), skipping cycle")
        return []
    if resp.status_code != 200:
        return []
    return [o for event in resp.json() if (o := _best_odds(event))]


def _match_date(commence_time: str | None) -> str:
    """UTC date (YYYY-MM-DD) of an event's commence_time, '' if unparseable."""
    if not commence_time:
        return ""
    try:
        return (
            datetime.fromisoformat(str(commence_time).replace("Z", "+00:00"))
            .astimezone(timezone.utc)
            .date()
            .isoformat()
        )
    except ValueError:
        return str(commence_time)[:10]


def _canon(name: str) -> str:
    """Normalized + national-team-canonicalized name for /scores matching.

    Reuses normalize_name (club suffixes) and canonical_team_name (national
    aliases: 'Czechia'/'Czech Republic', 'USA'/'United States', ...) so WC and
    international rows match the same way the odds collector's pair key does.
    """
    from core.world_cup_history import canonical_team_name

    return normalize_name(canonical_team_name(name) or name or "")


async def _fetch_scores(sport_key: str) -> list[dict] | None:
    """Raw /scores list for a sport over the max plan window (daysFrom=3).

    One call returns every event (live, upcoming, completed) in the window —
    enough to settle all of that sport's rows in a cycle. None on any failure
    so the caller falls through to the next source rather than voiding.
    """
    if not settings.ODDS_API_KEY or not sport_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{BASE_URL}/sports/{sport_key}/scores",
                params={"daysFrom": 3, "apiKey": settings.ODDS_API_KEY},
            )
    except httpx.HTTPError as e:
        logger.warning(f"odds-api /scores({sport_key}) network error: {e}")
        return None
    if resp.status_code != 200:
        if resp.status_code == 429:
            logger.warning(f"odds-api /scores({sport_key}) rate-limited (429)")
        return None
    try:
        return resp.json()
    except Exception:
        return None


async def get_score_by_teams_date(
    sport_key: str,
    home: str,
    away: str,
    kickoff_date: str,
    _cache: dict | None = None,
) -> dict | None:
    """Final score from The Odds API /scores, by team names + date.

    Robust settlement source: we pay for The Odds API (~96K credits/month) and
    it covers every competition we have odds for. Matches a COMPLETED event with
    valid scores by normalized team names in EITHER orientation, on the same UTC
    date as kickoff (the date guard stops a same-pair rematch settling the wrong
    row). Returns {home_goals, away_goals} in the CALLER's home/away orientation,
    or None when not found / not completed (so genuinely canceled matches stay
    void downstream).

    Quota-aware: pass a per-cycle ``_cache`` dict so a sport's /scores response
    is fetched once and reused across all that sport's rows. Without it, each
    call hits the API (one /scores credit each).
    """
    if not home or not away or not kickoff_date:
        return None
    cache_key = sport_key
    events: list[dict] | None
    if _cache is not None and cache_key in _cache:
        events = _cache[cache_key]
    else:
        events = await _fetch_scores(sport_key)
        if _cache is not None:
            _cache[cache_key] = events
    if not events:
        return None

    want_home, want_away = _canon(home), _canon(away)
    want_day = _match_date(kickoff_date)
    for ev in events:
        if not ev.get("completed"):
            continue
        scores = ev.get("scores")
        if not scores:
            continue
        if want_day and _match_date(ev.get("commence_time")) != want_day:
            continue
        ev_home_name = ev.get("home_team", "")
        ev_away_name = ev.get("away_team", "")
        ev_home, ev_away = _canon(ev_home_name), _canon(ev_away_name)
        # Map provider's per-team score list onto the event's home/away names.
        by_name = {s.get("name", ""): s.get("score") for s in scores}
        raw_home, raw_away = by_name.get(ev_home_name), by_name.get(ev_away_name)
        if raw_home is None or raw_away is None:
            continue
        try:
            g_home, g_away = int(raw_home), int(raw_away)
        except (TypeError, ValueError):
            continue
        if ev_home == want_home and ev_away == want_away:
            return {"home_goals": g_home, "away_goals": g_away}
        # Reversed orientation: flip back to the caller's home/away.
        if ev_home == want_away and ev_away == want_home:
            return {"home_goals": g_away, "away_goals": g_home}
    return None


def implied_probability(odds: float) -> float:
    return 1.0 / odds if odds > 0 else 0.0


# Markets we snapshot per league call. Credit cost = markets × regions.
# #ODDS-BURN-OPT: era h2h,spreads,totals × eu,uk = 6 crediti/lega/ciclo → ~90k/mese
# da SOLO questo consumer (quasi tutto il piano 100k), causa principale del drain.
# Il blend usa SOLO h2h (core/market_anchor.py, ancora = Pinnacle, presente in 'eu');
# `spreads` non è letto da nessun path di predizione. Tagliato a h2h,totals × eu
# = 2 crediti/lega (-67%). `totals` tenuto per il shadow-settlement O/U.
SNAPSHOT_MARKETS = "h2h,totals"
SNAPSHOT_REGIONS = "eu"
SNAPSHOT_CREDITS_PER_CALL = len(SNAPSHOT_MARKETS.split(",")) * len(SNAPSHOT_REGIONS.split(","))


async def get_all_bookmaker_odds(league_code: str) -> List[Dict]:
    """Fetch odds from ALL bookmakers. Returns [{match_id, team_pair_key, commence_time, home_team, away_team, bookmaker, market, ...}]."""
    sport_key = SPORT_KEYS.get(league_code)
    if not sport_key or not settings.ODDS_API_KEY:
        return []
    # #ODDS-BURN-OPT: sotto la riserva condivisa NON chiamiamo /odds (protegge il
    # margine account per gli altri consumer → non si arriva mai a 0).
    from core import odds_reserve
    if not odds_reserve.budget_ok():
        return []
    # Quota guard: skip out-of-season keys (markets × regions is expensive).
    active = await get_active_sport_keys()
    if active is not None and sport_key not in active:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{BASE_URL}/sports/{sport_key}/odds",
                params={
                    "apiKey": settings.ODDS_API_KEY,
                    "regions": SNAPSHOT_REGIONS,
                    "markets": SNAPSHOT_MARKETS,
                    "oddsFormat": "decimal",
                    "dateFormat": "iso",
                },
            )
            odds_reserve.observe(resp.headers)  # aggiorna il remaining reale condiviso
            if resp.status_code != 200:
                return []
            events = resp.json()
    except Exception:
        return []

    rows = []
    for ev in events:
        match_id = f"{league_code}:{ev.get('id', '')}"
        home = ev.get("home_team", "")
        away = ev.get("away_team", "")
        commence = ev.get("commence_time")
        ident = {
            "match_id": match_id,
            "home_team": home,
            "away_team": away,
            "team_pair_key": football_pair_key(home, away, commence),
            "commence_time": commence,
            "source": "odds_api",
        }
        for bm in ev.get("bookmakers", []):
            bm_name = bm.get("key", "")
            for market in bm.get("markets", []):
                if market.get("key") == "h2h":
                    outcomes = {o["name"]: o["price"] for o in market.get("outcomes", [])}
                    oh = outcomes.get(home, 0.0)
                    od = outcomes.get("Draw", 0.0)
                    oa = outcomes.get(away, 0.0)
                    if oh and od and oa:
                        overround = round((1/oh + 1/od + 1/oa) - 1, 4)
                        rows.append({
                            **ident, "bookmaker": bm_name, "market": "h2h",
                            "odds_home": oh, "odds_draw": od, "odds_away": oa,
                            "overround": overround,
                        })
                elif market.get("key") == "spreads":
                    for outcome in market.get("outcomes", []):
                        is_home_team = outcome["name"] == home
                        rows.append({
                            **ident, "bookmaker": bm_name, "market": "ah",
                            "ah_line": outcome.get("point", 0.0),
                            "ah_home": outcome["price"] if is_home_team else None,
                            "ah_away": outcome["price"] if not is_home_team else None,
                        })
                elif market.get("key") == "totals":
                    # One row per line: Over/Under share the same point value.
                    by_line: dict = {}
                    for outcome in market.get("outcomes", []):
                        line = outcome.get("point")
                        if line is None:
                            continue
                        slot = by_line.setdefault(line, {})
                        slot[outcome.get("name", "")] = outcome.get("price")
                    for line, prices in by_line.items():
                        rows.append({
                            **ident, "bookmaker": bm_name, "market": "totals",
                            "total_line": line,
                            "total_over": prices.get("Over"),
                            "total_under": prices.get("Under"),
                        })
    return rows


# Exact column set of the odds_snapshots table. PostgREST bulk inserts need
# uniform keys across rows, and unknown keys (home_team/away_team from
# get_all_bookmaker_odds) are rejected — normalize before posting.
_SNAPSHOT_COLUMNS = (
    "match_id", "team_pair_key", "commence_time", "bookmaker", "source", "market",
    "odds_home", "odds_draw", "odds_away",
    "ah_line", "ah_home", "ah_away", "overround",
    "total_line", "total_over", "total_under",
)


def to_snapshot_rows(rows: List[Dict]) -> List[Dict]:
    """Project bookmaker-odds rows onto the odds_snapshots column set."""
    return [
        {col: row.get(col) for col in _SNAPSHOT_COLUMNS}
        for row in rows
        if row.get("match_id") and row.get("bookmaker")
    ]


async def snapshot_odds_to_supabase(rows: List[Dict]) -> None:
    """Write multi-bookmaker odds rows to odds_snapshots table."""
    rows = to_snapshot_rows(rows)
    if not rows or not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            await c.post(
                f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/odds_snapshots",
                json=rows,
                headers={
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
            )
    except Exception as exc:
        logger.debug("snapshot write failed (non-fatal): %s", exc)


async def mark_closing_lines(lookback_hours: int = 36) -> int:
    """Mark the last pre-kickoff snapshot of each started match as the closing line.

    For every match whose commence_time has passed within the lookback window
    and that has no is_closing row yet, flags the rows of its most recent
    captured_at batch. The closing line is the calibration/CLV reference
    (#ODDS-1) — without it the snapshots are write-only noise.
    Returns the number of matches marked. Fail-soft: returns 0 on any error.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return 0
    base = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/odds_snapshots"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=lookback_hours)
    marked = 0
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                base,
                # repeated filters on the same column are ANDed by PostgREST
                params=[
                    ("select", "match_id,captured_at,is_closing"),
                    ("commence_time", f"lt.{now.isoformat()}"),
                    ("commence_time", f"gt.{since.isoformat()}"),
                    ("order", "captured_at.desc"),
                    ("limit", "10000"),
                ],
                headers=headers,
            )
            if resp.status_code != 200:
                return 0
            latest: dict[str, str] = {}
            already_closed: set[str] = set()
            for row in resp.json():
                mid = row.get("match_id")
                if not mid:
                    continue
                if row.get("is_closing"):
                    already_closed.add(mid)
                    continue
                # rows arrive captured_at DESC — first hit is the latest batch
                latest.setdefault(mid, row.get("captured_at"))
            for mid, cap in latest.items():
                if mid in already_closed or not cap:
                    continue
                patch = await c.patch(
                    base,
                    params={"match_id": f"eq.{mid}", "captured_at": f"eq.{cap}"},
                    json={"is_closing": True},
                    headers=headers,
                )
                if patch.status_code in (200, 204):
                    marked += 1
    except Exception as exc:
        logger.debug("closing-line marking failed (non-fatal): %s", exc)
    if marked:
        logger.info("closing line marked for %d match(es)", marked)
    return marked
