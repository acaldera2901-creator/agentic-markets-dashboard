"""Il Tavolo: freni, claim/lease, simmetria, guardia anti-catena, ruoli, API.

Tutto gira in una cartella temporanea (TAVOLO_DIR) con due binari finti al
posto di `codex` e `claude`: i test non spendono un token. La prova reale con
`codex exec` vero e' a parte (vedi docs/tavolo.md, «Verificato»).
"""

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
                         list(self.env) + ["AM_SHELL", "CODEX_SHELL", "BRIDGE_DEPTH", "FINTO_ESITO"]}
        os.environ.update(self.env)
        for k in ("AM_SHELL", "CODEX_SHELL", "BRIDGE_DEPTH", "FINTO_ESITO"):
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

    def test_stesso_testo_in_risposta_a_messaggi_diversi_non_e_duplicato(self):
        a = tavolo.invia("claude", "codex", "domanda uno")
        b = tavolo.invia("claude", "codex", "domanda due")
        tavolo.invia("codex", "claude", "ok", in_risposta_a=a["id"])
        tavolo.invia("codex", "claude", "ok", in_risposta_a=b["id"])

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
        lp = tavolo._lock_worktree(str(wt), "claude")
        with self.assertRaises(tavolo.Rifiutato):
            tavolo._lock_worktree(str(wt), "codex")
        lp.unlink()


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
