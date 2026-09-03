"""La sala di lavoro: cosa deve restare vero perche' la pagina non menta."""

import json
import threading
import urllib.request

import pytest

from tools.control_center import sala
from tools.control_center import server as srv
from tools.control_center.snapshot import write_state


# ------------------------------------------------------------------ finto disco

def _sessione(dir_sess, pid, nome, sid, agente="x", stato="idle", quando=1_788_000_000_000):
    (dir_sess / f"{pid}.json").write_text(json.dumps({
        "pid": pid, "sessionId": sid, "cwd": "/Users/calde/Desktop/agentic-markets",
        "startedAt": quando, "version": "2.1.259", "kind": "interactive",
        "name": nome, "agent": agente, "status": stato,
        "statusUpdatedAt": quando, "updatedAt": quando,
    }))


def _transcript(dir_prog, sid, righe):
    d = dir_prog / "-Users-calde-Desktop-agentic-markets"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{sid}.jsonl").write_text("\n".join(json.dumps(r) for r in righe) + "\n")


def _u(testo, ts="2026-09-03T18:00:00.000Z"):
    return {"type": "user", "timestamp": ts,
            "message": {"content": [{"type": "text", "text": testo}]}}


def _a(blocchi, ts="2026-09-03T18:00:10.000Z"):
    return {"type": "assistant", "timestamp": ts, "message": {"content": blocchi}}


@pytest.fixture
def disco(tmp_path, mocker):
    sess = tmp_path / "sessions"; sess.mkdir()
    prog = tmp_path / "projects"; prog.mkdir()
    mocker.patch.object(sala, "SESSIONI", sess)
    mocker.patch.object(sala, "PROGETTI", prog)
    return sess, prog


# ------------------------------------------------------------------ il vivo

def test_una_sessione_viva_compare_col_suo_task(disco, mocker):
    sess, prog = disco
    _sessione(sess, 4242, "br-dev", "aaaaaaaa-1111-2222-3333-444444444444",
              agente="programmatore-andrea", stato="busy")
    _transcript(prog, "aaaaaaaa-1111-2222-3333-444444444444", [
        _u("sistema il bug della board"),
        _a([{"type": "tool_use", "name": "Edit",
             "input": {"file_path": "/repo/lib/db.ts"}}]),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude -n br-dev"})

    s = sala.stato()
    assert [a["nome"] for a in s["agenti"]] == ["br-dev"]
    a = s["agenti"][0]
    assert a["agente"] == "programmatore-andrea" and a["stato"] == "busy"
    assert a["task"] == "sistema il bug della board"
    assert a["passo"] == "Edit: /repo/lib/db.ts"


def test_il_processo_morto_e_un_fantasma_non_un_agente_fermo(disco, mocker):
    """Il file di sessione sopravvive alla shell. Mostrarlo come agente in
    ascolto e' esattamente la pagina che sembra viva ed e' morta."""
    sess, prog = disco
    _sessione(sess, 9999, "br-qa", "bbbbbbbb-1111-2222-3333-444444444444")
    mocker.patch.object(sala, "_processi_claude", return_value={})

    s = sala.stato()
    assert s["agenti"] == []
    assert s["fantasmi"][0]["nome"] == "br-qa"


def test_un_pid_riusato_da_un_altro_programma_non_e_un_agente(disco, mocker):
    sess, prog = disco
    _sessione(sess, 4242, "br-dev", "aaaaaaaa-1111-2222-3333-444444444444")
    # `_processi_claude` filtra gia' sul binario: qui il pid non e' fra i suoi.
    mocker.patch.object(sala, "_processi_claude", return_value={7: "claude"})

    assert sala.stato()["agenti"] == []
    assert sala.stato()["fantasmi"][0]["pid"] == 4242


def test_ps_riconosce_claude_e_scarta_chi_lo_nomina_di_passaggio(mocker):
    # La riga 105 e' reale (osservata il 03/09): `lab` lancia ogni ala dentro un
    # `bash -c`, quindi il wrapper e la shell vera convivono. Contarli entrambi
    # raddoppierebbe ogni ala del lab.
    finto = ("  101 claude -n br-dev\n"
             "  102 /Users/x/.local/share/claude/versions/2.1.259 -n me-ceo\n"
             "  103 vim note-su-claude.md\n"
             "  104 grep claude /tmp/log\n"
             "  105 bash -c cd '/repo' && claude -n br-mkt --agent marketing\n")
    mocker.patch.object(sala.subprocess, "run",
                        return_value=mocker.Mock(stdout=finto))
    assert set(sala._processi_claude()) == {101, 102}


# ------------------------------------------------------------------ il vero

def test_lo_slash_command_non_e_il_task(disco, mocker):
    sess, prog = disco
    sid = "cccccccc-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _u("rivedi il piano di lancio"),
        _u("<command-name>/clear</command-name>", ts="2026-09-03T18:05:00.000Z"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    assert sala.stato()["agenti"][0]["task"] == "rivedi il piano di lancio"


def test_il_tool_result_non_e_una_richiesta_di_andrea(disco, mocker):
    sess, prog = disco
    sid = "dddddddd-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _u("apri il report"),
        {"type": "user", "timestamp": "2026-09-03T18:06:00.000Z",
         "message": {"content": [{"type": "tool_result", "text": "ok"}]}},
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    assert sala.stato()["agenti"][0]["task"] == "apri il report"


def test_task_assente_dice_perche_invece_di_restare_vuoto(disco, mocker):
    """Un task vuoto si legge come «non sta facendo niente». Non e' lo stesso."""
    sess, prog = disco
    sid = "eeeeeeee-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [_a([{"type": "text", "text": "fatto"}])])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert a["task"] == ""
    assert "nessun prompt" in a["attivita_perche"]


def test_una_sessione_appena_nata_non_ha_status_e_lo_si_dice(disco, mocker):
    """Verificato il 03/09 su una run `-p`: il campo `status` non c'e' proprio
    finche' la sessione non ha dichiarato niente. Farlo diventare «in ascolto»
    sarebbe un dato inventato — qui vale `unknown` non e' un colore."""
    sess, _ = disco
    (sess / "4242.json").write_text(json.dumps({
        "pid": 4242, "sessionId": "88888888-1111-2222-3333-444444444444",
        "cwd": "/repo", "name": "prova-sala", "agent": "ceo-andrea",
        "entrypoint": "sdk-cli", "startedAt": 1_788_000_000_000,
    }))
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert a["stato"] == "?"
    assert a["silenzio_sospetto"] is False   # non si accusa un dato che manca
    assert a["avvio"] == "sdk-cli"           # headless, non un'ala di Andrea


def test_transcript_mancante_si_dichiara(disco, mocker):
    sess, prog = disco
    _sessione(sess, 4242, "me-ceo", "ffffffff-1111-2222-3333-444444444444")
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert a["attivita_disponibile"] is False
    assert "nessun transcript" in a["attivita_perche"]


def test_busy_muto_da_troppo_viene_marcato_sospetto(disco, mocker):
    sess, prog = disco
    sid = "11111111-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "br-ml", sid, stato="busy")
    _transcript(prog, sid, [_u("gira il backtest", ts="2001-01-01T00:00:00.000Z")])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    assert sala.stato()["agenti"][0]["silenzio_sospetto"] is True


def test_la_finestra_si_allarga_finche_trova_il_prompt(disco, mocker):
    """Con una finestra fissa da 256 KB il task spariva su 2 sessioni su 3."""
    sess, prog = disco
    sid = "22222222-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    zavorra = [_a([{"type": "text", "text": "x" * 900}]) for _ in range(600)]
    _transcript(prog, sid, [_u("il prompt sta molto indietro")] + zavorra)
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert a["task"] == "il prompt sta molto indietro"


def test_la_delega_non_si_spaccia_per_lavoro_in_corso(disco, mocker):
    """Il `tool_result` di un Agent torna dopo 1,5 s mentre il sottoagente
    lavora ancora: la coppia non misura la vita del sottoagente."""
    sess, prog = disco
    sid = "33333333-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _u("delega la sala al dev"),
        _a([{"type": "tool_use", "id": "t1", "name": "Agent",
             "input": {"subagent_type": "programmatore-andrea",
                       "description": "Sala di lavoro agenti"}}]),
        {"type": "user", "timestamp": "2026-09-03T18:01:54.000Z",
         "message": {"content": [{"type": "tool_result", "tool_use_id": "t1"}]}},
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    d = sala.stato()["agenti"][0]["deleghe"]
    assert d == [{"agente": "programmatore-andrea",
                  "task": "Sala di lavoro agenti", "quando": d[0]["quando"]}]
    assert "sottoagenti" not in sala.stato()["agenti"][0]


def test_gli_orari_portano_sempre_il_fuso(disco, mocker):
    sess, prog = disco
    sid = "44444444-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [_u("ciao")])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    for campo in ("stato_da", "acceso_da", "ultimo_evento"):
        assert a[campo] and ("+" in a[campo][10:] or "-" in a[campo][10:]
                             or a[campo].endswith("Z")), campo


def test_al_lavoro_prima_di_in_ascolto(disco, mocker):
    sess, prog = disco
    _sessione(sess, 1, "in-ascolto", "55555555-1111-2222-3333-444444444444")
    _sessione(sess, 2, "al-lavoro", "66666666-1111-2222-3333-444444444444",
              stato="busy")
    mocker.patch.object(sala, "_processi_claude",
                        return_value={1: "claude", 2: "claude"})

    assert [a["nome"] for a in sala.stato()["agenti"]] == ["al-lavoro", "in-ascolto"]


def test_registro_assente_non_si_confonde_con_sala_vuota(disco, mocker):
    """«Nessun dato» e «nessuno al lavoro» non sono la stessa cosa."""
    sess, _ = disco
    mocker.patch.object(sala, "_processi_claude", return_value={})
    assert sala.stato()["registro_presente"] is False

    _sessione(sess, 4242, "br-dev", "77777777-1111-2222-3333-444444444444")
    assert sala.stato()["registro_presente"] is True


def test_un_session_id_malformato_non_diventa_una_glob(disco):
    assert sala._transcript("../../etc/passwd") is None
    assert sala._transcript("*") is None


# ------------------------------------------------------------------ il server

@pytest.fixture
def in_piedi(tmp_path, mocker):
    stato = tmp_path / "state.json"
    write_state({"generated_at": "2026-09-03T18:00:00Z",
                 "summary": {"level": "green"}, "checks": {}}, stato)
    mocker.patch.object(srv, "STATE_FILE", stato)
    mocker.patch.object(srv, "HISTORY_FILE", tmp_path / "history.jsonl")
    httpd = srv.make_server(port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def test_api_sala_legge_dal_vivo_non_dallo_snapshot(in_piedi, mocker):
    finta = {"generato": "2026-09-03T19:00:00+01:00", "agenti": [],
             "fantasmi": [], "registro_presente": True, "registro": "x"}
    mocker.patch.object(srv.sala, "stato", return_value=finta)
    with urllib.request.urlopen(in_piedi + "/api/sala", timeout=5) as r:
        assert json.loads(r.read())["generato"] == finta["generato"]


def test_la_pagina_sala_si_serve_e_chiama_la_sua_api(in_piedi):
    with urllib.request.urlopen(in_piedi + "/sala", timeout=5) as r:
        html = r.read().decode()
    assert "<title>" in html and "/api/sala" in html


def test_dal_portafoglio_si_arriva_alla_sala(in_piedi):
    with urllib.request.urlopen(in_piedi + "/", timeout=5) as r:
        assert 'href="/sala"' in r.read().decode()
