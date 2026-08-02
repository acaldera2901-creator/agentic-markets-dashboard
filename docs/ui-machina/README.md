# BetRedge — frontend nuovo · `#UI-MACHINA-0802`

Preview navigabile del redesign, in italiano e in inglese. Non è codice di
prodotto: è la **fonte di verità visiva** da cui nasce l'implementazione della
fase 1 descritta in
[`../superpowers/specs/2026-08-02-betredge-ui-machina-design.md`](../superpowers/specs/2026-08-02-betredge-ui-machina-design.md).

## Cosa c'è

| file | cosa |
|---|---|
| `machina.css` | il sistema visivo completo — diventerà `app/machina.css` |
| `src/preview-body-{it,en}.html` | struttura e copy delle 10/11 pagine |
| `src/data-{it,en}.json` | **dati estratti dal sito vero** (sessione PRO, 2 ago 2026) |
| `src/build.py` | inlina font/immagini/dati in un unico HTML autonomo |
| `src/audit-contrast.mjs` | misura il contrasto su **ogni nodo di testo reso** |
| `src/audit-overflow.mjs` | verifica lo scorrimento orizzontale su 4 larghezze |

I dati sono reali, non inventati: 67–75 schede del board, 296 pick del registro,
44 segmenti, 12 gironi del Mondiale, 130+ selezioni del Match Builder, prezzi
dei piani. Le stringhe inglesi sono quelle **servite dal sito**, non tradotte.

## Ricostruire

```sh
python3 src/build.py en <cartella-assets> /tmp/preview-en.html
```

La cartella assets deve contenere `hanken.woff2`, `jbmono.woff2` e `img/` con
scene, oggetti, icone del rail, banner di Ole e logo — `build.py` esce con
errore se ne manca uno, invece di produrre un file mezzo rotto.

Gli asset generati per questo lavoro stanno in `public/banners/gen/`
(`_src/` = sorgenti ad alta qualità per ritagli futuri).

## Come si verifica

Il colore non si giudica a occhio. Due armature, entrambe da far passare:

- **Contrasto** — rende ogni pagina, rende trasparenti *tutti* i glifi, e per
  ogni nodo di testo cerca il **pixel peggiore** del fondo reale sotto di esso.
  Soglie WCAG AA, 3:1 per il testo grande. Ultimo esito: **2.678 nodi, 0 sotto
  soglia, margine minimo +12%**.
- **Overflow** — nessuna pagina deve scorrere in orizzontale a 360/390/768/1440.

Due trappole già pagate, da non rifare:
1. Nascondere solo le foglie durante la misura lascia visibile il testo attorno
   e si finisce a misurare **testo su testo**: 193 falsi allarmi.
2. Un figlio di grid non scende sotto la larghezza del contenuto: senza
   `min-width:0` il contenitore con `overflow-x` non si stringe e a scorrere
   finisce la **pagina**.

## Palette

Validata con `scripts/validate_palette.js` della skill `dataviz`
(`--pairs all`) contro entrambe le superfici. Calcio `#6D28D9` · tennis
`#C2410C` · mondiali `#0369A1`. Il verde è **riservato ai soldi** e ha due
gradini: `#15703B` su fondo chiaro, `#23A559` sul buio — un solo valore non
regge entrambi. Tetto misurato: 3 sport + il verde; il quarto colore fallisce
sempre.
