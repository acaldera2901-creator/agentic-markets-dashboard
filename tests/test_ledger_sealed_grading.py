"""#LEDGER-SIGILLATA-1007 — (b) lato Python: la chiusura nel registro sigillato
si grada sulla pick SIGILLATA per le partite del periodo; flag spento = main.

Gemello di lib/ledger-sealed-grading.test.ts e app/api/cron/settle/route.sealed.test.ts.
"""
import csv
import logging
from datetime import datetime, timedelta, timezone

import pytest

import agents.result_settlement as rs
from core.ledger_sealed_grading import (
    _parse_iso,
    grade_sealed_pick,
    in_sealed_cohort,
    ledger_settlement_result,
    sealed_grading_config,
)

ON_ENV = {"LEDGER_SEALED_GRADING": "1", "LEDGER_SEALED_FROM": "2026-10-20T00:00:00Z"}


# ─── regole pure ────────────────────────────────────────────────────────────
def test_config_fail_closed():
    assert not sealed_grading_config({}).enabled
    assert not sealed_grading_config({"LEDGER_SEALED_GRADING": "1"}).enabled
    assert not sealed_grading_config(
        {"LEDGER_SEALED_GRADING": "1", "LEDGER_SEALED_FROM": "domani"}
    ).enabled
    assert sealed_grading_config(ON_ENV).enabled


def test_regole_parita_con_ts():
    on = sealed_grading_config(ON_ENV)
    off = sealed_grading_config({})
    kw = dict(served_result="lost", sealed_pick="HOME", home_goals=2, away_goals=1)
    assert ledger_settlement_result(commence_time="2026-11-01T15:00:00Z", cfg=off, **kw) == "lost"
    assert ledger_settlement_result(commence_time="2026-10-19T23:59:59Z", cfg=on, **kw) == "lost"
    assert ledger_settlement_result(commence_time="2026-10-20T00:00:00Z", cfg=on, **kw) == "won"
    assert (
        ledger_settlement_result(
            commence_time="2026-11-01T15:00:00+00:00",
            cfg=on,
            served_result="void",
            sealed_pick="HOME",
            home_goals=0,
            away_goals=1,
        )
        == "lost"
    )
    assert (
        ledger_settlement_result(
            commence_time="2026-11-01T15:00:00Z",
            cfg=on,
            served_result="lost",
            sealed_pick=None,
            home_goals=2,
            away_goals=1,
        )
        == "lost"
    )
    assert grade_sealed_pick("draw", "DRAW") == "won"
    assert grade_sealed_pick("P1", "HOME") == "void"
    assert not in_sealed_cohort(None, on)


# ─── l'agente ───────────────────────────────────────────────────────────────
def _riga(pick="away"):
    return {
        "id": 4242,
        "external_event_id": "m1",
        "sport": "football",
        "league": "SA",
        "competition": "Serie A",
        "home_team": "Inter",
        "away_team": "Milan",
        "market": "1X2",
        "pick": pick,
        "starts_at": (datetime.now(timezone.utc) - timedelta(hours=9)).isoformat(),
        "world_cup_stage": None,
        "source_id": "m1",
    }


@pytest.fixture
def agente():
    a = rs.ResultSettlementAgent.__new__(rs.ResultSettlementAgent)
    a.logger = logging.getLogger("test_ledger_sealed")
    a._scores_cache = {}
    a.set_status_detail = lambda _d: None
    return a


SIGILLO = (True, {"pick": "HOME", "commence_time": "2026-11-01T15:00:00Z"})


def _monta(monkeypatch, agente, *, riga, sealed=SIGILLO, punteggio=None, abbandonata=False):
    servite, registro, letture = [], [], []

    async def fake_unsettled(cutoff_minutes=115, limit=50):
        return [riga]

    async def fake_settle(row_id, outcome, final_score=None, **_k):
        servite.append((row_id, outcome, final_score))
        return True

    async def fake_record(**kw):
        registro.append(kw)
        return True

    async def fake_sealed(source_id):
        letture.append(source_id)
        return sealed

    async def fake_result(row):
        return punteggio

    async def fake_void(row):
        return abbandonata

    monkeypatch.setattr(rs, "fetch_unsettled_unified_predictions", fake_unsettled)
    monkeypatch.setattr(rs, "settle_unified_prediction", fake_settle)
    monkeypatch.setattr(rs, "record_pick_settlement", fake_record)
    monkeypatch.setattr(rs, "fetch_sealed_football_pick", fake_sealed)
    monkeypatch.setattr(agente, "_fetch_unified_result", fake_result)
    monkeypatch.setattr(agente, "_should_void_abandoned", fake_void)
    return servite, registro, letture


def _accendi(monkeypatch):
    for k, v in ON_ENV.items():
        monkeypatch.setenv(k, v)


@pytest.mark.asyncio
async def test_flag_spento_registro_sull_esito_servito_senza_letture(agente, monkeypatch):
    for k in ON_ENV:
        monkeypatch.delenv(k, raising=False)
    servite, registro, letture = _monta(
        monkeypatch, agente, riga=_riga("away"), punteggio={"home_goals": 2, "away_goals": 1}
    )
    await agente._unified_settlement_cycle()
    assert letture == []
    assert servite == [("4242", "lost", "2-1")]
    assert registro[0]["result"] == "lost"


@pytest.mark.asyncio
async def test_flag_acceso_registro_sulla_sigillata(agente, monkeypatch):
    _accendi(monkeypatch)
    servite, registro, letture = _monta(
        monkeypatch, agente, riga=_riga("away"), punteggio={"home_goals": 2, "away_goals": 1}
    )
    await agente._unified_settlement_cycle()
    assert letture == ["m1"]
    assert servite == [("4242", "lost", "2-1")], "la servita resta gradata sulla sua pick"
    assert registro[0]["result"] == "won", "HOME sigillata, 2-1: vinta"
    assert registro[0]["outcome"] == "HOME"


@pytest.mark.asyncio
async def test_flag_acceso_servita_sparita_non_rende_void_la_sigillata(agente, monkeypatch):
    _accendi(monkeypatch)
    servite, registro, _ = _monta(
        monkeypatch, agente, riga=_riga(None), punteggio={"home_goals": 0, "away_goals": 1}
    )
    await agente._unified_settlement_cycle()
    assert servite == [("4242", "void", "0-1")]
    assert registro[0]["result"] == "lost"


@pytest.mark.asyncio
async def test_flag_acceso_registro_illeggibile_non_chiude_niente(agente, monkeypatch):
    _accendi(monkeypatch)
    servite, registro, _ = _monta(
        monkeypatch,
        agente,
        riga=_riga("away"),
        sealed=(False, None),
        punteggio={"home_goals": 2, "away_goals": 1},
    )
    await agente._unified_settlement_cycle()
    assert servite == [] and registro == []


@pytest.mark.asyncio
async def test_flag_acceso_abbandonata_resta_void(agente, monkeypatch):
    _accendi(monkeypatch)
    _, registro, _ = _monta(
        monkeypatch, agente, riga=_riga("away"), punteggio=None, abbandonata=True
    )
    await agente._unified_settlement_cycle()
    assert registro[0]["result"] == "void" and registro[0]["outcome"] is None


# ─── il runner della prova ──────────────────────────────────────────────────
def _scrivi(tmp_path):
    led = tmp_path / "l.csv"
    st = tmp_path / "s.csv"
    with led.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            ["source_table", "source_id", "model_version", "sport", "pick", "p_home",
             "p_draw", "p_away", "confidence", "odds", "is_backfill", "commence_time"]
        )
        for sid, ct in (("m1", "2026-11-01T15:00:00+00:00"), ("m0", "2026-10-01T15:00:00+00:00")):
            w.writerow(["match_predictions", sid, "v", "football", "HOME", "0.6", "0.2",
                        "0.2", "0.6", "", "false", ct])
    with st.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            ["source_table", "source_id", "model_version", "result", "outcome",
             "final_score", "closing_odds", "settled_at", "settlement_revision"]
        )
        # gradate sulla servita AWAY: «lost» anche se HOME (la sigillata) ha vinto
        for sid in ("m1", "m0"):
            w.writerow(["match_predictions", sid, "v", "lost", "HOME", "2-1", "", "x", "1"])
    return led, st


def test_proof_runner_sealed_from(tmp_path):
    from scripts import track_record_proof as trp

    led, st = _scrivi(tmp_path)
    picks, sett = trp.load_ledger(led), trp.load_settlements(st)
    assert trp.compute(picks, sett)["accuracy"] == 0.0, "senza --sealed-from: come prima"
    m = trp.compute(picks, sett, sealed_from=_parse_iso("2026-10-20T00:00:00Z"))
    assert m["accuracy"] == 0.5, "solo m1 (nel periodo) si ricalcola sulla sigillata"
