# Banner con figure: audit dei ritagli (banners-fix, 07/10/2026)

Segnalazione di Andrea sulla preview `betredge/v3c-final3`: «alcuni banner hanno le teste tagliate dei giocatori».
Regola nuova: **nessun soggetto umano tagliato a nessuna larghezza fra 360 e 1920, in chiaro e in scuro; le zone di testo restano libere.**
«Tagliato» qui vuol dire: testa, volto, mani, palla, racchetta (gli elementi chiave) fuori dal riquadro visibile. Un'inquadratura che chiude sul petto (tennis) o una folla già tagliata ai bordi nella sorgente non contano.

Metodo: dev server flag ON sul mock locale (`scripts/v3c/mock-db.ts`, fetch esterni bloccati, `/api/track` abortito). Per ogni banner, a 1920 · 1440 · 1280 · 1024 · 900 · 768 · 700 · 640 · 600 · 430 · 390 · 360, chiaro e scuro, ho ricostruito la geometria di `object-fit`/`object-position` dell'`<img>` e proiettato i riquadri del soggetto (misurati a mano sulle sorgenti) sul riquadro visibile: contenitore ∩ fascia ∩ taglio diagonale a destra (34 px desktop, 22 px mobile). Più scatti guardati uno per uno. Il controllo è ora un test: `e2e/v3c-banner-crop.spec.ts`.

## Dove compare un'immagine con figure umane (sito v3c)

| Uso | File | Figure? | Esito prima |
|---|---|---|---|
| Fascia home (`/`) | `hero-football` 1200×628, `cover`, `64% 38%` | calciatore + palla | **tagliava** |
| Fascia `/predictions` | `hero-tennis` 1200×628, `cover`, `40% 30%` | tennista, racchetta, palla | **tagliava** |
| Fascia `/pricing` | `hero-football` (come la home) | calciatore + palla | **tagliava** |
| Fascia `/partners` (Books) | `partner-crowd` 1200×628, `cover`, `60% 45%` | folla di spalle | **tagliava** solo con titoli lunghi (fr/pt) a 360 |
| Banner colore Codex (`record`, `learn`, `calcio`) | 1600×400 / 1200×300 / 800×500 | no (porta, grafici, sigillo) | ok — riquadro 4:1 e 8:5 = rapporto dell'arte, nulla da ritagliare |
| Banner colore SVG (`live`, `pro`, `tennis`, …) | `colour-svg.ts` | no | ok |
| OG partita / tool | `app/v3c/_og/og-*-bg.jpg` | no (campo, grafico) | ok |
| 404 / 500 / vuoto | `brand/v3c/states/*.webp` | 500: un tecnico minuscolo sulla torre faro | ok — `height: auto`, mai ritagliate |
| Verticali 1080×1350 | `redesign/brand/banners/social-*` | sì | non usati nel sito prima di questo fix |

Fuori perimetro: il sito di oggi (flag OFF) — deve restare identico, non l'ho toccato.

## Cosa veniva tagliato, a che larghezza, e la correzione

La fascia è una striscia: 744×208 su desktop (3,6:1), 736×168 a 768 (4,4:1). Il 1200×628 (1,9:1) in `cover` mostrava solo il 53% (desktop) o il 43% (768) dell'altezza della foto: **nessun `object-position` poteva salvare il soggetto**, che va dalla testa alla palla per il 71% dell'altezza.

| Uso | Larghezza | Cosa veniva tagliato (prima) | Correzione |
|---|---|---|---|
| home, pricing (calcio) | 1920 · 1440 · 1280 | testa −51 px in alto; palla −17 px in basso e −10 px dal taglio diagonale | ritaglio «fit» dal verticale `social-football` (soggetto intero, ~100 px d'aria a destra della palla), riquadro 1,49:1 alto 208 px, ancorato in alto, fermo prima del taglio diagonale |
| home, pricing | 1024 | testa −29 px; palla −13 px a destra | idem |
| home, pricing | 768 | **testa intera fuori** (−65 px); palla −40 px in basso | idem, riquadro 168 px; testo della fascia fermato prima del riquadro |
| home, pricing | 430 | testa −6 px (pricing −2 px); palla −5/6 px a destra | idem |
| home, pricing | 390 · 360 | palla −6/10 px a destra (taglio diagonale) | idem |
| /predictions (tennis) | 1920 · 1440 · 1280 | racchetta e palla −49 px in alto; tennista sotto un velo navy al 72–100% (quasi invisibile) | ritaglio «fit» dal verticale `social-tennis` (palla, racchetta, mani, testa; chiude sul petto), riquadro 1,65:1, velo solo sul bordo sinistro |
| /predictions | 1024 · 768 · 430 · 390 | racchetta/palla −30 / −60 / −9 / −3 px | idem |
| /predictions | dopo il primo giro | dita della mano sinistra −12 px nel taglio diagonale (misurato) | il riquadro si ferma 34/22 px prima del bordo destro |
| /partners (folla) | 360, fr/pt | la fascia cresce col titolo, il `cover` stringe il riquadro sotto 1,9:1 e taglia i tifosi a destra | altezza fissa 208/168 px ancorata in alto, sfumata in basso: il riquadro non scende mai sotto 1,9:1 |

Zone di testo: da 600 px in su il titolo e la riga meta si fermano prima del riquadro (`max-width: calc(100% - 300px)`, 240 sotto gli 820): misurato in en/it/de/es/pt/fr, prima il titolo francese/portoghese di /pricing passava sopra la testa anche a 1440. Il titolo può andare a capo una riga prima (pricing a 1024, meta a 768).

File: `components/v3c/Banner.tsx` (variante `FitBanner`), `components/v3c/banner-fit.css` (nuovo), `scripts/v3c/banner-fit-crops.mjs` (solo extract/resize/encode dei file del kit, riproducibile byte per byte), `public/brand/v3c/banners/hero-{football,tennis}-fit-{360,720}.{avif,webp}` (nuovi; tolti i `hero-*-{720,1200}` rimasti orfani). Pesi AVIF: calcio 10/27 KB, tennis 5/13 KB (prima 14/30 e 7/15).

## Cosa resta (visto, non risolto)

- **Sotto i 600 px** il testo della fascia occupa quasi tutta la striscia: il soggetto resta intero ma passa sotto il testo, velato all'82→35% come prima del fix (tennis: la testa sta dietro la riga «prices as of…»; pricing: dietro «SHOWS WHY.»). Non è un taglio, ma la regola «zone di testo libere» qui non è soddisfatta. Due strade, decide Andrea: (a) tenerlo così (scelta di fidelity, approvata); (b) sotto i 600 px nessuna foto nella fascia, o una variante senza figure. Per (c) servono asset nuovi → brief qui sotto.
- In scuro la foto (sfondo quasi nero) è più scura del navy della fascia: si legge come un riquadro «monitor». Il bordo sinistro sfuma nel navy; era già così (prima il riquadro era più largo).

## Brief per art-director (solo se Andrea sceglie la via c)

Non generati da me. Due banner per la fascia su telefono, stesso stile GEN Codex del kit (notturno, navy, LED lime, nessun marchio, nessuno stemma, nessuna parola):
- **Formato** 1200×560 (≈ 2,15:1, la fascia a 390–430 px è 358–398×168).
- **Soggetto** calciatore al tiro / tennista al servizio, **intero dalla testa alla palla**, nel **terzo destro** del fotogramma, con **≥ 12% di margine sopra la testa** e ≥ 8% a destra della palla (il bordo destro della fascia è tagliato in diagonale).
- **Zona testo** i 2/3 sinistri: fondo navy pieno o stadio fuori fuoco scuro, nessuna figura, nessuna luce forte (ci passano sopra titolo bianco e riga meta).
- Consegna 720 e 1200 px, AVIF + WebP; li monta ui-andrea come sorgente `<picture media="(max-width: 599px)">`.

## Verifica

- `e2e/v3c-banner-crop.spec.ts` (`PW_BANNERS=1`): 4 rotte × 7 larghezze (1920–360) × chiaro/scuro × en/pt/fr = 42 test verdi su dev e su build ON; prova di mutazione: togliendo l'arretramento dal taglio diagonale il test fallisce («hands tagliato (right)»).
- Contact sheet prima/dopo: `docs/redesign/banners-crop-after.png`.
