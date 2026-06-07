# tests/test_wc_venue_city_audit.py — venue-city alias audit (companion to
# tests/test_wc_alias_audit.py, which covers team names).
#
# ESPN address.city is the live source of fixture.venue.city for WC fixtures
# (football-data.org carries venue=None; the collector merges the ESPN venue
# map — see agents/data_collector.py). For US venues ESPN ships "Town, State"
# and the stadium's TOWN, not the metro the venue tables are keyed by
# ("Arlington, Texas" vs "dallas", "Guadalupe" vs "monterrey").
#
# First run of this audit (2026-06-07, 4 days before kickoff) found 12 of 16
# host cities failing the exact-match lookup -> all six venue-context fields
# (rest/travel/timezone) silently None for every match at those venues, i.e.
# most US-hosted games. Fixed alongside this test.
from core.world_cup_context import infer_venue_country
from core.world_cup_venue_context import (
    enrich_venue_context,
    venue_coords,
    venue_timezone,
)

# (venue fullName, address.city) verbatim from the live ESPN scoreboard for
# matchdays 1-2, snapshotted 2026-06-07 — same upstream get_wc_venue_map uses.
ESPN_VENUES_16 = [
    ("Estadio Banorte", "Mexico City"),
    ("Estadio Akron", "Guadalajara"),
    ("Estadio BBVA", "Guadalupe"),
    ("BMO Field", "Toronto"),
    ("BC Place", "Vancouver"),
    ("SoFi Stadium", "Inglewood, California"),
    ("Levi's Stadium", "Santa Clara, California"),
    ("Lumen Field", "Seattle, Washington"),
    ("AT&T Stadium", "Arlington, Texas"),
    ("NRG Stadium", "Houston, Texas"),
    ("GEHA Field at Arrowhead Stadium", "Kansas City, Missouri"),
    ("Mercedes-Benz Stadium", "Atlanta, Georgia"),
    ("Hard Rock Stadium", "Miami Gardens, Florida"),
    ("MetLife Stadium", "East Rutherford, New Jersey"),
    ("Lincoln Financial Field", "Philadelphia, Pennsylvania"),
    ("Gillette Stadium", "Foxborough, Massachusetts"),
]

# api-football venue rows carry the bare town without the state suffix.
APIFOOTBALL_BARE_TOWNS = [
    "Arlington", "Inglewood", "Santa Clara", "East Rutherford",
    "Foxborough", "Miami Gardens", "Guadalupe", "Houston",
]


def test_audit_fixture_is_complete():
    assert len(ESPN_VENUES_16) == 16
    assert len({c for _, c in ESPN_VENUES_16}) == 16


def test_every_espn_city_resolves_coords_and_timezone():
    """Every live ESPN address.city spelling must hit the venue tables —
    otherwise travel/timezone silently degrade to None for that venue."""
    missing = [
        city
        for _, city in ESPN_VENUES_16
        if venue_coords(city) is None or venue_timezone(city) is None
    ]
    assert not missing, f"ESPN venue cities without coords/timezone: {missing}"


def test_every_espn_venue_resolves_country():
    """venue_country is one of the ten required context fields (0.78
    completeness gate) — every host venue must infer USA/Canada/Mexico."""
    missing = [
        (venue, city)
        for venue, city in ESPN_VENUES_16
        if infer_venue_country(venue, city) is None
    ]
    assert not missing, f"venues without inferred country: {missing}"


def test_bare_town_spellings_resolve():
    """api-football ships the bare town (no state suffix) — same towns must
    resolve through the alias path too."""
    missing = [t for t in APIFOOTBALL_BARE_TOWNS if venue_coords(t) is None]
    assert not missing, f"bare town spellings without coords: {missing}"


def test_canonical_keys_still_resolve():
    """The pre-fix canonical keys must keep working (no alias regression)."""
    for key in ("dallas", "miami", "boston", "new york", "los angeles",
                "san francisco", "monterrey", "kansas city"):
        assert venue_coords(key) is not None, key
        assert venue_timezone(key) is not None, key


def test_end_to_end_arlington_match_gets_travel_fields():
    """Reproduction of the original finding: Japan vs Netherlands at AT&T
    Stadium must yield real travel/timezone numbers, not None."""
    from datetime import datetime, timezone as tz

    fields = enrich_venue_context(
        {},
        team_a="Japan",
        team_b="Netherlands",
        host_city="Arlington, Texas",
        kickoff=datetime(2026, 6, 13, 18, 0, tzinfo=tz.utc),
    )
    assert fields["travel_distance_km_team_a"] is not None
    assert fields["travel_distance_km_team_b"] is not None
    assert fields["timezone_shift_team_a"] is not None
    assert fields["timezone_shift_team_b"] is not None
    # Tokyo -> Dallas is a ~10,300 km haul; sanity-band the haversine.
    assert 9_500 < fields["travel_distance_km_team_a"] < 11_500
