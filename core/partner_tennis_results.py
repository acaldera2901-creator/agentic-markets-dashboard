"""#RISULTATI-PARTNER-1001 — finished tennis matches from the partner feed
(BetConstruct: FortunePlay/YBets), in the SAME shape as the ESPN archive
(`core.espn_tennis_client.get_completed_results_for_days`), so the settlement
agent runs them through the same date/ambiguity gate and the same set gate.

Measured live on 01/10 (read-only GETs, public endpoint, no credentials):
  - `match_status=3` = finished: 169.734 tennis matches, history back to at
    least 01/10/2025; `start_from`/`start_to` filter by day, `limit=500` takes
    a whole day in one call (220-540 matches/day).
  - each match carries `statistics.total_score` (sets) and
    `statistics.period_score[]` (games per set), plus the real tournament.
  - `match_status=2` mixes "Finish" with live stages (Set 1/2/3) and stale
    rows from 2025: not a completion flag, so it is NOT read.
  - there is NO retired/walkover flag. A retirement shows as a set left open
    (`0-6 0-0`, total 0-1) and is refused by the set gate; a walkover/cancelled
    match has no period scores and yields no winner. Both stay open and age
    out as 'unresolved' — never an invented outcome.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

import httpx

from core.sportsbook.fortuneplay import _BASE, _HEADERS
from core.tennis_names import canonical_player_key

logger = logging.getLogger(__name__)

FINISHED_STATUS = "3"
_DAY_LIMIT = 500  # one call per day: the busiest day measured was 540 matches
_MAX_PAGES = 3    # anti-hammering cap per day

_cache: dict[date, list[dict]] = {}


def _gender(tournament: str) -> str | None:
    t = tournament.lower()
    if "wta" in t or "women" in t:
        return "W"
    if "atp" in t or " men" in t or t.startswith("men"):
        return "M"
    return None


def _event_date(raw: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def result_from_partner_match(m: dict) -> dict | None:
    """One finished partner match -> ESPN-shaped result dict, or None.

    None whenever the winner is not explicit in the source: no period scores,
    level total, or a total that the period scores do not back up.
    """
    if str(m.get("status")) != FINISHED_STATUS:
        return None
    comp = m.get("competitors") or {}
    home = (comp.get("home") or {}).get("name") or ""
    away = (comp.get("away") or {}).get("name") or ""
    stats = m.get("statistics") or {}
    total = stats.get("total_score") or {}
    periods = [(p.get("home"), p.get("away")) for p in stats.get("period_score") or []]
    # A trailing 0-0 period is a placeholder for a set never started.
    while periods and periods[-1] == (0, 0):
        periods.pop()
    th, ta = total.get("home"), total.get("away")
    if not home or not away or not periods or not isinstance(th, int) or not isinstance(ta, int):
        return None
    if any(not isinstance(h, int) or not isinstance(a, int) for h, a in periods):
        return None
    if th == ta:
        return None
    # The declared total must equal the sets each side actually took: a
    # mismatch means the snapshot is not a final one.
    if (sum(h > a for h, a in periods), sum(a > h for h, a in periods)) != (th, ta):
        return None

    home_won = th > ta
    winner, loser = (home, away) if home_won else (away, home)
    tournament = (m.get("tournament") or {}).get("name") or ""
    doubles = "doubles" in tournament.lower()
    last = periods[-1]
    # BetConstruct encodes the doubles champions tie-break (deciding set) as
    # 1-0: the format, not a partial score. Flagged for the set gate.
    match_tiebreak = doubles and len(periods) == 3 and sorted(last) == [0, 1]
    score = " ".join(f"{h}-{a}" if home_won else f"{a}-{h}" for h, a in periods)
    return {
        "event_id": f"bc:{m.get('id')}",
        "winner_key": canonical_player_key(winner),
        "loser_key": canonical_player_key(loser),
        "winner_name": winner,
        "loser_name": loser,
        "tournament": tournament,
        "score_text": score,
        "event_date": _event_date(m.get("start_time")),
        "gender": _gender(tournament),
        "status_name": None,
        "source_completed": True,
        "match_tiebreak": match_tiebreak,
    }


async def _fetch_day(client: httpx.AsyncClient, day: date) -> list[dict]:
    out: list[dict] = []
    nxt = day + timedelta(days=1)
    for page in range(1, _MAX_PAGES + 1):
        resp = await client.get(_BASE, params={
            "sport_key": "tennis", "match_status": FINISHED_STATUS,
            "start_from": f"{day.isoformat()}T00:00:00Z",
            "start_to": f"{nxt.isoformat()}T00:00:00Z",
            "limit": str(_DAY_LIMIT), "page": str(page),
        }, headers=_HEADERS)
        resp.raise_for_status()
        payload = resp.json()
        for m in payload.get("data") or []:
            r = result_from_partner_match(m)
            if r:
                out.append(r)
        if page >= ((payload.get("pagination") or {}).get("last_page") or page):
            break
    return out


async def get_partner_results_for_days(days) -> list[dict]:
    """Finished partner matches for a set of days (one call per day; past days
    cached for the process lifetime, as the ESPN archive does)."""
    oggi = datetime.now(timezone.utc).date()
    out: list[dict] = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for day in sorted(set(days)):
            if day < oggi and day in _cache:
                out += _cache[day]
                continue
            try:
                righe = await _fetch_day(client, day)
            except Exception as exc:  # one day failing must not stop the others
                logger.warning("partner risultati %s non letti: %s", day, exc)
                continue
            if day < oggi:
                _cache[day] = righe
            out += righe
    logger.info("partner risultati: %d partite concluse su %d giorno/i", len(out), len(set(days)))
    return out
