"""
Supabase REST client for agent heartbeats and model predictions.
Uses httpx (already in requirements) — no extra dependency.
Writes are fire-and-forget: failures are logged but never crash the agent.
"""
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
import httpx
from config.settings import settings

logger = logging.getLogger("supabase_client")

_REST_BASE: str | None = None


def _rest_base() -> str | None:
    """Return the Supabase REST endpoint, or None if not configured."""
    global _REST_BASE
    if _REST_BASE is not None:
        return _REST_BASE
    url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
    if not url or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    _REST_BASE = f"{url}/rest/v1"
    return _REST_BASE


async def upsert_heartbeat(agent_name: str, status_detail: str | None = None) -> None:
    """
    Upsert a row in agent_heartbeats using Supabase PostgREST.
    Safe to call from any async context; swallows all exceptions.
    """
    base = _rest_base()
    if not base:
        return

    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = {
        "agent_name": agent_name,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "status_detail": status_detail,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{base}/agent_heartbeats",
                json=payload,
                headers=headers,
            )
            if resp.status_code not in (200, 201, 204):
                logger.warning(
                    "supabase heartbeat failed: %s %s", resp.status_code, resp.text[:200]
                )
    except Exception as exc:
        logger.debug("supabase heartbeat error (non-fatal): %s", exc)


# ─── Dixon-Coles → unified_predictions writer ──────────────────────────────────
# Runs in parallel to the TS Poisson v1. Distinct model_version + source_table so
# its rows have a distinct (source_table, source_id) dedup key and NEVER overwrite
# the client-served Poisson rows. Promotion to the customer is an explicit
# decision (= production deploy), not done here.

_WORLD_CUP_KEYWORDS = ("world cup", "fifa", "wc 2026", "wc2026")
_COMPETITION_CODES = {"CL": "Champions League", "EL": "Europa League"}


@dataclass(frozen=True)
class DCPrediction:
    """One Dixon-Coles 1X2 prediction ready to be mapped to unified_predictions."""

    match_id: str
    league: str
    league_name: str
    home_team: str
    away_team: str
    kickoff: str  # ISO-8601, used for both starts_at and expires_at
    p_home: float
    p_draw: float
    p_away: float
    home_team_matches: int
    away_team_matches: int
    ci_width: float | None = None  # conformal interval width on the picked outcome


def _competition(league: str, league_name: str) -> str:
    lower = league_name.lower()
    if any(k in lower for k in _WORLD_CUP_KEYWORDS):
        return "World Cup"
    return _COMPETITION_CODES.get(league, league_name)


def _world_cup_stage(league_name: str) -> str | None:
    lower = league_name.lower()
    if not any(k in lower for k in _WORLD_CUP_KEYWORDS):
        return None
    if "final" in lower and "semi" not in lower and "quarter" not in lower:
        return "final"
    if "semi" in lower:
        return "semi"
    if "quarter" in lower:
        return "quarter"
    if "round of 16" in lower or "round16" in lower:
        return "round16"
    return "group"


def _status_from_kickoff(kickoff: str) -> str:
    try:
        ko = datetime.fromisoformat(kickoff)
    except ValueError:
        return "upcoming"
    if ko.tzinfo is None:
        ko = ko.replace(tzinfo=timezone.utc)
    hours_until = (ko - datetime.now(timezone.utc)).total_seconds() / 3600.0
    if hours_until > 24:
        return "upcoming"
    if hours_until > 0:
        return "open"
    return "pending_settlement"


def dc_prediction_to_unified_row(p: DCPrediction) -> dict:
    """
    Map a Dixon-Coles prediction onto the unified_predictions schema.

    No real market odds flow through here yet, so every row is a model estimate
    (is_paper=True, no fabricated edge/bookmaker — same honesty rule as the TS
    adapter's P0 #2). Reliability is gated on the min-match count and, when
    available, the conformal interval width.
    """
    probs = {"HOME": p.p_home, "DRAW": p.p_draw, "AWAY": p.p_away}
    pick = max(probs, key=probs.get)
    pick_prob = probs[pick]

    reliable = (
        min(p.home_team_matches, p.away_team_matches) >= settings.DC_MIN_TEAM_MATCHES
        and (p.ci_width is None or p.ci_width <= settings.DC_MAX_CI_WIDTH)
    )

    fair_odds = round(1.0 / pick_prob, 2) if pick_prob > 0 else None
    confidence = round(pick_prob * 100)

    if reliable:
        signal_type = "signal"
        explanation = (
            f"Dixon-Coles model signal. Pick: {pick} | model probability {confidence}%"
            + (f" | conformal interval width {p.ci_width:.3f}" if p.ci_width is not None else "")
            + ". No live market price attached, so no market edge is claimed."
            " This signal is informational. Bet responsibly."
        )
    else:
        signal_type = "estimate"
        reason = (
            "insufficient sample"
            if min(p.home_team_matches, p.away_team_matches) < settings.DC_MIN_TEAM_MATCHES
            else "wide uncertainty interval"
        )
        explanation = (
            f"Dixon-Coles model estimate ({reason}). Model lean: {pick} | "
            f"probability {confidence}%. Not shown as a value-bet. Bet responsibly."
        )

    return {
        "external_event_id": p.match_id,
        "sport": "football",
        "competition": _competition(p.league, p.league_name),
        "league": p.league,
        "event_name": f"{p.home_team} vs {p.away_team}",
        "home_team": p.home_team,
        "away_team": p.away_team,
        "market": "1X2",
        "pick": pick,
        "bookmaker": "no market",
        "odds": None,
        "fair_odds": fair_odds,
        "edge_percent": None,
        "confidence_score": confidence,
        "risk_level": "medium",
        "status": _status_from_kickoff(p.kickoff),
        "signal_type": signal_type,
        "source": "model",
        "model_version": settings.DC_MODEL_VERSION,
        "plan_access": settings.DC_PLAN_ACCESS,
        "is_historical": False,
        "is_live": False,
        "is_paper": True,
        "is_verified": False,
        "is_demo": False,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "starts_at": p.kickoff,
        "expires_at": p.kickoff,
        "explanation": explanation,
        # Full 1X2 distribution as machine-readable JSON: the dashboard's
        # off-season fallback (GET /api/predictions, PROPOSAL #016) projects
        # unified rows onto the v1 board shape and needs all three
        # probabilities — confidence_score alone only carries the pick's.
        "notes": json.dumps(
            {"p_home": p.p_home, "p_draw": p.p_draw, "p_away": p.p_away}
        ),
        "neutral_venue": False,
        "world_cup_stage": _world_cup_stage(p.league_name),
        "source_table": settings.DC_SOURCE_TABLE,
        "source_id": p.match_id,
    }


def xg_prediction_to_unified_row(p: DCPrediction) -> dict:
    """Same unified_predictions schema as the DC row, tagged as the xG-enhanced
    model. Paper/parallel: distinct model_version + source_table, so it never
    overwrites the served Poisson v1 rows (promotion to client = explicit deploy)."""
    row = dc_prediction_to_unified_row(p)
    row["model_version"] = settings.XG_MODEL_VERSION
    row["source_table"] = settings.XG_SOURCE_TABLE
    return row


def wc_prediction_to_unified_row(
    p: DCPrediction,
    *,
    stage: str | None = None,
    neutral_venue: bool = True,
    explanation: str | None = None,
    enrichment: dict | None = None,
    odds_triple: dict | None = None,
    bookmaker: str | None = None,
    signal_allowed: bool = False,
) -> dict:
    """World Cup row on the unified_predictions schema.

    Promotion rules (#018, APPROVE Andrea 2026-06-06 — the "explicit promotion
    deploy" the original force-paper docstring reserved):
    - signal_type = "signal" ONLY when BOTH hold: the per-row data-quality tier
      allows it (``signal_allowed`` ← publication_tier in signal_allowed /
      premium_candidate, which already scores odds+venue+squad+settlement
      quality) AND a real matched market exists (``odds_triple``).
    - otherwise the row stays paper exactly as before — fail-closed.
    - odds/edge are written ONLY from a real matched market; nothing is ever
      fabricated. ``p`` carries the SERVED (market-blended α=0.3) probabilities;
      the caller computes them via core/market_blend.

    ``explanation`` / ``enrichment``: when the caller has the real data sources
    (form, venue, squad — see core/world_cup_explanation), it passes a rich
    match-specific explanation and a structured Deep-Analysis payload. When
    omitted, falls back to the generic explanation (fail-soft).
    """
    row = dc_prediction_to_unified_row(p)
    pick = row["pick"]
    confidence = row["confidence_score"]
    row["model_version"] = settings.WC_MODEL_VERSION
    row["source_table"] = settings.WC_SOURCE_TABLE
    row["competition"] = "World Cup"
    row["neutral_venue"] = neutral_venue
    if stage:
        row["world_cup_stage"] = stage

    has_market = bool(
        odds_triple
        and all(_safe_positive(odds_triple.get(k)) for k in ("home", "draw", "away"))
    )
    promoted = signal_allowed and has_market

    if has_market:
        pick_odds = {
            "HOME": odds_triple["home"],
            "DRAW": odds_triple["draw"],
            "AWAY": odds_triple["away"],
        }[pick]
        pick_prob = confidence / 100.0
        edge = pick_prob - (1.0 / pick_odds) if pick_odds > 0 else None
        row["odds"] = round(float(pick_odds), 3)
        row["bookmaker"] = bookmaker or "market"
        row["edge_percent"] = round(edge * 100, 2) if edge is not None else None
        # notes carries the machine-readable payload the dashboard fallback
        # projects onto the v1 board (probabilities already there from the dc
        # mapper — extend with the real 3-way market).
        notes = json.loads(row["notes"])
        notes.update(
            {
                "odds_home": round(float(odds_triple["home"]), 3),
                "odds_draw": round(float(odds_triple["draw"]), 3),
                "odds_away": round(float(odds_triple["away"]), 3),
                "bookmaker": bookmaker or "market",
            }
        )
        row["notes"] = json.dumps(notes)

    if promoted:
        row["signal_type"] = "signal"
        row["is_paper"] = False
        row["explanation"] = explanation or (
            "World Cup market-blended signal (alpha=0.3 model + de-vigged market). "
            f"Pick: {pick} | served probability {confidence}% | real market odds attached. "
            "Bet responsibly."
        )
    else:
        row["signal_type"] = "paper"
        # Paper never claims an edge, even when reference odds are shown.
        row["edge_percent"] = None
        row["explanation"] = explanation or (
            f"World Cup paper prediction (national Poisson rates model). "
            f"Pick: {pick} | model probability {confidence}%. "
            "Paper tier: published for track-record transparency only"
            + (", real market odds shown for reference" if has_market else ", no market odds attached")
            + ", no edge claimed. Bet responsibly."
        )

    if enrichment is not None:
        row["enrichment"] = enrichment
    return row


def _safe_positive(value) -> bool:
    try:
        return float(value) > 0
    except (TypeError, ValueError):
        return False


async def log_prediction_snapshot(
    *,
    match_id: str,
    league: str,
    home_team: str,
    away_team: str,
    kickoff: str,
    served: tuple[float, float, float],
    model: tuple[float, float, float],
    odds: dict | None,
    market: dict | None,
    model_version: str,
    blend_alpha: float | None,
) -> None:
    """Append one served-prediction snapshot to prediction_log (PostgREST).

    Mirrors lib/prediction-log.ts logPredictionSnapshot for the Python WC path
    (#018): the rows actually served to customers come from this writer, so
    calibration must snapshot HERE, not only in the dormant TS compute path.
    Fail-soft by contract — a snapshot failure never breaks the model loop.
    """
    base = _rest_base()
    if not base:
        return
    row = {
        "match_id": match_id,
        "league": league,
        "home_team": home_team,
        "away_team": away_team,
        "kickoff": kickoff,
        "p_home": served[0], "p_draw": served[1], "p_away": served[2],
        "model_p_home": model[0], "model_p_draw": model[1], "model_p_away": model[2],
        "odds_home": (odds or {}).get("home"),
        "odds_draw": (odds or {}).get("draw"),
        "odds_away": (odds or {}).get("away"),
        "market_p_home": (market or {}).get("home"),
        "market_p_draw": (market or {}).get("draw"),
        "market_p_away": (market or {}).get("away"),
        "model_version": model_version,
        "blend_alpha": blend_alpha,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{base}/prediction_log", json=row, headers=_service_headers()
            )
            if resp.status_code not in (200, 201, 204):
                logger.warning(
                    "prediction_log snapshot rejected: %s %s",
                    resp.status_code, resp.text[:200],
                )
    except Exception as exc:
        logger.warning("prediction_log snapshot failed (non-fatal): %s", exc)


async def upsert_unified_rows(rows: list[dict]) -> int:
    """
    Upsert pre-built unified_predictions rows via PostgREST.

    Dedup key is (source_table, source_id) like the TS adapter, but the unique
    index is PARTIAL (WHERE source_table IS NOT NULL — see
    db/migrations/001_unified_predictions.sql) and PostgREST's `on_conflict`
    cannot target a partial index (42P10, hit live 2026-06-05). So this does an
    explicit PATCH-then-POST per row: update the existing key, insert when no
    row matched. Single writer per key, 30-ish rows per cycle — two round
    trips are fine. Fail-soft per row; returns rows successfully written.
    """
    base = _rest_base()
    if not base:
        return 0

    headers = _service_headers()

    written = 0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for row in rows:
                try:
                    source_table = row.get("source_table")
                    source_id = row.get("source_id")
                    if not source_table or not source_id:
                        logger.warning("unified upsert skipped: missing dedup key")
                        continue
                    resp = await client.patch(
                        f"{base}/unified_predictions"
                        f"?source_table=eq.{source_table}&source_id=eq.{source_id}",
                        json=row,
                        headers={**headers, "Prefer": "return=representation"},
                    )
                    if resp.status_code == 200 and resp.json():
                        written += 1
                        continue
                    if resp.status_code not in (200, 404):
                        logger.warning(
                            "unified upsert PATCH failed: %s %s",
                            resp.status_code,
                            resp.text[:200],
                        )
                        continue
                    resp = await client.post(
                        f"{base}/unified_predictions",
                        json=row,
                        headers=headers,
                    )
                    if resp.status_code in (200, 201, 204):
                        written += 1
                    else:
                        logger.warning(
                            "unified upsert POST failed: %s %s",
                            resp.status_code,
                            resp.text[:200],
                        )
                except Exception as exc:
                    logger.warning("unified upsert error (row skipped): %s", exc)
    except Exception as exc:
        logger.warning("unified upsert client error: %s", exc)

    return written


async def upsert_dc_predictions(predictions: list[DCPrediction]) -> int:
    """
    Upsert Dixon-Coles predictions into unified_predictions via PostgREST.

    Dedup key is (source_table, source_id) — matching the TS adapter — but with a
    DC-specific source_table, so these rows live alongside the Poisson v1 rows
    without overwriting them. Returns the number of rows successfully written.
    """
    base = _rest_base()
    if not base:
        return 0

    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    written = 0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for pred in predictions:
                row = dc_prediction_to_unified_row(pred)
                try:
                    resp = await client.post(
                        f"{base}/unified_predictions"
                        "?on_conflict=source_table,source_id",
                        json=row,
                        headers=headers,
                    )
                    if resp.status_code in (200, 201, 204):
                        written += 1
                    else:
                        logger.warning(
                            "dc unified upsert failed: %s %s",
                            resp.status_code,
                            resp.text[:200],
                        )
                except Exception as exc:
                    logger.warning("dc unified upsert error (row skipped): %s", exc)
    except Exception as exc:
        logger.warning("dc unified upsert client error: %s", exc)

    return written


# ─── Unified predictions settlement (P4-B / P5) ────────────────────────────────
# Settles served rows after the event: result + is_historical=TRUE feed the
# public track record (/api/v2/history) and flip the WC `settlement`/`history`
# readiness gates. Product line: result only — no money metrics are written.

def _service_headers() -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


async def fetch_unsettled_unified_predictions(
    cutoff_minutes: int = 115, limit: int = 50
) -> list[dict]:
    """
    Rows whose event started at least `cutoff_minutes` ago and that still have
    no result. Oldest first, bounded — a backlog drains across cycles instead
    of hammering the result providers in one go.
    """
    base = _rest_base()
    if not base:
        return []
    cutoff = (
        datetime.now(timezone.utc) - timedelta(minutes=cutoff_minutes)
    ).isoformat()
    params = {
        "select": (
            "id,external_event_id,sport,league,competition,home_team,away_team,"
            "market,pick,starts_at,world_cup_stage"
        ),
        "sport": "eq.football",
        "is_historical": "eq.false",
        "result": "is.null",
        "starts_at": f"lt.{cutoff}",
        "order": "starts_at.asc",
        "limit": str(limit),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{base}/unified_predictions", params=params, headers=_service_headers()
            )
            if resp.status_code != 200:
                logger.warning(
                    "unified unsettled fetch failed: %s %s",
                    resp.status_code,
                    resp.text[:200],
                )
                return []
            return resp.json() or []
    except Exception as exc:
        logger.warning("unified unsettled fetch error: %s", exc)
        return []


async def settle_unified_prediction(
    row_id: str,
    result: str,
    *,
    final_score: str | None = None,
) -> bool:
    """
    Mark one served prediction as settled history. `result` is won|lost|void.
    ``final_score`` (#021): the REAL final score as display text ("2-1" for
    football, "6-4 6-3" for tennis) — merged into the row's notes JSON so the
    public history shows the result, never left to guesswork. Omitted when the
    source didn't provide one (fail-closed: no score is shown instead).
    Fail-loud to the caller (bool) so the settlement agent can count and retry
    on the next cycle — but never raises.
    """
    base = _rest_base()
    if not base:
        return False
    payload = {
        "result": result,
        "status": "settled",
        "is_historical": True,
        "settled_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if final_score:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{base}/unified_predictions",
                    params={"select": "notes", "id": f"eq.{row_id}", "limit": "1"},
                    headers=_service_headers(),
                )
                existing = {}
                if resp.status_code == 200 and resp.json():
                    try:
                        existing = json.loads(resp.json()[0].get("notes") or "{}")
                    except (TypeError, ValueError):
                        existing = {}
                existing["final_score"] = final_score
                payload["notes"] = json.dumps(existing)
        except Exception as exc:
            # Score is enrichment, not the settlement itself — never block it.
            logger.debug("final score merge skipped for %s: %s", row_id, exc)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                f"{base}/unified_predictions",
                params={"id": f"eq.{row_id}"},
                json=payload,
                headers=_service_headers(),
            )
            if resp.status_code in (200, 204):
                return True
            logger.warning(
                "unified settle failed for %s: %s %s",
                row_id,
                resp.status_code,
                resp.text[:200],
            )
            return False
    except Exception as exc:
        logger.warning("unified settle error for %s: %s", row_id, exc)
        return False


async def settle_unified_tennis(
    match_id: str,
    winner_name: str | None,
    *,
    void: bool = False,
    final_score: str | None = None,
) -> bool:
    """
    Bridge a tennis settlement to the served unified_predictions row.

    The TennisSettlementAgent settles the Python-side TennisPrediction; the
    synced unified row (source_table='tennis_predictions', source_id=match_id)
    would otherwise stay un-historical forever — the football-only filter in
    fetch_unsettled_unified_predictions never picks it up — and the public
    track record (/api/v2/history) would show no tennis at all.

    result mapping: void -> "void"; otherwise compare the row's pick (a player
    name, written by lib/tennis-adapter.ts) to winner_name -> won/lost.
    Returns True if a row was settled, False otherwise (missing row included —
    not every Python prediction passes the publication gate into unified).
    """
    base = _rest_base()
    if not base:
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{base}/unified_predictions",
                params={
                    "select": "id,pick",
                    "source_table": "eq.tennis_predictions",
                    "source_id": f"eq.{match_id}",
                    "is_historical": "eq.false",
                    "limit": "1",
                },
                headers=_service_headers(),
            )
            if resp.status_code != 200:
                logger.warning(
                    "unified tennis lookup failed for %s: %s %s",
                    match_id, resp.status_code, resp.text[:200],
                )
                return False
            rows = resp.json()
        if not rows:
            return False
        row = rows[0]
        if void or not winner_name:
            result = "void"
        else:
            result = "won" if (row.get("pick") or "") == winner_name else "lost"
        return await settle_unified_prediction(
            str(row["id"]), result, final_score=final_score
        )
    except Exception as exc:
        logger.warning("unified tennis settle error for %s: %s", match_id, exc)
        return False
