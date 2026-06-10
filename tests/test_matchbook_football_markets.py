"""#4 — get_football_markets must emit ONLY the full-time 1X2 market and assign
home/away by matching runner names to the event name, never by runner order."""
from unittest.mock import patch

import core.matchbook_client as mb


def _event_with_two_markets():
    """One event carrying both Match Odds and Half Time Result, same team runners."""
    return {
        "events": [
            {
                "name": "Arsenal vs Chelsea",
                "markets": [
                    {
                        "id": 1,
                        "name": "Half Time Result",
                        "runners": [
                            {"name": "Arsenal", "status": "open",
                             "prices": [{"side": "back", "odds": 3.0}]},
                            {"name": "Draw", "status": "open",
                             "prices": [{"side": "back", "odds": 2.0}]},
                            {"name": "Chelsea", "status": "open",
                             "prices": [{"side": "back", "odds": 4.0}]},
                        ],
                    },
                    {
                        "id": 2,
                        "name": "Match Odds",
                        # runners deliberately out of "home first" order
                        "runners": [
                            {"name": "Chelsea", "status": "open",
                             "prices": [{"side": "back", "odds": 5.0}]},
                            {"name": "Draw", "status": "open",
                             "prices": [{"side": "back", "odds": 3.5}]},
                            {"name": "Arsenal", "status": "open",
                             "prices": [{"side": "back", "odds": 1.8}]},
                        ],
                    },
                ],
            }
        ]
    }


def test_only_match_odds_emitted_and_sides_correct():
    with patch.object(mb, "is_configured", return_value=True), \
         patch.object(mb, "_get", return_value=_event_with_two_markets()):
        rows = mb.get_football_markets()

    assert len(rows) == 1, "Half Time Result must not be emitted as 1X2"
    row = rows[0]
    # Home/away resolved from the event name, NOT runner order
    assert row["home_team"] == "Arsenal"
    assert row["away_team"] == "Chelsea"
    assert row["odds_home"] == 1.8   # Arsenal's Match Odds price
    assert row["odds_away"] == 5.0   # Chelsea's Match Odds price
    assert row["odds_draw"] == 3.5


def test_event_without_vs_separator_skipped():
    data = {
        "events": [
            {
                "name": "Some Outright Winner Market",
                "markets": [
                    {
                        "id": 9,
                        "name": "Match Odds",
                        "runners": [
                            {"name": "A", "status": "open",
                             "prices": [{"side": "back", "odds": 2.0}]},
                            {"name": "Draw", "status": "open",
                             "prices": [{"side": "back", "odds": 3.0}]},
                            {"name": "B", "status": "open",
                             "prices": [{"side": "back", "odds": 4.0}]},
                        ],
                    }
                ],
            }
        ]
    }
    with patch.object(mb, "is_configured", return_value=True), \
         patch.object(mb, "_get", return_value=data):
        rows = mb.get_football_markets()
    assert rows == []
