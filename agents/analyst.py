import asyncio
import json
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.claude_client import ask
from core.odds_api_client import implied_probability
from config.settings import settings

ANALYST_SYSTEM = """You are a quantitative football analyst for a prediction market trading desk.
You receive probability estimates from a Dixon-Coles model and current market odds.
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
            p_home = float(data["p_home"])
            p_draw = float(data["p_draw"])
            p_away = float(data["p_away"])
            odds_raw = json.loads(data.get("odds", "{}"))

            market_odds = self._extract_best_odds(odds_raw)
            if not market_odds:
                return

            edges = {
                "home": p_home - implied_probability(market_odds.get("home", 0)),
                "draw": p_draw - implied_probability(market_odds.get("draw", 0)),
                "away": p_away - implied_probability(market_odds.get("away", 0)),
            }
            best_sel = max(edges, key=edges.get)
            best_edge = edges[best_sel]

            if best_edge < settings.MIN_EDGE:
                return

            prompt = f"""Match: {data['home_team']} vs {data['away_team']} ({data['league']})
Kickoff: {data['kickoff']}
Model probabilities: home={p_home:.3f} draw={p_draw:.3f} away={p_away:.3f}
Best market odds: home={market_odds.get('home')} draw={market_odds.get('draw')} away={market_odds.get('away')}
Computed edge on '{best_sel}': {best_edge:.3f}

Assess this opportunity. Is the edge genuine or a data artifact?
Reply ONLY with JSON: {{"valid": true/false, "confidence": 0-1, "notes": "..."}}"""

            response = await ask(ANALYST_SYSTEM, prompt)
            assessment = json.loads(response)

            if not assessment.get("valid"):
                self.logger.info(f"skipped {data['home_team']} vs {data['away_team']}: {assessment.get('notes')}")
                return

            opportunity = {
                "match_id": data["match_id"],
                "league": data["league"],
                "home_team": data["home_team"],
                "away_team": data["away_team"],
                "kickoff": data["kickoff"],
                "selection": best_sel,
                "edge": str(best_edge),
                "odds": str(market_odds.get(best_sel, 0)),
                "confidence": str(assessment.get("confidence", 0)),
                "notes": assessment.get("notes", ""),
                "found_at": datetime.utcnow().isoformat(),
            }
            await publish("analyst:opportunities", opportunity)
            self.logger.info(f"opportunity: {data['home_team']} vs {data['away_team']} {best_sel} edge={best_edge:.3f}")
        except Exception as e:
            self.logger.error(f"analyst error: {e}")

    def _extract_best_odds(self, odds_raw: dict) -> dict | None:
        bookmakers = odds_raw.get("bookmakers", [])
        best: dict = {}
        for bm in bookmakers:
            for market in bm.get("markets", []):
                if market.get("key") != "h2h":
                    continue
                for outcome in market.get("outcomes", []):
                    name = outcome["name"].lower()
                    price = outcome["price"]
                    if "draw" in name:
                        sel = "draw"
                    elif name == odds_raw.get("home_team", "").lower():
                        sel = "home"
                    else:
                        sel = "away"
                    if sel not in best or price > best[sel]:
                        best[sel] = price
        return best if len(best) == 3 else None
