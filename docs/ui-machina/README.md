# BetRedge — frontend nuovo · `#UI-MACHINA-0802`

Preview navigabile del redesign, in italiano e in inglese. Non è codice di
prodotto: è la **fonte di verità visiva** da cui nasce l'implementazione della
fase 1 descritta in
[`../superpowers/specs/2026-08-02-betredge-ui-machina-design.md`](../superpowers/specs/2026-08-02-betredge-ui-machina-design.md).

> ⚠️ **La spec è superata sul fondo.** Descrive la carta chiara di MACHINA; il
> 2 agosto si è passati al fondo cinematico scuro su richiesta di Andrea.
> Va riallineata prima di scrivere il piano di implementazione.

## Cosa c'è

| file | cosa |
|---|---|
| `machina.css` | il sistema visivo completo — diventerà `app/machina.css` |
| `src/preview-body-{it,en}.html` | struttura e copy delle 10/11 pagine |
| `src/data-{it,en}.json` | **dati estratti dal sito vero** (sessione PRO, 2 ago 2026) |
| `src/build.py` | inlina font/immagini/dati in un HTML unico (versione con JS) |
| `src/make-static.mjs` | **la versione da condividere**: pre-renderizza tutte le pagine |
| `src/audit-contrast.mjs` | misura il contrasto su ogni nodo di testo, **a finestre** |
| `src/audit-overflow.mjs` | verifica lo scorrimento orizzontale su 4 larghezze |

I dati sono reali, non inventati: 67–75 schede del board, 296 pick del registro,
44 segmenti, 12 gironi del Mondiale, 130+ selezioni del Match Builder, prezzi
dei piani. Le stringhe inglesi sono quelle **servite dal sito**, non tradotte.

## Ricostruire

```sh
python3 src/build.py en <cartella-assets> /tmp/preview-en.html   # versione con JS
node src/make-static.mjs en                                      # versione da CONDIVIDERE
```

La cartella assets deve contenere `hanken.woff2`, `jbmono.woff2` e `img/` con
scene, oggetti, icone del rail, banner di Ole e logo — `build.py` esce con
errore se ne manca uno, invece di produrre un file mezzo rotto. Gli asset
generati per questo lavoro stanno in `public/banners/gen/` (`_src/` = sorgenti
ad alta qualità per ritagli futuri).

## Da condividere si consegna la versione STATICA

Pre-renderizza le pagine dentro il documento e naviga con `:target`: si apre col
doppio clic, funziona **senza JavaScript**, e non dipende da come il
destinatario apre il file. Il JS resta solo per il carosello — se non gira, si
vede la prima slide.

Due difetti hanno prodotto un file «che non fa vedere nulla», entrambi da non
rifare:

1. **`<script type="module">` è rifiutato da Safari su `file://`.** Col doppio
   clic su Mac non partiva niente, e siccome il contenuto era generato dal JS
   restavano solo testata e footer. Script classico.
2. **Ogni `<img src="data:...">` ripete il base64.** Con 67 schede una pagina
   del board pesava 885 KB di solo HTML. Le immagini ripetute vivono **una
   volta sola nel CSS**, riusate per classe (`.im-*`) → 11 KB per pagina.

Corollario della seconda: convertendo le immagini in `<span>` con background,
le regole CSS che selezionavano `img` smettono di agganciare. Gli sfondi non
risultano *rotti*, risultano **assenti** — e un controllo su
`img.naturalWidth` non se ne accorge. Verificare che
`getComputedStyle(...).backgroundImage` inizi con `url(`.

## Come si verifica

Il colore non si giudica a occhio. Due armature, entrambe da far passare.

**Contrasto** — rende ogni pagina, rende trasparenti *tutti* i glifi, e per ogni
nodo di testo cerca il **pixel peggiore** del fondo reale sotto di esso. Soglie
WCAG AA, 3:1 per il testo grande.

**Overflow** — nessuna pagina deve scorrere in orizzontale a 360/390/768/1440.

Tre trappole già pagate:

1. Nascondere **solo le foglie** lascia visibile il testo dei paragrafi attorno
   e si finisce a misurare **testo su testo**: 193 falsi allarmi. Servono tutti
   i glifi trasparenti *e* le auto-decorazioni neutralizzate (l'occhiello
   misurava il proprio filetto, i bottoni il proprio bordo).
2. **Catturare la pagina intera mente** quando ci sono strati `position:fixed`
   (la scena di fondo, la velatura): non vengono dipinti dove stanno davvero.
   Passando alla cattura **a finestre** sono emersi **89 difetti** che il metodo
   precedente dichiarava inesistenti — fino a 2,67:1 sulle etichette piccole.
   `audit-contrast.mjs` scorre di una viewport alla volta: non tornare indietro.
3. Un figlio di grid non scende sotto la larghezza del contenuto: senza
   `min-width:0` il contenitore con `overflow-x` non si stringe e a scorrere
   finisce la **pagina**.

Ultimo esito reale: **3.326 nodi in vista, 0 sotto soglia, margine minimo
+8%** · overflow 0 su quattro larghezze · 0 errori JS · 0 immagini rotte,
verificato con JavaScript acceso **e spento**, su Chromium e su WebKit.

## Palette

Validata con `scripts/validate_palette.js` della skill `dataviz`
(`--pairs all`) contro entrambe le superfici. Calcio `#6D28D9` · tennis
`#C2410C` · mondiali `#0369A1`. Il verde è **riservato ai soldi** e ha tre
gradini: `#15703B` sul chiaro, `#23A559` sul buio, `#33C974` per l'occhiello
quando cade sul lavaggio verde del fondo. Un solo valore non regge tutti i
contesti — è la classe di bug che ha prodotto quasi tutte le rotture del
passaggio chiaro→scuro. Tetto misurato: **3 sport + il verde**; il quarto
colore fallisce sempre.
