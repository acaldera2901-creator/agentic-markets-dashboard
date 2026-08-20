#!/usr/bin/env python3
"""Porta machina.css (il sistema della preview) in app/machina.css incapsulato.

Perché uno script e non un copia-incolla: la trasformazione è meccanica su 579
righe, e va rifatta ogni volta che il sistema della preview cambia. A mano si
sbaglia un selettore su cento e il difetto non si vede — appare come "quella
regola non ha preso".

Gli scope sono DUE, e la distinzione è la ragione per cui questo porting è
sicuro invece che temerario: 51 classi della preview esistono GIÀ nel className
del prodotto, e alcune sono generiche (.btn .tag .plan .note .live .top).
Accendere tutto il foglio su una pagina ripitturerebbe anche ciò che non è
stato ridisegnato.

  [data-mc-ground]   il FONDO e la tipografia: token, scena, velatura, lavaggi,
                     scala dei titoli. Va sul contenitore di pagina, in alto.
                     Non tocca nessun componente.
  [data-mc]          i COMPONENTI: schede, pannelli, tabelle, chrome. Si accende
                     solo sul sottoalbero già verificato con le armature.

Entrambi portano anche:
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
THEME = ':root:not([data-theme="light"])'
SCOPE = f'{THEME} [data-mc]'            # i componenti
GROUND = f'{THEME} [data-mc-ground]'    # il fondo e la tipografia

# selettori sorgente che appartengono al FONDO, non ai componenti.
# Tutto ciò che non è qui dentro è un componente.
GROUND_SELECTORS = {
    ":root", "body", "body::after", ".bgfix",
    ".t-mega", ".t-h1", ".t-h2", ".t-h3", ".t-lead", ".t-body", ".t-key",
    ".num", ".eyebrow", ".eyebrow::before", ".wrap",
}
# regole di soli token: servono a ENTRAMBI gli scope, così un componente
# funziona anche senza il fondo sopra di sé.
TOKEN_ONLY = {":root"}

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
        if line.strip() == "body{padding-bottom:4.6rem}":
            continue   # faceva posto alla bottom-nav DELLA PREVIEW, non a questa
        if line.strip() in ("img{max-width:100%;display:block}", "a{color:inherit}"):
            continue   # regole di elemento: nel prodotto sposterebbero layout altrui
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

    def scope_one(s: str, scope: str) -> str:
        if s in (":root", "body", "html"):
            return scope
        if s.startswith(":root"):
            return scope + s[5:]
        if s.startswith("body"):
            return scope + s[4:]
        if re.fullmatch(r"\d+%|from|to", s):        # stop di @keyframes
            return s
        return scope + " " + s

    def scope_selector(sel: str) -> str:
        """Ogni parte del selettore va sotto lo scope che le compete: il fondo
        se è nella lista, i componenti altrimenti. Le regole di soli token
        escono sotto entrambi."""
        out = []
        for one in sel.split(","):
            s = one.strip()
            if not s:
                continue
            if s in TOKEN_ONLY:
                out.append(scope_one(s, GROUND))
                out.append(scope_one(s, SCOPE))
            elif s in GROUND_SELECTORS:
                out.append(scope_one(s, GROUND))
            else:
                out.append(scope_one(s, SCOPE))
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
    anchor = GROUND + "{\n  margin:0;color:var(--ink)"
    if anchor not in res:
        print("ERRORE: ancora del blocco body non trovata", file=sys.stderr)
        return 1
    res = res.replace(anchor, GROUND + "{\n  position:relative;isolation:isolate;\n  margin:0;color:var(--ink)", 1)

    # ── 4. le scene e le foto: file veri al posto dei data-URI ───────────────
    res += f"""
/* ══════════════════════════════════════════════════════════════
   LE SCENE E LE FOTO — file veri, non data-URI.
   La classe della scena sta sul contenitore dello scope: cambiare
   pagina significa cambiare quella classe, senza variabili CSS
   impostate da JavaScript.
   ══════════════════════════════════════════════════════════════ */
{GROUND} .bgfix{{background-position:center;background-size:cover;background-repeat:no-repeat}}
{GROUND}.mc-scene-stadium .bgfix{{background-image:url(/banners/gen/scene-stadium.jpg)}}
{GROUND}.mc-scene-court .bgfix{{background-image:url(/banners/gen/scene-court.jpg)}}
{GROUND}.mc-scene-clay .bgfix{{background-image:url(/banners/gen/scene-clay.jpg)}}

{SCOPE} .card-bg{{background-position:center;background-size:cover;background-repeat:no-repeat}}
{SCOPE} .im-stadium{{background-image:url(/banners/stadium-night.jpg)}}
{SCOPE} .im-pitch{{background-image:url(/banners/football-pitch.jpg)}}
{SCOPE} .im-action{{background-image:url(/banners/football-action.jpg)}}
{SCOPE} .im-court{{background-image:url(/banners/tennis-player.jpg)}}
{SCOPE} .im-clay{{background-image:url(/banners/gen/scene-clay.jpg)}}
{SCOPE} .im-crowd{{background-image:url(/banners/stadium-crowd.jpg)}}
"""
    # ── 5. AZZERAMENTO ───────────────────────────────────────────────────────
    # La CSS della preview presupponeva una tela bianca. Nel prodotto sotto c'è
    # globals.css, e le proprietà che la preview non ha mai avuto BISOGNO di
    # togliere restano: angoli tondi, ombre, padding sui contenitori. Il difetto
    # non si vede come "regola che non ha preso" — si vede come box-dentro-box,
    # cioè esattamente ciò che la spec vieta. Qui si azzerano, misurate una per
    # una sui valori calcolati dal browser, non a intuito.
    res += f"""
/* ══════════════════════════════════════════════════════════════
   AZZERAMENTO — ciò che globals.css mette e la preview non toglieva
   Misurato con getComputedStyle sul prodotto vero, non stimato.
   ══════════════════════════════════════════════════════════════ */

/* La scheda: il padding vive sui FIGLI (.top e .fx ce l'hanno), così .scorebar
   e .v2r diventano fasce a filo del bordo invece di riquadri dentro un riquadro.
   globals dava a .pred padding 16px 16px 14px e un'ombra chiara. */
{SCOPE} .pred{{padding:0;border-radius:0;box-shadow:none}}
/* globals arrotondava gli incassi (7px e 12px): il box-dentro-box vietato. */
{SCOPE} .pred .scorebar,{SCOPE} .pred .v2r{{border-radius:0;border-inline:0;border-bottom:0}}
{SCOPE} .pred .pred-more{{border-radius:0}}
/* la casa ha angoli vivi: nessuna pastiglia rounded generica */
{SCOPE} .v2r-val,{SCOPE} .tag,{SCOPE} .stt{{border-radius:0}}

/* Le SMUSSATURE della scheda restano quelle del prodotto. globals.css usa
   .pred::before / ::after per i due tratti obliqui che chiudono gli angoli
   tagliati (LEVEL-UP 1e): il filetto della preview li sovrascriveva e si
   vedeva un trattino diagonale nell'angolo invece di una barra in testa.
   Qui si restituisce ai due pseudo la geometria di globals... */
{SCOPE} .card > .pred::before{{
  inset:auto;top:calc(var(--ch) / 2);left:calc(var(--ch) / 2);
  width:calc(var(--ch) * 1.41421);height:1.4px;background:var(--_pe);z-index:auto;
  transform:translate(-50%,-50%) rotate(-45deg)}}
{SCOPE} .card > .pred::after{{
  inset:auto;bottom:calc(var(--ch) / 2);right:calc(var(--ch) / 2);
  width:calc(var(--ch) * 1.41421);height:1.4px;background:var(--_pe);
  transform:translate(50%,50%) rotate(-45deg)}}
/* ...e il filetto da 4px col colore dello sport passa alla riga di testata,
   che è il primo figlio e ha già position:relative. */
{SCOPE} .pred .top::before{{
  content:"";position:absolute;top:0;left:0;right:0;height:4px;z-index:3;
  background:var(--accent,var(--d-football))}}

/* Il grigio del prodotto, alzato DENTRO lo scope. Il fondo nuovo ha spostato di
   poco la luminanza sotto il testo secondario e otto nodi sono scesi appena
   sotto 4,5:1 (misurati: 3,2–4,4). Invece di rincorrerli uno per uno si alzano
   i due token del grigio ai valori già validati della palette — --ink2 #B4BBC4
   e --ink3 #969CA5. Vale solo qui: globals.css non si tocca. */
{GROUND}{{--am-muted:#b4bbc4;--am-muted-2:#969ca5;--muted:#b4bbc4;--muted-2:#969ca5}}

/* Otto nodi hanno un colore PROPRIO e il token non li tocca. Misurati sul
   fondo nuovo, e corretti con i valori che la palette ha già validato.

   Il verde #23A559 sui lavaggi del fondo scende a 4,38–4,44:1 — appena sotto.
   È esattamente il caso per cui esiste il TERZO gradino #33C974: il verde
   dell'occhiello quando cade sul lavaggio verde. Non è un valore nuovo. */
{GROUND} .v-kick,{GROUND} .lab,{GROUND} .res{{color:#33c974}}
/* i grigi al gradino validato del sistema */
{GROUND} .v-anat-cap,{GROUND} .sp,{GROUND} .ps,{GROUND} .v-wall-head span,
{GROUND} .v-tier .price small{{color:#a3a9b2}}
/* il rosso pieno del P&L: alzato quanto serve a leggersi. La spec §4.5 lo vuole
   sostituito da segno + freccia, ma quello è un cambio di CONTENUTO e vive in
   fase 2: qui si risolve solo la leggibilità. */
{GROUND} .res.lost{{color:#f4756f}}

/* Bianco su verde brand: 3,18:1, cinque nodi, ed e' un difetto che c'era PRIMA
   di questo lavoro (bottoni primari e badge della landing). La palette dice come
   si fa: sul verde acceso il testo e' SCURO (#06140c su #23A559 = 6,08:1), ed e'
   il trattamento che la preview usa per i suoi bottoni. Il bianco andrebbe sul
   verde scuro #15703B, che qui non e' il fondo. */
{GROUND} .v-btn--primary,{GROUND} .best{{color:#06140c}}
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
            elif not s.startswith((SCOPE, GROUND)):
                bad.append(pfx + s)
    check(masked)
    print(f"{DST}: {len(res.splitlines())} righe · selettori fuori scope: {len(bad)}")
    for b in bad[:10]:
        print("  ⚠", b[:110])
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
