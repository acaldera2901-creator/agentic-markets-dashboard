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
        # La card vera cambia fase (era OPERATIVO, dal 30/09 «Bloccato»): il
        # test guarda che la riga legacy venga letta, non quale fase dichiara.
        s = self.per_id.get("sistema/machina")
        if s is None:
            self.skipTest("card non presente")
        self.assertIn(s["fase"], progetti.FASI)
        self.assertEqual(s["fase_fonte"], "legacy")
        self.assertFalse(s["ha_stato"])

    def test_le_card_vere_dell_audit_0101(self):
        attese = {"azienda/project_betredge_heknew_video": "BLOCCATO",
                  "azienda/project_affiliate_v2": "BLOCCATO"}
        for ident, fase in attese.items():
            if ident in self.per_id:
                self.assertEqual(self.per_id[ident]["fase"], fase, ident)
        s = self.per_id.get("azienda/project_email_warmup_news_subdomain")
        if s is not None:
            # la testata del 29/09 non dichiara una fase: il BLOCCATO del 15/09 non vale
            self.assertNotEqual(s["fase_fonte"], "blocco")


CARD_FASE_SENZA_BACKTICK = """<!-- STATO:start -->
**Fase:** 🔴 BLOCCATO — attende Andrea (visione del file)
**Prossima azione:** Andrea guarda il video. Owner: Andrea.
<!-- STATO:end -->
"""

CARD_PAUSA = """<!-- STATO:start -->
- **Fase:** 🟡 IN PAUSA per scelta di Andrea (2026-09-30)
- **Prossima azione:** Andrea porta l'accesso. Owner: Andrea → Claude.
<!-- STATO:end -->
"""

# La forma di project_email_warmup_news_subdomain: testata recente senza
# fase, azione come titolo con la lista sotto, voci storiche BLOCCATO sotto.
CARD_STORICA = """<!-- STATO:start -->
> ✅ **DECISIONE ANDREA 2026-09-25:** teniamo il banner
>
> 🔴 **STATO 2026-09-29 · g28 CONFERMATO `sent` · g29 IN DRAFT**
>
> **PROSSIMA AZIONE:**
> 1. **Andrea — sbloccare la quota** — *owner: Andrea*
> 2. dopo lo sblocco: Send
>
> 🔴 **STATO 2026-09-15 · `BLOCCATO` — il template non passa il gate**
> **PROSSIMA AZIONE (in quest'ordine):**
> 1. vecchia azione
> <details><summary>Stato precedente</summary>
> 🟢 **STATO 2026-09-30 · `ATTIVO`** — dentro details: non conta
> </details>
<!-- STATO:end -->
"""


class Parser(unittest.TestCase):
    def _s(self, testo):
        return progetti._scheda(progetti.Path("/nonesiste/project_x.md"), "azienda", "Azienda", testo)

    def test_fase_senza_backtick_nel_campo(self):
        s = self._s(CARD_FASE_SENZA_BACKTICK)
        self.assertEqual((s["fase"], s["fase_fonte"]), ("BLOCCATO", "campo Fase"))

    def test_in_pausa_e_bloccato_e_il_punto_elenco_non_nasconde_il_campo(self):
        s = self._s(CARD_PAUSA)
        self.assertEqual(s["fase"], "BLOCCATO")
        self.assertTrue(s["prossima_azione"].startswith("Andrea porta"))

    def test_la_fase_viene_solo_dalla_testata_piu_recente(self):
        s = self._s(CARD_STORICA)
        self.assertIsNone(s["fase"])            # non il BLOCCATO del 15/09
        self.assertEqual(s["stato_data"], "2026-09-29")   # non il 30/09 in <details>
        self.assertEqual(s["prossima_azione"],
                         "**Andrea — sbloccare la quota** — *owner: Andrea*")

    def test_i_casi_esistenti_restano(self):
        s = self._s("<!-- STATO:start -->\n> 🟢 **STATO 2026-09-29 · `ATTIVO`**\n"
                    "> **Prossima azione:** fare x\n<!-- STATO:end -->")
        self.assertEqual((s["fase"], s["fase_fonte"], s["prossima_azione"]),
                         ("ATTIVO", "testata", "fare x"))
        s = self._s("<!-- STATO:start -->\n> nota `OPERATIVO` senza testata\n<!-- STATO:end -->")
        self.assertEqual((s["fase"], s["fase_fonte"]), ("OPERATIVO", "blocco"))


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
