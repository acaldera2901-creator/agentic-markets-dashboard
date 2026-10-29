"""Il Tavolo: freni, claim/lease, simmetria, guardia anti-catena, ruoli, API.

Tutto gira in una cartella temporanea (TAVOLO_DIR) con due binari finti al
posto di `codex` e `claude`: i test non spendono un token. La prova reale con
`codex exec` vero e' a parte (vedi docs/tavolo.md, «Verificato»).
"""

import http.client
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from datetime import timedelta
from pathlib import Path

from . import tavolo

REPO = Path(__file__).resolve().parents[2]

# Un binario finto che parla come il vero: Codex scrive -o e stampa JSONL con
# `turn.completed`; Claude stampa un JSON con `structured_output` e `usage`.
# In scrittura tocca un file nella cartella di lavoro. E prova a chiamare il
# Tavolo da dentro il bridge: deve essere rifiutato (exit 4).
FINTO = r'''#!/usr/bin/env python3
import json, os, subprocess, sys
from pathlib import Path
lato = Path(sys.argv[0]).name
argv = sys.argv[1:]
if os.environ.get("FINTO_ARGV"):
    with open(os.environ["FINTO_ARGV"], "a") as f:
        f.write(json.dumps({"lato": lato, "argv": argv}) + "\n")
prompt = sys.stdin.read()
scrive = ("workspace-write" in argv) or ("acceptEdits" in argv)
cwd = Path.cwd()
if lato == "codex":
    cwd = Path(argv[argv.index("-C") + 1])
if scrive:
    (cwd / f"da-{lato}.txt").write_text("scritto dal bridge\n")
catena = subprocess.run([sys.executable, "-m", "tools.control_center.tavolo", "invia", "--to",
                         "claude" if lato == "codex" else "codex", "catena?"],
                        cwd=os.environ["TAVOLO_REPO"], capture_output=True, text=True).returncode
risposta = {"tipo": "verdetto", "capito": prompt.splitlines()[0][:80], "proposta": "-",
            "rischi": "-", "obiezioni": f"catena_rc={catena}", "raccomandazione": "-",
            "esito": os.environ.get("FINTO_ESITO", "approva")}
if lato == "codex":
    Path(argv[argv.index("-o") + 1]).write_text(json.dumps(risposta))
    print(json.dumps({"type": "turn.completed", "usage": {"input_tokens": 100,
          "cached_input_tokens": 10, "output_tokens": 7, "reasoning_output_tokens": 3}}))
else:
    print(json.dumps({"structured_output": risposta, "total_cost_usd": 0.01,
          "usage": {"input_tokens": 2, "cache_creation_input_tokens": 50,
                    "cache_read_input_tokens": 8, "output_tokens": 5}}))
'''


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        t = Path(self.tmp.name)
        self.dir = t / "tavolo"
        self.dir.mkdir()
        (self.dir / "LIVE").touch()
        bindir = t / "bin"
        bindir.mkdir()
        for lato in tavolo.LATI:
            b = bindir / lato
            b.write_text(FINTO)
            b.chmod(0o755)
        self.env = {"TAVOLO_DIR": str(self.dir), "CODEX_BIN": str(bindir / "codex"),
                    "CLAUDE_BIN": str(bindir / "claude"), "TAVOLO_REPO": str(REPO),
                    "TAVOLO_VETRINA": str(t / "vetrina"), "TAVOLO_WT_ROOT": str(t)}
        self._vecchio = {k: os.environ.get(k) for k in
                         list(self.env) + ["AM_SHELL", "CODEX_SHELL", "BRIDGE_DEPTH", "FINTO_ESITO",
                                           "FINTO_ARGV"]}
        os.environ.update(self.env)
        for k in ("AM_SHELL", "CODEX_SHELL", "BRIDGE_DEPTH", "FINTO_ESITO", "FINTO_ARGV"):
            os.environ.pop(k, None)
        (t / "vetrina").mkdir()

    def tearDown(self):
        for k, v in self._vecchio.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        self.tmp.cleanup()

    def cli(self, *args, chi=None, extra=None):
        env = {**os.environ, **(extra or {})}
        env.pop("AM_SHELL", None)
        env.pop("CODEX_SHELL", None)
        if chi == "claude":
            env["AM_SHELL"] = "claude_test"
        elif chi == "codex":
            env["CODEX_SHELL"] = "codex_test"
        r = subprocess.run([sys.executable, str(REPO / "tools/tavolo"), *args], env=env,
                           capture_output=True, text=True, timeout=60)
        return r.returncode, r.stdout + r.stderr


class Freni(Base):
    def test_duplicato_rifiutato_anche_con_altro_ref_e_altra_conv(self):
        tavolo.invia("claude", "codex", "stessa domanda", ref="A")
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.invia("claude", "codex", "  Stessa   DOMANDA ", ref="B", conv="c-altra")
        rif = [e for e in tavolo.eventi() if e["evento"] == "rifiutato"]
        self.assertEqual(len(rif), 1)
        self.assertIn("duplicato", rif[0]["motivo"])
        # Il messaggio frenato non e' entrato nella posta.
        self.assertEqual(len(list((self.dir / "inbox-codex").glob("t-*.json"))), 1)

    def test_duplicato_scaduto_dopo_la_finestra(self):
        prima = tavolo._ora() - timedelta(minutes=tavolo.LIMITI["dedup_min"] + 1)
        tavolo.invia("claude", "codex", "ciao", ora=prima)
        tavolo.invia("claude", "codex", "ciao")

    def test_in_risposta_a_non_aggira_il_dedup(self):
        # QA #570 punto 2: l'impronta includeva in_risposta_a, quindi lo stesso
        # testo puntato a messaggi diversi passava. Ora conta solo il contenuto.
        a = tavolo.invia("claude", "codex", "domanda uno")
        b = tavolo.invia("claude", "codex", "domanda due")
        tavolo.invia("codex", "claude", "ok", in_risposta_a=a["id"])
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.invia("codex", "claude", "ok", in_risposta_a=b["id"])
        tavolo.invia("codex", "claude", "ok anche a te", in_risposta_a=b["id"])

    def test_campi_strutturati_in_ordine_diverso_sono_un_duplicato(self):
        tavolo.invia("claude", "codex", {"proposta": "fai X", "rischi": "nessuno"})
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.invia("claude", "codex", {"rischi": "nessuno", "proposta": "fai X"}, ref="altro")

    def test_in_risposta_a_inventato_rifiutato_anche_con_conv(self):
        m = tavolo.invia("claude", "codex", "vero")
        with self.assertRaises(ValueError):
            tavolo.invia("codex", "claude", "x", conv=m["conv"], in_risposta_a="t-inventato")

    def test_in_risposta_a_di_un_altra_conv_rifiutato(self):
        a = tavolo.invia("claude", "codex", "conv uno")
        b = tavolo.invia("claude", "codex", "conv due")
        with self.assertRaises(ValueError):
            tavolo.invia("codex", "claude", "x", conv=b["conv"], in_risposta_a=a["id"])

    def test_inbox_andrea_solo_rispondendo_a_un_messaggio_di_andrea(self):
        # Un LLM che punta a un messaggio non suo, o non di andrea, non entra in inbox-andrea.
        x = tavolo.invia("claude", "codex", "fra LLM")
        for conv in (None, x["conv"]):
            with self.assertRaises(ValueError):
                tavolo.invia("codex", "andrea", "spam", conv=conv, in_risposta_a=x["id"])
            with self.assertRaises(ValueError):
                tavolo.invia("claude", "andrea", "spam", conv=conv, in_risposta_a=x["id"])
        self.assertEqual(list((self.dir / "inbox-andrea").glob("t-*.json")), [])
        q = tavolo.invia("andrea", "codex", "domanda di andrea")
        tavolo.invia("codex", "andrea", "risposta vera", in_risposta_a=q["id"])
        self.assertEqual(len(list((self.dir / "inbox-andrea").glob("t-*.json"))), 1)

    def test_cli_rifiutato_esce_3(self):
        self.assertEqual(self.cli("invia", "--to", "codex", "x", chi="claude")[0], 0)
        rc, out = self.cli("invia", "--to", "codex", "x", chi="claude")
        self.assertEqual(rc, 3, out)
        self.assertIn("RIFIUTATO", out)

    def test_tetto_messaggi_per_conv(self):
        vecchio = tavolo.LIMITI["per_conv"]
        tavolo.LIMITI["per_conv"] = 3
        try:
            m = tavolo.invia("claude", "codex", "uno")
            tavolo.invia("codex", "claude", "due", conv=m["conv"])
            tavolo.invia("claude", "codex", "tre", conv=m["conv"])
            with self.assertRaises(tavolo.Rifiutato):
                tavolo.invia("codex", "claude", "quattro", conv=m["conv"])
        finally:
            tavolo.LIMITI["per_conv"] = vecchio

    def test_tetto_conv_nuove_per_coppia_al_giorno(self):
        vecchio = tavolo.LIMITI["conv_nuove_coppia_giorno"]
        tavolo.LIMITI["conv_nuove_coppia_giorno"] = 2
        try:
            tavolo.invia("claude", "codex", "a")
            tavolo.invia("codex", "claude", "b")      # stessa coppia, l'altro verso
            with self.assertRaises(tavolo.Rifiutato):
                tavolo.invia("claude", "codex", "c", ref="nuovo-ref")
        finally:
            tavolo.LIMITI["conv_nuove_coppia_giorno"] = vecchio

    def test_budget_exec_per_lato(self):
        vecchio = tavolo.LIMITI["exec_lato_giorno"]
        tavolo.LIMITI["exec_lato_giorno"] = 1
        try:
            tavolo._registra({"evento": "exec", "lato": "codex", "conv": "c-x", "usage": None})
            with self.assertRaises(tavolo.Rifiutato):
                tavolo.invia("claude", "codex", "esegui", esegui=True)
            tavolo.invia("claude", "codex", "senza esecuzione")   # la posta resta libera
        finally:
            tavolo.LIMITI["exec_lato_giorno"] = vecchio

    def test_tetto_token_per_conv(self):
        m = tavolo.invia("claude", "codex", "inizio")
        tavolo._registra({"evento": "exec", "lato": "codex", "conv": m["conv"],
                          "usage": {"input": tavolo.LIMITI["token_conv"], "output": 1}})
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.invia("codex", "claude", "ancora", conv=m["conv"])

    def test_conv_chiusa_rifiuta(self):
        m = tavolo.invia("claude", "codex", "x")
        tavolo.chiudi("codex", m["conv"], "fatto")
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.invia("claude", "codex", "y", conv=m["conv"])

    def test_interruttore_spento_non_scrive_nulla(self):
        (self.dir / "LIVE").unlink()
        with self.assertRaises(tavolo.Spento):
            tavolo.invia("claude", "codex", "x")
        self.assertFalse((self.dir / "registro.jsonl").exists())
        self.assertEqual(self.cli("invia", "--to", "codex", "x", chi="claude")[0], 5)


class ClaimLease(Base):
    def test_prendi_conferma_ricevuta(self):
        m = tavolo.invia("claude", "codex", "leggi")
        presi = tavolo.prendi("codex")
        self.assertEqual([x["id"] for x in presi], [m["id"]])
        self.assertTrue((self.dir / "in-carico" / f"{m['id']}.claim").exists())
        self.assertEqual(tavolo.prendi("codex"), [])           # claim esclusivo
        with self.assertRaises(ValueError):
            tavolo.conferma("claude", m["id"])                 # non e' posta sua
        r = tavolo.conferma("codex", m["id"])
        self.assertEqual(r["letto_da"], "codex")
        self.assertEqual(tavolo.ricevuta(m["id"])["id"], m["id"])
        self.assertTrue((self.dir / "letti" / f"{m['id']}.json").exists())

    def test_lease_scaduto_due_recuperi_poi_quarantena(self):
        m = tavolo.invia("claude", "codex", "dimenticato")
        t = tavolo._ora()
        passo = timedelta(minutes=tavolo.LIMITI["lease_min"] + 1)
        for giro in range(tavolo.LIMITI["recuperi_max"]):
            self.assertEqual(len(tavolo.prendi("codex", ora=t)), 1)
            t += passo
            esiti = tavolo.recupera(ora=t)
            self.assertEqual(esiti, [{"id": m["id"], "esito": "inbox", "n": giro + 1}])
        tavolo.prendi("codex", ora=t)
        t += passo
        self.assertEqual(tavolo.recupera(ora=t)[0]["esito"], "quarantena")
        self.assertTrue((self.dir / "quarantena" / f"{m['id']}.json").exists())

    def test_mai_cancellato_niente(self):
        m = tavolo.invia("claude", "codex", "traccia")
        tavolo.prendi("codex")
        tavolo.conferma("codex", m["id"])
        tutti = {p.name for p in self.dir.rglob("*") if p.is_file()}
        self.assertIn(f"{m['id']}.json", tutti)
        self.assertIn(f"{m['id']}.claim", tutti)
        self.assertIn(f"{m['id']}.ricevuta", tutti)

    def test_file_illeggibile_in_quarantena(self):
        (self.dir / "inbox-codex").mkdir(exist_ok=True)
        (self.dir / "inbox-codex" / "t-rotto.json").write_text("{non json")
        tavolo.prendi("codex")
        self.assertTrue((self.dir / "quarantena" / "t-rotto.json").exists())


class Simmetria(Base):
    def test_stessi_comandi_per_i_due_lati(self):
        for io, tu in (("claude", "codex"), ("codex", "claude")):
            rc, out = self.cli("invia", "--to", tu, "--tipo", "proposta", "--req",
                               "--campo", "proposta=fai X", f"da {io}", chi=io)
            self.assertEqual(rc, 0, out)
            mid = out.split()[1]
            rc, out = self.cli("prendi", chi=tu)
            self.assertEqual(rc, 0, out)
            self.assertIn(mid, out)
            self.assertIn("fai X", out)
            rc, out = self.cli("conferma", mid, chi=tu)
            self.assertEqual(rc, 0, out)
            rc, out = self.cli("invia", "--to", io, "--tipo", "verdetto", "--in-risposta-a", mid,
                               "--campo", "esito=approva", "ok", chi=tu)
            self.assertEqual(rc, 0, out)
            self.assertEqual(self.cli("avvisi", chi=io)[0], 0)
            self.assertEqual(self.cli("assegna", chi=io)[0], 0)
            self.assertEqual(self.cli("stato", chi=io)[0], 0)

    def test_identita_ambigua_e_un_errore(self):
        # QA #570 punto 3: con entrambe vinceva in silenzio CODEX_SHELL.
        with self.assertRaises(ValueError):
            tavolo.identita({"AM_SHELL": "x", "CODEX_SHELL": "y"})
        self.assertEqual(self.cli("prendi", extra={"AM_SHELL": "x", "CODEX_SHELL": "y"})[0], 2)

    def test_claude_ha_la_stessa_shell_ristretta_in_entrambi_i_modi(self):
        # QA #570 punto 3: Codex lanciava npm test, Claude non aveva Bash.
        log = Path(self.tmp.name) / "argv.jsonl"
        os.environ["FINTO_ARGV"] = str(log)
        v = Path(self.env["TAVOLO_VETRINA"])
        for c in (["init", "-q", "-b", "main"], ["commit", "-q", "--allow-empty", "-m", "x"]):
            subprocess.run(["git", "-C", str(v), "-c", "user.email=t@t", "-c", "user.name=t", *c], check=True)
        wt = Path(self.tmp.name) / "wt-bash"
        subprocess.run(["git", "-C", str(v), "worktree", "add", "-q", "-b", "tavolo/b", str(wt)], check=True)
        tavolo.consegna(tavolo.invia("codex", "claude", "parere")["id"])
        tavolo.consegna(tavolo.invia("codex", "claude", "lavoro", tipo="lavoro", worktree=str(wt))["id"])
        chiamate = [json.loads(r) for r in log.read_text().splitlines() if '"claude"' in r]
        self.assertEqual(len(chiamate), 2)
        for c in chiamate:
            a = c["argv"]
            self.assertIn("Bash", a[a.index("--tools") + 1].split(","))
            permessi = a[a.index("--allowedTools") + 1].split(",")
            self.assertIn("Bash(npm test:*)", permessi)
            self.assertIn("Bash(git diff:*)", permessi)
            self.assertNotIn("Bash", permessi)                     # mai la shell intera
            self.assertFalse([x for x in permessi if x.startswith("Bash(git push")
                              or x.startswith("Bash(git commit")])
            self.assertEqual(a[a.index("--permission-prompts") + 1], "none")

    def test_identita_dall_ambiente(self):
        self.assertEqual(tavolo.identita({"AM_SHELL": "agentic_lab"}), "claude")
        self.assertEqual(tavolo.identita({"CODEX_SHELL": "agentic_codex"}), "codex")
        with self.assertRaises(ValueError):
            tavolo.identita({})
        self.assertEqual(self.cli("prendi")[0], 2)

    def test_il_bridge_e_lo_stesso_per_i_due_lati(self):
        for a in tavolo.LATI:
            m = tavolo.invia(tavolo.altro(a), a, f"domanda per {a}")
            r = tavolo.consegna(m["id"])
            self.assertIsNone(r["esito"]["errore"])
            self.assertEqual(r["risposta"]["from"], a)
            self.assertEqual(r["risposta"]["conv"], m["conv"])
            self.assertEqual(r["risposta"]["tipo"], "verdetto")
            self.assertGreater(r["esito"]["usage"]["input"], 0)
            self.assertEqual(tavolo.ricevuta(m["id"])["via"], "bridge")


class AntiCatena(Base):
    def test_dentro_un_bridge_non_si_invia(self):
        os.environ["BRIDGE_DEPTH"] = "1"
        with self.assertRaises(tavolo.Catena):
            tavolo.invia("claude", "codex", "x")
        with self.assertRaises(tavolo.Catena):
            tavolo.consegna("t-qualsiasi")

    def test_profondita_negativa_o_illeggibile_e_rifiutata(self):
        # QA #570 punto 6: BRIDGE_DEPTH=-1 passava l'anti-catena.
        for v in ("-1", "-5", "abc", "1.5"):
            os.environ["BRIDGE_DEPTH"] = v
            with self.assertRaises(tavolo.Catena, msg=v):
                tavolo.invia("claude", "codex", f"x {v}")
        os.environ["BRIDGE_DEPTH"] = "0"
        tavolo.invia("claude", "codex", "a profondita' zero si invia")

    def test_il_figlio_del_bridge_viene_rifiutato(self):
        m = tavolo.invia("claude", "codex", "prova la catena")
        r = tavolo.consegna(m["id"])
        # Il finto, da dentro il bridge, ha provato `tavolo invia`: exit 4.
        self.assertIn("catena_rc=4", r["risposta"]["corpo"]["obiezioni"])


class Lavoro(Base):
    def _repo(self):
        v = Path(self.env["TAVOLO_VETRINA"])
        for c in (["init", "-q", "-b", "main"], ["commit", "-q", "--allow-empty", "-m", "x"]):
            subprocess.run(["git", "-C", str(v), "-c", "user.email=t@t", "-c", "user.name=t", *c],
                           check=True)
        wt = Path(self.tmp.name) / "wt-filone"
        subprocess.run(["git", "-C", str(v), "worktree", "add", "-q", "-b", "tavolo/filone", str(wt)],
                       check=True)
        return v, wt

    def test_lavoro_scrive_solo_nel_suo_worktree(self):
        v, wt = self._repo()
        for lato in tavolo.LATI:
            m = tavolo.invia(tavolo.altro(lato), lato, f"scrivi un file ({lato})", tipo="lavoro",
                             worktree=str(wt))
            r = tavolo.consegna(m["id"])
            self.assertTrue((wt / f"da-{lato}.txt").exists())
            self.assertIn(f"da-{lato}.txt", r["esito"]["file_toccati"])
            self.assertTrue(r["esito"]["vetrina_intatta"])
        self.assertEqual(tavolo._porcelain(v), "")
        self.assertEqual(list((self.dir / "lock").glob("*.lock")), [])   # lock rilasciato

    def test_mai_sulla_vetrina_ne_su_main_ne_senza_worktree(self):
        v, wt = self._repo()
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.invia("claude", "codex", "a", tipo="lavoro", worktree=str(v))
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.invia("claude", "codex", "b", tipo="lavoro")
        subprocess.run(["git", "-C", str(wt), "checkout", "-q", "--detach"], check=True)
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.invia("claude", "codex", "c", tipo="lavoro", worktree=str(wt))

    def test_un_solo_scrittore_per_worktree(self):
        _, wt = self._repo()
        lock = tavolo._lock_worktree(str(wt), "claude")
        with self.assertRaises(tavolo.Rifiutato):
            tavolo._lock_worktree(str(wt), "codex")
        tavolo._sblocca(lock)
        tavolo._sblocca(tavolo._lock_worktree(str(wt), "codex"))   # libero di nuovo

    def test_lock_con_pid_non_segnalabile_non_esplode(self):
        # QA #570 punto 8: os.kill(pid, 0) su un pid di un altro utente (1 =
        # launchd) alzava PermissionError non gestito. Un file di lock senza
        # flock tenuto e' libero, chiunque ci sia scritto dentro.
        _, wt = self._repo()
        lp = self.dir / "lock" / (tavolo.hashlib.sha1(str(wt.resolve()).encode()).hexdigest()[:16] + ".lock")
        lp.parent.mkdir(exist_ok=True)
        lp.write_text(json.dumps({"pid": 1, "chi": "fantasma", "dal": "ieri"}))
        tavolo._sblocca(tavolo._lock_worktree(str(wt.resolve()), "claude"))

    def test_lock_atomico_sotto_concorrenza(self):
        # Lock orfano (pid morto) e 8 contendenti nello stesso istante: uno solo vince.
        _, wt = self._repo()
        lp = self.dir / "lock" / (tavolo.hashlib.sha1(str(wt).encode()).hexdigest()[:16] + ".lock")
        lp.parent.mkdir(exist_ok=True)
        lp.write_text(json.dumps({"pid": 999999, "chi": "morto"}))
        via, vinti, presi = threading.Barrier(8), [], []
        def prova():
            via.wait()
            try:
                presi.append(tavolo._lock_worktree(str(wt), "x"))
                vinti.append(1)
            except tavolo.Rifiutato:
                pass
        th = [threading.Thread(target=prova) for _ in range(8)]
        for t in th:
            t.start()
        for t in th:
            t.join()
        self.assertEqual(len(vinti), 1)
        for lock in presi:
            tavolo._sblocca(lock)

    def test_worktree_di_un_altro_repo_rifiutato(self):
        # QA #570 punto 9: qualunque worktree git passava, anche di un repo estraneo.
        self._repo()
        altro = Path(self.tmp.name) / "altro-repo"
        altro.mkdir()
        for c in (["init", "-q", "-b", "main"], ["commit", "-q", "--allow-empty", "-m", "x"]):
            subprocess.run(["git", "-C", str(altro), "-c", "user.email=t@t", "-c", "user.name=t", *c],
                           check=True)
        wt = Path(self.tmp.name) / "wt-estraneo"
        subprocess.run(["git", "-C", str(altro), "worktree", "add", "-q", "-b", "filone", str(wt)],
                       check=True)
        with self.assertRaises(tavolo.Rifiutato) as ctx:
            tavolo.invia("claude", "codex", "scrivi", tipo="lavoro", worktree=str(wt))
        self.assertIn("altro repo", str(ctx.exception))

    def test_worktree_occupato_rilascia_il_messaggio(self):
        # QA #570 punto 5: il messaggio gia' preso restava in in-carico 60 min.
        _, wt = self._repo()
        m = tavolo.invia("claude", "codex", "scrivi", tipo="lavoro", worktree=str(wt))
        lock = tavolo._lock_worktree(str(wt.resolve()), "claude")
        try:
            with self.assertRaises(tavolo.Rifiutato):
                tavolo.consegna(m["id"])
        finally:
            tavolo._sblocca(lock)
        self.assertTrue((self.dir / "inbox-codex" / f"{m['id']}.json").exists())
        self.assertEqual(list((self.dir / "in-carico").glob("*.json")), [])
        self.assertEqual(list((self.dir / "in-carico").glob("*.claim")), [])
        self.assertFalse([e for e in tavolo.eventi() if e["evento"] == "exec"])
        tavolo.consegna(m["id"])     # ora che e' libero, va


class RispostaDelBridge(Base):
    """QA #570 punto 1: dopo l'exec i token sono spesi, la risposta non si perde."""

    def _riempi(self, n):
        m = tavolo.invia("claude", "codex", "messaggio 0")
        for i in range(1, n):
            da, a = ("codex", "claude") if i % 2 else ("claude", "codex")
            tavolo.invia(da, a, f"messaggio {i}", conv=m["conv"])
        return m["conv"]

    def _exec_senza_risposta(self):
        ex = [e for e in tavolo.eventi() if e["evento"] == "exec"]
        risposte = [x for x in tavolo.messaggi() if x.get("in_risposta_a")]
        return ex, risposte

    def test_repro_qa_39_messaggi_invia_esegui_poi_consegna(self):
        conv = self._riempi(39)
        try:
            m = tavolo.invia("claude", "codex", "la quarantesima", conv=conv, esegui=True)
            tavolo.consegna(m["id"])
        except tavolo.Rifiutato:
            pass
        ex, risposte = self._exec_senza_risposta()
        self.assertEqual(len(ex), len(risposte), "un'exec senza la sua risposta: token buttati")
        self.assertEqual(ex, [])                 # rifiutato PRIMA di eseguire
        self.assertEqual(list((self.dir / "letti").glob("t-*.json")), [])

    def test_con_posto_per_la_risposta_si_esegue(self):
        conv = self._riempi(38)
        m = tavolo.invia("claude", "codex", "la trentanovesima", conv=conv, esegui=True)
        r = tavolo.consegna(m["id"])
        self.assertEqual(r["risposta"]["in_risposta_a"], m["id"])
        self.assertEqual(sum(1 for x in tavolo.messaggi() if x["conv"] == conv), tavolo.LIMITI["per_conv"])

    def test_consegna_su_conv_piena_non_esegue_e_lascia_in_inbox(self):
        conv = self._riempi(39)
        m = tavolo.invia("claude", "codex", "senza esegui", conv=conv)
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.consegna(m["id"])
        self.assertTrue((self.dir / "inbox-codex" / f"{m['id']}.json").exists())
        self.assertEqual(self._exec_senza_risposta()[0], [])

    def test_consegna_su_conv_chiusa_o_spenta_non_esegue(self):
        m = tavolo.invia("claude", "codex", "a")
        tavolo.chiudi("andrea", m["conv"])
        with self.assertRaises(tavolo.Rifiutato):
            tavolo.consegna(m["id"])
        m2 = tavolo.invia("claude", "codex", "b")
        (self.dir / "LIVE").unlink()
        with self.assertRaises(tavolo.Spento):
            tavolo.consegna(m2["id"])
        self.assertEqual(self._exec_senza_risposta()[0], [])

    def test_risposta_entra_anche_se_durante_l_exec_tutto_cambia(self):
        m = tavolo.invia("claude", "codex", "domanda lunga")
        vero = tavolo.esegui_lato

        def esegui_e_intanto(*a, **k):
            esito = vero(*a, **k)
            # Mentre il bridge girava: conv chiusa, LIVE tolto, token oltre il tetto.
            tavolo.chiudi("andrea", m["conv"], "chiusa a meta'")
            tavolo._registra({"evento": "exec", "lato": "claude", "conv": m["conv"],
                              "usage": {"input": tavolo.LIMITI["token_conv"], "output": 0}})
            (self.dir / "LIVE").unlink()
            return esito
        tavolo.esegui_lato = esegui_e_intanto
        try:
            r = tavolo.consegna(m["id"])
        finally:
            tavolo.esegui_lato = vero
        self.assertTrue((self.dir / "inbox-claude" / f"{r['risposta']['id']}.json").exists())
        self.assertEqual(tavolo.ricevuta(m["id"])["via"], "bridge")


class BinarioRotto(Base):
    """QA #570 punto 5: binario non eseguibile = exit 6 pulito, messaggio rilasciato."""

    def test_binario_non_eseguibile(self):
        Path(self.env["CODEX_BIN"]).chmod(0o644)
        m = tavolo.invia("claude", "codex", "parti?")
        with self.assertRaises(tavolo.BridgeNonPartito):
            tavolo.consegna(m["id"])
        self.assertTrue((self.dir / "inbox-codex" / f"{m['id']}.json").exists())
        self.assertEqual(list((self.dir / "in-carico").glob("*.claim")), [])
        rc, out = self.cli("consegna", m["id"])
        self.assertEqual(rc, 6, out)
        self.assertNotIn("Traceback", out)
        self.assertTrue((self.dir / "inbox-codex" / f"{m['id']}.json").exists())
        self.assertEqual([e for e in tavolo.eventi() if e["evento"] == "exec"], [])


class Ruoli(unittest.TestCase):
    def test_la_tabella_versionata_e_valida(self):
        self.assertEqual(tavolo.valida_ruoli(tavolo.ruoli()), [])

    def test_default_coerenti_con_la_regola(self):
        a = tavolo.assegna(autore="claude")
        self.assertEqual(a["grafica_statica"]["esegue"], "codex")
        self.assertEqual(a["codice"]["esegue"], "claude")
        self.assertEqual(a["codice"]["rivede"], "codex")
        self.assertEqual(a["review"]["esegue"], "codex")
        self.assertEqual(tavolo.assegna("review", autore="codex")["review"]["esegue"], "claude")
        self.assertEqual(sorted(a["decisione"]["pareri"]), ["claude", "codex"])
        self.assertEqual(a["decisione"]["sintesi"], "script")

    def test_chi_scrive_non_si_rivede(self):
        cfg = tavolo.ruoli()
        cfg["compiti"]["codice"]["rivede"] = "claude"
        self.assertTrue(any("codice" in e for e in tavolo.valida_ruoli(cfg)))


class Sintesi(Base):
    def test_due_pareri_sintesi_da_script(self):
        m = tavolo.invia("andrea", "claude", "decidi X", tipo="domanda")
        tavolo.invia("andrea", "codex", "decidi X (parere separato)", conv=m["conv"])
        for x in list((self.dir / "inbox-claude").glob("t-*.json")) + \
                list((self.dir / "inbox-codex").glob("t-*.json")):
            os.environ["FINTO_ESITO"] = "approva" if "claude" in x.parent.name else "respinge"
            tavolo.consegna(x.name[:-5])
        c = next(c for c in tavolo.stato()["conv"] if c["conv"] == m["conv"])
        self.assertEqual(c["sintesi"], {"claude": "approva", "codex": "respinge", "concordano": False})
        self.assertEqual(c["palla"], "andrea")
        self.assertGreater(c["token"]["claude"]["input"], 0)
        self.assertGreater(c["token"]["codex"]["input"], 0)


class Api(Base):
    def setUp(self):
        super().setUp()
        from . import server
        self.server = server
        self.httpd = server.make_server(0)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        super().tearDown()

    def _post(self, corpo, token=True):
        h = {"Content-Type": "application/json"}
        if token:
            h["X-CC-Token"] = self.server.ensure_token()
        req = urllib.request.Request(self.url + "/api/tavolo", json.dumps(corpo).encode(), h)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            with e:
                return e.code, json.loads(e.read() or b"{}")

    def _grezzo(self, corpo: bytes, lunghezza=None):
        c = http.client.HTTPConnection("127.0.0.1", self.httpd.server_address[1], timeout=5)
        c.putrequest("POST", "/api/tavolo")
        c.putheader("X-CC-Token", self.server.ensure_token())
        c.putheader("Content-Type", "application/json")
        c.putheader("Content-Length", str(len(corpo) if lunghezza is None else lunghezza))
        c.endheaders()
        if corpo:
            c.send(corpo)
        r = c.getresponse()
        code = r.status
        r.read()
        c.close()
        return code

    def test_corpo_non_oggetto_e_testo_non_stringa_400(self):
        # QA #570 punto 7: un array o una stringa facevano crollare corpo.get;
        # "testo": null diventava la stringa "None".
        for corpo in ([1, 2], "chiedi", 3):
            self.assertEqual(self._post(corpo)[0], 400, corpo)
        for testo in (None, 5, ["x"]):
            self.assertEqual(self._post({"azione": "chiedi", "a": "codex", "testo": testo})[0], 400, testo)
        self.assertFalse(list((self.dir / "inbox-codex").glob("t-*.json")))

    def test_content_length_negativo_o_enorme_non_appende_il_thread(self):
        self.assertEqual(self._grezzo(b"", lunghezza=-1), 400)
        self.assertEqual(self._grezzo(b"", lunghezza=10**12), 413)

    def test_get_risponde_anche_vuoto_e_spento(self):
        (self.dir / "LIVE").unlink()
        with urllib.request.urlopen(self.url + "/api/tavolo", timeout=10) as r:
            d = json.loads(r.read())
        self.assertFalse(d["live"])
        self.assertIn("limiti", d)

    def test_post_protetto_dal_token(self):
        self.assertEqual(self._post({"azione": "chiedi", "a": "codex", "testo": "x"}, token=False)[0], 403)

    def test_chiedi_e_chiudi(self):
        code, d = self._post({"azione": "chiedi", "a": "codex", "testo": "dalla torre"})
        self.assertEqual(code, 200, d)
        code, d2 = self._post({"azione": "chiedi", "a": "codex", "testo": "dalla torre"})
        self.assertEqual(code, 409)
        self.assertTrue(d2["rifiutato"])
        with urllib.request.urlopen(self.url + "/api/tavolo", timeout=10) as r:
            st = json.loads(r.read())
        conv = next(c for c in st["conv"] if c["conv"] == d["conv"])
        self.assertEqual(conv["palla"], "codex")
        self.assertEqual(st["rifiuti"][0]["a"], "codex")
        self.assertEqual(self._post({"azione": "chiudi", "conv": d["conv"]})[0], 200)
        self.assertEqual(self._post({"azione": "scrivi_card"})[0], 400)


if __name__ == "__main__":
    unittest.main()
