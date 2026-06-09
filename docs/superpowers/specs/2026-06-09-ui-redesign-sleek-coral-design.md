# UI Redesign — "Sleek Coral" · Direzione di design

> **Stato:** direzione approvata da Andrea (2026-06-09). Ritocco responsive chiuso e verificato.
> **Fonte visiva di verità:** [`docs/design-craft/mockups/redesign-direction-v2.html`](../../design-craft/mockups/redesign-direction-v2.html) (mockup standalone, dark+light, contenuti reali).
> **Gate operativo anti-slop:** [`docs/design-craft/design-bible.md`](../../design-craft/design-bible.md) §5.
> **Supersede parziale:** evolve `2026-06-08-redesign-cobalt-coral-design.md` (l'accento passa da cobalt+coral a **un solo coral**; la voce passa da monospace a Hanken Grotesk).

---

## 1. Contesto & obiettivo

La logica del prodotto funziona ed è completa; **si rifà solo l'UI**. Il sito attuale ("Refined Terminal": monospace ovunque, dark, 3 colonne dense con due sidebar promo, card con barre rainbow HOME/DRAW/AWAY, CTA verdi "Piazza la scommessa") è funzionale ma piatto in gerarchia, senza respiro né senso di prodotto premium, e con tell da app-scommesse.

**Obiettivo:** elevare l'UI a un prodotto **moderno-sleek (energia Linear/Vercel), dark e light pari grado**, con un'identità coerente e anti-slop, mantenendo intatta la logica.

## 2. Punto di vista (l'anima — confermato)

> Agentic Markets mostra **probabilità calibrate da un modello**, non opinioni da bar. Ogni numero si è guadagnato il posto. È per chi ragiona in **valore atteso**, non in tifo — e **rifiuta** il look da app di scommesse (verde acceso, "GIOCA ORA", urgenza). Legge come uno **strumento di precisione / una redazione quantitativa**, non una slot machine né una fintech glossy.

Tutto ciò che segue discende da qui.

## 3. Percorso decisionale (cosa abbiamo scartato e perché)

- **Scartato — "premium = gradienti + glass"** (v0): pescava 5 tell del bible (#1 VibeCode Purple, #2 Inter, #8 glass, #9 blob, #11 radius uniformi). Generico.
- **Scartato — editoriale-svizzero/serif** (v1, Fraunces + ocra): bocciato come "troppo rivista/vecchia", accento ocra non gradito, troppo austero, layout da rivedere.
- **Approvato — sleek moderno + coral + grafiche sport custom** (v2): vedi sotto.

## 4. Sistema visivo

### 4.1 Colore & temi
Token calibrati **in contesto per ogni tema** (Albers), non invertiti. **Dark e light entrambi prima classe.**

- **Accento unico = CORAL raffinato.** Dark `--coral:#FF6A5E` (meno fluo, più materico su near-black); light `--coral:#D8392F` (scuro abbastanza da reggere AA 4.5:1 come testo su bianco). Fill barra del pick: `--coral-deep` → `--coral`.
- **Razionamento dell'accento a 3 soli ruoli:** (1) il verdetto/pick del modello (label + fill barra dell'esito scelto), (2) il numero-chiave (es. il 91% del featured) e il chip edge/+EV, (3) lo stato attivo (nav, rail). Nient'altro.
- **Neutri a bassa croma.** Dark: bg `#0B0C0E` → bg-2 `#0E1013` → panel `#131519` → panel-2 `#181B20` → inset `#0C0D10`; ink `#EDEFF2` / ink-2 `#AEB4BE` / muted `#6E7682` / faint `#474D57`; hairline `--line #21252C` / `--line-2 #2C313A`; inner-highlight `--hi rgba(255,255,255,.05)`. Light: bg `#F4F5F7` → panel `#FFFFFF`; ink `#14171C`…; `--hi rgba(255,255,255,.9)`. (Valori completi nel mockup `:root`.)
- **P&L fuori dal sistema-accent:** verde `--won` / rosso `--lost` **solo** per esiti realizzati (storico, forma) — **mai** per CTA o azione. `--live` usa coral (è "attivo", informativo).
- **Guardrail:** gerarchia regge in scala di grigi (value contrast); contrasto ≥4.5:1 testo / ≥3:1 large/UI in entrambi i temi.

### 4.2 Tipografia
- **Hanken Grotesk** = voce del brand (wordmark, heading, label, prosa, controlli). Grottesco di qualità con carattere; **non** Inter/Geist/Space Grotesk/Roboto/system (banditi §4).
- **JetBrains Mono** = SOLO le cifre (%, Elo, score, conteggi, metadata tabellare): slashed-zero + tabular, feel da readout di strumento. Il mono **non è la voce** del brand.
- Gerarchia da ≥3 leve (size + case + tracking + colore + spazio). Caps/eyebrow tracciati 0.12–0.16em. Body line-height ≥1.5 (`1.55`). Measure vincolata (`max-width` in `ch` su prosa).

### 4.3 Griglia & spaziatura
- **12 colonne + baseline a multipli di 4px**, gutter fisso. Rail nav (200px) + corpo `minmax(0,1fr)`.
- **Densità che varia col contenuto:** football span-4 (3-up), tennis span-3 (4-up più compatte).
- **Un solo break di griglia = il "featured" (span-12)**, su `--bg-2` con wash radiale coral, split asimmetrico (probabilità a sx / ragionamento a dx). È il focal point, circondato da respiro.

### 4.4 Superfici & elevazione
Profondità da **elevazione reale** (rubata a Linear/Vercel), **non glass/blur**: gradini di superficie + inner-highlight 1px in alto (`--hi`) + ombra a due livelli (`--shadow-card`, `--shadow-lift` su hover). Radius variato per gerarchia (card 12px, chip/controlli 7px, micro 5px) — non un token unico. Score-readout su superficie incassata (`--inset`).

### 4.5 Sistema grafiche sport custom
**12 glifi SVG line-art, fatti a mano, `<symbol>` riusabili via `<use>`.** Stile coerente: stroke 1.5, round join, **una forma in coral per glifo** come punto di vista. Set: pallone (pentagono), campo (dischetto), racchetta (corde), pallina (cucitura), erba, court (rete), trofeo World Cup, creator-pick (stella), edge (bolt), mercati/classifica/builder (barre). Niente emoji, niente icone stock lucide, niente blob 3D → risolve il tell #15 col segno specifico del dominio. **Uso:** testate di sezione sport, rail nav, ticker, header card, stati; **non** dove sarebbero rumore.

### 4.6 Motion
Budget minimo: solo il pulse del dot live + hover-lift delle card. `prefers-reduced-motion` rispettato (tutto si spegne). Nessun fade-up globale.

## 5. Componenti

| Componente | Note di design |
|---|---|
| **Topbar** | Sticky, hairline, blur leggero. Brandmark (logo target con cuneo coral + wordmark `nowrap`) · topnav centrale · topright (toggle tema, pill account+PRO, lingua). |
| **Rail nav** | Tipografico, icone sport custom inline, hairline, stato attivo = inset + icona/conteggio coral. Sezioni "Desk" / "In evidenza". Pulsante "Aggiorna odds". |
| **Doppia nav** | Decisione confermata da Andrea: topnav orizzontale **+** rail su desktop. Sotto i 1200px la topnav si nasconde (il rail copre la navigazione). |
| **Ticker live** | Una riga, label "In play" coral con pulse; item scrollabili in orizzontale (`overflow-x:auto`, scrollbar nascosta) — non clippano la pagina. |
| **Filtri** | Segmented control (Tutti/Football/Tennis · Tutte/Solo con edge) + search; wrap su narrow. |
| **Featured (focal)** | Vedi §4.3. "Edge del giorno · il modello vs il mercato": numero gigante coral, pickname, chip edge, e lo stato "perché" ricco (Elo, match superficie, H2H + narrativa del modello). |
| **Card-predizione (atomo)** | Header (glifo sport + lega + stato/quando) · fixture (nomi bold, `vs` demote) · score-readout incassato · **righe outcome monocromatiche, coral SOLO sul pick** (no rainbow) · chip edge · stato "perché" (forma, campione) · footer con toggle "perché" + bottone **bet sobrio** (resta = redirect affiliate, ma neutro, no verde/urgenza) · gate Pro/Settlato. Stato coin-flip (50/50) = **nessun** accento ("nessun favorito netto") — onestà di calibrazione. Stato "modello errato" sugli esiti sbagliati. |
| **Storico** | "Prova di calibrazione: 100 pick settlati, niente cherry-picking." Tabella densa; P&L verde/rosso solo qui. |
| **Promo (demote)** | Da due sidebar grasse → una fascia 3-up in fondo (API/REST · white-label · confronto quote). |
| **Footer** | Compliance visibile: 18+, scopo informativo, GamCare/BeGambleAware, disclosure affiliati. |

## 6. Responsive

- **Breakpoint 1200px:** nasconde la topnav centrale.
- **Breakpoint 1080px:** layout a colonna singola; il rail diventa una riga di chip (wrap); featured a colonna singola; icon-wall 3-up; promo 1-up.
- **Regola anti-blowout (load-bearing):** i grid track usano **`minmax(0,1fr)`** (non `1fr`) — un `1fr` ha minimo implicito `auto` = max-content e veniva "gonfiato" dal flex nav → overflow orizzontale. Verificato via JS: `scrollWidth == clientWidth` a 745px (nessun overflow di pagina).
- **Safety:** `body{overflow-x:clip}` (clip preserva lo sticky header, a differenza di `hidden`).

## 7. Guardrail anti-slop & etici

- **Tell banditi (bible §4):** gradienti viola/indigo/coral su elementi; glass/blur/blob/mesh; Inter & co. come voce; radius/shadow uniformi; centered-everything; badge-above-H1; tre-box-icona; bento riflesso; fade-up globale; copy placeholder.
- **Etica engagement:** via il **verde-scommessa** e l'urgenza ("🔴 Live —"). **Il bottone bet RESTA** (decisione Andrea 2026-06-09: è il redirect ai bookmaker/sportsbook partner = revenue affiliate), ma **reso sobrio** (neutro, niente verde/allarme), non più un CTA urlato. Il "perché"/analisi resta azione separata. Onestà di calibrazione esposta (coin-flip senza pick, "modello errato", hit-rate nello storico).
- **Test finale §5:** ogni scelta non-default ha un *perché* legato al punto di vista, non "sembrava moderno".

## 8. Strategia di implementazione sul monolite `page.tsx`

**Vincolo assoluto:** la **logica resta invariata** (data fetching, settlement, gating, calcoli). Si tocca solo il livello di presentazione. Regola "Surgical Changes": ogni riga cambiata risale alla richiesta UI.

Stato attuale: `app/page.tsx` ≈ 5.930 righe (monolite), `app/globals.css` con sistema token `--am-*` + alias legacy (già usato per re-skin).

**Fasi proposte (ognuna verificabile, deployabile, reversibile):**

1. **Fondamenta token + font** — in `globals.css`: ricalibra i valori `--am-*` sulla palette Sleek Coral (coral unico per tema, neutri a bassa croma, superfici, `--hi`, ombre, radius scale) mantenendo gli alias legacy così le classi bespoke esistenti si ri-skinnano; importa Hanken Grotesk + JetBrains Mono e introduci le variabili di famiglia (voce vs cifre). *Reversibile: è un blocco di token.* **Più alto rapporto valore/rischio.**
2. **Tipografia** — applica la voce (Hanken) a heading/label/prosa e il mono alle sole cifre, via variabili. Niente cambi di markup.
3. **Sistema glifi sport** — aggiungi lo sprite SVG `<symbol>` come componente React riusabile (`components/sport-glyphs.tsx`); sostituisci icone/emoji esistenti dove previsto.
4. **Estrazione + restyle componenti** (incrementale, uno per volta, logica passata via props invariata): `Topbar`, `RailNav`, `Ticker`, `Filters`, `FeaturedPick`, `PredictionCard` (atomo), `WhyState`, `HistoryTable`, `PromoStrip`, `Footer`. Estrarre da `page.tsx` riduce il monolite e isola il rischio. Ordinare dall'atomo (`PredictionCard`) verso il layout.
5. **Layout di pagina** — ricompone i componenti nella nuova griglia 12-col + responsive (§6), demotando le promo.
6. **Pulizia** — rimuovi solo gli orfani creati dalle modifiche (es. classi rainbow/CTA-verde non più usate). Dead code preesistente non correlato si segnala, non si rimuove.

*Nota di reconciliation token:* il mockup usa nomi semplici (`--bg`,`--panel`,`--coral`,`--ink`); in produzione si mappano sui `--am-*` esistenti (o si introducono come nuovi alias) per non rompere le classi bespoke attuali. Da decidere in fase di planning.

## 9. Piano di verifica

- **Visivo, da loggato**, dark **e** light, su ogni fase (regola `visual_check_loggato`).
- **Responsive oggettivo:** check JS `scrollWidth == clientWidth` a 1440/1280/1080/745/375; nessun overflow.
- **Anti-slop:** checklist §5 del bible prima di dichiarare finita ogni fase.
- **No regressione logica:** le funzionalità esistenti (gating piani, settlement, who-wins blur, ecc.) invariate — smoke test dei flussi chiave.
- **A11y:** contrasto AA in entrambi i temi, focus visibili, `prefers-reduced-motion`.

## 10. Rischio & gate

Codice di **produzione** → task **medium/high**. L'implementazione (non questa spec, né i mockup) **non parte senza `APPROVE`** umano su una PROPOSAL con change-spec esatta (file/righe toccate, prima→dopo, reversibilità, blast radius, piano di verifica), come da CLAUDE.md. Backup prima delle modifiche a `globals.css`/`page.tsx`. Deploy produzione con conferma esplicita.

## 11. Riferimenti

- Mockup approvato: `docs/design-craft/mockups/redesign-direction-v2.html`
- Design bible (anti-slop): `docs/design-craft/design-bible.md`
- Spec precedente (token): `docs/superpowers/specs/2026-06-08-redesign-cobalt-coral-design.md`
