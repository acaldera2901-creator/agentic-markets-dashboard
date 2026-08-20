#!/usr/bin/env python3
"""Porta machina.css (il sistema della preview) in app/machina.css incapsulato.

Perché uno script e non un copia-incolla: la trasformazione è meccanica su 579
righe, e va rifatta ogni volta che il sistema della preview cambia. A mano si
sbaglia un selettore su cento e il difetto non si vede — appare come "quella
regola non ha preso".

Lo scope è DOPPIO:
  :root:not([data-theme="light"])   il prodotto ha un tema chiaro VIVO (il
                                    toggle nel desk). Il fondo cinematico è
                                    scuro: applicarlo anche in chiaro darebbe
                                    un ibrido rotto. In chiaro il prodotto
                                    resta quello di oggi.
  [data-mc]                         nessuna regola agisce fuori dal sottoalbero
                                    che porta l'attributo → rollout per pagina,
                                    rimozione = un attributo in meno.

Uso:  python3 docs/ui-machina/src/port-to-scoped.py
"""
import re, sys, pathlib

SRC = pathlib.Path("docs/ui-machina/machina.css")
DST = pathlib.Path("app/machina.css")
SCOPE = ':root:not([data-theme="light"]) [data-mc]'

def main() -> int:
    src = SRC.read_text(encoding="utf-8")

    # ── 1. fuori ciò che è solo della preview ────────────────────────────────
    # per riga: il src dei @font-face contiene }} e romperebbe un match [^}]*
    keep = []
    for line in src.split("\n"):
        if line.startswith("@font-face"):            # i font arrivano da next/font
            continue
        if re.match(r"^\.(pbar|pchip)", line):       # barra di preview
            continue
        if line.strip() in ("/* ── barra di preview ── */",
                            "*{box-sizing:border-box}"):   # già in globals.css
            continue
        if line.startswith(':root,:root[data-theme="dark"]'):  # color-scheme
            continue
        keep.append(line)
    src = "\n".join(keep)
    src = src.replace(
        "Tema unico: il prodotto è a carta chiara, quindi la preview non\n"
        "   segue il tema del lettore — mostrerebbe qualcosa che non esiste.",
        "Fondo cinematico scuro (spec §4.3). Generato da\n"
        "   docs/ui-machina/src/port-to-scoped.py — non si edita a mano.")

    # ── 2. maschera i commenti: non devono mai finire dentro un selettore ────
    comments: list[str] = []
    def stash(m):
        comments.append(m.group(0))
        return f"\x00{len(comments)-1}\x00"
    src = re.sub(r"/\*.*?\*/", stash, src, flags=re.S)

    def scope_selector(sel: str) -> str:
        out = []
        for one in sel.split(","):
            s = one.strip()
            if not s:
                continue
            if s in (":root", "body", "html"):
                out.append(SCOPE)
            elif s.startswith(":root"):
                out.append(SCOPE + s[5:])
            elif s.startswith("body"):
                out.append(SCOPE + s[4:])
            elif re.fullmatch(r"\d+%|from|to", s):   # stop di @keyframes
                out.append(s)
            else:
                out.append(SCOPE + " " + s)
        return ",".join(out)

    def blocks(text: str):
        res, i, buf = [], 0, ""
        while i < len(text):
            if text[i] == "{":
                d, j = 1, i + 1
                while d:
                    if text[j] == "{": d += 1
                    elif text[j] == "}": d -= 1
                    j += 1
                res.append((buf, text[i+1:j-1])); buf = ""; i = j
            else:
                buf += text[i]; i += 1
        if buf:
            res.append((buf, None))
        return res

    LEAD = re.compile(r"^((?:\x00\d+\x00|\s)*)(.*)$", re.S)

    def render(text: str) -> str:
        r = ""
        for pre, body in blocks(text):
            if body is None:
                r += pre; continue
            lead, sel = LEAD.match(pre).groups()
            s = sel.strip()
            if s.startswith("@keyframes"):
                r += lead + s + "{" + body + "}"          # gli stop NON si scopano
            elif s.startswith(("@media", "@supports")):
                r += lead + s + "{" + render(body) + "}"
            else:
                r += lead + scope_selector(s) + "{" + body + "}"
        return r

    res = render(src)
    res = re.sub(r"\x00(\d+)\x00", lambda m: comments[int(m.group(1))], res)

    # ── 3. il contenitore deve contenere i suoi strati a z-index negativo ────
    anchor = SCOPE + "{\n  margin:0;color:var(--ink)"
    if anchor not in res:
        print("ERRORE: ancora del blocco body non trovata", file=sys.stderr)
        return 1
    res = res.replace(anchor, SCOPE + "{\n  position:relative;isolation:isolate;\n  margin:0;color:var(--ink)", 1)

    # ── 4. le scene e le foto: file veri al posto dei data-URI ───────────────
    res += f"""
/* ══════════════════════════════════════════════════════════════
   LE SCENE E LE FOTO — file veri, non data-URI.
   La classe della scena sta sul contenitore dello scope: cambiare
   pagina significa cambiare quella classe, senza variabili CSS
   impostate da JavaScript.
   ══════════════════════════════════════════════════════════════ */
{SCOPE} .bgfix{{background-position:center;background-size:cover;background-repeat:no-repeat}}
{SCOPE}.mc-scene-stadium .bgfix{{background-image:url(/banners/gen/scene-stadium.jpg)}}
{SCOPE}.mc-scene-court .bgfix{{background-image:url(/banners/gen/scene-court.jpg)}}
{SCOPE}.mc-scene-clay .bgfix{{background-image:url(/banners/gen/scene-clay.jpg)}}

{SCOPE} .card-bg{{background-position:center;background-size:cover;background-repeat:no-repeat}}
{SCOPE} .im-stadium{{background-image:url(/banners/stadium-night.jpg)}}
{SCOPE} .im-pitch{{background-image:url(/banners/football-pitch.jpg)}}
{SCOPE} .im-action{{background-image:url(/banners/football-action.jpg)}}
{SCOPE} .im-court{{background-image:url(/banners/tennis-player.jpg)}}
{SCOPE} .im-clay{{background-image:url(/banners/gen/scene-clay.jpg)}}
{SCOPE} .im-crowd{{background-image:url(/banners/stadium-crowd.jpg)}}
"""
    DST.write_text(res, encoding="utf-8")

    # ── 5. il controllo che rende lo script affidabile ───────────────────────
    masked = re.sub(r"/\*.*?\*/", "", res, flags=re.S)
    bad: list[str] = []
    def check(text, pfx=""):
        for pre, body in blocks(text):
            if body is None:
                continue
            s = LEAD.match(pre).group(2).strip()
            if s.startswith(("@media", "@supports")):
                check(body, "@media > ")
            elif s.startswith("@keyframes"):
                pass
            elif not s.startswith(SCOPE):
                bad.append(pfx + s)
    check(masked)
    print(f"{DST}: {len(res.splitlines())} righe · selettori fuori scope: {len(bad)}")
    for b in bad[:10]:
        print("  ⚠", b[:110])
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
