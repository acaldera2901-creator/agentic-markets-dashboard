"""Il cockpit: parser dei task, auto-chiusura dal check, la scrittura sicura.

Gira su registri finti in una cartella temporanea: mai sulle card vere.
"""

import json
import threading
import urllib.error
import urllib.request
from datetime import date

import pytest

from . import cockpit, progetti, server
from .actions import ensure_token

OGGI = date(2026, 9, 30)

CARD_NUOVA = """---
description: "BetRedge — settlement"
---
# Settlement

<!-- STATO:start -->
> 🟢 **STATO 2026-09-29 · `ATTIVO`**
>
> **Area:** betredge
> **Goal:** zero pick finite senza esito
> **Done quando:** il check cron_settle e' verde
> **Prossima azione:** sbloccare il settle
> **Task:**
>   - [ ] sbloccare il settle · Andrea · scad:2026-10-02 · check:cron_settle,history_orfane
>   - [x] leggere il report · Claude · fatto:2026-09-28
>   - [ ] rigenerare il token IG · Andrea · check:instagram_en
>   - [ ] allineare /history · Michele · check:history_coerente
>   - [ ] scrivere il post-mortem · Andrea · scad:2026-09-20
> **Pending:** - [ ] questa casella NON e' un task
> **Verifica:** misurato il 2026-09-29
<!-- STATO:end -->

- [ ] nemmeno questa, e' fuori dal blocco
"""

CARD_VECCHIA = """# Vecchia
<!-- STATO:start -->
> **STATO 2026-06-01 · `ATTIVO`**
> **Done quando:** mai
> **Prossima azione:** qualcosa
<!-- STATO:end -->
"""

CARD_STALE = """<!-- STATO:start -->
> **STATO 2026-07-01 · `ATTIVO`**
> **Area:** betredge
> **Task:**
>   - [ ] cosa dimenticata · Andrea · scad:2026-07-10
<!-- STATO:end -->
"""

CARD_BLOCCATA = """<!-- STATO:start -->
> **STATO 2026-09-28 · `BLOCCATO`**
> **Area:** BetRedge, maven
> **Prossima azione:** firmare il contratto — *owner: Andrea*
<!-- STATO:end -->
"""

STATO = {
    "generated_at": "2026-09-30T20:00:00Z",
    "checks": {
        "cron_settle": {"level": "red", "headline": "1930 pick in attesa", "source": "db",
                        "measured_at": "2026-09-30T20:00:00Z", "evidence": {"arretrato": 1930}},
        "history_orfane": {"level": "red", "headline": "833 orfane", "source": "db",
                           "measured_at": "2026-09-30T20:00:00Z"},
        "history_coerente": {"level": "red", "headline": "58.2 vs 57.7", "source": "web",
                             "measured_at": "2026-09-30T20:00:00Z"},
        "launchd_daemon-health": {"level": "red", "headline": "7 check rossi", "source": "f",
                                  "measured_at": "2026-09-30T20:00:00Z"},
        "instagram_en": {"level": "unknown", "headline": "token SCADUTO", "source": "ig",
                         "measured_at": "2026-09-30T20:00:00Z"},
        "cron_crm": {"level": "amber", "headline": "fermo o nulla da fare", "source": "db",
                     "measured_at": "2026-09-30T20:00:00Z"},
        "web_pages": {"level": "green", "headline": "4/4", "source": "web",
                      "measured_at": "2026-09-30T20:00:00Z"},
    },
    "alerts": {"cron_settle": {"red_runs": 13}},
}


@pytest.fixture
def registri(tmp_path, monkeypatch):
    cartella = tmp_path / "memory"
    cartella.mkdir()
    for nome, testo in (("project_settle", CARD_NUOVA), ("project_vecchia", CARD_VECCHIA),
                        ("project_stale", CARD_STALE), ("project_bloccata", CARD_BLOCCATA)):
        (cartella / f"{nome}.md").write_text(testo, encoding="utf-8")
    fuori = tmp_path / "segreto.md"
    fuori.write_text("non toccare", encoding="utf-8")
    monkeypatch.setattr(progetti, "REGISTRI", (("azienda", "Azienda", cartella, "project_"),))
    return cartella


# -------------------------------------------------------------------- parser

def test_riga_task_completa():
    t = cockpit._parse_task("sbloccare · Andrea · scad:2026-10-02 · check:a, b")
    assert t == {"testo": "sbloccare", "owner": "Andrea", "scad": "2026-10-02",
                 "fatto_il": None, "checks": ["a", "b"]}


def test_riga_task_minima_e_punto_nel_testo():
    assert cockpit._parse_task("solo testo")["owner"] is None
    t = cockpit._parse_task("A · Andrea · B · check:x")
    assert (t["testo"], t["owner"], t["checks"]) == ("A · B", "Andrea", ["x"])


def test_solo_le_righe_sotto_task_nel_blocco_stato():
    lista = cockpit.tasks(CARD_NUOVA)
    assert [t["testo"] for t in lista] == [
        "sbloccare il settle", "leggere il report", "rigenerare il token IG",
        "allineare /history", "scrivere il post-mortem"]
    assert lista[1]["spuntato"] and lista[1]["fatto_il"] == "2026-09-28"
    assert [t["indice"] for t in lista] == [0, 1, 2, 3, 4]


def test_card_vecchia_senza_area_ne_task_non_rompe_niente(registri):
    assert cockpit.tasks(CARD_VECCHIA) == []
    assert cockpit.tasks("") == []
    riga = next(s for s in progetti.elenco()["schede"] if s["file"] == "project_vecchia.md")
    assert riga["fase"] == "ATTIVO" and riga["done_quando"] == "mai"
    d = cockpit.cockpit("betredge", STATO, OGGI)
    ids = [p["id"] for p in d["progetti"]] + [p["id"] for p in d["archivio"]["elenco"]]
    assert "azienda/project_vecchia" not in ids   # niente Area: fuori da ogni area


# ---------------------------------------------------------------- derivazione

@pytest.mark.parametrize("spuntato,livelli,atteso", [
    (False, ["green"], "verificato dal check"),
    (False, ["green", "red"], "aperto"),
    (True, ["red"], "riaperto dal check"),
    (True, ["green"], "fatto"),
    (True, [], "fatto"),
    (False, [], "aperto"),
    (True, ["unknown"], "fatto"),
])
def test_stato_derivato_dal_check(spuntato, livelli, atteso):
    ids = [f"c{i}" for i in range(len(livelli))]
    checks = {c: {"level": lv} for c, lv in zip(ids, livelli)}
    t = {"spuntato": spuntato, "checks": ids}
    assert cockpit.stato_task(t, checks) == atteso


def test_richiedono_te_solo_azioni_umane_vere(registri):
    d = cockpit.cockpit("betredge", STATO, OGGI)
    titoli = sorted(r["titolo"] for r in d["richiedono_te"])
    assert titoli == sorted([
        "sbloccare il settle",            # task di Andrea, 2 check rossi -> 1 voce
        "rigenerare il token IG",         # non misurato, ma citato da un task di Andrea
        "scrivere il post-mortem",        # scaduto, card viva
        "launchd_daemon-health: 7 check rossi",   # rosso che nessuno ha preso
        "bloccata",                       # BLOCCATO fresco in attesa di Andrea
    ])
    settle = next(r for r in d["richiedono_te"] if r["titolo"] == "sbloccare il settle")
    assert {e["check"] for e in settle["evidenza"]} == {"cron_settle", "history_orfane"}
    assert settle["da_quando"] == "2026-09-30T19:00Z"   # 13 run rossi da 5 minuti
    assert settle["fonte"].startswith("card:azienda/project_settle riga ")
    # preso in carico da Michele: non sale, ma resta visibile
    assert not any("history_coerente" in r["titolo"] for r in d["richiedono_te"])
    assert d["in_carico"][0]["checks"] == ["history_coerente"]
    # l'ambra non citata va a guardare, non a richiedere
    assert [o["check"] for o in d["da_osservare"]] == ["cron_crm"]
    # la card ferma non compare in principale e il suo task scaduto non urla
    assert "azienda/project_stale" not in [p["id"] for p in d["progetti"]]
    assert d["archivio"]["conteggio"] == 1
    assert not any(r["titolo"] == "cosa dimenticata" for r in d["richiedono_te"])


def test_progresso_e_salute(registri):
    stato = json.loads(json.dumps(STATO))
    stato["checks"]["instagram_en"]["level"] = "green"
    d = cockpit.cockpit("betredge", stato, OGGI)
    p = next(p for p in d["progetti"] if p["id"] == "azienda/project_settle")
    assert (p["task_chiusi"], p["task_totali"]) == (2, 5)   # letto + verificato dal check
    assert p["goal"] == "zero pick finite senza esito"
    assert p["prossimo_task"] == "scrivere il post-mortem"   # scadenza piu' vicina
    assert p["salute"]["livello"] == "red"
    assert p["ultima_verifica"] == "2026-09-29"
    ig = next(t for t in p["tasks"] if t["testo"] == "rigenerare il token IG")
    assert ig["stato"] == "verificato dal check"
    # i numeri della banda: derivati qui, la pagina non li ricalcola
    assert d["numeri"] == {"progetti_attivi": 2, "bloccati": 1,
                           "daemon_vivi": 0, "daemon_totali": 1,
                           "ultima_spunta": "2026-09-28"}


def test_area_diversa_non_prende_i_check_di_betredge(registri):
    d = cockpit.cockpit("maven", STATO, OGGI)
    assert [p["id"] for p in d["progetti"]] == ["azienda/project_bloccata"]
    assert all(r["tipo"] == "bloccato" for r in d["richiedono_te"])


# ------------------------------------------------------------------ scrittura

def test_segna_fatto_tocca_solo_quella_riga(registri):
    f = registri / "project_settle.md"
    prima = f.read_text(encoding="utf-8")
    esito = cockpit.segna_fatto("azienda/project_settle", 4, "scrivere il post-mortem", OGGI)
    assert esito["ok"], esito
    dopo = f.read_text(encoding="utf-8")
    diff = [(a, b) for a, b in zip(prima.splitlines(), dopo.splitlines()) if a != b]
    assert diff == [(">   - [ ] scrivere il post-mortem · Andrea · scad:2026-09-20",
                     ">   - [x] scrivere il post-mortem · Andrea · scad:2026-09-20 · fatto:2026-09-30")]
    assert len(prima.splitlines()) == len(dopo.splitlines())
    assert (registri / "project_settle.md.bak").read_text(encoding="utf-8") == prima
    assert not list(registri.glob(".task-*"))
    assert cockpit.tasks(dopo)[4]["fatto_il"] == "2026-09-30"


def test_segna_fatto_rifiuta(registri):
    f = registri / "project_settle.md"
    prima = f.read_text(encoding="utf-8")
    assert cockpit.segna_fatto("azienda/project_settle", 4, "un altro testo")["ok"] is False
    assert cockpit.segna_fatto("azienda/project_settle", 1, "leggere il report")["errore"] == "gia' fatto"
    assert cockpit.segna_fatto("azienda/project_settle", 99, "x")["ok"] is False
    assert f.read_text(encoding="utf-8") == prima
    assert not (registri / "project_settle.md.bak").exists()


@pytest.mark.parametrize("cattivo", [
    "../segreto", "azienda/../segreto", "/etc/passwd", "azienda/../../segreto",
    "azienda/project_settle.md", "", "azienda", "privato/project_settle",
])
def test_segna_fatto_mai_traversal(registri, cattivo):
    esito = cockpit.segna_fatto(cattivo, 0, "sbloccare il settle")
    assert esito == {"ok": False, "errore": "card non nell'indice"}
    assert (registri.parent / "segreto.md").read_text(encoding="utf-8") == "non toccare"


# -------------------------------------------------------------------- server

@pytest.fixture
def servito(registri, tmp_path, monkeypatch):
    stato = tmp_path / "state.json"
    stato.write_text(json.dumps(STATO), encoding="utf-8")
    monkeypatch.setattr(server, "STATE_FILE", stato)
    httpd = server.make_server(0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def _post(url, corpo, headers):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def test_endpoint_cockpit(servito):
    with urllib.request.urlopen(servito + "/api/cockpit?area=betredge") as r:
        d = json.loads(r.read())
    assert len(d["richiedono_te"]) == 5
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(servito + "/api/cockpit?area=../x")
    assert e.value.code == 400


def test_endpoint_task_fatto_token_e_origin(servito, registri):
    corpo = {"id": "azienda/project_settle", "indice": 4, "testo": "scrivere il post-mortem"}
    url = servito + "/api/task/fatto"
    assert _post(url, corpo, {})[0] == 403
    assert _post(url, corpo, {"X-CC-Token": ensure_token(),
                              "Origin": "http://evil.example"})[0] == 403
    assert "[ ] scrivere il post-mortem" in (registri / "project_settle.md").read_text()
    codice, esito = _post(url, corpo, {"X-CC-Token": ensure_token(), "Origin": servito})
    assert (codice, esito["ok"]) == (200, True)
    codice, esito = _post(url, corpo, {"X-CC-Token": ensure_token()})
    assert (codice, esito["errore"]) == (409, "gia' fatto")
    assert _post(url, {**corpo, "indice": "x"}, {"X-CC-Token": ensure_token()})[0] == 400


# ------------------------------------------------- progetto, workstream, hub

CARD_PROGETTO = """---
description: "BetRedge — il progetto"
---
<!-- STATO:start -->
> 🟢 **STATO 2026-09-30 · `ATTIVO`**
> **Tipo:** progetto
> **Nome:** BetRedge
> **Area:** betredge
> **Done quando:** track record pubblico coerente col DB
> **Goal:**
>   - track record pubblico · attuale:58.2% su 3090 · obiettivo:da decidere · check:history_coerente
>   - arretrato settle · attuale:1930 · obiettivo:0 · check:cron_settle
>   - ricavi mensili
> **Task:**
>   - [x] creare la card progetto · Claude · fatto:2026-09-30
<!-- STATO:end -->
"""

CARD_CATTIVA = """<!-- STATO:start -->
> **STATO 2026-09-29 · `ATTIVO`**
> **Area:** ../../etc, BETREDGE
> **Task:**
>   - [ ] niente · Claude
<!-- STATO:end -->
"""


@pytest.fixture
def con_progetto(registri):
    (registri / "project_betredge.md").write_text(CARD_PROGETTO, encoding="utf-8")
    (registri / "project_cattiva.md").write_text(CARD_CATTIVA, encoding="utf-8")
    return registri


def test_goal_parser_non_inventa_numeri():
    g = cockpit.goals(CARD_PROGETTO)
    assert [x["testo"] for x in g] == ["track record pubblico", "arretrato settle",
                                      "ricavi mensili"]
    assert g[0]["attuale"] == "58.2% su 3090" and g[0]["obiettivo"] == "da decidere"
    assert g[0]["checks"] == ["history_coerente"] and not g[0]["numerico"]
    assert (g[1]["attuale"], g[1]["obiettivo"], g[1]["numerico"]) == ("1930", "0", True)
    assert (g[2]["attuale"], g[2]["obiettivo"]) == ("non misurato", "da decidere")
    # i task non sono goal e i goal non sono task
    assert [t["testo"] for t in cockpit.tasks(CARD_PROGETTO)] == ["creare la card progetto"]


def test_card_progetto_non_e_un_workstream(con_progetto):
    d = cockpit.cockpit("betredge", STATO, OGGI)
    p = d["progetto"]
    assert (p["id"], p["nome"], p["fase"]) == ("azienda/project_betredge", "BetRedge", "ATTIVO")
    assert "azienda/project_betredge" not in [w["id"] for w in d["workstream"]]
    assert d["progetti"] is d["workstream"]              # alias per cockpit.html
    # settle + cattiva (vive) + stale (archivio) + bloccata ("BetRedge, maven")
    assert p["n_workstream"] == 4 and p["n_workstream_attivi"] == 3
    assert p["salute"]["livello"] == "red"
    assert p["goal"][1]["salute"] == "red" and p["goal"][2]["salute"] is None
    assert p["avanzamento"]["task_totali"] == 1 + 5 + 1 + 1   # anche la card in archivio
    assert d["verdetto"] == {"livello": "red", "n_richiedono_te": len(d["richiedono_te"])}


def test_nome_breve_con_ripiego():
    assert cockpit.nome_breve({"nome": "Settle"}, "project_x") == "Settle"
    assert cockpit.nome_breve({}, "project_settlement_recovery") == "Settlement recovery"


def test_area_senza_card_progetto_non_rompe(registri):
    d = cockpit.cockpit("betredge", STATO, OGGI)
    assert d["progetto"] is None and d["workstream"]


def test_hub_aggrega_e_deduplica(con_progetto):
    h = cockpit.hub(STATO, OGGI)
    # aree dalle card; `../../etc` si spezza sui `/` come ogni Area, e i
    # pezzi `..` non sono slug validi: nessuna area esce dalla forma a-z0-9_-
    assert h["aree"] == ["betredge", "etc", "maven"]
    assert all(cockpit.area_valida(a) for a in h["aree"])
    assert [p["nome"] for p in h["progetti"]] == ["BetRedge"]   # maven non ha card progetto
    b = cockpit.cockpit("betredge", STATO, OGGI)
    m = cockpit.cockpit("maven", STATO, OGGI)
    assert m["verdetto"]["n_richiedono_te"] == 1           # la card bloccata, anche qui
    # la bloccata sta in due aree: nel verdetto globale conta una volta
    assert h["verdetto"] == {"livello": "red",
                             "n_richiedono_te": b["verdetto"]["n_richiedono_te"]}
    p = h["progetti"][0]
    assert p["n_richiedono_te"] == b["verdetto"]["n_richiedono_te"]
    assert p["n_workstream"] == 4 and p["salute"] == "red" and h["slot_liberi"] is True
    assert p["goal_sintesi"] == "track record pubblico coerente col DB"


def test_verdetto_verde_senza_richieste():
    assert cockpit.livello_verdetto([]) == "green"
    assert cockpit.livello_verdetto([{"tipo": "task", "evidenza": []}]) == "amber"
    assert cockpit.livello_verdetto([{"tipo": "check"}]) == "red"


def test_endpoint_hub_e_cockpit_senza_traversal(servito, con_progetto):
    with urllib.request.urlopen(servito + "/api/hub") as r:
        h = json.loads(r.read())
    assert [p["id"] for p in h["progetti"]] == ["azienda/project_betredge"]
    with urllib.request.urlopen(servito + "/api/cockpit?area=betredge") as r:
        assert json.loads(r.read())["progetto"]["nome"] == "BetRedge"
    for cattivo in ("../etc", "..%2F..%2Fetc", "%2e%2e", "BetRedge/../x", ""):
        with pytest.raises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(servito + "/api/cockpit?area=" + cattivo)
        assert e.value.code == 400
