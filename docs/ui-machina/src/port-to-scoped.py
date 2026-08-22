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
MC = '[data-mc]'                        # senza tema: le mappature immagine
MCG = '[data-mc-ground]'
LIGHT = ':root[data-theme="light"]'
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
        if line.startswith('[class*="im-"]'):
            # regola GENERICA della preview: centrava tutte le .im-* perche' li'
            # erano data-URI intercambiabili. Nel prodotto ogni scena ha il SUO
            # taglio, e questa - avendo specificita' piu' alta di [data-mc] .im-X
            # - li sovrascriveva tutti riportando la posizione a center.
            continue
        if "{{" in line:
            # I SEGNAPOSTO della preview (es. url(data:image/jpeg;base64,{{S_COURT}}))
            # sono CSS non valido: il browser scarta la dichiarazione, e siccome
            # quelle regole hanno specificita' piu' alta di quelle vere finiscono
            # per SOPPRIMERE l'immagine invece di darla. Nel prodotto le immagini
            # arrivano da file (vedi il blocco LE SCENE in coda). 22 dichiarazioni
            # cosi' erano finite in produzione col primo merge.
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
{MCG} .bgfix{{background-position:center;background-size:cover;background-repeat:no-repeat}}
{MCG}.mc-scene-stadium .bgfix{{background-image:url(/banners/gen/scene-stadium.jpg)}}
{MCG}.mc-scene-court .bgfix{{background-image:url(/banners/gen/scene-court.jpg)}}
{MCG}.mc-scene-clay .bgfix{{background-image:url(/banners/gen/scene-clay.jpg)}}

{MC} .card-bg{{background-size:cover;background-repeat:no-repeat}}
/* LE FOTO DELLE SCHEDE SONO LE SCENE DELLA PREVIEW, non le foto sport del repo.
   Misurato su produzione da loggato: con stadium-night / football-pitch /
   football-action la fascia alta leggeva come una velatura grigio-pallida senza
   soggetto riconoscibile — un'altra famiglia tonale rispetto alla preview
   approvata, dove le scene sono notturne con i fari e il campo verde. Non e' una
   questione di luminosita' media (produzione era perfino piu' scura): e' il
   contenuto del taglio.
   La varieta' viene da TAGLI diversi della stessa scena, non da file diversi:
   nessuna immagine nuova, come vuole la fase 1. */
/* I tagli pescano dove la scena e' ILLUMINATA e il soggetto si riconosce: nelle
   due scene il campo sta nella meta' BASSA, il cielo in alto e' quasi nero. Coi
   tagli alti si vedevano solo i fari, cioe' due macchie di luce senza soggetto. */
{MC} .im-stadium{{background-image:url(/banners/gen/scene-stadium.jpg);background-position:center 66%}}  /* il campo illuminato */
{MC} .im-pitch{{background-image:url(/banners/gen/scene-stadium.jpg);background-position:20% 46%}}      /* fari + tribuna */
{MC} .im-action{{background-image:url(/banners/gen/scene-stadium.jpg);background-position:84% 74%}}     /* angolo campo + gradinate */
/* TENNIS: qui la parte illuminata sono i FARI IN ALTO, non il campo - l'asfalto
   e' nero. Col taglio basso (78%) la scheda risultava PIU' BUIA della versione
   live, l'opposto della richiesta. Misurato guardando le due scene: nello stadio
   il verde e' illuminato in basso, nel campo da tennis la luce sta in alto. */
{MC} .im-court{{background-image:url(/banners/gen/scene-court.jpg);background-position:center 44%}}   /* i fari e l'alone: nel campo da tennis la luce sta in ALTO */
{MC} .im-clay{{background-image:url(/banners/gen/scene-clay.jpg);background-position:center 48%}}
{MC} .im-crowd{{background-image:url(/banners/gen/scene-stadium.jpg);background-position:center 34%}}
"""
    # ── 4b. LA VARIABILE VA NELLO SPAZIO DEI NOMI ───────────────────────────
    # globals.css definisce GIA' `--accent: var(--am-panel-3)`, cioe' un colore di
    # SUPERFICIE (#1E2229). Le regole della preview usano `var(--accent, …)` per
    # il colore dello SPORT: dentro il prodotto si prendevano la superficie, e
    # l'occhiello finiva scuro su scuro (misurato 1,15:1 sul modale di login e
    # sulla scheda bloccata, in produzione). E' la stessa trappola dei nomi di
    # classe, su una variabile: qui si rinomina in --mc-accent. Chi imposta la
    # variabile inline (le schede, in app/app/page.tsx) usa lo stesso nome.
    res = res.replace("var(--accent", "var(--mc-accent")
    res = res.replace("--accent:", "--mc-accent:")

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
/* L'etichetta KICKOFF: col fondo piu' acceso il suo grigio #7E858E scende a
   2,59:1 (misurato su tre schede). Al grigio del sistema regge. */
{SCOPE} .pred .stt{{color:#b4bbc4}}
/* Le etichette del READOUT — la parte piu' importante della scheda. Col fondo
   piu' acceso il grigio #7E858E le teneva a 4,39 (occhiello) e 3,45 (etichetta
   della quota): appena sotto. Restano secondarie rispetto al pick bianco, ma
   si leggono. */
{SCOPE} .pred .v2r-eye,{SCOPE} .pred .v2r-qlab,{SCOPE} .pred .v2r-conf-t,
{SCOPE} .pred .v2r-sub{{color:#b4bbc4}}
/* la casa ha angoli vivi: nessuna pastiglia rounded generica */
{SCOPE} .v2r-val,{SCOPE} .tag,{SCOPE} .stt{{border-radius:0}}

/* Le SMUSSATURE della scheda restano quelle del prodotto. globals.css usa
   .pred::before / ::after per i due tratti obliqui che chiudono gli angoli
   tagliati (LEVEL-UP 1e): il filetto della preview li sovrascriveva e si
   vedeva un trattino diagonale nell'angolo invece di una barra in testa.
   Qui si restituisce ai due pseudo la geometria di globals.
   NB il selettore e' COMPOSTO ({SCOPE}.card, senza spazio): [data-mc] sta
   sull'article.card, non su un suo antenato. Scritto con lo spazio la regola
   non aggancia mai e resta un moncone diagonale al posto della smussatura. */
{SCOPE}.card > .pred::before{{
  inset:auto;top:calc(var(--ch) / 2);left:calc(var(--ch) / 2);
  width:calc(var(--ch) * 1.41421);height:1.4px;background:var(--_pe);z-index:auto;
  transform:translate(-50%,-50%) rotate(-45deg)}}
{SCOPE}.card > .pred::after{{
  inset:auto;bottom:calc(var(--ch) / 2);right:calc(var(--ch) / 2);
  width:calc(var(--ch) * 1.41421);height:1.4px;background:var(--_pe);
  transform:translate(50%,50%) rotate(-45deg)}}
/* ...e il filetto da 4px col colore dello sport passa alla riga di testata,
   che è il primo figlio e ha già position:relative. */
{SCOPE} .pred .top::before{{
  content:"";position:absolute;top:0;left:0;right:0;height:4px;z-index:3;
  background:var(--mc-accent,var(--d-football))}}

/* ── FOTO PIU' ACCESE (richiesta di Andrea, 2026-08-20) ────────────────────
   La scena resta la stessa; cambia quanta se ne vede. Tre leve, e la terza e'
   quella che conta: la velatura si apre PIU' IN ALTO, cosi' la fascia della
   testata respira mentre gli incassi coi numeri restano pieni.
   Il limite non e' estetico, e' misurato: .teams sta SOPRA la foto, quindi
   ogni passo di luminosita' si verifica con l'armatura sui quattro campi che
   la spec vuole >= 4,5:1 (.teams .v2r-qn .v2r-val .v2r-sub). */
{SCOPE} .card-bg{{opacity:1;filter:saturate(1.4) contrast(1.14) brightness(1.9)}}
{SCOPE} .card-veil{{background:linear-gradient(to top,
  rgba(18,21,25,.94) 44%,
  rgba(18,21,25,.52) 72%,
  rgba(18,21,25,.02) 100%)}}
/* La zona dei NOMI porta il proprio fondo, come la riga della lega. Misurato:
   con la foto accesa .teams scendeva a 1,96:1 (soglia 3 per il testo grande) —
   e' il testo piu' importante della scheda. Cosi' la foto resta accesa dove non
   c'e' testo e i nomi si leggono comunque. */
{SCOPE} .pred .fx{{background:linear-gradient(to bottom,
  rgba(18,21,25,.95),rgba(18,21,25,.88) 58%,rgba(18,21,25,.4))}}
/* su telefono la scheda e' alta e stretta: la velatura resta piatta e densa,
   altrimenti la fascia centrale rimane scoperta (misurato su MACHINA) */
@media(max-width:640px){{
  {SCOPE} .card-bg{{opacity:.86;filter:saturate(1.2) contrast(1.06) brightness(1.16)}}
  {SCOPE} .card-veil{{background:linear-gradient(to top,rgba(18,21,25,.95) 46%,rgba(18,21,25,.8))}}
}}

/* Il grigio del prodotto, alzato DENTRO lo scope. Il fondo nuovo ha spostato di
   poco la luminanza sotto il testo secondario e otto nodi sono scesi appena
   sotto 4,5:1 (misurati: 3,2–4,4). Invece di rincorrerli uno per uno si alzano
   i due token del grigio ai valori già validati della palette — --ink2 #B4BBC4
   e --ink3 #969CA5. Vale solo qui: globals.css non si tocca. */
{GROUND}{{--am-muted:#b4bbc4;--am-muted-2:#9ca2aa;--muted:#b4bbc4;--muted-2:#9ca2aa}}

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

/* ── IL CHROME ─────────────────────────────────────────────────────────────
   La testata e il rail del prodotto esistono e funzionano: si cambia la VESTE,
   non la struttura. Nessun nodo aggiunto o rimosso, nessuna icona toccata —
   solo il registro tipografico della preview (mono maiuscolo spaziato) e il
   marcatore della voce attiva, che diventa un filetto e non un fondo pieno. */
{GROUND} .am-topbar{{background:var(--night);border-bottom:1px solid var(--rule)}}
{GROUND} .am-topnav button{{
  font-family:var(--fm);font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;
  color:#a9b0b9;border-radius:0;background:none}}
{GROUND} .am-topnav button:hover{{color:#fff}}
{GROUND} .am-topnav button.active{{
  color:#fff;background:none;border-bottom:2px solid var(--verde-b);border-radius:0}}
/* il rail: etichette di gruppo in mono, voce attiva marcata da un filetto
   incassato a sinistra (la preview: box-shadow inset 3px, non un fondo) */
{GROUND} .rail-lab{{
  font-family:var(--fm);font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;
  color:var(--ink3)}}
{GROUND} .rail-item{{border-radius:0}}
{GROUND} .rail-label{{letter-spacing:-.01em}}
{GROUND} .rail-item.is-active{{
  background:none;box-shadow:inset 3px 0 0 var(--verde-b);color:#fff}}

/* ── LE FASCE CON LA SCENA ─────────────────────────────────────────────────
   È questo che dà il respiro del target: una sezione non è un fondo piatto, è
   una fotografia sotto UNA velatura. Due sezioni sole — l'apertura e la
   chiusura — perché su tutte diventerebbe rumore.
   Una sola velatura: due gradienti sovrapposti spengono l'immagine (errore già
   pagato su MACHINA). I due pseudo di .v-hero e .v-final sono liberi: globals
   non li usa (verificato con grep prima di prenderli). */
{GROUND} .v-hero,{GROUND} .v-final{{position:relative;isolation:isolate;overflow:hidden}}
{GROUND} .v-hero::before,{GROUND} .v-final::before{{
  content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;
  background-position:center;background-size:cover;
  opacity:.55;filter:saturate(1.1) contrast(1.03)}}
{GROUND} .v-hero::before{{background-image:url(/banners/gen/scene-stadium.jpg)}}
{GROUND} .v-final::before{{background-image:url(/banners/gen/scene-court.jpg)}}
{GROUND} .v-hero::after,{GROUND} .v-final::after{{
  content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:linear-gradient(90deg,rgba(12,14,17,.96) 42%,rgba(12,14,17,.74))}}
{GROUND} .v-final::after{{
  background:linear-gradient(270deg,rgba(12,14,17,.96) 42%,rgba(12,14,17,.74))}}
/* il filetto che separa le fasce, al posto del salto di colore */
{GROUND} .v-sec,{GROUND} .v-final{{border-top:1px solid var(--rule)}}
"""

    # ── 6. IL TEMA CHIARO ────────────────────────────────────────────────────
    # Il fondo cinematico e' scuro e resta gated fuori dal chiaro. Ma la FOTO
    # dietro la scheda si puo' avere anche qui: cambia la velatura, che diventa
    # BIANCA. Il testo in chiaro e' scuro, quindi sotto gli serve chiaro: con la
    # velatura scura della notte sarebbe illeggibile.
    # Nota di struttura: le regole di geometria (.card-bg absolute, gli z-index)
    # vivono nello scope scuro, quindi qui vanno ripetute — sono quattro righe e
    # ripeterle costa meno che spostare mezzo foglio fuori dal tema.
    res += f"""
/* ══════════════════════════════════════════════════════════════
   IL TEMA CHIARO — la foto c'e', la velatura e' bianca
   Il resto del tema chiaro NON e' toccato: ha ~60 colori
   low-contrast noti (project_theme_light_fix), che sono un
   lavoro suo e non si risolvono di straforo qui.
   ══════════════════════════════════════════════════════════════ */
{LIGHT} [data-mc] .pred{{position:relative;isolation:isolate;overflow:hidden}}
{LIGHT} [data-mc] .pred>*:not(.card-bg):not(.card-veil){{position:relative;z-index:2}}
{LIGHT} [data-mc] .card-bg{{
  position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover;
  background-size:cover;background-repeat:no-repeat;
  opacity:1;filter:brightness(1.12) saturate(2) contrast(1.06)}}
  /* saturazione ALTA e luminosita' contenuta: una scena notturna schiarita
     troppo diventa una foschia grigia. Col verde del campo che resta verde, la
     foto si riconosce anche dietro una velatura bianca. */
{LIGHT} [data-mc] .card-veil{{
  position:absolute;inset:0;z-index:1;background:linear-gradient(to top,
  rgba(255,255,255,.98) 50%,
  rgba(255,255,255,.82) 76%,
  rgba(255,255,255,.4) 100%)}}
/* In chiaro il testo e' SCURO e i grigi piccoli del prodotto stanno sopra la
   foto: misurati, lega/orario/`v`/turno scendevano da 3,93 a 2,0-2,5. Si
   agisce su due leve insieme — velatura piu' densa dove sta il testo, e quei
   grigi al gradino scuro del tema chiaro (--am-muted #4A515B). */
{LIGHT} [data-mc] .pred .league,{LIGHT} [data-mc] .pred .when,
{LIGHT} [data-mc] .pred .vs,{LIGHT} [data-mc] .pred .rnd,
{LIGHT} [data-mc] .pred .stt,{LIGHT} [data-mc] .pred .v2r-eye,
{LIGHT} [data-mc] .pred .v2r-qlab,{LIGHT} [data-mc] .pred .v2r-conf-t,
{LIGHT} [data-mc] .pred .v2r-sub{{color:#3a4149}}
/* lo stesso filetto da 4px col colore dello sport: senza, la scheda chiara e'
   il prodotto di prima con una sfumatura sopra */
/* la riga di testata porta il proprio fondo anche in chiaro: senza, lega e
   orario finiscono grigi sopra la parte illuminata della foto (misurato:
   illeggibili). E' la stessa mitigazione del tema scuro, ribaltata. */
{LIGHT} [data-mc] .pred .top{{position:relative;background:linear-gradient(to bottom,
  rgba(255,255,255,.94),rgba(255,255,255,.74) 62%,rgba(255,255,255,.28))}}
{LIGHT} [data-mc] .pred .fx{{background:linear-gradient(to bottom,
  rgba(255,255,255,.9),rgba(255,255,255,.76) 62%,rgba(255,255,255,.4))}}
{LIGHT} [data-mc] .pred .top::before{{
  content:"";position:absolute;top:0;left:0;right:0;height:4px;z-index:3;
  background:var(--mc-accent,#6d28d9)}}
@media(max-width:640px){{
  {LIGHT} [data-mc] .card-bg{{opacity:.3}}
  {LIGHT} [data-mc] .card-veil{{background:linear-gradient(to top,rgba(255,255,255,.97) 46%,rgba(255,255,255,.9))}}
}}
/* La scena DI PAGINA in chiaro e' stata provata e TOLTA: misurata, spostava di
   poco il fondo sotto decine di grigi gia' al limite e portava 32 nodi sotto
   soglia (59 -> 91) per un effetto quasi invisibile. La richiesta era lo sfondo
   della SCHEDA, e quello resta. Il fondo di pagina in chiaro e' un lavoro che
   va fatto insieme ai ~60 colori low-contrast del tema (project_theme_light_fix),
   non di straforo qui. */
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
            # I prefissi legittimi sono TRE, e ognuno ha una ragione:
            #   SCOPE/GROUND   il sistema scuro (gated fuori dal tema chiaro)
            #   [data-mc]…     le mappature immagine, che valgono in ENTRAMBI i temi
            #   :root[data-theme="light"] …  il blocco del tema chiaro
            # Qualunque altra cosa e' una regola che sfugge allo scope: errore.
            elif not s.startswith((SCOPE, GROUND, MC, MCG, LIGHT)):
                bad.append(pfx + s)
    check(masked)
    print(f"{DST}: {len(res.splitlines())} righe · selettori fuori scope: {len(bad)}")
    for b in bad[:10]:
        print("  ⚠", b[:110])
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
