"""
End-to-end verification of the World Cup data-quality gates.

Reproduces the exact path ModelAgent runs for a WC fixture:
  load national history -> matchup_profile -> venue enrichment ->
  build_world_cup_context -> compute_world_cup_data_quality

Prints per-gate scores, total_score and publication_tier for the first 8
fixtures of 11-12 June 2026. Uses representative odds (overround ~5%, the
football-data.co.uk closing-line tier the brief targets) so odds_quality is
realistic, not synthetic value.

Run:  venv/bin/python -m scripts.verify_world_cup_gates
"""
from __future__ import annotations

from datetime import datetime, timezone

from core.world_cup_context import build_world_cup_context
from core.world_cup_data_quality import compute_world_cup_data_quality
from core.world_cup_history import canonical_team_name, load_national_history
from core.world_cup_team_model import matchup_profile
from core.world_cup_venue_context import enrich_venue_context


# (team_a, team_b, host_city, kickoff_utc) — first 8 WC2026 fixtures (brief).
FIRST_EIGHT = [
    ("Mexico", "South Africa", "Mexico City", datetime(2026, 6, 11, 19, 0, tzinfo=timezone.utc)),
    ("South Korea", "Czech Republic", "Los Angeles", datetime(2026, 6, 11, 22, 0, tzinfo=timezone.utc)),
    ("Canada", "Bosnia and Herzegovina", "Toronto", datetime(2026, 6, 12, 18, 0, tzinfo=timezone.utc)),
    ("United States", "Paraguay", "Seattle", datetime(2026, 6, 12, 21, 0, tzinfo=timezone.utc)),
    ("Qatar", "Switzerland", "Houston", datetime(2026, 6, 12, 23, 0, tzinfo=timezone.utc)),
    ("Brazil", "Morocco", "Dallas", datetime(2026, 6, 13, 19, 0, tzinfo=timezone.utc)),
    ("Haiti", "Scotland", "Miami", datetime(2026, 6, 13, 22, 0, tzinfo=timezone.utc)),
    ("Australia", "Turkey", "New York", datetime(2026, 6, 13, 23, 0, tzinfo=timezone.utc)),
]

# Representative h2h closing odds (overround ~5% -> odds_quality 0.85 tier).
ODDS = {
    "odds_home": 2.10,
    "odds_draw": 3.30,
    "odds_away": 3.60,
    "bookmaker": "Pinnacle",
    "source": "football-data.co.uk",
}


def _prev_kickoff(kickoff: datetime) -> datetime:
    # Group-stage cadence ~4 days; used only to exercise rest_days.
    return kickoff.replace(day=kickoff.day - 4)


def main() -> int:
    matches = load_national_history()
    print(f"national history rows: {len(matches)}  (since {matches[0]['date']} .. {matches[-1]['date']})\n")

    failures = 0
    for team_a, team_b, host_city, kickoff in FIRST_EIGHT:
        national = matchup_profile(matches, canonical_team_name(team_a), canonical_team_name(team_b))
        venue_fields = enrich_venue_context(
            {},
            team_a=team_a,
            team_b=team_b,
            host_city=host_city,
            team_a_prev_kickoff=_prev_kickoff(kickoff),
            team_b_prev_kickoff=_prev_kickoff(kickoff),
            kickoff=kickoff,
        )
        context = build_world_cup_context(
            fixture={
                "league": {"round": "Group Stage - Matchday 1"},
                "fixture": {"venue": {"name": f"{host_city} Stadium", "city": host_city}},
            },
            team_a=team_a,
            team_b=team_b,
            venue_fields=venue_fields,
        )
        payload = {
            "match_id": f"wc-{team_a}-{team_b}".lower().replace(" ", "-"),
            "home_team": team_a,
            "away_team": team_b,
            "kickoff": kickoff.isoformat(),
            "league": "WC",
            "odds": ODDS,
            "provider_source": "the-odds-api",
        }
        quality = compute_world_cup_data_quality(
            payload=payload,
            context=context,
            national_matchup=national,
            settlement_ready=False,
            squad_news_ready=False,
        )

        tier = quality["publication_tier"]
        ok = tier in {"paper_only", "signal_allowed", "premium_candidate"}
        failures += 0 if ok else 1
        flag = "OK " if ok else "FAIL"
        print(
            f"[{flag}] {team_a} vs {team_b:24} "
            f"total={quality['total_score']:.3f} tier={tier:14} "
            f"hist={quality['historical_depth_quality']:.2f} "
            f"venue={quality['venue_context_quality']:.2f} "
            f"odds={quality['odds_quality']:.2f} "
            f"fixture={quality['fixture_quality']:.2f} "
            f"identity={quality['team_identity_quality']:.2f}"
        )

    print()
    if failures:
        print(f"RESULT: {failures}/8 fixtures below paper_only — gates NOT closed")
        return 1
    print("RESULT: all 8 fixtures reach paper_only — gates closed (paper tier)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
