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
        "notes": "Home advantage annullato, ribilancia le probabilità",
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
    factors = competition_type_factors.get(match_type, _STANDARD)
    penalty = factors["model_confidence_penalty"]
    multiplier = factors["stake_multiplier"]

    return {
        "adjusted_stake": round(max(base_stake * multiplier, 0.0), 4),
        "adjusted_confidence": round(max(base_confidence + penalty, 0.0), 4),
        "match_type_penalty": penalty,
        "stake_multiplier": multiplier,
    }
