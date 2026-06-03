"""Surface-aware Elo for tennis.

Each player carries an overall rating plus one rating per surface. The win
probability blends the two (surface form matters, but pure surface ratings are
noisy early), and both are updated after each match. Incremental / walk-forward.
"""
from __future__ import annotations

from collections import defaultdict


class SurfaceElo:
    def __init__(self, base: float = 1500.0, k: float = 32.0, surface_weight: float = 0.5) -> None:
        self.base = base
        self.k = k
        self.surface_weight = surface_weight
        self._overall: dict[str, float] = defaultdict(lambda: base)
        self._surface: dict[tuple[str, str], float] = defaultdict(lambda: base)

    def _blend(self, player: str, surface: str) -> float:
        ov = self._overall[player]
        sf = self._surface[(player, surface)]
        return (1 - self.surface_weight) * ov + self.surface_weight * sf

    def expected(self, p1: str, p2: str, surface: str) -> float:
        diff = self._blend(p1, surface) - self._blend(p2, surface)
        return 1.0 / (1.0 + 10 ** (-diff / 400.0))

    def rating(self, player: str, surface: str) -> float:
        return self._blend(player, surface)

    def update(self, winner: str, loser: str, surface: str) -> None:
        exp_w = self.expected(winner, loser, surface)
        delta = self.k * (1.0 - exp_w)
        self._overall[winner] += delta
        self._overall[loser] -= delta
        self._surface[(winner, surface)] += delta
        self._surface[(loser, surface)] -= delta
