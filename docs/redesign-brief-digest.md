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
