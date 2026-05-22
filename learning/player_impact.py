from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class PlayerStatus(Enum):
    AVAILABLE = "AVAILABLE"
    INJURED = "INJURED"
    SUSPENDED = "SUSPENDED"
    DOUBTFUL = "DOUBTFUL"


@dataclass
class PlayerProfile:
    player_id: str
    name: str
    team: str
    role: str
    importance_score: float         # 0.0 → 1.0
    goals_last_5: int
    assists_last_5: int
    xg_contribution_last_5: float
    minutes_played_last_5: int
    status: PlayerStatus = PlayerStatus.AVAILABLE


_DOUBTFUL_AVAILABILITY = 0.50


class PlayerImpactModel:
    """
    Tracks player profiles and computes lineup-level probability deltas.
    """

    def __init__(self) -> None:
        self._players: dict[str, PlayerProfile] = {}

    # ── Registration ──────────────────────────────────────────────────────────

    def register_player(self, profile: PlayerProfile) -> None:
        self._players[profile.player_id] = profile

    def get_player(self, player_id: str) -> Optional[PlayerProfile]:
        return self._players.get(player_id)

    def update_status(self, player_id: str, status: PlayerStatus) -> None:
        if player_id not in self._players:
            raise KeyError(f"Player '{player_id}' not registered")
        self._players[player_id].status = status

    # ── Lineup delta ──────────────────────────────────────────────────────────

    def compute_lineup_delta(
        self,
        available_home: list[str],
        missing_home: list[str],
        available_away: list[str],
        missing_away: list[str],
    ) -> float:
        home_loss = sum(
            self._players[pid].importance_score
            for pid in missing_home
            if pid in self._players
        )
        away_loss = sum(
            self._players[pid].importance_score
            for pid in missing_away
            if pid in self._players
        )
        return float(away_loss - home_loss)

    # ── Availability risk ─────────────────────────────────────────────────────

    def player_availability_risk(self, player_ids: list[str]) -> dict[str, float]:
        result: dict[str, float] = {}
        for pid in player_ids:
            profile = self._players.get(pid)
            if profile is None:
                continue
            if profile.status in (PlayerStatus.INJURED, PlayerStatus.SUSPENDED):
                result[pid] = 0.0
            elif profile.status == PlayerStatus.DOUBTFUL:
                result[pid] = _DOUBTFUL_AVAILABILITY
            else:
                result[pid] = 1.0
        return result

    # ── Top players ───────────────────────────────────────────────────────────

    def top_players_by_team(self, team: str, n: int = 5) -> list[PlayerProfile]:
        team_players = [p for p in self._players.values() if p.team == team]
        return sorted(team_players, key=lambda p: p.importance_score, reverse=True)[:n]
