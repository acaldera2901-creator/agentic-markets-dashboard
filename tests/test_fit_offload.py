"""#FIT-OFFLOAD-0831 — il fit non deve piu' bloccare l'event loop.

La radice misurata in prod (#CONSUME-GUARD-0830): il singolo event loop resta
bloccato oltre 10s e ogni via Redis in volo scade insieme. Non era Redis: era
che il fit Dixon-Coles girava DENTRO il loop, in una chiamata sincrona da
decine di secondi. I guard per-via (heartbeat, consume) assorbono i sintomi;
questo tolgono la causa.

Il test che conta e' il secondo: mentre il fit gira, un task concorrente deve
continuare a essere servito. E' esattamente la proprieta' che compriamo, ed e'
quella che sul codice vecchio non vale.
"""
import asyncio
import threading
import time

import pytest

import agents.model as model_mod


# ---------------------------------------------------------------------------
# 1. La funzione pura: sta fuori dalla classe, e non serve un'istanza
# ---------------------------------------------------------------------------
def test_the_cpu_work_is_a_free_function_not_a_method():
    """Se dipendesse da `self` non sarebbe sicuro spostarla su un thread."""
    assert callable(model_mod._fit_and_calibration_probs)
    assert not hasattr(model_mod.ModelAgent, "_fit_and_calibration_probs")


def test_fit_and_calibration_probs_returns_model_and_probs(monkeypatch):
    calls = {"fit": 0}

    class _FakeModel:
        def fit(self, training):
            calls["fit"] += 1
            self.trained = training

        def predict(self, home, away):
            return (0.5, 0.3, 0.2)

    monkeypatch.setattr(model_mod, "DixonColesModel", _FakeModel)
    training = [
        {"home_team": f"H{i}", "away_team": f"A{i}", "home_goals": 1, "away_goals": 0}
        for i in range(50)
    ]

    fitted, cal_probs = model_mod._fit_and_calibration_probs(training)

    assert calls["fit"] == 1
    assert fitted.trained is training
    # ultimo 20% = 10 partite, con il minimo a 10
    assert len(cal_probs) == 10
    assert cal_probs[0]["p_home"] == 0.5
    assert cal_probs[0]["home_goals"] == 1


def test_a_prediction_that_raises_is_skipped_not_fatal(monkeypatch):
    class _FakeModel:
        def fit(self, training):
            pass

        def predict(self, home, away):
            if home == "H45":
                raise RuntimeError("squadra mai vista")
            return (0.5, 0.3, 0.2)

    monkeypatch.setattr(model_mod, "DixonColesModel", _FakeModel)
    training = [
        {"home_team": f"H{i}", "away_team": f"A{i}", "home_goals": 1, "away_goals": 0}
        for i in range(50)
    ]

    _fitted, cal_probs = model_mod._fit_and_calibration_probs(training)

    assert len(cal_probs) == 9, "una predict rotta deve saltare la riga, non il fit"


# ---------------------------------------------------------------------------
# 2. IL test che conta: il loop resta servito mentre il fit gira
# ---------------------------------------------------------------------------
async def test_the_event_loop_keeps_being_served_during_the_fit():
    """CPU Python puro in un thread: il loop rallenta, ma NON resta fermo.

    Sul codice vecchio il fit girava inline nella coroutine: fra un await e il
    successivo nessun altro task veniva schedulato, e i battiti concorrenti
    erano ZERO — cioe' esattamente heartbeat scaduti e letture Redis andate in
    timeout tutte insieme.
    """
    BUSY = 0.5  # abbastanza da coprire molti switch interval

    def _busy_fit():
        end = time.perf_counter() + BUSY
        while time.perf_counter() < end:
            pass  # Python puro: il GIL resta preso, come nel fit vero
        return threading.get_ident()

    beats = []

    async def _heartbeat():
        while True:
            beats.append(time.perf_counter())
            await asyncio.sleep(0.02)

    ticker = asyncio.create_task(_heartbeat())
    try:
        worker_thread = await asyncio.to_thread(_busy_fit)
    finally:
        ticker.cancel()

    assert worker_thread != threading.get_ident(), "il fit e' girato sul thread del loop"
    assert len(beats) >= 5, (
        f"solo {len(beats)} battiti in {BUSY}s: il loop e' rimasto affamato"
    )


async def test_inline_cpu_work_would_starve_the_loop_control():
    """Controprova del test sopra: inline, i battiti si fermano davvero.

    Serve a provare che il test precedente misura qualcosa. Se questo passasse
    con molti battiti, il test sopra non starebbe dimostrando niente.
    """
    BUSY = 0.3
    beats = []

    async def _heartbeat():
        while True:
            beats.append(time.perf_counter())
            await asyncio.sleep(0.02)

    ticker = asyncio.create_task(_heartbeat())
    await asyncio.sleep(0.05)  # lascia partire il ticker
    before = len(beats)

    end = time.perf_counter() + BUSY  # CPU inline, come il codice vecchio
    while time.perf_counter() < end:
        pass

    during = len(beats) - before
    ticker.cancel()
    assert during == 0, f"attesi 0 battiti durante il blocco inline, trovati {during}"


# ---------------------------------------------------------------------------
# 3. Il test di regressione vero: _bootstrap_models NON affama piu' il loop
# ---------------------------------------------------------------------------
async def test_bootstrap_models_does_not_starve_the_loop(monkeypatch):
    """Questo esercita il nostro codice, non il meccanismo di asyncio.

    Sul codice vecchio (`model.fit(training)` inline nella coroutine) i battiti
    concorrenti durante il bootstrap sono ZERO. Con l'offload il loop continua a
    essere servito. E' la ragione per cui questa patch esiste.
    """
    BUSY = 0.4
    training = [
        {"home_team": f"H{i}", "away_team": f"A{i}", "home_goals": 1, "away_goals": 0}
        for i in range(30)
    ]

    class _BusyModel:
        def fit(self, _training):
            end = time.perf_counter() + BUSY
            while time.perf_counter() < end:
                pass  # Python puro, come il fit vero

        def predict(self, home, away):
            return (0.5, 0.3, 0.2)

    monkeypatch.setattr(model_mod, "DixonColesModel", _BusyModel)
    monkeypatch.setattr(model_mod, "LEAGUE_IDS", {"PL": 39})
    monkeypatch.setattr(model_mod, "calibrate_from_history", lambda *_a, **_k: None)

    async def _no_persist(*_a, **_k):
        return None

    monkeypatch.setattr(model_mod, "persist_league_profile", _no_persist)

    agent = model_mod.ModelAgent()
    monkeypatch.setattr(agent, "_parse_results", lambda _r: training)
    monkeypatch.setattr(agent._context_svc, "load_league_history", lambda *_a, **_k: None)

    async def _no_history(*_a, **_k):
        return []

    monkeypatch.setattr(agent, "_fetch_history", _no_history)

    beats = []

    async def _heartbeat():
        while True:
            beats.append(time.perf_counter())
            await asyncio.sleep(0.02)

    ticker = asyncio.create_task(_heartbeat())
    await asyncio.sleep(0.05)
    before = len(beats)
    try:
        await agent._bootstrap_models()
    finally:
        ticker.cancel()

    during = len(beats) - before
    assert during >= 5, (
        f"solo {during} battiti durante il bootstrap: il loop e' rimasto affamato "
        "(e' esattamente il difetto che questa patch rimuove)"
    )
    assert "PL" in agent._models, "il bootstrap deve comunque aver prodotto il modello"
