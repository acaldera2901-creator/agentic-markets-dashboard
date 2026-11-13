import pytest
from core.published_result_recovery import resolve_published_batch

@pytest.mark.asyncio
async def test_recovery_grades_published_pick_and_keeps_real_source():
    rows = [dict(id='a', source_id='old', player1='A', player2='B', pick='B',
                 scheduled_at=None, tournament='ATP', notes='{}')]
    # resolver is already the date/completion/set gate from the live agent.
    async def resolve(ps): return [(ps[0], 'P2', '6-4 6-4', 'betconstruct')]
    plans = await resolve_published_batch(rows, resolve)
    assert plans[0]['result'] == 'won'
    assert plans[0]['winner'] == 'B'
    assert plans[0]['verification_source'] == 'betconstruct'
    assert plans[0]['expected_pick'] == 'B'

@pytest.mark.asyncio
async def test_no_result_or_unknown_pick_never_becomes_a_loss():
    row = dict(id='a', source_id='old', player1='A', player2='B', pick='C', scheduled_at=None, notes='{}')
    async def missing(ps): return []
    async def resolved(ps): return [(ps[0], 'P1', '6-4 6-4', 'betconstruct')]
    assert await resolve_published_batch([row], missing) == []
    assert await resolve_published_batch([row], resolved) == []

@pytest.mark.asyncio
async def test_one_failed_write_does_not_starve_other_results(monkeypatch):
    import logging
    from unittest.mock import AsyncMock
    from agents.tennis_settlement import TennisSettlementAgent
    from core import published_result_recovery as recovery
    agent = object.__new__(TennisSettlementAgent)
    agent.logger = logging.getLogger('test')
    agent._recovery_cursor = 'previous'
    monkeypatch.setattr(recovery, 'read_published_batch', AsyncMock(return_value=[{'id':'last'}]))
    monkeypatch.setattr(recovery, 'resolve_published_batch', AsyncMock(return_value=[{'id':'bad'}, {'id':'good'}]))
    apply = AsyncMock(side_effect=[RuntimeError('write unavailable'),True])
    monkeypatch.setattr(recovery, 'apply_recovered_result', apply)
    await agent._recover_published()
    assert apply.await_count == 2
    assert agent._recovery_cursor is None

@pytest.mark.asyncio
async def test_read_failure_retries_same_page(monkeypatch):
    import logging
    from unittest.mock import AsyncMock
    from agents.tennis_settlement import TennisSettlementAgent
    from core import published_result_recovery as recovery
    agent = object.__new__(TennisSettlementAgent)
    agent.logger = logging.getLogger('test')
    agent._recovery_cursor = 'previous'
    monkeypatch.setattr(recovery, 'read_published_batch', AsyncMock(side_effect=RuntimeError('db unavailable')))
    await agent._recover_published()
    assert agent._recovery_cursor == 'previous'

@pytest.mark.asyncio
async def test_recovery_write_has_a_deadline(monkeypatch):
    import asyncio
    from core import published_result_recovery as recovery
    async def stalled(plan):
        await asyncio.sleep(10)
    monkeypatch.setattr(recovery, '_apply_recovered_result', stalled, raising=False)
    monkeypatch.setattr(recovery, 'WRITE_TIMEOUT_SECONDS', 0.01, raising=False)
    with pytest.raises(TimeoutError):
        await recovery.apply_recovered_result({'id':'irrelevant'})

@pytest.mark.asyncio
async def test_recovery_continues_while_normal_settlement_is_blocked():
    import asyncio, logging
    from agents.tennis_settlement import TennisSettlementAgent
    agent = object.__new__(TennisSettlementAgent)
    agent.logger = logging.getLogger('test')
    agent._running = True
    recovered = asyncio.Event()
    async def slow_cycle(): await asyncio.Event().wait()
    async def recover(): recovered.set()
    agent._settlement_cycle = slow_cycle
    agent._recover_published = recover
    task = asyncio.create_task(agent._main_loop())
    try:
        await asyncio.wait_for(recovered.wait(), timeout=0.1)
    finally:
        task.cancel()
        with pytest.raises(asyncio.CancelledError): await task
