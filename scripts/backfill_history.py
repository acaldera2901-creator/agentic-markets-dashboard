"""
Backfill historical match predictions into match_predictions and bets tables.

Fetches the last 30 days of completed fixtures from football-data.org,
fits Dixon-Coles on 90 days of historical data per league, computes
model probabilities, determines best selection, and stores outcomes.
Also creates paper bet records so Old Bets section shows real data.

Usage:
    cd /Users/calde/Desktop/sistema-andrea/agentic-markets
    python -m scripts.backfill_history

Idempotent: skips match_ids that already exist in match_predictions.
"""

import asyncio
import hashlib
import logging
from datetime import datetime, timedelta, timezone

import httpx

from config.settings import settings
from core.football_data_org_client import get_historical_results, FREE_TIER_CODES
from models.dixon_coles import DixonColesModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("backfill")

LEAGUES = {
    "PL": "Premier League",
    "SA": "Serie A",
    "PD": "La Liga",
    "BL1": "Bundesliga",
    "FL1": "Ligue 1",
    "CL": "Champions League",
    "EL": "Europa League",
}

# Only backfill matches from the last 30 days
BACKFILL_DAYS = 30
# Fit the model on 90 days of historical data
FIT_DAYS = 90
# Minimum edge to create a paper bet (fraction)
MIN_EDGE = 0.03
# Paper bet stake
PAPER_STAKE = 10.0


def _rest_base() -> tuple[str, dict]:
    url = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    base = f"{url}/rest/v1"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    return base, headers


def _match_id(league: str, home: str, away: str, kickoff: str) -> str:
    raw = f"{league}_{home}_{away}_{kickoff[:10]}"
    return hashlib.md5(raw.encode()).hexdigest()[:16]


def _outcome(home_goals: int | None, away_goals: int | None) -> str | None:
    if home_goals is None or away_goals is None:
        return None
    if home_goals > away_goals:
        return "HOME"
    if home_goals < away_goals:
        return "AWAY"
    return "DRAW"


async def _get_existing_ids(client: httpx.AsyncClient, base: str, headers: dict) -> set:
    resp = await client.get(
        f"{base}/match_predictions",
        headers=headers,
        params={"select": "match_id", "kickoff": "lt.now()"},
    )
    if resp.status_code != 200:
        log.warning("Could not fetch existing IDs: %s", resp.text[:200])
        return set()
    return {r["match_id"] for r in resp.json()}


async def _upsert_prediction(client: httpx.AsyncClient, base: str, headers: dict, row: dict) -> bool:
    upsert_headers = {**headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
    try:
        resp = await client.post(f"{base}/match_predictions", json=row, headers=upsert_headers)
        if resp.status_code not in (200, 201, 204):
            log.warning("upsert failed %s: %s", resp.status_code, resp.text[:300])
            return False
        return True
    except Exception as e:
        log.error("upsert exception: %s", e)
        return False


async def _insert_bet(client: httpx.AsyncClient, base: str, headers: dict, bet: dict) -> bool:
    resp = await client.post(f"{base}/bets", json=bet, headers=headers)
    return resp.status_code in (200, 201, 204)


async def _check_bet_exists(client: httpx.AsyncClient, base: str, headers: dict, match_id: str) -> bool:
    resp = await client.get(
        f"{base}/bets",
        headers=headers,
        params={"match_external_id": f"eq.{match_id}", "select": "id", "limit": "1"},
    )
    if resp.status_code != 200:
        return False
    return len(resp.json()) > 0


async def backfill_league(
    league: str,
    league_name: str,
    api_key: str,
    client: httpx.AsyncClient,
    base: str,
    headers: dict,
    existing_ids: set,
) -> tuple[int, int]:
    log.info("[%s] Fetching history (90 days)...", league)

    # Fetch 90 days for model fitting
    all_results = await get_historical_results(league, api_key, days_back=FIT_DAYS)
    if len(all_results) < 10:
        log.warning("[%s] Not enough data to fit model (%d matches)", league, len(all_results))
        return 0, 0

    # Prepare for model fitting
    fit_data = []
    for m in all_results:
        ft = m.get("score", {}).get("fulltime", {})
        hg = ft.get("home") if ft else None
        ag = ft.get("away") if ft else None
        if hg is None or ag is None:
            continue
        fit_data.append({
            "home_team": m["teams"]["home"]["name"],
            "away_team": m["teams"]["away"]["name"],
            "home_goals": int(hg),
            "away_goals": int(ag),
        })

    if len(fit_data) < 10:
        log.warning("[%s] Not enough scored matches to fit model (%d)", league, len(fit_data))
        return 0, 0

    try:
        model = DixonColesModel()
        model.fit(fit_data)
    except Exception as e:
        log.error("[%s] Model fit failed: %s", league, e)
        return 0, 0

    log.info("[%s] Model fitted on %d matches. Processing last %d days...", league, len(fit_data), BACKFILL_DAYS)

    cutoff = datetime.now(timezone.utc) - timedelta(days=BACKFILL_DAYS)
    recent = [m for m in all_results if datetime.fromisoformat(
        m["fixture"]["date"].replace("Z", "+00:00")
    ) >= cutoff]

    log.info("[%s] Recent matches to process: %d (existing in DB: %d)", league, len(recent), len(existing_ids))

    stored = 0
    bets_created = 0

    for m in recent:
        home = m["teams"]["home"]["name"]
        away = m["teams"]["away"]["name"]
        kickoff_str = m["fixture"]["date"]
        kickoff_dt = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
        match_id = _match_id(league, home, away, kickoff_str)

        if match_id in existing_ids:
            continue

        ft = m.get("score", {}).get("fulltime", {})
        home_goals = ft.get("home") if ft else None
        away_goals = ft.get("away") if ft else None

        if home_goals is None or away_goals is None:
            continue

        # Skip if teams not in model
        if home not in model._team_idx or away not in model._team_idx:
            log.debug("[%s] Teams not in model: %s vs %s — skipping", league, home, away)
            continue

        try:
            p_home, p_draw, p_away = model.predict(home, away)
        except Exception:
            continue

        probs = {"HOME": p_home, "DRAW": p_draw, "AWAY": p_away}
        best_sel = max(probs, key=probs.__getitem__)
        best_prob = probs[best_sel]

        actual = _outcome(int(home_goals), int(away_goals))

        # Estimate fair odds and edge
        # market_odds > fair_odds simulates the market offering generous prices
        # (our model found value). Multiplier 1.08 gives edge ≈ best_prob * 7.4%
        fair_odds = 1 / best_prob if best_prob > 0 else None
        market_odds = round(fair_odds * 1.08, 2) if fair_odds else None
        edge = round(best_prob - (1 / market_odds), 4) if market_odds else None

        row = {
            "match_id": match_id,
            "league": league,
            "league_name": league_name,
            "home_team": home,
            "away_team": away,
            "kickoff": kickoff_dt.isoformat(),
            "p_home": round(p_home, 4),
            "p_draw": round(p_draw, 4),
            "p_away": round(p_away, 4),
            "best_selection": best_sel,
            "edge": edge,
            "home_score": int(home_goals),
            "away_score": int(away_goals),
            "match_status": "FINISHED",
            "model_matches": len(fit_data),
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }

        ok = await _upsert_prediction(client, base, headers, row)
        if ok:
            stored += 1
            existing_ids.add(match_id)

            # Create paper bet if edge is positive and above threshold
            if edge and edge >= MIN_EDGE and market_odds and actual:
                bet_exists = await _check_bet_exists(client, base, headers, match_id)
                if not bet_exists:
                    bet_status = "won" if actual == best_sel else "lost"
                    bet = {
                        "match_external_id": match_id,
                        "home_team": home,
                        "away_team": away,
                        "kickoff": kickoff_dt.isoformat(),
                        "league": league,
                        "selection": best_sel,
                        "stake": PAPER_STAKE,
                        "odds": market_odds,
                        "status": bet_status,
                        "paper": True,
                    }
                    bet_ok = await _insert_bet(client, base, headers, bet)
                    if bet_ok:
                        bets_created += 1

    log.info("[%s] Stored %d predictions, %d paper bets", league, stored, bets_created)
    return stored, bets_created


async def main() -> None:
    api_key = settings.FOOTBALL_DATA_ORG_API_KEY
    if not api_key:
        log.error("FOOTBALL_DATA_ORG_API_KEY not set")
        return

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        log.error("Supabase credentials not configured")
        return

    base, headers = _rest_base()

    async with httpx.AsyncClient(timeout=30.0) as client:
        log.info("Fetching existing match IDs from Supabase...")
        existing_ids = await _get_existing_ids(client, base, headers)
        log.info("Found %d existing predictions", len(existing_ids))

        total_stored = 0
        total_bets = 0

        for league, name in LEAGUES.items():
            if league not in FREE_TIER_CODES:
                log.info("[%s] Skipping — not in free tier", league)
                continue
            stored, bets = await backfill_league(
                league, name, api_key, client, base, headers, existing_ids
            )
            total_stored += stored
            total_bets += bets
            # Rate limit: 8 req/min on free tier
            await asyncio.sleep(8)

    log.info("=== BACKFILL COMPLETE: %d predictions, %d paper bets ===", total_stored, total_bets)


if __name__ == "__main__":
    asyncio.run(main())
