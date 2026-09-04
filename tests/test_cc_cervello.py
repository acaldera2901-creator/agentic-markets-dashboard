"""Il grafo del cervello: cosa deve restare vero perche' la mappa non menta."""

import json
import threading
import urllib.request

import pytest

from tools.control_center import cervello
from tools.control_center import collector
from tools.control_center import server as srv


@pytest.fixture
def radice(tmp_path):
    """Un cervello finto con la stessa forma di quello vero."""
    for cartella in (
        "0-working",
        "1-episodic/council",
        "1-episodic/learning",
        "2-semantic/progetti",
        "2-semantic/persone",
        "3-procedural",
        "4-archivio/vecchio",
    ):
        (tmp_path / cartella).mkdir(parents=True, exist_ok=True)
    return tmp_path


def _scrivi(radice, rel, testo):
    percorso = radice / rel
    percorso.parent.mkdir(parents=True, exist_ok=True)
    percorso.write_text(testo, encoding="utf-8")
    return percorso


def _grafo(radice, tmp_path, nome="uscita"):
    return cervello.aggiorna(
        radice=radice,
        uscita=tmp_path / f"{nome}.json",
        cache=tmp_path / f"{nome}-cache.json",
    )


def _nodo(grafo, nid):
    return next((n for n in grafo["nodes"] if n["id"] == nid), None)


# ------------------------------------------------------------------ il tipo

def test_il_frontmatter_vince_sulla_cartella(radice, tmp_path):
    # `feedback_*` vive in 2-semantic/progetti ma non e' un progetto: se
    # vincesse la cartella, 111 note diventerebbero progetti inesistenti.
    _scrivi(radice, "2-semantic/progetti/feedback_x.md", "---\ntype: feedback\n---\nciao")
    assert _nodo(_grafo(radice, tmp_path), "2-semantic/progetti/feedback_x")["tipo"] == "feedback"


def test_il_type_annidato_sotto_metadata_conta_quanto_quello_in_cima(radice, tmp_path):
    _scrivi(
        radice,
        "2-semantic/progetti/p.md",
        "---\nname: p\nmetadata: \n  node_type: memory\n  type: project\n---\ntesto",
    )
    assert _nodo(_grafo(radice, tmp_path), "2-semantic/progetti/p")["tipo"] == "progetto"


def test_project_e_progetto_non_sono_due_categorie(radice, tmp_path):
    # 198 file dichiarano `type: project` mentre la cartella dice `progetto`:
    # tenerli distinti darebbe una legenda con due voci per la stessa cosa.
    _scrivi(radice, "2-semantic/progetti/a.md", "---\ntype: project\n---\nx")
    _scrivi(radice, "2-semantic/progetti/b.md", "nessun frontmatter")
    grafo = _grafo(radice, tmp_path)
    assert {_nodo(grafo, "2-semantic/progetti/a")["tipo"],
            _nodo(grafo, "2-semantic/progetti/b")["tipo"]} == {"progetto"}


def test_senza_frontmatter_decide_la_cartella(radice, tmp_path):
    _scrivi(radice, "2-semantic/persone/ANDREA.md", "Andrea.")
    _scrivi(radice, "3-procedural/standard.md", "Le regole.")
    _scrivi(radice, "0-working/oggi.md", "Oggi.")
    grafo = _grafo(radice, tmp_path)
    assert _nodo(grafo, "2-semantic/persone/ANDREA")["tipo"] == "persona"
    assert _nodo(grafo, "3-procedural/standard")["tipo"] == "procedura"
    assert _nodo(grafo, "0-working/oggi")["tipo"] == "nota"


# ------------------------------------------------------------------ la fase

@pytest.mark.parametrize(
    "parola,atteso",
    [("ATTIVO", "🟢 ATTIVO"), ("BLOCCATO", "🔴 BLOCCATO"),
     ("OPERATIVO", "⚙️ OPERATIVO"), ("ARCHIVIATO", "📦 ARCHIVIATO")],
)
def test_la_fase_si_legge_dal_blocco_stato(radice, tmp_path, parola, atteso):
    _scrivi(
        radice,
        "2-semantic/progetti/project_x.md",
        f"---\ntype: project\n---\n<!-- STATO:start -->\n"
        f"> **STATO 2026-09-01 · `{parola}`**\n>\n> **Done quando:** mai.\n"
        f"<!-- STATO:end -->\ntesto",
    )
    nodo = _nodo(_grafo(radice, tmp_path), "2-semantic/progetti/project_x")
    assert nodo["fase"] == atteso


def test_senza_blocco_stato_la_fase_e_nulla_non_inventata(radice, tmp_path):
    _scrivi(radice, "2-semantic/progetti/project_y.md", "---\ntype: project\n---\ntesto")
    assert _nodo(_grafo(radice, tmp_path), "2-semantic/progetti/project_y")["fase"] is None


# ------------------------------------------------------------------ gli archi

def test_il_wikilink_si_risolve_per_nome_di_file(radice, tmp_path):
    _scrivi(radice, "2-semantic/progetti/uno.md", "vedi [[due]]")
    _scrivi(radice, "2-semantic/progetti/due.md", "sono due")
    grafo = _grafo(radice, tmp_path)
    assert {"da": "2-semantic/progetti/uno", "a": "2-semantic/progetti/due",
            "rel": "linka", "origine": "wikilink"} in grafo["edges"]


def test_il_wikilink_si_risolve_anche_per_percorso_intero(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "vedi [[2-semantic/progetti/due]]")
    _scrivi(radice, "2-semantic/progetti/due.md", "sono due")
    grafo = _grafo(radice, tmp_path)
    assert grafo["edges"][0]["a"] == "2-semantic/progetti/due"


def test_sezione_e_alias_non_cambiano_il_bersaglio(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "vedi [[due#la-parte|quella cosa li']]")
    _scrivi(radice, "2-semantic/progetti/due.md", "sono due")
    assert _grafo(radice, tmp_path)["edges"][0]["a"] == "2-semantic/progetti/due"


def test_due_link_uguali_sono_un_arco_solo(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "[[due]] e ancora [[due]] e poi [[due]]")
    _scrivi(radice, "2-semantic/progetti/due.md", "x")
    assert len(_grafo(radice, tmp_path)["edges"]) == 1


def test_un_nome_ambiguo_non_si_indovina(radice, tmp_path):
    # Due README non sono lo stesso nodo: sceglierne uno inventerebbe un arco.
    _scrivi(radice, "0-working/oggi.md", "vedi [[README]]")
    _scrivi(radice, "2-semantic/progetti/README.md", "a")
    _scrivi(radice, "1-episodic/council/README.md", "b")
    grafo = _grafo(radice, tmp_path)
    assert _nodo(grafo, "README")["tipo"] == "mancante"


def test_un_link_rotto_diventa_un_nodo_mancante_col_suo_nome(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "vedi [[project_che_non_esiste]]")
    grafo = _grafo(radice, tmp_path)
    mancante = _nodo(grafo, "project_che_non_esiste")
    assert mancante["tipo"] == "mancante" and mancante["peso"] == 0
    assert mancante["toccato"] is None
    assert grafo["conteggi"]["mancanti"] == 1


def test_i_wikilink_dentro_un_blocco_di_codice_non_sono_archi(radice, tmp_path):
    # `[[...slug]]` e' una rotta Next.js incollata in un esempio.
    _scrivi(radice, "0-working/oggi.md", "testo\n\n```\napp/[[...slug]]/page.tsx\n```\n\nfine")
    grafo = _grafo(radice, tmp_path)
    assert grafo["edges"] == []
    assert grafo["conteggi"]["mancanti"] == 0


def test_i_segnaposto_di_esempio_non_diventano_nodi(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "la sintassi e' [[A]], [[X]] oppure [[...]]")
    assert _grafo(radice, tmp_path)["conteggi"]["mancanti"] == 0


def test_un_file_che_linka_se_stesso_non_fa_un_cappio(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "io sono [[oggi]]")
    assert _grafo(radice, tmp_path)["edges"] == []


def test_lo_scope_di_perimetro_non_diventa_un_arco(radice, tmp_path):
    # `scope: azienda` e' un'etichetta, non un riferimento: farne un arco
    # creerebbe un hub con 290 archi che nasconde il grafo vero.
    _scrivi(radice, "2-semantic/progetti/p.md", "---\nname: p\nscope: azienda\n---\nx")
    assert _grafo(radice, tmp_path)["edges"] == []


def test_il_grado_conta_gli_archi_e_gli_orfani_sono_quelli_a_zero(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "[[due]]")
    _scrivi(radice, "2-semantic/progetti/due.md", "x")
    _scrivi(radice, "2-semantic/progetti/solo.md", "nessuno mi linka")
    grafo = _grafo(radice, tmp_path)
    assert _nodo(grafo, "0-working/oggi")["grado"] == 1
    assert _nodo(grafo, "2-semantic/progetti/due")["grado"] == 1
    assert _nodo(grafo, "2-semantic/progetti/solo")["grado"] == 0
    assert grafo["conteggi"]["orfani"] == 1


# ------------------------------------------------------------------ l'archivio

def test_l_archivio_entra_solo_se_un_vivo_lo_cita(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "vedi [[vecchio-citato]]")
    _scrivi(radice, "4-archivio/vecchio/vecchio-citato.md", "sono vecchio")
    _scrivi(radice, "4-archivio/vecchio/vecchio-muto.md", "nessuno mi cita")
    grafo = _grafo(radice, tmp_path)
    citato = _nodo(grafo, "4-archivio/vecchio/vecchio-citato")
    assert citato is not None and citato["tipo"] == "archivio"
    assert _nodo(grafo, "4-archivio/vecchio/vecchio-muto") is None


def test_l_archivio_non_trascina_dentro_il_suo_sottografo(radice, tmp_path):
    # I file archiviati puntano a strutture di vault che non esistono piu':
    # seguirli riempirebbe il grafo di mancanti che non mancano a nessuno.
    _scrivi(radice, "0-working/oggi.md", "vedi [[vecchio-citato]]")
    _scrivi(radice, "4-archivio/vecchio/vecchio-citato.md", "vedi [[11_LLM_COUNCIL/Group_Chat]]")
    grafo = _grafo(radice, tmp_path)
    assert grafo["conteggi"]["mancanti"] == 0
    assert [e["da"] for e in grafo["edges"]] == ["0-working/oggi"]


def test_il_group_chat_intero_non_si_conta_due_volte(radice, tmp_path):
    _scrivi(radice, "1-episodic/council/Group_Chat-2026-08.md", "[[due]]")
    _scrivi(radice, "1-episodic/council/Group_Chat-ORIGINALE-INTERO.md", "[[due]]")
    _scrivi(radice, "2-semantic/progetti/due.md", "x")
    grafo = _grafo(radice, tmp_path)
    assert _nodo(grafo, "1-episodic/council/Group_Chat-ORIGINALE-INTERO") is None
    assert _nodo(grafo, "1-episodic/council/Group_Chat-2026-08")["tipo"] == "council"


# ------------------------------------------------------------------ la cache

def test_un_file_immutato_non_si_rilegge(radice, tmp_path):
    percorso = _scrivi(radice, "0-working/oggi.md", "testo vero")
    _, cache = cervello.raccogli(radice)
    # Si falsifica la scheda in cache lasciando intatta la firma: se il file
    # venisse riletto, l'etichetta tornerebbe quella vera.
    cache["0-working/oggi.md"]["scheda"]["etichetta"] = "VENUTA DALLA CACHE"
    schede, _ = cervello.raccogli(radice, cache)
    assert schede["0-working/oggi.md"]["etichetta"] == "VENUTA DALLA CACHE"

    percorso.write_text("testo cambiato, e piu' lungo di prima", encoding="utf-8")
    schede, _ = cervello.raccogli(radice, cache)
    assert schede["0-working/oggi.md"]["etichetta"] == "oggi"


# ------------------------------------------------------------------ la posizione

def test_un_cervello_immutato_da_posizioni_identiche(radice, tmp_path):
    # E' la ragione per cui il grafo e' guardabile: se le posizioni cambiassero
    # a ogni giro la pagina ballerebbe pur essendo corretta.
    _scrivi(radice, "0-working/oggi.md", "[[due]] [[tre]]")
    _scrivi(radice, "2-semantic/progetti/due.md", "[[tre]]")
    _scrivi(radice, "2-semantic/progetti/tre.md", "x")
    primo = _grafo(radice, tmp_path)
    secondo = _grafo(radice, tmp_path)
    assert [(n["id"], n["x"], n["y"]) for n in primo["nodes"]] == \
           [(n["id"], n["x"], n["y"]) for n in secondo["nodes"]]


def test_un_nodo_nuovo_nasce_vicino_a_chi_lo_cita(radice, tmp_path):
    _scrivi(radice, "2-semantic/progetti/uno.md", "x")
    _scrivi(radice, "2-semantic/progetti/due.md", "x")
    _grafo(radice, tmp_path)
    _scrivi(radice, "2-semantic/progetti/tre.md", "vedi [[uno]]")
    grafo = _grafo(radice, tmp_path)
    tre, uno, due = (_nodo(grafo, f"2-semantic/progetti/{x}") for x in ("tre", "uno", "due"))
    vicino = (tre["x"] - uno["x"]) ** 2 + (tre["y"] - uno["y"]) ** 2
    lontano = (tre["x"] - due["x"]) ** 2 + (tre["y"] - due["y"]) ** 2
    assert vicino < lontano


def test_ogni_nodo_ha_una_posizione(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "[[due]] [[mai-scritto]]")
    _scrivi(radice, "2-semantic/progetti/due.md", "x")
    _scrivi(radice, "2-semantic/progetti/orfano.md", "x")
    for nodo in _grafo(radice, tmp_path)["nodes"]:
        assert isinstance(nodo["x"], float) and isinstance(nodo["y"], float)


def test_un_cervello_vuoto_non_esplode(radice, tmp_path):
    grafo = _grafo(radice, tmp_path)
    assert grafo["conteggi"] == {"nodi": 0, "archi": 0, "mancanti": 0, "orfani": 0}
    assert grafo["assente"] is False


# ------------------------------------------------------------------ la consegna

def test_il_file_si_scrive_intero_o_niente(radice, tmp_path):
    _scrivi(radice, "0-working/oggi.md", "x")
    uscita = tmp_path / "uscita.json"
    _grafo(radice, tmp_path)
    letto = json.loads(uscita.read_text())
    assert letto["assente"] is False and letto["nodes"]
    assert not list(tmp_path.glob(".cervello-*.tmp"))


def test_api_cervello_serve_il_grafo(radice, tmp_path, mocker):
    _scrivi(radice, "0-working/oggi.md", "[[due]]")
    _scrivi(radice, "2-semantic/progetti/due.md", "x")
    cervello.aggiorna(radice=radice, uscita=tmp_path / "cervello.json",
                      cache=tmp_path / "cervello-cache.json")
    mocker.patch.object(srv, "STATE_FILE", tmp_path / "state.json")
    httpd = srv.make_server(port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        url = f"http://127.0.0.1:{httpd.server_address[1]}/api/cervello"
        with urllib.request.urlopen(url, timeout=5) as r:
            assert r.headers["Content-Type"].startswith("application/json")
            corpo = json.loads(r.read())
    finally:
        httpd.shutdown()
    assert corpo["assente"] is False
    assert corpo["conteggi"]["nodi"] == 2 and corpo["conteggi"]["archi"] == 1


def test_se_non_e_mai_girato_lo_dice_invece_di_dare_un_grafo_vuoto(tmp_path, mocker):
    # Un grafo vuoto si legge come "il cervello non ha niente dentro", che e'
    # il contrario di "il parser non e' mai partito".
    mocker.patch.object(srv, "STATE_FILE", tmp_path / "state.json")
    httpd = srv.make_server(port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        url = f"http://127.0.0.1:{httpd.server_address[1]}/api/cervello"
        with urllib.request.urlopen(url, timeout=5) as r:
            corpo = json.loads(r.read())
    finally:
        httpd.shutdown()
    assert corpo == {"assente": True}


# ------------------------------------------------------------------ la cadenza

def test_il_dry_run_del_collector_non_tocca_il_cervello(mocker):
    mocker.patch.object(collector, "all_checks", return_value=[])
    mocker.patch.object(collector, "run_checks", return_value={})
    aggiorna = mocker.patch.object(collector.cervello, "aggiorna")
    collector.main(["--dry-run"])
    assert not aggiorna.called


def test_il_collector_aggiorna_il_grafo_a_ogni_giro(mocker):
    mocker.patch.object(collector, "collect", return_value={"summary": {}})
    aggiorna = mocker.patch.object(
        collector.cervello, "aggiorna", return_value={"conteggi": {"nodi": 1}}
    )
    assert collector.main([]) == 0
    assert aggiorna.called


def test_un_grafo_che_non_si_genera_non_uccide_il_collector(mocker):
    # I check sono gia' salvati: un parser rotto non deve portarsi via anche
    # la sorveglianza, che e' il lavoro vero del collector.
    mocker.patch.object(collector, "collect", return_value={"summary": {}})
    mocker.patch.object(collector.cervello, "aggiorna", side_effect=OSError("disco pieno"))
    assert collector.main([]) == 0
