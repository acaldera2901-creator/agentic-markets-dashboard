from datetime import datetime, timedelta, timezone

from tools.control_center.collector import collect
from tools.control_center.contract import Check, green, red

T0 = datetime(2026, 8, 20, 17, 0, 0, tzinfo=timezone.utc)


def _chk(cid, verdict_fn):
    return Check(id=cid, group="test", label=cid, fn=verdict_fn)


def test_collect_scrive_stato_e_storico(tmp_path):
    sp, hp = tmp_path / "state.json", tmp_path / "history.jsonl"
    stato = collect(
        [_chk("a", lambda: green("ok", "s", now=T0))],
        now=T0, state_path=sp, history_path=hp, notifier=lambda n, env=None: [],
    )
    assert stato["summary"]["level"] == "green"
    assert sp.exists() and hp.exists()
    assert stato["checks"]["a"]["group"] == "test"


def test_collect_notifica_solo_al_secondo_rosso(tmp_path):
    sp, hp = tmp_path / "state.json", tmp_path / "history.jsonl"
    inviate = []

    def spia(notifiche, env=None):
        inviate.extend(notifiche)
        return ["test"]

    args = dict(state_path=sp, history_path=hp, notifier=spia)
    collect([_chk("a", lambda: red("giu'", "s", now=T0))], now=T0, **args)
    assert inviate == []

    t1 = T0 + timedelta(minutes=5)
    collect([_chk("a", lambda: red("giu'", "s", now=t1))], now=t1, **args)
    assert len(inviate) == 1
    assert inviate[0]["check_id"] == "a"


def test_lo_stato_di_allerta_sopravvive_al_riavvio(tmp_path):
    # Il conteggio dei run rossi vive nello snapshot, non in memoria: al primo
    # run dopo un reboot non deve arrivare una raffica di allarmi gia' noti.
    sp, hp = tmp_path / "state.json", tmp_path / "history.jsonl"
    args = dict(state_path=sp, history_path=hp, notifier=lambda n, env=None: [])
    collect([_chk("a", lambda: red("giu'", "s", now=T0))], now=T0, **args)
    from tools.control_center.snapshot import read_state
    assert read_state(sp)["alerts"]["a"]["red_runs"] == 1


def test_l_esito_della_consegna_finisce_nello_snapshot(tmp_path):
    # Se il notificatore fallisce, deve essere visibile sulla pagina: un
    # canale d'allerta morto in silenzio e' peggio di non averlo.
    sp, hp = tmp_path / "state.json", tmp_path / "history.jsonl"
    stato = collect(
        [_chk("a", lambda: red("giu'", "s", now=T0))],
        now=T0, state_path=sp, history_path=hp, notifier=lambda n, env=None: [],
    )
    assert "notify" not in stato  # primo run rosso: nessuna notifica dovuta

    t1 = T0 + timedelta(minutes=5)
    stato = collect(
        [_chk("a", lambda: red("giu'", "s", now=t1))],
        now=t1, state_path=sp, history_path=hp, notifier=lambda n, env=None: [],
    )
    assert stato["notify"]["notifiche"] == 1
    assert stato["notify"]["consegnato"] is False
    assert stato["notify"]["canali"] == []

    from tools.control_center.snapshot import read_state
    assert read_state(sp)["notify"]["consegnato"] is False
