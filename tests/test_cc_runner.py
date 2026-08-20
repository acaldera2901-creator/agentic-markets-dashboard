from datetime import datetime, timedelta, timezone

from tools.control_center.contract import Check, green
from tools.control_center.runner import run_checks

FIXED = datetime(2026, 8, 20, 17, 45, 0, tzinfo=timezone.utc)


def _chk(cid, fn, **kw):
    return Check(id=cid, group="g", label=cid, fn=fn, **kw)


def test_un_check_che_esplode_non_affonda_gli_altri():
    def boom():
        raise RuntimeError("provider giu'")

    out = run_checks(
        [_chk("rotto", boom), _chk("sano", lambda: green("ok", "s", now=FIXED))],
        now=FIXED,
    )
    assert out["rotto"].level == "unknown"
    assert "provider giu'" in out["rotto"].headline
    assert "traceback" in out["rotto"].evidence
    assert out["sano"].level == "green"


def test_un_check_lento_diventa_unknown_non_blocca_lo_snapshot():
    import time

    out = run_checks([_chk("lento", lambda: time.sleep(5), timeout_seconds=0.2)], now=FIXED)
    assert out["lento"].level == "unknown"
    assert "timeout" in out["lento"].headline.lower()


def test_un_check_che_non_restituisce_un_verdict_e_unknown():
    out = run_checks([_chk("bugiardo", lambda: {"level": "green"})], now=FIXED)
    assert out["bugiardo"].level == "unknown"
    assert "Verdict" in out["bugiardo"].headline


def test_il_ttl_riusa_la_misura_precedente_senza_richiamare_la_fonte():
    chiamate = []

    def costoso():
        chiamate.append(1)
        return green("fresco", "api", now=FIXED)

    previous = {
        "caro": green("vecchio ma valido", "api", now=FIXED - timedelta(minutes=10)).to_dict()
    }
    out = run_checks([_chk("caro", costoso, ttl_seconds=3600)], previous=previous, now=FIXED)
    assert chiamate == []
    assert out["caro"].headline == "vecchio ma valido"


def test_il_ttl_scaduto_richiama_la_fonte():
    previous = {
        "caro": green("scaduto", "api", now=FIXED - timedelta(hours=3)).to_dict()
    }
    out = run_checks(
        [_chk("caro", lambda: green("fresco", "api", now=FIXED), ttl_seconds=3600)],
        previous=previous,
        now=FIXED,
    )
    assert out["caro"].headline == "fresco"


def test_un_check_appeso_non_ritarda_lo_snapshot():
    # Il timeout del singolo check non serve a niente se poi lo spegnimento
    # del pool attende comunque il thread lento: lo snapshot arriverebbe in
    # ritardo esattamente quando qualcosa e' rotto.
    import time as _t

    inizio = _t.monotonic()
    out = run_checks([_chk("appeso", lambda: _t.sleep(8), timeout_seconds=0.2)], now=FIXED)
    trascorso = _t.monotonic() - inizio
    assert out["appeso"].level == "unknown"
    assert trascorso < 2.0, f"run_checks ha atteso {trascorso:.1f}s"
