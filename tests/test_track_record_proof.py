"""#TRACKREC-PROOF-1 — TDD for the append-only pick ledger + deterministic runner.

Two layers:

  * Pure / fixture tests (always run): the runner recomputes Brier/ECE/accuracy/
    CLV/ROI deterministically from CSV fixtures, with no DB and no network.

  * DB constraint tests (run only when PICK_LEDGER_TEST_DSN points at a LOCAL or
    throwaway Postgres): the look-ahead CHECK, the dedup UNIQUE, and the
    UPDATE/DELETE immutability are enforced by Postgres itself, so they can only
    be verified against a real database. They SKIP when the DSN is unset — they
    must NEVER run against the production project. Apply the migration
    supabase/migrations/20260612000000_pick_ledger.sql to that test DB first.
"""
from __future__ import annotations

import csv
import os
from pathlib import Path

import pytest

from scripts.track_record_proof import (
    compute,
    load_ledger,
    load_settlements,
)

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "supabase" / "migrations" / "20260612000000_pick_ledger.sql"
)
TEST_DSN = os.environ.get("PICK_LEDGER_TEST_DSN")
requires_db = pytest.mark.skipif(
    not TEST_DSN,
    reason="set PICK_LEDGER_TEST_DSN to a LOCAL/throwaway Postgres to run DB constraint tests",
)


# ─── fixtures ──────────────────────────────────────────────────────────────────

LEDGER_ROWS = [
    # football DC pick that WINS (HOME, realized HOME), odds beat the close
    dict(source_table="dixon_coles_predictions", source_id="m1",
         model_version="football-dixoncoles-v1", sport="football",
         pick="HOME", p_home="0.55", p_draw="0.25", p_away="0.20",
         confidence="0.55", odds="2.10"),
    # football DC pick that LOSES (AWAY pick, realized HOME)
    dict(source_table="dixon_coles_predictions", source_id="m2",
         model_version="football-dixoncoles-v1", sport="football",
         pick="AWAY", p_home="0.30", p_draw="0.25", p_away="0.45",
         confidence="0.45", odds="2.50"),
    # SAME match as m1 but the xG model -> must coexist (different model_version)
    dict(source_table="xg_predictions", source_id="m1",
         model_version="football-xg-v1", sport="football",
         pick="HOME", p_home="0.60", p_draw="0.22", p_away="0.18",
         confidence="0.60", odds="2.05"),
    # voided pick -> excluded from accuracy & ROI
    dict(source_table="dixon_coles_predictions", source_id="m3",
         model_version="football-dixoncoles-v1", sport="football",
         pick="DRAW", p_home="0.30", p_draw="0.40", p_away="0.30",
         confidence="0.40", odds="3.30"),
]

SETTLEMENT_ROWS = [
    dict(source_table="dixon_coles_predictions", source_id="m1",
         model_version="football-dixoncoles-v1", result="won",
         outcome="HOME", closing_odds="1.95", settled_at="2026-06-10T20:00:00Z"),
    dict(source_table="dixon_coles_predictions", source_id="m2",
         model_version="football-dixoncoles-v1", result="lost",
         outcome="HOME", closing_odds="2.60", settled_at="2026-06-10T20:00:00Z"),
    dict(source_table="xg_predictions", source_id="m1",
         model_version="football-xg-v1", result="won",
         outcome="HOME", closing_odds="2.00", settled_at="2026-06-10T20:00:00Z"),
    dict(source_table="dixon_coles_predictions", source_id="m3",
         model_version="football-dixoncoles-v1", result="void",
         outcome="", closing_odds="", settled_at="2026-06-10T20:00:00Z"),
]


def _write_csv(path: Path, rows: list[dict]) -> None:
    cols = sorted({k for r in rows for k in r})
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow(r)


@pytest.fixture()
def ledger_csv(tmp_path) -> Path:
    p = tmp_path / "pick_ledger.csv"
    _write_csv(p, LEDGER_ROWS)
    return p


@pytest.fixture()
def settlement_csv(tmp_path) -> Path:
    p = tmp_path / "pick_settlement.csv"
    _write_csv(p, SETTLEMENT_ROWS)
    return p


# ─── (5) runner on known fixtures ───────────────────────────────────────────────

def test_runner_recomputes_known_metrics(ledger_csv, settlement_csv):
    picks = load_ledger(ledger_csv)
    settlements = load_settlements(settlement_csv)
    m = compute(picks, settlements)

    assert m["n_picks"] == 4
    assert m["n_void"] == 1
    # counted = 3 decided (m1 DC won, m2 DC lost, m1 xG won); m3 void excluded
    assert m["n_settled_counted"] == 3
    # accuracy = 2 wins / 3 decided
    assert abs(m["accuracy"] - (2 / 3)) < 1e-9
    # CLV: m1 odds 2.10 vs close 1.95 -> beat; m2 2.50 vs 2.60 -> not; m1xG 2.05 vs 2.00 -> beat
    assert m["clv_n"] == 3
    assert abs(m["clv_beat_pct"] - (2 / 3 * 100)) < 1e-9


def test_runner_is_deterministic(ledger_csv, settlement_csv):
    a = compute(load_ledger(ledger_csv), load_settlements(settlement_csv))
    b = compute(load_ledger(ledger_csv), load_settlements(settlement_csv))
    assert a == b


# ─── (4) xG + DC coexistence ─────────────────────────────────────────────────────

def test_xg_and_dc_predictions_for_same_match_coexist(ledger_csv):
    picks = load_ledger(ledger_csv)
    dc = picks[("dixon_coles_predictions", "m1", "football-dixoncoles-v1")]
    xg = picks[("xg_predictions", "m1", "football-xg-v1")]
    # same underlying match (source_id="m1") -> two distinct ledger keys, no clobber
    assert dc.source_id == xg.source_id == "m1"
    assert dc.model_version != xg.model_version
    assert (dc.source_table, dc.source_id, dc.model_version) != (
        xg.source_table, xg.source_id, xg.model_version
    )


def test_first_settlement_wins(tmp_path):
    """Export SENZA `settlement_revision`: vince la PRIMA riga.

    #SETTLEMENT-DEDUP-0801 aveva portato la regola da «l'ultimo per settled_at»
    a «il primo», perche' con la UNIQUE a 3 colonne e l'ON CONFLICT DO NOTHING
    una seconda riga non poteva piu' nascere.

    Dal 10/09 (#SETTLE-0909 fase 2) vince la revisione piu' alta — ma un export
    vecchio non ha quella colonna, quindi tutte le righe valgono revisione 1 e
    «la piu' alta» ricade su «la prima». Questo test difende esattamente quella
    retro-compatibilita': un export di ieri deve dare il numero di ieri.

    Il caso qui sotto e' quello reale che motivo' il cambio del 01/08: un `void`
    scritto DOPO un `lost` reale dal secondo scrittore. Con «l'ultimo vince»
    quel pick veniva letto come void, cioe' spariva dal conteggio.
    """
    rows = [
        dict(source_table="t", source_id="x", model_version="v",
             result="lost", outcome="HOME", closing_odds="2.0",
             settled_at="2026-06-10T20:00:00Z"),
        dict(source_table="t", source_id="x", model_version="v",
             result="void", outcome="HOME", closing_odds="2.0",
             settled_at="2026-06-11T09:00:00Z"),  # il void spurio del 2o scrittore
    ]
    p = tmp_path / "s.csv"
    _write_csv(p, rows)
    s = load_settlements(p)
    assert s[("t", "x", "v")].result == "lost"
    # il doppione va CONTATO, non ignorato in silenzio: su un libro mastro
    # l'esistenza di una riga in piu' e' essa stessa un'informazione.
    assert getattr(load_settlements, "duplicates", 0) == 1


def test_vince_la_revisione_piu_alta(tmp_path):
    """
    #SETTLE-0909 fase 2 — una CORREZIONE tracciata deve vincere sull'originale.

    Il difetto che questo chiude: fino al 09/09 correggere un settlement era
    IMPOSSIBILE (la UNIQUE a 3 colonne rifiutava la seconda riga), e cosi' 72
    esiti sbagliati sono restati pubblicati. Ora la correzione e' una riga nuova
    con revision+1, e chi legge deve prendere quella — altrimenti la correzione
    esiste nel database e non nel numero pubblicato, che e' il peggiore dei due
    mondi.

    L'ordine delle righe nell'export non deve contare: qui la revisione alta
    arriva PRIMA di quella bassa, di proposito.
    """
    rows = [
        dict(source_table="t", source_id="x", model_version="v",
             result="won", outcome="HOME", closing_odds="2.0",
             settled_at="2026-09-10T09:00:00Z", settlement_revision="2"),
        dict(source_table="t", source_id="x", model_version="v",
             result="void", outcome=None, closing_odds="2.0",
             settled_at="2026-06-11T09:00:00Z", settlement_revision="1"),
    ]
    p = tmp_path / "s.csv"
    _write_csv(p, rows)
    s = load_settlements(p)
    assert s[("t", "x", "v")].result == "won", "la revisione 2 deve vincere"
    assert getattr(load_settlements, "duplicates", 0) == 1


def test_la_revisione_bassa_non_sovrascrive_quella_alta(tmp_path):
    """Lo stesso caso con l'ordine inverso: il risultato non cambia."""
    rows = [
        dict(source_table="t", source_id="x", model_version="v",
             result="void", outcome=None, closing_odds="2.0",
             settled_at="2026-06-11T09:00:00Z", settlement_revision="1"),
        dict(source_table="t", source_id="x", model_version="v",
             result="lost", outcome="AWAY", closing_odds="2.0",
             settled_at="2026-09-10T09:00:00Z", settlement_revision="3"),
    ]
    p = tmp_path / "s.csv"
    _write_csv(p, rows)
    s = load_settlements(p)
    assert s[("t", "x", "v")].result == "lost"


def test_no_duplicates_no_warning(tmp_path):
    rows = [
        dict(source_table="t", source_id="x", model_version="v",
             result="won", outcome="AWAY", closing_odds="2.0",
             settled_at="2026-06-10T20:00:00Z"),
    ]
    p = tmp_path / "s.csv"
    _write_csv(p, rows)
    load_settlements(p)
    assert getattr(load_settlements, "duplicates", 0) == 0


# ─── (1) look-ahead CHECK — DB ───────────────────────────────────────────────────

def _connect():
    import psycopg2  # noqa: PLC0415
    return psycopg2.connect(TEST_DSN)


@requires_db
def test_lookahead_check_rejects_pick_at_or_after_kickoff():
    import psycopg2  # noqa: PLC0415
    conn = _connect()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            with pytest.raises(psycopg2.errors.CheckViolation):
                cur.execute(
                    """INSERT INTO pick_ledger
                       (source_table, source_id, model_version, sport, market,
                        commence_time, captured_at)
                       VALUES ('t','la1','v','football','1X2',
                               '2026-06-10T18:00:00Z','2026-06-10T18:00:01Z')"""
                )
    finally:
        conn.rollback()
        conn.close()


# ─── (2) dedup UNIQUE — DB ────────────────────────────────────────────────────────

@requires_db
def test_dedup_unique_rejects_second_pick_same_key():
    import psycopg2  # noqa: PLC0415
    conn = _connect()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            ins = """INSERT INTO pick_ledger
                     (source_table, source_id, model_version, sport, market,
                      commence_time, captured_at)
                     VALUES ('t','dup1','v','football','1X2',
                             '2026-06-10T18:00:00Z','2026-06-10T17:00:00Z')"""
            cur.execute(ins)
            with pytest.raises(psycopg2.errors.UniqueViolation):
                cur.execute(ins)
    finally:
        conn.rollback()
        conn.close()


# ─── (3) immutability: UPDATE/DELETE denied — DB ──────────────────────────────────

@requires_db
def test_update_and_delete_are_revoked_on_ledger():
    import psycopg2  # noqa: PLC0415
    conn = _connect()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO pick_ledger
                   (source_table, source_id, model_version, sport, market,
                    commence_time, captured_at)
                   VALUES ('t','imm1','v','football','1X2',
                           '2026-06-10T18:00:00Z','2026-06-10T17:00:00Z')"""
            )
            conn.commit()
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("UPDATE pick_ledger SET pick='AWAY' WHERE source_id='imm1'")
        conn.rollback()
        with conn.cursor() as cur:
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("DELETE FROM pick_ledger WHERE source_id='imm1'")
    finally:
        conn.rollback()
        conn.close()
