from tools.control_center.checks import torre


def test_torre_fresca_giudica_lo_snapshot_sul_file(tmp_path):
    from datetime import datetime, timedelta, timezone

    from tools.control_center.snapshot import write_state

    f = tmp_path / "state.json"
    adesso = datetime.now(timezone.utc)

    def con_eta(minuti):
        nato = (adesso - timedelta(minutes=minuti)).strftime("%Y-%m-%dT%H:%M:%SZ")
        write_state({"generated_at": nato}, f)
        return torre.check_torre_fresca(f)

    assert con_eta(5).level == "green"
    assert con_eta(15).level == "amber"
    rosso = con_eta(417)
    assert rosso.level == "red" and rosso.value >= 416
    assert "kickstart" in rosso.evidence["riparo"]
    assert torre.check_torre_fresca(tmp_path / "manca.json").level == "unknown"
    assert "torre_fresca" in [c.id for c in torre.checks()]
