"""#SETTLE-1001 b — the backfill writes only what it can back."""
import json

from scripts.backfill_settle_1001 import build, football_row, tennis_row

N = json.dumps({"final_score": "2-1"})


def test_b1_football_verified_closed_is_mirrored_with_outcome():
    r = football_row("match_predictions", "espn:1", "football-v4-xg-model", "won", "verified", N)
    assert (r["result"], r["outcome"], r["final_score"]) == ("won", "HOME", "2-1")


def test_b1_football_unverified_result_is_skipped():
    assert football_row("match_predictions", "espn:1", "v", "lost", "unverified", N) is None


def test_b2_tennis_graded_on_sealed_pick_not_served_result():
    # served said 'lost' (shown pick changed), sealed pick actually won.
    r = tennis_row("tennis_predictions", "m1", "partner-market-v1", "Anna Kalinskaya",
                   "lost", json.dumps({"final_score": "6-4 6-3"}), "Anna Kalinskaya", "P1_WIN", "verified")
    assert (r["result"], r["outcome"], r["final_score"]) == ("won", "Anna Kalinskaya", "6-4 6-3")


def test_b2_tennis_expired_without_winner_is_unresolved_terminal():
    r = tennis_row("tennis_predictions", "m1", "v", "A", "unresolved", None, None, "expired")
    assert (r["result"], r["outcome"], r["final_score"]) == ("unresolved", None, None)


def test_b2_tennis_closed_without_winner_or_expiry_is_skipped():
    assert tennis_row("tennis_predictions", "m1", "v", "A", "void", None, None, None) is None


def test_build_counts_written_and_skipped():
    rows, stats = build(
        [("match_predictions", "e1", "v", "won", "verified", N),
         ("match_predictions", "e2", "v", "won", "unverified", N)],
        [("tennis_predictions", "m1", "v", "A", "unresolved", None, None, "expired")],
    )
    # b1 is superseded by scripts/recupera_calcio_1001.py (#CALCIO-1001 review D)
    assert len(rows) == 1
    assert stats == {"b1:superseded": 2, "b2:unresolved": 1}



def test_b2_tennis_unverified_winner_is_never_graded():
    # #SETTLE-1001 review — tennis_predictions.winner includes rows graded on
    # partial scores before #SETTLE-0909; the register is first-write-wins, so
    # an unverified winner would become permanent.
    assert tennis_row("tennis_predictions", "m1", "v", "A", "won", None, "A", "P1_WIN",
                      "unverified") is None
    r = tennis_row("tennis_predictions", "m1", "v", "A", "unresolved", None, "A", "expired",
                   "unverified")
    assert r["result"] == "unresolved"
