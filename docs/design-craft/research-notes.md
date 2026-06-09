# Research Notes — fonti e verifiche per la Design Bible

Appendice di [`design-bible.md`](./design-bible.md). Output grezzo della ricerca
multi-agente del **2026-06-09**: 5 track di ricerca paralleli, ognuno sottoposto a
**verifica adversariale** (un fact-checker indipendente incaricato di *refutare*
attribuzioni, date, autori, fatti). Tutti i 5 track sono tornati
`confirmedSolid: true`. Qui sotto: le fonti citate per track + le **correzioni**
della verifica (già recepite nella bible) + gli **angoli mancanti** segnalati
(anch'essi recepiti come guardrail).

Workflow: `design-craft-study` (run `wf_7898a119-785`), 10 agenti, ~459k token,
123 tool use (web search/fetch), ~7 min.

---

## Track 1 — Heritage grafico pre-AI

**Tesi:** prima del digitale ogni grafica era un impegno irreversibile e costoso
(tipo fisico, ritaglio a coltello, una lastra per colore). La scarsità ha prodotto
la disciplina. Due poli — razionalismo svizzero vs opposizione espressiva — entrambi
risposte al vincolo. I rule-breakers avevano prima interiorizzato le regole.

**Fonti chiave:**
- Müller-Brockmann — Wikipedia · quote "grid is an aid, not a guarantee" (Goodreads) · *Grid Systems* (designopendata)
- Armin Hofmann 1920–2020 — Poster House · Cooper Hewitt "A Harmony of Contrasts" · Giselle (peoplesgdarchive)
- Helvetica — Wikipedia · Neue Haas Grotesk (madegooddesigns, fontbureau) · Max Miedinger — Wikipedia
- Brodovitch — Britannica · Smashing Mag "Inspired Design Decisions" · The Art Story
- *The Vignelli Canon* (PDF ufficiale RIT) · Vignelli — Wikipedia · NY Transit Museum · MoMA subway map
- Lubalin — Wikipedia · Graphéine "the letter as image" · Avant Garde (madegooddesigns) · designishistory
- Glaser/Push Pin — Smithsonian (Dylan poster) · Wikipedia · Graphéine · Cooper Hewitt
- Saul Bass — Wikipedia · Sotheby's (Vertigo) · Medium FGD1 (Anatomy of a Murder) · CreativePro
- Paula Scher — Pentagram (bio + Public Theater) · blakecrosley · Artsy
- Carson/Brody — designishistory (Ray Gun) · AIGA 2014 medalist (Carson) · interviste Medium
- Lissitzky — Britannica · DailyArt (Red Wedge) · Royal Academy · CreativePro
- Tschichold — Wikipedia · MoMA · blakecrosley · ilab.org (Bauhaus→Penguin)
- Bauhaus/Bayer Universal — encyclopedia.design · keboto · Letterform Archive
- Vincolo stampa/spot color — Adobe (spot vs process) · VSL Print · Seattle Print Works · Printing Partners

**Correzioni della verifica (recepite):**
1. Poster *Beethoven* di Müller-Brockmann = **1955** (non 1950). La serie Tonhalle
   corre negli anni '50; l'esempio nominato è 1955.
2. Vertigo (Saul Bass + John Whitney): figure di **Lissajous** da meccanismo a
   pendolo, **non "spirograph"** (giocattolo metà anni '60, anacronistico).
3. Mappa metro NYC 1972: prodotta a **Unimark** sotto direzione Vignelli — mappa con
   **Joan Charysyn**, segnaletica con **Bob Noorda** (l'attribuzione popolare a
   Vignelli resta standard).
4. Logo Citi (Scher): arco rosso che lega **i puntini di "Citi" sopra la "ti"**
   (~1998), non "unisce t e i".

**Angoli mancanti (recepiti come caveat nella bible):**
- La tesi "impegno fisico irreversibile" è fortissima per l'era letterpress/svizzera,
  più debole per l'opposizione anni '70–'90: Lubalin/ITC e Carson lavoravano già in
  fotocomposizione / su Mac. Le legature strette di Lubalin furono *abilitate* dalla
  pellicola.
- "I maestri hanno rotto le regole solo dopo averle interiorizzate" è vero per
  Scher/Glaser/Carson ma non è legge assoluta: punk/DIY/grunge erano deliberatamente
  non addestrati e funzionavano.

---

## Track 2 — Typography & grid craft

**Tesi:** la differenza tra tipo "progettato" e "default-AI" sta in decisioni che
non c'entrano col "scegliere un font carino": measure, leading accoppiato a
size/measure, gerarchia da ≥3 leve, pairing con contrasto vero, baseline grid,
micro-tipografia (small caps reali, letterspacing dei caps, hanging punctuation).

**Fonti chiave:**
- Butterick, *Practical Typography* — Summary of key rules · Line length
- Bringhurst, *The Elements of Typographic Style* — riassunto regole (inkwell.ie)
- Müller-Brockmann, *Grid Systems* (PDF archive.org) · IxDF "Grid Systems"
- Smashing "Typographic Hierarchies" · Toptal "Typographic Hierarchy"
- Fonts.com / MyFonts Fontology "Mixing Typefaces" · 99designs · Viget (superfamilies)
- Vignelli "govern the grid / lion cage" — O'Reilly *Best Practices for Graphic Designers* (cap. Grids)
- Samara, *Making and Breaking the Grid* (PDF)

**Correzioni della verifica (recepite):**
1. Il framework **concordance / contrast / conflict** è della pedagogia **Fonts.com
   Fontology / Rob Carter** (*Typographic Design: Form and Communication*), **NON
   Bringhurst** — appiccicargli il nome dà falsa autorità.
2. La citazione Bringhurst verbatim è solo *«Choose faces that suit the task as well
   as the subject»* (§6.2.1); il resto ("honor and elucidate…") è parafrasi, da
   tenere fuori dalle virgolette.
3. **Grokipedia** (enciclopedia AI-generata) scartata come fonte; le stesse regole
   Bringhurst sono confermate da webtypography.net e inkwell.ie.

**Angoli mancanti (recepiti):**
- **WCAG**: 1.4.8/1.4.12 → line-height body ≥ **1.5**, spazio paragrafi ≥ 2× font.
  Rinforza il leading ed è requisito legale/usabilità.
- **`ch` ≠ media caratteri**: l'unità CSS `ch` = advance width del glifo "0";
  `66ch` è approssimazione (di solito ci stanno *più* caratteri).
- L'intero canone è **tipografia latina occidentale**: non si trasferisce pulito a
  CJK/arabo (measure-in-caratteri, leading ratios, small caps, italic-emphasis).

---

## Track 3 — Color & composizione

**Tesi:** colore e composizione separano "designed" da "generated". Failure mode
AI = timidezza travestita da gusto (gradiente viola, palette equidistribuita,
simmetria morta, densità uniforme). Antidoto = intenzione: ogni colore/posizione/
vuoto deve essere difendibile come decisione.

**Fonti chiave:**
- Albers, *Interaction of Color* (Yale) · Bagtazo (relatività) · colorwithleo
- prg.sh "Purple Gradient" · Kai Ni (Medium) · shapeof.ai (color patterns)
- Gestalt — Figma Resource Library · IxDF · Maze · Netguru · Lazarev
- Smashing "Compositional Balance: Symmetry/Asymmetry" · Number Analytics · UXPin
- Focal point/hierarchy — Toptal "12 Principles of Design" · StudioBinder · Piktochart
- Negative space/figure-ground — Superside · University of Arkansas (pressbooks)
- Ripetizione/ritmo — Noun Project · Prezentium · Uxcel

**Correzioni della verifica (recepite):**
1. La frase *«Dominant colors with sharp accents outperform timid, evenly-distributed
   palettes»* è reale ma è del **system prompt del Cookbook di Anthropic** (citato
   dall'articolo prg.sh), non un'analisi originale del blogger. *(Rafforza il punto:
   è una linea-guida vendor, non un'opinione.)*
2. Gestalt: scuola **fondata 1912** (Wertheimer, fenomeno phi); i principi maturano
   negli anni '20. "anni '20" ok per i principi, tardo per la nascita.
3. **Freccia FedEx = figure-ground / negative space**, non closure. Closure
   canonica: panda WWF / triangolo di Kanizsa. IBM a strisce = closure/continuità ok.

**Angoli mancanti (recepiti come guardrail forte):**
- **Conflitto Albers ↔ WCAG**: "calibra in contesto / sembra giusto su near-black"
  è pericoloso se porta sotto soglia. Guardrail: la relatività governa l'estetica,
  ma la leggibilità ha pavimenti misurabili — **4.5:1** testo, **3:1** large/UI.
- **CVD** (~8% uomini): palette su solo-hue fallisce → guidare col **value contrast**
  (ragione dura, non solo estetica).
- **Dark mode**: un accent calibrato su bianco può fallire/cambiare significato su
  superficie scura.

---

## Track 4 — Anatomia dell'AI slop

**Tesi:** lo slop è "nessuno ha sovrascritto i default". Meccanismo: i modelli
predicono il pattern più comune nel training (Tailwind indigo-500 + Inter + token
shadcn). Wathan si è scusato nel 2025. 15 tell catalogati (vedi tabella §4 bible).

**Fonti chiave:**
- **Adrian Krebs, "AI Design Slop"** (Developers Digest) — audit deterministico
  Playwright su 500 landing Show HN, 15 pattern con frequenze DOM. *Fonte più rigorosa.*
- prg.sh "Purple Gradient" (meccanismo token-prediction + origine Tailwind)
- DEV "Blame Tailwind's Indigo-500" (apologia Wathan 2025) · jackpearce
- **Claude Cookbook: "Prompting for Frontend Aesthetics"** — blocklist font, contrasto
  peso/size estremo, dominant+accent, single motion moment, layered backgrounds
- NN/g "Glassmorphism" (critica evidence-based: contrasto, performance)
- Medium design-bootcamp (critica shadcn; "Inter strips brand soul") · tweakcn
- Creative Bloq (Corporate Memphis morto) · aesthetics.fandom (Corporate Memphis)
- **PMC12827715** (peer-reviewed): loop AI immagine→immagine convergono a ~12 motivi
  "commercially safe" — "visual elevator music"
- Aceternity/Magic UI docs (bento) · 925studios (guida slop)

**Correzioni della verifica (recepite — numeri importanti):**
1. Audit Krebs corretto: **heavy = 22%** (soglia **4+** pattern, non 5+), some = 32%
   (2–3), **clean = 46%** (0–1). La ricerca aveva soglia sbagliata e aveva etichettato
   il bucket medio come "clean".
2. *"Inter is the Helvetica of the LLM era"* **non è di Krebs** (verificato sul post):
   è un trope di community ("Inter is the new Helvetica"), precedente al discorso
   slop. Il contributo reale di Krebs: "Inter for everything" = pattern #1.
3. "Fingerprint" non è il termine di Krebs (lui dice "patterns"). Verbatim suo:
   colored left-border *«almost as reliable a sign of AI design as em-dashes for text»*.
4. **Space Grotesk**: il Cookbook **non** lo mette nella blocklist hard (Inter/
   Roboto/Open Sans/Lato/system); lo segnala come **convergence trap** e lo
   *consiglia* per code aesthetic. Due tier diversi, da non confondere.
5. Corporate Memphis = sistema **"Alegria"** di **Facebook** (agenzia **BUCK, 2017**).

**Angoli mancanti (recepiti come nota di onestà nella bible §4):**
- Distinguere tell **evidenziati con dati** (Krebs DOM-frequency; paper PMC;
  NN/g accessibilità) da tell **asseriti** da singoli practitioner (radius uniforme,
  fade-up, copy placeholder, bento). 
- Il loop "AI si addestra su siti AI" è **ipotesi plausibile**, non dimostrata per la
  UI: il tweet Wathan è una battuta, il paper PMC riguarda i loop *immagine*. Causa
  asserita, non dimostrata.

---

## Track 5 — Web craft human-made

**Tesi:** il filo di ogni sito distintivo è che un umano ha **deciso** e si sente.
Editorial-web, small/indie web (Chimero), studi da award (Active Theory, Locomotive),
brutalismo come reazione. La sensazione handmade viene da un POV forte applicato con
coerenza + il lavoro ingrato che quasi nessuno fa (foto reale, illustrazione custom,
motion coreografato, personalità tipografica, stati vuoti/error curati).

**Fonti chiave:**
- **Frank Chimero, "The Web's Grain"** — il web come materiale con grana propria
  (edgeless, fluido, modulare); design *con* la grana, non print-spectacle forzato
- magCulture + Wikipedia (Turley/Bloomberg Businessweek) · designboom
- Wabi-sabi web — Silphium Design · Matcha Design · A List Apart "Elegance of Imperfection"
- Brutalismo — DesignMantic · HubSpot · Oliver Revelo
- Corporate Memphis — aesthetics.fandom · Creative Bloq · illustration trends 2025
- Motion — Awwwards (Active Theory Developer Site of the Year; Locomotive case study)
- Tipografia/voce brand — Brands That Punch · Holabrief · CID Creative (humanized 2026) · Creative Bloq
- Stati nascosti/microcopy — UX Writing Hub · Medium (Idoko) · Raw Studio
- POV/sistema — Pentagram (TwelveLabs) · subarnopaul (Pentagram review) · The Brand Identity · It's Nice That (Mozilla "Nothing Personal")

**Correzioni della verifica (recepite):**
1. **Turley / Bloomberg Businessweek = redesign del MAGAZINE A STAMPA** (aprile 2010),
   non un sito. Tenerlo come **esempio print le cui lezioni *trasferiscono* al web**,
   dicendolo esplicitamente. Premi (SPD Magazine of the Year 2012; Creative Review
   Design Studio of the Year 2013) sono per il prodotto *print*.
2. Active Theory Developer Site of the Year = **2016** (progetto "Paper Planes");
   Locomotive = Site of the Month per il self-site "Reinventing Locomotive".
3. Mozilla "Nothing Personal" = guidato da **Natasha Jen / Pentagram, 2025**.

**Angoli mancanti (recepiti):**
- Origine brutalismo sottocitata: **Pascal Deville, brutalistwebsites.com (2014)**,
  termine in voga ~2016; sua definizione: *«a reaction to the lightness, optimism and
  frivolity of today's web design»*.
- **Accessibilità e performance come segnali di craft**: una tesi "un umano ha
  deciso" che loda grana/texture/motion pesante/type custom è incompleta senza
  `prefers-reduced-motion`, HTML semantico, contrasto, peso di caricamento — *sono*
  segnali "un umano ci ha tenuto". Il motion coreografato deve degradare con grazia
  per reduced-motion, o legge come autoindulgenza.

---

*Per le citazioni con URL completi, vedi l'output del workflow `wf_7898a119-785`.*
