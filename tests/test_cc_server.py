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
