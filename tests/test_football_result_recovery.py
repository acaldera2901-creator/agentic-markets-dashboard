from datetime import datetime,timezone,timedelta
from core.football_result_recovery import plan_result
D=datetime(2026,6,7,16,30,tzinfo=timezone.utc)
R=dict(id='a',home_team='Denmark',away_team='Ukraine',starts_at=D,external_event_id='espn:123',market='1X2',pick='HOME',result='void',verification_state='unverified')
E=dict(id='123',home='Denmark',away='Ukraine',kickoff=D,kind='final',status='STATUS_FULL_TIME',score=(2,1))
def test_final_corrects_old_suspended_void():
    p=plan_result(R,E);assert p['result']=='won';assert p['final_score']=='2-1'
def test_postponed_same_event_over_48h_is_void():
    p=plan_result(R,{**E,'kickoff':D+timedelta(days=3)});assert p['result']=='void';assert p['final_score'] is None

def test_other_event_on_different_day_and_wrong_opponent_rejected():
    assert plan_result(R,{**E,'id':'456','kickoff':D+timedelta(days=3)}) is None
    assert plan_result(R,{**E,'away':'France'}) is None

def test_no_extra_time_or_conflicting_existing_win():
    assert plan_result(R,{**E,'kind':'supplementari'}) is None
    assert plan_result({**R,'result':'lost'},E) is None

def test_cancelled_source_has_no_fabricated_score():
    p=plan_result(R,{**E,'kind':'void','status':'STATUS_CANCELED'});assert p['result']=='void';assert p['final_score'] is None

import asyncio
import logging
import pytest
from agents.result_settlement import ResultSettlementAgent

@pytest.mark.asyncio
async def test_recovery_runs_when_live_settlement_is_blocked(monkeypatch):
    from core import football_result_recovery as recovery
    agent=object.__new__(ResultSettlementAgent);agent._running=True;agent.logger=logging.getLogger('test')
    done=asyncio.Event()
    async def stalled():await asyncio.Event().wait()
    async def recovered(cursor):done.set();return None,0
    agent._live_loop=stalled
    monkeypatch.setattr(recovery,'recover_batch',recovered)
    task=asyncio.create_task(agent._main_loop())
    try:await asyncio.wait_for(done.wait(),0.2)
    finally:
        task.cancel()
        with pytest.raises(asyncio.CancelledError):await task
