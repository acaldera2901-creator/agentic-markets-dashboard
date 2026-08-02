# BetRedge — UI e frontend nel registro MACHINA (fase 1)

**Data:** 2026-08-02 · **Autore:** Claude (sessione aziendale) · **Richiedente:** Andrea
**Riferimento origine:** `~/Desktop/machina` — memoria `project_machina_platform`
**Tag lavoro:** `#UI-MACHINA-0802`

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
| pagina più grossa | ~400 righe | `app/app/page.tsx` = 9.279 righe, ~45 componenti |
| immagini | 37 render generati, ognuno marca un concetto | 15+ oggetti 3D raster + 10 foto sport **già in repo** |

Il ritrovamento che riduce il lavoro: BetRedge **ha già entrambi gli ingredienti
visivi di MACHINA**. Gli oggetti 3D (`public/icons/menu-*.png`,
`market-*.png`, `public/banners/sport-*.png`) sono un set brandizzato già
approvato — vedi `feedback_custom_icons_keep`, dove una rimozione per errore
(PR #154) è stata revertita su richiesta esplicita di Andrea. Le foto sport
self-hostate (`stadium-night.jpg`, `football-action.jpg`, `tennis-player.jpg`,
`stadium-crowd.jpg`, `football-pitch.jpg`, `basket-court.jpg`…) sono la
direzione che Andrea ha approvato con *«mamma sono fantastiche»* — vedi
`feedback_banner_photo_direction`.

**In fase 1 non si genera nessuna immagine nuova.** Si usa ciò che c'è, come lo
usa MACHINA.

---

## 2. Le quattro decisioni prese

Prese da Andrea in sessione, 2026-08-02.

1. **Trapianto pieno dell'estetica**, non solo del metodo. Carta chiara come
   casa, schede scure sopra, fasce cinematiche a piena pagina.
2. **Scope fase 1:** il sistema visivo + la home pubblica + le schede della
   board. Il resto del desk eredita i token e resta usabile, ridisegnato in
   fase 2.
3. **Verde = i soldi, riservato.** Sport distinti da colori propri validati; il
   P&L smette di usare verde/rosso pieni.
4. **La home apre col board**, non con la vendita. Copertina compatta, poi il
   prodotto.

E, sulla scheda:

5. **La struttura delle schede prediction non si tocca** — solo grafica.
6. **Foto dello sport dietro ogni scheda del board**, con la mitigazione di
   leggibilità descritta al §5.3.

---

## 3. Vincoli non negoziabili

Regole già in vigore, ereditate. Nessuna va allentata da questo lavoro.

- **Nessuna logica toccata.** Niente `lib/`, niente `app/api/`, niente DB,
  niente Stripe, niente motore di predizione. Solo presentazione.
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
`app/globals.css`.

**I 9.484 righe di `globals.css` non si toccano e i token `--am-*` non si
ri-tingono.** Motivo misurato: BetRedge ha già un tema chiaro
(`:root[data-theme="light"]`) ed è rotto — `project_theme_light_fix` conta ~60
colori low-contrast da correggere. Ridefinire i valori `--am-*` verso la carta
chiara farebbe ereditare quel guasto a tutte le 2.220 classi in un colpo solo.

Le pagine rifatte usano le classi nuove; le altre restano identiche a oggi.

**Debito dichiarato:** a fine fase 1 il prodotto ha due facce — home e board
chiari, le altre tab del desk ancora scure. Owner: Claude. Scadenza: fase 2.
È il prezzo di avere un punto di controllo prima di ridipingere 45 componenti.

### 4.2 Tipografia

**I font restano quelli veri.** MACHINA non usa webfont perché doveva pesare
zero; BetRedge carica già Hanken Grotesk + JetBrains Mono via `next/font/google`
(`app/layout.tsx:2`), che fanno lo stesso mestiere meglio. Usare font di sistema
qui sarebbe una regressione — è esattamente il difetto di metodo elencato in
`feedback_design_quality_bar` punto 3.

Si trapianta la **scala e il comportamento**, non il font:

| classe | ruolo | specifica |
|---|---|---|
| `.t-hero` | testata di copertina | Hanken 800, uppercase, tracking `-0.055em`, line-height `0.86`, `clamp(3rem, 11.5vw, 10rem)` |
| `.t-mega` | conto alla rovescia | Hanken 800, tracking `-0.05em`, tabellare, `clamp(3.4rem, 9vw, 8rem)` |
| `.t-h1` `.t-h2` `.t-h3` | titoli | Hanken 800/700, tracking da `-0.034em` a `-0.015em`, `text-wrap: balance` |
| `.t-lead` `.t-body` | prosa | Hanken 400, `line-height 1.5–1.55` |
| `.t-key` | etichette | JetBrains Mono, `0.68rem`, tracking `0.2em`, uppercase |
| `.t-num` | numeri | JetBrains Mono, `font-variant-numeric: tabular-nums` |
| `.eyebrow` | occhiello | mono `0.7rem`, tracking `0.22em`, **filetto 1.6rem × 3px** prima del testo |

Il filetto dell'occhiello è la firma della casa: su MACHINA è arancione, qui
prende il colore dello sport della sezione.

### 4.3 Superfici

| token | valore | uso |
|---|---|---|
| `--paper` | `#E9EBEE` | il fondo della pagina, la casa |
| `--card` | `#FFFFFF` | schede chiare (sezioni esplicative) |
| `--night` | `#0C0E11` | fasce scure a piena pagina |
| `--night2` | `#15181C` | superficie delle schede scure |
| `--night3` | `#2A2F36` | filetti dentro il buio |
| `--ink` / `--ink2` / `--ink3` | `#0C0E11` / `#4C525A` / `#8D939B` | testo sulla carta |

- `.card-solid` — scheda scura sulla carta chiara. **Una scheda sola, non
  tagliata in due colori**: su MACHINA la variante bianca-con-blocco-nero è
  stata bocciata («non mi piace la scheda tagliata in 2 colori»).
- `.scene` — fascia scura a piena pagina con foto dietro e **una sola
  velatura**. Due gradienti sovrapposti spengono l'immagine: errore già fatto e
  corretto su MACHINA, da non rifare.

### 4.4 Colore — validato, non scelto

Validato con `scripts/validate_palette.js` della skill `dataviz`, `--pairs all`
(qualunque coppia può finire adiacente su un board), contro **entrambe** le
superfici: carta `#E9EBEE` e scheda scura `#15181C`.

| ruolo | hex | glifo/etichetta di supporto |
|---|---|---|
| calcio | `#6D28D9` viola | icona `sport-football.png` + «Calcio» |
| tennis | `#C2410C` terracotta | icona `sport-tennis.png` + «Tennis» |
| mondiali | `#0369A1` blu | icona `sport-worldcup.png` + «Mondiali» |
| **azione / soldi (carta)** | `#15703B` | — |
| **azione / soldi (scheda scura)** | `#23A559` | — |

Esito: tutte le verifiche passano su entrambe le superfici (banda di luminanza,
soglia di croma, separazione protan/deutan, soglia a vista normale).

**Tre errori che il validatore ha preso e l'occhio no:**

1. **Il verde brand non può portare testo sulla carta.** `#23A559` su `#E9EBEE`
   dà **2,66:1**, e bianco sopra dà **3,18:1** — un bottone «Punta ora» sarebbe
   illeggibile. `#15703B` dà **6,15:1** col bianco sopra e **5,15:1** come testo
   sulla carta. Ma `#15703B` sulla scheda scura crolla a **2,89:1**, mentre
   `#23A559` lì dà **5,59:1**. Servono **due gradini dello stesso verde**, uno
   per la carta e uno per il buio. È la stessa classe di bug del `btn-ghost`
   nero-su-nero trovato su MACHINA in verifica — preso prima, stavolta.
2. **Ocra per il tennis è da buttare.** `#B45309` contro il verde scuro fa
   **ΔE 3,9 in protanopia**: indistinguibili. Terracotta `#C2410C` risolve.
3. **Il tetto è 3 sport + il verde.** Un quarto colore fallisce sempre: cremisi
   `#BE123C` contro terracotta è **ΔE 8,3 a vista normale** (sotto la soglia di
   15: non li distingue nemmeno chi vede tutti i colori), e blu `#1D4ED8` contro
   viola `#6D28D9` è **ΔE 0,3 in deuteranopia** — identico all'inciampo di
   MACHINA. **Il quarto sport prende glifo + etichetta, non un colore proprio**,
   oppure si ri-steppa l'intera scala e si ri-valida.

**Due regole che ne discendono:**

- Il viola sulla scheda scura è 2,51:1: va bene come **filetto da 4px in testa**,
  **mai come testo**. Nessun colore di sport porta testo dentro una scheda scura.
- **Il colore non è mai l'unico portatore.** Ogni scheda ha anche il glifo
  raster e l'etichetta scritta.

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
(`app/app/page.tsx:2464`) è definito ma **mai renderizzato** — conferma di
`reference_bestbets_live_component`; il board vero è `SportsbookBoard`
(renderizzato a `app/app/page.tsx:7997`).

**Nessuno di questi entra in fase 1.** Rifare la grafica di codice spento è
lavoro che nessuno vede (Refusal Ladder, gradino 1). Sono **segnalati e non
rimossi**, come vuole la regola sul dead code preesistente.

**Componenti in fase 1, tutti verificati vivi:**

| file | cosa |
|---|---|
| `app/machina.css` | nuovo — il sistema |
| `app/layout.tsx` | una riga: l'import dopo `globals.css` |
| `app/page.tsx` | la home pubblica |
| `app/app/page.tsx` → `PredictionCard` | scheda calcio |
| `app/app/page.tsx` → `TennisMatchCard` | scheda tennis |
| `app/app/page.tsx` → `SportsbookBoard` | griglia, intestazioni di sezione, filtri |

### 5.1 La struttura non si tocca

Andrea, esplicito: *«le schede prediction vorrei rimanessero con la stessa
struttura, solo migliorate graficamente»*.

Struttura live in `app/app/page.tsx` (`PredictionCard` calcio ~riga 4906,
`TennisMatchCard` ~riga 5535), da preservare **identica**:

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
| `.league` | grigio minuscolo | `.t-key` mono maiuscolo spaziato; l'orario in `.t-num` |
| `.teams` | grigio chiaro | Hanken 700 tracking stretto; la `v` diventa un separatore, non una lettera |
| `.scorebar` | riquadro **bordato** dentro la scheda | stessa posizione e contenuto, **incassata**: fondo più scuro, nessun bordo — toglie il box-dentro-box senza toccare la struttura |
| `.v2r` | riquadro bordato, due colonne | stesse due colonne, incassata allo stesso modo |
| `.v2r-qn` | quota media | corpo maggiore, `.t-num` tabellare — è il numero che si legge da lontano |
| `.v2r-eye` | **verde** | grigio mono spaziato |
| `.v2r-val` | pastiglia verde tenue | **l'unico verde della scheda**, `#23A559` (5,59:1 sul fondo scuro) |
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

1. **I numeri non stanno mai direttamente sulla foto.** `.scorebar` e `.v2r`
   sono superfici **incassate piene** (`--night2` a opacità piena) sopra
   l'immagine. La foto respira nella fascia alta — lega, orario, squadre — dove
   il testo è grande e in grassetto.
2. **Una sola velatura** (`.card-veil`), densa dal basso, aperta in alto.
3. **Sotto i 640px la velatura diventa piatta e densa** e la foto scende a
   `opacity .62`: su telefono la scheda è alta e stretta e il gradiente pensato
   per una scheda larga lascia scoperta la fascia centrale. Misurato su MACHINA.
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

---

## 6. La home

`app/page.tsx` (950 righe).

**Copertina scura compatta** — `.scene` su `stadium-night.jpg`: occhiello,
claim in una riga, e il **conto alla rovescia al prossimo calcio d'inizio** in
`.t-mega`. Calcolato **sul server**, niente timer JS: è la scelta di MACHINA e
regge la pre-generazione.

**Poi subito il board** — filtri sport in una riga, e le schede vere. La home
già renderizza `TennisMatchCard`, il componente reale (commento `#HOME-V3
Anatomy` in `app/page.tsx`), quindi eredita il redesign della scheda senza una
copia marketing da mantenere allineata.

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

---

## 7. Fuori scope (fase 2)

Elencato per non farlo per sbaglio: tab `plans`, `history`, `leaderboard`,
`match-builder`, `invita`, `account`; pagine **vive** `/partners`,
`/weekly-pick`, `/community`, `/world-cup`; footer, bottom-nav mobile, modali
(`MatchDetailSheet`, `PredictionDetailModal`, `CheckoutModal`); la riduzione di
`globals.css`; lo scorporo di `app/app/page.tsx` in file più piccoli.

**Non in fase 2 finché non tornano vive:** `/oggi`, `/risultati`, `/profilo` e i
componenti sotto `features/feed`, `features/results`, `features/profile`, più
`BestBetsBoard` (§5.0). Se qualcuna venisse riaccesa, rientra in coda allora —
non prima.

Lo scorporo del file da 9.279 righe **non entra in fase 1**: sarebbe un refactor
non richiesto (`Surgical Changes`) e renderebbe il diff impossibile da rivedere
insieme a un cambio visivo.

---

## 8. Criterio di successo

Fase 1 è finita quando **tutte** queste sono vere:

1. `npm run build` completa e `tsc` è verde.
2. La suite esistente resta verde (`npm test`), **senza test nuovi**. I tre
   componenti toccati vivono dentro `app/app/page.tsx` e non hanno test propri
   oggi; scriverli richiederebbe di estrarli dal file da 9.279 righe, cioè il
   refactor escluso al §7. Sono modifiche di sola presentazione: la verifica
   che le sostituisce è il contrasto **misurato** (punto 4), il conteggio
   meccanico (punto 5) e l'ispezione visiva (punto 6) — non «sembra a posto».
3. Il validatore della palette passa su entrambe le superfici — comando e output
   riportati nel PR, non riassunti.
4. Contrasto **misurato** ≥ 4,5:1 su `.teams`, `.v2r-qn`, `.v2r-val`,
   `.v2r-sub` per ogni foto usata (§5.3.5).
5. Il conteggio `card-bg` nell'HTML servito corrisponde al numero di schede.
6. Ispezione visiva su preview Vercel: **desktop e 390px reale** (Playwright —
   `feedback_mobile_visual_check`: l'estensione Chrome non cambia il viewport),
   **da loggato oltre che in anonimo** (`feedback_visual_check_loggato`).
7. Nessun file sotto `lib/`, `app/api/`, `db/`, `supabase/` compare nel diff.
8. Andrea guarda la preview e dice che è quello.

Poi: PR aperta, **nessun merge senza `APPROVE`**.

---

## 9. Rischi

| rischio | mitigazione |
|---|---|
| Foto dietro le schede rende dubbio un numero | numeri su superfici incassate piene + contrasto misurato per foto (§5.3) |
| Collisione di nomi di classe col CSS esistente | tutte le classi nuove hanno prefisso proprio; verifica `grep` contro `globals.css` prima di introdurne una. È già successo: `.am-wm` → `.am-cardwm` (`feedback_redesign_pitfalls`) |
| Il layer parallelo pesa sul bundle | `machina.css` è un foglio solo; misurare la dimensione prima/dopo e riportarla nel PR |
| Due facce del prodotto in fase 1 | debito dichiarato, owner Claude, scadenza fase 2 (§4.1) |
| Rimozione involontaria delle icone custom | `feedback_custom_icons_keep`: si aggiungono, non si tolgono. Verifica che i `menu-*` / `sport-*` referenziati non calino di numero |
