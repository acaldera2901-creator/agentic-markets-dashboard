"""#UNIFIED-1001 — the served row takes the live closure, only on a proved,
agreeing register result, never over an existing outcome."""
import json

from scripts.allinea_unified_1001 import BATCH, plan, plan_row

TS = "2026-10-01T12:00:00+00:00"


def rec(**kw):
    base = {
        "id": "u1", "sport": "tennis", "source_table": "tennis_predictions",
        "source_id": "tennis:p:1", "model_version": "partner-market-v1",
        "pick": "Jannik Sinner", "market": None, "notes": '{"surface": {"below_floor": false}}',
        "result": "unresolved", "status": "settled", "is_historical": True,
        "settled_at": None, "updated_at": None, "verification_state": "unverified",
        "verification_source": None, "verification_at": None, "verification_note": None,
        "published_at": "2026-09-20", "is_demo": False, "starts_at": "2026-09-20",
        "competition": "ATP", "n_key": 1, "s_result": "won", "s_outcome": "Jannik Sinner",
        "s_final_score": "6-4 6-3", "s_reason": "backfill:RISULTATI-PARTNER-1001",
    }
    base.update(kw)
    return base


def test_tennis_won_takes_live_closure_with_stamp():
    new, why = plan_row(rec(), TS)
    assert why == "won"
    assert new["result"] == "won" and new["status"] == "settled" and new["is_historical"] is True
    assert new["settled_at"] == TS and new["verification_state"] == "verified"
    assert new["verification_source"] == "betconstruct" and new["verification_note"] == BATCH
    notes = json.loads(new["notes"])
    assert notes["final_score"] == "6-4 6-3" and notes["surface"] == {"below_floor": False}
    assert notes["settlement_batch"] == BATCH


def test_never_overwrites_an_existing_outcome():
    for r in ("won", "lost", "void"):
        assert plan_row(rec(result=r), TS) == (None, "gia-chiusa")


def test_null_result_is_aligned_too():
    new, _ = plan_row(rec(result=None, is_historical=False), TS)
    assert new["result"] == "won" and new["is_historical"] is True


def test_non_unique_key_is_skipped():
    assert plan_row(rec(n_key=2), TS) == (None, "chiave-non-univoca")


def test_shown_pick_differs_from_sealed_grading_is_skipped():
    # register graded the SEALED pick as won; the SHOWN pick lost -> not written
    new, why = plan_row(rec(pick="Carlos Alcaraz"), TS)
    assert new is None and why == "pick-mostrata-diversa:won->lost"
    # no pick shown: live would write void, the register says won -> not written
    assert plan_row(rec(pick=None), TS)[0] is None


def test_no_proved_result_is_skipped():
    assert plan_row(rec(s_result="unresolved"), TS) == (None, "esito-non-provato")
    assert plan_row(rec(s_outcome=None), TS) == (None, "esito-non-provato")
    foot = rec(sport="football", pick="home", market="1X2", s_final_score=None,
               s_result="won", s_reason="recupero:CALCIO-1001 fonte=espn-id")
    assert plan_row(foot, TS) == (None, "esito-non-provato")


def test_football_graded_on_score_and_source_from_reason():
    foot = rec(sport="football", pick="away", market="1X2", s_final_score="0-2",
               s_result="won", s_outcome="away",
               s_reason="recupero:CALCIO-1001 fonte=espn-data-nomi")
    new, why = plan_row(foot, TS)
    assert why == "won" and new["verification_source"] == "espn-data-nomi"
    assert json.loads(new["notes"])["final_score"] == "0-2"


def test_non_sigillata_written_but_recognizable():
    foot = rec(sport="football", pick="home", market="1X2", s_final_score="1-0",
               s_result="won", s_reason="recupero:CALCIO-1001 fonte=football-data non-sigillata")
    new, why = plan_row(foot, TS)
    assert why == "won non-sigillata"
    assert new["verification_note"] == BATCH + " non-sigillata"
    assert json.loads(new["notes"])["sigillo"] == "non-sigillata"


def test_postponed_void_stays_unstamped_like_live():
    foot = rec(sport="football", pick="home", market="1X2", s_final_score=None, s_result="void",
               s_reason="recupero:CALCIO-1001 fonte=espn-id prova=STATUS_POSTPONED")
    new, why = plan_row(foot, TS)
    assert why == "void" and new["result"] == "void"
    assert new["verification_state"] == "unverified" and new["verification_note"] is None


def test_non_json_notes_are_not_clobbered():
    assert plan_row(rec(notes="free text"), TS) == (None, "notes-non-json")


def test_idempotent_second_run_changes_nothing():
    rows = [rec(), rec(id="u2", result=None)]
    first, _ = plan(rows, TS)
    assert len(first) == 2
    applied = [{**r, **new} for r, new in first]  # the DB after --apply
    second, stats = plan(applied, TS)
    assert second == [] and stats[("tennis", "salta:gia-chiusa")] == 2


# ── _apply / _restore on a fake DB (no psycopg2 connection) ─────────────────
import pytest  # noqa: E402

import scripts.allinea_unified_1001 as mod  # noqa: E402


class FakeDB:
    """Applies the script's UPDATEs to a dict of rows, honouring its WHERE."""

    def __init__(self, rows):
        self.rows = {r["id"]: dict(r) for r in rows}
        self.committed = None

    def connect(self, *_a, **_k):
        self._work = {k: dict(v) for k, v in self.rows.items()}
        return self

    # connection API
    def cursor(self):
        return self

    def commit(self):
        self.rows = self._work
        self.committed = True

    def rollback(self):
        self.committed = False

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *_):
        if self is not None and exc_type is None and self.committed is None:
            self.commit()
        return False

    # cursor API
    def execute(self, sql, p):
        row = self._work.get(p["id"])
        self.rowcount = 0
        if row is None:
            return
        if "result is null or result = 'unresolved'" in sql:
            if row["result"] not in (None, "unresolved") or row["notes"] != p["old_notes"]:
                return
        else:  # restore: still exactly as the batch left it
            if f'"settlement_batch": "{BATCH}"' not in (row["notes"] or "") \
                    or row["updated_at"] != p["batch_ts"]:
                return
        for k in mod.TOUCHED:
            row[k] = p[k]
        self.rowcount = 1


@pytest.fixture
def fake(monkeypatch):
    import psycopg2

    import tools.control_center.db as db

    def make(rows):
        f = FakeDB(rows)
        monkeypatch.setattr(psycopg2, "connect", f.connect)
        monkeypatch.setattr(db, "_dsn", lambda: "fake")
        return f
    return make


def test_apply_rolls_back_when_notes_changed_concurrently(fake):
    r = rec()
    pairs, _ = plan([r], TS)
    db = fake([{**r, "notes": '{"surface": {"below_floor": true}}'}])  # sync changed it
    with pytest.raises(SystemExit, match="ABORT"):
        mod._apply(pairs)
    assert db.committed is False and db.rows["u1"]["result"] == "unresolved"


def test_apply_writes_when_snapshot_matches(fake):
    r = rec()
    pairs, _ = plan([r], TS)
    db = fake([r])
    assert mod._apply(pairs) == 1 and db.rows["u1"]["result"] == "won"


def test_backup_is_per_run_and_never_overwritten(tmp_path, monkeypatch):
    monkeypatch.setattr(mod, "BACKUP_DIR", tmp_path)
    p1 = mod.backup_path("2026-10-01T12:00:00+00:00")
    assert p1.name == "unified_pre_allinea_1001_20261001T120000Z.jsonl"
    assert mod.backup_path("2026-10-01T12:00:01+00:00") != p1
    pairs, _ = plan([rec()], TS)
    mod._backup(pairs, p1)
    assert json.loads(p1.read_text())["result"] == "unresolved"
    with pytest.raises(FileExistsError):
        mod._backup(pairs, p1)


def test_restore_only_rows_untouched_since_the_batch(fake, tmp_path):
    a, b = rec(id="a"), rec(id="b")
    pairs, _ = plan([a, b], TS)
    db = fake([a, b])
    assert mod._apply(pairs) == 2
    db.rows["b"]["updated_at"] = "2026-10-02T08:00:00+00:00"  # live touched it later
    bk = tmp_path / "bk.jsonl"
    mod._backup(pairs, bk)
    fake(list(db.rows.values()))
    import psycopg2
    db2 = psycopg2.connect.__self__
    assert mod._restore(bk) == 1
    assert db2.rows["a"]["result"] == "unresolved" and db2.rows["a"]["notes"] == a["notes"]
    assert db2.rows["b"]["result"] == "won"  # manual/live change never overwritten
