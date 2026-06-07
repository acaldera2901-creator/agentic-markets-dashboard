"""
World Cup 2026 venue-context enricher (Gate 2: venue_context).

Pure, static lookup tables (coordinates + IANA timezones) for the 16 host cities
and the WC2026 national teams. Derives the six venue fields consumed by
``world_cup_context.build_world_cup_context``:

    rest_days_team_{a,b}, travel_distance_km_team_{a,b}, timezone_shift_team_{a,b}

No external API, no network. rest_days needs the team's previous kickoff (from
the fixture calendar); travel/timezone are resolvable from static tables alone.
"""
from __future__ import annotations

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from zoneinfo import ZoneInfo

from core.world_cup_history import canonical_team_name


_EARTH_RADIUS_KM = 6371.0


# Host city -> (lat, lon). Keys normalized on lookup. Matches HOST_CITY_COUNTRY
# in world_cup_context plus the official venue cities.
VENUE_CITY_COORDS: dict[str, tuple[float, float]] = {
    "atlanta": (33.755, -84.401),
    "boston": (42.091, -71.264),          # Gillette Stadium, Foxborough
    "dallas": (32.747, -97.093),          # AT&T Stadium, Arlington
    "houston": (29.685, -95.411),
    "kansas city": (39.049, -94.484),
    "los angeles": (33.953, -118.339),    # SoFi Stadium, Inglewood
    "miami": (25.958, -80.239),           # Hard Rock Stadium
    "new york": (40.814, -74.074),        # MetLife Stadium, East Rutherford
    "new jersey": (40.814, -74.074),
    "philadelphia": (39.901, -75.168),
    "san francisco": (37.403, -121.970),  # Levi's Stadium, Santa Clara
    "bay area": (37.403, -121.970),
    "seattle": (47.595, -122.332),
    "toronto": (43.633, -79.418),
    "vancouver": (49.277, -123.112),
    "guadalajara": (20.681, -103.463),
    "mexico city": (19.303, -99.150),     # Estadio Azteca
    "monterrey": (25.669, -100.244),
}

# P1 (PROPOSAL accuracy WC, msg_mq3ufltj): venue altitude in metres, keyed by
# canonical (_norm_city) city. Verified 2026-06-07 against public elevation /
# stadium data: Azteca ~2,200-2,240 m and Akron (Guadalajara) 1,566 m are the
# only venues where altitude is a documented competitive factor (Monterrey and
# all 13 US/Canada sites are effectively sea-level, <350 m). Additive: never
# touches probabilities; relevant in the explanation only above 1,000 m.
HOST_CITY_ALTITUDE_M: dict[str, int] = {
    "mexico city": 2240,   # Estadio Azteca
    "guadalajara": 1566,   # Estadio Akron
    "monterrey": 540,      # Estadio BBVA (city ~540 m)
    "atlanta": 320,
    "boston": 43,          # Foxborough
    "dallas": 140,         # Arlington
    "houston": 15,
    "kansas city": 270,
    "los angeles": 30,     # Inglewood
    "miami": 2,            # Miami Gardens
    "new york": 3,         # East Rutherford
    "new jersey": 3,
    "philadelphia": 12,
    "san francisco": 3,    # Santa Clara
    "bay area": 3,
    "seattle": 50,
    "toronto": 76,
    "vancouver": 2,
}


# P2 (PROPOSAL accuracy WC, msg_mq3ufltj): venues with a retractable roof + full
# air-conditioning that play in a controlled indoor environment. Verified
# 2026-06-07: the four widely-confirmed climate-controlled venues are Atlanta
# (Mercedes-Benz), Arlington/Dallas (AT&T), Houston (NRG) and Vancouver
# (BC Place, roof). SoFi (Inglewood/LA) has a fixed canopy but is NOT fully
# air-conditioned, so it stays outdoor here. Keyed by canonical (_norm_city).
VENUE_INDOOR: dict[str, bool] = {
    "atlanta": True,
    "dallas": True,
    "houston": True,
    "vancouver": True,
}


# Hot-climate host cities for the June/July tournament window. Heat risk is only
# raised for these (documented summer heat in the US South / interior and central
# Mexico). Conservative on purpose: northern/coastal-cool sites are excluded.
# Note: dallas/houston/atlanta are hot but indoor (filtered by VENUE_INDOOR).
HOT_CLIMATE_CITIES: frozenset[str] = frozenset({
    "miami", "monterrey", "guadalajara", "kansas city", "philadelphia",
    "dallas", "houston", "atlanta", "los angeles",
})


VENUE_CITY_TIMEZONE: dict[str, str] = {
    "atlanta": "America/New_York",
    "boston": "America/New_York",
    "dallas": "America/Chicago",
    "houston": "America/Chicago",
    "kansas city": "America/Chicago",
    "los angeles": "America/Los_Angeles",
    "miami": "America/New_York",
    "new york": "America/New_York",
    "new jersey": "America/New_York",
    "philadelphia": "America/New_York",
    "san francisco": "America/Los_Angeles",
    "bay area": "America/Los_Angeles",
    "seattle": "America/Los_Angeles",
    "toronto": "America/Toronto",
    "vancouver": "America/Vancouver",
    "guadalajara": "America/Mexico_City",
    "mexico city": "America/Mexico_City",
    "monterrey": "America/Monterrey",
}


# Team -> capital/representative (lat, lon) and home IANA timezone.
# Keyed by canonical (dataset) team name.
TEAM_HOME: dict[str, tuple[tuple[float, float], str]] = {
    "United States": ((38.895, -77.037), "America/New_York"),
    "Canada": ((45.421, -75.697), "America/Toronto"),
    "Mexico": ((19.433, -99.133), "America/Mexico_City"),
    "Argentina": ((-34.604, -58.382), "America/Argentina/Buenos_Aires"),
    "Brazil": ((-15.794, -47.882), "America/Sao_Paulo"),
    "Uruguay": ((-34.901, -56.165), "America/Montevideo"),
    "Colombia": ((4.711, -74.072), "America/Bogota"),
    "Ecuador": ((-0.180, -78.468), "America/Guayaquil"),
    "Paraguay": ((-25.264, -57.576), "America/Asuncion"),
    "France": ((48.857, 2.352), "Europe/Paris"),
    "England": ((51.507, -0.128), "Europe/London"),
    "Spain": ((40.417, -3.704), "Europe/Madrid"),
    "Portugal": ((38.722, -9.139), "Europe/Lisbon"),
    "Germany": ((52.520, 13.405), "Europe/Berlin"),
    "Netherlands": ((52.370, 4.895), "Europe/Amsterdam"),
    "Belgium": ((50.851, 4.352), "Europe/Brussels"),
    "Italy": ((41.903, 12.496), "Europe/Rome"),
    "Croatia": ((45.815, 15.982), "Europe/Zagreb"),
    "Switzerland": ((46.948, 7.447), "Europe/Zurich"),
    "Denmark": ((55.676, 12.568), "Europe/Copenhagen"),
    "Scotland": ((55.953, -3.188), "Europe/London"),
    "Austria": ((48.208, 16.373), "Europe/Vienna"),
    "Turkey": ((39.933, 32.860), "Europe/Istanbul"),
    "Czech Republic": ((50.075, 14.438), "Europe/Prague"),
    "Norway": ((59.914, 10.752), "Europe/Oslo"),
    "Poland": ((52.230, 21.012), "Europe/Warsaw"),
    "Serbia": ((44.787, 20.457), "Europe/Belgrade"),
    # Track C alias audit (2026-06-06): the 6 qualified teams below were
    # missing (this table pre-dated the final playoff results) — their venue
    # context silently degraded to neutral. Some entries above are now stale
    # (non-qualified playoff hopefuls) — harmless, kept for reference.
    # Keys MUST be canonical dataset spellings (canonical_team_name output):
    # "Cape Verde" / "DR Congo", not the FIFA spellings.
    "Sweden": ((59.329, 18.069), "Europe/Stockholm"),
    "Iraq": ((33.315, 44.366), "Asia/Baghdad"),
    "New Zealand": ((-41.286, 174.776), "Pacific/Auckland"),
    "Cape Verde": ((14.916, -23.509), "Atlantic/Cape_Verde"),
    "DR Congo": ((-4.325, 15.322), "Africa/Kinshasa"),
    "Curaçao": ((12.109, -68.935), "America/Curacao"),
    "Japan": ((35.690, 139.692), "Asia/Tokyo"),
    "South Korea": ((37.567, 126.978), "Asia/Seoul"),
    "Iran": ((35.689, 51.389), "Asia/Tehran"),
    "Australia": ((-35.281, 149.128), "Australia/Sydney"),
    "Saudi Arabia": ((24.713, 46.675), "Asia/Riyadh"),
    "Qatar": ((25.286, 51.534), "Asia/Qatar"),
    "Uzbekistan": ((41.299, 69.240), "Asia/Tashkent"),
    "Jordan": ((31.951, 35.923), "Asia/Amman"),
    "Morocco": ((34.020, -6.841), "Africa/Casablanca"),
    "Senegal": ((14.693, -17.447), "Africa/Dakar"),
    "Tunisia": ((36.806, 10.181), "Africa/Tunis"),
    "Algeria": ((36.737, 3.087), "Africa/Algiers"),
    "Egypt": ((30.044, 31.236), "Africa/Cairo"),
    "Nigeria": ((9.072, 7.491), "Africa/Lagos"),
    "Ghana": ((5.604, -0.187), "Africa/Accra"),
    "Ivory Coast": ((6.827, -5.290), "Africa/Abidjan"),
    "Cameroon": ((3.848, 11.502), "Africa/Douala"),
    "South Africa": ((-25.747, 28.229), "Africa/Johannesburg"),
    "Haiti": ((18.594, -72.307), "America/Port-au-Prince"),
    "Bosnia and Herzegovina": ((43.857, 18.413), "Europe/Sarajevo"),
    "Panama": ((8.984, -79.519), "America/Panama"),
    "Costa Rica": ((9.928, -84.091), "America/Costa_Rica"),
}


# Stadium-town / feed-spelling aliases -> canonical table key. ESPN address.city
# ships "Town, State" for US venues and the stadium's TOWN, not the metro the
# tables are keyed by; api-football ships the bare town. Audit 2026-06-07
# (tests/test_wc_venue_city_audit.py): 12/16 host cities failed the exact-match
# lookup pre-fix, silently nulling travel/timezone for most US-hosted matches.
_VENUE_CITY_ALIASES: dict[str, str] = {
    "arlington": "dallas",           # AT&T Stadium
    "inglewood": "los angeles",      # SoFi Stadium
    "santa clara": "san francisco",  # Levi's Stadium
    "east rutherford": "new york",   # MetLife Stadium
    "foxborough": "boston",          # Gillette Stadium
    "miami gardens": "miami",        # Hard Rock Stadium
    "guadalupe": "monterrey",        # Estadio BBVA
}


def _norm_city(city: str | None) -> str:
    norm = " ".join((city or "").strip().lower().split())
    if norm in VENUE_CITY_COORDS:
        return norm
    base = norm.split(",")[0].strip()  # "houston, texas" -> "houston"
    if base in _VENUE_CITY_ALIASES:
        return _VENUE_CITY_ALIASES[base]
    return base if base in VENUE_CITY_COORDS else norm


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (lat1, lon1), (lat2, lon2) = a, b
    lat1, lon1, lat2, lon2 = map(radians, (lat1, lon1, lat2, lon2))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * asin(sqrt(h))


def venue_coords(city: str | None) -> tuple[float, float] | None:
    return VENUE_CITY_COORDS.get(_norm_city(city))


def venue_timezone(city: str | None) -> str | None:
    return VENUE_CITY_TIMEZONE.get(_norm_city(city))


def team_coords(team: str | None) -> tuple[float, float] | None:
    entry = TEAM_HOME.get(canonical_team_name(team))
    return entry[0] if entry else None


def team_timezone(team: str | None) -> str | None:
    entry = TEAM_HOME.get(canonical_team_name(team))
    return entry[1] if entry else None


def venue_altitude_m(city: str | None) -> int | None:
    return HOST_CITY_ALTITUDE_M.get(_norm_city(city))


# Approximate home-capital altitude (m) for teams whose habitual altitude is a
# meaningful baseline for the altitude_delta. Verified 2026-06-07 (city-centre
# elevation). Only used to contextualise play at altitude (>1000 m venues);
# absent team -> delta is None (never fabricated). Keyed by canonical name.
TEAM_HOME_ALTITUDE_M: dict[str, int] = {
    "Mexico": 2240,
    "Bolivia": 3640,
    "Ecuador": 2850,
    "Colombia": 2640,
    "Peru": 150,
    "United States": 25,
    "Canada": 70,
    "Argentina": 25,
    "Brazil": 1170,
    "Uruguay": 40,
    "Paraguay": 140,
    "France": 35,
    "England": 35,
    "Spain": 667,
    "Portugal": 10,
    "Germany": 34,
    "Netherlands": 0,
    "Belgium": 13,
    "Italy": 21,
    "Croatia": 122,
    "Switzerland": 540,
    "Morocco": 75,
    "Senegal": 22,
    "Japan": 40,
    "South Korea": 38,
    "Australia": 6,
    "Saudi Arabia": 612,
    "Iran": 1200,
}


def team_home_altitude_m(team: str | None) -> int | None:
    """Team's habitual home altitude. Returns None for an unlisted team — a
    missing reference must degrade to no delta, never a fabricated 0."""
    return TEAM_HOME_ALTITUDE_M.get(canonical_team_name(team))


def is_indoor_venue(city: str | None) -> bool | None:
    norm = _norm_city(city)
    if norm not in VENUE_CITY_COORDS:
        return None
    return VENUE_INDOOR.get(norm, False)


def heat_risk_flag(city: str | None, kickoff: datetime | None) -> bool | None:
    """True iff an outdoor, hot-climate host city kicks off in local 12:00-17:00.

    Additive flag only — it never adjusts probabilities. Returns None when the
    inputs can't support a verdict (unknown city, missing kickoff), so callers
    fail soft rather than treat absence as ``False``.
    """
    norm = _norm_city(city)
    if norm not in VENUE_CITY_COORDS or kickoff is None:
        return None
    if VENUE_INDOOR.get(norm, False):
        return False
    if norm not in HOT_CLIMATE_CITIES:
        return False
    tz = VENUE_CITY_TIMEZONE.get(norm)
    if not tz:
        return None
    moment = kickoff if kickoff.tzinfo is not None else kickoff.replace(tzinfo=timezone.utc)
    local_hour = moment.astimezone(ZoneInfo(tz)).hour
    return 12 <= local_hour < 17


def _rest_days(kickoff: datetime | None, prev_kickoff: datetime | None) -> int | None:
    if kickoff is None or prev_kickoff is None:
        return None
    return (kickoff.date() - prev_kickoff.date()).days


def _travel_km(team: str, host_city: str | None) -> int | None:
    tc = team_coords(team)
    vc = venue_coords(host_city)
    if tc is None or vc is None:
        return None
    return int(round(haversine_km(tc, vc)))


def _tz_shift(team: str, host_city: str | None, ref: datetime | None) -> int | None:
    home_tz = team_timezone(team)
    venue_tz = venue_timezone(host_city)
    if not home_tz or not venue_tz:
        return None
    moment = ref or datetime.now()
    if moment.tzinfo is not None:
        moment = moment.replace(tzinfo=None)
    home_off = ZoneInfo(home_tz).utcoffset(moment)
    venue_off = ZoneInfo(venue_tz).utcoffset(moment)
    if home_off is None or venue_off is None:
        return None
    return int(round((venue_off.total_seconds() - home_off.total_seconds()) / 3600))


def enrich_venue_context(
    fixture: dict,
    *,
    team_a: str,
    team_b: str,
    host_city: str | None = None,
    team_a_prev_kickoff: datetime | None = None,
    team_b_prev_kickoff: datetime | None = None,
    kickoff: datetime | None = None,
) -> dict[str, int | None]:
    city = host_city or fixture.get("host_city") or fixture.get("city")
    altitude = venue_altitude_m(city)
    home_alt_a = team_home_altitude_m(team_a)
    home_alt_b = team_home_altitude_m(team_b)
    return {
        "rest_days_team_a": _rest_days(kickoff, team_a_prev_kickoff),
        "rest_days_team_b": _rest_days(kickoff, team_b_prev_kickoff),
        "travel_distance_km_team_a": _travel_km(team_a, city),
        "travel_distance_km_team_b": _travel_km(team_b, city),
        "timezone_shift_team_a": _tz_shift(team_a, city, kickoff),
        "timezone_shift_team_b": _tz_shift(team_b, city, kickoff),
        "venue_altitude_m": altitude,
        "altitude_delta_team_a": (altitude - home_alt_a) if altitude is not None and home_alt_a is not None else None,
        "altitude_delta_team_b": (altitude - home_alt_b) if altitude is not None and home_alt_b is not None else None,
        "venue_indoor": is_indoor_venue(city),
        "heat_risk": heat_risk_flag(city, kickoff),
    }
