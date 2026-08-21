"""#TENNIS-BACKFILL-NAMES-0821 — collect_tennis must read the player names from
home_team/away_team.

unified_predictions stores tennis names in home_team/away_team (lib/tennis-adapter
.ts maps player1->home_team, player2->away_team); it has NO player_one/player_two
columns. The old code selected/read player_one/player_two, so PostgREST returned
nothing for those keys and every backfilled tennis ledger row got NULL names.

No DB is touched: the module-level `_select` (the only PostgREST call) is
monkeypatched with canned rows, so this exercises the real mapping code offline.
"""
import scripts.backfill_pick_ledger as bpl


def _served_row() -> dict:
    return {
        "source_table": "tennis_predictions",
        "source_id": "m1",
        "model_version": "tennis-elo-v1",
        "competition": "ATP Test Open",
        "home_team": "Carlos Alcaraz",
        "away_team": "Jannik Sinner",
        # Stale columns that do NOT exist on unified_predictions. If the mapping
        # ever reads these again, the assertions below fail.
        "player_one": "WRONG P1",
        "player_two": "WRONG P2",
        "market": "ML",
        "pick": "Carlos Alcaraz",
        "confidence_score": 62,
        "odds": None,
        "closing_odds": None,
        "starts_at": "2026-08-20T12:00:00+00:00",
        "result": "won",
        "settled_at": "2026-08-20T14:00:00+00:00",
    }


def test_collect_tennis_reads_home_away_team(monkeypatch):
    captured: dict[str, dict] = {}

    def fake_select(client, table, params):
        captured[table] = params
        if table == "unified_predictions":
            return [_served_row()]
        if table == "tennis_predictions":
            return [{"match_id": "m1", "p1": 0.62, "p2": 0.38,
                     "outcome": "p1", "winner": "Carlos Alcaraz"}]
        return []

    monkeypatch.setattr(bpl, "_select", fake_select)

    picks = bpl.collect_tennis(client=None)

    assert len(picks) == 1
    p = picks[0]
    # The fix: names come from home_team/away_team, NOT the stale player_one/two.
    assert p.home_team == "Carlos Alcaraz"
    assert p.away_team == "Jannik Sinner"
    # Distribution joined on source_id=match_id still works.
    assert p.p_home == 0.62 and p.p_away == 0.38
    assert p.outcome == "Carlos Alcaraz"

    # Pin the SELECT so a future edit cannot silently reintroduce the wrong cols.
    sel = captured["unified_predictions"]["select"]
    assert "home_team" in sel and "away_team" in sel
    assert "player_one" not in sel and "player_two" not in sel
