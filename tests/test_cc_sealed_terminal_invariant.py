"""#SETTLE-1001 5 — guardia di coerenza (non un oracolo): la finestra tennis del
check `cron_settle` deve restare EXPIRE_AFTER_DAYS + 1.

Il tennis puo' restare legittimamente aperto fino alla scadenza
('unresolved'): se qualcuno sposta EXPIRE_AFTER_DAYS senza spostare il check,
l'invariante diventa un falso rosso o un buco muto. Questo test cade.
"""
import re

from agents.tennis_settlement import EXPIRE_AFTER_DAYS
from tools.control_center.checks import daemons


def test_guardia_di_coerenza_finestra_tennis_uguale_scadenza_piu_un_giorno():
    spec = next(s for s in daemons.BACKLOGS if s.id == "cron_settle")
    sql = " ".join(spec.sql.split())
    m = re.search(r"source_table = 'tennis_predictions' then interval '(\d+) days'", sql)
    assert m, sql
    assert int(m.group(1)) == EXPIRE_AFTER_DAYS + 1
