# BetRedge — UI e frontend nel registro MACHINA (fase 1)

**Data:** 2026-08-02 · **riallineata:** 2026-08-20
**Autore:** Claude (sessione aziendale) · **Richiedente:** Andrea
**Riferimento origine:** `~/Desktop/machina` — memoria `project_machina_platform`
**Tag lavoro:** `#UI-MACHINA-0802`

---

## 0. Cosa è cambiato in questa revisione

La prima stesura descriveva la **carta chiara** di MACHINA. Il 2 agosto, dopo
tre passate, Andrea l'ha bocciata e si è passati al **fondo cinematico scuro**:
la preview consegnata e approvata è quella scura. Implementare dalla spec
com'era avrebbe costruito il prodotto sbagliato — è il motivo di questa
riscrittura.

| § | prima | ora |
|---|---|---|
| 2.1 · 4.3 | carta chiara `#EAE8E4` come casa | **fondo cinematico scuro** `#0A0C0F`, scena fotografica fissa dietro |
| 2.2 | sistema + home + schede board | **+ il chrome del desk** (testata, rail, footer) — deciso 2026-08-20 |
| 4.1 | il layer parallelo evitava il tema chiaro rotto | il layer parallelo resta, ma il motivo è un altro (§4.1) |
| 7 | «la home» | **la landing**, col carosello **vero** del sito: 7 slide, non 3 |

Il resto — tipografia, palette validata, struttura delle schede, armature di
verifica — regge e non è stato toccato.

---

## 1. Perché

Andrea, il 2026-08-02: *«mi è piaciuto molto come abbiamo costruito la grafica
dell'UI per MACHINA; prova a rifare UI e frontend di BetRedge in quella
modalità»*.

Non è una richiesta di ricerca visiva: **la north star è già calibrata sul suo
gusto**, ed è MACHINA. Questo soddisfa il punto 1 di
`feedback_design_quality_bar` («studio prima dei pixel») senza una nuova ricerca
di mercato — lo studio è stato fatto costruendo MACHINA e il risultato è stato
approvato.

### Il divario di partenza, misurato

| | MACHINA | BetRedge oggi |
|---|---|---|
| base | carta industriale `#E9EBEE` + fasce scure | dark `#0B0C0E`, verde brand |
| CSS | 671 righe, un sistema | 9.484 righe, 2.220 classi custom |
| pagina più grossa | ~400 righe | `app/app/page.tsx` = **9.489 righe**, ~45 componenti |
| immagini | 37 render generati, ognuno marca un concetto | 15+ oggetti 3D raster + 10 foto sport + **22 creativi finiti** già in repo |

Due ritrovamenti riducono il lavoro.

**Primo: gli ingredienti visivi ci sono già.** Gli oggetti 3D
(`public/icons/menu-*.png`, `market-*.png`, `public/banners/sport-*.png`) sono
un set brandizzato già approvato — `feedback_custom_icons_keep`, dove una
rimozione per errore (PR #154) è stata revertita su richiesta esplicita di
Andrea. Le foto sport self-hostate sono la direzione approvata con *«mamma sono
fantastiche»* — `feedback_banner_photo_direction`.

**Secondo, e vale più del primo: la base è già scura.** `app/layout.tsx` monta
`<html data-theme="dark">`, carica **Hanken Grotesk + JetBrains Mono** via
`next/font/google` — gli stessi due font della preview — e ha già un layer di
grana (`.am-grain`, `z-index:-1`, non interattivo). Il fondo cinematico non
combatte contro il tema esistente: lo continua. Il diff è più corto di quanto la
prima stesura prevedesse, e il tema chiaro rotto
(`project_theme_light_fix`, ~60 colori low-contrast) **non entra nel percorso**.

**In fase 1 non si genera nessuna immagine nuova.** Si usa ciò che c'è.

---

## 2. Le decisioni prese

Prese da Andrea in sessione — le prime sei il 2026-08-02, la settima e la
revisione dello scope il 2026-08-20.

1. **Trapianto della grammatica, non della tinta.** Il percorso è stato carta
   chiara → carta calda con grana → **fondo cinematico scuro**, con le prime due
   bocciate. La diagnosi che ha sbloccato: *una tinta chiara non può competere
   coi creativi di Ole*, che sono scuri, con l'azione e le scie verdi. Non era
   la tonalità sbagliata, era il mondo sbagliato.
2. **Scope fase 1:** il sistema visivo + **il chrome del desk** (testata, rail
   laterale, footer) + la landing pubblica + le schede della board. Le altre tab
   del desk ereditano i token e restano usabili, ridisegnate in fase 2. Il
   chrome è dentro perché è ciò che si vede in **ogni** tab: rifare le schede
   lasciando testata e rail di oggi darebbe un prodotto a due facce già alla
   prima schermata.
3. **Verde = i soldi, riservato.** Sport distinti da colori propri validati; il
   P&L smette di usare verde/rosso pieni.
4. **La home apre col board**, non con la vendita. Copertina compatta, poi il
   prodotto.
5. **La struttura delle schede prediction non si tocca** — solo grafica.
6. **Foto dello sport dietro ogni scheda del board**, con la mitigazione di
   leggibilità del §5.3.
7. **I banner della landing sono quelli veri del sito**, non una selezione
   nuova: *«i banner della landing page devono essere come i banner che abbiamo
   ora sul sito online»* (§7.2).

---

## 3. Vincoli non negoziabili

Regole già in vigore, ereditate. Nessuna va allentata da questo lavoro.

- **Nessuna logica toccata.** Niente `lib/`, niente `app/api/`, niente DB,
  niente Stripe, niente motore di predizione. Solo presentazione.
- **Nessun feature flag nuovo.** `NEXT_PUBLIC_UX_NEW` è già lì, mai impostata:
  `/oggi`, `/risultati`, `/profilo` rispondono **404** e tre cartelle sotto
  `features/` sono codice spento. Un secondo interruttore mai acceso
  raddoppierebbe quel debito (§4.1).
- **Readout della scheda invariato** — `feedback_card_structure_standard`: la
  struttura informativa resta quella live.
- **Anti-slop** — `feedback_antislop_tells`: mai scalette `01/02/03`, mai
  box-dentro-box, mai pill generiche rounded.
- **Niente claim di performance** — `project_track_record_ui`: il backtest
  interno dice che **non** battiamo la chiusura. Nessun «beat the market»,
  nessun hit-rate in cima a una pagina di prodotto.
- **18+ / gioco responsabile / affiliato accanto all'uscita**, non a piè di
  pagina. `project_gambling_qualification` è ancora bloccato sulla conferma
  «VIA A non-gambling»: finché non è chiusa, la dichiarazione è più visibile,
  non meno.
- **Icone custom raster: si aggiungono, non si tolgono.**
- **Deploy** — `feedback_deploy_discipline`: branch + PR + preview. Nessun
  merge su `main` senza `APPROVE` di Andrea.
- **Surgical changes:** ogni riga cambiata deve risalire a questa richiesta.

---

## 4. Il sistema visivo

### 4.1 Dove vive

Un file nuovo: **`app/machina.css`**, importato in `app/layout.tsx` **dopo**
`app/globals.css`. Le pagine rifatte usano le classi nuove; le altre restano
identiche a oggi.

**Le 9.484 righe di `globals.css` non si toccano e i token `--am-*` non si
ri-tingono.** Non è prudenza generica, è la strada meno rischiosa fra tre, e le
altre due sono state scartate con prove:

| strada | perché no |
|---|---|
| **ri-tingere i token `--am-*`** | 2.220 classi cambiano aspetto in un colpo, senza un punto in cui fermarsi a guardare. Il tema chiaro di BetRedge è la dimostrazione di cosa succede quando si ridipinge alla radice senza misurare: `project_theme_light_fix` conta ~60 colori low-contrast ancora aperti. |
| **feature flag** (`NEXT_PUBLIC_UX_MACHINA`) | il precedente è in casa: `NEXT_PUBLIC_UX_NEW` non è mai stata impostata e ha lasciato tre rotte a 404 e tre cartelle di componenti spente. Un interruttore che nessuno accende non è una rete di sicurezza, è codice morto con l'aria di una scelta. |
| **layer parallelo** ← scelto | il diff è additivo e leggibile; ogni superficie passa alla veste nuova quando le sue verifiche passano, non prima; se qualcosa si rompe si toglie un import. |

**Prefisso obbligatorio.** Ogni classe nuova nasce con un prefisso proprio e si
verifica con `grep` contro `globals.css` **prima** di introdurla. È già
successo: `.am-wm` collideva e ha dovuto diventare `.am-cardwm`
(`feedback_redesign_pitfalls`).

**Debito dichiarato:** a fine fase 1 storico, classifica, piani, builder,
invito e account portano ancora la veste di oggi dentro il chrome nuovo. Owner:
Claude. Scadenza: fase 2. È il prezzo di avere un punto di controllo prima di
ridipingere 45 componenti.

### 4.2 Tipografia

**I font restano quelli veri**, e sono già caricati (`app/layout.tsx:2`):
Hanken Grotesk + JetBrains Mono via `next/font/google`. Non si aggiunge né si
sostituisce nulla — usare font di sistema qui sarebbe la regressione elencata al
punto 3 di `feedback_design_quality_bar`.

Si trapianta la **scala e il comportamento**. Valori presi da
`docs/ui-machina/machina.css`, cioè dalla resa che Andrea ha visto:

| classe | ruolo | specifica |
|---|---|---|
| `.t-mega` | conto alla rovescia, numeri di copertina | Hanken 800, tracking `-.05em`, line-height `.84`, `clamp(2.6rem, 7vw, 5.6rem)`, tabellare |
| `.t-h1` | titolo di pagina | Hanken 800, tracking `-.036em`, line-height `1.02`, `clamp(1.9rem, 4.4vw, 3.4rem)`, `text-wrap: balance` |
| `.t-h2` `.t-h3` | titoli di sezione | Hanken 800 / 700, tracking `-.028em` / `-.015em` |
| `.t-lead` `.t-body` | prosa | Hanken 400, line-height `1.55` / `1.6`, `max-width: 62ch` sul lead |
| `.t-key` | etichette | JetBrains Mono `.62rem`, tracking `.2em`, uppercase |
| `.num` | numeri | JetBrains Mono, `font-variant-numeric: tabular-nums` |
| `.eyebrow` | occhiello | mono `.66rem` 600, tracking `.22em`, **filetto 1.6rem × 3px** prima del testo |

Il filetto dell'occhiello è la firma della casa: su MACHINA è arancione, qui
prende il colore dello sport della sezione — e sul fondo cinematico ha un suo
gradino di verde (§4.4).

### 4.3 Superfici — il fondo cinematico

Non è un colore di sfondo: sono **quattro strati fissi**, e l'ordine conta.

| strato | cosa | valori misurati |
|---|---|---|
| base | tinta di fondo | `--paper: #0A0C0F` |
| scena | foto dello sport **fissa**, sfocata, dietro tutto | `.bgfix { position:fixed; z-index:-2; filter:blur(4px) saturate(1.2); opacity:.16; transform:scale(1.04) }` |
| velatura | una sola, verticale | `body::after`, `z-index:-1`, da `rgba(10,12,15,.92)` a `.985` |
| lavaggi + grana | i quattro colori della palette + il rumore | 4 `radial-gradient` (viola `.30`, terracotta `.24`, verde `.22`, blu `.18`) + grana SVG `feTurbulence` a `opacity .05`, tutto `background-attachment: fixed` |

**La scena cambia con la pagina** e la classe dell'immagine basta a cambiarla:
`.bgfix` è un **elemento**, non uno pseudo-elemento, così non serve una
variabile CSS impostata da JavaScript.

Le superfici che nella carta chiara erano bianche diventano pannelli scuri:

| token | valore | uso |
|---|---|---|
| `--paper` | `#0A0C0F` | il fondo della pagina |
| `--card` | `#15181C` | pannelli e schede |
| `--card-2` | `#191D23` | corpo della scheda prediction sul fondo scuro |
| *incasso* | `#0F1216` | `.scorebar` e `.v2r` dentro la scheda — un gradino **sotto** il corpo, non un box bordato |
| `--rule` | `#2B3037` | filetti |
| `--ink` / `--ink2` / `--ink3` | `#FFFFFF` / `#B4BBC4` / `#969CA5` | testo, prosa, etichette |

Due regole di forma, entrambe già pagate su MACHINA:

- `.card-solid` — **una scheda sola, non tagliata in due colori**: la variante
  bianca-con-blocco-nero è stata bocciata («non mi piace la scheda tagliata in
  2 colori»).
- `.scene` — fascia con foto dietro e **una sola velatura**. Due gradienti
  sovrapposti spengono l'immagine: errore già fatto e corretto.

**Come si scrive.** Il ribaltamento vive in un **blocco unico in fondo al
foglio** che ridefinisce i token e le superfici, sopra un impianto neutro. È la
forma della preview e va conservata: rende il fondo una decisione leggibile in
un punto solo, non una tinta spalmata su 500 righe.

**Da dove si copia.** `docs/ui-machina/machina.css`, 579 righe: l'impianto alle
righe 1–400, il blocco `FONDO CINEMATICO` alle righe 403–579. È il file che ha
prodotto la resa approvata — non si riscrive il sistema a mano dall'HTML della
preview. Due cose da correggere nel passaggio a `app/machina.css`:
il commento in testa dice ancora *«il prodotto è a carta chiara»*, e la
`@font-face` con i font inlinati in base64 **si butta**: i font arrivano già da
`next/font` (§4.2).

### 4.4 Colore — validato, non scelto

Validato con `scripts/validate_palette.js` della skill `dataviz`, `--pairs all`
(qualunque coppia può finire adiacente su un board), contro carta `#E9EBEE` e
pannello scuro `#15181C`.

| ruolo | hex | glifo/etichetta di supporto |
|---|---|---|
| calcio | `#6D28D9` viola | icona `sport-football.png` + «Calcio» |
| tennis | `#C2410C` terracotta | icona `sport-tennis.png` + «Tennis» |
| mondiali | `#0369A1` blu | icona `sport-worldcup.png` + «Mondiali» |
| azione / soldi — sulla carta | `#15703B` | — |
| azione / soldi — sul pannello scuro | `#23A559` | — |
| azione / soldi — occhiello sul lavaggio verde | `#33C974` | — |

Esito: tutte le verifiche passano su entrambe le superfici (banda di luminanza,
soglia di croma, separazione protan/deutan, soglia a vista normale).

**Tre errori che il validatore ha preso e l'occhio no:**

1. **Il verde brand non può portare testo sulla carta.** `#23A559` su `#E9EBEE`
   dà **2,66:1**, e bianco sopra dà **3,18:1** — un bottone «Punta ora» sarebbe
   illeggibile. `#15703B` dà **6,15:1** col bianco sopra. Ma `#15703B` sul
   pannello scuro crolla a **2,89:1**, mentre `#23A559` lì dà **5,59:1**.
   Servono **gradini dello stesso verde**, uno per superficie. Sul fondo
   cinematico ne serve un terzo, `#33C974`, per l'occhiello quando cade sul
   lavaggio verde. **Un solo valore di verde è la classe di bug che ha prodotto
   quasi tutte le rotture del ribaltamento chiaro→scuro.**
2. **Ocra per il tennis è da buttare.** `#B45309` contro il verde scuro fa
   **ΔE 3,9 in protanopia**: indistinguibili. Terracotta `#C2410C` risolve.
3. **Il tetto è 3 sport + il verde.** Un quarto colore fallisce sempre: cremisi
   `#BE123C` contro terracotta è **ΔE 8,3 a vista normale** (sotto la soglia di
   15: non li distingue nemmeno chi vede tutti i colori), e blu `#1D4ED8` contro
   viola `#6D28D9` è **ΔE 0,3 in deuteranopia** — identico all'inciampo di
   MACHINA. **Il quarto sport prende glifo + etichetta, non un colore proprio.**

**Due regole che ne discendono:**

- Il viola sul pannello scuro è 2,51:1: va bene come **filetto da 4px in
  testa**, **mai come testo**. Nessun colore di sport porta testo dentro una
  scheda.
- **Il colore non è mai l'unico portatore.** Ogni scheda ha anche il glifo
  raster e l'etichetta scritta.

**Da rifare in implementazione:** il validatore è stato girato contro carta
`#E9EBEE` e pannello `#15181C`. La base è cambiata: va ri-girato con `#0A0C0F`
(fondo) e `#0F1216` (incasso) fra le superfici, e il comando con l'output va
nel PR. La preview scura ha già
passato l'armatura di contrasto sulla resa vera (§9), ma sono due prove
diverse e servono entrambe.

### 4.5 Il P&L smette di usare il verde

Conseguenza diretta della decisione 3. Dove oggi il P&L usa verde/rosso pieni
(`--am-positive` / `--am-negative`), passa a **segno + freccia + cifra
tabellare**: `↑ +12` / `↓ −3`. Il verde in quella schermata significa già
«azione»; farlo significare anche «hai vinto» costringe a interpretare due volte.

*Nota di scope:* in fase 1 questo tocca solo i punti P&L presenti nelle
superfici rifatte. Le tab Storico e Classifica seguono in fase 2.

---

## 5. La scheda prediction

### 5.0 Quali componenti — verificato contro la produzione

Prima di scegliere cosa rifare è stato controllato **cosa è davvero servito**
(`curl` su `www.betredge.com`, 2026-08-02):

| rotta | esito | conseguenza |
|---|---|---|
| `/` `/partners` `/weekly-pick` `/community` | **200** | vive |
| `/oggi` `/risultati` `/profilo` | **404** | dietro `NEXT_PUBLIC_UX_NEW`, non impostata |

Quindi `features/feed/*` (incluso `PickCard`), `features/results/*` e
`features/profile/*` **non sono raggiungibili in produzione**. `BestBetsBoard`
è definito ma **mai renderizzato** — conferma di
`reference_bestbets_live_component`; il board vero è `SportsbookBoard`.

**Nessuno di questi entra in fase 1.** Rifare la grafica di codice spento è
lavoro che nessuno vede (Refusal Ladder, gradino 1). Sono **segnalati e non
rimossi**, come vuole la regola sul dead code preesistente.

**Componenti in fase 1, tutti verificati vivi:**

| file | cosa |
|---|---|
| `app/machina.css` | nuovo — il sistema |
| `app/layout.tsx` | l'import dopo `globals.css` + l'elemento `.bgfix` |
| `app/landing-client.tsx` | la landing pubblica (`app/page.tsx` è solo il wrapper dei metadata) |
| `app/components/LandingCarousel.tsx` | il carosello — **riusato, non riscritto** (§7.2) |
| `app/app/page.tsx` → chrome | testata, rail laterale, footer del desk (§6) |
| `app/app/page.tsx` → `PredictionCard` | scheda calcio |
| `app/app/page.tsx` → `TennisMatchCard` | scheda tennis |
| `app/app/page.tsx` → `SportsbookBoard` | griglia, intestazioni di sezione, filtri |

### 5.1 La struttura non si tocca

Andrea, esplicito: *«le schede prediction vorrei rimanessero con la stessa
struttura, solo migliorate graficamente»*.

Struttura live in `app/app/page.tsx`, da preservare **identica**:

```
article.card > div.pred
  .top        glifo sport + .league          |  .when (orario · LIVE col .pulse)
  .fx         .teams   "SK Brann v Rosenborg"
              .scorebar  [KICKOFF · Sun 2 Aug, 19:15]  |  [FT 3–0]  |  [LIVE 67']
  .v2r        .v2r-l  →  .v2r-eye "Il nostro pronostico"
                         .v2r-pick  nome della selezione
                         .v2r-conf  parola + 4 pallini
              .v2r-q  →  .v2r-qlab "Quota FortunePlay"
                         .v2r-qn    1.98
                         .v2r-sub   "50% modello"  [.v2r-val "value 6.0%"]
  .pred-more  "Apri scheda completa ▸"
```

**Invariato:** ordine delle zone, dati mostrati, stringhe e traduzioni,
`lock-overlay` per le schede bloccate, `verdict` a fine partita, comportamento
below-floor (nessun edge dichiarato, testo «in linea col mercato» —
`#HONEST-RESTORE-1`), apertura del modal al clic, `onSelect` sul blocco value.

**Non si aggiunge un bottone di scommessa nella griglia.** L'uscita
all'operatore vive nel modal, come oggi: aggiungerla sarebbe un cambio di
struttura.

### 5.2 Cosa cambia — solo grafica

| zona | oggi | dopo |
|---|---|---|
| scheda | bordo neutro | `.card-solid`: **filetto 4px in testa** col colore dello sport |
| `.league` | grigio minuscolo | `.t-key` mono maiuscolo spaziato; l'orario in `.num` |
| `.teams` | grigio chiaro | Hanken 700 tracking stretto; la `v` diventa un separatore, non una lettera |
| `.scorebar` | riquadro **bordato** dentro la scheda | stessa posizione e contenuto, **incassata**: fondo più scuro, nessun bordo — toglie il box-dentro-box senza toccare la struttura |
| `.v2r` | riquadro bordato, due colonne | stesse due colonne, incassata allo stesso modo |
| `.v2r-qn` | quota media | corpo maggiore, tabellare — è il numero che si legge da lontano |
| `.v2r-eye` | **verde** | grigio mono spaziato |
| `.v2r-val` | pastiglia verde tenue | **l'unico verde della scheda**, `#23A559` (5,59:1 misurato sul pannello `#15181C`; l'incasso `#0F1216` è più scuro, quindi non peggiora) |
| `.v2r-conf` | pallini + parola | invariati come dati; parola in mono spaziato |
| `.pred-more` | grigio | mono maiuscolo spaziato + chevron |

Lo spostamento del verde è l'unico cambiamento di sostanza, ed è la conseguenza
della decisione 3: con due verdi nella stessa scheda, quello che conta — il
*value* — non si distingue dall'etichetta che gli sta accanto. **Una scheda, un
verde.**

### 5.3 La foto dietro, e come si tiene leggibile

Decisione di Andrea: foto dello sport dietro **ogni** scheda del board. Il
rischio è stato sollevato (sei foto dietro sei tabelle di numeri) e la scelta
confermata; si esegue con questa mitigazione, che non è opzionale:

1. **I numeri non stanno mai direttamente sulla foto.** Il corpo della scheda è
   `--card-2`; `.scorebar` e `.v2r` sono superfici **incassate piene** a
   `#0F1216` — un gradino sotto il corpo, **senza bordo** — sopra l'immagine.
   La foto respira nella fascia alta, dove il testo è grande e in grassetto.
2. **Una sola velatura** (`.card-veil`), densa dal basso e aperta in alto:
   `linear-gradient(to top, rgba(18,21,25,.95) 50%, .76 76%, .20 100%)`. La foto
   sta a `opacity .95`.
3. **Sotto i 640px la velatura diventa piatta e densa**
   (`rgba(18,21,25,.95) 46%` → `.84`) e la foto scende a **`opacity .66`**: su
   telefono la scheda è alta e stretta e il gradiente pensato per una scheda
   larga lascia scoperta la fascia centrale. Misurato su MACHINA.
4. **La foto segue lo sport**, non è decorazione casuale: calcio →
   `football-action` / `football-pitch` / `stadium-night`; tennis →
   `tennis-player`; mondiali → `stadium-crowd`. Alternanza deterministica
   sull'indice della scheda, così due schede adiacenti non portano la stessa
   foto.
5. **Verifica obbligatoria:** contrasto **misurato** su almeno 6 schede rese —
   una per foto usata — per `.teams`, `.v2r-qn`, `.v2r-val`, `.v2r-sub`. Sotto
   4,5:1 la foto si scarta o si scurisce. Nessun giudizio a occhio.

**Controllo meccanico** (lezione di MACHINA, dove l'occhio non vide che le
schede torneo avevano `card-solid` ma nessuno sfondo): contare le occorrenze di
`card-bg` nell'HTML servito e confrontarle col numero di schede attese.

**Trappola dello sfondo, da non rifare:** convertendo un'immagine da `<img>` a
elemento con `background-image`, le regole che selezionavano `img` smettono di
agganciare — e gli sfondi non risultano *rotti*, risultano **assenti**. Un
controllo su `img.naturalWidth` non se ne accorge. Si verifica che
`getComputedStyle(...).backgroundImage` inizi con `url(`.

---

## 6. Il chrome del desk

Entra in fase 1 per la decisione 2: è la cornice che si vede in ogni tab, e
lasciarla come è oggi renderebbe visibile il debito alla prima schermata.

**Dove vive:** dentro `app/app/page.tsx`, 9.489 righe. **Si cambiano le classi,
non la struttura.** Lo scorporo del file **non entra in fase 1**: sarebbe un
refactor non richiesto (`Surgical Changes`) e renderebbe il diff impossibile da
rivedere insieme a un cambio visivo.

| pezzo | cosa cambia |
|---|---|
| **testata** | fascia `--night` piena, filetto `--rule` in basso; wordmark con il blocchetto verde; voci di nav in mono `.66rem` tracking `.16em` uppercase, la attiva col filetto verde sotto; blocco account a destra col badge PRO in verde `#23A559` su testo scuro |
| **rail laterale** | gruppi con titolo in `.t-key`; voce attiva marcata da `box-shadow: inset 3px 0 0` verde — **non** da un fondo pieno; le icone raster custom restano quelle, stesse sorgenti, stessi file |
| **footer** | `SiteFooter.tsx`: griglia sui token nuovi, entità legale e 18+ **più visibili, non meno** (§3) |
| **bottom-nav mobile** | **fuori scope**, resta quella di oggi (§8) |

**Vincolo verificabile:** il numero di riferimenti a `menu-*` / `sport-*` non
cala. `feedback_custom_icons_keep` nasce da una rimozione per errore che Andrea
ha fatto revertire: si contano prima e dopo.

---

## 7. La landing

`app/landing-client.tsx`, 986 righe. `app/page.tsx` è solo il wrapper server dei
metadata (10 righe, canonical di `/`) e **non si tocca**.

### 7.1 La pagina

**Copertina scura compatta** — `.scene` con la foto dietro: occhiello, claim in
una riga, e il **conto alla rovescia al prossimo calcio d'inizio** in `.t-mega`.
Calcolato **sul server**, niente timer JS: è la scelta di MACHINA e regge la
pre-generazione.

**Poi subito il board** — filtri sport in una riga, e le schede vere. La landing
già renderizza il componente reale, quindi eredita il redesign della scheda
senza una copia marketing da mantenere allineata.

**Sotto:** come funziona (senza scaletta numerata — `feedback_antislop_tells`),
i piani, il footer.

**La voce è dell'utente, non del pitch.** È l'errore che su MACHINA è stato
fatto per quattro passate di fila.

| oggi | dopo |
|---|---|
| «Probabilità calibrate su calcio & tennis» | **«Le partite di oggi, e dove conviene puntarci»** |

Le metriche da analista non spariscono: **cambiano posto**, e scendono nello
Storico dove chi vuole capire il modello le cerca. In cima a una pagina di
prodotto sono rumore — e, dato `project_track_record_ui`, sono anche terreno
FTC.

**Le schede premium restano visibili e bloccate.** Un lucchetto su un dato vero
converte meglio di una promessa, e non richiede nessun claim.

### 7.2 I banner: quelli veri, non una selezione nuova

Decisione 7. Il divario misurato fra preview e produzione:

| | preview `#UI-MACHINA-0802` | sito vero (`LandingCarousel.tsx`) |
|---|---|---|
| slide | **3**, ripetute due volte | **7** |
| prima slide | un creativo di Ole | `hero-allsports.jpg` — **richiesta esplicita di Andrea**: «il banner betredge deve essere il primo», con `priority` |
| resto | — | 6 creativi verdi di Ole: calcio `ole-football-signal`, tennis `ole-tennis-insight` e `ole-tennis-signal`, multisport `ole-multisport-edge`, `-onemodel`, `-readable` |
| per vista | 1 | **2 su desktop, 1 sotto 860px** |
| ritmo | manuale | autoplay 3,5s, pausa su hover/focus, spento con `prefers-reduced-motion` |

**Quindi `LandingCarousel` si riusa così com'è**: stesse slide, stesso ordine,
stesso comportamento. Cambia solo la veste — cornice, frecce, dots — sui token
nuovi. Tre cose non si toccano, e ognuna ha già un motivo scritto nel file:

- **Lo slot è `aspect-ratio: 16/9` e mostra il banner INTERO.** I creativi di
  Ole sono 1672×941, cioè 16:9 esatto: logo in alto e disclaimer in basso
  restano interamente visibili. Un ritaglio taglierebbe testo baked
  nell'immagine.
- **Sulle slide `creative` non si sovrappone copy HTML.** Il testo è già
  nell'immagine: aggiungerne sarebbe doppio-testo.
- **Gli `imgAlt` restano in inglese in tutte le lingue** (`#LANDING-I18N-0731`):
  il testo dei creativi è baked in inglese e l'alt è visibile finché l'immagine
  non è caricata — in italiano sembrava copy sbagliata.

I `creative-58xx` su disco restano fuori dalla rotazione, come oggi. La
selezione verde on-brand (i purple del set di Ole sono esclusi) non si
ri-discute in questa fase.

---

## 8. Fuori scope (fase 2)

Elencato per non farlo per sbaglio: tab `plans`, `history`, `leaderboard`,
`match-builder`, `invita`, `account`; pagine **vive** `/partners`,
`/weekly-pick`, `/community`, `/world-cup`; bottom-nav mobile; modali
(`MatchDetailSheet`, `PredictionDetailModal`, `CheckoutModal`); la riduzione di
`globals.css`; lo scorporo di `app/app/page.tsx` in file più piccoli.

**Non in fase 2 finché non tornano vive:** `/oggi`, `/risultati`, `/profilo` e i
componenti sotto `features/feed`, `features/results`, `features/profile`, più
`BestBetsBoard` (§5.0). Se qualcuna venisse riaccesa, rientra in coda allora —
non prima.

**Pending della preview, non convertiti in codice qui:** il Match Builder mostra
le selezioni ma non calcola la probabilità combinata (è logica, non
presentazione: fuori dal §3); il toggle DARK/LIGHT è omesso — su questo fondo il
chiaro non esiste; la racchetta da tennis non è mai stata generata (`gptimg` si
è impiantato due volte — `reference_gptimg_appserver_hang`), e in fase 1 non si
generano immagini nuove.

---

## 9. Criterio di successo

Fase 1 è finita quando **tutte** queste sono vere:

1. `npm run build` completa e `tsc` è verde.
2. La suite esistente resta verde, **senza test nuovi** — e girata sulle **due**
   suite: `vitest` **non** esegue `tests/` (`reference_two_test_suites`). I
   componenti toccati vivono dentro `app/app/page.tsx` e non hanno test propri
   oggi; scriverli richiederebbe di estrarli dal file da 9.489 righe, cioè il
   refactor escluso al §8. Sono modifiche di sola presentazione: la verifica che
   le sostituisce è il contrasto **misurato** (4), il conteggio meccanico (5) e
   l'ispezione visiva (6) — non «sembra a posto».
3. Il validatore della palette passa con `#0A0C0F` fra le superfici — comando e
   output riportati nel PR, non riassunti (§4.4).
4. `docs/ui-machina/src/audit-contrast.mjs` puntato sul **build Next vero**
   (non sulla preview): 0 nodi sotto soglia AA, 3:1 per il testo grande.
   Sulla preview la misura era 2.678 nodi, 0 sotto soglia, margine minimo +12%:
   quello è il livello da non perdere.
5. `docs/ui-machina/src/audit-overflow.mjs`: **0 overflow orizzontale** a
   360 / 390 / 768 / 1440 su ogni pagina toccata.
6. Il conteggio `card-bg` nell'HTML servito corrisponde al numero di schede, e
   `getComputedStyle(...).backgroundImage` inizia con `url(` (§5.3).
7. Il numero di riferimenti alle icone `menu-*` / `sport-*` non cala (§6).
8. Ispezione visiva su preview Vercel: **desktop e 390px reale** (Playwright —
   `feedback_mobile_visual_check`: l'estensione Chrome non cambia il viewport),
   **da loggato oltre che in anonimo** (`feedback_visual_check_loggato`).
9. Nessun file sotto `lib/`, `app/api/`, `db/`, `supabase/` compare nel diff.
10. `machina.css` è un foglio solo: dimensione del bundle prima/dopo riportata
    nel PR.
11. Andrea guarda la preview e dice che è quello.

Poi: PR aperta, **nessun merge senza `APPROVE`**.

*Nota operativa:* l'auto-deploy Vercel è stato rotto in passato e i merge non
deployavano da soli (`project_house_banners`); la preview del PR va verificata
esistente, non presunta.

---

## 10. Rischi

| rischio | mitigazione |
|---|---|
| Foto dietro le schede rende dubbio un numero | numeri su superfici incassate piene + contrasto misurato per foto (§5.3) |
| Collisione di nomi di classe col CSS esistente | prefisso proprio + `grep` contro `globals.css` prima di introdurre una classe. È già successo: `.am-wm` → `.am-cardwm` (`feedback_redesign_pitfalls`) |
| Il chrome sta in un file da 9.489 righe | si cambiano solo le classi; nessuno scorporo; il diff resta leggibile riga per riga |
| Un figlio `width: max-content` stira gli antenati | l'armatura overflow lo prende. Precedente: un marquee `max-content` allargò la board a ~3200px **nonostante** `overflow:hidden`; serve `position:absolute` o `min-width:0` sui figli di grid |
| Il layer parallelo pesa sul bundle | `machina.css` è un foglio solo; dimensione misurata prima/dopo nel PR |
| Il prodotto ha due facce in fase 1 | debito dichiarato, owner Claude, scadenza fase 2 (§4.1) |
| Rimozione involontaria delle icone custom | conteggio prima/dopo (§6, §9.7) |
| Il carosello perde una slide o l'ordine | `LandingCarousel` non si riscrive: si rivede il diff su `SLIDE_DEFS`, che deve essere **vuoto** (§7.2) |
