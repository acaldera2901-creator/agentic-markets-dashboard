import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.telegram_client import is_near_kickoff
from config.settings import settings


def _edge_threshold(data: dict) -> tuple[float, str]:
    notes = str(data.get("notes", "")).lower()
    source = str(data.get("source", "")).lower()
    if any(k in notes or k in source for k in ("pinnacle", "matchbook", "exchange", "sharp")):
        return settings.EDGE_MIN_SHARP, "sharp"
    return settings.EDGE_MIN_SOFT, "soft"

ANALYST_SYSTEM = """You are a quantitative football analyst for a prediction market trading desk.
You receive probability estimates from a Dixon-Coles Poisson model and current market odds.
Your job is to identify genuine value bets where the model edge is statistically meaningful.
Be concise. Flag false positives (low volume markets, suspicious line moves). Output JSON only."""


class AnalystAgent(BaseAgent):
    def __init__(self):
        super().__init__("AnalystAgent")

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("model:probabilities", "analyst_group", "AnalystAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            # World Cup rows are EXPERIMENT_MODE diagnostics (data-quality tier),
            # not 1X2 value-bet signals — they carry no p_home/p_draw/p_away and
            # must never enter the bet/edge pipeline. Skip them silently.
            if "p_home" not in data or "world_cup_publication_tier" in data:
                return
            p_home = float(data["p_home"])
            p_draw = float(data["p_draw"])
            p_away = float(data["p_away"])
            odds_raw = json.loads(data.get("odds", "{}"))

            market_odds = self._extract_odds(odds_raw)
            if not market_odds:
                return

            def implied(o: float) -> float:
                return 1.0 / o if o > 0 else 0.0

            edges = {
                "home": p_home - implied(market_odds["home"]),
                "draw": p_draw - implied(market_odds["draw"]),
                "away": p_away - implied(market_odds["away"]),
            }
            best_sel = max(edges, key=edges.get)
            best_edge = edges[best_sel]

            # Raise effective edge threshold by phase_edge_boost from ModelAgent
            phase_boost = float(data.get("phase_edge_boost") or 0.0)
            confidence_weight = max(0.5, min(1.0, float(data.get("confidence_weight") or 1.0)))
            # High confidence → lower required edge threshold. Low confidence → higher threshold.
            effective_min_edge = (settings.MIN_EDGE + phase_boost) / confidence_weight

            # Short-odds guard: heavy favourites compound variance — require extra edge
            odds_for_sel = market_odds[best_sel]
            if odds_for_sel < settings.SHORT_ODDS_THRESHOLD:
                effective_min_edge = max(effective_min_edge, settings.MIN_EDGE_SHORT_ODDS)

            if best_edge < effective_min_edge:
                if is_near_kickoff(data.get("kickoff", "")):
                    from core.telegram_client import send, match_header
                    edge_threshold, tier = _edge_threshold(data)
                    await send(
                        f"⚪ <b>NESSUN BET</b> — edge insufficiente\n"
                        f"{match_header(data)}\n"
                        f"📊 p_home={p_home:.0%}  p_draw={p_draw:.0%}  p_away={p_away:.0%}\n"
                        f"📉 Edge migliore: <b>{best_sel} +{best_edge*100:.1f}%</b>\n"
                        f"🔻 Soglia {tier}: {edge_threshold*100:.0f}% — non raggiunta"
                    )
                return

            assessment = await self._assess(data, market_odds, best_sel, best_edge)
            if not assessment.get("valid"):
                self.logger.info(
                    f"skipped {data['home_team']} vs {data['away_team']}: {assessment.get('notes')}"
                )
                return
            if data.get("league") == "WC":
                context_quality = float(data.get("world_cup_context_quality") or 0.0)
                national_quality = float(data.get("world_cup_national_model_quality") or 0.0)
                data_quality = float(data.get("world_cup_data_quality_score") or 0.0)
                publication_tier = str(data.get("world_cup_publication_tier") or "monitor_only")
                if data_quality < 0.78:
                    self.logger.info(
                        "skipped World Cup signal: data quality %.2f below publication threshold",
                        data_quality,
                    )
                    self.set_status_detail({
                        "type": "analyst_gate",
                        "league": "WC",
                        "blocked_reason": "world_cup_data_quality_below_threshold",
                        "world_cup_data_quality_score": data_quality,
                        "publication_tier": publication_tier,
                        "required_min": 0.78,
                        "blocked_reasons": data.get("world_cup_data_quality_blocked_reasons", "[]"),
                    })
                    return
                if context_quality < 0.78:
                    self.logger.info(
                        "skipped World Cup signal: context quality %.2f below publication threshold",
                        context_quality,
                    )
                    self.set_status_detail({
                        "type": "analyst_gate",
                        "league": "WC",
                        "blocked_reason": "world_cup_context_quality_below_threshold",
                        "world_cup_context_quality": context_quality,
                        "required_min": 0.78,
                    })
                    return
                if national_quality < 0.75:
                    self.logger.info(
                        "skipped World Cup signal: national model quality %.2f below publication threshold",
                        national_quality,
                    )
                    self.set_status_detail({
                        "type": "analyst_gate",
                        "league": "WC",
                        "blocked_reason": data.get("world_cup_national_model_blocked_reason")
                            or "world_cup_national_model_quality_below_threshold",
                        "world_cup_national_model_quality": national_quality,
                        "required_min": 0.75,
                    })
                    return

            bookmaker_source = odds_raw.get("bookmaker", "")
            opportunity = {
                "match_id": data["match_id"],
                "league": data["league"],
                "home_team": data["home_team"],
                "away_team": data["away_team"],
                "kickoff": data["kickoff"],
                "selection": best_sel,
                "edge": str(best_edge),
                "odds": str(market_odds[best_sel]),
                "p_home": data.get("p_home", "0"),
                "p_draw": data.get("p_draw", "0"),
                "p_away": data.get("p_away", "0"),
                # Conformal prediction interval (pass through from model)
                "ci_low": data.get("ci_low", "0"),
                "ci_high": data.get("ci_high", "1"),
                "ci_width": data.get("ci_width", "1"),
                "confidence": str(assessment.get("confidence", 0.7)),
                "notes": assessment.get("notes", ""),
                "source": bookmaker_source,
                # Season phase context (pass through)
                "season_phase": data.get("season_phase", "MID"),
                "phase_stake_multiplier": data.get("phase_stake_multiplier", "1.0"),
                "phase_edge_boost": data.get("phase_edge_boost", "0.0"),
                "phase_dead_rubber_skip": data.get("phase_dead_rubber_skip", "False"),
                "match_type": data.get("match_type", "STANDARD"),
                "league_tier": data.get("league_tier", ""),
                "auto_skip_reason": data.get("auto_skip_reason", ""),
                "world_cup_stage": data.get("world_cup_stage", ""),
                "neutral_venue": data.get("neutral_venue", ""),
                "host_advantage_team": data.get("host_advantage_team", ""),
                "world_cup_context_quality": data.get("world_cup_context_quality", ""),
                "world_cup_national_model_quality": data.get("world_cup_national_model_quality", ""),
                "world_cup_national_model_blocked_reason": data.get("world_cup_national_model_blocked_reason", ""),
                "world_cup_data_quality_score": data.get("world_cup_data_quality_score", ""),
                "world_cup_publication_tier": data.get("world_cup_publication_tier", ""),
                "world_cup_data_quality_blocked_reasons": data.get("world_cup_data_quality_blocked_reasons", ""),
                "world_cup_odds_snapshot": data.get("world_cup_odds_snapshot", ""),
                "provider_event_id": data.get("provider_event_id", ""),
                "provider_source": data.get("provider_source", ""),
                "market_warning": data.get("market_warning", ""),
                "found_at": datetime.utcnow().isoformat(),
                "feature_adjustments": data.get("feature_adjustments", ""),
                "confidence_weight": data.get("confidence_weight", "1.0"),
            }
            await publish("analyst:opportunities", opportunity)
            self.logger.info(
                f"opportunity: {data['home_team']} vs {data['away_team']} "
                f"{best_sel} edge={best_edge:.3f}"
            )
        except Exception as e:
            self.logger.error(f"analyst error: {e}")

    def _extract_odds(self, odds_raw: dict) -> dict | None:
        """Handle both our normalized format and legacy Betfair raw format."""
        # Normalized format (from updated odds_api_client)
        if "odds_home" in odds_raw:
            oh = odds_raw.get("odds_home", 0)
            od = odds_raw.get("odds_draw", 0)
            oa = odds_raw.get("odds_away", 0)
            if oh and od and oa:
                return {"home": oh, "draw": od, "away": oa}

        # Legacy Betfair raw format (bookmakers list)
        bookmakers = odds_raw.get("bookmakers", [])
        best: dict = {}
        best_margin = float("inf")
        for bm in bookmakers:
            for market in bm.get("markets", []):
                if market.get("key") != "h2h":
                    continue
                o: dict = {}
                for outcome in market.get("outcomes", []):
                    name = outcome["name"].lower()
                    price = outcome["price"]
                    if "draw" in name:
                        o["draw"] = price
                    elif name in (odds_raw.get("home_team", "").lower(),):
                        o["home"] = price
                    else:
                        o["away"] = price
                if len(o) == 3:
                    margin = 1 / o["home"] + 1 / o["draw"] + 1 / o["away"] - 1
                    if margin < best_margin:
                        best_margin = margin
                        best = o
        return best if len(best) == 3 else None

    async def _assess(
        self, data: dict, odds: dict, selection: str, edge: float
    ) -> dict:
        """Use Claude if key is set, otherwise rule-based assessment."""
        if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY.startswith("sk-ant-..."):
            # Rule-based fallback: validate by edge magnitude
            valid = edge >= settings.MIN_EDGE
            return {
                "valid": valid,
                "confidence": min(0.5 + edge * 5, 0.95),
                "notes": f"rule-based: edge={edge:.3f} on {selection}",
            }

        try:
            from core.claude_client import ask
            p_home = float(data["p_home"])
            p_draw = float(data["p_draw"])
            p_away = float(data["p_away"])
            prompt = (
                f"Match: {data['home_team']} vs {data['away_team']} ({data['league']})\n"
                f"Kickoff: {data['kickoff']}\n"
                f"Model: home={p_home:.3f} draw={p_draw:.3f} away={p_away:.3f}\n"
                f"Odds: home={odds['home']} draw={odds['draw']} away={odds['away']}\n"
                f"Edge on '{selection}': {edge:.3f}\n\n"
                "Is the edge genuine or a data artifact? "
                'Reply ONLY with JSON: {"valid": true/false, "confidence": 0-1, "notes": "..."}'
            )
            response = await ask(ANALYST_SYSTEM, prompt)
            return json.loads(response)
        except Exception as e:
            self.logger.warning(f"Claude unavailable, using rule-based: {e}")
            return {"valid": True, "confidence": 0.6, "notes": f"fallback: {edge:.3f}"}
