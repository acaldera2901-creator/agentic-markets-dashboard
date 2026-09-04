"""Il grafo del cervello: nodi, archi, e una posizione che non balla.

La fonte e' `~/Desktop/00-SISTEMA/cervello/`, letta e mai scritta. Un file `.md`
e' un nodo, un wikilink e' un arco. Il risultato finisce in
`~/.betredge-cc/cervello.json`, che la pagina legge e basta: il grafo non si
calcola dentro la richiesta, come non ci si calcola nessun altro tile.

Quattro decisioni che non si leggono dal codice:

1. **L'archivio non entra col suo sottografo.** `4-archivio/` e' un record
   storico: i suoi 380 file portano 885 wikilink verso strutture di vault che
   non esistono piu' (`[[11_LLM_COUNCIL/Group_Chat]]`), e disegnarli
   raddoppierebbe il grafo con nodi mancanti che non mancano a nessuno.
   Pero' l'archivio resta nell'**indice di risoluzione**: se un file vivo
   linka un file archiviato, quel nodo compare — attenuato, `tipo: archivio` —
   invece di risultare `mancante`. Un archivio invisibile che fa sembrare rotti
   i link vivi sarebbe peggio dell'archivio.
2. **`Group_Chat-ORIGINALE-INTERO.md` si salta.** E' 2,8 MB e contiene
   esattamente la stessa cosa dei `Group_Chat-<mese>.md` gia' tagliati accanto:
   tenerlo conterebbe ogni messaggio due volte.
3. **Il rumore non e' dove sembra.** I `[[...]]` dentro un blocco di codice
   recintato non sono archi — ma sul corpus di oggi ne tolgono **zero**: il
   filtro e' una guardia, non una pulizia. Il rumore vero sono i segnaposto
   della prosa che spiega la sintassi (`[[A]]`, `[[X]]`, `[[...]]`), e li
   toglie `_e_un_nome`. Togliere anche il **codice inline** e' stato misurato
   e scartato: costerebbe 10 riferimenti veri (la gente scrive
   `` `[[feedback_workflow_andrea]]` ``) per togliere 10 pezzi di rumore.
4. **Il `type:` del frontmatter vince, ma passa da un vocabolario solo.**
   198 file in `2-semantic/progetti/` dichiarano `type: project` mentre la
   cartella dice `progetto`: lasciarli entrambi darebbe due categorie per la
   stessa cosa e una legenda che mente. Gli alias normalizzano, il resto passa.

Il costo vero non e' il calcolo, e' la rilettura: ~9 MB di markdown ogni 5
minuti. La cache tiene `(mtime, size)` per file e riparsa solo i cambiati.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from .snapshot import STATE_DIR

RADICE = Path.home() / "Desktop" / "00-SISTEMA" / "cervello"
USCITA = STATE_DIR / "cervello.json"
CACHE = STATE_DIR / "cervello-cache.json"

ARCHIVIO = "4-archivio"
SALTA = {"Group_Chat-ORIGINALE-INTERO.md"}

# `\[\[TARGET(#sezione)?(\|alias)?\]\]`. Il target non puo' contenere `|`, `#`
# ne' parentesi quadre: senza questo un `[[a]] [[b]]` sulla stessa riga viene
# letto come un unico link chiamato "a]] [[b".
WIKILINK = re.compile(r"\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|([^\[\]]*))?\]\]")

# Il blocco STATO dei `project_*.md`. La fase e' l'unica cosa che serve al
# grafo: il resto (Done quando, Prossima azione) e' testo da leggere aprendo
# il file, non da colorare un nodo.
FASE = re.compile(r"STATO[^\n`]*`(ATTIVO|BLOCCATO|OPERATIVO|ARCHIVIATO)`")
EMOJI_FASE = {
    "ATTIVO": "🟢 ATTIVO",
    "BLOCCATO": "🔴 BLOCCATO",
    "OPERATIVO": "⚙️ OPERATIVO",
    "ARCHIVIATO": "📦 ARCHIVIATO",
}

# Cartella -> tipo, in ordine di specificita' (il primo prefisso che combacia).
DA_CARTELLA = (
    ("2-semantic/persone", "persona"),
    ("2-semantic/progetti", "progetto"),
    ("2-semantic/agenti", "agente"),
    ("1-episodic/learning", "lezione"),
    ("1-episodic/council", "council"),
    ("3-procedural", "procedura"),
)

ALIAS_TIPO = {
    "project": "progetto",
    "agent": "agente",
    "user": "persona",
    "note": "nota",
    "knowledge": "nota",
    "decision": "decisione",
    "study": "studio",
    "conversazione-jarvis": "diario",
    "direct_message_log": "diario",
}


# --------------------------------------------------------------------------
# lettura


def _frontmatter(testo: str) -> tuple[dict, dict]:
    """Le chiavi di primo livello e quelle sotto `metadata:`.

    A mano e non con PyYAML perche' il frontmatter qui non e' sempre YAML
    valido (valori con apici sbilanciati, `metadata: ` con lo spazio in coda) e
    un parser severo si fermerebbe su file che invece hanno il `type:` giusto.
    Servono cinque chiavi, non un documento.
    """
    if not testo.startswith("---"):
        return {}, {}
    fine = testo.find("\n---", 3)
    if fine < 0:
        return {}, {}
    top: dict[str, str] = {}
    meta: dict[str, str] = {}
    dentro_meta = False
    for riga in testo[3:fine].splitlines():
        coppia = re.match(r"^(\s*)([A-Za-z_][\w-]*)\s*:\s*(.*)$", riga)
        if not coppia:
            continue
        rientro, chiave, valore = coppia.groups()
        valore = valore.strip().strip('"').strip("'")
        if rientro:
            if dentro_meta:
                meta[chiave] = valore
        else:
            dentro_meta = chiave == "metadata"
            top[chiave] = valore
    return top, meta


def _senza_codice(testo: str) -> str:
    """Il testo senza i blocchi ``` recintati.

    Guardia, non pulizia: misurato il 04/09 non toglie **nessun** bersaglio dei
    592 presenti. Resta perche' un blocco recintato e' l'unico posto dove un
    `[[x]]` non e' un riferimento per costruzione, e il cervello accumula
    documenti che spiegano la sintassi dei wikilink (il nodo mancante `TARGET`
    nasce esattamente da uno di quelli). Il codice **inline** invece non si
    tocca: vedi la nota 3 in cima al modulo.
    """
    if "```" not in testo:
        return testo
    fuori = []
    dentro = False
    for riga in testo.splitlines():
        if riga.lstrip().startswith("```"):
            dentro = not dentro
            continue
        if not dentro:
            fuori.append(riga)
    return "\n".join(fuori)


def _e_un_nome(bersaglio: str) -> bool:
    """Filtra i `[[...]]` che non sono riferimenti ma segnaposto di esempio.

    Restano `[[...]]`, `[[A]]`, `[[X]]`: nascono da prosa che spiega la sintassi
    dei wikilink, non da un collegamento. Un nodo mancante chiamato `...` e'
    spazzatura visibile in mezzo a un grafo di nodi mancanti veri, che invece
    vanno guardati. Tutto il resto passa: un link rotto e' un dato, non rumore.
    """
    return len(bersaglio) > 1 and any(c.isalnum() for c in bersaglio)


def _tipo(rel: str, top: dict, meta: dict) -> str:
    dichiarato = (top.get("type") or meta.get("type") or "").strip().lower()
    if dichiarato:
        return ALIAS_TIPO.get(dichiarato, dichiarato)
    for prefisso, tipo in DA_CARTELLA:
        if rel.startswith(prefisso + "/"):
            return tipo
    return "nota"


def _leggi(percorso: Path, rel: str) -> dict:
    testo = percorso.read_text(encoding="utf-8", errors="replace")
    top, meta = _frontmatter(testo)
    fase = None
    if "STATO:start" in testo:
        trovata = FASE.search(testo)
        if trovata:
            fase = EMOJI_FASE[trovata.group(1)]
    # Duplicati e ordine: due link uguali sono un arco solo, ma l'ordine di
    # apparizione si tiene perche' rende il JSON stabile fra due giri.
    link: list[str] = []
    visti: set[str] = set()
    for bersaglio, _alias in WIKILINK.findall(_senza_codice(testo)):
        bersaglio = bersaglio.strip()
        if not _e_un_nome(bersaglio):
            continue
        if bersaglio not in visti:
            visti.add(bersaglio)
            link.append(bersaglio)
    return {
        "etichetta": top.get("title") or top.get("name") or percorso.stem,
        "tipo": _tipo(rel, top, meta),
        "fase": fase,
        "autore": top.get("author") or None,
        "ambito": top.get("scope") or None,
        "link": link,
        "peso": max(1, len(testo.encode("utf-8")) // 1024),
    }


def raccogli(radice: Path = RADICE, cache: dict | None = None) -> tuple[dict, dict]:
    """Ogni `.md` sotto la radice, letto o ripreso dalla cache.

    Ritorna `(schede, cache_nuova)`. La chiave di cache e' `(mtime, size)`: un
    file che non e' cambiato non si rilegge, ed e' l'unica ragione per cui i
    cinque `Group_Chat-*.md` (2,8 MB in tutto) non pesano ogni 5 minuti.
    """
    vecchia = cache or {}
    nuova: dict[str, dict] = {}
    schede: dict[str, dict] = {}
    for percorso in sorted(radice.rglob("*.md")):
        if percorso.name in SALTA or not percorso.is_file():
            continue
        rel = percorso.relative_to(radice).as_posix()
        try:
            info = percorso.stat()
        except OSError:
            continue
        firma = [int(info.st_mtime), info.st_size]
        precedente = vecchia.get(rel)
        if precedente and precedente.get("firma") == firma:
            scheda = precedente["scheda"]
        else:
            try:
                scheda = _leggi(percorso, rel)
            except OSError:
                continue
        nuova[rel] = {"firma": firma, "scheda": scheda}
        schede[rel] = {
            **scheda,
            "toccato": datetime.fromtimestamp(info.st_mtime, timezone.utc)
            .isoformat(timespec="seconds")
            .replace("+00:00", "Z"),
        }
    return schede, nuova


# --------------------------------------------------------------------------
# risoluzione


def _indice(schede: dict) -> tuple[dict, dict]:
    """Due mappe: per percorso e per nome di file (solo se univoco)."""
    per_percorso: dict[str, str] = {}
    per_nome: dict[str, list[str]] = {}
    for rel in schede:
        nid = rel[:-3] if rel.endswith(".md") else rel
        per_percorso[nid.lower()] = nid
        per_percorso[rel.lower()] = nid
        per_nome.setdefault(nid.rsplit("/", 1)[-1].lower(), []).append(nid)
    # Un basename ambiguo non si indovina: due `README` non sono lo stesso
    # nodo, e sceglierne uno a caso inventerebbe un arco.
    univoci = {nome: ids[0] for nome, ids in per_nome.items() if len(ids) == 1}
    return per_percorso, univoci


def _risolvi(bersaglio: str, per_percorso: dict, per_nome: dict) -> str | None:
    pulito = bersaglio.strip().lstrip("./")
    chiave = pulito.lower()
    if chiave.endswith(".md"):
        chiave = chiave[:-3]
    if chiave in per_percorso:
        return per_percorso[chiave]
    return per_nome.get(chiave.rsplit("/", 1)[-1])


def costruisci(schede: dict) -> tuple[list[dict], list[dict]]:
    """Nodi e archi. L'archivio entra solo se qualcuno di vivo lo cita."""
    per_percorso, per_nome = _indice(schede)
    vivi = {
        (rel[:-3] if rel.endswith(".md") else rel): scheda
        for rel, scheda in schede.items()
        if not rel.startswith(ARCHIVIO + "/")
    }
    archiviati = {
        (rel[:-3] if rel.endswith(".md") else rel): scheda
        for rel, scheda in schede.items()
        if rel.startswith(ARCHIVIO + "/")
    }

    archi: list[dict] = []
    visti: set[tuple[str, str, str]] = set()
    mancanti: dict[str, None] = {}
    citati_in_archivio: dict[str, None] = {}

    def aggiungi(da: str, a: str, rel: str, origine: str) -> None:
        if da == a:
            return
        chiave = (da, a, rel)
        if chiave in visti:
            return
        visti.add(chiave)
        archi.append({"da": da, "a": a, "rel": rel, "origine": origine})

    for nid, scheda in vivi.items():
        for bersaglio in scheda["link"]:
            risolto = _risolvi(bersaglio, per_percorso, per_nome)
            if risolto is None:
                # Il nodo mancante prende il nome che gli e' stato dato: e'
                # l'unica informazione che abbiamo, ed e' quella che serve per
                # capire se e' un refuso o un file da scrivere.
                risolto = bersaglio.strip()
                mancanti[risolto] = None
            elif risolto in archiviati:
                citati_in_archivio[risolto] = None
            aggiungi(nid, risolto, "linka", "wikilink")
        # `author:` non esiste ancora in nessun file del cervello (misurato:
        # 0 occorrenze) — la regola c'e' perche' il giorno che comparira' il
        # grafo lo mostrera' senza che nessuno ci ripensi.
        for campo, relazione in (("autore", "scritto_da"), ("ambito", "letto_da")):
            valore = scheda.get(campo)
            if not valore:
                continue
            risolto = _risolvi(valore, per_percorso, per_nome)
            # Solo se punta a un nodo vero: `scope: azienda` non e' un
            # riferimento, e' un'etichetta di perimetro. Trasformarla in arco
            # creerebbe due hub da 290 archi che nascondono il grafo vero.
            if risolto is not None:
                aggiungi(nid, risolto, relazione, "frontmatter")

    grado: dict[str, int] = {}
    for arco in archi:
        grado[arco["da"]] = grado.get(arco["da"], 0) + 1
        grado[arco["a"]] = grado.get(arco["a"], 0) + 1

    nodi: list[dict] = []
    for nid, scheda in vivi.items():
        nodi.append(
            {
                "id": nid,
                "etichetta": scheda["etichetta"],
                "tipo": scheda["tipo"],
                "fase": scheda["fase"],
                "peso": scheda["peso"],
                "toccato": scheda["toccato"],
                "grado": grado.get(nid, 0),
            }
        )
    for nid in citati_in_archivio:
        scheda = archiviati[nid]
        nodi.append(
            {
                "id": nid,
                "etichetta": scheda["etichetta"],
                "tipo": "archivio",
                "fase": scheda["fase"],
                "peso": scheda["peso"],
                "toccato": scheda["toccato"],
                "grado": grado.get(nid, 0),
            }
        )
    for nid in mancanti:
        nodi.append(
            {
                "id": nid,
                "etichetta": nid.rsplit("/", 1)[-1],
                "tipo": "mancante",
                "fase": None,
                "peso": 0,
                "toccato": None,
                "grado": grado.get(nid, 0),
            }
        )
    nodi.sort(key=lambda n: n["id"])
    archi.sort(key=lambda a: (a["da"], a["a"], a["rel"]))
    return nodi, archi


# --------------------------------------------------------------------------
# posizione


LATO = 1000.0
GRAVITA = 4.0


def disponi(nodi: list[dict], archi: list[dict], precedenti: dict) -> None:
    """Force-directed (Fruchterman-Reingold), seminato dal giro precedente.

    Il seme e' tutto: senza, ogni refresh ridisegna un grafo diverso e la
    pagina diventa illeggibile pur essendo corretta. Un nodo nuovo non parte a
    caso ma nel baricentro dei vicini che una posizione ce l'hanno gia', cosi'
    non arriva volando dall'angolo.
    """
    n = len(nodi)
    if n == 0:
        return
    indice = {nodo["id"]: i for i, nodo in enumerate(nodi)}
    pos = np.zeros((n, 2))
    noto = np.zeros(n, dtype=bool)
    for nodo in nodi:
        vecchia = precedenti.get(nodo["id"])
        if vecchia:
            pos[indice[nodo["id"]]] = vecchia
            noto[indice[nodo["id"]]] = True

    vicini: dict[int, list[int]] = {}
    for arco in archi:
        i, j = indice.get(arco["da"]), indice.get(arco["a"])
        if i is None or j is None:
            continue
        vicini.setdefault(i, []).append(j)
        vicini.setdefault(j, []).append(i)

    rng = np.random.default_rng(0)  # deterministico: due giri uguali, grafo uguale
    for i in range(n):
        if noto[i]:
            continue
        ancore = [pos[j] for j in vicini.get(i, []) if noto[j]]
        base = np.mean(ancore, axis=0) if ancore else np.zeros(2)
        pos[i] = base + rng.uniform(-LATO / 20, LATO / 20, 2)

    freddo = int((~noto).sum()) > n / 2
    # A freddo il grafo si costruisce da zero e servono molti passi caldi.
    # Seminato si **rilassa** soltanto, e il passo va tenuto corto: misurato
    # il 04/09, con `LATO/40` e 90 passi due giri identici spostavano i nodi
    # di 15-18 unita' su un campo da 800 e non calavano mai — non era
    # convergenza, era un ciclo limite. In un grafo con 338 orfani (un gas
    # repulsivo senza minimo netto) FR muove ogni nodo di tutta la
    # temperatura anche quando la forza vera e' trascurabile.
    passi = 300 if freddo else 60
    k = np.sqrt(LATO * LATO / n)
    temperatura = LATO / (8.0 if freddo else 200.0)
    raffredda = temperatura / (passi + 1)

    src = np.array([indice[a["da"]] for a in archi if a["da"] in indice], dtype=np.int64)
    dst = np.array([indice[a["a"]] for a in archi if a["a"] in indice], dtype=np.int64)

    for _ in range(passi):
        delta = pos[:, None, :] - pos[None, :, :]
        dist2 = np.einsum("ijk,ijk->ij", delta, delta)
        np.fill_diagonal(dist2, 1.0)
        np.maximum(dist2, 0.01, out=dist2)
        spinta = np.einsum("ijk,ij->ik", delta, (k * k) / dist2)

        if src.size:
            vettore = pos[src] - pos[dst]
            lunghezza = np.maximum(np.linalg.norm(vettore, axis=1), 0.01)
            tira = vettore * (lunghezza / k)[:, None]
            np.add.at(spinta, src, -tira)
            np.add.at(spinta, dst, tira)

        # Senza gravita' gli orfani (338, un terzo del grafo) finiscono
        # schiacciati contro i bordi: la repulsione li spinge fuori e nulla li
        # richiama, e il `clip` qui sotto diventa la cosa che disegna il
        # layout. Misurato il 04/09 al variare del tiro: a 0,2 restavano 383
        # nodi incollati al bordo e la distanza minima fra due nodi era 0,00
        # (sovrapposti nell'angolo); a 4,0 sono 0, e il raggio massimo (491)
        # sta dentro il riquadro — cioe' il `clip` non tocca piu' niente e la
        # forma la decide la fisica.
        spinta -= GRAVITA * pos

        norma = np.maximum(np.linalg.norm(spinta, axis=1), 0.01)
        pos += spinta / norma[:, None] * np.minimum(norma, temperatura)[:, None]
        np.clip(pos, -LATO / 2, LATO / 2, out=pos)
        temperatura -= raffredda

    # Si ricentra ma non si riscala: un riscalamento a ogni giro farebbe
    # "respirare" il grafo anche quando non e' cambiato nulla.
    pos -= pos.mean(axis=0)
    for nodo in nodi:
        x, y = pos[indice[nodo["id"]]]
        nodo["x"] = round(float(x), 2)
        nodo["y"] = round(float(y), 2)


# --------------------------------------------------------------------------
# scrittura


def _scrivi(dati: dict, percorso: Path) -> None:
    """Temporaneo piu' rename: il server non legge mai un grafo a meta'."""
    percorso.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(percorso.parent), prefix=".cervello-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
            # Compatto e non indentato: con `indent` lo stesso grafo passa da
            # 200 KB a 700 KB, e nessuno legge questo file a mano.
            json.dump(dati, fh, ensure_ascii=False, separators=(",", ":"))
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, percorso)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def impronta(nodi: list[dict], archi: list[dict]) -> str:
    """L'identita' strutturale del grafo: chi c'e' e chi punta a chi.

    Serve a garantire, non a ottimizzare: se il cervello non e' cambiato, le
    posizioni devono restare **identiche**, non "quasi". Il seme da solo non
    basta — near equilibrium FR muove comunque ogni nodo di tutta la
    temperatura, e la pagina ballava di 15 unita' a ogni refresh.
    """
    digerente = hashlib.sha1(usedforsecurity=False)
    for nodo in nodi:
        digerente.update(nodo["id"].encode() + b"\0")
    digerente.update(b"|")
    for arco in archi:
        digerente.update(f"{arco['da']}>{arco['a']}:{arco['rel']}\0".encode())
    return digerente.hexdigest()


def aggiorna(radice: Path = RADICE, uscita: Path = USCITA, cache: Path = CACHE) -> dict:
    partenza = time.perf_counter()
    try:
        vecchia = json.loads(cache.read_text())
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        vecchia = {}
    precedente: dict = {}
    try:
        precedente = json.loads(uscita.read_text())
        posizioni = {
            nodo["id"]: (nodo["x"], nodo["y"])
            for nodo in precedente.get("nodes", [])
            if "x" in nodo and "y" in nodo
        }
    except (FileNotFoundError, json.JSONDecodeError, OSError, KeyError, TypeError):
        posizioni = {}

    schede, cache_nuova = raccogli(radice, vecchia)
    nodi, archi = costruisci(schede)

    firma = impronta(nodi, archi)
    invariato = firma == precedente.get("impronta") and all(
        nodo["id"] in posizioni for nodo in nodi
    )
    if invariato:
        for nodo in nodi:
            nodo["x"], nodo["y"] = posizioni[nodo["id"]]
    else:
        disponi(nodi, archi, posizioni)

    grafo = {
        "generato": datetime.now(timezone.utc).isoformat(timespec="seconds").replace(
            "+00:00", "Z"
        ),
        "impronta": firma,
        "conteggi": {
            "nodi": len(nodi),
            "archi": len(archi),
            "mancanti": sum(1 for n in nodi if n["tipo"] == "mancante"),
            "orfani": sum(1 for n in nodi if n["grado"] == 0),
        },
        "costo_ms": 0,
        "nodes": nodi,
        "edges": archi,
        "assente": False,
    }
    grafo["costo_ms"] = int((time.perf_counter() - partenza) * 1000)
    _scrivi(grafo, uscita)
    _scrivi(cache_nuova, cache)
    return grafo


def main() -> int:
    """Una generazione a mano: `venv/bin/python -m tools.control_center.cervello`."""
    grafo = aggiorna()
    print(json.dumps(grafo["conteggi"] | {"costo_ms": grafo["costo_ms"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
