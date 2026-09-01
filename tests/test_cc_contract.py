from datetime import datetime, timezone

import pytest

from tools.control_center.contract import (
    Check,
    Verdict,
    amber,
    green,
    red,
    unknown,
    verdict_from_dict,
)

FIXED = datetime(2026, 8, 20, 17, 45, 0, tzinfo=timezone.utc)


def test_verdict_richiede_source():
    with pytest.raises(ValueError, match="source"):
        Verdict(level="green", headline="ok", source="", measured_at="2026-08-20T17:45:00Z")


def test_verdict_richiede_measured_at():
    with pytest.raises(ValueError, match="measured_at"):
        Verdict(level="green", headline="ok", source="db:x", measured_at="")


def test_verdict_rifiuta_livello_inventato():
    with pytest.raises(ValueError, match="livello"):
        Verdict(level="giallino", headline="ok", source="db:x", measured_at="2026-08-20T17:45:00Z")


def test_helper_impostano_il_livello_e_l_istante():
    v = green("ultimo run 2 min fa", "db:pick_settlement", value=42, now=FIXED)
    assert v.level == "green"
    assert v.value == 42
    assert v.measured_at == "2026-08-20T17:45:00Z"
    assert amber("x", "s", now=FIXED).level == "amber"
    assert red("x", "s", now=FIXED).level == "red"


def test_unknown_porta_il_motivo_e_nessun_valore():
    v = unknown("credenziale mancante: IG_TOKEN", "ig graph api", now=FIXED)
    assert v.level == "unknown"
    assert v.value is None
    assert "IG_TOKEN" in v.headline


def test_roundtrip_dict():
    v = red("settle fermo da 12h", "db:pick_settlement", value="12h04m", evidence={"age_s": 43440}, now=FIXED)
    assert verdict_from_dict(v.to_dict()) == v


def test_check_ha_timeout_di_default():
    c = Check(id="x", group="piattaforma", label="X", fn=lambda: green("ok", "s"))
    assert c.timeout_seconds == 10.0
    assert c.ttl_seconds == 0


def test_info_e_un_numero_senza_giudizio():
    # Un KPI non ha un semaforo: dare un colore a un dato senza soglia
    # difendibile significa inventare un verdetto.
    from tools.control_center.contract import info

    v = info("ROI -6.9% su 91 pick", "db:pick_ledger", value="-6.9%", now=FIXED)
    assert v.level == "info"
    assert v.value == "-6.9%"
