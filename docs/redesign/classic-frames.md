# Classic · via le cornici (Fase A) — #CLASSIC-CARD-1008

Decisione di Andrea (REGOLE-CLASSIC.md, 08/10): **mai cornici da nessuna parte**. La separazione la fanno lo spazio, il tono di sfondo e la lastra blu sul navy. Tutto vive dietro il flag di build `NEXT_PUBLIC_CLASSIC=1`: `app/layout.tsx` scrive `html[data-frames="off"]` solo allora, e ogni regola del filone è scritta sotto quell'attributo. A flag spento nessuna combacia.

## Come è fatto

| Pezzo | File | Cosa fa |
|---|---|---|
| Generatore | `scripts/classic/gen-frames.mjs` | Legge i 4 CSS (globals, design-system, machina, mobile) e il CSS dentro 3 componenti (TrackRecordView, SeoProse, blog/[slug]). Per ogni regola con `border*`, `outline*`, `box-shadow`, `clip-path` a smusso decide la famiglia e scrive il gemello spento. |
| CSS generato | `app/classic.generated.css` | NON si edita. Si rigenera con `node scripts/classic/gen-frames.mjs` (`--report` stampa i conteggi e i «solo bordo»). |
| CSS a mano | `app/classic.css` | Token, classi Tailwind e stili inline del monolite, i fondi dei «solo bordo», gli smussi diventati angoli tondi, i filetti disegnati con uno pseudo-elemento, e la scheda Slab (`.cl-*`). |

Il gemello ha specificità `+(0,1,1)` sul sorgente, quindi vince sempre su di lui; se il sorgente è `!important` lo è anche il gemello. Il bordo va a **larghezza zero**, non solo trasparente: un bordo trasparente lascia vedere lo sfondo che sta sotto e disegna una cornice fantasma (visto a video sulle tessere `.br-field`). Per lo stesso motivo `background-origin: border-box` ovunque.

I token che passano da un punto solo (`--am-frame-edge(-hover)`, `--am-chamfer-line(-2)`, `--am-shadow-card(-hover)`) vanno a trasparente/`0 0 #0000` in un colpo: spariscono la cornice smussata della pagina, il rail, la betslip, gli aloni delle card. Le variabili-filo degli smussi (`--_fe`, `--_pe`, `--bcol`, `--pred-line`) vanno a trasparente su ogni regola che le dichiara.

## Le famiglie (668 regole lette, tema scuro; il chiaro non è più raggiungibile)

| Famiglia | Regole | Decisione | Perché |
|---|---|---|---|
| **FRAME** — contorno di un contenitore, ombra, alone, anello inset, smusso | 559 | spento (bordo 0, ombra none, outline trasparente, `clip-path: none` + `border-radius: var(--am-r-card)` sui contenitori smussati) | è la cornice |
| **KEEP_FOCUS** — `:focus`, `:focus-visible`, `:focus-within` | 60 | resta | l'anello di focus non è una cornice: è accessibilità |
| **KEEP_FIELD** — input, select, textarea, ricerca, `.tl-field-box` | 22 | resta | il bordo di un campo dice «qui si scrive»; senza, un input è testo |
| **KEEP_ROW** — un lato solo su righe di tabelle/elenchi (`.am-htable td`, `.tr-score th`, `.mds-leg`, `.wp-leg`, `.tl-faq-item`, `.br-row`…) | 17 | resta | il filo fra le righe È la riga, non una cornice di scheda |
| **KEEP_SHAPE** — spinner, triangoli/caret, tacche della confidenza, interruttori, puntini di stato, `clip-path` che non è uno smusso | 18 | resta | il bordo è la forma, non il contorno |
| **KEEP_MARK** — barra di un lato ≥2 px con colore di stato (`.tl-verdict`, `.tl-takeaway`, `.br-proband`, citazioni) | 10 | resta | porta un significato, non contiene niente |

`--am-line` (166 usi) **non** si azzera in blocco: resta il colore delle righe e dei campi qui sopra; dove disegnava una cornice è la regola-cornice a spegnersi, famiglia per famiglia.

### «Solo bordo»: prima un fondo, poi via il bordo
Il generatore ne trova 42 (bordo su 4 lati, nessun fondo proprio in nessuna regola). Ognuno riceve un tono in `app/classic.css` §A.4 prima che il bordo sparisca: `--cl-tone` (bianco al 7%) sul navy, `--cl-tone-slab` (navy al 32%) sulla lastra blu — chip sport, badge, crest, pulsante salva, CTA in outline, «Yesterday», caselle vuote, toggle mensile/annuale, voce di nav attiva (`--am-royal-dim`).

### Monolite e componenti
- Classi Tailwind `border`, `border-t/b`, `border-[var(--am-line)]`, `border-amber-400/30`, `ring-*`, `shadow-*` → spente con `!important` (battono le utility), campi e tabelle esclusi.
- 16 bordi inline in `app/app/page.tsx` → spenti per sottostringa dell'attributo `style` (`border:1px…`, `border-color:`), con `!important` per battere l'inline; quelli col fondo `none` prendono il tono.
- Filetti disegnati con `::before` e un fondo (`.pdm-panel::before`, la riga lime in cima alla scheda partita) → nascosti a mano.

### Fuori, di proposito
- `/widget` ed `embed-html.ts`: vivono incorporati in siti terzi, dove `html[data-frames]` non c'è.
- Tema chiaro: le regole `[data-theme="light"]` non si duplicano (nessun codice scrive più quel valore, app/layout.tsx).
