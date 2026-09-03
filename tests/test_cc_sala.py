"""La sala di lavoro: cosa deve restare vero perche' la pagina non menta."""

import json
import shutil
import subprocess
import threading
import urllib.request
from datetime import datetime, timezone

import pytest

from tools.control_center import sala
from tools.control_center import server as srv
from tools.control_center.server import PAGE as PAGINA
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


def test_la_notifica_di_un_job_non_e_il_task(disco, mocker):
    """Regressione osservata dal vivo il 03/09: le notifiche dei job in
    background e l'eco dei comandi bash arrivano come messaggi "user" con
    contenuto stringa. Tolti i tag restavano gli id, e il task di `me-ceo`
    diventava «a0517de8ef1e44393 toolu_01K5h3UBbMpN7eB3»."""
    sess, prog = disco
    sid = "99999999-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _u("parti domani mattina anche se chiudo la shell"),
        _u("<bash-input>vercel --prod</bash-input>", ts="2026-09-03T19:52:20.000Z"),
        _u("<bash-stdout></bash-stdout><bash-stderr>errore</bash-stderr>",
           ts="2026-09-03T19:52:21.000Z"),
        _u("<task-notification>\n<task-id>a0517de8ef1e44393</task-id>\n"
           "<tool-use-id>toolu_01K5h3UBbMpN7eB3ViZgwc3G</tool-use-id>\n"
           "</task-notification>", ts="2026-09-03T20:40:54.000Z"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    assert (sala.stato()["agenti"][0]["task"]
            == "parti domani mattina anche se chiudo la shell")


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


# ------------------------------------------------------------------ le deleghe

# I due blocchi reali di una delega, copiati dal transcript del 03/09.
def _lancio(tool_id, agente, descr, ts="2026-09-03T18:01:52.000Z"):
    return _a([{"type": "tool_use", "id": tool_id, "name": "Agent",
                "input": {"subagent_type": agente, "description": descr}}], ts=ts)


def _partito(tool_id, agent_id, ts="2026-09-03T18:01:54.000Z"):
    """Il `tool_result` vero: torna in 1,5 s e dice solo che e' PARTITO."""
    return {"type": "user", "timestamp": ts, "message": {"content": [
        {"type": "tool_result", "tool_use_id": tool_id, "content": [
            {"type": "text", "text": "Async agent launched successfully. (This tool "
                                     "result is internal metadata.)\n"
                                     f"agentId: {agent_id} (internal ID - do not "
                                     "mention to user.)"}]}]}}


def _finito(agent_id, tool_id, esito="completed", ts="2026-09-03T18:06:00.000Z"):
    """La `<task-notification>`: l'unico posto dove sta scritto che ha finito."""
    return _u(f"<task-notification>\n<task-id>{agent_id}</task-id>\n"
              f"<tool-use-id>{tool_id}</tool-use-id>\n"
              f"<status>{esito}</status>\n</task-notification>", ts=ts)


def test_il_tool_result_non_chiude_la_delega(disco, mocker):
    """Il cuore della questione, e l'errore in cui era facile cadere: il
    `tool_result` di un Agent torna dopo 1,5 s con «Async agent launched»
    mentre il sottoagente lavora ancora. Trattarlo come fine darebbe «finita»
    a una delega appena partita."""
    sess, prog = disco
    sid = "33333333-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _u("delega la sala al dev"),
        _lancio("t1", "programmatore-andrea", "Sala di lavoro agenti"),
        _partito("t1", "a8f0d3bdd4e1c3fbd"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert a["deleghe_aperte"] == 1
    d = a["deleghe"][0]
    assert d["agente"] == "programmatore-andrea"
    assert d["task"] == "Sala di lavoro agenti"
    assert d["aperta"] is True and d["esito"] is None


def test_la_notifica_di_fine_chiude_la_delega(disco, mocker):
    sess, prog = disco
    sid = "aaaa1111-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _u("delega la sala al dev"),
        _lancio("t1", "programmatore-andrea", "Sala di lavoro agenti"),
        _partito("t1", "a8f0d3bdd4e1c3fbd"),
        _finito("a8f0d3bdd4e1c3fbd", "t1"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert a["deleghe_aperte"] == 0
    assert a["deleghe"][0]["aperta"] is False
    assert a["deleghe"][0]["esito"] == "completed"
    assert a["deleghe"][0]["chiusa_il"]


def test_un_sottoagente_ucciso_non_resta_aperto(disco, mocker):
    """Osservato il 03/09 (1 volta su 22): lo `<status>` non e' sempre
    `completed`. Una delega finita male e' finita, e l'esito si riporta."""
    sess, prog = disco
    sid = "aaaa2222-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _lancio("t1", "qa-andrea", "Giro di QA"),
        _partito("t1", "abcdef1234567890a"),
        _finito("abcdef1234567890a", "t1", esito="killed"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    d = sala.stato()["agenti"][0]["deleghe"][0]
    assert d["aperta"] is False and d["esito"] == "killed"


def test_la_notifica_si_aggancia_per_task_id_non_per_tool_use_id(disco, mocker):
    """Verificato sul transcript del 03/09: il `<tool-use-id>` della notifica
    NON e' quello che ha lanciato l'agente — e' il turno in cui la notifica e'
    stata consegnata (agentId `afb330b58022f04c7` nasce da `toolu_01VbPcTM…`
    ma la sua notifica porta `toolu_014JtWX9…`). Agganciare per tool-use-id
    lascerebbe aperte tutte le deleghe finite."""
    sess, prog = disco
    sid = "aaaa3333-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _lancio("toolu_01VbPcTM", "general-purpose", "Mercato locale"),
        _partito("toolu_01VbPcTM", "afb330b58022f04c7"),
        _finito("afb330b58022f04c7", "toolu_014JtWX9"),   # tool-use-id diverso
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    assert sala.stato()["agenti"][0]["deleghe_aperte"] == 0


def test_piu_deleghe_in_parallelo_si_chiudono_una_per_una(disco, mocker):
    """Il caso reale: `me-ceo` ne aveva 4 aperte insieme."""
    sess, prog = disco
    sid = "aaaa4444-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _lancio("t1", "general-purpose", "Primo"),
        _partito("t1", "aaa1111111111111a"),
        _lancio("t2", "general-purpose", "Secondo"),
        _partito("t2", "bbb2222222222222b"),
        _lancio("t3", "maketelier-social", "Terzo"),
        _partito("t3", "ccc3333333333333c"),
        _finito("bbb2222222222222b", "t9"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert a["deleghe_aperte"] == 2
    aperte = [d["task"] for d in a["deleghe"] if d["aperta"]]
    assert aperte == ["Primo", "Terzo"]
    # Le aperte vengono prima: sono quelle che dicono qualcosa di adesso.
    assert a["deleghe"][0]["aperta"] is True


def test_una_delega_aperta_da_troppo_e_sospetta_non_viva(disco, mocker):
    """Due delle 22 deleghe osservate il 03/09 non hanno MAI ricevuto la loro
    notifica di fine: a cinque ore risultavano ancora aperte. Contarle per
    vive sarebbe la stessa bugia dei processi fantasma."""
    sess, prog = disco
    sid = "aaaa5555-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _lancio("t1", "maketelier-social", "Riattivazione Instagram",
                ts="2001-01-01T00:00:00.000Z"),
        _partito("t1", "a9df666425ceb566a", ts="2001-01-01T00:00:02.000Z"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    d = sala.stato()["agenti"][0]["deleghe"][0]
    assert d["aperta"] is True and d["sospetta"] is True


def test_una_delega_appena_aperta_non_e_sospetta(disco, mocker):
    """L'altro verso della soglia: un allarme che parte subito brucia la
    fiducia nella pagina piu' di quanto la salvi un allarme in anticipo."""
    sess, prog = disco
    sid = "aaaa9999-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    ora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    _transcript(prog, sid, [
        _lancio("t1", "programmatore-andrea", "Appena partita", ts=ora),
        _partito("t1", "a1111111111111111", ts=ora),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    d = sala.stato()["agenti"][0]["deleghe"][0]
    assert d["aperta"] is True and d["sospetta"] is False
    assert d["eta_s"] < 60


def test_la_delega_non_dichiara_i_passi_interni_del_sottoagente(disco, mocker):
    """Il limite che resta vero: il transcript della madre non contiene le
    righe del sottoagente (verificato: 0 su 2384 hanno `isSidechain`). Di una
    delega si sa a chi, per cosa e da quando — non a che punto sia."""
    sess, prog = disco
    sid = "aaaa6666-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _lancio("t1", "programmatore-andrea", "Sala"),
        _partito("t1", "a8f0d3bdd4e1c3fbd"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert set(a["deleghe"][0]) == {"agente", "task", "quando", "eta_s",
                                    "aperta", "sospetta", "esito", "chiusa_il"}
    assert "sottoagenti" not in a
    # Il passo mostrato resta quello della madre, non del sottoagente.
    assert a["passo"].startswith("Agent")


def test_l_agent_id_interno_non_esce_dalla_api(disco, mocker):
    """Il `tool_result` lo dice esplicitamente: l'agentId e' metadato interno
    e non va mostrato. Serve solo ad agganciare la notifica di fine."""
    sess, prog = disco
    sid = "aaaa7777-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "me-ceo", sid)
    _transcript(prog, sid, [
        _lancio("t1", "programmatore-andrea", "Sala"),
        _partito("t1", "a8f0d3bdd4e1c3fbd"),
    ])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    servito = json.dumps(sala.stato())
    assert "a8f0d3bdd4e1c3fbd" not in servito
    assert "agentId" not in servito


def test_una_sessione_senza_deleghe_non_ne_inventa(disco, mocker):
    sess, prog = disco
    sid = "aaaa8888-1111-2222-3333-444444444444"
    _sessione(sess, 4242, "br-mkt", sid)
    _transcript(prog, sid, [_u("scrivi il piano editoriale")])
    mocker.patch.object(sala, "_processi_claude", return_value={4242: "claude"})

    a = sala.stato()["agenti"][0]
    assert a["deleghe"] == [] and a["deleghe_aperte"] == 0


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


def test_il_portafoglio_disegna_la_sala_dalla_stessa_api(in_piedi):
    """La root ha il suo schema, ma non una seconda sorgente: legge
    `/api/sala` come la pagina di dettaglio."""
    with urllib.request.urlopen(in_piedi + "/", timeout=5) as r:
        html = r.read().decode()
    assert "/api/sala" in html
    assert "schemaSala" in html and 'id="sala"' in html


@pytest.mark.skipif(shutil.which("node") is None, reason="serve node")
def test_nello_schema_il_non_dichiarato_non_e_in_ascolto():
    """Lo stesso bug gia' riparato una volta, e in uno schema stringato e'
    ancora piu' facile che ricapiti. Si esegue davvero `statoAla` sotto node:
    un test che cerca la stringa nell'HTML passa anche solo per un commento
    — verificato, e infatti non aveva morso alla prima mutazione."""
    fonte = (PAGINA.read_text(encoding="utf-8")
             .split("function statoAla(a){", 1)[1].split("\n}", 1)[0])
    prova = """
      function statoAla(a){%s}
      const casi = [
        [{stato:"busy",  silenzio_sospetto:false}, "AL LAVORO"],
        [{stato:"busy",  silenzio_sospetto:true},  "MUTA"],
        [{stato:"idle",  silenzio_sospetto:false}, "IN ASCOLTO"],
        [{stato:"?",     silenzio_sospetto:false}, "NON DICH."],
        [{                silenzio_sospetto:false}, "NON DICH."],
      ];
      const out = casi.map(([a,atteso]) => {
        const s = statoAla(a);
        return [s.eti, atteso, s.eti===atteso, s.col, !!s.tratti].join("|");
      });
      console.log(out.join("\\n"));
    """ % fonte
    esito = subprocess.run(["node", "-e", prova], capture_output=True, text=True)
    assert esito.returncode == 0, esito.stderr
    righe = [r.split("|") for r in esito.stdout.strip().splitlines()]
    assert len(righe) == 5
    for eti, atteso, ok, col, tratti in righe:
        assert ok == "true", f"{atteso} reso come {eti}"
    # Il non dichiarato non condivide ne' il colore ne' il tratto con l'idle:
    # in uno schema il colore da solo non e' una distinzione.
    idle, muto = righe[2], righe[4]
    assert muto[3] != idle[3] and muto[4] == "true" and idle[4] == "false"


@pytest.mark.skipif(shutil.which("node") is None, reason="serve node")
def test_nello_schema_la_delega_dice_a_chi_e_da_quando():
    """Si esegue davvero `deleghe()` sotto node: le tre funzioni sono
    contigue nel file, quindi si estrae il blocco in un pezzo solo invece di
    ricomporlo (un test che cerca la stringa nell'HTML passa anche per un
    commento — lezione del test qui sopra)."""
    testo = PAGINA.read_text(encoding="utf-8")
    fonte = "function breve(s){" + (testo.split("function breve(s){", 1)[1]
                                    .split("\nfunction schemaSala(", 1)[0])
    prova = """
      %s
      const casi = [
        ["niente",   {deleghe:[], deleghe_aperte:0}],
        ["assente",  {}],
        ["una",      {deleghe_aperte:1, deleghe:[
                        {aperta:true, sospetta:false, agente:"programmatore-andrea",
                         eta_s:720}]}],
        ["tre",      {deleghe_aperte:3, deleghe:[
                        {aperta:true, sospetta:false, agente:"a", eta_s:120},
                        {aperta:true, sospetta:false, agente:"b", eta_s:900},
                        {aperta:true, sospetta:false, agente:"c", eta_s:300}]}],
        ["sospetta", {deleghe_aperte:1, deleghe:[
                        {aperta:true, sospetta:true, agente:"maketelier-social",
                         eta_s:18000}]}],
        ["finita",   {deleghe_aperte:0, deleghe:[
                        {aperta:false, sospetta:false, agente:"qa-andrea",
                         eta_s:9000, esito:"completed"}]}],
      ];
      console.log(JSON.stringify(casi.map(([k,a]) => [k, deleghe(a)])));
    """ % fonte
    esito = subprocess.run(["node", "-e", prova], capture_output=True, text=True)
    assert esito.returncode == 0, esito.stderr
    r = dict(json.loads(esito.stdout))

    # Nessuna delega aperta non disegna niente: un simbolo che vuol dire zero
    # e' peggio dell'assenza del simbolo.
    assert r["niente"] is None and r["assente"] is None
    assert r["finita"] is None, "una delega finita non e' lavoro in corso"

    # Con una sola, il nome di chi la porta vale piu' del numero.
    assert r["una"]["n"] == 1
    assert "programmatore-andrea" in r["una"]["eti"] and "12m" in r["una"]["eti"]

    # Con piu' d'una, il numero — e la durata e' quella della PIU' VECCHIA,
    # non della piu' recente: il rischio sta nella piu' vecchia.
    assert r["tre"]["n"] == 3
    assert "3 deleghe" in r["tre"]["eti"] and "15m" in r["tre"]["eti"]

    # Il dubbio ha il suo colore, e non e' quello di una delega sana.
    assert r["sospetta"]["col"] == "#F5A524"
    assert r["una"]["col"] != r["sospetta"]["col"]
