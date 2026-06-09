"""
Elo Surface-Adjusted model for tennis match prediction.

Each player has:
  - overall Elo rating
  - surface-specific Elo rating for clay, grass, hard

Predictions blend overall + surface rating (70% surface, 30% overall)
when surface data is available.
"""
import math
import logging
from core.tennis_names import canonical_player_key

logger = logging.getLogger(__name__)

SURFACES = ["clay", "grass", "hard"]
DEFAULT_RATING = 1500.0
SURFACE_WEIGHT = 0.7   # weight for surface-specific rating in prediction
OVERALL_WEIGHT = 0.3


class EloSurfaceModel:
    def __init__(self):
        # ratings: {player_name: {overall: float, clay: float, grass: float, hard: float}}
        self.ratings: dict[str, dict[str, float]] = {}
        self._canonical_index: dict[str, str] = {}
        self.K = 24  # #TENNIS-K24 (2026-06-09): ECE -45% OOS, Brier flat. Mirror of update() default.
        self.decay = 0.99  # per-match decay applied to inactive players

    def _index_player(self, player: str) -> None:
        key = canonical_player_key(player)
        if key:
            self._canonical_index[key] = player

    def _resolve_player(self, player: str) -> str:
        if player in self.ratings:
            return player
        key = canonical_player_key(player)
        if key in self._canonical_index:
            return self._canonical_index[key]
        for existing in self.ratings:
            if canonical_player_key(existing) == key:
                self._canonical_index[key] = existing
                return existing
        return player

    def _get(self, player: str) -> dict[str, float]:
        player = self._resolve_player(player)
        if player not in self.ratings:
            self.ratings[player] = {
                "overall": DEFAULT_RATING,
                "clay": DEFAULT_RATING,
                "grass": DEFAULT_RATING,
                "hard": DEFAULT_RATING,
                "matches": 0,
            }
            self._index_player(player)
        return self.ratings[player]

    def expected_score(self, r1: float, r2: float) -> float:
        """Expected score for player with rating r1 against r2."""
        return 1.0 / (1.0 + math.pow(10, (r2 - r1) / 400.0))

    def _effective_rating(self, player: str, surface: str) -> float:
        """Blend surface + overall rating."""
        r = self._get(player)
        if surface not in SURFACES:
            return r["overall"]
        surface_r = r[surface]
        overall_r = r["overall"]
        # Use pure surface after 20 surface matches, blend before
        matches = r.get(f"{surface}_matches", 0)
        weight = min(SURFACE_WEIGHT, SURFACE_WEIGHT * matches / 20.0)
        return weight * surface_r + (1.0 - weight) * overall_r

    def predict(self, player1: str, player2: str, surface: str = "hard") -> dict:
        """
        Return win probabilities for player1 and player2.
        {p1: float, p2: float, r1_effective: float, r2_effective: float}
        """
        surface = surface.lower()
        r1 = self._effective_rating(player1, surface)
        r2 = self._effective_rating(player2, surface)
        p1 = self.expected_score(r1, r2)
        return {
            "p1": round(p1, 4),
            "p2": round(1.0 - p1, 4),
            "r1_effective": round(r1, 1),
            "r2_effective": round(r2, 1),
        }

    def update(self, winner: str, loser: str, surface: str, k_factor: int = 24) -> None:
        """Update ratings after a match result."""
        surface = surface.lower()
        w = self._get(winner)
        l = self._get(loser)

        r_w = self._effective_rating(winner, surface)
        r_l = self._effective_rating(loser, surface)

        e_w = self.expected_score(r_w, r_l)
        e_l = 1.0 - e_w

        # Update overall
        w["overall"] += k_factor * (1.0 - e_w)
        l["overall"] += k_factor * (0.0 - e_l)

        # Update surface-specific
        if surface in SURFACES:
            w[surface] += k_factor * (1.0 - e_w)
            l[surface] += k_factor * (0.0 - e_l)
            w[f"{surface}_matches"] = w.get(f"{surface}_matches", 0) + 1
            l[f"{surface}_matches"] = l.get(f"{surface}_matches", 0) + 1

        w["matches"] = w.get("matches", 0) + 1
        l["matches"] = l.get("matches", 0) + 1

    def load_from_db(self, conn) -> None:
        """Sync placeholder — use load_from_db_async instead."""
        logger.info("EloSurfaceModel.load_from_db: use async variant")

    def save_to_db(self, conn) -> None:
        """Sync placeholder — use save_to_db_async instead."""
        logger.info("EloSurfaceModel.save_to_db: use async variant")

    async def load_from_db_async(self, session) -> None:
        """Load all Elo ratings from Neon DB."""
        from core.db import EloRating
        from sqlalchemy import select
        result = await session.execute(select(EloRating))
        rows = result.scalars().all()
        for row in rows:
            self.ratings[row.player] = {
                "overall": row.overall, "clay": row.clay, "grass": row.grass, "hard": row.hard,
                "clay_matches": row.clay_matches, "grass_matches": row.grass_matches,
                "hard_matches": row.hard_matches, "matches": row.matches,
            }
            self._index_player(row.player)
        logger.info(f"EloSurfaceModel: loaded {len(rows)} player ratings from DB")

    async def save_to_db_async(self, session) -> None:
        """Upsert all Elo ratings to Neon DB."""
        from core.db import EloRating
        for player, r in self.ratings.items():
            rating = EloRating(
                player=player, overall=r["overall"], clay=r["clay"], grass=r["grass"], hard=r["hard"],
                clay_matches=r.get("clay_matches", 0), grass_matches=r.get("grass_matches", 0),
                hard_matches=r.get("hard_matches", 0), matches=r.get("matches", 0),
            )
            await session.merge(rating)
        await session.commit()

    def player_summary(self, player: str) -> dict:
        """Return ratings summary for a player."""
        r = self._get(player)
        return {
            "player": player,
            "overall": round(r["overall"], 1),
            "clay": round(r["clay"], 1),
            "grass": round(r["grass"], 1),
            "hard": round(r["hard"], 1),
            "matches": r.get("matches", 0),
        }
