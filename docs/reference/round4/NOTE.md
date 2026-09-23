# Round 4 — asset Art Director (2026-09-22)

Tutto generato con `gptimg` (wrapper sincrono su Codex, `-r` sempre: lo stile lo dichiaro io nel prompt).
Nessuna persona, nessun testo, nessun marchio terzo in nessun asset — verificato a occhio su ogni PNG.
Palette usata nei prompt = token veri di `app/globals.css`: bg `#060B24` · panel `#0C1741` · royal `#5A85FF`/`#2A5BFF` · sky `#7FC4FF` · lime `#C8FF3D`.

Due lezioni operative su `gptimg`:
1. **Mai due in parallelo**. Il wrapper ricava il path dal log di Codex e, se non lo trova, ripiega sullo snapshot di tutta `~/.codex/generated_images/` — cinque run concorrenti si sono copiati a vicenda i PNG (stessi hash sotto prefissi diversi). Ho deduplicato per md5 e rinominato per contenuto; la seconda ondata è andata in sequenza.
2. **Da uno script in background, chiudere stdin** (`gptimg … </dev/null`): senza TTY `codex exec` stampa «Reading additional input from stdin...» e resta appeso in attesa di un EOF che non arriva — misurato il 22/09, 30 minuti persi sulla prima icona della terza ondata (la seconda ondata era passata solo per caso). Vale per qualunque wrapper su `codex exec` lanciato da un job non interattivo; da valutare se metterlo direttamente dentro `gptimg`.

## 1. Hero quadrato — `hero-A-databall.png` (scelta), `hero-B-orbit.png`, `hero-C-ribbons.png`

Tutti 1254×1254, soggetto centrato con margine scuro: si ritagliano/scalano senza perdere il soggetto (ui-andrea lo porta a ≤50% della larghezza, con le prediction card nello spazio a fianco).

Perché niente atleta e niente tipografia-su-texture: l'atleta generico è il template n.1 dei generatori (round 2, bocciato); la texture duotone senza soggetto non «attrae» (round 3, bocciato). Quello che rende BetRedge riconoscibile è **sport + modello**: un oggetto sportivo vero che diventa dato. Quindi l'hero è un oggetto, non una scena.

- **A · data-ball (promosso).** Pallone da calcio in pelle vera, metà reale e metà che si dissolve in una mesh di probabilità royal-blue, con un solo anello lime come traiettoria. È il prodotto in un'immagine (Model sul Market → Edge in lime), è sulla palette del sito (navy/royal/lime, zero rosso), non ha persone, non ha testo, e resta leggibile anche piccolo perché il soggetto è uno. Rischio noto: la «sfera di particelle» è un tropo tech; qui lo regge la pelle vera del pallone e il fatto che l'accento è uno solo.
- **B · orbit (alternativa 1).** Pallone con anelli di fuoco rosso/arancio: è la stessa lingua dei tile sport di produzione, quindi hero + riga sport diventerebbero una famiglia sola. Contro: il rosso/arancio non è nella palette del prodotto (già annotato in `SportCategoryTile.tsx`) e il «pallone infuocato» è un visual da stock — più energia, meno «quantitativo». Da usare se Andrea preferisce la continuità coi tile alla coerenza di palette.
- **C · ribbons (alternativa 2).** Due nastri, royal (market) e lime (model), che divergono su un prato con riga di calce: il concetto di edge reso astratto. Elegante e sulla palette, ma senza didascalia il calcio si intuisce appena. Più adatto a un banner di sezione («Why the model disagrees») che all'hero.

## 2. Sport-tile — Basketball ed Esports

Football e Tennis restano `public/banners/sport-football.png`/`sport-tennis.png` + `-sm.png` (decisione di Andrea, non toccati).
Calibrazione fatta guardando i file veri, non a memoria: sono PNG **trasparenti** (alpha), 320×320 (football 320×303) e 64×64; la «tile scura arrotondata» è la CSS di `.br-tile` (`--am-panel`, bordo 1px). Quindi i nuovi asset sono oggetti su alpha, non tile pre-composte.

- `sport-basketball-src.png` (1254, grezzo) → `sport-basketball.png` (320×320) + `sport-basketball-sm.png` (64×64). Alpha del corpo normalizzata a 255 (Codex esce a 252–253). Verificato affiancato al football sul colore pannello a 320 e 64 px (`_preview-basket-vs-football.png`): stessa famiglia — oggetto 3D + anelli orbitali rosso/arancio + scintille; gli anelli sono un filo più netti di quelli del football, a 64px non si nota.
- Esports: vedi sezione in coda (v1 vs v2).

Destinazione proposta per ui-andrea: `public/banners/sport-basketball.png`, `sport-basketball-sm.png`, `sport-esports.png`, `sport-esports-sm.png` — stessa cartella e stesso schema di nome degli esistenti, così `SportCategoryTile` riceve `icon` con un `<img>` identico per i quattro sport.

- `sport-esports-src.png` (grezzo, = v2) → `sport-esports.png` (320×320) + `sport-esports-sm.png` (64×64). Controller generico (nessun marchio, tasti senza lettere). La v1 (`sport-esports-src-scartato-v1.png`) aveva fiamme spesse e fumo: non era «lo stesso trattamento» degli anelli sottili di football/tennis; la v2 lo è. Riga completa a 64px in `_preview-sport-row-64px.png`: i due nuovi hanno anelli un po' più netti dei due di produzione (alone più diffuso) — stessa famiglia, differenza tollerabile a dimensione tile; se ui-andrea la vede stonare, si rigenera con «softer diffuse glow» in un turno.

## 3. Nuovo set icone menu/tool/market — 4 esempi per validare lo stile

`menu-tools-v1.png` (calcolatrice) · `menu-prediction-v1.png` (pallone, un pannello lime) · `market-result-v1.png` (targa a tre slot, il centrale lime) · `menu-leaderboard-v1.png` (podio con stella). Tutti 1254² su alpha; foglio di confronto a 240 e 32px, con le due vecchie icone verde/oro accanto: `_preview-icons-badges.png`.

Perché questo stile (matte royal + un accento lime + smusso a 45°):
- Il vecchio set (vetro verde lucido + oro) parla la lingua **casinò/lusso** — l'esatto opposto del posizionamento «quantitativo, non casinò»; l'oro non esiste nella palette del prodotto.
- Il nuovo è **un materiale solo** (argilla opaca, niente riflessi, niente gradienti), **due colori di prodotto** (royal `#2A5BFF` corpo, navy `#0C1741` ombre) e **un solo accento** lime per icona — la stessa regola «un elemento colorato oltre al testo» già scritta per le card. Il taglio a 45° in alto a sinistra è la firma che il round 3 ha già messo su card e icone vettoriali: così PNG 3D e SVG flat appartengono allo stesso sistema invece di sommarsi.
- È più semplice del 3D ornato (silhouette unica, leggibile a 32px — verificato nel foglio) ma resta custom: non è un template Lucide né un render glossy generico.

Giudizio sui quattro: tools, prediction e leaderboard reggono; **`market-result` è debole** (sembra un interruttore/toggle, non un mercato 1X2) — da rifare con un altro soggetto (es. tre tessere a gradino, o una porta stilizzata) prima di estendere. Estensione a tutto l'inventario (≈20: menu account/builder/creator/history/invite/partner/plans/weeklypick, tool arbitrage/bankroll/ev/kelly, market betslip/goals/scorer/soft) **solo dopo la validazione** di chi coordina; i prompt completi sono in `prompts-round4.sh` (variabile `ICON`), basta cambiare la riga `Subject:`.

## 4. Badge per le prediction card — 3 esempi per validare il sistema

`badge-bolt-v1.png` (fulmine lime) · `badge-wolf-v1.png` (lupo sky) · `badge-wave-v1.png` (onda gialla). Targa smussata navy con bordo royal sottile, simbolo in rilievo piatto, un colore ciascuno. Nel foglio `_preview-icons-badges.png` a 240 e 40px.

Sistema proposto (al posto dello scudo tinto proceduralmente di `lib/ui/crest-assets.ts`, `CREST_MAP` vuota):
- **Nessun logo di squadra reale**, mai (rischio marchio identico al caso Nike; Codex riproduce i marchi se glielo chiedi). I badge sono totem originali: una libreria piccola (10–14 simboli: fulmine, lupo, onda, stella, torre, quercia, aquila, ancora, cometa, montagna…) nello stesso stile, e la mappa squadra → simbolo+colore resta **deterministica per hash** come oggi (stessa squadra, stesso badge ovunque). Le iniziali, se servono, le sovrappone la CSS in Saira Condensed — non si chiedono lettere a Codex, le sbaglia.
- Coerenza col set icone: stesso smusso, stesso materiale opaco, stessi colori di prodotto — card, menu e tile leggono come una mano sola.
- Controllo prima di mappare: ogni simbolo animale/oggetto va confrontato con i crest reali delle leghe in pipeline (il lupo di profilo è generico, ma un lupo frontale geometrico ricorderebbe un club inglese). Chi estende la libreria lo fa simbolo per simbolo, non in blocco.

Anche qui: set completo solo dopo validazione. Prompt in `prompts-round4.sh` (variabile `BADGE`).

## Cosa aspetta una validazione prima di essere esteso
1. **Hero**: A promosso da me; scelta finale A/B (coerenza palette vs continuità coi tile) è di Andrea — ui-andrea intanto può wirare A.
2. **Set icone**: direzione da confermare da chi coordina (e `market-result` da rifare) prima dei ~20 asset.
3. **Badge**: sistema da confermare (e interpretazione «solo % del modello sulla card» ancora da confermare da Andrea) prima della libreria completa e del wiring in `crest-assets.ts`.
4. Sport-tile Basketball/Esports: pronti, nessuna validazione di stile necessaria (stile deciso da Andrea) — solo integrazione.

## Per ui-andrea / programmatore-andrea (path esatti)
- Hero: `docs/reference/round4/hero-A-databall.png` → `public/images/hero/hero-square.png` (ottimizzare a ≤600px jpg/webp per il web; il master resta qui), quadrato ≤50% larghezza, prediction card nello spazio a fianco.
- Sport-tile: `sport-basketball.png`/`-sm.png`, `sport-esports.png`/`-sm.png` → `public/banners/` accanto a football/tennis; `SportCategoryTile` riceve `icon={<img …>}` per tutti e quattro (i sport-*.png hanno alpha, la tile scura è già `.br-tile`).
- Icone menu e badge: **non ancora** — attendono il via.

File di lavoro: `_preview-*.png` sono fogli di verifica (si possono buttare), `*-src*.png` sono i master 1254² (untracked come gli altri master del progetto, da non committare in repo).

---

# Round 4 — seconda consegna (decisioni del coordinatore: A confermato, set icone e badge confermati)

## Percorsi finali in `public/` e mapping

**Hero** — `public/images/hero/hero-square.jpg` (960², 168 KB) e `hero-square-480.jpg` (480², 46 KB, per ≤640px). Master 1254² in `docs/reference/round4/hero-A-databall.png`. B «orbit» scartato dal coordinatore (troppo vicino allo stock «palla di fuoco»).

**Sport-tile** — `public/banners/sport-basketball.png` + `-sm.png`, `sport-esports.png` + `-sm.png` (320² / 64², alpha). Stesso schema di football/tennis; `SportCategoryTile` li riceve via `icon={<img …>}`.

**Icone menu/tool/market** — sovrascritte **in place** in `public/icons/` con gli stessi nomi e misure del vecchio set (320² + `-sm` 64²): nessun wiring nuovo, i tre componenti che le caricano funzionano così come sono.

| File (`public/icons/`) | Componente che lo carica | Dove appare |
|---|---|---|
| `menu-prediction/-history/-plans/-creator/-builder/-leaderboard/-invite/-weeklypick/-account/-partner/-tools` | `MenuIcon name=…` (`app/components/menu-icon.tsx`) | rail/menu Account (oggi usati: `account`, `tools`, `weeklypick` in `app/app/page.tsx`; gli altri restano disponibili per le voci «More») |
| `tool-arbitrage-calculator/-bankroll-calculator/-ev-calculator/-kelly-criterion` | `ToolIcon slug=…` (`components/tools/ToolIcon.tsx`, compone `/icons/tool-<slug>[-sm].png`) | hub `/tools` e pagine `app/tools/[tool]` |
| `market-result/-goals/-scorer/-soft/-betslip` | `MarketIcon` (`components/MarketIcon.tsx`) | `MatchDetailSheet` (tab mercati) |

Il vecchio set verde/oro resta recuperabile da git (`git show HEAD:public/icons/<nome>.png`); i master 1254² nuovi sono in `docs/reference/round4/src-icons/` (untracked, come gli altri master).

**Badge totem** — `public/badges/totem-<nome>.png` (128²) + `totem-<nome>-sm.png` (48²), 12 totem. Master in `docs/reference/round4/src-badges/`.

## Helper di mappatura — `lib/ui/totem-assets.ts` (+ `totem-assets.test.ts`)

- `TOTEMS` (ordine = contratto, cambiarlo cambia il badge di tutti): `bolt · star · oak` (lime `#C8FF3D`) · `wolf · tower · anchor` (sky `#7FC4FF`) · `wave · comet · eagle` (yellow `#FFD84A`) · `mountain · moon · diamond` (ivory `#F5F2E9`).
- `totemIndex(team, sport)` = FNV-1a 32 bit su `"<sport>:<team>"` normalizzato (lowercase, trim, spazi collassati) `% 12` → indice nella tabella. Stessa chiave di `crest-assets.ts`, così se un giorno `CREST_MAP` si popola, `Crest.tsx` può fare: crest reale → altrimenti totem → mai più lo scudo tinto.
- `totemFor(team, sport, { avoid })` → `{ name, color, hex, src, srcSm }`; con `avoid` uguale al proprio totem passa al successivo.
- `totemPair(home, away, sport)` → i due totem di una partita, garantiti diversi. **È la funzione da usare nella card.**
- Test: determinismo, normalizzazione, copertura di tutti i 12 indici su 400 nomi, coppie sempre distinte, e presenza su disco dei 24 PNG.

Wiring per ui-andrea (non fatto qui): in `components/ui/Crest.tsx` il ramo senza `url` rende `<img src={totem.srcSm|src}>` al posto dello `<svg>` scudo; le iniziali, se servono, in overlay CSS (Saira Condensed) — non nel PNG.

## Cambio di Andrea (in corso d'opera): via la tile Esports, dentro «More sports» (coming soon)

- `sport-esports.png`/`-sm.png` restano in `public/banners/` ma **non vanno più usati come tile dedicata** (asset disponibile per un uso futuro, niente da wirare).
- Nuova tile «More sports»: `public/banners/sport-more.png` + `-sm.png` (320²/64², alpha), generata con `gptimg` in coda alla catena: **calcio + tennis + basket intrecciati** con gli stessi anelli orbitali arancio — i tre sport che copriamo, così «altri sport» non promette discipline che non abbiamo.
- Ripiego a costo zero, già in produzione: `public/banners/sport-allsports.png`/`-sm.png` (commit `6fde8a05`, stesso trattamento). Non promosso come prima scelta perché il cluster contiene **football americano e baseball**, fuori perimetro prodotto (stessa ragione per cui il 21/09 sono stati scartati due banner Codex). Se il nuovo `sport-more` non convince, questo è pronto senza generare nulla.
- Riga finale: Football (prod) · Tennis (prod) · Basketball (round 4) · More sports (round 4, coming soon).

## Verdetto sul set icone completo (20/20, visti a 200 e 32px: `_check-icons-batch1.png`, `_check-icons-batch2.png`, `_check-icons-32px.png`)
Tutte accettate al primo colpo tranne `market-result`, rifatta come chiesto (due pannelli casa/trasferta + spunta lime in rilievo: legge «esito», non «toggle»). Le più piccole a 32px sono la lancetta lime di `menu-history` e il pallone di `market-scorer`: si distinguono, ma se in UI il posto è ≤20px conviene la `-sm` con un pizzico di padding in meno. Derivati scritti in `public/icons/` (320² + `-sm` 64²) sopra i vecchi nomi: `git status` li mostra come modificati, il set verde/oro resta in git.

## Verdetto sui totem (visti a 200 e 40px: `_check-badges-batch1.png`, poi `_check-badges-40px.png` completo)
`anchor · comet · eagle · oak · star · tower` accettati al primo colpo, coerenti con `bolt · wolf · wave`: stessa targa, un colore per simbolo, leggibili a 40px. Controllo marchi fatto simbolo per simbolo: araldica generica, nessuno riproduce un crest reale specifico (l'aquila è una testa di profilo stilizzata, non l'aquila intera dei club che la usano; ancora/stella/torre/quercia/cometa non sono associabili a un singolo club). Gli ultimi tre (`mountain · moon · diamond`, ivory) sotto.

## Chiusura seconda consegna (2026-09-22, 12:20)
- `sport-more-src.png` → `public/banners/sport-more.png` (320²) + `sport-more-sm.png` (64²): calcio + basket + tennis intrecciati, anelli sottili come gli altri; riga finale a 64px in `_preview-sport-row-final.png` — legge «mix di sport» anche piccolo. Accettato; `sport-allsports.png` resta il ripiego non usato.
- Ultimi tre totem `mountain · moon · diamond` accettati (foglio completo `_check-badges-40px.png`). Libreria 12/12 in `public/badges/`, test `lib/ui/totem-assets.test.ts` 7/7 verde (compresa la presenza su disco dei 24 PNG).
- Totale generato in questo round con `gptimg`: 3 hero + 4 sport (basket, 2 controller, more) + 21 icone (20 + market-result scartata) + 12 totem = 40 immagini, tutte viste una per una prima di derivarle.
