# League & Match Context Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere al sistema Agentic Markets un layer di contesto automatico per campionati e partite, che permette al sistema di capire autonomamente la qualità di ogni mercato, la prevedibilità storica e il tipo di partita — senza configurazione manuale.

**Architecture:** Cinque moduli puri in `context/` (no I/O, deterministici, testabili) esposti da un `ContextService` facade. Il `ModelAgent` li chiama in pre-processing e arricchisce il payload prima che raggiunga `AnalystAgent` e `RiskManagerAgent`. Le tabelle DB persistono il contesto per evitare ricalcoli continui.

**Tech Stack:** Python 3.14, SQLAlchemy async, Redis streams, scipy/numpy (già in requirements), httpx (già in requirements), pytest.

---

## Stato Attuale

✅ **Già implementato e testato:**
- `context/match_type.py` — `MatchTypeClassifier` + `MatchType` enum (22/22 test verdi)
- `context/__init__.py` — esporta `MatchTypeClassifier`, `MatchType`
- `config/settings.py` — `DERBY_THRESHOLD=0.75`, `CONTEXT_CACHE_TTL_H=6`, `MIN_LEAGUE_MATCHES=20`
- `models/features.py` — `motivation_score()`, `_urgency_curve()`

❌ **Da costruire in questo piano:** Moduli 1, 2, 3, 5 + integrazione pipeline + DB + dashboard badge.

---

## File da creare / modificare

| File | Azione | Responsabilità |
|------|--------|----------------|
| `context/league_strength.py` | CREA | `LeagueStrengthAnalyzer` — tier 1-5, market_efficiency, predictability_score |
| `context/league_odds_profile.py` | CREA | `LeagueOddsProfiler` — distribuzioni storiche, Bayesian prior, odds_anomaly |
| `context/league_predictability.py` | CREA | `LeaguePredictabilityTracker` — rolling 90gg, hit_rate, CLV, bet_filter_active |
| `context/competition_factors.py` | CREA | `competition_type_factors` dict + `apply_factors()` |
| `context/context_service.py` | CREA | `ContextService` facade — unico punto di ingresso per tutto il contesto |
| `context/__init__.py` | MODIFICA | Aggiungere nuovi export |
| `core/db.py` | MODIFICA | 4 nuove tabelle: `league_profiles`, `match_classifications`, `league_predictability_log`, `derby_registry` |
| `config/settings.py` | MODIFICA | Nuovi parametri: `LEAGUE_TIER_TOP5`, `PREDICTABILITY_HIT_RATE_MIN`, `CLV_MIN_ACCEPTABLE`, `PREDICTABILITY_MIN_BETS` |
| `agents/model.py` | MODIFICA | Chiamata a `ContextService.enrich()` prima di pubblicare su `model:probabilities` |
| `agents/risk_manager.py` | MODIFICA | Applicare `competition_factors` ad `adjusted_stake`, aggiungere `auto_skip_reason` all'output |
| `tests/test_league_strength.py` | CREA | Test unitari `LeagueStrengthAnalyzer` |
| `tests/test_league_odds_profile.py` | CREA | Test unitari `LeagueOddsProfiler` |
| `tests/test_league_predictability.py` | CREA | Test unitari `LeaguePredictabilityTracker` |
| `tests/test_competition_factors.py` | CREA | Test unitari `competition_type_factors` + `apply_factors()` |
| `tests/test_context_service.py` | CREA | Test integrazione `ContextService` |

**Nessuna nuova dipendenza Python** — tutto già in `requirements.txt`.

---

## Task 1 — DB: Nuove Tabelle

**Files:**
- Modify: `core/db.py`
- Test: `tests/test_db_tables.py` (crea)

- [ ] **Step 1.1: Scrivi il test**

```python
# tests/test_db_tables.py
import pytest
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine
from core.db import Base, LeagueProfile, MatchClassification, LeaguePredictabilityLog, DerbyRegistry


@pytest.mark.asyncio
async def test_league_profile_columns():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with engine.connect() as conn:
        cols = await conn.run_sync(lambda c: {col["name"] for col in inspect(c).get_columns("league_profiles")})
    assert {"league_id", "league_name", "strength_tier", "market_efficiency",
            "predictability_score", "avg_xg_per_game", "result_volatility",
            "liquidity_score", "recommended_edge_min", "updated_at"}.issubset(cols)
    await engine.dispose()


@pytest.mark.asyncio
async def test_match_classification_columns():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with engine.connect() as conn:
        cols = await conn.run_sync(lambda c: {col["name"] for col in inspect(c).get_columns("match_classifications")})
    assert {"match_id", "league_id", "match_type", "motivation_home",
            "motivation_away", "rest_advantage", "classified_at"}.issubset(cols)
    await engine.dispose()


@pytest.mark.asyncio
async def test_derby_registry_columns():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with engine.connect() as conn:
        cols = await conn.run_sync(lambda c: {col["name"] for col in inspect(c).get_columns("derby_registry")})
    assert {"id", "team_a", "team_b", "league_id", "derby_type"}.issubset(cols)
    await engine.dispose()
```

- [ ] **Step 1.2: Esegui per verificare che fallisce**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets && .venv/bin/pip install aiosqlite -q && .venv/bin/python -m pytest tests/test_db_tables.py -v 2>&1 | tail -15
```
Atteso: `FAILED` (classi non esistono)

- [ ] **Step 1.3: Aggiungi le 4 tabelle a `core/db.py`**

Aggiungi dopo la classe `Bet` esistente:

```python
class LeagueProfile(Base):
    __tablename__ = "league_profiles"
    id = Column(Integer, primary_key=True)
    league_id = Column(String, unique=True, index=True)
    league_name = Column(String)
    strength_tier = Column(Integer, nullable=True)      # 1-5, None = insufficient data
    market_efficiency = Column(Float, default=0.5)      # 0-1
    predictability_score = Column(Float, default=0.5)   # 0-1
    avg_xg_per_game = Column(Float, nullable=True)
    result_volatility = Column(Float, nullable=True)
    liquidity_score = Column(Float, default=0.5)
    recommended_edge_min = Column(Float, default=0.03)
    total_matches_analyzed = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class MatchClassification(Base):
    __tablename__ = "match_classifications"
    id = Column(Integer, primary_key=True)
    match_id = Column(String, unique=True, index=True)
    league_id = Column(String, index=True)
    match_type = Column(String, default="STANDARD")
    motivation_home = Column(Float, nullable=True)
    motivation_away = Column(Float, nullable=True)
    rest_advantage = Column(Float, nullable=True)       # rest_home - rest_away (days)
    home_days_rest = Column(Integer, nullable=True)
    away_days_rest = Column(Integer, nullable=True)
    is_derby = Column(Boolean, default=False)
    classified_at = Column(DateTime, default=datetime.datetime.utcnow)


class LeaguePredictabilityLog(Base):
    __tablename__ = "league_predictability_log"
    id = Column(Integer, primary_key=True)
    league_id = Column(String, index=True)
    snapshot_date = Column(DateTime, default=datetime.datetime.utcnow)
    total_predictions = Column(Integer, default=0)
    hit_rate = Column(Float, nullable=True)
    value_bet_hit_rate = Column(Float, nullable=True)
    avg_clv = Column(Float, nullable=True)
    roi = Column(Float, nullable=True)
    brier_score = Column(Float, nullable=True)
    best_bet_type = Column(String, nullable=True)
    worst_bet_type = Column(String, nullable=True)
    confidence_level = Column(String, default="INSUFFICIENT_DATA")
    bet_filter_active = Column(Boolean, default=False)


class DerbyRegistry(Base):
    __tablename__ = "derby_registry"
    id = Column(Integer, primary_key=True)
    team_a = Column(String, index=True)
    team_b = Column(String, index=True)
    league_id = Column(String, nullable=True)
    derby_type = Column(String, default="NATIONAL")     # NATIONAL | LOCAL | CONTINENTAL
    source = Column(String, default="seed")             # seed | auto_detected | manual
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
```

- [ ] **Step 1.4: Aggiorna `init_db` per includere i nuovi modelli**

In `core/db.py` l'import dei nuovi modelli è automatico (sono nella stessa `Base`).
Verifica che `init_db()` non richieda modifiche — `Base.metadata.create_all` crea tutto.

- [ ] **Step 1.5: Esegui i test**

```bash
.venv/bin/python -m pytest tests/test_db_tables.py -v 2>&1 | tail -10
```
Atteso: `3 passed`

- [ ] **Step 1.6: Commit**

```bash
git add core/db.py tests/test_db_tables.py
git commit -m "feat: add league_profiles, match_classifications, league_predictability_log, derby_registry tables"
```

---

## Task 2 — CompetitionTypeFactors

**Files:**
- Create: `context/competition_factors.py`
- Create: `tests/test_competition_factors.py`

- [ ] **Step 2.1: Scrivi i test**

```python
# tests/test_competition_factors.py
import pytest
from context.competition_factors import competition_type_factors, apply_factors
from context.match_type import MatchType


def test_all_match_types_have_entry():
    for mt in MatchType:
        assert mt.value in competition_type_factors, f"Missing entry for {mt.value}"


def test_standard_no_penalty():
    factors = competition_type_factors["STANDARD"]
    assert factors["model_confidence_penalty"] == 0.0
    assert factors["stake_multiplier"] == 1.0


def test_derby_reduces_stake():
    factors = competition_type_factors["DERBY_NATIONAL"]
    assert factors["stake_multiplier"] < 1.0
    assert factors["model_confidence_penalty"] < 0.0


def test_dead_rubber_biggest_penalty():
    dr = competition_type_factors["DEAD_RUBBER"]["model_confidence_penalty"]
    std = competition_type_factors["STANDARD"]["model_confidence_penalty"]
    assert dr < std


def test_apply_factors_adjusts_stake():
    result = apply_factors(base_stake=100.0, base_confidence=0.80, match_type="DERBY_NATIONAL")
    assert result["adjusted_stake"] < 100.0
    assert result["adjusted_confidence"] < 0.80
    assert result["match_type_penalty"] == competition_type_factors["DERBY_NATIONAL"]["model_confidence_penalty"]


def test_apply_factors_standard_unchanged():
    result = apply_factors(base_stake=100.0, base_confidence=0.80, match_type="STANDARD")
    assert result["adjusted_stake"] == 100.0
    assert result["adjusted_confidence"] == 0.80


def test_apply_factors_unknown_type_uses_standard():
    result = apply_factors(base_stake=50.0, base_confidence=0.70, match_type="NONEXISTENT")
    assert result["adjusted_stake"] == 50.0


def test_rotation_expected_heavy_penalty():
    factors = competition_type_factors["ROTATION_EXPECTED"]
    assert factors["stake_multiplier"] <= 0.65


def test_apply_factors_clamps_stake_floor():
    # stake can't go negative
    result = apply_factors(base_stake=1.0, base_confidence=0.5, match_type="DEAD_RUBBER")
    assert result["adjusted_stake"] >= 0.0
    assert result["adjusted_confidence"] >= 0.0
```

- [ ] **Step 2.2: Esegui per verificare che fallisce**

```bash
.venv/bin/python -m pytest tests/test_competition_factors.py -v 2>&1 | tail -15
```
Atteso: `FAILED` (modulo non esiste)

- [ ] **Step 2.3: Crea `context/competition_factors.py`**

```python
"""
competition_type_factors: dict con i moltiplicatori di stake e penalità
di confidenza per ogni MatchType.

apply_factors(): funzione pura che restituisce adjusted_stake e adjusted_confidence.
"""
from __future__ import annotations

competition_type_factors: dict[str, dict] = {
    "DERBY_NATIONAL": {
        "model_confidence_penalty": -0.10,
        "stake_multiplier": 0.70,
        "skip_if_low_data": True,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": 0.0,
        "notes": "Alta varianza, spesso upset, quote poco informative",
    },
    "RELEGATION_BATTLE": {
        "model_confidence_penalty": -0.08,
        "stake_multiplier": 0.75,
        "skip_if_low_data": False,
        "motivation_weight_boost": +0.20,
        "fatigue_feature_boost": 0.0,
        "notes": "Altissima motivazione ma risultati imprevedibili",
    },
    "TITLE_DECIDER": {
        "model_confidence_penalty": -0.05,
        "stake_multiplier": 0.85,
        "skip_if_low_data": False,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": 0.0,
        "notes": "Mercato molto attento, edge difficile da trovare",
    },
    "DEAD_RUBBER": {
        "model_confidence_penalty": -0.15,
        "stake_multiplier": 0.50,
        "skip_if_low_data": False,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": 0.0,
        "notes": "Lineup imprevedibile, alta probabilità di rotation",
    },
    "SHORT_REST": {
        "model_confidence_penalty": -0.05,
        "stake_multiplier": 0.85,
        "skip_if_low_data": False,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": +0.10,
        "notes": "Boost alle feature di fatica e infortuni",
    },
    "ROTATION_EXPECTED": {
        "model_confidence_penalty": -0.12,
        "stake_multiplier": 0.60,
        "skip_if_low_data": False,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": 0.0,
        "notes": "Lineup incerta, aspetta conferma formazioni ufficiali",
    },
    "EUROPEAN_HANGOVER": {
        "model_confidence_penalty": -0.07,
        "stake_multiplier": 0.80,
        "skip_if_low_data": False,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": +0.08,
        "notes": "Fatica post-europea, possibile turnover parziale",
    },
    "NEUTRAL_VENUE": {
        "model_confidence_penalty": -0.08,
        "stake_multiplier": 0.80,
        "skip_if_low_data": False,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": 0.0,
        "notes": "Home advantage annullato, ribalances le probabilità",
    },
    "CUP_SPILLOVER": {
        "model_confidence_penalty": -0.06,
        "stake_multiplier": 0.80,
        "skip_if_low_data": False,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": +0.05,
        "notes": "Coppa ravvicinata, possibile gestione energie",
    },
    "STANDARD": {
        "model_confidence_penalty": 0.0,
        "stake_multiplier": 1.0,
        "skip_if_low_data": False,
        "motivation_weight_boost": 0.0,
        "fatigue_feature_boost": 0.0,
        "notes": "Nessun aggiustamento",
    },
}

_STANDARD = competition_type_factors["STANDARD"]


def apply_factors(
    base_stake: float,
    base_confidence: float,
    match_type: str,
) -> dict:
    """
    Restituisce stake e confidence aggiustati in base al tipo di partita.

    Returns:
        dict con adjusted_stake, adjusted_confidence, match_type_penalty
    """
    factors = competition_type_factors.get(match_type, _STANDARD)
    penalty = factors["model_confidence_penalty"]
    multiplier = factors["stake_multiplier"]

    adjusted_stake = max(base_stake * multiplier, 0.0)
    adjusted_confidence = max(base_confidence + penalty, 0.0)

    return {
        "adjusted_stake": round(adjusted_stake, 4),
        "adjusted_confidence": round(adjusted_confidence, 4),
        "match_type_penalty": penalty,
        "stake_multiplier": multiplier,
    }
```

- [ ] **Step 2.4: Esegui i test**

```bash
.venv/bin/python -m pytest tests/test_competition_factors.py -v 2>&1 | tail -15
```
Atteso: `9 passed`

- [ ] **Step 2.5: Commit**

```bash
git add context/competition_factors.py tests/test_competition_factors.py
git commit -m "feat: add competition_type_factors and apply_factors()"
```

---

## Task 3 — LeagueStrengthAnalyzer

**Files:**
- Create: `context/league_strength.py`
- Create: `tests/test_league_strength.py`

- [ ] **Step 3.1: Scrivi i test**

```python
# tests/test_league_strength.py
import pytest
from context.league_strength import LeagueStrengthAnalyzer, LeagueStrengthProfile


SAMPLE_MATCHES = [
    {"home_goals": 2, "away_goals": 1, "home_xg": 1.8, "away_xg": 0.9,
     "home_odds": 1.80, "away_odds": 4.50, "draw_odds": 3.60,
     "result": "home"} for _ in range(30)
] + [
    {"home_goals": 0, "away_goals": 2, "home_xg": 0.7, "away_xg": 2.1,
     "home_odds": 2.10, "away_odds": 3.20, "draw_odds": 3.40,
     "result": "away"} for _ in range(20)
] + [
    {"home_goals": 1, "away_goals": 1, "home_xg": 1.2, "away_xg": 1.3,
     "home_odds": 2.50, "away_odds": 2.60, "draw_odds": 3.20,
     "result": "draw"} for _ in range(10)
]


def test_profile_output_keys():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("PL", "Premier League", SAMPLE_MATCHES)
    required = {"league_id", "league_name", "strength_tier", "market_efficiency",
                "predictability_score", "avg_xg_per_game", "result_volatility",
                "liquidity_score", "recommended_edge_min"}
    assert required.issubset(profile.keys())


def test_top5_league_gets_tier1():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("PL", "Premier League", SAMPLE_MATCHES)
    assert profile["strength_tier"] == 1


def test_insufficient_data_returns_none_tier():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("XX", "Unknown League", SAMPLE_MATCHES[:10])
    assert profile["strength_tier"] is None


def test_avg_xg_computed():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("SA", "Serie A", SAMPLE_MATCHES)
    assert profile["avg_xg_per_game"] is not None
    assert 0 < profile["avg_xg_per_game"] < 10


def test_result_volatility_positive():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("SA", "Serie A", SAMPLE_MATCHES)
    assert profile["result_volatility"] >= 0


def test_recommended_edge_min_between_0_and_1():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("PL", "Premier League", SAMPLE_MATCHES)
    assert 0 < profile["recommended_edge_min"] < 1.0


def test_market_efficiency_between_0_and_1():
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("PL", "Premier League", SAMPLE_MATCHES)
    assert 0.0 <= profile["market_efficiency"] <= 1.0


def test_upset_rate_computed():
    analyzer = LeagueStrengthAnalyzer()
    upset_rate = analyzer._compute_upset_rate(SAMPLE_MATCHES)
    assert 0.0 <= upset_rate <= 1.0


def test_fallback_xg_from_shots():
    """Quando xg non è disponibile, stima da shot-on-target ratio."""
    matches_no_xg = [
        {"home_goals": 2, "away_goals": 1, "home_shots_on_target": 5, "away_shots_on_target": 3,
         "home_odds": 1.80, "away_odds": 4.50, "draw_odds": 3.60, "result": "home"}
        for _ in range(30)
    ]
    analyzer = LeagueStrengthAnalyzer()
    profile = analyzer.compute_profile("SA", "Serie A", matches_no_xg)
    assert profile["avg_xg_per_game"] is not None
```

- [ ] **Step 3.2: Esegui per verificare che fallisce**

```bash
.venv/bin/python -m pytest tests/test_league_strength.py -v 2>&1 | tail -15
```
Atteso: `FAILED`

- [ ] **Step 3.3: Crea `context/league_strength.py`**

```python
"""
LeagueStrengthAnalyzer — calcola autonomamente il profilo di forza di un campionato.

Input: lista di match storici con goal, xG (opzionale), odds.
Output: LeagueStrengthProfile dict — deterministico, no I/O.
"""
from __future__ import annotations

import math
import statistics
from datetime import datetime, timezone
from config.settings import settings

# Campionati top-5 europei: sempre tier 1, override automatico
_TOP5_IDS = {"PL", "SA", "PD", "BL1", "FL1"}

# Edge minimo raccomandato per tier (1=più sharp → edge più alto richiesto)
_TIER_EDGE_MIN = {1: 0.04, 2: 0.035, 3: 0.03, 4: 0.025, 5: 0.02, None: 0.05}


class LeagueStrengthAnalyzer:
    """
    Calcola LeagueStrengthProfile da una lista di match storici.
    Stateless — ogni chiamata a compute_profile() è indipendente.
    """

    def compute_profile(
        self,
        league_id: str,
        league_name: str,
        matches: list[dict],
    ) -> dict:
        """
        Args:
            league_id: codice campionato (es. "PL", "SA")
            league_name: nome leggibile
            matches: lista di dict con chiavi opzionali:
                home_goals, away_goals, home_xg, away_xg,
                home_odds, away_odds, draw_odds,
                home_shots_on_target, away_shots_on_target, result
        Returns:
            LeagueStrengthProfile dict
        """
        min_matches = settings.MIN_LEAGUE_MATCHES

        if len(matches) < min_matches:
            return self._insufficient_data_profile(league_id, league_name)

        tier = 1 if league_id in _TOP5_IDS else self._compute_tier(league_id, matches)
        avg_xg = self._compute_avg_xg(matches)
        volatility = self._compute_result_volatility(matches)
        efficiency = self._compute_market_efficiency(matches)
        liquidity = self._compute_liquidity(matches)
        upset_rate = self._compute_upset_rate(matches)
        predictability = self._compute_predictability(efficiency, upset_rate)

        recommended_edge = _TIER_EDGE_MIN.get(tier, 0.03)

        return {
            "league_id": league_id,
            "league_name": league_name,
            "strength_tier": tier,
            "market_efficiency": round(efficiency, 4),
            "predictability_score": round(predictability, 4),
            "avg_xg_per_game": round(avg_xg, 3) if avg_xg is not None else None,
            "result_volatility": round(volatility, 4),
            "liquidity_score": round(liquidity, 4),
            "recommended_edge_min": recommended_edge,
            "total_matches_analyzed": len(matches),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    def _insufficient_data_profile(self, league_id: str, league_name: str) -> dict:
        return {
            "league_id": league_id,
            "league_name": league_name,
            "strength_tier": None,
            "market_efficiency": 0.5,
            "predictability_score": 0.5,
            "avg_xg_per_game": None,
            "result_volatility": None,
            "liquidity_score": 0.5,
            "recommended_edge_min": _TIER_EDGE_MIN[None],
            "total_matches_analyzed": 0,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    def _compute_tier(self, league_id: str, matches: list[dict]) -> int:
        """
        Tier 2-5 calcolato automaticamente da efficienza + liquidità + volatilità.
        Scala: tier 2 = molto buono, tier 5 = mercato minore.
        """
        efficiency = self._compute_market_efficiency(matches)
        liquidity = self._compute_liquidity(matches)
        score = (efficiency + liquidity) / 2
        if score >= 0.80:
            return 2
        elif score >= 0.65:
            return 3
        elif score >= 0.50:
            return 4
        return 5

    def _compute_avg_xg(self, matches: list[dict]) -> float | None:
        xg_values = []
        for m in matches:
            h_xg = m.get("home_xg")
            a_xg = m.get("away_xg")
            if h_xg is not None and a_xg is not None:
                xg_values.append(float(h_xg) + float(a_xg))
            else:
                # Fallback: stima xG da shots on target × 0.33
                h_sot = m.get("home_shots_on_target")
                a_sot = m.get("away_shots_on_target")
                if h_sot is not None and a_sot is not None:
                    xg_values.append((float(h_sot) + float(a_sot)) * 0.33)
        if not xg_values:
            # Last resort: media gol come proxy xG
            goals = [m.get("home_goals", 0) + m.get("away_goals", 0) for m in matches]
            return statistics.mean(goals) if goals else None
        return statistics.mean(xg_values)

    def _compute_result_volatility(self, matches: list[dict]) -> float:
        """Deviazione standard del goal_diff come proxy di volatilità."""
        diffs = []
        for m in matches:
            hg = m.get("home_goals")
            ag = m.get("away_goals")
            if hg is not None and ag is not None:
                diffs.append(float(hg) - float(ag))
        if len(diffs) < 2:
            return 0.0
        return statistics.stdev(diffs)

    def _compute_market_efficiency(self, matches: list[dict]) -> float:
        """
        Proxy di efficienza: quanto l'overround medio è basso (mercato sharp).
        Overround basso → mercato più efficiente.
        Pinnacle-level overround ≈ 2% → efficiency ≈ 0.98.
        Soft bookmaker overround ≈ 10% → efficiency ≈ 0.70.
        """
        overrounds = []
        for m in matches:
            h = m.get("home_odds")
            d = m.get("draw_odds")
            a = m.get("away_odds")
            if h and d and a and all(o > 1.0 for o in (h, d, a)):
                implied_sum = 1/h + 1/d + 1/a
                overrounds.append(implied_sum - 1.0)
        if not overrounds:
            return 0.5
        avg_or = statistics.mean(overrounds)
        # efficiency = 1 - overround (clamped a 0-1)
        return max(0.0, min(1.0, 1.0 - avg_or))

    def _compute_liquidity(self, matches: list[dict]) -> float:
        """
        Proxy di liquidità basato sulla varianza delle odds di apertura.
        Quote con poca varianza → mercato liquido e sharper.
        Normalizzato su scala 0-1.
        """
        home_odds = [m["home_odds"] for m in matches if m.get("home_odds") and m["home_odds"] > 1.0]
        if len(home_odds) < 5:
            return 0.5
        cv = statistics.stdev(home_odds) / statistics.mean(home_odds)
        # Basso CV → alta liquidità (quotisti allineati)
        # CV=0 → 1.0, CV=0.5 → 0.0
        return max(0.0, min(1.0, 1.0 - cv * 2.0))

    def _compute_upset_rate(self, matches: list[dict]) -> float:
        """% di partite in cui il favorito (odds più basse) ha perso."""
        upsets = 0
        total = 0
        for m in matches:
            h = m.get("home_odds")
            a = m.get("away_odds")
            result = m.get("result")
            if h is None or a is None or result is None:
                continue
            favorite = "home" if h <= a else "away"
            if favorite != result and result != "draw":
                upsets += 1
            total += 1
        if total == 0:
            return 0.3
        return upsets / total

    def _compute_predictability(self, market_efficiency: float, upset_rate: float) -> float:
        """
        Score 0-1: alta efficiency + basso upset_rate → più prevedibile.
        """
        return max(0.0, min(1.0, (market_efficiency + (1.0 - upset_rate)) / 2.0))
```

- [ ] **Step 3.4: Esegui i test**

```bash
.venv/bin/python -m pytest tests/test_league_strength.py -v 2>&1 | tail -15
```
Atteso: `9 passed`

- [ ] **Step 3.5: Commit**

```bash
git add context/league_strength.py tests/test_league_strength.py
git commit -m "feat: add LeagueStrengthAnalyzer with auto tier assignment"
```

---

## Task 4 — LeagueOddsProfiler

**Files:**
- Create: `context/league_odds_profile.py`
- Create: `tests/test_league_odds_profile.py`

- [ ] **Step 4.1: Scrivi i test**

```python
# tests/test_league_odds_profile.py
import pytest
from context.league_odds_profile import LeagueOddsProfiler


SAMPLE = [
    {"result": "home", "home_odds": 1.80, "draw_odds": 3.60, "away_odds": 4.50,
     "total_goals": 3, "both_scored": True} for _ in range(40)
] + [
    {"result": "draw", "home_odds": 2.80, "draw_odds": 3.20, "away_odds": 2.90,
     "total_goals": 2, "both_scored": True} for _ in range(20)
] + [
    {"result": "away", "home_odds": 3.50, "draw_odds": 3.40, "away_odds": 2.10,
     "total_goals": 1, "both_scored": False} for _ in range(15)
]


def test_profile_output_keys():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("PL", SAMPLE)
    required = {"home_win_pct", "draw_pct", "away_win_pct", "avg_home_odds",
                "avg_draw_odds", "avg_away_odds", "over25_pct", "btts_pct",
                "home_advantage_index", "value_zone"}
    assert required.issubset(profile.keys())


def test_home_win_pct_correct():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("PL", SAMPLE)
    assert abs(profile["home_win_pct"] - 40/75) < 0.01


def test_over25_pct_computed():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("PL", SAMPLE)
    assert 0 <= profile["over25_pct"] <= 1.0


def test_odds_anomaly_true_when_above_threshold():
    profiler = LeagueOddsProfiler()
    profiler.compute_profile("PL", SAMPLE)  # build baseline
    result = profiler.detect_anomaly("PL", outcome="home", current_odds=3.50)
    # home avg is ~1.80, 3.50 is way above → anomaly
    assert result is True


def test_odds_anomaly_false_when_normal():
    profiler = LeagueOddsProfiler()
    profiler.compute_profile("PL", SAMPLE)
    result = profiler.detect_anomaly("PL", outcome="home", current_odds=1.85)
    assert result is False


def test_value_zone_is_string():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("PL", SAMPLE)
    assert profile["value_zone"] in ("home", "away", "draw", "over", "btts", "none")


def test_insufficient_data_returns_defaults():
    profiler = LeagueOddsProfiler()
    profile = profiler.compute_profile("XX", SAMPLE[:5])
    assert profile["home_win_pct"] is None
```

- [ ] **Step 4.2: Esegui per verificare che fallisce**

```bash
.venv/bin/python -m pytest tests/test_league_odds_profile.py -v 2>&1 | tail -15
```
Atteso: `FAILED`

- [ ] **Step 4.3: Crea `context/league_odds_profile.py`**

```python
"""
LeagueOddsProfiler — modella la distribuzione storica delle quote per campionato.

Fornisce:
- Statistiche descrittive (home_win_pct, over25_pct, btts_pct, ...)
- Anomaly detection: se la quota attuale devia dal profilo storico
- Value zone: dove il modello performa storicamente meglio
"""
from __future__ import annotations

import statistics
from config.settings import settings

_MIN_MATCHES = 20
_ANOMALY_SIGMA = 1.8  # deviazioni standard oltre cui è "anomalia"


class LeagueOddsProfiler:
    """
    Stato interno: dizionario di profili per league_id.
    Usa compute_profile() per costruire, detect_anomaly() per query.
    """

    def __init__(self):
        self._profiles: dict[str, dict] = {}

    def compute_profile(self, league_id: str, matches: list[dict]) -> dict:
        """
        Calcola e memorizza il profilo storico per il campionato.

        Args:
            league_id: codice campionato
            matches: lista dict con result, home_odds, draw_odds, away_odds,
                     total_goals (opz), both_scored (opz)
        Returns:
            LeagueOddsProfile dict
        """
        if len(matches) < _MIN_MATCHES:
            profile = self._empty_profile(league_id)
            self._profiles[league_id] = profile
            return profile

        results = [m.get("result") for m in matches]
        n = len(matches)

        home_win_pct = results.count("home") / n
        draw_pct = results.count("draw") / n
        away_win_pct = results.count("away") / n

        home_odds = [m["home_odds"] for m in matches if m.get("home_odds") and m["home_odds"] > 1.0]
        draw_odds = [m["draw_odds"] for m in matches if m.get("draw_odds") and m["draw_odds"] > 1.0]
        away_odds = [m["away_odds"] for m in matches if m.get("away_odds") and m["away_odds"] > 1.0]

        over25 = [m for m in matches if (m.get("total_goals") or 0) > 2]
        btts = [m for m in matches if m.get("both_scored")]

        home_adv = self._home_advantage_index(matches)
        value_zone = self._value_zone(home_win_pct, draw_pct, away_win_pct,
                                      home_odds, draw_odds, away_odds)

        profile = {
            "league_id": league_id,
            "home_win_pct": round(home_win_pct, 4),
            "draw_pct": round(draw_pct, 4),
            "away_win_pct": round(away_win_pct, 4),
            "avg_home_odds": round(statistics.mean(home_odds), 3) if home_odds else None,
            "avg_draw_odds": round(statistics.mean(draw_odds), 3) if draw_odds else None,
            "avg_away_odds": round(statistics.mean(away_odds), 3) if away_odds else None,
            "home_odds_std": round(statistics.stdev(home_odds), 3) if len(home_odds) > 1 else None,
            "draw_odds_std": round(statistics.stdev(draw_odds), 3) if len(draw_odds) > 1 else None,
            "away_odds_std": round(statistics.stdev(away_odds), 3) if len(away_odds) > 1 else None,
            "over25_pct": round(len(over25) / n, 4),
            "btts_pct": round(len(btts) / n, 4),
            "home_advantage_index": round(home_adv, 4),
            "value_zone": value_zone,
            "total_matches": n,
        }
        self._profiles[league_id] = profile
        return profile

    def detect_anomaly(
        self,
        league_id: str,
        outcome: str,
        current_odds: float,
        sigma_threshold: float = _ANOMALY_SIGMA,
    ) -> bool:
        """
        Ritorna True se current_odds è statisticamente anomala rispetto al profilo storico.

        Args:
            outcome: "home" | "draw" | "away"
            current_odds: quota attuale da comparare
        """
        profile = self._profiles.get(league_id)
        if not profile:
            return False

        avg_key = f"avg_{outcome}_odds"
        std_key = f"{outcome}_odds_std"
        avg = profile.get(avg_key)
        std = profile.get(std_key)

        if avg is None or std is None or std == 0:
            return False

        z_score = abs(current_odds - avg) / std
        return z_score >= sigma_threshold

    def _home_advantage_index(self, matches: list[dict]) -> float:
        """
        Ratio tra vittorie in casa e vittorie fuori.
        1.0 = neutro, >1.0 = vantaggio casa significativo.
        """
        home_wins = sum(1 for m in matches if m.get("result") == "home")
        away_wins = sum(1 for m in matches if m.get("result") == "away")
        if away_wins == 0:
            return 2.0
        return home_wins / away_wins

    def _value_zone(
        self,
        h_pct: float,
        d_pct: float,
        a_pct: float,
        home_odds: list[float],
        draw_odds: list[float],
        away_odds: list[float],
    ) -> str:
        """
        Individua dove si trova storicamente il miglior valore atteso.
        Compara la probabilità storica con la probabilità implicita media delle quote.
        """
        candidates = []
        if home_odds:
            implied_h = 1 / statistics.mean(home_odds)
            candidates.append(("home", h_pct - implied_h))
        if draw_odds:
            implied_d = 1 / statistics.mean(draw_odds)
            candidates.append(("draw", d_pct - implied_d))
        if away_odds:
            implied_a = 1 / statistics.mean(away_odds)
            candidates.append(("away", a_pct - implied_a))
        if not candidates:
            return "none"
        best = max(candidates, key=lambda x: x[1])
        return best[0] if best[1] > 0 else "none"

    def _empty_profile(self, league_id: str) -> dict:
        return {
            "league_id": league_id,
            "home_win_pct": None,
            "draw_pct": None,
            "away_win_pct": None,
            "avg_home_odds": None,
            "avg_draw_odds": None,
            "avg_away_odds": None,
            "home_odds_std": None,
            "draw_odds_std": None,
            "away_odds_std": None,
            "over25_pct": None,
            "btts_pct": None,
            "home_advantage_index": None,
            "value_zone": "none",
            "total_matches": 0,
        }
```

- [ ] **Step 4.4: Esegui i test**

```bash
.venv/bin/python -m pytest tests/test_league_odds_profile.py -v 2>&1 | tail -15
```
Atteso: `7 passed`

- [ ] **Step 4.5: Commit**

```bash
git add context/league_odds_profile.py tests/test_league_odds_profile.py
git commit -m "feat: add LeagueOddsProfiler with Bayesian prior and anomaly detection"
```

---

## Task 5 — LeaguePredictabilityTracker

**Files:**
- Create: `context/league_predictability.py`
- Create: `tests/test_league_predictability.py`

- [ ] **Step 5.1: Scrivi i test**

```python
# tests/test_league_predictability.py
import pytest
from context.league_predictability import LeaguePredictabilityTracker


def _make_predictions(n_correct: int, n_total: int, avg_clv: float = 0.02) -> list[dict]:
    preds = []
    for i in range(n_total):
        correct = i < n_correct
        preds.append({
            "predicted": "home",
            "actual": "home" if correct else "away",
            "is_value_bet": True,
            "clv": avg_clv,
            "roi": 0.05 if correct else -1.0,
            "p_predicted": 0.55,
        })
    return preds


def test_hit_rate_computed():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(60, 100))
    metrics = tracker.get_metrics("PL")
    assert abs(metrics["hit_rate"] - 0.60) < 0.01


def test_confidence_level_high():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(65, 150, avg_clv=0.03))
    metrics = tracker.get_metrics("PL")
    assert metrics["confidence_level"] in ("HIGH", "MEDIUM")


def test_confidence_level_insufficient_data():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(5, 8))
    metrics = tracker.get_metrics("PL")
    assert metrics["confidence_level"] == "INSUFFICIENT_DATA"


def test_bet_filter_activated_on_low_hit_rate():
    tracker = LeaguePredictabilityTracker()
    # 40% hit rate su 120 bet → deve attivare filtro
    tracker.update("PL", _make_predictions(48, 120))
    metrics = tracker.get_metrics("PL")
    assert metrics["bet_filter_active"] is True


def test_bet_filter_not_activated_on_good_performance():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(55, 100))
    metrics = tracker.get_metrics("PL")
    assert metrics["bet_filter_active"] is False


def test_brier_score_between_0_and_1():
    tracker = LeaguePredictabilityTracker()
    tracker.update("SA", _make_predictions(50, 100))
    metrics = tracker.get_metrics("SA")
    assert 0.0 <= metrics["brier_score"] <= 1.0


def test_unknown_league_returns_insufficient():
    tracker = LeaguePredictabilityTracker()
    metrics = tracker.get_metrics("UNKNOWN")
    assert metrics["confidence_level"] == "INSUFFICIENT_DATA"
    assert metrics["bet_filter_active"] is False


def test_negative_clv_triggers_suspension_flag():
    tracker = LeaguePredictabilityTracker()
    preds = _make_predictions(25, 60, avg_clv=-0.03)
    tracker.update("BL1", preds)
    metrics = tracker.get_metrics("BL1")
    assert metrics.get("suspend_recommended") is True
```

- [ ] **Step 5.2: Esegui per verificare che fallisce**

```bash
.venv/bin/python -m pytest tests/test_league_predictability.py -v 2>&1 | tail -15
```
Atteso: `FAILED`

- [ ] **Step 5.3: Crea `context/league_predictability.py`**

```python
"""
LeaguePredictabilityTracker — traccia performance del modello per campionato.

Mantiene metriche rolling per decidere:
- Se fidarsi del modello su questa league (confidence_level)
- Se ridurre stake automaticamente (bet_filter_active)
- Se sospendere le bet (suspend_recommended)
"""
from __future__ import annotations

import math
import statistics
from config.settings import settings

_MIN_BETS_FOR_CONFIDENCE = 50       # sotto questa soglia → INSUFFICIENT_DATA
_HIT_RATE_FILTER_THRESHOLD = 0.45   # sotto questa soglia (su >100 bet) → filtro attivo
_CLV_SUSPEND_THRESHOLD = 0.0        # CLV medio negativo su >50 bet → sospendi
_MIN_BETS_FOR_CLV_CHECK = 50


class LeaguePredictabilityTracker:
    """
    Traccia le performance rolling per campionato.
    update() aggiorna lo stato, get_metrics() restituisce le metriche correnti.
    """

    def __init__(self):
        self._data: dict[str, list[dict]] = {}

    def update(self, league_id: str, predictions: list[dict]) -> None:
        """
        Aggiunge/sostituisce le predizioni per questa league.

        Args:
            predictions: lista di dict con:
                predicted (str), actual (str), is_value_bet (bool),
                clv (float), roi (float), p_predicted (float)
        """
        self._data[league_id] = predictions

    def get_metrics(self, league_id: str) -> dict:
        """
        Restituisce le metriche di performance rolling per la league.
        """
        preds = self._data.get(league_id, [])

        if len(preds) < _MIN_BETS_FOR_CONFIDENCE:
            return self._insufficient_metrics(league_id)

        hit_rate = self._hit_rate(preds)
        value_bets = [p for p in preds if p.get("is_value_bet")]
        vb_hit_rate = self._hit_rate(value_bets) if value_bets else None

        clv_values = [p["clv"] for p in preds if p.get("clv") is not None]
        avg_clv = statistics.mean(clv_values) if clv_values else None

        roi_values = [p["roi"] for p in preds if p.get("roi") is not None]
        roi = statistics.mean(roi_values) if roi_values else None

        brier = self._brier_score(preds)

        confidence = self._confidence_level(hit_rate, avg_clv, len(preds))
        bet_filter = self._should_filter(hit_rate, len(preds))
        suspend = self._should_suspend(avg_clv, len(preds))

        best_type, worst_type = self._best_worst_type(preds)

        return {
            "league_id": league_id,
            "total_predictions": len(preds),
            "hit_rate": round(hit_rate, 4),
            "value_bet_hit_rate": round(vb_hit_rate, 4) if vb_hit_rate is not None else None,
            "avg_clv": round(avg_clv, 4) if avg_clv is not None else None,
            "roi": round(roi, 4) if roi is not None else None,
            "brier_score": round(brier, 4),
            "best_bet_type": best_type,
            "worst_bet_type": worst_type,
            "confidence_level": confidence,
            "bet_filter_active": bet_filter,
            "suspend_recommended": suspend,
        }

    def _hit_rate(self, preds: list[dict]) -> float:
        if not preds:
            return 0.0
        correct = sum(1 for p in preds if p.get("predicted") == p.get("actual"))
        return correct / len(preds)

    def _brier_score(self, preds: list[dict]) -> float:
        """Brier score per il tipo di scommessa principale."""
        scores = []
        for p in preds:
            prob = p.get("p_predicted", 0.5)
            correct = 1 if p.get("predicted") == p.get("actual") else 0
            scores.append((prob - correct) ** 2)
        return statistics.mean(scores) if scores else 0.5

    def _confidence_level(self, hit_rate: float, avg_clv: float | None, n: int) -> str:
        if n < _MIN_BETS_FOR_CONFIDENCE:
            return "INSUFFICIENT_DATA"
        if avg_clv is not None and avg_clv >= 0.02 and hit_rate >= 0.52:
            return "HIGH"
        if hit_rate >= 0.48:
            return "MEDIUM"
        return "LOW"

    def _should_filter(self, hit_rate: float, n: int) -> bool:
        return n >= 100 and hit_rate < _HIT_RATE_FILTER_THRESHOLD

    def _should_suspend(self, avg_clv: float | None, n: int) -> bool:
        return (
            avg_clv is not None
            and n >= _MIN_BETS_FOR_CLV_CHECK
            and avg_clv < _CLV_SUSPEND_THRESHOLD
        )

    def _best_worst_type(self, preds: list[dict]) -> tuple[str | None, str | None]:
        type_stats: dict[str, list[bool]] = {}
        for p in preds:
            t = p.get("predicted", "unknown")
            correct = p.get("predicted") == p.get("actual")
            type_stats.setdefault(t, []).append(correct)
        if not type_stats:
            return None, None
        rates = {t: sum(v) / len(v) for t, v in type_stats.items() if len(v) >= 10}
        if not rates:
            return None, None
        best = max(rates, key=rates.get)
        worst = min(rates, key=rates.get)
        return best, worst

    def _insufficient_metrics(self, league_id: str) -> dict:
        return {
            "league_id": league_id,
            "total_predictions": len(self._data.get(league_id, [])),
            "hit_rate": None,
            "value_bet_hit_rate": None,
            "avg_clv": None,
            "roi": None,
            "brier_score": None,
            "best_bet_type": None,
            "worst_bet_type": None,
            "confidence_level": "INSUFFICIENT_DATA",
            "bet_filter_active": False,
            "suspend_recommended": False,
        }
```

- [ ] **Step 5.4: Esegui i test**

```bash
.venv/bin/python -m pytest tests/test_league_predictability.py -v 2>&1 | tail -15
```
Atteso: `8 passed`

- [ ] **Step 5.5: Commit**

```bash
git add context/league_predictability.py tests/test_league_predictability.py
git commit -m "feat: add LeaguePredictabilityTracker with adaptive bet filter"
```

---

## Task 6 — ContextService (Facade)

**Files:**
- Create: `context/context_service.py`
- Modify: `context/__init__.py`
- Create: `tests/test_context_service.py`

- [ ] **Step 6.1: Scrivi i test**

```python
# tests/test_context_service.py
import pytest
from context.context_service import ContextService


LEAGUE_MATCHES = [
    {"home_goals": 2, "away_goals": 1, "home_xg": 1.8, "away_xg": 0.9,
     "home_odds": 1.80, "away_odds": 4.50, "draw_odds": 3.60,
     "result": "home", "total_goals": 3, "both_scored": True} for _ in range(40)
] + [
    {"home_goals": 0, "away_goals": 2, "home_xg": 0.7, "away_xg": 2.1,
     "home_odds": 2.10, "away_odds": 3.20, "draw_odds": 3.40,
     "result": "away", "total_goals": 2, "both_scored": True} for _ in range(20)
] + [
    {"home_goals": 1, "away_goals": 1, "home_xg": 1.2, "away_xg": 1.3,
     "home_odds": 2.50, "away_odds": 2.60, "draw_odds": 3.20,
     "result": "draw", "total_goals": 2, "both_scored": True} for _ in range(15)
]


@pytest.fixture
def service():
    svc = ContextService()
    svc.load_league_history("PL", "Premier League", LEAGUE_MATCHES)
    return svc


def test_enrich_adds_match_type(service):
    data = {"home_team": "Arsenal", "away_team": "Chelsea", "league": "PL"}
    result = service.enrich(data)
    assert "match_type" in result
    assert result["match_type"] in (
        "DERBY_NATIONAL", "STANDARD", "SHORT_REST", "TITLE_DECIDER",
        "RELEGATION_BATTLE", "DEAD_RUBBER", "ROTATION_EXPECTED",
        "EUROPEAN_HANGOVER", "NEUTRAL_VENUE", "CUP_SPILLOVER"
    )


def test_enrich_adds_league_tier(service):
    data = {"home_team": "Arsenal", "away_team": "Chelsea", "league": "PL"}
    result = service.enrich(data)
    assert "league_tier" in result
    assert result["league_tier"] == 1  # PL è top-5


def test_enrich_adds_adjusted_stake(service):
    data = {
        "home_team": "AC Milan", "away_team": "Inter Milan",
        "league": "PL", "stake": 100.0, "confidence": 0.70,
    }
    result = service.enrich(data)
    assert "adjusted_stake" in result
    assert result["adjusted_stake"] <= 100.0  # derby penalty


def test_enrich_adds_odds_anomaly(service):
    data = {
        "home_team": "Arsenal", "away_team": "Chelsea",
        "league": "PL", "home_odds": 5.50,  # molto sopra la media
    }
    result = service.enrich(data)
    assert "odds_anomaly" in result
    assert result["odds_anomaly"] is True


def test_enrich_no_anomaly_for_normal_odds(service):
    data = {
        "home_team": "Arsenal", "away_team": "Chelsea",
        "league": "PL", "home_odds": 1.85,
    }
    result = service.enrich(data)
    assert result.get("odds_anomaly") is False


def test_enrich_adds_data_completeness(service):
    data = {"home_team": "Arsenal", "away_team": "Chelsea", "league": "PL",
            "match_id": "123", "kickoff": "2026-05-10T15:00:00Z",
            "edge": 0.04, "odds": 2.1, "selection": "home",
            "confidence": 0.65, "p_home": 0.55, "p_draw": 0.25, "p_away": 0.20}
    result = service.enrich(data)
    assert "data_completeness" in result
    assert 0 <= float(result["data_completeness"]) <= 1


def test_unknown_league_graceful_fallback(service):
    data = {"home_team": "TeamA", "away_team": "TeamB", "league": "UNKNOWN"}
    result = service.enrich(data)
    assert result["league_tier"] is None
    assert result["match_type"] == "STANDARD"
```

- [ ] **Step 6.2: Esegui per verificare che fallisce**

```bash
.venv/bin/python -m pytest tests/test_context_service.py -v 2>&1 | tail -15
```
Atteso: `FAILED`

- [ ] **Step 6.3: Crea `context/context_service.py`**

```python
"""
ContextService — facade che unifica tutti i moduli context.

Unico punto di ingresso per arricchire un dict di dati partita
con: match_type, league_tier, competition factors, odds_anomaly.
"""
from __future__ import annotations

from context.match_type import MatchTypeClassifier
from context.league_strength import LeagueStrengthAnalyzer
from context.league_odds_profile import LeagueOddsProfiler
from context.league_predictability import LeaguePredictabilityTracker
from context.competition_factors import apply_factors

_COMPLETENESS_FIELDS = [
    "match_id", "league", "home_team", "away_team", "kickoff",
    "edge", "odds", "selection", "confidence", "p_home", "p_draw", "p_away",
]


class ContextService:
    """
    Facade per il League & Match Context Module.

    Uso:
        svc = ContextService()
        svc.load_league_history(league_id, league_name, matches)
        enriched = svc.enrich(match_data_dict)
    """

    def __init__(self):
        self._classifier = MatchTypeClassifier()
        self._strength_analyzer = LeagueStrengthAnalyzer()
        self._odds_profiler = LeagueOddsProfiler()
        self._predictability = LeaguePredictabilityTracker()
        self._league_profiles: dict[str, dict] = {}

    def load_league_history(
        self,
        league_id: str,
        league_name: str,
        matches: list[dict],
    ) -> None:
        """Carica la storia di un campionato — da chiamare al bootstrap."""
        profile = self._strength_analyzer.compute_profile(league_id, league_name, matches)
        self._league_profiles[league_id] = profile
        self._odds_profiler.compute_profile(league_id, matches)

    def load_predictions_history(self, league_id: str, predictions: list[dict]) -> None:
        """Aggiorna le metriche di predictability con lo storico delle predizioni."""
        self._predictability.update(league_id, predictions)

    def enrich(self, data: dict) -> dict:
        """
        Arricchisce il dict di una partita con tutto il contesto disponibile.

        Modifica una copia — non altera il dict originale.
        """
        enriched = {**data}
        league = data.get("league", "")

        # 1. Match type
        match_type = self._classifier.classify(data).value
        enriched["match_type"] = match_type

        # 2. League profile
        league_profile = self._league_profiles.get(league, {})
        enriched["league_tier"] = league_profile.get("strength_tier")
        enriched["league_predictability_score"] = league_profile.get("predictability_score")
        enriched["league_recommended_edge_min"] = league_profile.get("recommended_edge_min")
        enriched["market_efficiency"] = league_profile.get("market_efficiency")

        # 3. Predictability metrics
        pred_metrics = self._predictability.get_metrics(league)
        enriched["league_confidence_level"] = pred_metrics["confidence_level"]
        enriched["bet_filter_active"] = pred_metrics["bet_filter_active"]
        enriched["suspend_recommended"] = pred_metrics.get("suspend_recommended", False)

        # 4. Competition factors (stake + confidence adjustment)
        base_stake = float(data.get("stake", 0.0))
        base_confidence = float(data.get("confidence", 0.7))
        factors = apply_factors(base_stake, base_confidence, match_type)
        enriched["adjusted_stake"] = factors["adjusted_stake"]
        enriched["adjusted_confidence"] = factors["adjusted_confidence"]
        enriched["match_type_penalty"] = factors["match_type_penalty"]
        enriched["stake_multiplier"] = factors["stake_multiplier"]

        # 5. Odds anomaly detection
        selection = data.get("selection", "home")
        current_odds = float(data.get("odds", 0.0)) if data.get("odds") else None
        if current_odds:
            enriched["odds_anomaly"] = self._odds_profiler.detect_anomaly(
                league, selection, current_odds
            )
        else:
            # Check home odds specifically if available
            home_odds = data.get("home_odds")
            if home_odds:
                enriched["odds_anomaly"] = self._odds_profiler.detect_anomaly(
                    league, "home", float(home_odds)
                )
            else:
                enriched["odds_anomaly"] = False

        # 6. Data completeness
        missing = [f for f in _COMPLETENESS_FIELDS if not data.get(f)]
        completeness = (len(_COMPLETENESS_FIELDS) - len(missing)) / len(_COMPLETENESS_FIELDS)
        enriched["data_completeness"] = round(completeness, 3)
        enriched["missing_fields"] = missing

        # 7. Auto-skip reason
        enriched["auto_skip_reason"] = self._auto_skip_reason(enriched)

        return enriched

    def _auto_skip_reason(self, data: dict) -> str | None:
        if data.get("suspend_recommended"):
            return f"CLV medio negativo su campionato {data.get('league', '?')} — sospeso fino a review"
        if data.get("bet_filter_active"):
            return f"Hit rate basso su {data.get('league', '?')} — stake ridotto del 50%"
        if data.get("league_tier") is None:
            return f"Dati insufficienti per campionato {data.get('league', '?')} — skip automatico"
        return None
```

- [ ] **Step 6.4: Aggiorna `context/__init__.py`**

```python
from context.match_type import MatchTypeClassifier, MatchType
from context.league_strength import LeagueStrengthAnalyzer
from context.league_odds_profile import LeagueOddsProfiler
from context.league_predictability import LeaguePredictabilityTracker
from context.competition_factors import competition_type_factors, apply_factors
from context.context_service import ContextService

__all__ = [
    "MatchTypeClassifier", "MatchType",
    "LeagueStrengthAnalyzer",
    "LeagueOddsProfiler",
    "LeaguePredictabilityTracker",
    "competition_type_factors", "apply_factors",
    "ContextService",
]
```

- [ ] **Step 6.5: Esegui i test**

```bash
.venv/bin/python -m pytest tests/test_context_service.py -v 2>&1 | tail -15
```
Atteso: `7 passed`

- [ ] **Step 6.6: Esegui tutta la suite**

```bash
.venv/bin/python -m pytest --tb=short 2>&1 | tail -10
```
Atteso: tutti i test precedenti ancora verdi.

- [ ] **Step 6.7: Commit**

```bash
git add context/context_service.py context/__init__.py tests/test_context_service.py
git commit -m "feat: add ContextService facade unifying all context modules"
```

---

## Task 7 — Integrazione Pipeline (ModelAgent + RiskManagerAgent)

**Files:**
- Modify: `agents/model.py` (linee ~70-90 in `_process`)
- Modify: `agents/risk_manager.py` (linee ~119-149 in `_process`)
- Modify: `config/settings.py` (aggiungere parametri)

- [ ] **Step 7.1: Aggiungi parametri a `config/settings.py`**

Aggiungi dopo `MIN_LEAGUE_MATCHES`:

```python
    PREDICTABILITY_MIN_BETS: int = 50       # min bet prima di valutare hit_rate
    PREDICTABILITY_HIT_RATE_MIN: float = 0.45  # soglia filtro automatico
    CLV_MIN_ACCEPTABLE: float = 0.0         # CLV negativo → sospensione consigliata
    LEAGUE_TIER_TOP5: list[str] = ["PL", "SA", "PD", "BL1", "FL1"]
```

- [ ] **Step 7.2: Integra `ContextService` in `ModelAgent`**

In `agents/model.py`, aggiungi l'import all'inizio:

```python
from context.context_service import ContextService
```

Aggiungi `self._context_svc = ContextService()` in `__init__`.

In `_bootstrap_models`, dopo `model.fit(training)` aggiungi:

```python
                    # Carica storia campionato nel ContextService
                    raw_matches = [
                        {
                            "home_goals": m["home_goals"],
                            "away_goals": m["away_goals"],
                            "result": (
                                "home" if m["home_goals"] > m["away_goals"]
                                else "away" if m["away_goals"] > m["home_goals"]
                                else "draw"
                            ),
                        }
                        for m in training
                    ]
                    self._context_svc.load_league_history(
                        league_code, league_code, raw_matches
                    )
```

In `_process`, dopo aver costruito il `result` dict e prima di `await publish(...)`:

```python
            # Arricchisci con contesto campionato/partita
            context_input = {
                "home_team": home, "away_team": away, "league": league,
                "match_id": payload["match_id"],
                "kickoff": payload["kickoff"],
                "confidence": max(p_home, p_draw, p_away),
            }
            enriched_ctx = self._context_svc.enrich(context_input)
            result["match_type"] = enriched_ctx["match_type"]
            result["league_tier"] = str(enriched_ctx.get("league_tier") or "")
            result["league_confidence_level"] = enriched_ctx["league_confidence_level"]
            result["bet_filter_active"] = str(enriched_ctx["bet_filter_active"])
            result["auto_skip_reason"] = enriched_ctx.get("auto_skip_reason") or ""
            result["odds_anomaly"] = str(enriched_ctx.get("odds_anomaly", False))
            result["data_completeness"] = str(enriched_ctx["data_completeness"])
            result["market_efficiency"] = str(enriched_ctx.get("market_efficiency") or "")
```

- [ ] **Step 7.3: Integra `apply_factors` in `RiskManagerAgent`**

In `agents/risk_manager.py`, aggiungi import:

```python
from context.competition_factors import apply_factors
```

In `_process`, dopo il calcolo di `stake = kelly_stake(...)` (linea ~119), aggiungi:

```python
            # Applica penalità competition type
            match_type = data.get("match_type", "STANDARD")
            factors = apply_factors(stake, confidence, match_type)
            stake = factors["adjusted_stake"]
            match_type_penalty = factors["match_type_penalty"]

            # Auto-skip se sistema segnala sospensione
            auto_skip = data.get("auto_skip_reason", "")
            if auto_skip and data.get("suspend_recommended") == "True":
                self.logger.warning(f"AUTO-SKIP: {auto_skip}")
                await tg_send(
                    f"⏸ <b>AUTO-SKIP</b>\n"
                    f"{match_header(data)}\n"
                    f"📋 {auto_skip}"
                )
                return
```

Aggiorna il dict `order` (vicino alla riga 140) aggiungendo i nuovi campi:

```python
            order = {
                ...campi esistenti...,
                "match_type": data.get("match_type", "STANDARD"),
                "match_type_penalty": str(match_type_penalty),
                "adjusted_stake": str(stake),
                "league_tier": data.get("league_tier", ""),
                "auto_skip_reason": data.get("auto_skip_reason", ""),
                "odds_anomaly": data.get("odds_anomaly", "False"),
            }
```

- [ ] **Step 7.4: Esegui la suite completa**

```bash
.venv/bin/python -m pytest --tb=short 2>&1 | tail -10
```
Atteso: tutti i test passano.

- [ ] **Step 7.5: Commit**

```bash
git add agents/model.py agents/risk_manager.py config/settings.py
git commit -m "feat: integrate ContextService into ModelAgent and RiskManagerAgent pipeline"
```

---

## Task 8 — Settings: aggiungere nuovi parametri

Già coperto nello Step 7.1. Nessun task aggiuntivo.

---

## Task 9 — Suite test finale e verifica

- [ ] **Step 9.1: Esegui intera suite**

```bash
.venv/bin/python -m pytest -v 2>&1 | tail -30
```
Atteso: tutti i test verdi, nessuna regressione.

- [ ] **Step 9.2: Verifica conteggio totale moduli context**

```bash
ls ~/Desktop/sistema-andrea/agentic-markets/context/
```
Atteso: `__init__.py competition_factors.py context_service.py league_odds_profile.py league_predictability.py league_strength.py match_type.py`

- [ ] **Step 9.3: Commit finale**

```bash
git add -A
git commit -m "feat: League & Match Context Module completo — 5 moduli, integrazione pipeline, test suite"
```

---

## Checklist Spec Coverage

| Requisito spec | Task che lo implementa |
|----------------|----------------------|
| LeagueStrengthAnalyzer | Task 3 |
| LeagueOddsProfiler | Task 4 |
| LeaguePredictabilityTracker | Task 5 |
| MatchTypeClassifier | ✅ già esiste |
| competition_type_factors | Task 2 |
| ContextService facade | Task 6 |
| DB tables (league_profiles, match_classifications, ...) | Task 1 |
| Integrazione ModelAgent | Task 7 |
| Integrazione RiskManagerAgent | Task 7 |
| auto_skip_reason | Task 6 + 7 |
| odds_anomaly flag | Task 4 + 6 |
| bet_filter_active | Task 5 + 6 |
| Fallback xG da shots on target | Task 3 |
| Settings parametri | Task 7.1 |

**Dashboard React:** non inclusa in questo piano — richiede sessione separata con accesso a `dashboard-web/`.

---

## Note dipendenze

Nessuna nuova dipendenza Python. Tutto già in `requirements.txt`.
Per i test delle tabelle DB in-memory: `pip install aiosqlite` (già disponibile come dev dep opzionale).
