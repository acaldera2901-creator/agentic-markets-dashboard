import asyncio
import json
from datetime import datetime, timezone
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.football_api_client import get_historical_results as apifootball_history, LEAGUE_IDS
from core.football_data_org_client import get_historical_results as fdorg_history, FREE_TIER_CODES
from core.world_cup_registry import (
    WORLD_CUP_CODE,
    api_football_season_for,
    is_friendlies_code,
    is_national_team_code,
    is_world_cup_code,
)
from core.world_cup_team_model import matchup_profile
from core.world_cup_history import canonical_team_name, load_national_history
from core.world_cup_data_quality import compute_world_cup_data_quality, world_cup_data_quality_status_detail
from core.world_cup_probability import national_match_probabilities
from core.world_cup_elo_model import predict_wc_match as predict_wc_elo_v2
from core.wc_calibration import calibrate_wc_probabilities
from core.world_cup_explanation import build_wc_enrichment, build_wc_explanation
from core.supabase_client import (
    DCPrediction,
    log_prediction_snapshot,
    upsert_unified_rows,
    wc_prediction_to_unified_row,
)
from core.market_blend import MARKET_BLEND_ALPHA, devig_1x2, blend_with_market
from models.dixon_coles import DixonColesModel
from models.conformal import calibrate_from_history, get_interval, interval_width
from context.context_service import ContextService
from core.db import persist_league_profile, persist_match_classification
from learning.season_phase import SeasonPhaseAdapter
from models.feature_adjuster import FeatureAdjuster, EnrichedFixture
from config.settings import settings

# Expected matches per season per league (home + away; 20-team league = 380 total)
_LEAGUE_TOTAL_MATCHES: dict[str, int] = {
    "PL": 380, "SA": 380, "PD": 380, "BL1": 306,
    "FL1": 380, "CL": 125, "EL": 96, "ECL": 96,
}


def _format_confirmed_xi(home_team: str, away_team: str, lineups: dict) -> str | None:
    """Compact 'confirmed XI' line for team_news_summary (#LINEUP-1-ESPN).

    'XI confermati — Mexico: Ochoa, Alvarez, +9 · South Africa: …'. Only sides
    with actual starters appear; None when neither side is published yet.
    """
    parts: list[str] = []
    for side, team in (("home", home_team), ("away", away_team)):
        starters = [s for s in ((lineups.get(side) or {}).get("starters") or []) if s]
        if not starters:
            continue
        shown = ", ".join(starters[:3])
        rest = len(starters) - 3
        parts.append(f"{team}: {shown}{f', +{rest}' if rest > 0 else ''}")
    if not parts:
        return None
    return "XI confermati — " + " · ".join(parts)


class ModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("ModelAgent")
        self._models: dict[str, DixonColesModel] = {}
        self._history: dict[str, list] = {}  # league → parsed match results for conformal
        self._context_svc = ContextService()
        self._phase_adapter = SeasonPhaseAdapter()
        self._feature_adjuster = FeatureAdjuster()
        # Calibration snapshots (#018): last served (p_home,p_draw,p_away,odds_home)
        # per WC match — snapshot only on change so the 15-min cycle doesn't
        # flood prediction_log with identical rows.
        self._wc_snapshot_state: dict[str, tuple] = {}
        # v2 Elo shadow: last logged (p_home,p_draw,p_away) per WC match, so the
        # shadow snapshot also only writes on change (mirrors the v1 state).
        self._wc_v2_snapshot_state: dict[str, tuple] = {}

    async def _main_loop(self) -> None:
        await self._bootstrap_models()
        while self._running:
            messages = await consume("market:data", "model_group", "ModelAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _fetch_history(self, league_code: str, league_id: int) -> list:
        fdorg_key = settings.FOOTBALL_DATA_ORG_API_KEY
        if fdorg_key and league_code in FREE_TIER_CODES:
            results = await fdorg_history(league_code, fdorg_key, days_back=365)
            if results:
                return results
        if settings.API_FOOTBALL_KEY:
            now = datetime.now()
            season = api_football_season_for(
                league_code,
                now.year if now.month >= 8 else now.year - 1,
            )
            return await apifootball_history(league_id, season)
        return []

    async def _bootstrap_models(self) -> None:
        for league_code, league_id in LEAGUE_IDS.items():
            try:
                results = await self._fetch_history(league_code, league_id)
                training = self._parse_results(results)
                if len(training) >= 10:
                    model = DixonColesModel()
                    model.fit(training)
                    self._models[league_code] = model
                    self._history[league_code] = training

                    # Calibrate conformal predictor on the same training set
                    # Use last 20% as "calibration" split to avoid data leakage
                    n_cal = max(int(len(training) * 0.20), 10)
                    calibration_set = training[-n_cal:]
                    cal_probs = []
                    for m in calibration_set:
                        try:
                            ph, pd, pa = model.predict(m["home_team"], m["away_team"])
                            cal_probs.append({
                                "p_home": ph, "p_draw": pd, "p_away": pa,
                                "home_goals": m["home_goals"], "away_goals": m["away_goals"],
                            })
                        except Exception:
                            continue
                    if cal_probs:
                        calibrate_from_history(league_code, cal_probs)
                        self.logger.info(
                            f"conformal calibrated for {league_code} on {len(cal_probs)} matches"
                        )

                    # Carica storia campionato nel ContextService
                    raw_matches = [
                        {
                            "home_goals": m["home_goals"],
                            "away_goals": m["away_goals"],
                            "result": (
                                "home" if m["home_goals"] > m["away_goals"]
                                else "away" if m["away_goals"] > m["home_goals"]
                                else "draw"
                            ),
                        }
                        for m in training
                    ]
                    profile = self._context_svc.load_league_history(league_code, league_code, raw_matches)
                    if profile:
                        try:
                            await persist_league_profile(profile)
                        except Exception as db_err:
                            self.logger.warning(f"league profile DB persist failed for {league_code}: {db_err}")
                    self.logger.info(f"fitted model for {league_code} on {len(training)} matches")
                else:
                    self.logger.warning(f"insufficient data for {league_code}: {len(training)} matches")
                    if is_world_cup_code(league_code):
                        self.set_status_detail({
                            "type": "model_bootstrap",
                            "world_cup": {
                                "mode": "monitor_only",
                                "blocked_reason": "national-team model/history not ready",
                                "training_matches": len(training),
                                "required_next": [
                                    "national-team strength baseline",
                                    "recent international form",
                                    "venue/stage context",
                                    "settlement source",
                                ],
                            },
                        })
            except Exception as e:
                self.logger.error(f"bootstrap error for {league_code}: {e}")

        # National-team history for the World Cup path. There is no Dixon-Coles
        # model for WC (national teams, not the league pool); the WC branch in
        # _process consumes this history directly via matchup_profile.
        try:
            self._history[WORLD_CUP_CODE] = load_national_history()
            self.logger.info(
                "loaded WC national history: %d matches", len(self._history[WORLD_CUP_CODE])
            )
        except Exception as e:
            self._history[WORLD_CUP_CODE] = []
            self.logger.error(f"WC national history load failed: {e}")

    def _build_world_cup_result(self, payload: dict) -> dict:
        """Pure WC enrichment: national matchup + data-quality gate.

        Runs without a Dixon-Coles model (WC has none) and queries the national
        history with canonical team names so fixture/API aliases resolve.
        """
        home = payload["home_team"]
        away = payload["away_team"]
        wc_context = payload.get("world_cup_context") or {}
        national_matchup = matchup_profile(
            self._history.get(WORLD_CUP_CODE, []),
            canonical_team_name(home),
            canonical_team_name(away),
        )
        result: dict = {
            "world_cup_context": json.dumps(wc_context),
            "world_cup_national_matchup": json.dumps(national_matchup),
            "world_cup_stage": str(wc_context.get("stage") or "unknown"),
            "neutral_venue": str(wc_context.get("neutral_venue", True)),
            "host_advantage_team": str(wc_context.get("host_advantage_team") or ""),
            "world_cup_context_quality": str(wc_context.get("data_completeness_score", 0)),
            "world_cup_national_model_quality": str(national_matchup.get("data_quality", 0)),
            "world_cup_national_model_blocked_reason": str(
                national_matchup.get("blocked_reason") or ""
            ),
        }
        # Real gate flags computed by the DataCollector travel inside the
        # payload (fail-closed: missing keys read as False, the old behaviour).
        quality = compute_world_cup_data_quality(
            payload=payload,
            context=wc_context,
            national_matchup=national_matchup,
            settlement_ready=bool(payload.get("settlement_ready", False)),
            squad_news_ready=bool(payload.get("squad_news_ready", False)),
        )
        result["world_cup_data_quality"] = json.dumps(quality)
        result["world_cup_data_quality_score"] = str(quality.get("total_score", 0))
        result["world_cup_publication_tier"] = str(quality.get("publication_tier", "monitor_only"))
        result["world_cup_data_quality_blocked_reasons"] = json.dumps(
            quality.get("blocked_reasons", [])
        )
        result["world_cup_odds_snapshot"] = json.dumps(quality.get("odds_snapshot") or {})
        result["provider_event_id"] = str(payload.get("provider_event_id") or payload.get("match_id") or "")
        result["provider_source"] = str(payload.get("provider_source") or "")
        # National 1X2 probabilities (Poisson rates, neutral venue). Fail-closed:
        # missing profile -> no probabilities -> no paper row downstream.
        probs = national_match_probabilities(
            self._history.get(WORLD_CUP_CODE, []),
            canonical_team_name(home),
            canonical_team_name(away),
        )
        result["world_cup_probabilities"] = json.dumps(probs or {})
        # Heartbeat detail is the WC readiness surface: FRIENDLY rows must not
        # overwrite it (they share this code path but not the WC gates).
        if is_world_cup_code(payload.get("league")):
            self.set_status_detail(world_cup_data_quality_status_detail(quality))
        if wc_context.get("market_warning"):
            result["market_warning"] = str(wc_context["market_warning"])
        return result

    async def _persist_world_cup_paper(self, payload: dict, wc_result: dict) -> None:
        """Write a WC paper prediction to unified_predictions when allowed.

        Conditions (all fail-closed):
        - publication tier is at least paper_only (monitor_only writes nothing)
        - the national probability model produced probabilities for both teams

        Rows are ALWAYS paper (signal_type="paper", is_paper=true, no odds, no
        edge) — mirrors lib/publication-gate.ts which FORCE-PAPERs WC rows while
        the registry is monitor_only. Upsert failure is non-fatal: next cycle
        retries the same (source_table, source_id) key.
        """
        tier = wc_result.get("world_cup_publication_tier", "monitor_only")
        is_friendly = is_friendlies_code(payload.get("league"))
        if is_friendly:
            # FRIENDLY publish bar: the data-quality tier is WC-calibrated
            # (odds/venue/squad gates that no friendly can pass) — what gates a
            # friendly paper row is the national model itself. Same 0.75 bar as
            # the WC national_team_model signal gate. Rows are ALWAYS paper.
            nm_quality = float(wc_result.get("world_cup_national_model_quality") or 0.0)
            if nm_quality < settings.FRIENDLY_MIN_NATIONAL_QUALITY:
                return
        elif tier == "monitor_only":
            return
        try:
            probs = json.loads(wc_result.get("world_cup_probabilities") or "{}")
        except (TypeError, ValueError):
            probs = {}
        if not probs:
            return
        try:
            # #018: real matched market → de-vig → α=0.3 blend. The SERVED
            # probabilities are the blended ones (same contract as the TS v1
            # path, APPROVE msg_mq1m1b9v). No market → identity blend, the row
            # stays a pure model paper estimate (fail-closed, nothing invented).
            odds_payload = payload.get("odds") or {}
            odds_triple = None
            bookmaker = None
            market = devig_1x2(
                odds_payload.get("odds_home"),
                odds_payload.get("odds_draw"),
                odds_payload.get("odds_away"),
            )
            if market:
                odds_triple = {
                    "home": float(odds_payload["odds_home"]),
                    "draw": float(odds_payload["odds_draw"]),
                    "away": float(odds_payload["odds_away"]),
                }
                bookmaker = str(
                    odds_payload.get("bookmaker")
                    or odds_payload.get("source")
                    or odds_payload.get("provider")
                    or "market"
                )
            # #CALIB-2: isotonic calibration (neutral-venue fit) BEFORE the
            # blend — corrects the measured directional bias of the neutral
            # Poisson model (team_a under-predicted ~2.5pp). Fail-safe: missing
            # artifact = identity. Same pre-blend architecture as #CALIB-1.
            cal_a, cal_d, cal_b = calibrate_wc_probabilities(
                float(probs["p_team_a"]),
                float(probs["p_draw"]),
                float(probs["p_team_b"]),
            )
            p_home, p_draw, p_away = blend_with_market(cal_a, cal_d, cal_b, market)
            pred = DCPrediction(
                match_id=str(payload.get("match_id")),
                league=payload["league"],
                league_name="International Friendly" if is_friendly else "FIFA World Cup 2026",
                home_team=payload["home_team"],
                away_team=payload["away_team"],
                kickoff=payload["kickoff"],
                p_home=p_home,
                p_draw=p_draw,
                p_away=p_away,
                home_team_matches=int(probs.get("team_a_matches", 0)),
                away_team_matches=int(probs.get("team_b_matches", 0)),
            )
            stage = wc_result.get("world_cup_stage") or ""
            # Build the match-specific explanation + Deep-Analysis enrichment from
            # the real sources available in the model loop: national history (form
            # + lambdas), the WC context (venue/travel/rest/host advantage/group).
            # Squad/injury info needs a DB read and is filled by the backfill /
            # squad-sync path; omitted here -> empty (fail-soft), not fabricated.
            try:
                wc_context = json.loads(wc_result.get("world_cup_context") or "{}")
            except (TypeError, ValueError):
                wc_context = {}
            venue = {
                "travel_km_home": wc_context.get("travel_distance_km_team_a"),
                "travel_km_away": wc_context.get("travel_distance_km_team_b"),
                "rest_days_home": wc_context.get("rest_days_team_a"),
                "rest_days_away": wc_context.get("rest_days_team_b"),
                "tz_shift_home": wc_context.get("timezone_shift_team_a"),
                "tz_shift_away": wc_context.get("timezone_shift_team_b"),
                "host_advantage": wc_context.get("host_advantage_team") or None,
                "altitude_m": wc_context.get("venue_altitude_m"),
                "altitude_delta_home": wc_context.get("altitude_delta_team_a"),
                "altitude_delta_away": wc_context.get("altitude_delta_team_b"),
                "indoor": wc_context.get("venue_indoor"),
                "heat_risk": wc_context.get("heat_risk"),
            }
            enrichment = build_wc_enrichment(
                home_team=payload["home_team"],
                away_team=payload["away_team"],
                canonical_home=canonical_team_name(payload["home_team"]),
                canonical_away=canonical_team_name(payload["away_team"]),
                history=self._history.get(WORLD_CUP_CODE, []),
                probs=probs,
                venue=venue,
                group=wc_context.get("group_name") or None,
            )
            # #LINEUP-1-ESPN: confirmed XIs from the collector (ESPN summary,
            # ~1h pre-kickoff). Display + data collection ONLY — probabilities
            # are NOT adjusted (any lineup feature must first win the
            # promotion gate, ops/PROMOTION-GATE.md). Fail-soft: absent = no
            # team news line, nothing fabricated.
            team_news_summary = None
            lineups = payload.get("lineups") or {}
            if lineups:
                enrichment["lineups"] = lineups
                team_news_summary = _format_confirmed_xi(
                    payload["home_team"], payload["away_team"], lineups
                )
            pick = max(
                {"HOME": pred.p_home, "DRAW": pred.p_draw, "AWAY": pred.p_away}.items(),
                key=lambda kv: kv[1],
            )[0]
            confidence = round(max(pred.p_home, pred.p_draw, pred.p_away) * 100)
            explanation = build_wc_explanation(
                home_team=payload["home_team"],
                away_team=payload["away_team"],
                enrichment=enrichment,
                probs=probs,
                pick=pick,
                confidence=confidence,
            )
            # Per-row promotion gate (#018): the data-quality tier already
            # scores odds/venue/squad/settlement quality. signal needs BOTH
            # an allowing tier AND a real matched market. FRIENDLY rows are
            # never promoted in v1 — paper only, regardless of tier.
            signal_allowed = (not is_friendly) and tier in ("signal_allowed", "premium_candidate")
            row = wc_prediction_to_unified_row(
                pred,
                # "unknown" must not override the mapper's league-name default
                stage=stage if stage not in ("", "unknown") else None,
                # Friendlies are hosted by the home side (ESPN home/away),
                # not on WC neutral ground — and the empty context would
                # otherwise default this to True.
                neutral_venue=(
                    False if is_friendly
                    else wc_result.get("neutral_venue", "True") == "True"
                ),
                explanation=explanation,
                enrichment=enrichment,
                odds_triple=odds_triple,
                bookmaker=bookmaker,
                signal_allowed=signal_allowed,
                team_news_summary=team_news_summary,
                friendly=is_friendly,
            )
            written = await upsert_unified_rows([row])
            if written:
                self.logger.info(
                    "%s row written: %s vs %s (tier=%s, %s, market=%s)",
                    "FRIENDLY" if is_friendly else "WC",
                    payload["home_team"], payload["away_team"], tier,
                    row.get("signal_type"), "yes" if odds_triple else "no",
                )
                # Calibration snapshot of what is actually served (#018):
                # insert-on-change only, so identical cycles don't flood the log.
                snap_key = str(payload.get("match_id"))
                snap_sig = (
                    round(p_home, 4), round(p_draw, 4), round(p_away, 4),
                    (odds_triple or {}).get("home"),
                )
                if self._wc_snapshot_state.get(snap_key) != snap_sig:
                    self._wc_snapshot_state[snap_key] = snap_sig
                    await log_prediction_snapshot(
                        match_id=snap_key,
                        league=payload["league"],
                        home_team=payload["home_team"],
                        away_team=payload["away_team"],
                        kickoff=payload["kickoff"],
                        served=(p_home, p_draw, p_away),
                        # #CALIB-2: model_p_* = the calibrated triple that
                        # actually enters the blend (same contract as the TS
                        # prediction_log in #CALIB-1).
                        model=(cal_a, cal_d, cal_b),
                        odds=odds_triple,
                        market=market,
                        model_version=(
                            settings.FRIENDLY_MODEL_VERSION
                            if is_friendly
                            else settings.WC_MODEL_VERSION
                        ),
                        blend_alpha=MARKET_BLEND_ALPHA if market else None,
                    )
            # v2 Elo shadow A/B (#WC-ELO-V2, APPROVE Andrea 2026-06-07): log the
            # candidate's probabilities to prediction_log alongside the served v1
            # snapshot. SHADOW ONLY — never touches pick/probabilities/the served
            # row above. Fully isolated in its own try/except so a v2 failure can
            # NEVER affect the served cycle.
            await self._log_wc_elo_v2_shadow(payload, is_friendly, odds_triple, market)
        except Exception as exc:
            # Non-fatal by contract: a writer hiccup must never break the
            # model loop. The upsert is idempotent and retried next cycle.
            self.logger.warning("WC paper writer failed (non-fatal): %s", exc)

    async def _log_wc_elo_v2_shadow(
        self,
        payload: dict,
        is_friendly: bool,
        odds_triple: dict | None,
        market: dict | None,
    ) -> None:
        """Shadow-log the v2 Elo candidate to prediction_log (A/B vs served v1).

        Read-only w.r.t. the serve path: it computes the v2 triple and writes one
        snapshot row under WC_ELO_V2_SHADOW_VERSION. Failures are swallowed here
        (never propagate to the served cycle). Insert-on-change only, keyed by the
        match id, so the 15-min cycle does not flood the log.
        """
        if not settings.WC_ELO_V2_SHADOW_ENABLED:
            return
        try:
            # WC group stage is neutral ground; friendlies are hosted (home side).
            v2 = predict_wc_elo_v2(
                payload["home_team"], payload["away_team"], neutral=not is_friendly
            )
            if v2 is None:
                return  # missing rating -> fail-soft, no shadow row (served v1 unaffected)
            p_home, p_draw, p_away = v2
            snap_key = str(payload.get("match_id"))
            sig = (round(p_home, 4), round(p_draw, 4), round(p_away, 4))
            if self._wc_v2_snapshot_state.get(snap_key) == sig:
                return
            self._wc_v2_snapshot_state[snap_key] = sig
            await log_prediction_snapshot(
                match_id=snap_key,
                league=payload["league"],
                home_team=payload["home_team"],
                away_team=payload["away_team"],
                kickoff=payload["kickoff"],
                # Shadow row: served == model == the v2 triple (it is NOT served;
                # the served=v1 baseline lives in its own model_version rows).
                served=(p_home, p_draw, p_away),
                model=(p_home, p_draw, p_away),
                odds=odds_triple,
                market=market,
                model_version=settings.WC_ELO_V2_SHADOW_VERSION,
                blend_alpha=None,
            )
        except Exception as exc:
            self.logger.warning("WC v2 Elo shadow failed (non-fatal): %s", exc)

    def _parse_results(self, fixtures: list) -> list:
        matches = []
        for f in fixtures:
            try:
                score = f["score"]["fulltime"]
                if score["home"] is None or score["away"] is None:
                    continue
                matches.append({
                    "home_team": f["teams"]["home"]["name"],
                    "away_team": f["teams"]["away"]["name"],
                    "home_goals": int(score["home"]),
                    "away_goals": int(score["away"]),
                })
            except (KeyError, TypeError):
                continue
        return matches

    async def _process(self, data: dict) -> None:
        try:
            payload = json.loads(data["payload"])
            league = payload["league"]
            home = payload["home_team"]
            away = payload["away_team"]
            if is_national_team_code(league):
                # National teams (WC + FRIENDLY) have no Dixon-Coles league
                # model; they run the national data-quality gate path instead.
                # FRIENDLY rows are always paper (never the signal path) and
                # gate on the national-model quality inside the persist writer.
                wc_result = self._build_world_cup_result(payload)
                wc_result.update({
                    "match_id": payload["match_id"],
                    "league": league,
                    "home_team": home,
                    "away_team": away,
                    "kickoff": payload["kickoff"],
                    "computed_at": datetime.now(timezone.utc).isoformat(),
                })
                await publish("model:probabilities", wc_result)
                # Paper-tier writer: the only bridge from the Python WC model to
                # unified_predictions. AnalystAgent early-returns on WC rows by
                # design, so without this call no WC row would ever be written.
                await self._persist_world_cup_paper(payload, wc_result)
                return
            model = self._models.get(league)
            if not model or not model.fitted:
                return
            if home not in model._team_idx or away not in model._team_idx:
                return

            p_home, p_draw, p_away = model.predict(home, away)

            # Apply feature corrections from enriched fixture data
            enriched = EnrichedFixture(
                home_ppg=float(payload.get("home_ppg") or 1.5),
                away_ppg=float(payload.get("away_ppg") or 1.5),
                home_xg_avg=float(payload.get("home_xg_avg") or 1.3),
                away_xg_avg=float(payload.get("away_xg_avg") or 1.3),
                home_xg_luck=float(payload.get("home_xg_luck") or 0.0),
                away_xg_luck=float(payload.get("away_xg_luck") or 0.0),
                home_motivation=float(payload.get("home_motivation") or 0.7),
                away_motivation=float(payload.get("away_motivation") or 0.7),
                h2h_home_wins=int(payload.get("h2h_home_wins") or 0),
                h2h_draws=int(payload.get("h2h_draws") or 0),
                h2h_away_wins=int(payload.get("h2h_away_wins") or 0),
                h2h_matches=int(payload.get("h2h_matches") or 0),
                temperature_c=float(payload.get("temperature_c") or 15.0),
                wind_kmh=float(payload.get("wind_kmh") or 0.0),
                precipitation_pct=float(payload.get("precipitation_pct") or 0.0),
                home_injuries_json=payload.get("home_injuries_json") or [],
                away_injuries_json=payload.get("away_injuries_json") or [],
            )
            adjusted = self._feature_adjuster.adjust(
                {"p_home": p_home, "p_draw": p_draw, "p_away": p_away},
                enriched,
            )
            p_home = adjusted.p_home
            p_draw = adjusted.p_draw
            p_away = adjusted.p_away

            # Conformal prediction intervals
            ci_home = get_interval(league, p_home)
            ci_draw = get_interval(league, p_draw)
            ci_away = get_interval(league, p_away)

            # Gate: skip publishing if best-selection interval is too wide
            best_p = max(p_home, p_draw, p_away)
            ci_width = interval_width(league, best_p)

            result = {
                "match_id": payload["match_id"],
                "league": league,
                "home_team": home,
                "away_team": away,
                "kickoff": payload["kickoff"],
                "p_home": str(p_home),
                "p_draw": str(p_draw),
                "p_away": str(p_away),
                # Conformal intervals for best selection
                "ci_low": str(min(ci_home[0], ci_draw[0], ci_away[0])),
                "ci_high": str(max(ci_home[1], ci_draw[1], ci_away[1])),
                "ci_width": str(ci_width),
                "odds": json.dumps(payload.get("odds", {})),
                "computed_at": datetime.now(timezone.utc).isoformat(),
                "feature_adjustments": ",".join(adjusted.adjustments_applied),
                "confidence_weight": str(adjusted.confidence_weight),
                "adjustment_detail": json.dumps(adjusted.adjustment_detail),
                "model_version": "football_live_v4_xg_features",
                "feature_quality": str(payload.get("feature_quality") or 0.0),
                "feature_snapshot": json.dumps(payload.get("feature_snapshot") or {}),
                "home_xg_avg": str(payload.get("home_xg_avg") or ""),
                "away_xg_avg": str(payload.get("away_xg_avg") or ""),
                "home_npxg_avg": str(payload.get("home_npxg_avg") or ""),
                "away_npxg_avg": str(payload.get("away_npxg_avg") or ""),
                "home_ppda": str(payload.get("home_ppda") or ""),
                "away_ppda": str(payload.get("away_ppda") or ""),
                "home_rest_days": str(payload.get("home_rest_days") or ""),
                "away_rest_days": str(payload.get("away_rest_days") or ""),
                "home_congestion_14d": str(payload.get("home_congestion_14d") or ""),
                "away_congestion_14d": str(payload.get("away_congestion_14d") or ""),
            }

            # Arricchisci con contesto campionato/partita
            ctx_input = {
                "home_team": home, "away_team": away, "league": league,
                "match_id": payload["match_id"],
                "kickoff": payload["kickoff"],
                "confidence": max(p_home, p_draw, p_away),
            }
            ctx = self._context_svc.enrich(ctx_input)
            result["match_type"] = ctx["match_type"]
            result["league_tier"] = str(ctx.get("league_tier") or "")
            result["league_confidence_level"] = ctx["league_confidence_level"]
            result["bet_filter_active"] = str(ctx["bet_filter_active"])
            result["auto_skip_reason"] = ctx.get("auto_skip_reason") or ""
            result["odds_anomaly"] = str(ctx.get("odds_anomaly", False))
            result["data_completeness"] = str(ctx["data_completeness"])
            result["market_efficiency"] = str(ctx.get("market_efficiency") or "")

            # Season phase detection — uses training set size as matchday proxy
            n_played = len(self._history.get(league, []))
            total = _LEAGUE_TOTAL_MATCHES.get(league, 380)
            phase = self._phase_adapter.detect_phase(n_played, total)
            phase_cfg = self._phase_adapter.get_config(phase)
            result["season_phase"] = phase.value
            result["phase_stake_multiplier"] = str(phase_cfg.stake_multiplier)
            result["phase_edge_boost"] = str(phase_cfg.edge_min_boost)
            result["phase_dead_rubber_skip"] = str(phase_cfg.dead_rubber_auto_skip)

            await publish("model:probabilities", result)

            # Persist match classification asynchronously (best-effort)
            try:
                await persist_match_classification({**ctx_input, **ctx})
            except Exception as db_err:
                self.logger.debug(f"match classification persist skipped: {db_err}")
        except Exception as e:
            self.logger.error(f"processing error: {e}")
