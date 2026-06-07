"""
P1 + P2 (PROPOSAL accuracy WC, msg_mq3ufltj): additive venue enrichers.

P1 altitude — static city->metres table for the 16 host cities, exposed as
``venue_altitude_m`` (+ optional per-team ``altitude_delta``). Relevant phrase
only when >1000 m.
P2 heat-risk — static indoor/roof table + a ``heat_risk`` flag, true only for
an outdoor venue, a hot-climate city, and a local kickoff in the 12:00-17:00
window. Neither touches probabilities; both are fail-soft.
"""
from datetime import datetime, timezone

from core.world_cup_venue_context import (
    HOST_CITY_ALTITUDE_M,
    VENUE_CITY_COORDS,
    VENUE_INDOOR,
    HOT_CLIMATE_CITIES,
    venue_altitude_m,
    is_indoor_venue,
    heat_risk_flag,
    enrich_venue_context,
)


# ─── P1 altitude ─────────────────────────────────────────────────────────────

def test_altitude_table_covers_every_host_coord_city():
    # Every city with coordinates must have an altitude (no silent null at a venue).
    for city in VENUE_CITY_COORDS:
        assert city in HOST_CITY_ALTITUDE_M, f"missing altitude for {city}"


def test_altitude_known_values():
    # Verified against public elevation data (city centre / stadium).
    assert venue_altitude_m("Mexico City") == 2240
    assert 1500 <= venue_altitude_m("Guadalajara") <= 1600
    assert 500 <= venue_altitude_m("Monterrey") <= 600
    # All 13 US/Canada venues sit below 350 m.
    for city in ["Dallas", "Atlanta", "Kansas City", "Houston", "Miami",
                 "Boston", "New York", "Philadelphia", "Los Angeles",
                 "San Francisco", "Seattle", "Toronto", "Vancouver"]:
        alt = venue_altitude_m(city)
        assert alt is not None and 0 <= alt < 350, f"{city} -> {alt}"


def test_altitude_resolves_through_aliases():
    # Stadium-town feed spellings must resolve to the metro altitude.
    assert venue_altitude_m("Arlington") == venue_altitude_m("Dallas")
    assert venue_altitude_m("Inglewood") == venue_altitude_m("Los Angeles")
    assert venue_altitude_m("Guadalupe") == venue_altitude_m("Monterrey")


def test_altitude_unknown_city_is_none():
    assert venue_altitude_m("Atlantis") is None
    assert venue_altitude_m(None) is None


def test_enrich_exposes_altitude_and_delta_at_azteca():
    out = enrich_venue_context(
        {},
        team_a="Mexico",
        team_b="Germany",
        host_city="Mexico City",
        kickoff=datetime(2026, 6, 11, 19, 0, tzinfo=timezone.utc),
    )
    assert out["venue_altitude_m"] == 2240
    # A sea-level visitor faces a large positive delta vs its home altitude.
    assert isinstance(out["altitude_delta_team_b"], int)
    assert out["altitude_delta_team_b"] > 1500


def test_enrich_altitude_none_for_unknown_city():
    out = enrich_venue_context(
        {}, team_a="Brazil", team_b="Morocco", host_city="Atlantis",
    )
    assert out["venue_altitude_m"] is None
    assert out["altitude_delta_team_a"] is None


# ─── P2 heat-risk ────────────────────────────────────────────────────────────

def test_indoor_table_known_venues():
    assert is_indoor_venue("Atlanta") is True       # Mercedes-Benz (retractable, AC)
    assert is_indoor_venue("Arlington") is True      # AT&T Stadium (Dallas)
    assert is_indoor_venue("Houston") is True        # NRG Stadium
    assert is_indoor_venue("Vancouver") is True      # BC Place (roof)
    assert is_indoor_venue("Miami") is False
    assert is_indoor_venue("Kansas City") is False


def test_heat_risk_true_outdoor_hot_city_midday():
    # Miami, outdoor, 14:00 local in June -> heat risk.
    ko = datetime(2026, 6, 20, 18, 0, tzinfo=timezone.utc)  # 14:00 EDT
    assert heat_risk_flag("Miami", ko) is True


def test_heat_risk_false_indoor_even_if_hot_and_midday():
    ko = datetime(2026, 6, 20, 19, 0, tzinfo=timezone.utc)  # ~14:00 CDT in Houston
    assert heat_risk_flag("Houston", ko) is False


def test_heat_risk_false_evening_kickoff():
    # Miami, 20:00 local -> outside the 12-17 window.
    ko = datetime(2026, 6, 21, 0, 0, tzinfo=timezone.utc)  # 20:00 EDT prev day
    assert heat_risk_flag("Miami", ko) is False


def test_heat_risk_false_cool_climate_city():
    # Vancouver is roofed anyway, but Seattle (outdoor, milder) at midday is not flagged.
    ko = datetime(2026, 6, 20, 21, 0, tzinfo=timezone.utc)  # 14:00 PDT Seattle
    assert "seattle" not in HOT_CLIMATE_CITIES
    assert heat_risk_flag("Seattle", ko) is False


def test_heat_risk_none_when_no_kickoff_or_unknown_city():
    assert heat_risk_flag("Miami", None) is None
    assert heat_risk_flag("Atlantis", datetime(2026, 6, 20, 18, 0, tzinfo=timezone.utc)) is None


def test_enrich_exposes_heat_risk():
    ko = datetime(2026, 6, 20, 18, 0, tzinfo=timezone.utc)  # 14:00 EDT Miami
    out = enrich_venue_context(
        {}, team_a="Mexico", team_b="Brazil", host_city="Miami", kickoff=ko,
    )
    assert out["heat_risk"] is True
    assert out["venue_indoor"] is False
