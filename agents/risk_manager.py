import asyncio
from datetime import datetime
from agents.base import BaseAgent
from core.redis_client import consume, publish
from core.telegram_client import send as tg_send, match_header
from context.competition_factors import apply_factors
from config.settings import settings

# Features used for data completeness scoring
EXPECTED_FEATURES = [
    "match_id", "league", "home_team", "away_team", "kickoff",
    "edge", "odds", "selection", "confidence", "p_home", "p_draw", "p_away",
]


def kelly_stake(
    edge: float,
    odds: float,
    bankroll: float,
    kelly_fraction: float = None,
    max_bet_pct: float = None,
) -> float:
    """
    Fractional Kelly sizing with absolute cap.
    stake = min(kelly_fraction × kelly_full, max_bet_pct × bankroll)
    """
    if edge <= 0:
        return 0.0
    kelly_fraction = kelly_fraction if kelly_fraction is not None else settings.KELLY_FRACTION
    max_bet_pct = max_bet_pct if max_bet_pct is not None else settings.MAX_BET_PCT
    kelly_full = edge / (odds - 1)
    fractional = kelly_full * kelly_fraction * bankroll
    cap = max_bet_pct * bankroll
    return min(fractional, cap)


def resolve_edge_threshold(data: dict) -> tuple[float, str]:
    """
    Returns (min_edge, market_efficiency_tier) based on odds source.
    Pinnacle / sharp lines → tighter edge requirement.
    """
    notes = str(data.get("notes", "")).lower()
    source = str(data.get("source", "")).lower()
    # Betfair Exchange e Pinnacle sono mercati sharp (liquidi, efficienti)
    sharp_keywords = ("pinnacle", "betfair", "exchange", "sharp")
    if any(k in notes or k in source for k in sharp_keywords):
        return settings.EDGE_MIN_SHARP, "sharp"
    return settings.EDGE_MIN_SOFT, "soft"


def data_completeness_score(data: dict) -> tuple[float, list[str]]:
    """Returns (score 0-1, list of missing fields)."""
    missing = [f for f in EXPECTED_FEATURES if not data.get(f)]
    score = (len(EXPECTED_FEATURES) - len(missing)) / len(EXPECTED_FEATURES)
    return round(score, 3), missing


def is_within_limits(current_exposure: float, new_stake: float, bankroll: float, max_exposure: float) -> bool:
    return (current_exposure + new_stake / bankroll) <= max_exposure


class RiskManagerAgent(BaseAgent):
    def __init__(self):
        super().__init__("RiskManagerAgent")
        self._current_exposure: float = 0.0
        self._monthly_pnl: float = 0.0

    async def _main_loop(self) -> None:
        while self._running:
            messages = await consume("strategy:approved", "risk_group", "RiskManagerAgent")
            for _, entries in messages:
                for _, data in entries:
                    await self._process(data)

    async def _process(self, data: dict) -> None:
        try:
            if self._monthly_pnl < -settings.MAX_MONTHLY_DRAWDOWN * settings.BANKROLL:
                self.logger.warning("monthly drawdown limit hit — blocking all new bets")
                await tg_send(
                    f"🚨 <b>SISTEMA BLOCCATO</b> — drawdown mensile\n"
                    f"{match_header(data)}\n"
                    f"📉 P&L mensile: {self._monthly_pnl:.2f}€  (limite: -{settings.MAX_MONTHLY_DRAWDOWN*100:.0f}%)"
                )
                return

            # Data completeness gate
            completeness, missing = data_completeness_score(data)
            if completeness < settings.MIN_DATA_COMPLETENESS:
                self.logger.warning(
                    f"data completeness {completeness:.0%} < {settings.MIN_DATA_COMPLETENESS:.0%} "
                    f"— missing: {missing} — skipping {data.get('home_team')} vs {data.get('away_team')}"
                )
                await self._log_dead_letter(data, missing, completeness)
                await tg_send(
                    f"⚪ <b>NESSUN BET</b> — dati incompleti\n"
                    f"{match_header(data)}\n"
                    f"📋 Completeness: {completeness:.0%}  (soglia: {settings.MIN_DATA_COMPLETENESS:.0%})\n"
                    f"❌ Campi mancanti: {', '.join(missing)}"
                )
                return

            ci_low = float(data.get("ci_low", 0))
            ci_high = float(data.get("ci_high", 1))
            ci_width = ci_high - ci_low
            # CI width check disabled: conformal intervals on binary football outcomes
            # are always [0,1] at 90% coverage — not a useful filter here

            edge = float(data["edge"])
            odds = float(data["odds"])

            # Adaptive edge threshold by market tier
            edge_threshold, tier = resolve_edge_threshold(data)
            if edge < edge_threshold:
                self.logger.info(
                    f"edge {edge:.3f} < {edge_threshold:.3f} ({tier}) — "
                    f"skipping {data.get('home_team')} vs {data.get('away_team')}"
                )
                return

            stake = kelly_stake(edge, odds, settings.BANKROLL)

            # Applica penalità competition type
            match_type = data.get("match_type", "STANDARD")
            confidence = float(data.get("confidence", 0.7))
            factors = apply_factors(stake, confidence, match_type)
            stake = factors["adjusted_stake"]
            match_type_penalty = factors["match_type_penalty"]

            # Auto-skip se sistema segnala sospensione CLV negativo
            auto_skip = data.get("auto_skip_reason", "")
            if auto_skip and data.get("suspend_recommended") in (True, "True"):
                self.logger.warning(f"AUTO-SKIP: {auto_skip}")
                await tg_send(
                    f"⏸ <b>AUTO-SKIP</b>\n"
                    f"{match_header(data)}\n"
                    f"📋 {auto_skip}"
                )
                return

            if stake < 1.0:
                self.logger.info(f"stake too small ({stake:.2f}), skipping")
                return

            if not is_within_limits(self._current_exposure, stake, settings.BANKROLL, settings.MAX_TOTAL_EXPOSURE):
                self.logger.warning(
                    f"exposure limit reached, skipping {data.get('home_team')} vs {data.get('away_team')}"
                )
                await tg_send(
                    f"⚪ <b>NESSUN BET</b> — exposure limit raggiunto\n"
                    f"{match_header(data)}\n"
                    f"🎯 {data.get('selection','?').upper()} @ {float(data.get('odds',0)):.2f}  "
                    f"edge +{float(data.get('edge',0))*100:.1f}%\n"
                    f"💰 Stake calcolato: {stake:.2f}€\n"
                    f"📊 Exposure attuale: {self._current_exposure*100:.1f}%  (max: {settings.MAX_TOTAL_EXPOSURE*100:.0f}%)"
                )
                return

            order = {
                **data,
                "stake": str(round(stake, 2)),
                "market_efficiency_tier": tier,
                "data_completeness": str(completeness),
                "ci_low": str(ci_low),
                "ci_high": str(ci_high),
                "sized_at": datetime.utcnow().isoformat(),
                "match_type": match_type,
                "match_type_penalty": str(match_type_penalty),
                "adjusted_stake": str(round(stake, 2)),
                "league_tier": data.get("league_tier", ""),
                "auto_skip_reason": data.get("auto_skip_reason", ""),
                "odds_anomaly": data.get("odds_anomaly", "False"),
            }
            self._current_exposure += stake / settings.BANKROLL
            await publish("risk:orders", order)
            mode = "PAPER" if settings.PAPER_TRADING else "LIVE"
            await tg_send(
                f"✅ <b>BET APPROVATO</b>  [{mode}]\n"
                f"{match_header(data)}\n"
                f"🎯 <b>{data.get('selection','?').upper()}</b> @ {float(data.get('odds',0)):.2f}\n"
                f"📈 Edge: +{float(data.get('edge',0))*100:.1f}%  |  "
                f"p_modello: {float(data.get('p_' + data.get('selection','home'), 0)):.0%}\n"
                f"💰 Stake: <b>{stake:.2f}€</b>  |  Tier: {tier}\n"
                f"📊 Exposure: {self._current_exposure*100:.1f}% / {settings.MAX_TOTAL_EXPOSURE*100:.0f}%"
            )
            self.logger.info(
                f"order: {data.get('home_team')} vs {data.get('away_team')} "
                f"stake={stake:.2f} tier={tier} edge={edge:.3f} "
                f"CI=[{ci_low:.2f},{ci_high:.2f}] completeness={completeness:.0%}"
            )
        except Exception as e:
            self.logger.error(f"risk manager error: {e}")

    async def _log_dead_letter(self, data: dict, missing: list, score: float) -> None:
        """Log incomplete predictions to dead letter queue for debugging."""
        try:
            from core.db import AsyncSessionLocal
            from sqlalchemy import text
            async with AsyncSessionLocal() as session:
                await session.execute(
                    text("""
                        CREATE TABLE IF NOT EXISTS dead_letter_predictions (
                            id SERIAL PRIMARY KEY,
                            match_id VARCHAR,
                            data JSONB,
                            missing_fields TEXT[],
                            completeness_score FLOAT,
                            logged_at TIMESTAMPTZ DEFAULT NOW()
                        )
                    """)
                )
                await session.execute(
                    text("""
                        INSERT INTO dead_letter_predictions (match_id, data, missing_fields, completeness_score)
                        VALUES (:match_id, :data::jsonb, :missing, :score)
                    """),
                    {
                        "match_id": data.get("match_id", ""),
                        "data": str(data),
                        "missing": missing,
                        "score": score,
                    }
                )
                await session.commit()
        except Exception as e:
            self.logger.debug(f"dead letter log failed: {e}")
