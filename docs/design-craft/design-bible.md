# Design Bible — Craft contro AI slop

> Knowledge base dell'agente `ui-andrea`. Lo "studio profondo" su come si facevano
> le grafiche prima dell'AI, cosa rende un sito *AI slop*, e come progettare
> interfacce che leggano come **human-made** — fatte da qualcuno che ha **deciso** —
> pur restando moderne e davvero belle.
>
> Product-agnostic: i principi valgono per qualsiasi progetto. Le fonti sono in
> `research-notes.md` (ricerca multi-agente verificata adversarialmente, 2026-06-09).
> Terminologia di design lasciata in inglese dove è lo standard.

---

## 0. Come usare questo documento

`ui-andrea` lo legge come **base teorica** prima di ogni task di design non
banale, e ne applica la **§5 (checklist anti-slop)** come gate operativo prima
di dichiarare finito qualunque UI. Non è una collezione di trend da copiare: è
un sistema di **giudizio**. La regola sintetica, da tenere sempre in testa:

> **Lo slop non è bruttezza. È l'assenza di una decisione.**
> Se una scelta avrebbe potuto essere il default del framework, non è ancora
> una scelta di design.

---

## 1. Manifesto — cosa significa human-made

Prima degli strumenti generativi, ogni grafica era una **serie di impegni
irreversibili e costosi**. Il tipo si componeva fisicamente, una foto si
ritagliava col taglierino, ogni colore in più era una lastra di stampa separata
da pagare. Niente *undo*, niente palette infinita, niente *regenerate*. **È
proprio quella scarsità ad aver prodotto la disciplina che oggi leggiamo come
gusto.** Il designer doveva decidere *prima* di impegnarsi, e ogni elemento
doveva guadagnarsi il posto.

Lo schermo ha azzerato il costo di "aggiungere una cosa in più" — ed è
esattamente quel "gratis" che fa sembrare l'output generico. Un modello (o un
designer pigro) produce *slop* perché predice il pattern statisticamente più
comune e **non diverge da nessuna parte**. Un essere umano con un brief, un
brand e un'opinione, divergerebbe da qualche parte.

**Human-made** quindi non vuol dire amatoriale, "fatto a mano male", o
nostalgico. Vuol dire: *si sente che qualcuno ha deciso.* Intenzionalità
visibile in ogni livello — tipografia, griglia, colore, composizione, motion,
copy, e perfino negli stati vuoti.

Le due grandi tradizioni del '900 sono **entrambe** risposte al vincolo, ed
entrambe insegnano la stessa lezione:

- **Razionalismo svizzero** (la griglia, l'oggettività, l'ego del designer
  soppresso al servizio del contenuto): *sottomettiti a un sistema*.
- **Opposizione espressiva/eclettica** (Push Pin, Lubalin, Scher, Carson,
  Brody): *fai esplodere il sistema — di proposito*.

Nota cruciale: i grandi che hanno **rotto** le regole (Scher, Carson, Glaser)
le avevano prima **interiorizzate**. Il loro "caos" è composto. Si rompe la
griglia solo dopo averla posseduta. (Caveat onesto: esistono eccezioni — il
punk/DIY e parte del grunge erano deliberatamente non addestrati e funzionavano
lo stesso. La regola "disciplina prima" è una guida fortissima, non una legge
storica assoluta.)

---

## 2. The heritage — i maestri e la lezione di ognuno

Non per citarli, ma per **rubare la disciplina**. Ogni voce: cosa hanno fatto →
cosa rubare oggi.

### Le radici avant-garde

- **Costruttivismo russo — El Lissitzky & Rodchenko.** *Beat the Whites with the
  Red Wedge* (1919–20) riduce una guerra civile a un cuneo rosso che perfora un
  cerchio bianco: argomento politico come pura geometria. Lettere trattate come
  oggetti visivi — diagonale, contrasto di scala violento, palette forzatamente
  minimale (rosso/nero/bianco). **Ruba:** una sola idea geometrica eseguita con
  economia estrema comunica più di mille decorazioni. Prima di aggiungere, chiediti
  qual è *la forma irriducibile* del messaggio. Diagonale e contrasto di scala
  creano energia che un layout centrato e uniforme non avrà mai.

- **Bauhaus & De Stijl — Herbert Bayer.** L'alfabeto *Universal* (1925), tutto
  minuscolo, costruito da barra e cerchio: vocabolario minimo come scelta
  razionale. De Stijl restringe tutto all'angolo retto e ai tre primari.
  **Ruba:** il vincolo come *sistema deliberato*, non come default. Un design
  system / set di token è l'"alfabeto universale" moderno — la sua forza viene
  da ciò che **vieta**.

- **Jan Tschichold — *Die neue Typographie* (1928).** Codifica la tipografia
  modernista asimmetrica in regole accessibili. Poi **rinnega il proprio
  assolutismo**, definendolo dogmatico, e torna alla tipografia classica e
  simmetrica (i Penguin). **Ruba:** scrivi le regole perché un team le applichi
  con coerenza — ma tienile larghe. Il modernista più rigoroso della sua
  generazione concluse che nessun sistema è universalmente "giusto":
  l'appropriatezza al contesto batte il dogma.

### Il canone svizzero

- **Josef Müller-Brockmann — la griglia come metodo oggettivo.** Griglie
  matematiche, flush-left/ragged-right, soggettività soppressa. I poster per la
  Tonhalle di Zurigo (serie negli anni '50; il celebre *Beethoven* è del **1955**)
  traducono la struttura musicale in geometria pura. La sua frase chiave: *«The
  grid system is an aid, not a guarantee… one must learn how to use the grid; it
  is an art that requires practice.»* **Ruba:** costruisci su una griglia reale e
  matematica (colonne, baseline, spacing modulare) — elimina il nudge a occhio e
  rende i layout *inevitabili*. Ma la griglia è impalcatura, non design: garantisce
  ordine, non qualità.

- **Armin Hofmann — Basel, form/counterform.** Poster *Giselle* (1959): danzatrice
  fotografica sfocata e morbida contro tipografia geometrica dura, bilanciata così
  finemente da "ruotare sul punto della i". **Ruba:** il negative space è un
  elemento **progettato**, non sfondo avanzato. Componi per coppie di contrasto —
  soft/hard, organico/geometrico, statico/dinamico — e cura il micro-equilibrio:
  un singolo dettaglio (un punto, un vuoto) può essere il fulcro su cui regge
  tutto.

- **Helvetica / Akzidenz-Grotesk — neutralità ingegnerizzata.** Helvetica (1957,
  come *Neue Haas Grotesk*, di Max Miedinger ed Eduard Hoffmann) è un raffinamento
  dell'ottocentesca Akzidenz-Grotesk, calibrato per texture densa e leggibilità su
  segnaletica. **Ruba:** la neutralità è *ingegnerizzata*, non accidentale — è il
  risultato di migliaia di micro-decisioni. Quando scegli un font UI per la sua
  "invisibilità", rispetta i default per cui è stato tarato (x-height, spacing);
  non combatterli con tracking arbitrario.

### I maestri editoriali

- **Alexey Brodovitch — Harper's Bazaar.** Progettava lo *spread* doppio come un
  campo dinamico unico (foto + Bodoni + white space). Metodo fisico: tutte le
  pagine stese sul pavimento dello studio per dosare il **ritmo** sull'intero
  numero. Foto off-center, sconfinanti oltre i margini. Mandato agli studenti:
  *«Astonish me.»* **Ruba:** progetta la *sequenza*, non la singola schermata.
  Disponi tutte le sezioni insieme e coreografa il ritmo — densità contro respiro.
  Tratta il "va bene così, centrato, sicuro" come un fallimento.

- **Massimo Vignelli — razionalismo e dieta di 5 font.** Design = *«the
  organization of information that is semantically correct, syntactically
  consistent, and pragmatically understandable»*; mira al *timeless*. Identità e
  mappa diagrammatica della metro di NYC (1972, prodotta a **Unimark** — mappa con
  Joan Charysyn, segnaletica con Bob Noorda). Lavorava con una manciata di
  caratteri (Helvetica, Bodoni, Garamond, Century, Futura). **Ruba:** restringi
  radicalmente il toolkit. 3–5 font e poche regole strutturali forzano la
  padronanza, danno coerenza e invecchiano meglio del rincorrere i trend.
  Ottimizza per *timeless* e *comprensibile*, soprattutto nell'information design
  (dashboard, mappe, wayfinding) dove capire è tutto il lavoro. Il suo *Canon*:
  Discipline, Appropriateness, Ambiguity, Design-in-one, Timelessness.

- **Herb Lubalin — la lettera come immagine.** "Graphic expressionism": il logo
  *Mother & Child* annida il bimbo nell'ampersand-grembo; *Families* usa "ili"
  come figure in piedi. *Avant Garde* (con Tom Carnase) e le sue legature di
  display strettissime. **Ruba:** la tipografia può *significare* — un wordmark
  porta il concetto nelle lettere stesse (negative space, legature, sostituzioni)
  invece di un'icona appiccicata. Ma quelle densità sono mosse *display*: non
  spedirle come body text. L'espressività si riserva all'unico punto dove si
  guadagna il posto.

### L'opposizione americana ed espressiva

- **Milton Glaser & Push Pin Studios — eclettismo contro l'universalismo
  svizzero.** Recupera deliberatamente *«le cose che il Modernismo ci ha insegnato
  a odiare»* — ornamento, illustrazione, narrazione, pastiche storico. Il poster
  Dylan (1967), *I ❤ NY* (1977). **Ruba:** universalismo e neutralità sono *una*
  scelta, non l'unico buon gusto. Illustrazione, riferimento storico, ornamento e
  arguzia danno personalità e memorabilità che un sistema generico non avrà mai.
  Eclettismo *con rigore* (Glaser conosceva le regole che rifiutava) = distintivo;
  fatto pigramente = rumore.

- **Saul Bass — un motivo solo su tutto il sistema.** Title sequences (Vertigo,
  Anatomy of a Murder) e logo (United, Quaker, Minolta). Metodo: distilla
  l'intero tema in **un motivo riduttivo**, poi portalo su ogni medium. (Vertigo:
  figure di Lissajous animate dal pendolo di John Whitney — *non* "spirograph",
  anacronistico.) **Ruba:** trova *il* motivo e ripetilo ovunque — favicon,
  loading, hero, OG image, motion. Una sola idea visiva riducibile, applicata con
  coerenza, è ciò che rende un'identità intenzionale e coesa. La riduzione è la
  disciplina.

- **Paula Scher — tipografia maximalista, l'anti-grid composto.** Partner
  Pentagram dal 1991. Identità del Public Theater: linguaggio tipografico
  graffitaro/da strada, rifiuto della cortesia svizzera che però **funziona come
  sistema rigoroso** su poster, segnaletica, ad. Il logo Citi (l'arco rosso che
  unisce i puntini della "ti") schizzato in pochi secondi — ma dopo decenni di
  craft interiorizzato. **Ruba:** si rompe la griglia solo dopo averla posseduta;
  il suo "caos" è maximalismo *system-driven*. Il tipo a grande scala, come texture
  e immagine, può essere l'intero design. E la lezione del napkin-sketch: la
  velocità d'esecuzione è la punta visibile di anni di giudizio accumulato —
  l'istinto *è* la disciplina, non una scorciatoia.

- **David Carson & Neville Brody — decostruzione vs costruzione, al limite della
  leggibilità.** Carson (*Ray Gun*, 1992): frammentazione, distorsione, cut-up;
  un'intervista impaginata interamente in Zapf Dingbats perché la trovava noiosa.
  Brody (*The Face*): costruisce e poi rompe **sistematicamente** i propri sistemi,
  numero dopo numero. **Ruba:** la leggibilità è una **manopola** che giri di
  proposito — ma devi sapere esattamente quando e perché la sacrifichi (Carson:
  impatto emotivo sopra la lettura letterale). E l'inverso di Brody: costruisci un
  sistema reale, poi evolvilo e disturbalo perché non invecchi mai. La
  decostruzione espressiva è l'opposto dello slop *proprio perché* ogni scelta
  "rotta" è intenzionale.

### Il vincolo della stampa, di per sé

Colore razionato dall'economia: ogni colore = un inchiostro spot + una lastra
separata, quindi tanto lavoro classico è a due/tre colori. Registro stretto come
esigenza artigianale. Processo **irreversibile**. *(Onestà storica: questo vale
soprattutto per l'era letterpress/avant-garde e svizzera. I maestri editoriali
ed espressivi degli anni '70–'90 — Lubalin/ITC, Carson sul Mac, la fotocomposizione
— lavoravano già con vincoli che si allentavano; le legature strette di Lubalin
furono **abilitate** dalla fotocomposizione su pellicola.)*

**Ruba — la lezione centrale di tutto il capitolo:** reintroduci la *frizione*
che lo schermo ha tolto. Limita la palette (tratta ogni colore come se costasse
una lastra). Giustifica ogni elemento come se non potessi fare undo. Sfrutta il
vincolo come **generatore**: il lavoro a colori limitati legge come sicuro e
intenzionale — l'antidoto diretto al look unlimited, decision-free, dell'output
generico. **Il vincolo non è l'ostacolo al craft; è il craft.**

---

## 3. The craft — principi azionabili

### 3.1 Tipografia

- **Measure (lunghezza di riga) — il fix a leva più alta.** Ideale 45–90
  caratteri (Butterick), ~66 ottimale (Bringhurst). Oltre ~90 l'occhio perde il
  ritorno a capo; è la regola più ignorata sul web perché un `div` di default
  riempie il parent. → **Vincola i contenitori di testo** con `max-width` in `ch`
  o `em` (es. `max-width: 66ch`). *Caveat tecnico:* l'unità `ch` = larghezza del
  glifo "0", **non** la media reale; `66ch` è un'approssimazione (di solito ci
  stanno più di 66 caratteri). *Slop:* prosa a tutta larghezza, 100+ caratteri/riga.

- **Leading legato a size e measure.** Body line-height 1.2–1.45; il leading
  **aumenta** con righe più lunghe. Display grande → leading proporzionalmente
  minore (1.2–1.3). Mai heading a line-height 1.0 stipati. *Floor di accessibilità:*
  WCAG 1.4.12 → body ≥ **1.5**, spazio tra paragrafi ≥ 2× la dimensione del font.
  *Slop:* un solo line-height globale dal caption all'hero.

- **Gerarchia da più di una leva.** Sei leve: spazio/prossimità, peso, dimensione,
  size+weight, colore, punteggiatura visiva (righe, forme). La *size* è la leva più
  grezza; spesso la gerarchia vera viene da **white space + posizione** (un heading
  isolato dallo spazio legge come heading anche a corpo body) e da **case + colore**.
  → Metti almeno **tre** leve in ogni livello (es. label: small + uppercase + tracked
  + muted + spazio sopra generoso). *Slop:* gerarchia espressa solo come 32/24/16px,
  stesso peso e colore.

- **Pairing con contrasto vero (concordance / contrast / conflict).** *(Framework
  della pedagogia Fonts.com / Rob Carter — non Bringhurst.)* Concordance = una
  famiglia (sicuro ma piatto); **contrast = diverso ma armonico, l'obiettivo**;
  conflict = simile-ma-non-uguale, legge come errore. Accoppia su un asse di
  differenza reale: serif body + sans display, o humanist text + geometric/grotesque
  display, con contrasto di peso e proporzione. *Slop:* Inter per heading **e** body,
  o due geometric sans quasi identici → il lettore non capisce perché ci sono "due
  font".

- **Un typeface con una VOCE vs il geometric sans ovunque.** Bringhurst (verbatim):
  *«Choose faces that suit the task as well as the subject.»* Un carattere porta un
  tono. La monocultura di neutral sans (Inter, system-ui) è *genuinamente* neutra —
  ed è esattamente perché tutto ciò che ci è costruito sopra sembra uguale e non
  dice nulla. Neutrale è legittimo per UI densa funzionale; è un fallimento usato
  come voce del brand. → Per landing/editorial/brand scegli almeno un volto con un
  punto di vista per i titoli; neutral workhorse per la UI densa.

- **Micro-tipografia (i dettagli che dicono "un umano ci ha tenuto").**
  - **Small caps reali** (`font-feature-settings: 'smcp'`), non capitali rimpicciolite
    dal browser (spindly, peso sbagliato). Old-style figures (`'onum'`) nella prosa.
  - **Letterspacing dei caps**: tutte le stringhe di maiuscole / small caps / cifre
    lunghe vanno tracciate ~5–10% (i caps sono disegnati per uso interno-parola).
    Body text **non** si traccia. `font-kerning: normal` sempre.
  - **Hanging punctuation, virgolette vere, dash veri.** `hanging-punctuation: first`;
    emetti sempre curly quotes (’ “ ”), em-dash (—), en-dash (–), mai `'` `"` `-`.
    L'occhio registra l'assenza come "cheap / da macchina da scrivere".
  - **Emphasis è un budget.** Bold/italic con parsimonia, mai combinati; all-caps
    solo sotto la riga e tracciati. Carica i pesi reali, non lasciare che il browser
    sintetizzi il faux-bold.
  *(Nota di scope: questo canone è tipografia latina occidentale. Measure-in-caratteri,
  rapporti di leading, small caps, italic-emphasis non si trasferiscono pulitamente a
  CJK/arabo.)*

### 3.2 Griglia

- **Baseline grid — ritmo verticale da un'unità sola.** Müller-Brockmann deriva
  *tutte* le decisioni verticali dalla baseline del body text. → Definisci una
  spacing scale come **multipli del line-height base** (step 8/4px è il proxy web
  comune) e usa **solo** quei valori per lo spacing verticale. *Slop:* margini
  ad-hoc (13px qui, 22px là, 35px altrove) trascinati a occhio → spacing aritmico.

- **Griglia modulare e a colonne — campi, non solo colonne.** Progetta su una
  column grid esplicita (es. 12 col, gutter fisso) **e** una row grid baseline;
  posiziona immagini/card a span di numeri interi di colonne/righe, e **varia**
  quali colonne occupa il contenuto per creare ritmo. *Slop:* tutto centrato in
  una colonna, o card in un 3-up uniforme che non varia mai.

- **Rompere la griglia di proposito — *govern the cage*.** Vignelli: *«Don't be
  governed by the grid, govern the grid. A grid is like a lion cage — you have to
  know when to leave the cage.»* La rottura crea tensione **proprio perché** la
  griglia è stata stabilita prima. → Griglia stretta sul 90% della pagina, poi
  **un** elemento che ne esce (pull-quote che scavalca colonne, immagine al
  vivo, numero gigante) come focal point, circondato da white space perché legga
  come enfasi e non come errore. (Rif: Samara, *Making and Breaking the Grid*.)
  *Slop:* o uniformità rigida (monotonia) o off-grid random senza sistema
  sottostante (caos che legge come rotto).

### 3.3 Colore

- **Relatività del colore (Albers).** Lo stesso swatch legge come due colori
  diversi a seconda dei vicini. → **Non finalizzare mai un colore su canvas vuoto.**
  Scegli e calibra ogni colore *in contesto*: l'accent sul suo vero sfondo, il testo
  sulla sua vera superficie. Se un blu brand è spento su bianco ma giusto su
  near-black, è Albers, non un errore. *Slop:* hex copiati da un palette generator
  in isolamento.

- **Palette limitata vs gradiente arcobaleno.** Il tell #1 dell'AI slop è il
  gradiente blu-viola su tutto + palette timida equidistribuita. È un artefatto del
  training data (Tailwind indigo-500 → tutorial → modelli). Il correttivo (dal
  *system prompt del Cookbook di Anthropic*, citato via prg.sh): *«Dominant colors
  with sharp accents outperform timid, evenly-distributed palettes.»* → Un neutro/
  brand dominante, uno-due toni di supporto, **un** accent riservato all'azione.
  Gradiente solo se fa un lavoro specifico (profondità, atmosfera su un hero),
  mai come default su card/bottoni/testo.

- **Il potere di UN accent sicuro.** La scarsità dà significato: se un colore è
  raro, l'occhio tratta ogni sua istanza come importante — può portare da solo
  "questa è l'azione" senza bordi né ombre. Spargilo ovunque e smette di
  significare. → Razziona l'accent: CTA primaria, il numero più importante, lo
  stato attivo — e quasi nient'altro.

- **Contrasto con intenzione + floor di accessibilità.** Guida con il **value
  contrast** (chiaro/scuro) per gerarchia e leggibilità; hue e saturation per
  enfasi *sopra*. Test in scala di grigi: se la gerarchia sopravvive senza colore,
  è strutturalmente solida. **Guardrail (non negoziabile):** la relatività di
  Albers governa l'estetica, ma la leggibilità ha pavimenti misurabili — WCAG:
  **4.5:1** testo normale, **3:1** testo grande e componenti UI. *«Sembra giusto su
  near-black»* non scusa un contrasto sotto soglia. Inoltre: ~8% degli uomini ha una
  carenza nella visione dei colori → una palette che regge solo sul contrasto di
  *hue* fallisce per loro. Motivo in più per guidare col value contrast. *(Ricorda
  la dark mode: un accent calibrato su bianco può fallire o cambiare significato su
  superficie scura — ricalibra.)*

### 3.4 Composizione

- **Balance asimmetrico e tensione.** Pesi *disuguali* bilanciati attorno a un
  fulcro (un elemento grande e quieto contro uno piccolo e intenso): produce
  movimento ed energia, restando risolto. La simmetria perfettamente centrata legge
  statica, formale, spesso inerte. → Smetti di centrare per riflesso. Rule of thirds,
  headline off-axis, split-screen, white space come elemento compositivo. Centra
  *solo* quando il centrare è la decisione (es. una schermata d'auth focalizzata).

- **Focal point e gerarchia.** Ogni composizione ha **un** punto d'ingresso e un
  percorso deliberato. Si crea con peso dominante: scala, l'accent solitario,
  isolamento nel white space, posizione su un'intersezione dei terzi. → Decidi
  *l'unica* cosa che l'utente deve vedere per prima su ogni schermata, rendila
  dominante, e **demolisci** il resto. La gerarchia è sottrazione quanto enfasi.
  *Slop:* tutto stesso peso → l'occhio non trova ancora.

- **Gestalt (è *come* l'utente parsa il layout, non decorazione).** *(Scuola
  fondata 1912, Wertheimer; principi sviluppati negli anni '10–'20.)*
  - **Prossimità & similarità:** elementi vicini = un gruppo; elementi con tratto
    condiviso = correlati. → Raggruppa con **white space e allineamento** prima dei
    bordi; stringi lo spazio dentro un gruppo, allarga tra gruppi. Gap incoerenti
    sono la causa #1 dei layout che "non tornano".
  - **Continuità & closure:** l'occhio segue percorsi lisci e allineati; la mente
    completa forme implicite (logo IBM a strisce per closure/continuità; il panda
    WWF / triangolo di Kanizsa come closure canonica). → Allineamento forte per
    guidare lo sguardo; fidati che il lettore completi forme semplici (restraint =
    sicurezza).
  - **Figure-ground (negative space attivo):** il "vuoto" non è vuoto — definisce
    la figura, crea respiro, fa focal point per isolamento. (La freccia FedEx vive
    nel gap: è figure-ground/negative space, non closure.) → Tratta il white space
    come **materiale** che posizioni, non margine avanzato da riempire.

- **Ripetizione con variazione + ritmo/densità.** Riusa un motivo (stile card,
  unità di spacing, type scale, radius) per l'unità, poi introduci variazione
  deliberata per evitare la monotonia. La rottura *è* l'enfasi perché si stacca dal
  pattern. E vari la **densità**: alterna regioni dense e informative con momenti
  aperti e di respiro — come passaggi forti e quieti in musica. *Slop:* densità
  uniforme, sezioni di altezza e gap identici (il monotono visivo); oppure ogni
  sezione un layout ad-hoc diverso (rumore).

### 3.5 Motion

- **Coreografia con significato, non un fade uniforme.** Gli studi da award
  (Active Theory, Locomotive) sono riconosciuti per motion *intenzionale*: timing,
  easing e direzione **diversi** secondo il ruolo dell'elemento, così il movimento
  *rivela la struttura* e guida l'occhio (da dove viene, dove vado). Legato
  all'azione utente (scroll, hover, nav) → si sente *causale*. → Spendi il budget
  di motion su **un** momento ben orchestrato (es. un page-load con stagger), e
  lascia che il resto sia semplicemente *presente*. *Slop:* lo stesso
  `translateY + opacity` su ogni sezione, stagger cookie-cutter su ogni griglia.
- **Guardrail:** rispetta `prefers-reduced-motion` — un motion che non degrada
  con grazia legge come autoindulgenza, non come craft. Performance-aware sempre.

---

## 4. Anatomia dell'AI slop — il catalogo dei *tell*

> Il *tell* che la UI è generata: **nessuno ha sovrascritto i default.** Origine
> meccanica documentata: i modelli predicono il pattern più comune nel training
> (codice 2019–2024 sproporzionatamente Tailwind `indigo-500` + Inter + token
> shadcn di default). Adam Wathan si è pubblicamente scusato nel 2025 per aver
> messo i bottoni Tailwind UI su indigo cinque anni prima.
>
> *Onestà sulle fonti:* hanno **dati** l'audit deterministico di Adrian Krebs
> (frequenze DOM su 500 landing Show HN), l'articolo NN/g sul glassmorphism
> (test di accessibilità) e il paper peer-reviewed sui loop immagine→immagine. Il
> resto (radius uniforme, fade-up, copy placeholder, bento) è **asserito** da
> singoli practitioner. Il loop "l'AI si addestra su siti AI" è un'ipotesi
> plausibile, non un fatto dimostrato per la UI. Usa il catalogo come euristica
> robusta, non come legge.

**Numeri reali (audit Krebs):** heavy slop = **22%** (4+ pattern), some = 32%
(2–3), clean = **46%** (0–1). Lo slop è la *mediana* del web, non l'eccezione.

| # | Tell | Com'è | Perché legge come AI | Alternativa human-made |
|---|------|-------|----------------------|------------------------|
| 1 | **VibeCode Purple** | Gradiente lavanda→blu (indigo-500/violet-600) su hero, bottoni, testo | Default Tailwind amplificato dal training; nessuna decisione | Colore dominante legato al *significato* del prodotto + 1 accent netto. Tratta indigo/violet come default **bandito** |
| 2 | **Inter ovunque** | Inter/Roboto/Poppins/Geist per body **e** hero centrato, pesi 400/600 | "Il font che ogni brand indossa" → tipo che fa zero lavoro di brand | Un volto distintivo, gerarchia con contrasto estremo (100/200 vs 800/900, salti 3×+). *Cookbook Claude:* bandisce Inter/Roboto/Open Sans/Lato/system; **Space Grotesk = convergence trap** (te lo consiglia per code aesthetic, ma è la trappola dove tutti si buttano dopo "evita Inter") |
| 3 | **Italic-serif accent word** | Hero all-sans con *una* parola in italic serif ("Build the *future*") | Il modo riflesso con cui l'AS "aggiunge personalità" — gerarchia via font-switch su un token | Se mischi un serif accent, fanne un *sistema* (voce editoriale ricorrente), non un italic decorativo solitario |
| 4 | **Centered-everything** | Badge + headline + subhead + 2 bottoni stack centrale, sezione dopo sezione | Layout a energia minima: nessuna decisione su enfasi/percorso/tensione | Asimmetria e griglia intenzionale; split-screen, headline off-axis, left-align editoriale |
| 5 | **Badge-above-H1** | Pillola "✨ Now in beta" centrata sopra il titolo | Pattern dominante nel training, messo a prescindere dal contenuto | Solo se porta un segnale reale e specifico; altrimenti taglia |
| 6 | **Colored left-border card** | Stripe accent 3–4px sul bordo sinistro di card/callout | *«Affidabile come gli em-dash nel testo»* (Krebs) — motivo shadcn memorizzato | Differenzia con gerarchia reale (scala tipografica, spacing, superficie), non lo stripe riflesso |
| 7 | **Tre box con icona** | Griglia di card identiche: icona lucide sopra + titolo bold + descrizione grigia, stesso radius/shadow | Contenuto versato in un container memorizzato, non progettato | Il contenuto detta la forma: card di dimensioni diverse per importanza, screenshot/diagrammi reali, griglia rotta |
| 8 | **Glassmorphism** | Pannelli frosted `backdrop-blur`, fill semitrasparente, bordo chiaro sottile, su gradiente | Costi reali (NN/g): contrasto basso → fail WCAG, blur GPU-heavy; funziona solo *sopra* un gradiente → si tira dietro i blob | Frosted glass con parsimonia, solo dove la profondità aiuta davvero, con contrasto verificato. Default = superfici opache ben spaziate |
| 9 | **Blurred blobs / mesh** | "Blob" sfocati o mesh gradient organici dietro l'hero, stessa famiglia viola | Atmosfera a costo-contenuto zero; il decoro di sfondo più comune nel training | Profondità con gradienti CSS intenzionali, pattern geometrici, effetti contestuali che *riferiscono* il brand/dominio |
| 10 | **shadcn default intoccato** | Slate/zinc + radius default + indigo primary, zero theming | "Componenti shadcn, pattern shadcn, composizione shadcn" → ogni prodotto collassa sulla stessa superficie | shadcn è **fondamenta, non finitura**: sovrascrivi i token (ramp neutro, scala radius, accent, shadow language — tweakcn o CSS vars a mano) |
| 11 | **Radius/shadow uniformi** | Stesso ~16px radius e una sola soft shadow su tutto; niente bordi netti, niente texture | Il designer varia radius ed elevation per esprimere gerarchia/materiale; lo slop applica un token a tutto | Sistema deliberato di elevation e radius: interattivo vs statico, foreground vs background, qualche bordo netto/texture |
| 12 | **Bento riflesso** | Mosaico di tile arrotondate di dimensioni diverse come sezione "features" default | One-click in Aceternity/Magic UI; tile dimensionate a caso, non per importanza | Bento *solo* con contenuti di peso genuinamente diverso e un motivo per giustapporli; dimensiona per priorità reale |
| 13 | **Fade-up su ogni sezione** | Stesso `translateY+opacity` all'ingresso viewport, stagger cookie-cutter | Comportamento AnimateOnScroll di default, globale, immotivato → latenza + motion-sickness senza guidare nulla | Budget di motion su un momento orchestrato; il resto è presente. Motion marca qualcosa di significativo. `prefers-reduced-motion` |
| 14 | **Copy placeholder** | "Build the future." "Supercharge your workflow." "The all-in-one platform for modern teams." | Il gemello linguistico del gradiente viola: la frase mediana statistica | Copy che un competitor non potrebbe incollare sul proprio sito: utente specifico, job specifico, outcome specifico |
| 15 | **3D blob stock / Corporate Memphis** | Blob 3D lucidi, sfere gradient, oggetti clay; o le figure flat sproporzionate (Corporate Memphis = "Alegria" di Facebook, agenzia BUCK, 2017) | "Visual elevator music": i loop AI immagine→immagine convergono su ~12 motivi "commercially safe" | Immagine *specifica* del prodotto/dominio: UI reale, data-viz reale, foto reale, o illustrazione custom con un punto di vista |

**Sintesi operativa del catalogo:** *se una scelta avrebbe potuto essere il
default del framework, non è ancora una decisione di design.* La cura, sempre, è
**divergenza deliberata**.

---

## 5. La checklist anti-slop (gate operativo)

`ui-andrea` esegue questo pass **prima di dichiarare finita** qualunque UI (e in
research mode, lo usa per valutare ciò che propone). Ogni "no" è un debito da
sanare o da giustificare esplicitamente ad Andrea.

**Punto di vista (prima di toccare la UI)**
- [ ] So dire in **una frase** qual è il punto di vista del sito/schermata: cosa
      crede, per chi **non** è, cosa rifiuta di fare?
- [ ] Ho un **vincolo** dichiarato (palette ridotta, 1–2 font, una regola di
      griglia) che forza l'invenzione?

**Colore**
- [ ] Niente gradiente viola/indigo di default. Il colore dominante è legato al
      *significato* del prodotto?
- [ ] **Un** accent, razionato (CTA/numero chiave/stato attivo), non spalmato?
- [ ] Colori calibrati **in contesto** (sul vero sfondo), non in isolamento?
- [ ] Gerarchia regge in **scala di grigi** (value contrast)? Contrasto ≥ **4.5:1**
      (testo) / **3:1** (large/UI)? Non regge solo sull'hue (CVD)?
- [ ] Dark mode: accent/superfici ricalibrati, non solo invertiti?

**Tipografia**
- [ ] Almeno un volto con **voce** (non Inter/Geist/Space Grotesk di default per il
      brand)? Gerarchia da ≥3 leve, non solo size?
- [ ] Measure 45–90 caratteri (contenitori `max-width` in `ch`/`em`)?
- [ ] Line-height body ≥1.5; display più stretto; nessun heading a 1.0?
- [ ] Curly quotes, em/en-dash, kerning on? Caps/small-caps tracciati ~5–10%?
      (No faux small-caps, no faux-bold.)
- [ ] Emphasis trattata come budget (bold/italic rari, all-caps < 1 riga)?

**Griglia & composizione**
- [ ] C'è una griglia reale (colonne + baseline), spacing a multipli di un'unità —
      non margini a occhio?
- [ ] **Un** focal point chiaro per schermata; il resto demolito?
- [ ] Asimmetria/tensione intenzionale dove serve (non tutto centrato per riflesso)?
- [ ] Raggruppamento via prossimità/white space prima dei bordi? Gap coerenti
      dentro vs tra gruppi?
- [ ] White space usato **attivamente** (non spazio da riempire)?
- [ ] Densità che **varia** lungo lo scroll (dense vs respiro), non uniforme?
- [ ] Se rompo la griglia, l'ho prima stabilita e la rottura ha respiro intorno?

**Superficie, motion, immagini**
- [ ] Radius/shadow **variati** per gerarchia (no un token su tutto)? Qualche bordo
      netto/texture dove ha senso?
- [ ] Se uso shadcn: token sovrascritti (ramp/accent/radius/shadow), non default?
- [ ] No glassmorphism/blob/mesh riflessi; profondità che *riferisce* il dominio?
- [ ] Motion = un momento orchestrato, non fade-up uniforme; `prefers-reduced-motion`
      rispettato?
- [ ] Immagini **specifiche** del prodotto (UI/dati/foto/illustrazione custom), non
      blob 3D stock o Corporate Memphis?

**Copy & stati nascosti (dove si vede che un umano ci ha tenuto)**
- [ ] Headline/copy che un competitor **non** potrebbe incollare? (utente/job/outcome
      specifici, no "placeholder energy")
- [ ] Stati **empty / loading / zero-results / error / 404** progettati di proposito
      (empty insegna il next step; error caldo, specifico, recuperabile; microcopy
      "due parti istruzione, una parte delight", chiarezza prima)?

**Craft signal trasversali**
- [ ] HTML semantico, accessibilità (focus, alt, contrasto), peso/performance curati
      — *sono* segnali "un umano ha deciso", non un extra.
- [ ] **Test finale:** indicando una qualunque scelta, so dire *perché* è quella e
      non il default? Se la risposta è "sembrava moderno", è slop → rifai.

---

## 6. References

Fonti complete, per track, con corrige della verifica adversariale, in
[`research-notes.md`](./research-notes.md). Le più *load-bearing*:

**Heritage** · Müller-Brockmann, *Grid Systems in Graphic Design* · *The Vignelli
Canon* (RIT) · Poster House su Armin Hofmann · Wikipedia *Helvetica* / *Tschichold* ·
Smashing Mag *Inspired Design Decisions: Brodovitch* · Pentagram (Scher) · AIGA
(Carson).

**Tipografia** · Butterick, *Practical Typography* (line-length, summary of key
rules) · Bringhurst, *The Elements of Typographic Style* (via inkwell.ie e
webtypography.net) · Smashing / Toptal su gerarchia · Fonts.com Fontology (pairing).

**Colore & composizione** · Albers, *Interaction of Color* (Yale) · Figma / IxDF su
Gestalt · Smashing su balance asimmetrico · WCAG 2.1 (1.4.3/1.4.11/1.4.12).

**AI slop** · Adrian Krebs, *AI Design Slop* (audit deterministico, Developers
Digest) · prg.sh *Purple Gradient* · Wathan (apologia indigo-500) · NN/g
*Glassmorphism* · *Claude Cookbook: Prompting for Frontend Aesthetics* · paper
PMC12827715 (convergenza motivi).

**Web craft** · Frank Chimero, *The Web's Grain* · magCulture / Wikipedia su Turley
(redesign **print** Bloomberg Businessweek 2010 — lezione che *transfer* al web) ·
Awwwards (Active Theory, Locomotive) · A List Apart *Elegance of Imperfection* ·
Pascal Deville, brutalistwebsites.com (2014).

---

*Documento vivo. Aggiornare quando emergono nuovi pattern di slop o nuove fonti.
Ultima sintesi: 2026-06-09 (ricerca multi-agente, 5 track, verifica adversariale).*
