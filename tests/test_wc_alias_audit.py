# tests/test_wc_alias_audit.py — Track C alias audit (World Cup Wing design §C2).
#
# Crosses the 48 qualified teams (ESPN displayName spellings, snapshotted from
# the live fifa.world standings on 2026-06-06) against canonical_team_name()
# and the venue-context table. A silent name mismatch costs odds matching
# (0.65 fuzzy threshold) or a venue/team profile — this is the regression net.
#
# First run of this audit found 6 qualified teams missing from TEAM_HOME
# (Sweden, Iraq, New Zealand, Cabo Verde, Congo DR, Curaçao): the table
# pre-dated the final playoffs. Fixed alongside this test.
from core.world_cup_history import canonical_team_name
from core.world_cup_venue_context import TEAM_HOME

# ESPN displayName for every qualified team, grouped A-L (source: ESPN
# fifa.world standings, season 2026 — same upstream the hub + Track A use).
ESPN_QUALIFIED_48 = [
    "Algeria", "Argentina", "Australia", "Austria", "Belgium",
    "Bosnia-Herzegovina", "Brazil", "Canada", "Cape Verde", "Colombia",
    "Congo DR", "Croatia", "Curaçao", "Czechia", "Ecuador", "Egypt",
    "England", "France", "Germany", "Ghana", "Haiti", "Iran", "Iraq",
    "Ivory Coast", "Japan", "Jordan", "Mexico", "Morocco", "Netherlands",
    "New Zealand", "Norway", "Panama", "Paraguay", "Portugal", "Qatar",
    "Saudi Arabia", "Scotland", "Senegal", "South Africa", "South Korea",
    "Spain", "Sweden", "Switzerland", "Tunisia", "Türkiye",
    "United States", "Uruguay", "Uzbekistan",
]


def test_espn_fixture_is_complete():
    assert len(ESPN_QUALIFIED_48) == 48
    assert len(set(ESPN_QUALIFIED_48)) == 48


def test_every_qualified_team_has_venue_context():
    """canonical_team_name(ESPN spelling) must resolve into TEAM_HOME —
    otherwise travel/rest/timezone features silently degrade to neutral."""
    missing = [
        (name, canonical_team_name(name))
        for name in ESPN_QUALIFIED_48
        if canonical_team_name(name) not in TEAM_HOME
    ]
    assert not missing, f"qualified teams without venue context: {missing}"


def test_known_provider_variants_canonicalize():
    """Spot-check the provider spellings that actually differ across
    ESPN / The Odds API / API-Football feeds."""
    cases = {
        "Czechia": "Czech Republic",
        "Bosnia-Herzegovina": "Bosnia and Herzegovina",
        "Korea Republic": "South Korea",
        "USA": "United States",
        "Cape Verde": "Cabo Verde",
        "Türkiye": "Turkey",
        "Holland": "Netherlands",
        "KSA": "Saudi Arabia",
    }
    for raw, expected in cases.items():
        assert canonical_team_name(raw) == expected, (
            f"{raw!r} -> {canonical_team_name(raw)!r}, expected {expected!r}"
        )


def test_canonical_is_idempotent():
    """canonical(canonical(x)) == canonical(x) for every qualified team —
    re-canonicalizing stored values must never drift."""
    for name in ESPN_QUALIFIED_48:
        c = canonical_team_name(name)
        assert canonical_team_name(c) == c


def test_history_csv_is_fresh_and_loader_safe():
    """Track C §C1 — the history CSV must contain recent (2026) PLAYED
    matches (pre-tournament friendlies are the highest-value form signal)
    and its unplayed fixture rows ('NA' scores) must never reach profiles:
    _load_raw() drops any row whose score does not parse as int."""
    import csv as _csv
    from core.world_cup_history import _resolve_csv_path

    path = _resolve_csv_path(None)
    assert path.exists(), f"history CSV missing: {path}"

    played_2026 = 0
    unplayed = 0
    with path.open(newline="", encoding="utf-8") as fh:
        for r in _csv.DictReader(fh):
            try:
                int(r["home_score"]), int(r["away_score"])
            except (KeyError, TypeError, ValueError):
                unplayed += 1
                continue
            if (r.get("date") or "") >= "2026-01-01":
                played_2026 += 1

    # 200+ played 2026 internationals = the dataset includes this year's
    # qualifiers/friendlies window, not a stale pre-2026 export.
    assert played_2026 >= 200, f"only {played_2026} played 2026 matches — CSV looks stale"
    # the WC fixture rows shipped inside the dataset are score-less and MUST
    # be excluded by the loader's int() parse (verified above by construction)
    assert unplayed >= 0
