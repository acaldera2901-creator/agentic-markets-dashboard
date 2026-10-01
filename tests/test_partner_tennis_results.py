"""#RISULTATI-PARTNER-1001 — partner-feed results close picks only when the
source states the winner, through the SAME gates as the ESPN archive.

The record shapes below are copied from the live feed (01/10, match_status=3):
normal finish, retirement (open set), walkover/cancelled (no periods), a
trailing 0-0 placeholder and the doubles super tie-break written as 1-0.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest

from agents.tennis_settlement import TennisSettlementAgent
from core.partner_tennis_results import result_from_partner_match
from core.tennis_set_validation import settlement_allowed


def _m(periods, total, *, status=3, tournament="ATP Challenger Bari - Clay",
       home="Kai Wehnelt", away="Pierluigi Basile", start="2026-09-27T09:10:00Z"):
    return {
        "id": 123, "status": status, "start_time": start,
        "competitors": {"home": {"name": home}, "away": {"name": away}},
        "tournament": {"name": tournament},
        "statistics": {
            "total_score": {"home": total[0], "away": total[1]},
            "period_score": None if periods is None else [{"home": h, "away": a} for h, a in periods],
        },
    }


def _gate(r):
    return settlement_allowed(
        r["score_text"], tournament=r["tournament"], gender=r["gender"],
        status_name=r["status_name"], source_completed=r["source_completed"],
        match_tiebreak=r["match_tiebreak"],
    )


def test_away_win_score_is_written_from_the_winner_side():
    r = result_from_partner_match(_m([(7, 5), (4, 6), (6, 7)], (1, 2)))
    assert r["winner_name"] == "Pierluigi Basile"
    assert r["score_text"] == "5-7 6-4 7-6"
    assert r["event_date"] == datetime(2026, 9, 27, 9, 10, tzinfo=timezone.utc)
    assert _gate(r) == (True, "bo3-concluso")


def test_trailing_zero_zero_placeholder_is_dropped():
    r = result_from_partner_match(_m([(1, 6), (4, 6), (0, 0)], (0, 2)))
    assert r["score_text"] == "6-1 6-4"
    assert _gate(r)[0] is True


def test_retirement_open_set_is_refused_by_the_gate():
    # live shape: WTT Shenyang, 0-6 0-0, total 0-1, stage "Set 2"
    r = result_from_partner_match(_m([(0, 6), (0, 0)], (0, 1)))
    assert r is not None
    assert _gate(r)[0] is False


def test_total_not_backed_by_periods_gives_no_result():
    # live shape: 1-6 0-4 with total 0-1 -> snapshot mid-match
    assert result_from_partner_match(_m([(1, 6), (0, 4)], (0, 1))) is None


@pytest.mark.parametrize("periods,total", [(None, (0, 0)), ([], (0, 0)), ([(6, 4), (4, 6)], (1, 1))])
def test_no_explicit_winner_gives_no_result(periods, total):
    assert result_from_partner_match(_m(periods, total)) is None


def test_status_other_than_finished_is_ignored():
    assert result_from_partner_match(_m([(6, 4), (6, 4)], (2, 0), status=2)) is None


def test_doubles_super_tiebreak_passes_only_as_declared():
    r = result_from_partner_match(_m([(6, 4), (1, 6), (1, 0)], (2, 1),
                                     tournament="ATP Challenger Plovdiv - Clay (Doubles)",
                                     home="A/B", away="C/D"))
    assert r["match_tiebreak"] is True
    assert _gate(r) == (True, "bo3-super-tiebreak-concluso")
    # the same 1-0 in singles is a partial score, not a format
    s = result_from_partner_match(_m([(6, 4), (1, 6), (1, 0)], (2, 1)))
    assert s["match_tiebreak"] is False
    assert _gate(s)[0] is False


def test_super_tiebreak_flag_never_rescues_a_malformed_score():
    assert settlement_allowed("6-4 6-3 1-0", source_completed=True, match_tiebreak=True)[0] is False
    assert settlement_allowed("6-4 3-2 1-0", source_completed=True, match_tiebreak=True)[0] is False
    assert settlement_allowed("6-4 4-6 0-1", source_completed=True, match_tiebreak=True)[0] is False
    assert settlement_allowed("6-4 4-6 1-0", source_completed=False, match_tiebreak=True)[0] is False


# ── agent wiring ──────────────────────────────────────────────────────────

class _Pred:
    def __init__(self, pid, p1="Kai Wehnelt", p2="Pierluigi Basile",
                 when=datetime(2026, 9, 27, 9, 10)):
        self.id = pid
        self.match_id = f"tennis:partner:{pid}"
        self.player1, self.player2 = p1, p2
        self.scheduled_at = when
        self.tournament = "Partner feed"
        self.surface = "hard"


class _Log:
    def info(self, *a, **k): pass
    def warning(self, *a, **k): pass


def _agent():
    a = object.__new__(TennisSettlementAgent)
    a.logger = _Log()
    return a


def test_partner_is_asked_only_for_what_espn_left_open():
    a = _agent()
    seen = {}

    async def _mb(p): return []
    async def _espn(p): return [(p[0], "P1", "6-4 6-4")]
    async def _partner(p):
        seen["partner"] = [x.id for x in p]
        return [(x, "P2", "6-1 6-1") for x in p]

    a._resolve_via_matchbook, a._resolve_via_espn, a._resolve_via_partner = _mb, _espn, _partner
    out = asyncio.run(a._resolve_all([_Pred(1), _Pred(2)]))
    assert seen["partner"] == [2]
    assert [(e[0].id, e[3]) for e in out] == [(1, "espn"), (2, "betconstruct")]


def test_partner_results_go_through_the_same_ambiguity_gate():
    a = _agent()
    r = result_from_partner_match(_m([(6, 4), (6, 4)], (2, 0)))
    one = a._risolvi_con([_Pred(1)], [r])
    assert [(e[1], e[2]) for e in one] == [("P1", "6-4 6-4")]
    # two candidates in the same window -> not settled
    assert a._risolvi_con([_Pred(1)], [r, dict(r, event_id="bc:999")]) == []
    # same pair two days away -> not this match
    far = result_from_partner_match(_m([(6, 4), (6, 4)], (2, 0), start="2026-09-30T09:10:00Z"))
    assert a._risolvi_con([_Pred(1)], [far]) == []


@pytest.mark.asyncio
async def test_partner_closure_is_stamped_and_does_not_touch_elo(monkeypatch):
    a = _agent()
    elo_calls = []

    class _Elo:
        def update(self, *x): elo_calls.append(x)
        async def save_to_db_async(self, *x): pass

    a._elo = _Elo()

    async def _none(*x, **k): return None
    a._update_prediction = a._settle_bets = _none
    calls = []

    async def _settle(mid, winner, **kw):
        calls.append((mid, winner, kw))
        return True

    monkeypatch.setattr("agents.tennis_settlement.settle_unified_tennis", _settle)
    await a._chiudi([(_Pred(1), "P2", "6-1 6-1", "betconstruct")])
    assert elo_calls == []
    assert calls[0][1] == "Pierluigi Basile"
    assert calls[0][2]["verification_source"] == "betconstruct"
    assert calls[0][2]["final_score"] == "6-1 6-1"
