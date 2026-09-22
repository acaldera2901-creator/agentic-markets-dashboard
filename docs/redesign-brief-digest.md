# BetRedge — Redesign Brief (digest)

Fonte completa: `/Users/calde/Downloads/BetRedge_Redesign_Brief_for_Claude.pdf` (13 pagine). Questo digest basta per lavorare; andare al PDF solo se serve un dettaglio non qui.

## North Star
Trasformare BetRedge da dashboard tecnica a sports intelligence discovery experience: più immediata, più sportiva, più leggibile, più capace di convertire tramite valore/fiducia/abitudine.

Core path: **Discover → Understand → Trust → Save → Return → Upgrade**

Non è un reskin. È: prima IA/navigazione/hierarchy, poi componenti, poi visual design.

## Principio fondamentale: discovery before configuration
Prima: dashboard → filtri → contenuto. Card enorme con quasi tutta l'analisi. Linguaggio "Model Probability".
Dopo: contenuto rilevante → curiosità → spiegazione → strumenti. Card compatta come teaser, analisi completa solo al click. Linguaggio centrale: **Model vs Market → Edge → Why**.

## Modello mentale (ispirazioni, cosa copiare / non copiare)
- Sportsbook/casino lobby: rapid discovery, categorie immediate, live, starting soon, preferiti.
- SofaScore: sport-first, leggibilità, team/player context, scansione rapida.
- Bloomberg/Analytics: gerarchia numeri, confronto, rigore quantitativo.
- Netflix: For You, Recently Viewed, discovery orizzontale, personalizzazione.
- **Copiare**: IA, lobby, categorie, ricerca, preferiti, recently viewed, live indicators, rapid discovery.
- **NON copiare**: urgenza artificiale, countdown manipolativi, flashing CTA, fake scarcity, "guaranteed winner", pattern compulsivi, notifiche aggressive.

## Information Architecture — nuova struttura
Nav primaria: **Home/Discover · Live · Football · Tennis · Tools**
A destra: Search, Watchlist, Account. History/Pricing/Invite/Partner/Creator/Language/Settings vivono in Account o "More". Niente doppia nav persistente (navbar + sidebar).

Home come lobby, sezioni in quest'ordine:
Top Opportunities · Live Now · Starting Soon · High Edge · Football · Tennis · Why the Model Disagrees · For You · Recently Viewed · Watchlist · Tools/Probability Builder.

Regola: ogni schermata ha UNA domanda dominante — Home: "cosa vale la pena guardare?" · Match: "perché il modello pensa questo?" · History: "quanto è stato affidabile?" · Pricing: "cosa ottengo pagando?"

## Prediction card — "one card = one decision", capibile in 2-3 secondi
Riga minima: MODEL | MARKET | EDGE | ACTION (es. 64% | 52% | +12% | View analysis).
Contenuto minimo: league+kickoff/live status, Team A vs Team B, Pick, Model Probability, Market Probability, Edge, badge contestuale (High Edge/Live/Starting Soon/Featured), CTA "View analysis".

Progressive disclosure:
- Livello 1 — Discovery card (quello sopra).
- Livello 2 — Quick Analysis: reasoning, form, injuries, xG, market movement.
- Livello 3 — Deep Analysis: statistiche e storico avanzato.

## Psicologia utente (usare, non manipolare)
Curiosità (mostrare gap Model vs Market e lasciare la domanda "perché?"), riduzione sforzo (le migliori opportunità subito, ogni click con esito prevedibile), competenza (spiegazioni chiare, non "convincere"), controllo (watchlist/filtri/tool/confronti), prova sociale (track record pubblico verificato), progressione (free→preview→analisi→watchlist→habit→upgrade), ritorno (live/starting soon/watchlist/aggiornamenti = motivi reali per tornare).

## Conversione free→paid
Upgrade arriva DOPO che l'utente ha percepito utilità e incontra un limite reale, mai banner generico.
- Free: Model, Market, Edge + short explanation reali (non finti).
- Locked preview: full injury analysis, market movement, advanced model breakdown.
- CTA contestuale: "Unlock full analysis" (mai popup casuale).
- Se apre Live: spiegare che gli aggiornamenti live sono Pro.
- Pricing orientato all'outcome: "Understand the model" / "Find more opportunities" / "Use the full research platform".
Sequenza psicologica: "Capisco cosa guardo" → "Il modello vede qualcosa di diverso" → "Voglio capire perché" → "Qui posso analizzare tutto" → "Pro mi dà più profondità".

## Landing e Match page (le due pagine che fanno la maggior parte del lavoro)
**Landing above the fold**: headline "See where the model disagrees with the market." · subheadline: model probability, market probability, real difference, clear reasoning · CTA primaria "Explore today's picks" · CTA secondaria "See how it works" · prediction reale/realistica visibile direttamente nella hero · proof subito sotto (settled picks, verified %, historical hit rate, con contesto).

**Match page**: header match + pick grande · Model/Market/Edge molto evidenti · Confidence come indicatore secondario · "Why the model likes this pick" (3-5 motivazioni) · Recent form · Model vs Market movement · Injuries/Team News · Similar picks/Historical performance con metodologia chiara.

## Direzione visiva
Più sport, meno terminal. Più gerarchia, meno micro-rumore.
- Dark mode: premium, immersivo, live, sportivo (modalità principale).
- Light mode: editoriale, leggibile, analitico.
- Palette: **Indigo/Black** (superfici dark) · **Beige/off-white** (superfici light) · **Royal Blue** (struttura, tabs, selected state, link) · **Light Blue** (dati secondari, market, charts) · **Neon Green** (edge positivo, CTA primaria, upgrade — ACCENTO) · **Neon Yellow** (live, featured, starting soon, attenzione — ACCENTO).
- **Importante**: Neon Green e Neon Yellow sono SOLO accenti, mai fill globali. "Se tutto è evidenziato, nulla è evidenziato."
- Tipografia: sans-serif moderno per titoli/testo body. Monospace SOLO per quote, statistiche, date, label tecniche. I numeri devono dominare le label (numeri grandi/pesanti, label piccole/leggere).

## Mantenere vs cambiare/ridurre
**Mantenere (identità)**: posizionamento quantitativo, Model Probability, Market Comparison, Edge, Explainability/Why, Public History/Track Record, Tools, Probability Builder, dark+light mode, brand green.
**Cambiare/ridurre**: sidebar persistente + doppia nav, monospace ovunque, card enormi, bordi e micro-label eccessivi, filtri above the fold, banner scollegati dal task, densità visiva, descrizioni tecniche lunghe, UI che sembra più terminal che sport, verde usato come accento universale (va riservato).

## Design system — componenti riutilizzabili (sistemico, non pagina per pagina)
PredictionCard (varianti: Compact/Featured/Live/PremiumLocked) · MatchHeader · ProbabilityComparison · EdgeBadge · ConfidenceIndicator · SportChip/LeagueChip/LiveBadge · WatchlistButton · AnalysisCard/StatsPanel · PricingCard · TrackRecordCard · ToolCard · LockedFeature/UpgradeCTA.

Mobile: bottom navigation Home/Explore/Watchlist/Tools/Profile. Card diventano verticali ma Model/Market/Edge restano sempre nello stesso ordine.
Spacing scale: 4/8/12/16/24/32/48/64. Corner radius card: 8-12px. Ombre leggere. Dark mode: contrasto soprattutto tra superfici e border sottili (non luce/ombra pesante).

## Ordine di implementazione consigliato (dal brief)
1. **Home/Discover lobby** — IA, card system, filtri, watchlist, tono generale.
2. **Prediction card + Match detail** — loop primario di scoperta→comprensione.
3. Mobile experience.
4. Track Record.
5. Pricing + upgrade states.
6. Tools/Probability Builder.
7. Profile/Invite/Partner.

Criterio di successo (non "sembra più bello"): card→detail CTR, predictions viewed/session, watchlist save rate, signup rate, free→paid conversion, D1/D7/D30 retention, search success rate.

## Scope di QUESTO round (deciso in sessione 2026-09-21)
Prima preview: solo priorità **1 e 2** (Home/Discover lobby + Prediction card/Match detail), col nuovo design system (palette/tipografia/token) applicato a queste pagine, mobile-aware. Il resto (Track Record, Pricing, Tools, Profile) resta per un round successivo dopo che Andrea ha visto e deciso sulla preview.

---

## ROUND 2 — feedback di Andrea dopo aver visto la preview (2026-09-21, stesso giorno)

Verdetto: **"ok ma non ok"** — direzione giusta, esecuzione visiva troppo timida/quant. Andrea ha condiviso 2 immagini generate con ChatGPT (salvate qui in `docs/reference/ref-01-hero-lobby.png` e `docs/reference/ref-02-mockup-board.png`) come riferimento visivo primario: **guardale prima di scrivere codice**, contano più di questo testo per tono ed energia.

### 1. Palette — deve essere esattamente questa (lista di Andrea, verbatim)
Indigo · Royal blue · Light blue · Neon yellow · Neon green · Beige · Black.

Il problema del round 1 non era la lista dei ruoli (era già questa) — era la **saturazione/energia**: troppo editoriale-quant, non abbastanza "sportsbook vivo". Guardando `ref-01`: il dark mode è un **blu royal/navy acceso** (non indigo-quasi-nero), i badge LIVE sono **giallo neon pieno** (non un accento tenue), "High edge"/edge positivo è **verde neon pieno con glow**, i bordi delle card hanno un filo blu luminoso. Vai più vivido di quanto il round 1 abbia fatto — resta la regola "gli accenti neon non sono fill di intere sezioni", ma i badge/CTA/numeri edge possono e devono essere molto più accesi.

### 2. Hero banner nuovo in Home (da `ref-01`, in cima, sopra "Featured predictions")
Banner largo, non una semplice fascia di token: foto reale/action-shot di un atleta (calciatore) integrata nel banner con gradiente, non un semplice colore piatto. Contenuto: eyebrow "AI POWERED PREDICTIONS", headline grande a due righe con una parola/frase evidenziata in verde neon ("Top opportunities **today**." / variante "See the **value**. Make better decisions."), sottotitolo breve, riga di pill con contatori reali (Live now · Starting soon · High edge), CTA primaria piena in giallo/verde neon ("Explore today's picks →"). A destra: box con checklist di 4-5 value prop ("Models vs market probabilities", "Real edge, real opportunities", "Covers football, tennis & more", "Build your own accumulator", "Trusted by...") — **il numero "Trusted by 100K+ bettors" nell'immagine è un placeholder di ChatGPT, NON un dato vero: se non abbiamo quel numero reale, non lo mettiamo (mai claim non verificabili — vedi regole FTC/claim nel CLAUDE.md aziendale). Sostituire con qualcosa di vero o ometterlo.**

Non serve costruire un carosello/rotazione di banner in questo round — un banner statico ma ben fatto, in tema, basta.

### 3. Sezioni lobby aggiuntive viste in `ref-01` (oltre a quelle già fatte nel round 1)
- **Featured predictions**: 3 card grandi con foto/crest reali delle squadre/giocatori, badge "High edge" o "Value pick" in alto a destra della card.
- Riga di **tile per categoria sport**: Football, Tennis, Basketball, Esports, "More sports", e una tile promozionale **"Build your own accumulator"** che rimanda al Probability Builder/Tools esistente. Se non c'è pipeline dati per Basketball/Esports, NON inventare picks — tile con badge "Coming soon"/contatore assente, mai numeri finti (stessa regola del round 1).

### 4. Via la landing page iniziale — accesso diretto al prodotto, anche senza account
Decisione esplicita di Andrea: **eliminare la landing page marketing come porta d'ingresso**. Chi arriva su `/` deve entrare direttamente nella Home/lobby del prodotto (quella di cui sopra), non in una pagina di vendita. Deve funzionare **anche da anonimo/senza login**, mostrando i dati reali della fascia free — non la versione azzerata/bloccata vista nel round 1 (bug `MODEL 0%`, sezioni che non rendono da logged-out). Coerente con la sezione "Conversione" di questo stesso digest: il free deve mostrare Model/Market/Edge **reali**, solo l'analisi profonda (injury report completo, market movement, deep stats) resta dietro paywall — mai un muro totale prima di aver visto valore.
Attenzione SEO: `app/page.tsx` oggi porta canonical + FAQ JSON-LD della vecchia landing (`landing-client.tsx`, 1182 righe). Non va distrutto alla cieca: la nuova Home-prodotto su `/` deve conservare i segnali SEO essenziali (FAQ schema, meta description, canonical) — se il modo più semplice è tenere il contenuto informativo/FAQ più in basso nella pagina o spostarlo su una pagina informativa dedicata linkata da "How it works", va bene, ma va deciso con criterio e dichiarato nel report, non cancellato in silenzio.

### 5. Cose viste in `ref-02` (mockup board) utili ma NON tutte per questo round
Light mode (pannello 3), match detail con tab Overview/Model/Stats/Lineups/H2H/News + card "Why this pick?" con badge di confidence (pannello 4), pricing Free/Base/Pro con toggle Monthly/Yearly (pannello 5), track record con barre settimanali (pannello 8) — utili come riferimento di stile per quando si arriverà a quelle pagine, ma **priorità di questo round resta**: palette/energia visiva corretta, hero banner, sezioni lobby di `ref-01`, rimozione della landing. Match detail a tab completo, pricing e track record restano al giro successivo se il tempo non basta — dichiararlo, non abbozzarlo male.

### Scope esplicito ROUND 2
Must: palette più vivida (indigo/royal-blue/neon come da `ref-01`), HeroBanner nuovo, sezioni Featured/sport-tiles/accumulator-tile in Home, root `/` che porta dritto al prodotto anche da anonimo con dati free reali (fix del bug MODEL 0% incluso). Nice-to-have se avanza tempo: match detail a tab, light mode allineata a `ref-02` pannello 3, pricing/track record. Bug già noti dal round 1 da fixare in questo passaggio: flash nav in inglese per utenti non-EN (SSR/CSR mismatch), stringhe fisse EN nei componenti condivisi (almeno le più visibili: "Pick"/"Model"/"Market"/"View analysis"/badge).

---

## ROUND 3 — "non deve sembrare AI" (2026-09-22)

Verdetto di Andrea sul round 2: **"non mi piace, non deve sembrare AI, abbiamo questo problema che sembra tutto troppo AI slop, abbiamo bisogno di un cambio drastico"**. Richiesta esplicita: **tutte le icone personalizzate**. Riferimento dato: `https://www.awwwards.com/websites/` — "prendi spunto il più possibile da questi siti per capire cos'è e cosa non è AI [slop]".

### Cosa ho guardato su awwwards e cosa dice (ricerca fatta in sessione, non delegata)
Prima pagina di "Winning websites" (Site of the Day, i migliori siti del mondo secondo loro). Pattern ricorrenti nei siti in vetrina in questo momento, osservati a schermo:
- **Tipografia enorme e sicura come elemento grafico primario**, non solo gerarchia di testo — headline che occupano mezzo schermo, spesso in serif/sans molto carattere, sovrapposte a immagini invece che stare "sopra" in un box separato (es. "The First The Last": titolo enorme sovrapposto a un bagliore/aberrazione cromatica; "Noho": wordmark gigante centrato, minimale, quasi solo tipografia).
- **Texture reale, non gradiente pulito**: grana pellicola, aberrazione cromatica, materiali fotografati per davvero (legno, tessuto intrecciato, erba, marmo) invece di sfondi navy-gradient-glow generati — è probabilmente IL motivo per cui il nostro hero (foto AI di un calciatore su navy con glow) legge come "slop": è esattamente il template più comune della generazione AI.
- **Illustrazione/3D con una direzione precisa e riconoscibile**, non un render generico: es. "Pensatori Irrazionali" — nastri/oggetti 3D isometrici disegnati apposta, fotografati in una scena reale (fiori, colonna), non "atleta stock su sfondo sfocato".
- **Navigazione minimale e sicura di sé**: es. "Gil Huybrecht" — poche label in maiuscolo piccolissimo, tanto spazio vuoto, una griglia di thumbnail come sistema di navigazione. Il contrario di riempire ogni pixel con badge/pill/glow.
- **Palette contenuta**: monocromia + un solo accento deciso, o toni caldi/terrosi smorzati — non "verde neon + giallo neon + blu royal + gradiente" tutti insieme (il nostro rischio attuale).
- Studio/designer di riferimento visti in vetrina in questo momento, tutti noti per un linguaggio riconoscibile e non genererico: **Locomotive, basement studio, Resn, MONOGRID, Unseen Studio, Neutral Studio, HOLOGRAPHIK** — utile studiarne 1-2 direttamente per il trattamento di micro-interazioni/hover/cursore, che è un'altra cosa che distingue "fatto da chi ha gusto" da "template AI".

### Cosa significa per BetRedge, concretamente
1. **Icone**: via qualunque icona da libreria generica (lucide-react, i glifi attuali in `components/ui/glyphs.tsx`/`SportIcon.tsx`/`Crest.tsx` dove sono segnaposto). Serve un **sistema di icone custom disegnate apposta** — coerenti tra loro (stesso peso di tratto, stessa griglia, stesso angolo di taglio/chamfer se lo stile lo prevede), non 10 stili diversi. Copre: nav (Home/Live/Football/Tennis/Tools), bottom-nav mobile (Home/Explore/Watchlist/Tools/Profile), sport chip/tile, watchlist (bookmark), edge/confidence indicator, badge live/featured/high-edge, eventuali icone dei tool (odds converter, EV calculator, probability builder).
2. **Ripensare l'hero fotografico**: la foto "atleta fotorealistico generato da AI su sfondo navy con glow" è probabilmente essa stessa il problema, non la soluzione — è il pattern più riconoscibile di "immagine fatta da un generatore". Considerare alternative con più carattere: illustrazione/3D con una direzione grafica precisa (non fotorealismo), oppure tipografia enorme come protagonista invece della foto, oppure texture/materiale reale se si usa fotografia.
3. **Meno badge/glow ovunque, più gerarchia tipografica vera**: il neon va bene come accento isolato (resta valido dal brief originale), ma se ogni card ha bordo luminoso + glow + badge colorato, il risultato è "tutto evidenziato" — esattamente il rischio che il digest originale aveva già segnalato ("se tutto è evidenziato, nulla è evidenziato"), solo che il round 2 lo ha rispettato meno di quanto sembrasse in anteprima.
4. **Palette**: restano i ruoli semantici già validati (Model/Market/Edge, verde=edge positivo, giallo=live), ma valutare se ridurre la saturazione/contemporaneità di TUTTI gli accenti insieme — un solo accento dominante per schermata invece di verde+giallo+blu sempre tutti presenti.

### Scope ROUND 3
Non è un altro giro di feature — è un **cambio di linguaggio visivo** sopra quello che già esiste (IA, componenti, wiring dati restano quelli dei round 1-2, che Andrea non ha contestato nella sostanza). Partire da: (a) sistema di icone custom completo, (b) revisione della direzione arte (hero, texture, densità di badge/glow, palette per schermata) con riferimento diretto ai pattern osservati su awwwards, (c) applicazione chirurgica ai componenti esistenti — non un rebuild da zero.

### Direzione d'arte ROUND 3 — Art Director, 2026-09-22 (da applicare: ui-andrea)

Diagnosi in una riga: il round 2 non è «troppo timido», è **troppo pieno**. Foto AI di atleta + gradiente navy + glow verde + glow giallo + filo lime + bordo luminoso, tutti insieme in ogni card e nell'hero: è il template più comune dei generatori, e l'occhio lo riconosce prima di leggere una parola. Il rimedio non è «più minimale» in astratto: sono le cinque decisioni qui sotto, ognuna con un prima → dopo.

**1. Icone — `components/ui/icons.tsx` (fatto, 25 segni, verificato a 16/20/24/32px dark+light).** Un sistema solo al posto dei tre che si sommavano (`glyphs.tsx` a 2px round · sprite `app/components/sport-glyphs.tsx` a 1,5px con coral · PNG 3D `menu-*.png` nel bottom-nav). Firma: griglia 24, tratto 1,75, punte **piatte** e giunti a **spigolo** (le librerie generiche hanno tutte punte tonde — è quello che fa «template»), **il taglio** a 45° in alto a sinistra su ogni forma chiusa (lo smusso delle schede prediction e di `GlyphRank`), una sola faccia piena per icona in `currentColor`. Copertura: nav (`home live football tennis tools`), bottom-nav (`home explore bookmark tools profile`), sport (`football tennis basketball esports more` + `IconSport`), stato (`star edge confidence clock trend ledger lock stack`), azioni (`search arrow check chevronDown chevronRight close`). `IconBookmark`/`IconStar` hanno `filled`. Registro `ICONS`/`Icon name=`.
Sostituzioni (ui-andrea): `br-nav__item` → icona 18px prima della label (oggi solo testo + puntino giallo `::before`, che va tolto: il live si dice con `IconLive`, non con un secondo colore); `am-bottomnav` → `Icon` 22px al posto di `MenuIcon` PNG; `SportChip`/`SportCategoryTile` → `IconSport`; `WatchlistButton` → `IconBookmark filled={saved}`; badge `high-edge` → `IconEdge` 12px + testo; `featured` → `IconStar`; `br-search` → `IconSearch`; `GlyphLock/Arrow/Check/Clock/Stack` → equivalenti `Icon*` (stesso nome). `glyphs.tsx` e lo sprite restano finché l'ultimo uso non è migrato, poi si cancellano; i PNG `menu-*.png` escono dal bottom-nav subito (sono il pezzo più «AI» della barra).

**2. Hero — via la foto dell'atleta. La tipografia È l'immagine.** Concept verificato in `docs/reference/round3/hero-concept-desktop.png` e `-mobile.png` (HTML sorgente accanto, coi token veri).
- Headline in **Saira Condensed 800** (già caricata come `--font-tech`, zero font nuovi), maiuscolo, `clamp(56px, 8vw, 104px)`, interlinea 0,88, tracking −0,015em, max 13ch → 3 righe. È la voce del prodotto; una sola parola in lime. Copy: la headline già validata dal brief («Where the model **disagrees** with the market.») o «Top opportunities **today.**».
- Sotto la headline, i tre numeri veri (Live now · Starting soon · High edge) come **striscia di cifre tabulari a 40px**, senza pill, senza bordo, senza puntino luminoso: label mono 11px sotto il numero. Solo il numero High edge è lime.
- Sfondo: **materiale reale in duotone navy**, mai una scena. Due texture concept generate con AD scritta (macro di pelle di pallone con cucitura diagonale · erba con riga di calce), in `docs/reference/round3/hero-tex-*.png`. Sono **concept**: prima di andare in prod vanno sostituite da una foto reale dello stesso soggetto (un pallone sul tavolo, luce radente, macro — Andrea o Michele con il telefono bastano) o da uno stock con licenza, e trattate con lo stesso duotone. Velo: gradiente lineare navy 92% → 15% da sinistra a destra + 85% → 0 dal basso; **grana** via `feTurbulence` SVG a opacità 7% (pesa zero, non si ripete).
- **Zero glow**: niente `box-shadow` lime, niente `::before` filo verticale, niente `text-shadow`. Una sola CTA piena, lime con inchiostro `#0B1400`, con il taglio in alto a sinistra via `clip-path` (la firma anche sul bottone). La secondaria è outline bianco al 28%.
- La scatola dei value prop a destra sparisce dall'hero: i punti veri vanno nella sezione «How it works» più in basso, non a fianco della headline.
- Fallback senza asset (e su telefono ≤640): variante B solo tipografica su `--am-panel` con una riga di calce disegnata (2px, −7°). Stessa struttura, nessuna immagine.

**3. Densità — la regola operativa (sostituisce «gli accenti sono solo accenti»).**
- **Un accento dominante per schermata**, deciso dalla domanda della pagina: Home → **lime** (edge/opportunità); vista Live → **giallo**; match detail → **lime** sul solo numero edge; Tools/Profile → **royal**, nessun neon. Gli altri neon in quella schermata scendono a testo (nessun fill, nessun glow): il LIVE in Home è testo giallo + `IconLive`, non un badge pieno con alone.
- **Per card: al massimo UN elemento colorato oltre al testo.** Nella compact è il numero edge; nella featured è la CTA piena (e l'edge torna bianco); nella live è il minuto giallo. Badge `high-edge`/`featured`/`starting-soon` diventano **outline monocromi** (`--am-line-2` + testo `--am-muted`) con la loro icona: il significato lo dà la parola e il segno, non un terzo colore.
- **Glow: zero, ovunque.** Cancellare `--am-edge-glow`, `--am-live-glow`, `--am-royal-glow`, `--am-edge-text-glow` da `design-system.css` (11 usi: 5 edge, 3 royal, 2 edge-text, 1 live) e i `radial-gradient` di `.br-hero`, `.br-promo`, `.br-card__media::after`. La profondità la fanno le superfici (`panel` / `panel-2` / `panel-3`) e il bordo a 1px — come già scritto nel brief originale («contrasto tra superfici, non luce/ombra pesante»).
- **Bordi: 1px `--am-line`, e basta.** Nessun bordo lime/giallo su card o tile (`.br-promo` incluso: il verde resta solo su icona e freccia). Il filo blu «luminoso» delle card di `ref-01` non si replica.

**4. Tipografia come gerarchia, non i badge.** Titoli di fascia (`.br-sec__title`) da 19px/700 Hanken a **Saira Condensed 800, 26px, maiuscolo** — la stessa voce dell'hero, così la firma attraversa la pagina. Il contatore della fascia resta mono 12px. Le label mono maiuscole restano a 11px ma con `letter-spacing .12em` uniforme (oggi oscillano tra .05 e .22em).

**5. Cosa NON cambia.** Palette (indigo/royal/sky/lime/edge/live/beige), ruoli semantici Model/Market/Edge, IA e sezioni della lobby, componenti e wiring dati dei round 1-2, i test esistenti. Il light mode segue le stesse regole con i suoi token già mappati.

Ordine di applicazione per ui-andrea: (1) nav + bottom-nav con le icone e senza PNG → (2) hero variante A con texture concept e variante B mobile → (3) togliere glow/gradienti/bordi colorati e ridurre i badge a outline → (4) titoli di fascia in Saira. Ogni passo con screenshot 1280 e 390, dark e light, prima di dichiararlo fatto.

---

## ROUND 4 — feedback duro di Andrea sul round 3 (2026-09-22, poco dopo la notifica)

Verdetto: **"fa cagare"**. Punti precisi, non un rifiuto generico:

### 1. Hero — sbagliato nella forma, non solo nel contenuto
- **Quadrato**, non largo. **Decisamente più piccolo**: non deve occupare nemmeno metà schermo.
- La foto dentro deve essere **più accattivante e più nel nostro stile** — l'hero tipografico-su-texture del round 3 non basta, serve un'immagine vera che sia bella, non solo "non fotorealistica generica".
- **Nello spazio vuoto che resta di fianco all'hero (ora piccolo)**, mettere già le prediction card — il primo schermo deve mostrare prodotto, non solo un banner.
- Causa dichiarata da Andrea: **l'art director deve sfruttare molto meglio il collegamento con Codex** per la parte grafica — "usata bene, la piattaforma può prendere totalmente un altro aspetto". Non è un'opzione, è il motivo per cui quel collegamento esiste.

### 2. Prediction card — "troppo confusionarie" (screenshot allegato: le card con MODEL 44%/MARKET 36%/EDGE +7.7% e barra di confronto)
- **La percentuale mostrata è SOLO la nostra (il modello)** — niente Market%, niente Edge% sulla card. Un solo numero, il nostro, non tre dati da confrontare.
- Nota di chi scrive (da riconciliare con l'identità originale del prodotto, non decisione mia): il brief originale aveva "Model vs Market → Edge" come cuore del linguaggio a Livello 1. Interpretazione più sensata finché Andrea non corregge: **il confronto Model/Market/Edge non sparisce dal prodotto, si sposta al Livello 2 (View analysis / match detail)** — la card di scoperta mostra solo la nostra pick e la nostra percentuale, pulita; chi vuole il confronto lo trova aprendo l'analisi. Se questa lettura è sbagliata, Andrea lo dirà.
- **Tutte le icone e i loghi su ogni card vanno fatti fare dalla parte grafica di Codex**, per avere immagini/icone uniche — non più badge/crest generici.
  - **Attenzione legale, già misurata su questo stesso progetto (round 2, swoosh Nike)**: `lib/ui/crest-assets.ts` ha `CREST_MAP` **vuota** — zero loghi ufficiali di squadre reali nel prodotto oggi, ogni crest è un placeholder a scudo tinto proceduralmente. Generare via Codex "il logo vero" di club reali (Inter, Real Salt Lake, ecc.) è un rischio marchio identico a quello già trovato con Nike — Codex tende a riprodurre marchi reali se glielo chiedi esplicitamente. La strada sicura: badge **originali/distintivi** (non copie di loghi ufficiali) in uno stile coerente e riconoscibile come "nostro", generati/rifiniti con Codex, oppure — se si vogliono loghi reali — quella è una questione di licenza/pipeline dati separata (già segnalata come "aperta" nel codice), non qualcosa che si risolve generando immagini.

### 3. Icone generali (screenshot allegato: la riga Football/Tennis/Basketball/Esports/Build your own accumulator) — bocciate di nuovo
- Le icone SVG flat create da art-director nel round 3 **non vanno bene per Andrea** — non è la stessa cosa lamentata nel round precedente (quelle erano PNG/pallini generici), qui è il flat-vettoriale-minimale stesso a non convincere.
- Chiesto: farle personalizzate **o usare quelle personalizzate che già abbiamo**.
- **Scoperta rilevante fatta in sessione**: esiste già in `public/icons/` un set di icone **PNG 3D glossy, verde/oro, molto ornato** (`menu-prediction.png` = sfera di cristallo su base dorata, `menu-tools.png` = calcolatrice verde/oro lucida, e altre ~20 per menu/tool/market) — uno stile distintivo e già "brandizzato" verde BetRedge. **Il round 3 li ha tolti dal bottom-nav dichiarandoli "il pezzo più AI della barra"** — possibile che sia esattamente lo stile a cui Andrea si riferisce con "quelle personalizzate che già abbiamo". Conflitto reale tra i due giudizi, non deciso da chi scrive: la lettura più prudente è che questo stile ornato-3D-verde/oro **è** il linguaggio "nostro" a cui Andrea allude, e va **esteso** (nuove icone sport football/tennis/basketball/esports nello stesso trattamento, generate via Codex per coerenza) invece di sostituito con SVG flat minimali — ma va verificato con lui se possibile, non assunto in modo definitivo.

### Chiarimento di Andrea sullo stile icone (dopo una domanda diretta)
Verificato coi file veri prima di chiedere: `public/icons/menu-*.png` `tool-*.png` `market-*.png` (verde/oro lucido 3D, es. sfera di cristallo, calcolatrice) sono un set che Andrea **non ricordava esistesse** — decisione: **rifarli da zero** (nuovo brief per art-director/Codex, non un'estensione). Le icone SPORT invece sono un caso diverso: Andrea ha allegato 2 screenshot (pallone da calcio e pallina da tennis con effetto fiamma rosso/arancio avvolgente, tile arrotondata scura) che **coincidono esattamente** con asset già in produzione su `origin/main`: `public/banners/sport-football.png`/`-sm.png` e `sport-tennis.png`/`-sm.png` (esiste anche `sport-allsports.png`/`sport-worldcup.png`, nessun basketball/esports). Decisione: **tenere questi per Football/Tennis nella sport-tile**, non i PNG Higgsfield del round 2 (`public/images/sport-tiles/tile-*.png`, mai wired) né le SVG flat del round 3 (`IconSport`, quelle NON sono state contestate esplicitamente da Andrea per la nav/bottom-nav — solo per la riga sport-tile). Basketball/Esports non hanno un equivalente in produzione: da generare via Codex nello stesso trattamento (pallone/controller + fiamma rosso/arancio, stessa tile scura arrotondata) per coerenza visiva della riga.

### Piano ROUND 4 (dopo chiarimento)
1. **Hero**: quadrato, ≤50% larghezza schermo, foto "più accattivante, più nel nostro stile" generata via Codex/`gptimg` (non il duotone-texture-tipografico del round 3, quello è bocciato) — a fianco, nello spazio libero, prediction card vere (non spazio vuoto).
2. **Sport-tile**: swap a `sport-football.png`/`sport-tennis.png` di produzione; Basketball generato da Codex nello stesso stile (pallone + fiamma), stessa dimensione tile arrotondata scura. **Aggiornamento 2026-09-22 pomeriggio**: niente tile "Esports" dedicata — al suo posto una tile **"More sports" (coming soon)** con icona mix-di-sport (più football/tennis/basket sovrapposti), stesso trattamento visivo. Riga finale: Football · Tennis · Basketball (coming soon) · More sports (coming soon) · Build your own accumulator.
3. **Menu/tool/market icon set** (verde/oro attuale): rifatto da zero via Codex — nuovo brief di stile, non estensione. Copertura minima per questo round: solo dove effettivamente visibile nella superficie restylata (menu Account/Tools se presente, non l'intero inventario se non usato).
4. **Prediction card**: mostrare SOLO la percentuale del modello (nostra), niente Market/Edge a schermo (spostati, non cancellati, al Livello 2/match-detail — interpretazione dichiarata ad Andrea, non ancora confermata). Loghi/badge sulla card generati via Codex, **mai loghi ufficiali reali di squadre** (rischio marchio identico al caso Nike) — badge originali/distintivi in uno stile coerente.
5. Nav/bottom-nav (icone SVG flat del round 3): non toccate in questo giro, Andrea non le ha contestate.

### Asset ROUND 4 — consegna completa di art-director (2026-09-22, pomeriggio)
Tutto già in `public/` del worktree, pronto per il wiring (percorsi esatti, mapping completo in `docs/reference/round4/NOTE.md`):
- **Hero**: `public/images/hero/hero-square.jpg` (960², desktop) + `hero-square-480.jpg` (480², ≤640px) — pallone che si dissolve in mesh dati blu/lime. Quadrato, va reso ≤50% larghezza schermo, con prediction card vere nello spazio a fianco (non vuoto).
- **Icone menu/tool/market**: **già sovrascritte in place** in `public/icons/` (stessi nomi/dimensioni) — `MenuIcon`/`ToolIcon`/`MarketIcon` le pescano automaticamente, **non serve wiring di codice per queste**. `market-result` rifatta (due pannelli + spunta lime).
- **Badge squadra**: libreria di 12 totem in `public/badges/totem-*.png` (+`-sm`) + helper NUOVO `lib/ui/totem-assets.ts` (`totemFor`, `totemPair`, testato). **Serve wiring**: in `components/ui/Crest.tsx` il ramo senza `url` (oggi rende lo scudo SVG tinto) va sostituito con `<img src={totem.srcSm|src}>` da `totemFor(team, sport)`. Non toccare `crest-assets.ts`/il resto di `Crest.tsx`.
- **Sport-tile**: `public/banners/sport-basketball.png`/`-sm.png` nuovo, e **`sport-more.png`/`-sm.png`** nuovo (football+basket+tennis intrecciati, stesso stile fiamma) sostituisce la tile Esports per richiesta di Andrea. Riga finale: Football (prod, invariato) · Tennis (prod, invariato) · Basketball (nuovo) · More sports (nuovo, coming soon). **Non usare** `sport-esports.png` (resta su disco ma fuori uso) né `sport-allsports.png` (contiene football americano/baseball, fuori perimetro sport del prodotto).

### Cosa manca ancora per chiudere il round 4 (wiring + un pezzo di prodotto non ancora toccato)
1. Wiring dei 4 asset sopra (hero, badge/Crest, sport-tile) nei componenti reali.
2. **Prediction card semplificata**: mostrare SOLO la percentuale del modello (pick + %, niente Market/Edge a schermo su questa card) — Market/Edge spostati al Livello 2 (match detail), non cancellati dal prodotto (interpretazione dichiarata ad Andrea, mai corretta finora — procedere così finché non dice altro).
3. Layout Home: hero piccolo+quadrato a sinistra (o dove ha senso), prediction card reali nello spazio libero a fianco invece di spazio vuoto/sotto.

### Wiring ROUND 4 — fatto (2026-09-22, programmatore)
I quattro punti sopra sono wirati nel prodotto. Cosa è cambiato davvero:
- **Hero**: `HeroBanner` è quadrato (`aspect-ratio: 1`, `max-width: 420px` **sul componente**, non sulla colonna — a board vuota si rende da solo e senza il cap tornava a tutta larghezza), immagine `hero-square.jpg` + `-480.jpg` via srcset. Il velo duotone del round 3 non c'è più; l'immagine è **specchiata** (`scaleX(-1)`) perché il pallone chiaro stava sotto il testo allineato a sinistra. Via il sottotitolo di tre righe (non entra nel quadrato); restano eyebrow, headline, i tre numeri veri, le due CTA.
- **Layout Home**: nuova riga `.br-home-top` — quadrato a sinistra (30%, cap 420px), a destra la **prima fascia della lobby** con 2 card vere (di norma «Top opportunities»; se non esiste, quella che c'è). La fascia salita non si ripete sotto e tiene il suo «Vedi tutte». Sotto i 1080px si impila.
- **Card livello 1**: solo `modelPct`, grande, con l'etichetta «Our model». Via `ProbabilityComparison` dalla card (resta, invariata, nella scheda partita) e via la nota «no market price yet», che parlava di un numero non più a schermo. Il badge «High edge» **resta**: è una parola, non un numero.
- **Badge squadra**: `Crest` usa i totem; i due chiamanti con due squadre (`PredictionCard`, `MatchHeader`) passano da `totemPair` così non collidono. Lo scudo tinto resta solo senza nome squadra. `crest-assets.ts` non toccato.
- **Sport-tile**: raster `/banners/sport-*-sm.png` su **tutte e quattro** (football e tennis compresi: erano ancora sulle SVG flat del round 3, e una riga metà raster metà vettoriale non stava in piedi). Esports → **More sports**. `SportCategoryTile` marca l'icona `data-kind="raster"`, che nel CSS toglie disco e bordo — i PNG sono ritagliati e il cerchio li tagliava.
- **Non committati di proposito**: `sport-esports.png`/`-sm.png` (fuori uso), i master in `docs/reference/round4/` tranne `NOTE.md`, gli hero PNG del round 2 (3–4 MB l'uno) e i `public/images/sport-tiles/` mai wirati.
- **Debito segnalato, non toccato**: la tile Tennis con 0 partite scrive «0 picks today» (`count: tennisItems.length`, mai `null`) — difetto del round 2, fuori dal perimetro di questo giro. E `public/images/hero/hero-tex-leather-1400w.jpg` è rimasto in git pur essendo ora senza consumatori (citato in `docs/ui_memory.md`).

## ROUND 5 — "sito di merda", scoperto il vero problema (2026-09-22 pomeriggio)

Andrea, guardando la preview round 4: bocciature puntuali + una scoperta strutturale mia prima di rispondere.

### Feedback puntuale (4 screenshot)
1. **Nav in alto**: icone e colori da sistemare — il toggle DARK/LIGHT mostra ancora il verde brand vecchio (`#23A559`), fuori dalla palette royal/lime del round 3-4; le icone nav vanno verificate contro lo stesso sistema.
2. **Home**: via il bottone "REFRESH ODDS LIVE" in alto a destra. Le prediction card vanno **rimpicciolite, tutte alla STESSA dimensione**, e nella prima schermata all'ingresso l'utente deve vederne **di più** (oggi solo 2 a fianco dell'hero).
3. **"View analysis" apre il sito vecchio con lo stile vecchio.**
4. **Chip lega/sport** (badge "⊛ FOOTBALL", "🎾 TENNIS" visti su filtri/card) — icone da sistemare con quelle fatte da Codex, non quelle attuali.

### La scoperta (verificata nel codice, non un'impressione)
Il punto 3 non è un bug isolato: **`app/app/page.tsx` monta due esperienze diverse a seconda della vista** — `view === "explore"` renderizza `<SportsbookBoard>` (il vecchio board con filtri/sort/ricerca, **mai toccato in nessuno dei 4 round**), qualunque altra vista renderizza `<HomeLobby>` (quello restylato). Si arriva a `SportsbookBoard` cliccando "Football"/"Tennis" in nav, "See all", "Explore" da bottom-nav — cioè **quasi ogni percorso oltre la primissima schermata**. È esattamente perché il round 1 aveva dichiarato "il board di sempre — filtri, sort, ricerca — resta intatto sotto Explore", scelta corretta per lo scope di allora (priorità 1+2 del brief) ma che oggi, con la Home bella, rende il resto del sito uno stacco netto e brutto.

### Messaggio di fondo di Andrea (ripetuto, ora con urgenza): 
**"Bisogna togliere tutto quello che è rimasto del sito vecchio e fare il restyling completo, non a metà."** Motivo dichiarato: deve mostrare il restyle ai collaboratori, non vuole arrivarci con "un sito di merda" — c'è una scadenza sociale/temporale reale dietro, non solo gusto estetico.

### Piano ROUND 5
**Fase A — fix puntuali, veloci** (nav colori/icone, via bottone refresh, card home uniformi/più piccole/più numerose in prima schermata, chip sport con icone Codex `sport-football-sm.png`/`sport-tennis-sm.png` invece delle SVG round-3).

**Fase B — `SportsbookBoard` (il vero blocco)**: è la superficie più usata del prodotto (tutto ciò che sta oltre la teaser Home) ed è rimasta interamente non restylata — filtri, ricerca, sort, card, tutto vecchio stile. Va portata al linguaggio dei round 3-4: `PredictionCard` (quella nuova, già esistente) al posto delle card vecchie, palette/tipografia/icone coerenti su filtri e controlli. Non serve reinventare componenti — riusare quello che i round precedenti hanno già costruito, il lavoro qui è di wiring/applicazione su scala, non design da zero.

**Fase C — resto del sito** (Track Record, Pricing, Tools/Probability Builder, Profile/Invite/Partner/Creator/Weekly Pick/Leaderboard/Match Builder): oggi tutti fuori scope dichiarato dei round 1-4, tutti probabilmente ancora vecchio stile. Da confermare con un giro di ricognizione prima di promettere tempi ad Andrea — non fingere che sia una coda breve se non lo è.

### Messaggio di fondo di Andrea (da tenere per ogni round successivo)
"Questa piattaforma deve essere unica e non deve essere AI slop, abbiamo collegato Codex appunto per questo, per creare qualcosa di unico da offrire alle persone. Ci stiamo mettendo tempo, denaro e persone: la piattaforma deve essere più custom e personalizzata possibile, ma nello stesso momento intuitiva e facile da capire per chi arriva."

### ROUND 5 — fatto (2026-09-22, programmatore)

**Fase A — Home.** Il segmento attivo di DARK/LIGHT passa da `--am-coral` a
`--am-royal-2`/`--am-royal-ink`; le altre icone nav erano già sul sistema
(royal/muted) e restano. Via «REFRESH ODDS · live» dalla testa della Home, e
con lui `handleRefresh`/`refreshing`, che non aveva altri usi — le prediction
si rileggono da sole ogni 60 minuti. Le card della lobby sono TUTTE della
stessa dimensione: la lobby non chiede più la variante `featured` (due colonne,
numero a 52px); `live` e `premiumLocked` restano perché non cambiano la
scatola. E rimpiccioliscono: padding 16→12, gap 12→8, numero 40→30px, colonna
minima 302→248px, `HERO_SIDE_CAP` 2→6 — su 1280 sono sei card sopra la piega
invece di due. Il chip sport usa i raster `/banners/sport-*-sm.png` (fallback
SVG per gli sport senza raster).

**Fase B — `SportsbookBoard`.** `PredictionCard` (calcio) e `TennisMatchCard`
disegnavano da sé `headerNode`/`readoutNode`/`bodyNode` — ~580 righe di
`.pred.hud`/`.v2r`/`.da-*`, rimosse — e ora rendono `PredictionCard` del design
system via `fromDeskFootball`/`fromDeskTennis`. Quote per esito, «Piazza la
scommessa» e mercati extra NON spariscono: vivono nella scheda-dettaglio, che i
due componenti continuano a possedere e che «View analysis» apre (su riga
chiusa la CTA è «Unlock full analysis» → gate). Del vecchio `cardProps` resta
solo il `ref`, che misura da dove si apre la scheda. Watchlist anche sul board
(`useWatchlist` una volta per board). Filtri/sort/ricerca: via coral e pannello
azzurrino, tipografia sui token; bande Football/Tennis in Saira Condensed
maiuscolo, glifo senza il disco che tagliava il PNG; griglia da 12 colonne
fisse ad `auto-fill` 248px, la stessa misura della Home. `BestBetsBoard` non
toccato: non ha call site.

**Fase C — resto del sito, alla radice.** `--am-coral` valeva ancora #23A559 in
scuro e lo rendevano tutte le viste non restylate: ora `--am-coral` È
`--am-edge` (#3DF56E). In chiaro non cambia nulla, i due token erano già lo
stesso #137437. Tre punti pagavano bianco su fill verde (crollavano a ~1,6:1)
e passano a `--am-coral-ink`. L'h1 del desk — uno per pagina, quindi Piani,
Storico, Classifica, Invito, Build a Probability View, Explore e Today insieme
— prende la voce della casa (Saira Condensed 800 maiuscolo), come le teste di
sezione dei Piani e dello Storico; l'eyebrow diventa la label del design
system. Via l'ultimo alone: `.featured::before`.

**Fase B-bis — i due blocchi in mezzo al board.** `FeaturedEdge` era un
pannello con fotografia di scena, velo a gradiente, alone radiale e angoli
smussati: ora è un pannello piatto del design system (`--am-panel`, bordo 1px),
struttura interna invariata. Conseguenza sistemata: quel pannello era scuro in
entrambi i temi, quindi una decina di regole forzavano testo bianco — in tema
chiaro «Arsenal vs Chelsea» e «PICK LOCKED» erano bianco su bianco, visto allo
screenshot e rimesso sui token. La `WeeklyPickPromo` era un creativo 16:9 col
titolo, l'atleta e il pulsante cotti dentro l'immagine: riscritta nel TSX come
pannello nativo — icona `/icons/menu-weeklypick.png` del round 4, titolo in
Saira Condensed, copy in cinque lingue, CTA «View this week's pick».

**NON fatto, dichiarato.** Il LAYOUT delle viste di Fase C non è toccato —
Classifica e Invito sono Tailwind grezzo, `TrackRecordView` si inietta il
proprio `<style>` `tr-*`, `MatchBuilderTab` è `mb-*`: sono viste da rifare a
vista, una per una, non da riskinnare alla cieca. Restano old-style nella
struttura `AccountMenu` (`acct-*`) e il bottom-nav (`am-bottomnav`).
E resta il debito del round 4: la tile Tennis con 0 partite scrive «0 picks
today».
