"""Dataclass e normalizzatori puri per i dati giocatore."""
from __future__ import annotations
from dataclasses import dataclass

from core.player_data_tier import tier_for_league, is_eligible


@dataclass(frozen=True)
class PlayerSeasonStat:
    player_id: str
    name: str
    team: str
    league: str
    position: str
    appearances: int
    minutes: int
    goals: int
    assists: int
    shots: int
    season: int


@dataclass(frozen=True)
class PlayerMatchStat:
    player_id: str
    fixture_id: int
    league: str
    team: str
    minutes: int
    goals: int
    assists: int
    shots: int
    xg: float | None
    started: bool
    match_date: str


@dataclass(frozen=True)
class PlayerLineupEntry:
    player_id: str
    fixture_id: int
    team: str
    position: str
    shirt_number: int | None
    is_starter: bool


@dataclass(frozen=True)
class PlayerProfile:
    player_id: str
    name: str
    team: str
    league: str
    tier: int
    role: str
    goals_per90_season: float
    xg_per90_season: float | None
    minutes_share: float
    penalty_taker: bool
    eligible_for_player_markets: bool
    last_updated: str


def _stat_block(entry: dict) -> dict | None:
    stats = entry.get("statistics") or []
    return stats[0] if stats else None


def normalize_season_stats(raw: list[dict], league: str, season: int) -> list[PlayerSeasonStat]:
    out: list[PlayerSeasonStat] = []
    for entry in raw:
        player = entry.get("player") or {}
        block = _stat_block(entry)
        if not player.get("id") or not block:
            continue
        games = block.get("games") or {}
        apps = games.get("appearences")
        if not apps:                     # None o 0 → scarta
            continue
        goals = block.get("goals") or {}
        shots = block.get("shots") or {}
        team = (block.get("team") or {}).get("name", "")
        out.append(PlayerSeasonStat(
            player_id=str(player["id"]),
            name=player.get("name", ""),
            team=team,
            league=league,
            position=games.get("position", ""),
            appearances=int(apps),
            minutes=int(games.get("minutes") or 0),
            goals=int(goals.get("total") or 0),
            assists=int(goals.get("assists") or 0),
            shots=int(shots.get("total") or 0),
            season=season,
        ))
    return out


def build_profile(season: PlayerSeasonStat, xg_per90: float | None, today_iso: str) -> PlayerProfile:
    minutes = max(season.minutes, 1)
    goals_per90 = season.goals / minutes * 90
    # minutes_share: minuti su un massimo teorico di 90*presenze
    minutes_share = min(1.0, season.minutes / (season.appearances * 90)) if season.appearances else 0.0
    eligible = is_eligible(season.appearances, today_iso, today_iso)
    return PlayerProfile(
        player_id=season.player_id,
        name=season.name,
        team=season.team,
        league=season.league,
        tier=tier_for_league(season.league),
        role=season.position,
        goals_per90_season=goals_per90,
        xg_per90_season=xg_per90,
        minutes_share=minutes_share,
        penalty_taker=False,            # arricchito in B; default conservativo
        eligible_for_player_markets=eligible,
        last_updated=today_iso,
    )
