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
from unittest import mock
import urllib.request
from datetime import timedelta
from pathlib import Path

from . import tavolo

REPO = Path(__file__).resolve().parents[2]
MARCATORI = ("CLAUDECODE", "CLAUDE_PID", "CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID",
             "CODEX_SANDBOX", "CODEX_SESSION_ID", "TAVOLO_PRESENZA_TTL_MIN")

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
                    "TAVOLO_VETRINA": str(t / "vetrina"), "TAVOLO_WT_ROOT": str(t),
                    # I test non devono dipendere da chi li lancia (una sessione
                    # Claude, Codex o un terminale): niente antenati, niente marcatori.
                    "TAVOLO_SENZA_ANTENATI": "1"}
        self._vecchio = {k: os.environ.get(k) for k in
                         list(self.env) + ["AM_SHELL", "CODEX_SHELL", "BRIDGE_DEPTH", "FINTO_ESITO",
                                           "FINTO_ARGV"] + list(MARCATORI)}
        os.environ.update(self.env)
        for k in ("AM_SHELL", "CODEX_SHELL", "BRIDGE_DEPTH", "FINTO_ESITO", "FINTO_ARGV") + MARCATORI:
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

    def _in_parallelo(self, fn, n=8):
        """n chiamate a fn(i) partite insieme; ritorna (accettati, rifiutati)."""
        via = threading.Barrier(n)
        esiti = []

        def uno(i):
            via.wait()
            try:
                fn(i)
                esiti.append("ok")
            except tavolo.Rifiutato:
                esiti.append("rifiutato")
        th = [threading.Thread(target=uno, args=(i,)) for i in range(n)]
        for t in th:
            t.start()
        for t in th:
            t.join(30)
        return esiti.count("ok"), esiti.count("rifiutato")

    def test_qa_570_dedup_atomico_fra_thread(self):
        # QA #570 punto 2: 5 POST identici in parallelo diventavano 5 file in inbox.
        ok, no = self._in_parallelo(lambda i: tavolo.invia("andrea", "codex", "stessa domanda",
                                                           richiede_risposta=True, esegui=True))
        self.assertEqual((ok, no), (1, 7))
        self.assertEqual(len(list((self.dir / "inbox-codex").glob("t-*.json"))), 1)

    def test_qa_570_dedup_atomico_fra_processi(self):
        procs = [subprocess.Popen([sys.executable, str(REPO / "tools/tavolo"), "invia", "--to", "codex",
                                   "stessa domanda fra processi"],
                                  env={**os.environ, "AM_SHELL": "claude_test"},
                                  stdout=subprocess.PIPE, stderr=subprocess.STDOUT) for _ in range(6)]
        rc = sorted(p.wait(60) for p in procs)
        for p in procs:
            p.stdout.close()
        self.assertEqual(rc, [tavolo.OK] + [tavolo.RIFIUTATO] * 5)
        self.assertEqual(len(list((self.dir / "inbox-codex").glob("t-*.json"))), 1)

    def test_qa_570_budget_exec_riservato_all_accettazione(self):
        # Testi diversi (niente dedup), tutti con --esegui: il budget del giorno
        # si riserva quando il messaggio entra, non quando il bridge finisce.
        vecchio = tavolo.LIMITI["exec_lato_giorno"]
        tavolo.LIMITI["exec_lato_giorno"] = 2
        try:
            ok, no = self._in_parallelo(lambda i: tavolo.invia("andrea", "codex", f"domanda {i}",
                                                               esegui=True))
            self.assertEqual((ok, no), (2, 6))
            with self.assertRaises(tavolo.Rifiutato):
                tavolo.invia("andrea", "codex", "ancora una", esegui=True)
            tavolo.invia("andrea", "codex", "senza bridge")   # la posta resta libera
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
            tavolo.identita({}, antenati=[])
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

    def test_qa_570_esegui_solo_booleano(self):
        # QA #570 punto 3: "esegui":"false" (stringa) era vero e il bridge partiva.
        with mock.patch.object(tavolo, "consegna_in_background", return_value={"ok": True}) as bg:
            for valore in ("false", "true", 1, 0, None, [], {}):
                code, d = self._post({"azione": "chiedi", "a": "codex", "testo": f"x {valore!r}",
                                      "esegui": valore})
                self.assertEqual(code, 400, (valore, d))
            self.assertFalse(list((self.dir / "inbox-codex").glob("t-*.json")))
            bg.assert_not_called()
            self.assertEqual(self._post({"azione": "chiedi", "a": "codex", "testo": "falso",
                                         "esegui": False})[0], 200)
            self.assertEqual(self._post({"azione": "chiedi", "a": "codex", "testo": "assente"})[0], 200)
            bg.assert_not_called()
            self.assertEqual(self._post({"azione": "chiedi", "a": "codex", "testo": "vero",
                                         "esegui": True})[0], 200)
            bg.assert_called_once()

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


CLAUDE_EXE = "/Users/x/.local/share/claude/versions/2.1.312"
CODEX_EXE = "/x/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex"


def _pid_morto() -> int:
    p = subprocess.Popen([sys.executable, "-c", "pass"])
    p.wait()
    return p.pid


class Presenze(Base):
    """`tavolo collegati`: chi e' al tavolo adesso, vivo solo se il battito e
    il processo lo dicono."""

    def chi(self, lato="claude", pid=None, exe=None):
        return {"lato": lato, "client": "claude-code" if lato == "claude" else "codex",
                "pid": os.getpid() if pid is None else pid, "exe": exe,
                "riconosciuto": "test"}

    def test_collegati_scrive_la_presenza_e_scollegati_la_toglie(self):
        p = tavolo.collegati(self.chi("codex"), progetto="betredge", cwd="/tmp/x")
        f = self.dir / "presenze" / "codex.json"
        self.assertTrue(f.exists())
        d = json.loads(f.read_text())
        for k in ("identita", "client", "pid", "cwd", "progetto", "collegato_da", "ultimo_battito"):
            self.assertIn(k, d)
        self.assertEqual((d["identita"], d["progetto"], d["cwd"]), ("codex", "betredge", "/tmp/x"))
        self.assertEqual(p["identita"], "codex")
        [v] = tavolo.presenze()
        self.assertTrue(v["vivo"])
        self.assertEqual(v["stato"], "vivo")
        self.assertTrue(tavolo.scollegati("codex"))
        self.assertFalse(f.exists())
        self.assertEqual(tavolo.presenze(), [])
        self.assertFalse(tavolo.scollegati("codex"))   # gia' fuori: non e' un errore

    def test_presenza_scaduta_dopo_il_ttl(self):
        prima = tavolo._ora() - timedelta(minutes=tavolo.LIMITI["presenza_ttl_min"] + 1)
        tavolo.collegati(self.chi(), ora=prima)
        [v] = tavolo.presenze()
        self.assertFalse(v["vivo"])
        self.assertEqual(v["stato"], "scaduto")

    def test_ttl_configurabile(self):
        prima = tavolo._ora() - timedelta(minutes=5)
        tavolo.collegati(self.chi(), ora=prima)
        self.assertTrue(tavolo.presenze()[0]["vivo"])
        os.environ["TAVOLO_PRESENZA_TTL_MIN"] = "2"
        self.assertEqual(tavolo.presenze()[0]["stato"], "scaduto")

    def test_pid_morto_non_e_mai_vivo_anche_col_battito_fresco(self):
        tavolo.collegati(self.chi(pid=_pid_morto()))
        [v] = tavolo.presenze()
        self.assertFalse(v["vivo"])
        self.assertEqual(v["stato"], "pid morto")

    def test_pid_riusato_da_un_altro_programma_e_morto(self):
        # Stesso numero di pid, eseguibile diverso: non e' piu' la sessione collegata.
        tavolo.collegati(self.chi(pid=os.getpid(), exe="/non/esiste/claude"))
        self.assertEqual(tavolo.presenze()[0]["stato"], "pid morto")

    def test_battito_aggiorna_solo_chi_e_collegato(self):
        prima = tavolo._ora() - timedelta(minutes=20)
        tavolo.collegati(self.chi(), ora=prima)
        tavolo.battito(self.chi("codex"))                 # codex non e' collegato: niente file
        self.assertFalse((self.dir / "presenze" / "codex.json").exists())
        tavolo.battito(self.chi())
        v = tavolo.presenze()[0]
        self.assertLess(v["battito_s"], 60)
        self.assertGreaterEqual(v["da_s"], 20 * 60 - 5)   # collegato_da non cambia

    def test_battito_non_resuscita_un_pid_morto_ma_collegati_si(self):
        # E2E 29/10: il battito adottava il pid di un'altra sessione dello stesso
        # lato, e collegati teneva il vecchio «collegato da». Una sessione nuova
        # si ricollega e riparte da zero.
        prima = tavolo._ora() - timedelta(minutes=10)
        tavolo.collegati(self.chi(pid=_pid_morto()), ora=prima)
        tavolo.battito(self.chi(pid=os.getpid()))
        self.assertEqual(tavolo.presenze()[0]["stato"], "pid morto")
        tavolo.collegati(self.chi(pid=os.getpid()))
        v = tavolo.presenze()[0]
        self.assertTrue(v["vivo"])
        self.assertLess(v["da_s"], 60)

    def test_ogni_comando_tavolo_batte(self):
        prima = tavolo._ora() - timedelta(minutes=20)
        tavolo.collegati(self.chi("codex", pid=None), ora=prima)
        rc, out = self.cli("prendi", chi="codex")
        self.assertEqual(rc, 0, out)
        self.assertLess(tavolo.presenze()[0]["battito_s"], 60)

    def test_collegati_rispetta_l_interruttore(self):
        (self.dir / "LIVE").unlink()
        with self.assertRaises(tavolo.Spento):
            tavolo.collegati(self.chi())

    def test_orientamento_corto_con_chi_c_e_e_la_mia_posta(self):
        tavolo.collegati(self.chi("codex"), progetto="betredge")
        tavolo.invia("codex", "claude", "domanda per te")
        tavolo.collegati(self.chi("claude"))
        testo = tavolo.orientamento("claude")
        righe = testo.splitlines()
        self.assertLessEqual(len(righe), 15, testo)
        self.assertIn("codex", righe[1 if len(righe) > 1 else 0] + testo)
        self.assertIn("1 messagg", testo)
        for cmd in ("tavolo prendi", "tavolo conferma", "tavolo invia", "tavolo stato",
                    "tavolo scollegati"):
            self.assertIn(cmd, testo)
        self.assertIn("APPROVE", testo)
        self.assertIn("RIFIUTATO", testo)

    def test_cli_collegati_e_scollegati(self):
        rc, out = self.cli("collegati", "--come", "codex", "--progetto", "betredge")
        self.assertEqual(rc, 0, out)
        self.assertLessEqual(len(out.strip().splitlines()), 15, out)
        self.assertIn("codex", out)
        d = json.loads((self.dir / "presenze" / "codex.json").read_text())
        self.assertEqual(d["progetto"], "betredge")
        self.assertEqual(d["riconosciuto"], "--come")
        rc, out = self.cli("scollegati", "--come", "codex")
        self.assertEqual(rc, 0, out)
        self.assertFalse((self.dir / "presenze" / "codex.json").exists())

    def test_posta_non_scrivibile_errore_chiaro_non_traceback(self):
        # E2E 29/10: Codex in workspace-write non scrive fuori da cwd e /tmp.
        self.dir.chmod(0o500)
        try:
            rc, out = self.cli("collegati", "--come", "codex")
        finally:
            self.dir.chmod(0o700)
        self.assertEqual(rc, 2, out)
        self.assertIn("writable_roots", out)
        self.assertNotIn("Traceback", out)

    def test_cli_senza_identita_chiede_come(self):
        rc, out = self.cli("collegati")
        self.assertEqual(rc, 2)
        self.assertIn("--come", out)

    def test_api_ha_le_presenze(self):
        tavolo.collegati(self.chi("codex"), progetto="betredge")
        st = tavolo.stato()
        [v] = st["presenze"]
        self.assertEqual((v["identita"], v["stato"]), ("codex", "vivo"))
        os.environ["TAVOLO_DIR"] = str(self.dir / "mai-usato")
        self.assertEqual(tavolo.stato()["presenze"], [])

    # ── re-QA d0a7691e ──────────────────────────────────────────────────────
    def _scrivi(self, nome, dati):
        d = self.dir / "presenze"
        d.mkdir(exist_ok=True)
        f = d / nome
        f.write_text(json.dumps(dati) if isinstance(dati, dict) else dati)
        return f

    def _valida(self, lato="codex", **kw):
        ora = tavolo._iso(tavolo._ora())
        return {"identita": lato, "client": "codex", "pid": None, "exe": None,
                "riconosciuto": "test", "cwd": "/tmp", "progetto": None,
                "collegato_da": ora, "ultimo_battito": ora, **kw}

    def test_bug1_presenza_senza_client_non_fa_crashare_collegati(self):
        # Re-QA BUG-1: KeyError 'client' in orientamento dopo aver gia' scritto la presenza.
        v = self._valida()
        del v["client"]
        self._scrivi("codex.json", v)
        rc, out = self.cli("collegati", "--come", "claude")
        self.assertEqual(rc, 0, out)
        self.assertNotIn("Traceback", out)
        self.assertEqual([p["identita"] for p in tavolo.presenze()], ["claude"])

    def test_bug1_voci_malformate_scartate(self):
        for v in ([1, 2], "null", {**self._valida(), "client": 5}, {**self._valida(), "pid": "12"},
                  {**self._valida(), "pid": True}, {**self._valida(), "exe": 3},
                  {**self._valida(), "progetto": ["x"]}, {**self._valida(), "ultimo_battito": 7}):
            self._scrivi("codex.json", v if isinstance(v, (dict, str)) else json.dumps(v))
            self.assertEqual(tavolo.presenze(), [], v)
            tavolo.orientamento("claude")

    def test_bug2_conta_il_nome_del_file_non_il_contenuto(self):
        self._scrivi("zzz.json", self._valida("codex"))           # nome estraneo
        self._scrivi("claude.json", self._valida("codex"))        # identita' != nome
        self.assertEqual(tavolo.presenze(), [])
        self._scrivi("codex.json", self._valida("codex"))
        self.assertEqual([p["identita"] for p in tavolo.presenze()], ["codex"])

    def test_bug2_battito_nel_futuro_e_scaduto(self):
        futuro = tavolo._iso(tavolo._ora() + timedelta(days=365))
        self._scrivi("codex.json", self._valida(ultimo_battito=futuro))
        [v] = tavolo.presenze()
        self.assertEqual(v["stato"], "scaduto")
        self.assertFalse(v["vivo"])

    def test_bug2_pid_non_verificabile_vale_solo_il_ttl(self):
        # pid 1 (launchd) senza exe: esiste, ma non prova niente.
        self._scrivi("codex.json", self._valida(pid=1, exe=None))
        [v] = tavolo.presenze()
        self.assertTrue(v["vivo"])
        self.assertFalse(v["pid_verificato"])
        vecchio = tavolo._iso(tavolo._ora() - timedelta(minutes=tavolo.LIMITI["presenza_ttl_min"] + 1))
        self._scrivi("codex.json", self._valida(pid=1, exe=None, ultimo_battito=vecchio))
        self.assertEqual(tavolo.presenze()[0]["stato"], "scaduto")
        # pid null: idem, mai verificato.
        self._scrivi("codex.json", self._valida(pid=None, exe=None))
        self.assertFalse(tavolo.presenze()[0]["pid_verificato"])
        # pid 1 con exe di un client: e' launchd, quindi morto.
        self._scrivi("codex.json", self._valida(pid=1, exe=CODEX_EXE))
        self.assertEqual(tavolo.presenze()[0]["stato"], "pid morto")

    def test_bug2_pid_verificato_solo_con_exe_che_combacia(self):
        exe = tavolo._info_pid(os.getpid())
        if exe is None:
            self.skipTest("libproc non disponibile")
        self._scrivi("codex.json", self._valida(pid=os.getpid(), exe=exe[0]))
        [v] = tavolo.presenze()
        self.assertTrue(v["vivo"])
        self.assertTrue(v["pid_verificato"])

    def test_bug7_presenza_symlink_ignorata(self):
        vera = self.dir / "altrove.json"
        vera.write_text(json.dumps(self._valida()))
        (self.dir / "presenze").mkdir(exist_ok=True)
        (self.dir / "presenze" / "codex.json").symlink_to(vera)
        self.assertEqual(tavolo.presenze(), [])
        tavolo.battito({"lato": "codex"})                  # non la adotta come file vero
        self.assertTrue((self.dir / "presenze" / "codex.json").is_symlink())

    def test_bug5_ttl_invalido_torna_al_default(self):
        tavolo.collegati(self.chi("codex"))
        for v in ("nan", "inf", "-inf", "-5", "0", "abc", "1e400"):
            os.environ["TAVOLO_PRESENZA_TTL_MIN"] = v
            self.assertEqual(tavolo._ttl_s(), tavolo.LIMITI["presenza_ttl_min"] * 60, v)
            st = tavolo.stato()
            self.assertEqual(st["presenza_ttl_min"], tavolo.LIMITI["presenza_ttl_min"], v)
            self.assertEqual(st["presenze"][0]["stato"], "vivo", v)
        os.environ["TAVOLO_PRESENZA_TTL_MIN"] = "2.5"
        self.assertEqual(tavolo._ttl_s(), 150)

    def test_bug5_ttl_invalido_api_non_sparisce(self):
        from . import server
        httpd = server.make_server(0)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            os.environ["TAVOLO_PRESENZA_TTL_MIN"] = "inf"
            with urllib.request.urlopen(f"http://127.0.0.1:{httpd.server_address[1]}/api/tavolo",
                                        timeout=10) as r:
                d = json.loads(r.read())
            self.assertNotIn("errore", d)
            self.assertIn("presenze", d)
        finally:
            httpd.shutdown()
            httpd.server_close()


class IdentitaAutomatica(Base):
    """Senza AM_SHELL/CODEX_SHELL il client si ricava dal processo che ha
    lanciato il comando (antenato piu' vicino) e, se gli antenati non si
    leggono, dai marcatori misurati sul 29/10. Ambiguo = chiedi --come."""

    def test_l_antenato_piu_vicino_decide(self):
        r = tavolo.riconosci({}, antenati=[(10, "/bin/zsh"), (20, CLAUDE_EXE), (1, "/sbin/launchd")])
        self.assertEqual((r["lato"], r["pid"], r["exe"]), ("claude", 20, CLAUDE_EXE))
        # Codex lanciato da dentro Claude: vince Codex, che e' piu' vicino.
        r = tavolo.riconosci({"CLAUDECODE": "1"}, antenati=[(5, CODEX_EXE), (9, "/bin/zsh"), (20, CLAUDE_EXE)])
        self.assertEqual((r["lato"], r["pid"]), ("codex", 5))
        r = tavolo.riconosci({}, antenati=[(7, "/Applications/ChatGPT.app/Contents/Resources/codex-cli/"
                                               "CodexCLI.app/Contents/MacOS/codex")])
        self.assertEqual(r["lato"], "codex")

    def test_wrapper_node_non_e_codex(self):
        # `node .../bin/codex` e' il lanciatore npm: il client vero e' il figlio.
        self.assertIsNone(tavolo._classifica("/Users/x/.nvm/versions/node/v24/bin/node"))
        self.assertIsNone(tavolo._classifica("/bin/zsh"))

    def _pid_e_claude(self):
        # CLAUDE_PID deve puntare a un eseguibile claude: finto via _info_pid.
        vero = tavolo._info_pid
        return mock.patch.object(tavolo, "_info_pid", lambda pid: (CLAUDE_EXE, 1)
                                 if pid == os.getpid() else vero(pid))

    def test_antenati_illeggibili_si_usano_i_marcatori(self):
        self.assertEqual(tavolo.riconosci({"CODEX_THREAD_ID": "x", "CODEX_SANDBOX": "seatbelt"},
                                          antenati=None)["lato"], "codex")
        with self._pid_e_claude():
            r = tavolo.riconosci({"CLAUDECODE": "1", "CLAUDE_PID": str(os.getpid())}, antenati=None)
        self.assertEqual((r["lato"], r["pid"], r["exe"]), ("claude", os.getpid(), CLAUDE_EXE))

    def test_bug3_claude_pid_riusato_da_altro_programma_non_conta(self):
        # Re-QA BUG-3: CLAUDE_PID vivo ma e' python (o launchd): non e' Claude.
        for pid in (os.getpid(), 1):
            env = {"CLAUDECODE": "1", "CLAUDE_PID": str(pid), "CODEX_THREAD_ID": "x"}
            self.assertEqual(tavolo.riconosci(env, antenati=None)["lato"], "codex", pid)
            with self.assertRaises(ValueError):
                tavolo.riconosci({"CLAUDECODE": "1", "CLAUDE_PID": str(pid)}, antenati=None)

    def test_marcatori_di_entrambi_e_claude_vivo_e_ambiguo(self):
        env = {"CLAUDECODE": "1", "CLAUDE_PID": str(os.getpid()), "CODEX_THREAD_ID": "x"}
        with self._pid_e_claude(), self.assertRaises(ValueError) as e:
            tavolo.riconosci(env, antenati=None)
        self.assertIn("--come", str(e.exception))
        self.assertEqual(tavolo.riconosci(env, come="codex", antenati=None)["lato"], "codex")

    def test_claude_pid_morto_e_un_marcatore_vecchio(self):
        # Misurato il 29/10: l'ambiente globale di tmux porta CLAUDECODE=1 e il
        # CLAUDE_PID di una sessione chiusa; un Codex in quel pannello e' Codex.
        env = {"CLAUDECODE": "1", "CLAUDE_PID": str(_pid_morto()), "CODEX_THREAD_ID": "x"}
        self.assertEqual(tavolo.riconosci(env, antenati=None)["lato"], "codex")

    def test_nessun_antenato_agente_non_si_indovina_dai_marcatori(self):
        # Antenati leggibili e nessun client fra loro: i marcatori sono ereditati
        # (un terminale dentro tmux), non provano niente.
        with self.assertRaises(ValueError):
            tavolo.riconosci({"CLAUDECODE": "1", "CLAUDE_PID": str(os.getpid())},
                             antenati=[(3, "/bin/zsh"), (2, "/opt/homebrew/bin/tmux")])

    def test_come_contro_l_evidenza_e_un_errore(self):
        with self.assertRaises(ValueError):
            tavolo.riconosci({}, come="codex", antenati=[(20, CLAUDE_EXE)])
        with self.assertRaises(ValueError):
            tavolo.riconosci({"AM_SHELL": "x"}, come="codex", antenati=[])
        with self.assertRaises(ValueError):
            tavolo.riconosci({}, come="gemini", antenati=[])
        self.assertEqual(tavolo.riconosci({}, come="claude", antenati=[(20, CLAUDE_EXE)])["lato"], "claude")

    def test_le_variabili_esplicite_vincono_e_l_ambiguita_resta_errore(self):
        self.assertEqual(tavolo.riconosci({"CODEX_SHELL": "x"}, antenati=[(20, CLAUDE_EXE)])["lato"], "codex")
        with self.assertRaises(ValueError):
            tavolo.riconosci({"AM_SHELL": "x", "CODEX_SHELL": "y"}, antenati=[])

    def test_antenati_veri_si_leggono(self):
        os.environ.pop("TAVOLO_SENZA_ANTENATI")
        a = tavolo._antenati()
        if a is None:
            self.skipTest("antenati non leggibili su questa macchina")
        self.assertTrue(a)
        self.assertTrue(all(isinstance(p, int) and isinstance(x, str) for p, x in a))


class TorreDestinatario(unittest.TestCase):
    """Re-QA BUG-6: il «chiedi» dentro una conv predefinisce l'altro LLM della
    conv, mai il primo collegato, e mai un bridge (che spende token)."""

    def _destinatari(self, pres, predef):
        import re
        import shutil
        node = shutil.which("node")
        if not node:
            self.skipTest("node non disponibile")
        html = (REPO / "tools/control_center/static/index.html").read_text(encoding="utf-8")
        nomi = re.search(r"^const NOME_LATO=.*?;$", html, re.M).group(0)
        fn = re.search(r"^function destinatari\(.*?^}$", html, re.M | re.S).group(0)
        js = f"{nomi}\n{fn}\nconsole.log(JSON.stringify(destinatari({json.dumps(pres)},{json.dumps(predef)})))"
        r = subprocess.run([node, "-e", js], capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        return [o["v"] for o in json.loads(r.stdout)]

    def test_predefinito_e_l_altro_llm_della_conv(self):
        claude_vivo = [{"identita": "claude", "vivo": True, "client": "claude-code"}]
        # Conv con palla a codex, ma collegato c'e' solo claude: niente claude|sessione in testa.
        v = self._destinatari(claude_vivo, "codex")
        self.assertEqual(v[0], "")
        self.assertIn("claude|sessione", v)
        # L'altro LLM collegato: la sua sessione e' il predefinito (non spende token).
        both = claude_vivo + [{"identita": "codex", "vivo": True, "client": "codex"}]
        self.assertEqual(self._destinatari(both, "codex")[0], "codex|sessione")
        self.assertEqual(self._destinatari(both, "claude")[0], "claude|sessione")

    def test_mai_un_bridge_predefinito(self):
        for pres in ([], [{"identita": "codex", "vivo": False, "client": "codex"}],
                     [{"identita": "claude", "vivo": True, "client": "claude-code"}]):
            for predef in ("claude", "codex"):
                v = self._destinatari(pres, predef)
                self.assertFalse(v[0].endswith("|bridge"), (pres, predef, v))
                self.assertIn(predef + "|bridge", v)        # sceglibile, mai predefinito

    def test_nessun_ripiego_silenzioso_sul_bridge(self):
        html = (REPO / "tools/control_center/static/index.html").read_text(encoding="utf-8")
        self.assertFalse('predef+"|bridge"' in html)


class TorreCockpit(unittest.TestCase):
    """La home della torre e' cockpit.html, non il canvas: il Tavolo deve stare
    nella sua barra, come pagina (`#tavolo`), con la stessa logica del settore."""

    STATIC = REPO / "tools/control_center/static"

    def _html(self, nome):
        return (self.STATIC / nome).read_text(encoding="utf-8")

    def _blocco_js(self, html):
        import re
        return re.search(r"/\* ═+ Tavolo ═+ \*/(.*?)/\* ═+ ", html, re.S).group(1)

    def test_voce_nella_barra_e_pagina(self):
        html = self._html("cockpit.html")
        self.assertIn('href="#tavolo" data-v="tavolo"', html)
        self.assertIn('id="nav-tavolo"', html)
        self.assertIn('id="vista-tavolo"', html)
        for nodo in ("tav-kpi", "tav-pres", "tav-conv", "tav-nuova", "tav-freni", "tav-rifiuti"):
            self.assertIn(f'id="{nodo}"', html)
        self.assertIn('const ALTRE=["dafare","sistema","tavolo"]', html)
        self.assertIn("(dafare|sistema|tavolo)", html)

    def test_destinatari_e_lo_stesso_codice_del_canvas(self):
        # Copiata, non riscritta: se una delle due copie cambia, il test lo dice.
        import re
        estrai = lambda h: (re.search(r"^const NOME_LATO=.*?;$", h, re.M).group(0),
                            re.search(r"^function destinatari\(.*?^}$", h, re.M | re.S).group(0))
        self.assertEqual(estrai(self._html("cockpit.html")), estrai(self._html("index.html")))

    def test_testo_mai_come_html(self):
        js = self._blocco_js(self._html("cockpit.html"))
        self.assertIn("/api/tavolo", js)
        self.assertNotIn("innerHTML", js)
        self.assertIn('"X-CC-Token":TOKEN', js)

    def test_badge_conta_solo_la_palla_ad_andrea_sulle_aperte(self):
        import re
        import shutil
        node = shutil.which("node")
        if not node:
            self.skipTest("node non disponibile")
        fn = re.search(r"^function tuoiTavolo\(.*?^}$", self._html("cockpit.html"), re.M | re.S).group(0)
        conv = [{"aperta": True, "palla": "andrea"}, {"aperta": False, "palla": "andrea"},
                {"aperta": True, "palla": "codex"}, {"aperta": True, "palla": "andrea"}]
        js = f"{fn}\nconsole.log(tuoiTavolo({json.dumps({'conv': conv})}), tuoiTavolo(null), tuoiTavolo({{}}))"
        r = subprocess.run([node, "-e", js], capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.split(), ["2", "0", "0"])

    def test_la_home_servita_ha_il_tavolo(self):
        from . import server
        httpd = server.make_server(0)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            porta = httpd.server_address[1]
            html = urllib.request.urlopen(f"http://127.0.0.1:{porta}/", timeout=10).read().decode()
            self.assertIn('data-v="tavolo"', html)
            self.assertNotIn("__CC_TOKEN__", html)
        finally:
            httpd.shutdown()
            httpd.server_close()


class TorreBrowser(Base):
    """QA #570 punti 1, 4, 5, 6: la pagina vera in un Chrome headless, servita
    da un server su porta effimera e TAVOLO_DIR temporaneo. Salta se Playwright
    o Chrome mancano (la logica server resta coperta dalle classi sopra)."""

    LARGHEZZE = (390, 721, 768, 900, 1024, 1032, 1440)

    def setUp(self):
        super().setUp()
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            self.skipTest("playwright non installato")
        from . import server
        self.httpd = server.make_server(0)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}/"
        self.pw = sync_playwright().start()
        try:
            self.browser = self.pw.chromium.launch(channel="chrome")
        except Exception as exc:  # noqa: BLE001
            self.pw.stop()
            self.httpd.shutdown()
            self.httpd.server_close()
            self.skipTest(f"Chrome headless non disponibile: {exc}")
        self.errori = []

    def tearDown(self):
        if hasattr(self, "browser"):
            self.browser.close()
            self.pw.stop()
            self.httpd.shutdown()
            self.httpd.server_close()
        super().tearDown()

    def pagina(self, larghezza=1440, hash_="", orologio=False):
        p = self.browser.new_page(viewport={"width": larghezza, "height": 900})
        p.on("pageerror", lambda e: self.errori.append(str(e)))
        if orologio:
            p.clock.install()
        p.goto(self.url + hash_)
        p.wait_for_selector("#navtorre a")
        return p

    def test_barra_cliccabile_a_ogni_larghezza(self):
        # Punto 1: fra 721 e ~1030 px la barra andava a capo sotto un'intestazione
        # alta 44 px fissi e finiva sotto `main`: le voci non si cliccavano.
        js = """() => [...document.querySelectorAll('#navtorre a')].map(a => {
                  const r = a.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
                  const e = document.elementFromPoint(x, y);
                  return [a.textContent.trim(), !!e && a.contains(e), Math.round(y)]; })"""
        for w in self.LARGHEZZE:
            p = self.pagina(w)
            voci = p.evaluate(js)
            self.assertEqual(len(voci), 5)
            for nome, ok, y in voci:
                self.assertTrue(ok, f"{w}px: «{nome}» coperta (y={y})")
            self.assertLessEqual(p.evaluate("document.documentElement.scrollWidth"), w, f"{w}px scorre di lato")
            p.close()
        self.assertEqual(self.errori, [])

    def test_pid_morto_non_si_dice_non_verificato(self):
        # Punto 4: «pid morto ... (non verificato)» si contraddiceva.
        tavolo.collegati({"lato": "codex", "client": "codex", "pid": _pid_morto(), "exe": None,
                          "riconosciuto": "test"})
        p = self.pagina(hash_="#tavolo")
        p.wait_for_selector("#tav-pres .sis-r")
        testo = p.inner_text("#tav-pres")
        self.assertIn("pid morto", testo)
        self.assertNotIn("non verificato", testo)
        self.assertEqual(self.errori, [])

    def test_live_spento_niente_chiedi(self):
        # Punto 5: con l'interruttore OFF il «chiedi» c'era e finiva in un errore.
        m = tavolo.invia("andrea", "codex", "aperta prima dello spegnimento")
        self.assertTrue(m)
        (self.dir / "LIVE").unlink()
        p = self.pagina(hash_="#tavolo")
        p.wait_for_selector("#tav-nuova .nulla")
        attivi = p.evaluate("""() => [...document.querySelectorAll('#vista-tavolo button')]
                                 .filter(b => b.textContent.trim() === 'chiedi' && !b.disabled).length""")
        self.assertEqual(attivi, 0)
        self.assertIn("OFF", p.inner_text("#tav-nuova"))
        self.assertEqual(self.errori, [])

    def test_un_solo_giro_per_tick_a_pagina_aperta(self):
        # Punto 6a: a pagina Tavolo aperta il giro da 60 s e quello da 15 s
        # chiedevano /api/tavolo nello stesso secondo.
        p = self.pagina(hash_="#tavolo", orologio=True)
        p.wait_for_selector("#tav-kpi .sis-k")
        chiamate = []
        p.on("request", lambda r: chiamate.append(r.url) if r.url.endswith("/api/tavolo") else None)
        p.clock.run_for(60_000)
        p.wait_for_timeout(500)
        self.assertEqual(len(chiamate), 4, chiamate)   # 15, 30, 45, 60 s: uno per tick
        self.assertEqual(self.errori, [])

    def test_badge_vecchio_se_l_endpoint_tace(self):
        # Punto 6b: dopo aver dato dati, se /api/tavolo tace il badge restava vecchio.
        m = tavolo.invia("andrea", "codex", "domanda")
        tavolo.invia("codex", "andrea", "risposta", tipo="verdetto", in_risposta_a=m["id"])
        p = self.pagina(orologio=True)
        p.wait_for_function("document.getElementById('nav-tavolo').textContent === '1'")
        p.route("**/api/tavolo", lambda r: r.abort())
        p.clock.run_for(61_000)
        p.wait_for_function("document.getElementById('nav-tavolo').textContent !== '1'")
        self.assertIn("non aggiornato", p.get_attribute("#nav-tavolo", "title") or "")
        self.assertEqual(self.errori, [])


class Wrapper(unittest.TestCase):
    """~/.local/bin/tavolo: trova il repo da solo, o dice perche' non lo trova."""

    def _lancia(self, env_extra):
        w = REPO / "tools/tavolo-wrapper.sh"
        env = {"PATH": os.environ["PATH"], "HOME": os.environ["HOME"], **env_extra}
        return subprocess.run(["bash", str(w), "stato", "--json"], env=env, capture_output=True,
                              text=True, timeout=60)

    def test_usa_tavolo_repo(self):
        with tempfile.TemporaryDirectory() as t:
            r = self._lancia({"TAVOLO_REPO": str(REPO), "TAVOLO_DIR": t})
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("presenze", json.loads(r.stdout))

    def test_repo_introvabile_messaggio_chiaro(self):
        with tempfile.TemporaryDirectory() as t:
            r = self._lancia({"TAVOLO_REPO": t + "/nulla", "HOME": t})
            self.assertEqual(r.returncode, 2)
            self.assertIn("TAVOLO_REPO", r.stderr)


if __name__ == "__main__":
    unittest.main()
