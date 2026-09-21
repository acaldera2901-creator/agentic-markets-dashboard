"""
S7 — Asian Handicap Collector.

Polls Pinnacle or SBOBet every 60s for AH lines/odds.
Stores results in Redis stream `ah:odds` AND in `ah_odds_history`.

#AH-PERSISTENZA-0917 — il «optionally to DB» di questo docstring e' stato per
mesi una promessa non mantenuta: nel file non c'era nessuna scrittura, e lo
stream `ah:odds` non ha mai avuto un consumatore — `ah:odds` compare solo nella
riga che lo pubblica. (Gli altri stream sono letti eccome: `consume()` ha sette
chiamanti fra analyst, model, research, risk_manager, strategist e trader.)
Quindi l'handicap di un book sharp veniva interrogato ogni 60 secondi e buttato
via. Ora si persiste — a cadenza propria, molto piu' lenta del loop, e solo cio'
che e' agganciabile a una partita.
"""
import asyncio
import json
import time as _time_mod
from datetime import datetime, timezone
import httpx
from agents.base import BaseAgent
from core.redis_client import publish
from core.ah_history import scrivi_storia_ah
from config.settings import settings


class AHCollectorAgent(BaseAgent):
    """Polls Asian Handicap odds from Pinnacle (preferred) or SBOBet."""

    POLL_INTERVAL = 60  # seconds

    # La persistenza NON segue il loop. A 60s si scriverebbero ~1.400 giri al
    # giorno per evento: per leggere un movimento di linea non serve, e una
    # tabella che non si riesce piu' a interrogare e' il difetto che
    # #PREZZI-STORIA-0911 aveva gia' pagato su odds_snapshots. A 900s restano
    # ~96 punti al giorno per partita, con risoluzione di 15 minuti vicino al
    # fischio: quattro volte meglio del cron a 2 ore dei prezzi partner.
    PERSIST_INTERVAL = 900.0
    _last_persist: float = 0.0

    def __init__(self):
        super().__init__("AHCollectorAgent")

    async def _main_loop(self) -> None:
        while self._running:
            try:
                records = await self._fetch_ah_odds()
                for rec in records:
                    await publish("ah:odds", rec)
                    self.logger.debug(
                        f"AH: {rec.get('home_team')} vs {rec.get('away_team')} "
                        f"line={rec.get('ah_line')} "
                        f"home={rec.get('ah_odds_home')} away={rec.get('ah_odds_away')}"
                    )
                if records:
                    self.logger.info(f"AH collector: published {len(records)} markets")
                await self._persisti(records)
            except Exception as e:
                self.logger.error(f"AH collector error: {e}")
            await asyncio.sleep(self.POLL_INTERVAL)

    async def _fetch_ah_odds(self) -> list[dict]:
        """Fetch AH odds from Pinnacle API or SBOBet. Returns list of AH records."""
        if settings.PINNACLE_API_KEY:
            return await self._fetch_pinnacle()
        if settings.SBOBET_API_KEY:
            return await self._fetch_sbobet()
        return await self._fetch_odds_api_ah()

    async def _fetch_pinnacle(self) -> list[dict]:
        """Fetch AH odds from Pinnacle Sports API."""
        results: list[dict] = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Pinnacle API: /v1/odds — sport 29 = Soccer, period 0 = Match, oddsFormat DECIMAL
                resp = await client.get(
                    "https://api.pinnacle.com/v1/odds",
                    headers={"Authorization": f"Basic {settings.PINNACLE_API_KEY}"},
                    params={"sportId": 29, "oddsFormat": "DECIMAL", "betGroup": "asian_handicap"},
                )
                if not resp.is_success:
                    self.logger.warning(f"Pinnacle AH returned {resp.status_code}")
                    return []
                data = resp.json()
                for event in data.get("leagues", []):
                    for game in event.get("events", []):
                        for period in game.get("periods", []):
                            if period.get("number") != 0:
                                continue
                            ah = period.get("asian_handicap", {})
                            if not ah:
                                continue
                            # `ah` E' la linea principale; `altLines` sono le
                            # alternative. Il vecchio `ah.get("altLines", [ah])`
                            # la scartava proprio quando le alternative c'erano:
                            # restituiva le alt e MAI la principale, cioe' l'unica
                            # che serve per misurare un movimento.
                            linee = [(ah, True)] + [
                                (a, False) for a in (ah.get("altLines") or [])
                            ]
                            for alt, principale in linee:
                                results.append({
                                    "match_id": str(game.get("id", "")),
                                    "home_team": game.get("home", ""),
                                    "away_team": game.get("away", ""),
                                    "league": event.get("name", ""),
                                    "commence_time": game.get("starts"),
                                    "is_main_line": principale,
                                    "ah_line": str(alt.get("hdp", 0)),
                                    "ah_odds_home": str(alt.get("home", 0)),
                                    "ah_odds_away": str(alt.get("away", 0)),
                                    "ah_opening_home": str(alt.get("homeOpeningOdds", alt.get("home", 0))),
                                    "ah_opening_away": str(alt.get("awayOpeningOdds", alt.get("away", 0))),
                                    "source": "pinnacle",
                                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                                })
        except Exception as e:
            self.logger.warning(f"Pinnacle fetch error: {e}")
        return results

    async def _fetch_sbobet(self) -> list[dict]:
        """Fetch AH odds from SBOBet API (placeholder — requires valid credentials)."""
        results: list[dict] = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://api.sbobet.com/odds/soccer/asian-handicap",
                    headers={"x-api-key": settings.SBOBET_API_KEY},
                )
                if not resp.is_success:
                    return []
                data = resp.json()
                for match in data.get("matches", []):
                    results.append({
                        "match_id": str(match.get("id", "")),
                        "home_team": match.get("homeTeam", ""),
                        "away_team": match.get("awayTeam", ""),
                        "league": match.get("league", ""),
                        "commence_time": match.get("startTime") or match.get("kickoff"),
                        "ah_line": str(match.get("handicap", 0)),
                        "ah_odds_home": str(match.get("homeOdds", 0)),
                        "ah_odds_away": str(match.get("awayOdds", 0)),
                        "ah_opening_home": str(match.get("openingHomeOdds", match.get("homeOdds", 0))),
                        "ah_opening_away": str(match.get("openingAwayOdds", match.get("awayOdds", 0))),
                        "source": "sbobet",
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    })
        except Exception as e:
            self.logger.warning(f"SBOBet fetch error: {e}")
        return results

    # The Odds API fallback cadence (#ODDS-1): the loop polls every 60s, but
    # paid credits must not — 5 leagues × 1 credit × 60s would burn ~7200/day.
    ODDS_API_AH_MIN_INTERVAL = 1800.0
    _last_odds_api_ah: float = 0.0

    async def _fetch_odds_api_ah(self) -> list[dict]:
        """Fallback: The Odds API spreads (= Asian Handicap) markets."""
        if not settings.ODDS_API_KEY:
            return []
        import time as _time
        now = _time.monotonic()
        if self._last_odds_api_ah and now - self._last_odds_api_ah < self.ODDS_API_AH_MIN_INTERVAL:
            return []
        self._last_odds_api_ah = now
        results: list[dict] = []
        sports = ["soccer_epl", "soccer_italy_serie_a", "soccer_spain_la_liga",
                  "soccer_germany_bundesliga", "soccer_france_ligue_one"]
        # Quota guard: skip out-of-season keys (free listing) — same pattern as
        # core/odds_api_client.get_odds.
        from core.odds_api_client import get_active_sport_keys
        active = await get_active_sport_keys()
        if active is not None:
            sports = [s for s in sports if s in active]
        if not sports:
            return []
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                for sport in sports:
                    resp = await client.get(
                        f"https://api.the-odds-api.com/v4/sports/{sport}/odds",
                        params={
                            "apiKey": settings.ODDS_API_KEY,
                            "markets": "spreads",  # The Odds API v4 key for AH/handicap (#ODDS-1: 'asian_handicap' does not exist -> always 0 results)
                            "oddsFormat": "decimal",
                            "regions": "eu",
                        },
                    )
                    if not resp.is_success:
                        continue
                    for event in resp.json():
                        # Track opening vs current (first bookmaker = opening proxy)
                        opening_home = opening_away = None
                        line = None
                        current_home = current_away = None
                        for bm in event.get("bookmakers", []):
                            for market in bm.get("markets", []):
                                if market.get("key") != "spreads":
                                    continue
                                outcomes = {o["name"]: o for o in market.get("outcomes", [])}
                                teams = list(outcomes.keys())
                                if len(teams) < 2:
                                    continue
                                home_out = outcomes.get(event.get("home_team", ""))
                                away_out = outcomes.get(event.get("away_team", ""))
                                if not home_out or not away_out:
                                    continue
                                if opening_home is None:
                                    opening_home = home_out.get("price")
                                    opening_away = away_out.get("price")
                                    line = home_out.get("point", 0)
                                current_home = home_out.get("price")
                                current_away = away_out.get("price")
                        if current_home and current_away:
                            results.append({
                                "match_id": event.get("id", ""),
                                "home_team": event.get("home_team", ""),
                                "away_team": event.get("away_team", ""),
                                "league": sport,
                                "commence_time": event.get("commence_time"),
                                "ah_line": str(line or 0),
                                "ah_odds_home": str(current_home),
                                "ah_odds_away": str(current_away),
                                "ah_opening_home": str(opening_home or current_home),
                                "ah_opening_away": str(opening_away or current_away),
                                "source": "odds_api_ah",
                                "fetched_at": datetime.now(timezone.utc).isoformat(),
                            })
                    await asyncio.sleep(0.5)  # rate limit
        except Exception as e:
            self.logger.warning(f"OddsAPI AH fetch error: {e}")
        return results


    async def _persisti(self, records: list[dict]) -> None:
        """Scrive la storia AH, al piu' una volta ogni PERSIST_INTERVAL.

        Fail-soft per contratto: qualunque cosa vada storta qui non deve fermare
        la raccolta, che e' il lavoro vero dell'agente.
        """
        # Un giro senza record non e' una scrittura: se marcasse comunque
        # l'orologio, brucerebbe la finestra dei 900s e il primo giro UTILE
        # dopo di esso aspetterebbe altri 15 minuti. (Riserva di Andrea
        # sull'APPROVE del 17/09.)
        if not records:
            return
        adesso = _time_mod.monotonic()
        if self._last_persist and adesso - self._last_persist < self.PERSIST_INTERVAL:
            return
        self._last_persist = adesso
        try:
            esito = await scrivi_storia_ah(records)
        except Exception as e:  # difensivo: scrivi_storia_ah gia' non alza
            self.logger.warning(f"AH persist error: {e}")
            return
        # Il conteggio si SCRIVE. Un collector che tace e' indistinguibile da uno
        # che non raccoglie niente: e' cosi' che questo agente e' rimasto muto
        # per mesi senza che nessuno se ne accorgesse.
        self.set_status_detail({"ah_storia": esito.compatto()})
        if esito.scritti or esito.falliti:
            self.logger.info(
                "AH storia: %d scritte, %d scartate, %d fallite",
                esito.scritti,
                esito.visti - esito.candidati,
                esito.falliti,
            )
