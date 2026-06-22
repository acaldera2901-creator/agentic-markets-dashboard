"""
Tennis API client via RapidAPI (API-Sports Tennis).
Uses RAPIDAPI_KEY from settings. Free tier: 100 requests/day.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from config.settings import settings
from core.tennis_names import canonical_player_key, clean_player_name

logger = logging.getLogger("tennis_api_client")

_RAPIDAPI_HOST = "v1.tennis.api-sports.io"
_BASE = f"https://{_RAPIDAPI_HOST}"
_SURFACE_MAP = {
    "Clay": "clay",
    "Hard": "hard",
    "Grass": "grass",
    "Indoor Hard": "hard",
    "Indoor": "hard",
}


def normalize_player_name(name: str) -> str:
    return canonical_player_key(name)


class TennisAPIClient:
    def __init__(
        self,
        rapidapi_key: str | None = None,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
    ) -> None:
        self._key = rapidapi_key or settings.RAPIDAPI_KEY
        self._supa_url = supabase_url or settings.SUPABASE_URL
        self._supa_key = supabase_key or settings.SUPABASE_SERVICE_ROLE_KEY

    async def get_upcoming_fixtures(self, days_ahead: int = 7) -> list[dict]:
        """Fetch ATP/WTA fixtures for today. Returns list of canonical fixture dicts."""
        if not self._key:
            logger.warning("RAPIDAPI_KEY not configured — tennis fixtures unavailable")
            return []
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        fixtures: list[dict] = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as c:
                resp = await c.get(
                    f"{_BASE}/games",
                    params={"date": today},
                    headers=self._headers(),
                )
                if resp.status_code != 200:
                    logger.warning("tennis API %s: %s", resp.status_code, resp.text[:200])
                    return []
                data = resp.json()
                for item in data.get("response", []):
                    parsed = self._parse_fixture(item)
                    if parsed:
                        fixtures.append(parsed)
        except Exception as exc:
            logger.debug("tennis API error (non-fatal): %s", exc)
        return fixtures

    async def get_h2h(self, p1_name: str, p2_name: str) -> dict:
        """Return H2H stats: {p1_wins, p2_wins, total}."""
        if not self._key:
            return {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                r1 = await c.get(f"{_BASE}/players", params={"search": p1_name}, headers=self._headers())
                r2 = await c.get(f"{_BASE}/players", params={"search": p2_name}, headers=self._headers())
                pid1 = r1.json().get("response", [{}])[0].get("id") if r1.status_code == 200 else None
                pid2 = r2.json().get("response", [{}])[0].get("id") if r2.status_code == 200 else None
                if not pid1 or not pid2:
                    return {}
                h2h_resp = await c.get(
                    f"{_BASE}/games",
                    params={"h2h": f"{pid1}-{pid2}"},
                    headers=self._headers(),
                )
                if h2h_resp.status_code != 200:
                    return {}
                games = h2h_resp.json().get("response", [])
        except Exception as exc:
            logger.debug("tennis h2h error: %s", exc)
            return {}

        p1_wins = p2_wins = 0
        for g in games:
            winner = g.get("winner", {})
            wp = winner.get("id")
            if wp == pid1:
                p1_wins += 1
            elif wp == pid2:
                p2_wins += 1
        return {"p1_wins": p1_wins, "p2_wins": p2_wins, "total": p1_wins + p2_wins}

    # Campi odds: scritti SOLO quando reali, per non azzerare con NULL le quote
    # già salvate (root cause "quote che svaniscono": l'upsert merge-duplicates
    # sovrascriveva odds_* a NULL per i fixture senza quote fresche, mentre il
    # fetch OddsPapi è once-on-success → la quota presa una volta veniva cancellata
    # al ciclo dopo). Two-pass: (A) upsert SENZA campi odds (colonne odds intatte),
    # (B) upsert solo i fixture CON odds reali (aggiorna solo quelle).
    _ODDS_COLS = ("odds_p1", "odds_p2", "odds_provider", "odds_bookmaker", "odds_event_id")

    async def _fetch_existing_odds(self, match_ids: list[str]) -> dict[str, dict]:
        """Legge le odds già salvate in tennis_fixtures per i match_id dati."""
        out: dict[str, dict] = {}
        if not match_ids:
            return out
        url = f"{self._supa_url.rstrip('/')}/rest/v1/tennis_fixtures"
        cols = "match_id," + ",".join(self._ODDS_COLS)
        ids = ",".join(f'"{m}"' for m in match_ids)
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                r = await c.get(
                    f"{url}?select={cols}&match_id=in.({ids})&odds_p1=not.is.null",
                    headers={"apikey": self._supa_key, "Authorization": f"Bearer {self._supa_key}"},
                )
                if r.status_code == 200:
                    for row in r.json():
                        out[row["match_id"]] = {k: row.get(k) for k in self._ODDS_COLS}
        except Exception as exc:
            logger.debug("tennis existing-odds read error (non-fatal): %s", exc)
        return out

    async def write_fixtures_to_supabase(self, fixtures: list[dict]) -> None:
        """Upsert tennis_fixtures, preservando le odds già salvate (carry-forward):
        per i fixture senza quote fresche questo ciclo, riusa le odds in DB invece di
        azzerarle, poi un singolo upsert full-row (richiede le colonne NOT NULL)."""
        if not fixtures or not self._supa_url or not self._supa_key:
            return
        url = f"{self._supa_url.rstrip('/')}/rest/v1/tennis_fixtures"
        need = [f["match_id"] for f in fixtures if f.get("odds_p1") is None and f.get("match_id")]
        existing = await self._fetch_existing_odds(need)
        for f in fixtures:
            mid = f.get("match_id")
            if f.get("odds_p1") is None and mid in existing:
                for k in self._ODDS_COLS:
                    f[k] = existing[mid].get(k)
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                await c.post(
                    url,
                    json=fixtures,
                    headers={
                        "apikey": self._supa_key,
                        "Authorization": f"Bearer {self._supa_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                )
        except Exception as exc:
            logger.debug("tennis fixture write error (non-fatal): %s", exc)

    def _parse_fixture(self, raw: dict[str, Any]) -> dict | None:
        try:
            players = raw.get("players", {})
            p1 = players.get("home", {})
            p2 = players.get("away", {})
            p1_name = clean_player_name(p1.get("name"))
            p2_name = clean_player_name(p2.get("name"))
            if not p1_name or not p2_name:
                return None
            tournament = raw.get("tournament", {})
            surface_raw = tournament.get("surface", "Hard")
            surface = _SURFACE_MAP.get(surface_raw, "hard")
            match_id = f"tennis:rapidapi:{raw.get('id', '')}"
            return {
                "match_id": match_id,
                "player1": p1_name,
                "player2": p2_name,
                "tournament": tournament.get("name", ""),
                "surface": surface,
                "round": (raw.get("round") or {}).get("name", ""),
                "scheduled_at": raw.get("date", ""),
                "p1_rank": p1.get("ranking"),
                "p2_rank": p2.get("ranking"),
                "p1_rank_points": p1.get("points"),
                "p2_rank_points": p2.get("points"),
                "provider": "rapidapi_tennis",
            }
        except Exception:
            return None

    def _headers(self) -> dict:
        return {
            "x-rapidapi-key": self._key,
            "x-rapidapi-host": _RAPIDAPI_HOST,
        }
