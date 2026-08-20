import json
import threading
import urllib.error
import urllib.request

import pytest

from tools.control_center import server as srv
from tools.control_center.snapshot import write_state


@pytest.fixture
def in_piedi(tmp_path, mocker):
    stato = tmp_path / "state.json"
    write_state(
        {"generated_at": "2026-08-20T17:45:00Z", "summary": {"level": "green"}, "checks": {}},
        stato,
    )
    mocker.patch.object(srv, "STATE_FILE", stato)
    mocker.patch.object(srv, "HISTORY_FILE", tmp_path / "history.jsonl")
    httpd = srv.make_server(port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def test_ascolta_solo_su_loopback():
    httpd = srv.make_server(port=0)
    assert httpd.server_address[0] == "127.0.0.1"
    httpd.server_close()


def test_api_state_restituisce_lo_snapshot(in_piedi):
    with urllib.request.urlopen(in_piedi + "/api/state", timeout=5) as r:
        body = json.loads(r.read())
    assert body["summary"]["level"] == "green"


def test_la_radice_serve_la_pagina(in_piedi):
    with urllib.request.urlopen(in_piedi + "/", timeout=5) as r:
        html = r.read().decode()
    assert "<title>" in html
    assert "api/state" in html


def test_api_history_su_file_assente_e_una_lista_vuota(in_piedi):
    with urllib.request.urlopen(in_piedi + "/api/history", timeout=5) as r:
        assert json.loads(r.read()) == []


def test_ogni_altro_percorso_e_404(in_piedi):
    for path in ("/etc/passwd", "/../../etc/passwd", "/static/../server.py", "/qualsiasi"):
        with pytest.raises(urllib.error.HTTPError) as exc:
            urllib.request.urlopen(in_piedi + path, timeout=5)
        assert exc.value.code == 404


@pytest.fixture
def con_azioni(tmp_path, mocker):
    from tools.control_center import actions

    stato = tmp_path / "state.json"
    write_state(
        {
            "generated_at": "2026-08-20T17:45:00Z",
            "summary": {"level": "red"},
            "checks": {
                "launchd_watchdog": {"level": "red", "headline": "exit 1", "source": "launchctl",
                                     "measured_at": "2026-08-20T17:45:00Z", "group": "daemon"},
                "cron_settle": {"level": "red", "headline": "66 in attesa", "source": "db",
                                "measured_at": "2026-08-20T17:45:00Z", "group": "cron"},
            },
        },
        stato,
    )
    mocker.patch.object(srv, "STATE_FILE", stato)
    mocker.patch.object(srv, "HISTORY_FILE", tmp_path / "history.jsonl")
    mocker.patch.object(actions, "STATE_DIR", tmp_path)
    mocker.patch.object(actions, "TOKEN_FILE", tmp_path / "token")
    mocker.patch.object(actions, "JOBS_DIR", tmp_path / "jobs")
    mocker.patch.object(actions, "REPORTS_DIR", tmp_path / "reports")
    httpd = srv.make_server(port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"
    yield base, actions.ensure_token()
    httpd.shutdown()


def _post(base, corpo, token=None, origin=None):
    req = urllib.request.Request(
        base + "/api/action", data=json.dumps(corpo).encode(), method="POST",
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("X-CC-Token", token)
    if origin:
        req.add_header("Origin", origin)
    return urllib.request.urlopen(req, timeout=5)


def test_una_post_senza_token_e_respinta(con_azioni):
    base, _ = con_azioni
    with pytest.raises(urllib.error.HTTPError) as exc:
        _post(base, {"check_id": "launchd_watchdog", "azione": "riavvia"})
    assert exc.value.code == 403


def test_una_post_da_un_altra_origine_e_respinta(con_azioni):
    # Il loopback non protegge da solo: qualsiasi pagina aperta nel browser
    # puo' fare una POST verso 127.0.0.1.
    base, token = con_azioni
    with pytest.raises(urllib.error.HTTPError) as exc:
        _post(base, {"check_id": "launchd_watchdog", "azione": "riavvia"},
              token=token, origin="https://sito-cattivo.example")
    assert exc.value.code == 403


def test_un_azione_non_prevista_e_rifiutata(con_azioni):
    base, token = con_azioni
    with _post(base, {"check_id": "cron_settle", "azione": "droppa_tabella"}, token=token) as r:
        assert json.loads(r.read())["ok"] is False


def test_un_check_sconosciuto_e_404(con_azioni):
    base, token = con_azioni
    with pytest.raises(urllib.error.HTTPError) as exc:
        _post(base, {"check_id": "inventato", "azione": "diagnosi"}, token=token)
    assert exc.value.code == 404


def test_il_riavvio_non_e_offerto_dove_non_e_sicuro(con_azioni):
    # cron_settle vorrebbe dire scrivere sul DB di produzione: nessun rimedio
    # meccanico, solo diagnosi.
    base, token = con_azioni
    with _post(base, {"check_id": "cron_settle", "azione": "riavvia"}, token=token) as r:
        esito = json.loads(r.read())
    assert esito["ok"] is False
    assert "meccanico" in esito["errore"]


def test_la_diagnosi_accoda_e_compare_nei_job(con_azioni):
    base, token = con_azioni
    with _post(base, {"check_id": "cron_settle", "azione": "diagnosi"}, token=token) as r:
        assert json.loads(r.read())["ok"] is True
    with urllib.request.urlopen(base + "/api/jobs", timeout=5) as r:
        assert json.loads(r.read())["cron_settle"]["stato"] == "in_coda"


def test_la_pagina_riceve_il_token_iniettato(con_azioni):
    base, token = con_azioni
    with urllib.request.urlopen(base + "/", timeout=5) as r:
        html = r.read().decode()
    assert token in html
    assert "__CC_TOKEN__" not in html
