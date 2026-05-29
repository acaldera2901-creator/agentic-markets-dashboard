import asyncio
import json
from datetime import datetime, timezone

from agents.base import BaseAgent
from core.redis_client import get_redis
from models.elo_surface import EloSurfaceModel

MIN_ODDS = 1.50  # don't bet heavy favourites — compounded variance destroys EV


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
        self.model_version = "elo_v2"

    async def _main_loop(self) -> None:
        await self._load_elo_ratings()
        while self._running:
            await self._compute_cycle()
            await asyncio.sleep(300)

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
        for fixture in fixtures:
            try:
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
            import datetime
            now_iso = datetime.datetime.utcnow().isoformat()
            async with httpx.AsyncClient(timeout=10.0) as c:
                resp = await c.get(
                    f"{supa_url.rstrip('/')}/rest/v1/tennis_fixtures",
                    params={"scheduled_at": f"gt.{now_iso}", "order": "scheduled_at.asc", "limit": "100"},
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
        p1 = fixture.get("player1", "")
        p2 = fixture.get("player2", "")
        surface = (fixture.get("surface") or "hard").lower()
        if not p1 or not p2:
            return None

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

        # H2H surface adjustment (only when >= 4 surface matches)
        h2h_s_p1 = fixture.get("h2h_surface_p1") or 0
        h2h_s_p2 = fixture.get("h2h_surface_p2") or 0
        h2h_total = h2h_s_p1 + h2h_s_p2
        if h2h_total >= 4:
            h2h_rate = h2h_s_p1 / h2h_total
            if h2h_rate > 0.70:
                p1_prob = min(0.90, p1_prob + 0.02)
            elif h2h_rate < 0.30:
                p2_prob = min(0.90, p2_prob + 0.02)
            total = p1_prob + p2_prob
            p1_prob, p2_prob = p1_prob / total, p2_prob / total

        # Fatigue using real rest/sets data from fixture
        p1_prob, p2_prob = self.fatigue.adjust(
            p1_prob, p2_prob,
            p1_rest_days=fixture.get("p1_rest_days") or 3,
            p2_rest_days=fixture.get("p2_rest_days") or 3,
            p1_sets_last_match=fixture.get("p1_sets_last") or 2,
            p2_sets_last_match=fixture.get("p2_sets_last") or 2,
        )

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
            "elo_p1": elo_result.get("r1_effective"),
            "elo_p2": elo_result.get("r2_effective"),
            "model_version": "elo_surface_v3_h2h_fatigue",
        }

    async def _write_predictions(self, predictions: list[dict]) -> None:
        from config.settings import settings
        import httpx
        supa_url = settings.SUPABASE_URL
        supa_key = settings.SUPABASE_SERVICE_ROLE_KEY
        if not supa_url or not supa_key or not predictions:
            return
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                await c.post(
                    f"{supa_url.rstrip('/')}/rest/v1/tennis_predictions",
                    json=predictions,
                    headers={
                        "apikey": supa_key,
                        "Authorization": f"Bearer {supa_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                )
        except Exception as exc:
            self.logger.debug("tennis predictions write error: %s", exc)

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
            p1_eligible = odds_p1 >= MIN_ODDS
            p2_eligible = odds_p2 >= MIN_ODDS
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
