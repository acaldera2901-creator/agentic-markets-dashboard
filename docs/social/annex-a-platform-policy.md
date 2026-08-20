# Allegato A — Regole di piattaforma su gambling/betting

Verificato il 2026-08-10. Questo allegato è la prova dietro il verdetto in testa al `README.md`.

## A.1 — YouTube (fonte primaria, letta integralmente)

Fonte: [Illegal or regulated goods or services policies — YouTube Help](https://support.google.com/youtube/answer/9229611?hl=en)

Citazioni verbatim ottenute dalla pagina:

**Non consentito:**
- «Facilitating access to an online gambling or sports betting site that is not certified.»
- «Promising the viewer guaranteed returns via online gambling, regardless of whether the site is certified or not.»

**Soggetto a limite d'età (18+):**
- «Content that facilitates access to, promotes, or depicts online gambling, and social/sweepstakes casinos, **including content from certified sites**.»

**Regola generale sui link:**
- «Don't post content on YouTube if it aims to directly sell, link to, or facilitate access to any of the regulated goods and services listed below.»

**Eccezione:**
- «content featuring sports betting from Google-certified providers or promotion of Google-certified online gambling sites during the course of a live sporting event, may be allowed.»

### Cosa significa per BetRedge

1. **Il canale è ammesso**, ma i video che promuovono/mostrano gambling online sono **age-restricted anche se il sito è certificato**. L'age-restriction è la parte costosa: il video esce dai contesti logged-out e incorporati, e la distribuzione si restringe.
2. **Il rischio di rimozione non è il contenuto del modello: sono i link.** BetRedge ha 8 partner affiliati LIVE (Stake, Roobet, GG.BET, FortunePlay, Velobet…). Se un video, la descrizione o il canale portano a uno di questi e il book **non è Google-certified**, si cade dentro «facilitating access to … a site that is not certified» — che è nella lista dei *non consentiti*, non degli age-restricted.
3. **Catena indiretta da chiarire:** linkare `betredge.com`, che a sua volta ospita `/partners` con link affiliati ai book, è una catena indiretta. La policy vieta «facilitate access to», formula che copre anche l'accesso indiretto. **Non l'ho risolta e non posso risolverla io**: è la stessa domanda aperta del progetto `project_gambling_qualification` (conferma legale "VIA A non-gambling", rischio #1 del go-live). Va sciolta dall'avvocato **prima** di pubblicare, non dopo.
4. «Promising guaranteed returns» è già vietato dalla regola FTC interna del prodotto: su questo siamo allineati per costruzione.

## A.2 — TikTok

### Advertising (fonte primaria, letta integralmente)

Fonte: [Gambling and Games — TikTok Advertising Policies](https://ads.tiktok.com/help/article/tiktok-ads-policy-gambling-and-games)

- «Gambling ads are only allowed in specified markets where gambling is legal and when all local certifications and requirements are met.»
- «you must go through our certification process» e «provide documents that prove your licenses and legal compliance in your target market.»
- «Ads must be restricted to age-appropriate audiences; we do not allow gambling ads to be shown to minors.»
- Vietati gli «ads that promote unlicensed or illegal gambling services».

Conseguenza: **la promozione a pagamento su TikTok è di fatto chiusa a BetRedge** finché non esiste una licenza di gambling nel mercato target — e BetRedge sta cercando di qualificarsi come *non*-gambling, quindi non avrebbe quella licenza. Le due posizioni sono in tensione: non si può insieme dire "non siamo gambling" e certificarsi come gambling advertiser.

### Contenuto organico — EVIDENZA PARZIALE (dichiarato)

Le Community Guidelines di TikTok sono una SPA: la pagina non si è resa né via WebFetch (contenuto troncato, 2 tentativi) né via `curl` (2,5 MB di HTML scaricati, **zero** occorrenze della stringa "gambl" — il testo è reso lato client). Il budget di 6 WebFetch si è esaurito qui.

Quello che ho è ricavato dagli **snippet di ricerca delle pagine ufficiali** — non dal testo integrale della pagina:

- «Content showing or glamorizing gambling or gambling-like activities is restricted (18 years and older).» — [Regulated Goods and Commercial Activities](https://www.tiktok.com/community-guidelines/en/regulated-commercial-activities)
- «TikTok doesn't allow trading, marketing, or providing access to regulated, prohibited, or high-risk goods and services.» — stessa pagina
- Definizione: gambling = «betting money (including digital currencies) on an event with an uncertain outcome for financial gain»; le "gambling-like activities" includono social casinos e software correlato.
- [Youth Safety](https://www.tiktok.com/community-guidelines/en/youth-safety/) — contenuto age-restricted

**Livello di confidenza:** medio-alto sul senso (18+ e divieto di "providing access"), **basso sulla lettera esatta**. Il punto che resta non verificato e che decide se TikTok vale la fatica: **se un contenuto age-restricted su TikTok sia ancora eleggibile alla For You feed.** Se non lo è, TikTok perde il suo unico motore di crescita e il profilo diventa una vetrina inerte. → azione: **1 WebFetch in una sessione futura**, o verifica diretta dalla app.

## A.3 — Discord

Nessuna policy di piattaforma che vieti la discussione di scommesse fra adulti. I vincoli reali sono altrove e sono operativi, non normativi: vedi Allegato C (obbligo di moderazione permanente) e i gate di Boost per banner e URL personalizzato.

## A.4 — Il vincolo che vale su tutte tre

L'age-restriction non è un adempimento burocratico, è una **tassa sulla distribuzione**: riduce reach e monetizzazione su YouTube e TikTok. Un piano di crescita costruito assumendo reach piena su queste due piattaforme è sbagliato in partenza.
