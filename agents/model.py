import asyncio
import json
from datetime import datetime, timezone
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.football_api_client import get_historical_results as apifootball_history, LEAGUE_IDS
from core.football_data_org_client import get_historical_results as fdorg_history, FREE_TIER_CODES
from core.world_cup_registry import api_football_season_for, is_world_cup_code, WORLD_CUP_CODE
from core.world_cup_team_model import matchup_profile
from core.world_cup_history import canonical_team_name, load_national_history
from core.world_cup_data_quality import compute_world_cup_data_quality, world_cup_data_quality_status_detail
from core.world_cup_probability import national_match_probabilities
from core.world_cup_explanation import build_wc_enrichment, build_wc_explanation
from core.supabase_client import DCPrediction, upsert_unified_rows, wc_prediction_to_unified_row
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


class ModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("ModelAgent")
        self._models: dict[str, DixonColesModel] = {}
        self._history: dict[str, list] = {}  # league → parsed match results for conformal
        self._context_svc = ContextService()
        self._phase_adapter = SeasonPhaseAdapter()
        self._feature_adjuster = FeatureAdjuster()

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
        if tier == "monitor_only":
            return
        try:
            probs = json.loads(wc_result.get("world_cup_probabilities") or "{}")
        except (TypeError, ValueError):
            probs = {}
        if not probs:
            return
        try:
            pred = DCPrediction(
                match_id=str(payload.get("match_id")),
                league=payload["league"],
                league_name="FIFA World Cup 2026",
                home_team=payload["home_team"],
                away_team=payload["away_team"],
                kickoff=payload["kickoff"],
                p_home=float(probs["p_team_a"]),
                p_draw=float(probs["p_draw"]),
                p_away=float(probs["p_team_b"]),
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
            row = wc_prediction_to_unified_row(
                pred,
                # "unknown" must not override the mapper's league-name default
                stage=stage if stage not in ("", "unknown") else None,
                neutral_venue=wc_result.get("neutral_venue", "True") == "True",
                explanation=explanation,
                enrichment=enrichment,
            )
            written = await upsert_unified_rows([row])
            if written:
                self.logger.info(
                    "WC paper row written: %s vs %s (tier=%s)",
                    payload["home_team"], payload["away_team"], tier,
                )
        except Exception as exc:
            # Non-fatal by contract: a writer hiccup must never break the
            # model loop. The upsert is idempotent and retried next cycle.
            self.logger.warning("WC paper writer failed (non-fatal): %s", exc)

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
            if is_world_cup_code(league):
                # World Cup has no Dixon-Coles league model; it runs the national
                # data-quality gate path instead and stays in EXPERIMENT_MODE
                # (paper_only tier), never the customer serving table.
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
