# models/feature_adjuster.py
"""
Probability correction pipeline for football predictions.
Takes Dixon-Coles probabilities + enriched fixture -> adjusted probabilities.
Each adjustment is capped to prevent domination. Probabilities renormalized after.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class EnrichedFixture:
    home_ppg: float = 1.5
    away_ppg: float = 1.5
    home_xg_avg: float = 1.3
    away_xg_avg: float = 1.3
    home_xg_luck: float = 0.0
    away_xg_luck: float = 0.0
    home_motivation: float = 0.7
    away_motivation: float = 0.7
    h2h_home_wins: int = 0
    h2h_draws: int = 0
    h2h_away_wins: int = 0
    h2h_matches: int = 0
    temperature_c: float = 15.0
    wind_kmh: float = 0.0
    precipitation_pct: float = 0.0
    home_injuries_json: list = field(default_factory=list)
    away_injuries_json: list = field(default_factory=list)


@dataclass
class AdjustedProbabilities:
    p_home: float
    p_draw: float
    p_away: float
    adjustments_applied: list[str]
    confidence_weight: float
    adjustment_detail: dict[str, Any]


class FeatureAdjuster:
    FORM_CAP = 0.04
    XG_CAP = 0.03
    H2H_CAP = 0.015
    INJURY_CAP = 0.02

    def adjust(self, probs: dict[str, float], fixture: EnrichedFixture) -> AdjustedProbabilities:
        p_h = probs["p_home"]
        p_d = probs["p_draw"]
        p_a = probs["p_away"]
        applied: list[str] = []
        detail: dict[str, Any] = {}
        confidence = 1.0

        # 1. Form
        dh, da, fd = self._form_delta(fixture)
        if abs(dh) > 0.001 or abs(da) > 0.001:
            p_h = max(0.03, min(0.92, p_h + dh))
            p_a = max(0.03, min(0.92, p_a + da))
            applied.append("form")
            detail["form"] = fd

        # 2. xG luck
        xh, xa, xd = self._xg_luck_delta(fixture)
        if abs(xh) > 0.001 or abs(xa) > 0.001:
            p_h = max(0.03, min(0.92, p_h + xh))
            p_a = max(0.03, min(0.92, p_a + xa))
            applied.append("xg_luck")
            detail["xg_luck"] = xd

        # 3. H2H
        hd, hdet = self._h2h_delta(fixture)
        if abs(hd) > 0.001:
            p_h = max(0.03, min(0.92, p_h + hd))
            p_a = max(0.03, min(0.92, p_a - hd))
            applied.append("h2h")
            detail["h2h"] = hdet

        # 4. Weather -> confidence only
        wc, wd = self._weather_confidence(fixture)
        if wc < 1.0:
            confidence *= wc
            applied.append("weather")
            detail["weather"] = wd

        # 5. Motivation -> confidence only
        mc, md = self._motivation_confidence(fixture)
        if mc < 1.0:
            confidence *= mc
            applied.append("motivation")
            detail["motivation"] = md

        # 6. Injuries
        id_, idet = self._injury_delta(fixture)
        if abs(id_) > 0.001:
            p_h = max(0.03, min(0.92, p_h + id_))
            p_a = max(0.03, min(0.92, p_a - id_))
            applied.append("injury")
            detail["injury"] = idet

        total = p_h + p_d + p_a
        p_h, p_d, p_a = p_h / total, p_d / total, p_a / total

        return AdjustedProbabilities(
            p_home=round(p_h, 4),
            p_draw=round(p_d, 4),
            p_away=round(p_a, 4),
            adjustments_applied=applied,
            confidence_weight=round(max(0.5, min(1.0, confidence)), 3),
            adjustment_detail=detail,
        )

    def _form_delta(self, f: EnrichedFixture) -> tuple[float, float, dict]:
        total = f.home_ppg + f.away_ppg
        if total == 0:
            return 0.0, 0.0, {}
        home_share = f.home_ppg / total
        raw = (home_share - 0.5) * 2 * self.FORM_CAP
        dh = max(-self.FORM_CAP, min(self.FORM_CAP, raw))
        if abs(dh) < 0.001:
            return 0.0, 0.0, {}
        da = -dh * 0.6
        return dh, da, {"home_ppg": f.home_ppg, "away_ppg": f.away_ppg, "delta_h": dh}

    def _xg_luck_delta(self, f: EnrichedFixture) -> tuple[float, float, dict]:
        dh = min(self.XG_CAP, max(-self.XG_CAP, f.home_xg_luck * 0.05))
        da = min(self.XG_CAP, max(-self.XG_CAP, f.away_xg_luck * 0.05))
        if abs(dh) < 0.002 and abs(da) < 0.002:
            return 0.0, 0.0, {}
        return dh, da, {"home_luck": f.home_xg_luck, "away_luck": f.away_xg_luck}

    def _h2h_delta(self, f: EnrichedFixture) -> tuple[float, dict]:
        if f.h2h_matches < 4:
            return 0.0, {}
        home_rate = f.h2h_home_wins / f.h2h_matches
        away_rate = f.h2h_away_wins / f.h2h_matches
        if home_rate > 0.70:
            return self.H2H_CAP, {"home_rate": home_rate, "matches": f.h2h_matches}
        if away_rate > 0.70:
            return -self.H2H_CAP, {"away_rate": away_rate, "matches": f.h2h_matches}
        return 0.0, {}

    def _weather_confidence(self, f: EnrichedFixture) -> tuple[float, dict]:
        conf = 1.0
        det: dict = {}
        if f.wind_kmh > 40:
            r = min(0.15, (f.wind_kmh - 40) / 100)
            conf -= r
            det["wind_reduction"] = r
        if f.precipitation_pct > 0.7:
            conf -= 0.05
            det["rain_reduction"] = 0.05
        return conf, det

    def _motivation_confidence(self, f: EnrichedFixture) -> tuple[float, dict]:
        avg = (f.home_motivation + f.away_motivation) / 2
        if avg < 0.3:
            return 0.75, {"avg_motivation": avg}
        if avg < 0.5:
            return 0.90, {"avg_motivation": avg}
        return 1.0, {}

    def _injury_delta(self, f: EnrichedFixture) -> tuple[float, dict]:
        hi = len(f.home_injuries_json)
        ai = len(f.away_injuries_json)
        if hi == 0 and ai == 0:
            return 0.0, {}
        raw = (ai - hi) * 0.005
        delta = max(-self.INJURY_CAP, min(self.INJURY_CAP, raw))
        if abs(delta) < 0.001:
            return 0.0, {}
        return delta, {"home_injuries": hi, "away_injuries": ai}
