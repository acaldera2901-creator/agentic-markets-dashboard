from datetime import datetime, timedelta, timezone

from tools.control_center.contract import amber, green, red, unknown
from tools.control_center.alerting import decide_alerts

T0 = datetime(2026, 8, 20, 17, 0, 0, tzinfo=timezone.utc)


def test_un_solo_run_rosso_non_notifica_ancora():
    notifiche, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    assert notifiche == []
    assert stato["c"]["red_runs"] == 1


def test_il_secondo_run_rosso_notifica():
    _, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    t1 = T0 + timedelta(minutes=5)
    notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t1)}, t1)
    assert len(notifiche) == 1
    assert notifiche[0]["kind"] == "down"
    assert notifiche[0]["check_id"] == "c"
    assert "giu'" in notifiche[0]["body"]
    assert stato["c"]["notified_at"] is not None


def test_un_rosso_lampeggiante_non_notifica():
    # rosso, poi verde, poi rosso: la conferma su due run consecutivi
    # e' esattamente cio' che uccide il falso positivo da timeout singolo.
    _, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    t1 = T0 + timedelta(minutes=5)
    _, stato = decide_alerts(stato, {"c": green("ok", "s", now=t1)}, t1)
    t2 = T0 + timedelta(minutes=10)
    notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t2)}, t2)
    assert notifiche == []
    assert stato["c"]["red_runs"] == 1


def test_ambra_e_unknown_non_notificano_mai():
    stato = {}
    for _ in range(5):
        notifiche, stato = decide_alerts(
            stato,
            {"a": amber("51%", "s", now=T0), "u": unknown("token mancante", "s", now=T0)},
            T0,
        )
        assert notifiche == []


def test_il_rientro_notifica_una_volta():
    _, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    t1 = T0 + timedelta(minutes=5)
    _, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t1)}, t1)
    t2 = T0 + timedelta(minutes=10)
    notifiche, stato = decide_alerts(stato, {"c": green("ok", "s", now=t2)}, t2)
    assert [n["kind"] for n in notifiche] == ["up"]
    t3 = T0 + timedelta(minutes=15)
    notifiche, stato = decide_alerts(stato, {"c": green("ok", "s", now=t3)}, t3)
    assert notifiche == []


def test_un_rosso_persistente_tace_per_sei_ore():
    stato = {}
    t = T0
    for _ in range(2):
        notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t)}, t)
        t += timedelta(minutes=5)
    assert len(notifiche) == 1
    for _ in range(12):
        t += timedelta(minutes=25)
        notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t)}, t)
        assert notifiche == []
    t += timedelta(hours=2)
    notifiche, stato = decide_alerts(stato, {"c": red("giu'", "s", now=t)}, t)
    assert len(notifiche) == 1


def test_un_check_scomparso_non_resta_nello_stato():
    _, stato = decide_alerts({}, {"c": red("giu'", "s", now=T0)}, T0)
    _, stato = decide_alerts(stato, {"altro": green("ok", "s", now=T0)}, T0)
    assert "c" not in stato
