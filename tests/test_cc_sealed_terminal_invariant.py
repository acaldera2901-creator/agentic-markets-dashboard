"""#SETTLE-1001 5 — invariante: ogni pick sigillato raggiunge uno stato
terminale entro la sua finestra. Il check `cron_settle` e' quell'invariante.

Il tennis puo' restare legittimamente aperto fino alla scadenza
(EXPIRE_AFTER_DAYS -> 'unresolved'): oltre quella finestra un pick sigillato
senza riga in pick_settlement e' un buco, non un ritardo. Il calcio resta a 4h.
Se qualcuno sposta EXPIRE_AFTER_DAYS senza spostare il check, questo test cade.
"""
import re

from agents.tennis_settlement import EXPIRE_AFTER_DAYS
from tools.control_center.checks import daemons


def _sql() -> str:
    spec = next(s for s in daemons.BACKLOGS if s.id == "cron_settle")
    return " ".join(spec.sql.split())


def test_tennis_window_is_expiry_plus_one_day():
    m = re.search(r"source_table = 'tennis_predictions' then interval '(\d+) days'", _sql())
    assert m, _sql()
    assert int(m.group(1)) == EXPIRE_AFTER_DAYS + 1


def test_join_uses_the_three_fk_columns():
    # Due colonne darebbero lo stesso numero solo finche' model_version e'
    # uniforme: il giorno che non lo e', il conteggio mente verso il basso.
    assert "s.model_version = l.model_version" in _sql()


def test_any_orphan_past_the_window_is_red(monkeypatch):
    monkeypatch.setattr(daemons, "fetch_all", lambda sql: [(1,)])
    spec = next(s for s in daemons.BACKLOGS if s.id == "cron_settle")
    assert daemons.check_backlog(spec).level == "red"
