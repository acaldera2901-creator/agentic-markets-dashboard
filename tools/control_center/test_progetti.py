"""La vista delle card: quello che non deve poter succedere.

Gira sui tre registri veri di questa macchina. Se un registro non c'e' (un
altro Mac, la CI) i test che lo riguardano si saltano invece di fallire: non
c'e' niente di rotto nel codice se manca una cartella di Andrea.
"""

import unittest

from . import progetti


class Elenco(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = progetti.elenco()
        cls.per_id = {s["id"]: s for s in cls.d["schede"]}
        if not cls.per_id:
            raise unittest.SkipTest("nessun registro di card su questa macchina")

    def test_ogni_id_e_unico(self):
        ids = [s["id"] for s in self.d["schede"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_l_elenco_e_la_scheda_dicono_la_stessa_fase(self):
        """Il difetto che il registro unico esiste per non avere: due viste
        della stessa card che non concordano (l'elenco leggeva 8 KB)."""
        discordi = []
        for ident, riga in self.per_id.items():
            intera = progetti.scheda(ident)
            if intera["fase"] != riga["fase"]:
                discordi.append((ident, riga["fase"], intera["fase"]))
        self.assertEqual(discordi, [])

    def test_fase_anche_quando_il_backtick_chiude_tardi(self):
        # `ARCHIVIATO LATO NOSTRO — HANDOFF…` chiude il backtick 20 parole dopo.
        s = self.per_id.get("azienda/project_instagram_betredge")
        if s is None:
            self.skipTest("card non presente")
        self.assertEqual(s["fase"], "ARCHIVIATO")

    def test_fase_anche_nelle_card_senza_blocco_stato(self):
        s = self.per_id.get("sistema/machina")
        if s is None:
            self.skipTest("card non presente")
        self.assertEqual(s["fase"], "OPERATIVO")
        self.assertFalse(s["ha_stato"])


class Scheda(unittest.TestCase):
    def test_un_id_fuori_indice_non_apre_niente(self):
        for cattivo in ("../../../etc/passwd", "/etc/passwd", "sistema/../../.ssh/id_rsa",
                        "sistema", "", "azienda/project_nonesiste"):
            self.assertIsNone(progetti.scheda(cattivo), cattivo)

    def test_la_scheda_porta_il_percorso_della_fonte(self):
        elenco = progetti.elenco()["schede"]
        if not elenco:
            self.skipTest("nessun registro di card su questa macchina")
        s = progetti.scheda(elenco[0]["id"])
        self.assertTrue(s["percorso"].endswith(s["file"]))
        self.assertIn("html", s)
        self.assertIsInstance(s["agenti"], list)


class Agenti(unittest.TestCase):
    def test_la_sala_muta_non_rompe_la_scheda(self):
        self.assertEqual(progetti.agenti_sul_progetto("side-hustle-etsy", {}), [])
        self.assertEqual(progetti.agenti_sul_progetto("side-hustle-etsy",
                                                      {"agenti": None}), [])

    def test_aggancia_per_nome_e_dice_dove(self):
        sala = {"agenti": [
            {"nome": "me-segretaria", "agente": "segretaria", "stato": "busy",
             "task": "collego Printify al negozio, vedi side-hustle-etsy", "cwd": "/x"},
            {"nome": "br-dev", "agente": "programmatore", "stato": "idle",
             "task": "tutt'altro", "cwd": "/y"},
        ]}
        fuori = progetti.agenti_sul_progetto("side-hustle-etsy", sala)
        self.assertEqual([a["nome"] for a in fuori], ["me-segretaria"])
        self.assertEqual(fuori[0]["dove"], "task")

    def test_una_parola_generica_non_aggancia_mezzo_sistema(self):
        sala = {"agenti": [{"nome": "x", "task": "sto sistemando una card del sito",
                            "cwd": "/z"}]}
        self.assertEqual(progetti.agenti_sul_progetto("project_card_sito", sala), [])


if __name__ == "__main__":
    unittest.main()
