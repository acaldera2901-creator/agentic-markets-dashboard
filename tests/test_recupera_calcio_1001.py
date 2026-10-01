"""#CALCIO-1001 — recovery of the sealed football picks left without a result.

Every case states where the result comes from; nothing is graded without a
real final score, and nothing is voided without the source saying so.
"""
from datetime import datetime, timedelta, timezone

from scripts.recupera_calcio_1001 import (
    match_by_name,
    BATCH,
    Evidence,
    abbina,
    decide,
    espn_slugs,
    grade,
    parse_espn_event,
    settlement_row,
    token_squadra,
)

T0 = datetime(2026, 9, 20, 14, 30, tzinfo=timezone.utc)


def ev(eid, home, away, hs, as_, *, completed=True, name="STATUS_FULL_TIME", date=T0):
    return {
        "id": eid,
        "date": date.strftime("%Y-%m-%dT%H:%MZ"),
        "status": {"type": {"completed": completed, "name": name}},
        "competitions": [{"competitors": [
            {"homeAway": "home", "score": hs, "team": {"displayName": home}},
            {"homeAway": "away", "score": as_, "team": {"displayName": away}},
        ]}],
    }


# ── identity: parity with lib/dedupe-fixtures.ts::tokenSquadra ──────────────

def test_token_squadra_folds_diacritics_and_generic_acronyms():
    assert token_squadra("Vitória SC") == ["vitoria"]
    assert token_squadra("Bodø/Glimt") == ["bodo", "glimt"]
    # same outputs as lib/dedupe-fixtures.ts::tokenSquadra (measured with vitest)
    assert token_squadra("Club Brugge KV") == ["club", "brugge"]
    assert token_squadra("FC") == []


def test_abbina_matches_name_variants_of_the_same_match():
    cands = [{"key": "a", "home": "Ajax", "away": "Feyenoord", "kickoff": T0}]
    assert abbina("Ajax Amsterdam", "Feyenoord Rotterdam", T0, cands)["key"] == "a"
    # a 3-letter token is not an identity (abbinaFinale MIN_TOKEN): no match
    psv = [{"key": "a", "home": "Ajax", "away": "PSV", "kickoff": T0}]
    assert abbina("Ajax Amsterdam", "PSV Eindhoven", T0, psv) is None


def test_abbina_ambiguous_or_far_in_time_is_no_match():
    two = [{"key": k, "home": "Ajax", "away": "Feyenoord", "kickoff": T0} for k in "ab"]
    assert abbina("Ajax", "Feyenoord", T0, two) is None
    late = [{"key": "a", "home": "Ajax", "away": "Feyenoord", "kickoff": T0 + timedelta(minutes=45)}]
    assert abbina("Ajax", "Feyenoord", T0, late) is None


def test_abbina_requires_home_with_home():
    swapped = [{"key": "a", "home": "Feyenoord", "away": "Ajax", "kickoff": T0}]
    assert abbina("Ajax", "Feyenoord", T0, swapped) is None


# ── ESPN event parsing ───────────────────────────────────────────────────────

def test_parse_espn_final_postponed_and_scoreless_completed():
    assert parse_espn_event(ev("1", "A", "B", "2", "1"))["kind"] == "final"
    p = parse_espn_event(ev("2", "A", "B", "0", "0", completed=False, name="STATUS_POSTPONED"))
    assert (p["kind"], p["status"]) == ("void", "STATUS_POSTPONED")
    # completed but without a numeric score: never a 0-0
    assert parse_espn_event(ev("3", "A", "B", None, "1"))["kind"] == "pending"
    # abandoned is NOT postponed/cancelled: not voided by this script
    assert parse_espn_event(ev("4", "A", "B", "1", "0", completed=False,
                                name="STATUS_ABANDONED"))["kind"] == "pending"


def test_espn_slugs_read_from_the_ts_single_source():
    s = espn_slugs()
    assert s["BEL"] == "bel.1" and s["MLS"] == "usa.1" and s["PL"] == "eng.1"
    assert "POL" not in s  # POL has no ESPN league


# ── grading on the SEALED pick ───────────────────────────────────────────────

def test_grade_on_sealed_pick_and_no_pick_is_void():
    assert grade("HOME", "1X2", 2, 1) == "won"
    assert grade("AWAY", "1X2", 2, 1) == "lost"
    assert grade("DRAW", "1X2", 1, 1) == "won"
    assert grade(None, "1X2", 2, 1) == "void"  # #VOID-SENZA-PICK-0907


# ── decision ─────────────────────────────────────────────────────────────────

def test_decide_final_from_first_source_with_confirmation():
    d = decide("HOME", "1X2", [Evidence("gemello", "final", (2, 0)),
                               Evidence("espn-id", "final", (2, 0))])
    assert (d["result"], d["final_score"], d["outcome"], d["fonte"]) == ("won", "2-0", "HOME", "gemello")
    assert d["conferme"] == ["espn-id"]


def test_decide_conflicting_scores_stay_unresolved():
    d = decide("HOME", "1X2", [Evidence("gemello", "final", (2, 0)),
                               Evidence("espn-id", "final", (1, 1))])
    assert d["result"] is None and "conflitto" in d["motivo"]


def test_decide_postponed_is_void_with_proof_but_not_against_a_score():
    d = decide("HOME", "1X2", [Evidence("espn-id", "void", status="STATUS_POSTPONED")])
    assert (d["result"], d["final_score"], d["prova"]) == ("void", None, "STATUS_POSTPONED")
    d2 = decide("HOME", "1X2", [Evidence("gemello", "final", (1, 0)),
                                Evidence("espn-id", "void", status="STATUS_POSTPONED")])
    assert d2["result"] is None


def test_decide_nothing_found_never_invents():
    d = decide("HOME", "1X2", [])
    assert d["result"] is None and d["motivo"] == "nessuna fonte"
    d2 = decide("HOME", "1X2", [Evidence("espn-id", "pending", status="STATUS_SCHEDULED")])
    assert d2["result"] is None and "STATUS_SCHEDULED" in d2["motivo"]
    d3 = decide("HOME", "1X2", [Evidence("espn-data-nomi", "ambigua")])
    assert d3["result"] is None and "ambiguo" in d3["motivo"]


# ── the row written: append-only revision, batch marker ─────────────────────

def test_settlement_row_revision_follows_the_ledger():
    d = decide("AWAY", "1X2", [Evidence("espn-id", "final", (0, 3))])
    noset = settlement_row("espn:9", None, d)
    assert noset["settlement_revision"] == 1
    corr = settlement_row("espn:9", 1, d)  # current revision 1 = 'unresolved'
    assert corr["settlement_revision"] == 2
    assert corr["result"] == "won" and corr["correction_reason"].startswith(BATCH)
    assert "fonte=espn-id" in corr["correction_reason"]


def test_settlement_row_none_when_undecided():
    assert settlement_row("espn:9", 1, decide("HOME", "1X2", [])) is None


# ── #CALCIO-1001 review A: one shared token is not an identity ──────────────

def test_one_shared_token_never_matches_another_match():
    betis = [{"key": "x", "home": "Real Betis", "away": "Real Sociedad", "kickoff": T0}]
    assert abbina("Real Madrid", "Real Valladolid", T0, betis) is None
    city = [{"key": "x", "home": "Manchester City", "away": "Leeds United", "kickoff": T0}]
    assert abbina("Manchester United", "Newcastle United", T0, city) is None


def test_weak_name_match_is_reported_not_used():
    city = [{"key": "x", "home": "Manchester City", "away": "Leeds United", "kickoff": T0}]
    kind, hit = match_by_name("Manchester United", "Leeds United", T0, city)
    assert (kind, hit) == ("debole", None)
    d = decide("HOME", "1X2", [Evidence("gemello", "debole")])
    assert d["result"] is None and "debole" in d["motivo"]


def test_full_containment_is_a_strong_match():
    c = [{"key": "x", "home": "Ajax", "away": "Feyenoord", "kickoff": T0}]
    assert match_by_name("Ajax Amsterdam", "Feyenoord Rotterdam", T0, c)[0] == "certo"


# ── #CALCIO-1001 review B: a 1X2 pick is graded on 90 minutes ───────────────

def test_extra_time_and_penalties_are_not_a_90_minute_final():
    for name in ("STATUS_FINAL_AET", "STATUS_FINAL_PEN"):
        p = parse_espn_event(ev("5", "A", "B", "2", "1", name=name))
        assert p["kind"] == "supplementari" and p["status"] == name
    d = decide("HOME", "1X2", [Evidence("espn-id", "supplementari", status="STATUS_FINAL_PEN")])
    assert d["result"] is None and "supplementari" in d["motivo"]


def test_unknown_completed_status_is_not_a_final():
    assert parse_espn_event(ev("6", "A", "B", "1", "0", name="STATUS_SOMETHING"))["kind"] == "pending"


def test_extra_time_at_one_source_blocks_a_score_from_another():
    # the twin's score of an AET match includes extra time too
    d = decide("HOME", "1X2", [Evidence("gemello", "final", (2, 1)),
                               Evidence("espn-id", "supplementari", status="STATUS_FINAL_AET")])
    assert d["result"] is None and "supplementari" in d["motivo"]


# ── #CALCIO-1001 review C: sealed pick vs shown pick ─────────────────────────

def test_sealed_and_shown_pick_that_grade_alike_are_written():
    d = decide(None, "1X2", [Evidence("espn-id", "final", (2, 0))], shown_pick=None)
    assert d["result"] == "void"  # no pick shown = under the floor (#VOID-SENZA-PICK-0907)
    d = decide("HOME", "1X2", [Evidence("espn-id", "final", (2, 0))], shown_pick="HOME")
    assert d["result"] == "won"


def test_sealed_and_shown_pick_divergence_follows_rule_4():
    # live grades the SHOWN pick (agents/result_settlement.py); see REGOLA 4
    assert decide(None, "1X2", [Evidence("servita", "final", (2, 0))], shown_pick="HOME")["result"] == "won"
    d = decide("HOME", "1X2", [Evidence("espn-id", "final", (0, 1))], shown_pick="AWAY")
    assert d["result"] is None

# ── #CALCIO-1001 review D: never a silent partial write, b1 superseded ──────

class _FakeConn:
    def __init__(self, rowcounts):
        self.rowcounts, self.committed, self.rolled_back = list(rowcounts), False, False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *_):
        self.committed, self.rolled_back = exc_type is None, exc_type is not None
        return False

    def cursor(self):
        conn = self

        class _Cur:
            rowcount = 0

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def execute(self, *_):
                self.rowcount = conn.rowcounts.pop(0)
        return _Cur()


def _apply_with(monkeypatch, rowcounts):
    import sys
    import types

    from scripts import recupera_calcio_1001 as rc
    conn = _FakeConn(rowcounts)
    monkeypatch.setitem(sys.modules, "psycopg2", types.SimpleNamespace(connect=lambda *a, **k: conn))
    monkeypatch.setattr("tools.control_center.db._dsn", lambda: "postgresql://x")
    rows = [settlement_row(f"espn:{i}", 1, decide("HOME", "1X2", [Evidence("espn-id", "final", (1, 0))]))
            for i in range(len(rowcounts))]
    return rc, conn, rows


def test_apply_aborts_the_whole_batch_when_a_row_already_exists(monkeypatch):
    # e.g. b1 of backfill_settle_1001 wrote the same (pick, revision) first
    import pytest

    rc, conn, rows = _apply_with(monkeypatch, [1, 0, 1])
    with pytest.raises(RuntimeError, match="only 2 of 3"):
        rc._apply(rows)
    assert conn.rolled_back and not conn.committed


def test_apply_commits_when_every_row_is_written(monkeypatch):
    rc, conn, rows = _apply_with(monkeypatch, [1, 1])
    assert rc._apply(rows) == 2 and conn.committed


def test_b1_football_is_superseded_by_this_script():
    import json

    from scripts.backfill_settle_1001 import build
    n = json.dumps({"final_score": "2-1"})
    rows, stats = build([("match_predictions", "e1", "v", "won", "verified", n)], [])
    assert rows == [] and stats == {"b1:superseded": 1}


# ── REGOLA 3: same match played on another date (symmetric to tennis) ───────

def _moved(hours, kind="final", status="STATUS_FULL_TIME", home="Puebla", away="Toluca"):
    return {"kind": kind, "score": (1, 0) if kind == "final" else None, "status": status,
            "kickoff": T0 + timedelta(hours=hours), "home": home, "away": away}


def test_rule3_played_within_48h_is_graded_on_the_played_match():
    from scripts.recupera_calcio_1001 import id_evidence
    e = id_evidence("espn-id", _moved(30), "Puebla", "Toluca", T0)
    assert (e.kind, e.score, e.rule) == ("final", (1, 0), "regola3-entro-48h")


def test_rule3_beyond_48h_is_void_with_the_date_as_proof():
    from scripts.recupera_calcio_1001 import id_evidence
    e = id_evidence("espn-id", _moved(24 * 20), "Puebla", "Toluca", T0)
    assert e.kind == "void" and e.status == f"rinviata-oltre-48h:{(T0 + timedelta(days=20)).date()}"
    assert e.rule == "regola3-oltre-48h"
    d = decide("HOME", "1X2", [e])
    row = settlement_row("espn:1", 1, d)
    assert row["result"] == "void" and "rinviata-oltre-48h:" in row["correction_reason"]


def test_rule3_within_48h_but_extra_time_is_not_graded():
    from scripts.recupera_calcio_1001 import id_evidence
    e = id_evidence("espn-id", _moved(30, kind="supplementari", status="STATUS_FINAL_AET"), "Puebla", "Toluca", T0)
    assert decide("HOME", "1X2", [e])["result"] is None


def test_rule3_moved_event_needs_a_strong_identity():
    from scripts.recupera_calcio_1001 import id_evidence
    e = id_evidence("espn-id", _moved(30, home="Puebla", away="Toluca B"), "Puebla", "Club Leon", T0)
    assert e.kind == "debole"


# ── REGOLA 4: grade the SHOWN pick ───────────────────────────────────────────

def test_rule4a_shown_without_sealed_is_graded_and_tagged_unsealed():
    d = decide(None, "1X2", [Evidence("servita", "final", (2, 0))], shown_pick="HOME")
    assert d["result"] == "won" and d["pick_case"] == "4a"
    assert "non-sigillata" in settlement_row("x", None, d)["correction_reason"]


def test_rule4b_sealed_without_shown_is_void():
    d = decide("HOME", "1X2", [Evidence("espn-id", "final", (2, 0))], shown_pick=None)
    assert d["result"] == "void" and d["pick_case"] == "4b"
    assert "nessuna-pick-mostrata" in settlement_row("x", 1, d)["correction_reason"]


def test_rule4c_opposite_picks_are_never_written():
    for score in ((0, 1), (1, 1)):  # even when both picks would grade alike
        d = decide("HOME", "1X2", [Evidence("espn-id", "final", score)], shown_pick="AWAY")
        assert d["result"] is None and d["motivo"].startswith("conflitto-sigillato-mostrato")
