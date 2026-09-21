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
