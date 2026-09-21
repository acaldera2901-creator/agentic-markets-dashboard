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
