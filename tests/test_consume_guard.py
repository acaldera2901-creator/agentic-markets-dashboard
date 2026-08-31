"""#CONSUME-GUARD-0830 — uno stallo del loop non deve piu' uccidere un agente.

Misurato in prod da Andrea dopo #REDIS-TIMEOUT-0830: il socket_timeout ha fatto
il suo lavoro, ma ha scoperto un secondo problema che prima restava nascosto —
il NOSTRO event loop stalla oltre 10s sul fit CPU-sincrono del ModelAgent, e
tutte le letture in volo scadono insieme. Senza guardia su `consume()` quelle
eccezioni uccidevano piu' agenti a cascata (83 timeout, 82 in consume()).

Invarianti asseriti qui:
  1. un tick che scade non propaga: torna [] e l'agente vive;
  2. si ritenta davvero prima di cedere (CONSUME_RETRIES), e un ritentativo
     riuscito serve le entry;
  3. primo fallimento WARNING, ripetizioni DEBUG (niente flood);
  4. la ripresa si annuncia una volta e azzera il contatore;
  5. i contatori sono PER CONSUMATORE, non globali;
  6. CancelledError e gli errori di programmazione continuano a propagare;
  7. il percorso sano e' invariato e muto.
"""
import asyncio
import logging

import pytest
import redis.exceptions

import core.redis_client as rc


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    # raising=False di proposito: senza, su un codice privo della guardia i test
    # morirebbero in SETUP (attributo assente) invece di fallire sul COMPORTAMENTO,
    # e la prova di rottura non proverebbe niente.
    monkeypatch.setattr(rc, "_consume_failures", {}, raising=False)
    yield


class _FakeRedis:
    """xreadgroup pilotabile: una sequenza di esiti, uno per chiamata."""

    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0
        self.kwargs = []

    async def xgroup_create(self, *_a, **_k):
        return True

    async def xreadgroup(self, *_a, **kwargs):
        self.calls += 1
        self.kwargs.append(kwargs)
        outcome = self.outcomes.pop(0) if self.outcomes else []
        # BaseException, non Exception: CancelledError non e' una Exception
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


def _install(monkeypatch, fake):
    monkeypatch.setattr(rc, "_client", fake)


_TIMEOUT = redis.exceptions.TimeoutError("Timeout reading from localhost:6379")


async def test_a_timed_out_tick_returns_empty_instead_of_killing_the_agent(monkeypatch, caplog):
    """1 — questo e' il crash che ha fatto la cascata in prod."""
    fake = _FakeRedis([_TIMEOUT, _TIMEOUT])
    _install(monkeypatch, fake)

    out = await rc.consume("market:data", "g", "c1")

    assert out == []
    assert fake.calls == rc.CONSUME_RETRIES + 1, "non ha usato tutto il budget di tentativi"


async def test_a_retry_that_succeeds_serves_the_entries(monkeypatch):
    """2 — 'retry' deve voler dire ritentare, non solo non morire."""
    fake = _FakeRedis([_TIMEOUT, [("market:data", [("1-1", {"payload": "x"})])]])
    _install(monkeypatch, fake)

    out = await rc.consume("market:data", "g", "c1")

    assert out and out[0][0] == "market:data"
    assert fake.calls == 2


async def test_first_failure_warns_and_the_repeats_do_not(monkeypatch, caplog):
    """3 — un Redis lento non deve allagare il log a ogni tick."""
    with caplog.at_level(logging.DEBUG, logger=rc.logger.name):
        for _ in range(4):
            _install(monkeypatch, _FakeRedis([_TIMEOUT, _TIMEOUT]))
            await rc.consume("market:data", "g", "c1")

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    debugs = [r for r in caplog.records if r.levelno == logging.DEBUG]
    assert len(warnings) == 1
    assert len(debugs) == 3, "le ripetizioni vanno registrate, ma a DEBUG"
    assert "pending" in warnings[0].getMessage(), "il WARNING deve dire che non si perdono messaggi"


async def test_recovery_is_announced_once_and_resets(monkeypatch, caplog):
    """4 — 'e' tornato' deve essere visibile quanto 'e' caduto'."""
    _install(monkeypatch, _FakeRedis([_TIMEOUT, _TIMEOUT]))
    await rc.consume("market:data", "g", "c1")

    with caplog.at_level(logging.INFO, logger=rc.logger.name):
        _install(monkeypatch, _FakeRedis([[]]))
        await rc.consume("market:data", "g", "c1")
        _install(monkeypatch, _FakeRedis([[]]))
        await rc.consume("market:data", "g", "c1")

    recovered = [r for r in caplog.records if "recovered" in r.getMessage()]
    assert len(recovered) == 1
    assert "1 failed tick(s)" in recovered[0].getMessage()
    assert rc._consume_failures == {}


async def test_counters_are_per_consumer(monkeypatch, caplog):
    """5 — due agenti che falliscono non devono zittirsi il WARNING a vicenda."""
    with caplog.at_level(logging.WARNING, logger=rc.logger.name):
        for consumer in ("ModelAgent", "TraderAgent"):
            _install(monkeypatch, _FakeRedis([_TIMEOUT, _TIMEOUT]))
            await rc.consume("market:data", "g", consumer)

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 2, "un contatore globale avrebbe zittito il secondo agente"
    assert set(rc._consume_failures) == {"market:data:g:ModelAgent", "market:data:g:TraderAgent"}


async def test_cancellation_and_real_bugs_still_propagate(monkeypatch):
    """6 — la guardia deve essere stretta: RedisError, non Exception."""
    _install(monkeypatch, _FakeRedis([asyncio.CancelledError()]))
    with pytest.raises(asyncio.CancelledError):
        await rc.consume("market:data", "g", "c1")

    _install(monkeypatch, _FakeRedis([TypeError("bug vero nel chiamante")]))
    with pytest.raises(TypeError):
        await rc.consume("market:data", "g", "c1")


async def test_healthy_path_unchanged_and_silent(monkeypatch, caplog):
    """7 — una lettura sana: una sola chiamata, parametri intatti, zero log."""
    fake = _FakeRedis([[("market:data", [("1-1", {"payload": "x"})])]])
    _install(monkeypatch, fake)

    with caplog.at_level(logging.DEBUG, logger=rc.logger.name):
        out = await rc.consume("market:data", "grp", "c1", count=7)

    assert fake.calls == 1
    assert out[0][0] == "market:data"
    assert fake.kwargs[0]["count"] == 7
    assert fake.kwargs[0]["block"] == rc.STREAM_BLOCK_MS
    assert caplog.records == []
