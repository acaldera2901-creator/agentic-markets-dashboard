import asyncio
import json
from datetime import datetime, timezone, timedelta

import httpx

from agents.base import BaseAgent
from core.redis_client import get_redis
from config.settings import settings


class TennisResearchAgent(BaseAgent):
    """Generates AI match analysis for tennis via Ollama and stores in match_research DB."""

    def __init__(self):
        super().__init__("TennisResearchAgent")
        self._last_research: dict[str, datetime] = {}

    def _should_research(self, match_id: str) -> bool:
        last = self._last_research.get(match_id)
        if last is None:
            return True
        age_h = (datetime.now(timezone.utc) - last).total_seconds() / 3600
        return age_h >= 6.0  # refresh every 6h

    async def _main_loop(self) -> None:
        while self._running:
            await self._research_cycle()
            await asyncio.sleep(300)

    async def _research_cycle(self) -> None:
        r = await get_redis()
        raw = await r.get("model:tennis_probs")
        if not raw:
            return

        data = json.loads(raw)
        predictions = data.get("predictions", [])

        for pred in predictions:
            match_id = pred.get("match_id", "")
            if not match_id:
                continue
            if not self._should_research(match_id):
                continue
            try:
                summary = await self._generate(pred)
                if summary:
                    await self._save(match_id, summary)
                    self._last_research[match_id] = datetime.now(timezone.utc)
                    self.logger.info(
                        f"tennis research done: {pred.get('player1')} vs {pred.get('player2')}"
                    )
            except Exception as e:
                self.logger.error(f"tennis research error {match_id}: {e}")

    async def _generate(self, pred: dict) -> str:
        if not settings.OLLAMA_BASE_URL:
            return ""

        surface = pred.get("surface", "hard")
        surface_it = {"clay": "terra battuta", "grass": "erba", "hard": "cemento"}.get(
            surface.lower(), surface
        )
        p1 = float(pred.get("p1", 0.5))
        p2 = float(pred.get("p2", 0.5))
        odds_p1 = pred.get("odds_p1")
        odds_p2 = pred.get("odds_p2")
        edge = pred.get("edge")
        best = pred.get("best_selection")

        elo_p1 = pred.get("elo_p1")
        elo_p2 = pred.get("elo_p2")
        elo_p1_overall = pred.get("elo_p1_overall")
        elo_p2_overall = pred.get("elo_p2_overall")
        surf_m_p1 = pred.get("surface_matches_p1")
        surf_m_p2 = pred.get("surface_matches_p2")
        elo_raw_p1 = pred.get("elo_raw_p1")

        elo_section = ""
        if elo_p1 and elo_p2:
            delta = elo_p1 - elo_p2
            elo_section = (
                f"Elo {surface_it}: {pred['player1']} {elo_p1} · {pred['player2']} {elo_p2} "
                f"(Δ{abs(delta):.0f} pt)\n"
            )
        if elo_p1_overall and elo_p2_overall:
            elo_section += (
                f"Elo overall: {pred['player1']} {elo_p1_overall} · {pred['player2']} {elo_p2_overall}\n"
            )
        if surf_m_p1 is not None and surf_m_p2 is not None:
            elo_section += (
                f"Partite su {surface_it}: {pred['player1']} {surf_m_p1} · {pred['player2']} {surf_m_p2}\n"
            )
        if elo_raw_p1 is not None and abs(p1 - elo_raw_p1) > 0.003:
            elo_section += (
                f"Aggiustamento fatica: {pred['player1']} {elo_raw_p1:.0%} → {p1:.0%}\n"
            )

        mkt_p1 = f"{(1/odds_p1)*100:.0f}%" if odds_p1 and odds_p1 > 1 else "n/d"
        mkt_p2 = f"{(1/odds_p2)*100:.0f}%" if odds_p2 and odds_p2 > 1 else "n/d"
        best_name = pred.get("player1") if best == "P1" else pred.get("player2") if best == "P2" else "nessuno"

        prompt = (
            f"Sei un analista tennistico AI per una piattaforma di value betting professionale. "
            f"Analizza questa partita in modo preciso e conciso.\n\n"
            f"PARTITA: {pred.get('player1')} vs {pred.get('player2')}\n"
            f"TORNEO: {pred.get('tournament', 'N/A')} — Superficie: {surface_it.upper()}\n\n"
            f"DATI MODELLO:\n"
            f"{elo_section}"
            f"Probabilità modello: {pred['player1']} {p1:.0%} · {pred['player2']} {p2:.0%}\n"
            f"Probabilità implicita mercato: {pred['player1']} {mkt_p1} · {pred['player2']} {mkt_p2}\n"
            f"Edge modello: {f'+{edge:.1%}' if edge else 'nessuno'} su {best_name}\n\n"
            f"Scrivi UN PARAGRAFO di massimo 4 frasi che spiega: "
            f"1) perché il modello favorisce {best_name} su questa superficie, "
            f"2) cosa dicono le statistiche Elo, "
            f"3) il gap tra modello e mercato e se rappresenta valore reale. "
            f"Sii specifico ai dati, niente frasi generiche. Italiano, tono professionale."
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.3, "num_predict": 250},
                    },
                )
                resp.raise_for_status()
                return resp.json().get("response", "").strip()
        except Exception as e:
            self.logger.warning(f"ollama error: {e}")
            return ""

    async def _save(self, match_id: str, summary: str) -> None:
        if not settings.DASHBOARD_URL:
            self.logger.debug("DASHBOARD_URL not set — skipping tennis research save")
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
            self.logger.warning(f"save tennis research error: {e}")
