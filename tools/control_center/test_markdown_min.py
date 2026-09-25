"""Il sottoinsieme di markdown che le project card usano davvero.

Non copre CommonMark di proposito: copre quello che i tre registri scrivono,
piu' i due casi in cui un renderer scritto a mano fa danni (HTML dentro una
card, un href non http).
"""

import unittest

from .markdown_min import rendi


class Rendi(unittest.TestCase):
    def test_escape_prima_di_tutto(self):
        out = rendi("<script>alert(1)</script> & <b>no</b>")
        self.assertNotIn("<script>", out)
        self.assertIn("&lt;script&gt;", out)
        self.assertIn("&amp;", out)

    def test_href_solo_http(self):
        self.assertIn('href="https://x.io"', rendi("[x](https://x.io)"))
        out = rendi("[clicca](javascript:alert(1))")
        self.assertNotIn("href", out)
        self.assertIn("clicca", out)

    def test_titoli(self):
        self.assertIn("<h2>Unit economics</h2>", rendi("## Unit economics"))

    def test_tabella(self):
        out = rendi("| A | B |\n|---|---|\n| $5,03 | **x** |\n")
        self.assertIn("<table>", out)
        self.assertIn("<th>A</th>", out)
        self.assertIn("<td>$5,03</td>", out)
        self.assertIn("<td><strong>x</strong></td>", out)

    def test_tabella_senza_riga_di_allineamento_non_e_tabella(self):
        self.assertNotIn("<table>", rendi("| a | b |\n| c | d |\n"))

    def test_checkbox(self):
        out = rendi("- [ ] da fare\n- [x] fatto\n")
        self.assertIn("☐", out)
        self.assertIn("☑", out)
        self.assertIn('class="spunta fatta"', out)
        # `.task` e' gia' preso dal settore "Da fare" della torre.
        self.assertNotIn('class="task', out)

    def test_lista_annidata(self):
        out = rendi("- uno\n  - uno.a\n- due\n")
        self.assertEqual(out.count("<ul>"), 2)
        self.assertEqual(out.count("</ul>"), 2)

    def test_blocco_stato_e_citazione_e_i_marcatori_spariscono(self):
        out = rendi("<!-- STATO:start -->\n> 🟢 **STATO** · `ATTIVO`\n<!-- STATO:end -->\n")
        self.assertIn('<blockquote class="stato">', out)
        self.assertIn("</blockquote>", out)
        self.assertNotIn("STATO:start", out)
        self.assertIn("<code>ATTIVO</code>", out)

    def test_codice_recintato_non_interpreta_il_markdown_dentro(self):
        out = rendi("```\n# non un titolo\n**non grassetto**\n```\n")
        self.assertIn("<pre><code>", out)
        self.assertNotIn("<h1>", out)
        self.assertNotIn("<strong>", out)

    def test_barrato_e_wikilink(self):
        out = rendi("~~risolto~~ vedi [[quartier-generale]]")
        self.assertIn("<del>risolto</del>", out)
        self.assertIn('<span class="wiki">quartier-generale</span>', out)

    def test_frontmatter_fuori_dal_corpo(self):
        out = rendi('---\nname: x\ndescription: "y"\n---\n# Titolo\n')
        self.assertNotIn("description", out)
        self.assertIn("<h1>Titolo</h1>", out)

    def test_nessun_tag_aperto_resta_aperto(self):
        out = rendi("- a\n  - b\n\n## fine\n")
        self.assertEqual(out.count("<ul>"), out.count("</ul>"))
        self.assertEqual(out.count("<li"), out.count("</li>"))

    def test_grassetto_dentro_una_spunta_resta_nella_stessa_riga(self):
        # Il caso che ha rotto la roadmap Etsy: `- [ ] testo **(nota)**`
        # usciva con una parola per riga.
        out = rendi("- [ ] budget 50-150$ **(Andrea approva)**\n")
        self.assertEqual(out.count("<li"), 1)
        self.assertIn("<strong>(Andrea approva)</strong>", out)
        self.assertIn('<span class="segno">☐</span><span>', out)

    def test_lista_annidata_dentro_il_suo_punto(self):
        out = rendi("- padre\n  - figlio\n")
        self.assertIn("<li>padre\n<ul>", out.replace("</ul>\n</li>", "</ul>\n</li>"))
        self.assertNotIn("</li>\n<ul>", out)

    def test_riga_di_continuazione_resta_dentro_il_punto(self):
        out = rendi("- punto\n  continua qui\n")
        self.assertIn("<br>continua qui", out)
        self.assertEqual(out.count("<li"), out.count("</li>"))


if __name__ == "__main__":
    unittest.main()
