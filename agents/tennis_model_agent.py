import asyncio
import json
from datetime import date, datetime, timezone

from agents.base import BaseAgent
from core.redis_client import get_redis
from core.tennis_features import TennisFeatureStore
from core.tennis_names import canonical_player_key, clean_player_name
from models.elo_surface import EloSurfaceModel

MIN_ODDS = 1.50  # don't bet heavy favourites — compounded variance destroys EV
# Calibration report 2026-06-06 (docs/internal/calibration-backtest-2026-06-06.md):
# live bets priced >2.10 ran BELOW break-even (70 bets, yield −20%/−7%) while the
# 1.50–2.10 band ran above. Selections outside the band are not emitted as value
# bets; probabilities are still served untouched. Revisit when n grows.
MAX_ODDS = 2.10


def tennis_fixture_identity(fixture: dict) -> str | None:
    """Provider-independent identity for duplicate/inverted fixture rows."""
    p1 = canonical_player_key(fixture.get("player1"))
    p2 = canonical_player_key(fixture.get("player2"))
    if not p1 or not p2 or p1 == p2:
        return None
    scheduled_day = str(fixture.get("scheduled_at") or "")[:10]
    tournament = canonical_player_key(fixture.get("tournament"))
    pair = "|".join(sorted([p1, p2]))
    return f"{scheduled_day}:{tournament}:{pair}"


class FatigueAdjustment:
    MAX_ADJUSTMENT = 0.04

    def adjust(self, p1: float, p2: float,
               p1_rest_days: int = 3, p2_rest_days: int = 3,
               p1_sets_last_match: int = 2, p2_sets_last_match: int = 2) -> tuple[float, float]:
        adj1 = self._fatigue_score(p1_rest_days, p1_sets_last_match)
        adj2 = self._fatigue_score(p2_rest_days, p2_sets_last_match)
        delta = (adj2 - adj1) * self.MAX_ADJUSTMENT
        p1_adj = max(0.05, min(0.95, p1 + delta))
        p2_adj = 1.0 - p1_adj
        return round(p1_adj, 4), round(p2_adj, 4)

    def _fatigue_score(self, rest_days: int, sets_played: int) -> float:
        rest_score = min(1.0, rest_days / 4.0)
        sets_score = max(0.0, 1.0 - (sets_played - 2) * 0.15)
        return (rest_score + sets_score) / 2.0


class TennisModelAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisModelAgent")
        self.elo = EloSurfaceModel()
        self.fatigue = FatigueAdjustment()
        self.feature_store: TennisFeatureStore | None = None
        self.model_version = "elo_surface_v4_features_odds"

    # #TENNIS-1: reload Elo from DB every N cycles (~30 min at 300s/cycle) so
    # ratings updated by TennisSettlementAgent reach the scoring loop without
    # a process restart. _load_elo_ratings merges per-row and keeps current
    # ratings on any DB error (fail-safe already in place).
    ELO_RELOAD_EVERY_CYCLES = 6

    async def _main_loop(self) -> None:
        await self._load_elo_ratings()
        self._load_feature_store()
        cycles = 0
        while self._running:
            await self._compute_cycle()
            cycles += 1
            if cycles % self.ELO_RELOAD_EVERY_CYCLES == 0:
                await self._load_elo_ratings()
            await asyncio.sleep(300)

    def _load_feature_store(self) -> None:
        try:
            self.feature_store = TennisFeatureStore.from_cache()
            self.logger.info("TennisModelAgent: loaded tennis feature store")
        except Exception as exc:
            self.feature_store = None
            self.logger.warning("TennisModelAgent: feature store unavailable: %s", exc)

    async def _load_elo_ratings(self) -> None:
        try:
            from core.db import AsyncSessionLocal, EloRating
            from sqlalchemy import select
            async with AsyncSessionLocal() as session:
                result = await session.execute(select(EloRating))
                rows = result.scalars().all()
                for row in rows:
                    self.elo.ratings[row.player] = {
                        "overall": row.overall, "clay": row.clay,
                        "grass": row.grass, "hard": row.hard,
                        "clay_matches": row.clay_matches,
                        "grass_matches": row.grass_matches,
                        "hard_matches": row.hard_matches,
                        "matches": row.matches,
                    }
                    self.elo._index_player(row.player)
            self.logger.info(f"TennisModelAgent: loaded {len(self.elo.ratings)} Elo ratings from DB")
        except Exception as e:
            self.logger.error(f"_load_elo_ratings failed: {e}")

    async def _compute_cycle(self):
        # Read upcoming fixtures from Supabase tennis_fixtures table
        fixtures = await self._load_fixtures_from_db()
        if not fixtures:
            self.logger.info("tennis model: no fixtures in DB — skipping cycle")
            return

        predictions = []
        seen_fixtures: set[str] = set()
        for fixture in fixtures:
            try:
                identity = tennis_fixture_identity(fixture)
                if not identity or identity in seen_fixtures:
                    continue
                seen_fixtures.add(identity)
                pred = self._score_fixture(fixture)
                if pred:
                    predictions.append(pred)
            except Exception as exc:
                self.logger.debug("tennis scoring error: %s", exc)

        if predictions:
            await self._write_predictions(predictions)
            self.logger.info("tennis model: scored %d fixtures", len(predictions))

    async def _load_fixtures_from_db(self) -> list[dict]:
        from config.settings import settings
        import httpx
        supa_url = settings.SUPABASE_URL
        supa_key = settings.SUPABASE_SERVICE_ROLE_KEY
        if not supa_url or not supa_key:
            return []
        try:
            from datetime import timedelta
            # Include matches from last 12h (covers live/today) and upcoming
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
            async with httpx.AsyncClient(timeout=10.0) as c:
                resp = await c.get(
                    f"{supa_url.rstrip('/')}/rest/v1/tennis_fixtures",
                    params={"scheduled_at": f"gt.{cutoff}", "order": "scheduled_at.asc", "limit": "100"},
                    headers={
                        "apikey": supa_key,
                        "Authorization": f"Bearer {supa_key}",
                    },
                )
                if resp.status_code == 200:
                    return resp.json()
                return []
        except Exception as exc:
            self.logger.debug("tennis fixtures DB load error: %s", exc)
            return []

    def _score_fixture(self, fixture: dict) -> dict | None:
        p1 = clean_player_name(fixture.get("player1", ""))
        p2 = clean_player_name(fixture.get("player2", ""))
        surface = (fixture.get("surface") or "hard").lower()
        if not p1 or not p2:
            return None
        if self.feature_store is None:
            self._load_feature_store()

        # Rank guard: skip rank mismatches > 200 outside Grand Slams
        p1_rank = fixture.get("p1_rank") or 999
        p2_rank = fixture.get("p2_rank") or 999
        tournament = fixture.get("tournament") or ""
        is_grand_slam = any(gs in tournament for gs in ("Roland Garros", "Wimbledon", "US Open", "Australian Open"))
        if abs(p1_rank - p2_rank) > 200 and not is_grand_slam:
            self.logger.debug("tennis: skipping rank mismatch %s(%d) vs %s(%d)", p1, p1_rank, p2, p2_rank)
            return None

        # Base Elo prediction
        elo_result = self.elo.predict(p1, p2, surface)
        p1_prob = elo_result["p1"]
        p2_prob = elo_result["p2"]
        fixture_date = self._fixture_date(fixture.get("scheduled_at"))
        feature_context = (
            self.feature_store.match_context(p1, p2, surface, fixture_date)
            if self.feature_store is not None else {}
        )

        # Serve/return form adjustment from the backtested feature family.
        quality = float(feature_context.get("feature_quality") or 0.0)
        serve_delta = float(feature_context.get("serve_form_p1") or 0.62) - float(feature_context.get("serve_form_p2") or 0.62)
        return_delta = float(feature_context.get("return_form_p1") or 0.38) - float(feature_context.get("return_form_p2") or 0.38)
        form_delta = max(-0.035, min(0.035, ((serve_delta * 0.18) + (return_delta * 0.12)) * quality))
        if abs(form_delta) > 0.001:
            p1_prob = max(0.05, min(0.95, p1_prob + form_delta))
            p2_prob = 1.0 - p1_prob

        # H2H surface adjustment (only when >= 4 surface matches)
        h2h_s_p1 = fixture.get("h2h_surface_p1") or feature_context.get("h2h_surface_p1") or 0
        h2h_s_p2 = fixture.get("h2h_surface_p2") or feature_context.get("h2h_surface_p2") or 0
        h2h_total = h2h_s_p1 + h2h_s_p2
        if h2h_total >= 4:
            h2h_rate = h2h_s_p1 / h2h_total
            if h2h_rate > 0.70:
                p1_prob = min(0.90, p1_prob + 0.02)
            elif h2h_rate < 0.30:
                p2_prob = min(0.90, p2_prob + 0.02)
            total = p1_prob + p2_prob
            p1_prob, p2_prob = p1_prob / total, p2_prob / total

        # Fatigue using real rest/sets data from fixture.
        # `or` would treat a legitimate 0 (played same day) as missing — coalesce on None only.
        def _first_set(*values, default):
            for value in values:
                if value is not None:
                    return value
            return default

        p1_prob, p2_prob = self.fatigue.adjust(
            p1_prob, p2_prob,
            p1_rest_days=_first_set(fixture.get("p1_rest_days"), feature_context.get("p1_rest_days"), default=3),
            p2_rest_days=_first_set(fixture.get("p2_rest_days"), feature_context.get("p2_rest_days"), default=3),
            p1_sets_last_match=_first_set(fixture.get("p1_sets_last"), feature_context.get("p1_sets_last"), default=2),
            p2_sets_last_match=_first_set(fixture.get("p2_sets_last"), feature_context.get("p2_sets_last"), default=2),
        )

        odds_p1 = self._float_or_none(fixture.get("odds_p1"))
        odds_p2 = self._float_or_none(fixture.get("odds_p2"))
        edge, best_selection = self._market_edge(p1_prob, p2_prob, odds_p1, odds_p2)
        feature_snapshot = {
            "source": "jeff_sackmann_cache",
            "serve_return_delta": round(form_delta, 4),
            "feature_quality": round(quality, 4),
            "surface": surface,
            "fixture_date": fixture_date.isoformat() if fixture_date else None,
        }
        feature_snapshot.update(feature_context)

        return {
            "match_id": fixture["match_id"],
            "player1": p1,
            "player2": p2,
            "tournament": tournament,
            "surface": surface,
            "round": fixture.get("round", ""),
            "scheduled_at": fixture.get("scheduled_at", ""),
            "p1": round(p1_prob, 4),
            "p2": round(p2_prob, 4),
            "odds_p1": odds_p1,
            "odds_p2": odds_p2,
            "edge": edge,
            "best_selection": best_selection,
            "elo_p1": elo_result.get("r1_effective"),
            "elo_p2": elo_result.get("r2_effective"),
            "serve_form_p1": feature_context.get("serve_form_p1"),
            "serve_form_p2": feature_context.get("serve_form_p2"),
            "return_form_p1": feature_context.get("return_form_p1"),
            "return_form_p2": feature_context.get("return_form_p2"),
            "surface_matches_p1": feature_context.get("surface_matches_p1"),
            "surface_matches_p2": feature_context.get("surface_matches_p2"),
            "surface_reliability_p1": feature_context.get("surface_reliability_p1"),
            "surface_reliability_p2": feature_context.get("surface_reliability_p2"),
            "feature_quality": round(quality, 4),
            "p1_rest_days": feature_context.get("p1_rest_days"),
            "p2_rest_days": feature_context.get("p2_rest_days"),
            "p1_recent_matches_14d": feature_context.get("p1_recent_matches_14d"),
            "p2_recent_matches_14d": feature_context.get("p2_recent_matches_14d"),
            "h2h_p1_wins": feature_context.get("h2h_p1_wins"),
            "h2h_p2_wins": feature_context.get("h2h_p2_wins"),
            "h2h_surface_p1": feature_context.get("h2h_surface_p1"),
            "h2h_surface_p2": feature_context.get("h2h_surface_p2"),
            "feature_snapshot": feature_snapshot,
            "model_version": self.model_version,
        }

    _PREDICTION_COLS = {
        "match_id", "player1", "player2", "tournament", "surface",
        "scheduled_at", "p1", "p2", "odds_p1", "odds_p2",
        "edge", "best_selection", "model_version",
        "elo_p1", "elo_p2",
        "serve_form_p1", "serve_form_p2", "return_form_p1", "return_form_p2",
        "surface_matches_p1", "surface_matches_p2",
        "surface_reliability_p1", "surface_reliability_p2", "feature_quality",
        "p1_rest_days", "p2_rest_days", "p1_recent_matches_14d", "p2_recent_matches_14d",
        "h2h_p1_wins", "h2h_p2_wins", "h2h_surface_p1", "h2h_surface_p2",
        "feature_snapshot",
    }

    @staticmethod
    def _fixture_date(value) -> date | None:
        parsed = TennisModelAgent._parse_datetime(value)
        if parsed is None:
            return None
        return parsed.date()

    @staticmethod
    def _float_or_none(value) -> float | None:
        try:
            if value is None or value == "":
                return None
            out = float(value)
            return out if out > 1.0 else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _market_edge(p1: float, p2: float, odds_p1: float | None, odds_p2: float | None) -> tuple[float | None, str | None]:
        if not odds_p1 or not odds_p2:
            return None, None
        inv1 = 1.0 / odds_p1
        inv2 = 1.0 / odds_p2
        total = inv1 + inv2
        if total <= 0:
            return None, None
        market_p1 = inv1 / total
        market_p2 = inv2 / total
        edge_p1 = round(p1 - market_p1, 4)
        edge_p2 = round(p2 - market_p2, 4)
        if MIN_ODDS <= odds_p1 <= MAX_ODDS and edge_p1 > 0 and edge_p1 >= edge_p2:
            return edge_p1, "P1"
        if MIN_ODDS <= odds_p2 <= MAX_ODDS and edge_p2 > 0:
            return edge_p2, "P2"
        return max(edge_p1, edge_p2), None

    async def _write_predictions(self, predictions: list[dict]) -> None:
        from config.settings import settings
        import httpx
        supa_url = settings.SUPABASE_URL
        supa_key = settings.SUPABASE_SERVICE_ROLE_KEY
        if not supa_url or not supa_key or not predictions:
            return
        # Strip fields not in tennis_predictions schema
        clean = [{k: v for k, v in p.items() if k in self._PREDICTION_COLS} for p in predictions]
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                resp = await c.post(
                    f"{supa_url.rstrip('/')}/rest/v1/tennis_predictions",
                    json=clean,
                    headers={
                        "apikey": supa_key,
                        "Authorization": f"Bearer {supa_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                )
                # PostgREST signals failures via status code, not exceptions:
                # a silent 4xx here would quietly starve the board (lesson from
                # the 2026-06-05 empty Best Bets investigation).
                if resp.status_code >= 300:
                    self.logger.warning(
                        "tennis predictions write rejected: %s %s",
                        resp.status_code, resp.text[:200],
                    )
        except Exception as exc:
            self.logger.warning("tennis predictions write error: %s", exc)

    def _predict_match(self, market: dict) -> dict | None:
        player1 = market.get("player1", "")
        player2 = market.get("player2", "")
        if not player1 or not player2:
            return None

        surface = self._infer_surface(market.get("competition", ""))
        elo_pred = self.elo.predict(player1, player2, surface)
        elo_raw_p1, elo_raw_p2 = elo_pred["p1"], elo_pred["p2"]
        p1, p2 = elo_raw_p1, elo_raw_p2
        p1, p2 = self.fatigue.adjust(p1, p2)

        r1_data = self.elo._get(player1)
        r2_data = self.elo._get(player2)

        odds_p1 = market.get("odds_p1") or 0.0
        odds_p2 = market.get("odds_p2") or 0.0

        edge_p1 = round(p1 - (1.0 / odds_p1), 4) if odds_p1 else None
        edge_p2 = round(p2 - (1.0 / odds_p2), 4) if odds_p2 else None

        best_selection = None
        edge = None
        if edge_p1 is not None and edge_p2 is not None:
            p1_eligible = MIN_ODDS <= odds_p1 <= MAX_ODDS
            p2_eligible = MIN_ODDS <= odds_p2 <= MAX_ODDS
            if p1_eligible and p2_eligible:
                if edge_p1 >= edge_p2 and edge_p1 > 0:
                    best_selection, edge = "P1", edge_p1
                elif edge_p2 > 0:
                    best_selection, edge = "P2", edge_p2
                else:
                    edge = max(edge_p1, edge_p2)
            elif p1_eligible and edge_p1 > 0:
                best_selection, edge = "P1", edge_p1
            elif p2_eligible and edge_p2 > 0:
                best_selection, edge = "P2", edge_p2
            else:
                edge = max(edge_p1, edge_p2)

        return {
            "match_id": market.get("market_id", ""),
            "tournament": market.get("competition", ""),
            "surface": surface,
            "player1": player1,
            "player2": player2,
            "scheduled_at": market.get("start_time", ""),
            "p1": p1,
            "p2": p2,
            "odds_p1": odds_p1,
            "odds_p2": odds_p2,
            "edge": edge,
            "best_selection": best_selection,
            "model_version": self.model_version,
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "selection_id_p1": market.get("selection_id_p1"),
            "selection_id_p2": market.get("selection_id_p2"),
            # Elo analysis fields (for dashboard "why" section)
            "elo_p1": round(elo_pred["r1_effective"], 1),
            "elo_p2": round(elo_pred["r2_effective"], 1),
            "elo_p1_overall": round(r1_data["overall"], 1),
            "elo_p2_overall": round(r2_data["overall"], 1),
            "surface_matches_p1": r1_data.get(f"{surface}_matches", 0),
            "surface_matches_p2": r2_data.get(f"{surface}_matches", 0),
            "elo_raw_p1": elo_raw_p1,
            "elo_raw_p2": elo_raw_p2,
        }

    @staticmethod
    def _parse_datetime(value):
        if isinstance(value, datetime) or value is None:
            return value
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        except ValueError:
            return None

    def _infer_surface(self, competition: str) -> str:
        comp_lower = competition.lower()
        clay_keywords = ["roland", "french", "clay", "terra", "monte-carlo", "rome", "madrid", "barcelona"]
        grass_keywords = ["wimbledon", "grass", "queens", "halle", "eastbourne", "notting"]
        for kw in clay_keywords:
            if kw in comp_lower:
                return "clay"
        for kw in grass_keywords:
            if kw in comp_lower:
                return "grass"
        return "hard"

    async def _save_to_db(self, predictions):
        from core.db import AsyncSessionLocal, TennisPrediction
        try:
            async with AsyncSessionLocal() as session:
                for p in predictions:
                    pred = TennisPrediction(
                        match_id=p["match_id"],
                        tournament=p.get("tournament", ""),
                        surface=p.get("surface", "hard"),
                        player1=p["player1"],
                        player2=p["player2"],
                        scheduled_at=self._parse_datetime(p.get("scheduled_at")),
                        p1=p["p1"], p2=p["p2"],
                        odds_p1=p.get("odds_p1"), odds_p2=p.get("odds_p2"),
                        edge=p.get("edge"),
                        best_selection=p.get("best_selection"),
                        model_version=p.get("model_version", "elo_v2"),
                        computed_at=self._parse_datetime(p.get("computed_at")),
                    )
                    session.add(pred)
                await session.commit()
        except Exception as e:
            self.logger.error(f"_save_to_db error: {e}")
