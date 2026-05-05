import asyncio
import json
from datetime import datetime, timezone, timedelta
import httpx
from agents.base import BaseAgent
from core.redis_client import consume
from config.settings import settings


class ResearchAgent(BaseAgent):
    """Generates AI match analysis via Ollama and stores on the dashboard (Neon)."""

    def __init__(self):
        super().__init__("ResearchAgent")
        # match_id → last research timestamp
        self._last_research: dict[str, datetime] = {}

    def _should_research(self, match_id: str, kickoff: datetime) -> bool:
        """Dynamic refresh rate based on time-to-kickoff."""
        now = datetime.now(timezone.utc)
        hours_until = (kickoff - now).total_seconds() / 3600

        # Match already played
        if hours_until < -2:
            return False

        last = self._last_research.get(match_id)
        if last is None:
            return True  # never researched

        age_hours = (now - last).total_seconds() / 3600

        if hours_until <= 2:
            return age_hours >= 5 / 60   # every 5 minutes in last 2h
        elif hours_until <= 24:
            return age_hours >= 1.0      # every hour on match day
        else:
            return age_hours >= 8.0      # 3x per day (every 8h)

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("model:probabilities", "research_group", "ResearchAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        match_id = data.get("match_id", "")
        if not match_id:
            return
        try:
            kickoff_str = data.get("kickoff", "")
            if not kickoff_str:
                return
            kickoff = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
            if not self._should_research(match_id, kickoff):
                return

            summary = await self._generate(data)
            if summary:
                await self._save(match_id, summary)
                self._researched.add(match_id)
                self.logger.info(
                    f"research done: {data.get('home_team')} vs {data.get('away_team')}"
                )
        except Exception as e:
            self.logger.error(f"research error {match_id}: {e}")

    async def _generate(self, data: dict) -> str:
        if not settings.OLLAMA_BASE_URL:
            return ""

        p_home = float(data.get("p_home", 0))
        p_draw = float(data.get("p_draw", 0))
        p_away = float(data.get("p_away", 0))

        try:
            odds_raw = data.get("odds", "{}")
            odds = json.loads(odds_raw) if isinstance(odds_raw, str) else odds_raw
        except Exception:
            odds = {}

        prompt = (
            f"Sei un analista sportivo professionista specializzato in value betting calcistico. "
            f"Analizza questa partita in modo conciso e pratico:\n\n"
            f"PARTITA: {data.get('home_team')} vs {data.get('away_team')} "
            f"({data.get('league', 'N/A')})\n"
            f"KICKOFF: {data.get('kickoff', 'N/A')}\n\n"
            f"PROBABILITÀ MODELLO (Dixon-Coles):\n"
            f"  Casa: {p_home:.1%}  Pareggio: {p_draw:.1%}  Trasferta: {p_away:.1%}\n\n"
            f"QUOTE MERCATO: {json.dumps(odds, ensure_ascii=False)}\n\n"
            f"Scrivi UN PARAGRAFO di massimo 3 frasi che analizza: "
            f"1) dove il modello vede valore rispetto al mercato, "
            f"2) il rischio principale da considerare. "
            f"Sii diretto e operativo, niente frasi generiche."
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "num_predict": 200,
                        },
                    },
                )
                resp.raise_for_status()
                return resp.json().get("response", "").strip()
        except Exception as e:
            self.logger.warning(f"ollama error: {e}")
            return ""

    async def _save(self, match_id: str, summary: str) -> None:
        if not settings.DASHBOARD_URL:
            self.logger.debug("DASHBOARD_URL not set — skipping research save")
            return
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {}
                if settings.RESEARCH_SECRET:
                    headers["Authorization"] = f"Bearer {settings.RESEARCH_SECRET}"
                await client.post(
                    f"{settings.DASHBOARD_URL}/api/research",
                    json={"match_id": match_id, "summary": summary},
                    headers=headers,
                )
        except Exception as e:
            self.logger.warning(f"save research error: {e}")
