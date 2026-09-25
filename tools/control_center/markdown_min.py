"""Markdown -> HTML, solo quello che le project card usano davvero.

Non e' un motore di markdown: e' il sottoinsieme misurato sui tre registri
(titoli, citazione del blocco STATO, liste anche annidate, checkbox, tabelle
pipe, codice recintato, righello, grassetto/corsivo/codice/link/wikilink).
Scritto a mano e senza dipendenze per tre motivi:

1. Il server della torre gira su `/opt/homebrew/bin/python3`, il collector sul
   venv del repo: una libreria installata in uno dei due non e' installata
   nell'altro, e il modo in cui se ne accorge e' un 500 in pagina.
2. L'unico input sono file che scriviamo noi, non contenuto di terzi: serve
   che sia **leggibile**, non che copra CommonMark.
3. L'escape viene prima di tutto il resto, quindi non esiste un percorso in cui
   un `<script>` dentro una card diventi uno `<script>` nella pagina. Gli unici
   tag emessi sono quelli che genera questo file.
"""

from __future__ import annotations

import html
import re

_FENCE = re.compile(r"^\s*```+\s*([\w+-]*)\s*$")
_HEAD = re.compile(r"^(#{1,6})\s+(.*)$")
_HR = re.compile(r"^\s*(?:-{3,}|\*{3,}|_{3,})\s*$")
_UL = re.compile(r"^(\s*)[-*+]\s+(.*)$")
_OL = re.compile(r"^(\s*)(\d+)[.)]\s+(.*)$")
_TASK = re.compile(r"^\[([ xX])\]\s*(.*)$")
_ALLINEA = re.compile(r"^\s*:?-{2,}:?\s*$")

# inline, applicate su testo gia' escapato (l'escape non tocca questi simboli)
_CODICE = re.compile(r"`([^`]+)`")
_LINK = re.compile(r"\[([^\]\[]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)")
_WIKI = re.compile(r"\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]")
_FORTE = re.compile(r"\*\*([^*]+)\*\*")
_BARRATO = re.compile(r"~~([^~]+)~~")
_ENF = re.compile(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])")
_ENF_ = re.compile(r"(?<![\w_])_([^_\n]+)_(?![\w_])")
# Solo http/https: un `javascript:` in un href non deve mai uscire da qui.
_HREF_OK = re.compile(r"^https?://", re.I)


def _inline(testo: str) -> str:
    out = html.escape(testo, quote=True)
    pezzi: list[str] = []

    def _riserva(m: re.Match) -> str:
        pezzi.append(f"<code>{m.group(1)}</code>")
        return f"\x00{len(pezzi) - 1}\x00"

    out = _CODICE.sub(_riserva, out)
    out = _WIKI.sub(lambda m: f'<span class="wiki">{m.group(2) or m.group(1)}</span>', out)

    def _link(m: re.Match) -> str:
        url = html.unescape(m.group(2))
        if not _HREF_OK.match(url):
            return m.group(1)
        return f'<a href="{html.escape(url, quote=True)}" rel="noopener" target="_blank">{m.group(1)}</a>'

    out = _LINK.sub(_link, out)
    out = _FORTE.sub(r"<strong>\1</strong>", out)
    out = _BARRATO.sub(r"<del>\1</del>", out)
    out = _ENF.sub(r"<em>\1</em>", out)
    out = _ENF_.sub(r"<em>\1</em>", out)
    for i, p in enumerate(pezzi):
        out = out.replace(f"\x00{i}\x00", p)
    return out


def _riga_tabella(riga: str) -> list[str] | None:
    s = riga.strip()
    if not s.startswith("|"):
        return None
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s[1:].split("|")]


class _Costruttore:
    """Tiene aperte liste e citazione, e le chiude quando il blocco cambia.

    Il `<li>` resta aperto finche' non arriva il punto successivo: e' l'unico
    modo per mettere una lista annidata *dentro* il suo punto invece che
    accanto, e per attaccare al punto la riga che lo continua.
    """

    def __init__(self) -> None:
        self.out: list[str] = []
        # (indentazione, tag, li aperto)
        self.liste: list[list] = []
        self.cit = False

    def _chiudi_livello(self) -> None:
        ind, tag, aperto = self.liste.pop()
        if aperto:
            self.out.append("</li>")
        self.out.append(f"</{tag}>")

    def chiudi_liste(self, fino_a: int = -1) -> None:
        while self.liste and self.liste[-1][0] > fino_a:
            self._chiudi_livello()

    def punto(self, ind: int, tag: str, corpo: str) -> None:
        while self.liste and self.liste[-1][0] > ind:
            self._chiudi_livello()
        if self.liste and self.liste[-1][0] == ind and self.liste[-1][1] != tag:
            self._chiudi_livello()
        if not self.liste or self.liste[-1][0] < ind:
            self.out.append(f"<{tag}>")
            self.liste.append([ind, tag, False])
        elif self.liste[-1][2]:
            self.out.append("</li>")
        self.out.append(corpo)
        self.liste[-1][2] = True

    def chiudi_citazione(self) -> None:
        if self.cit:
            self.chiudi_liste()
            self.out.append("</blockquote>")
            self.cit = False

    def apri_citazione(self) -> None:
        if not self.cit:
            self.chiudi_liste()
            self.out.append('<blockquote class="stato">')
            self.cit = True

    def blocco(self) -> None:
        """Fine di un paragrafo/lista: chiude le liste, non la citazione."""
        self.chiudi_liste()


def rendi(testo: str) -> str:
    """Il corpo della card in HTML. Il frontmatter, se c'e', non entra."""
    righe = _senza_frontmatter(testo).splitlines()
    b = _Costruttore()
    i = 0
    n = len(righe)
    while i < n:
        riga = righe[i]

        fence = _FENCE.match(riga)
        if fence:
            b.chiudi_citazione()
            b.blocco()
            corpo: list[str] = []
            i += 1
            while i < n and not _FENCE.match(righe[i]):
                corpo.append(righe[i])
                i += 1
            i += 1
            b.out.append("<pre><code>" + html.escape("\n".join(corpo)) + "</code></pre>")
            continue

        # I commenti HTML (i marcatori STATO:start/end) non si mostrano.
        if riga.strip().startswith("<!--"):
            while i < n and "-->" not in righe[i]:
                i += 1
            i += 1
            continue

        if not riga.strip():
            b.chiudi_citazione()
            b.blocco()
            i += 1
            continue

        # citazione: il blocco STATO. Si spoglia il `>` e si continua a
        # trattare il contenuto come markdown normale, dentro il blockquote.
        if riga.lstrip().startswith(">"):
            b.apri_citazione()
            riga = re.sub(r"^\s*>\s?", "", riga)
            if not riga.strip():
                b.blocco()
                i += 1
                continue
        elif b.cit:
            b.chiudi_citazione()

        tab = _riga_tabella(riga)
        if tab is not None and i + 1 < n:
            sotto = _riga_tabella(righe[i + 1])
            if sotto and all(_ALLINEA.match(c) for c in sotto) and len(sotto) == len(tab):
                b.blocco()
                i = _tabella(b, righe, i, tab, len(sotto))
                continue

        h = _HEAD.match(riga)
        if h:
            b.blocco()
            liv = len(h.group(1))
            b.out.append(f"<h{liv}>{_inline(h.group(2).strip())}</h{liv}>")
            i += 1
            continue

        if _HR.match(riga):
            b.blocco()
            b.out.append("<hr>")
            i += 1
            continue

        ul = _UL.match(riga)
        ol = _OL.match(riga)
        if ul or ol:
            ind = len((ul or ol).group(1).expandtabs(4))
            tag = "ul" if ul else "ol"
            contenuto = ul.group(2) if ul else ol.group(3)
            task = _TASK.match(contenuto)
            if task:
                # `spunta`, non `task`: nella torre `.task` e' gia' la scheda
                # del settore "Da fare", ed e' una griglia a tre colonne.
                fatto = task.group(1).lower() == "x"
                corpo = (f'<li class="spunta{" fatta" if fatto else ""}">'
                         f'<span class="segno">{"☑" if fatto else "☐"}</span>'
                         f"<span>{_inline(task.group(2))}</span>")
            else:
                corpo = f"<li>{_inline(contenuto)}"
            b.punto(ind, tag, corpo)
            i += 1
            continue

        # paragrafo: dentro una lista e' la continuazione dell'ultimo punto,
        # e sta dentro quel `<li>`, non accanto.
        if b.liste and b.liste[-1][2]:
            b.out.append(f"<br>{_inline(riga.strip())}")
        else:
            b.chiudi_liste()
            b.out.append(f"<p>{_inline(riga.strip())}</p>")
        i += 1

    b.chiudi_citazione()
    b.blocco()
    return "\n".join(b.out)


def _tabella(b: _Costruttore, righe: list[str], i: int, intestazione: list[str],
             colonne: int) -> int:
    b.out.append('<div class="tabella"><table><thead><tr>')
    for c in intestazione:
        b.out.append(f"<th>{_inline(c)}</th>")
    b.out.append("</tr></thead><tbody>")
    i += 2
    while i < len(righe):
        celle = _riga_tabella(righe[i])
        if celle is None:
            break
        celle = (celle + [""] * colonne)[:colonne]
        b.out.append("<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in celle) + "</tr>")
        i += 1
    b.out.append("</tbody></table></div>")
    return i


def _senza_frontmatter(testo: str) -> str:
    if not testo.startswith("---"):
        return testo
    fine = testo.find("\n---", 3)
    if fine < 0:
        return testo
    resto = testo[fine + 4:]
    return resto[1:] if resto.startswith("\n") else resto
