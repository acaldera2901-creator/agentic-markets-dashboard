# UI Memory — Agentic Markets

Memoria persistente dell'agente ui-andrea: pattern approvati, scelte consolidate, componenti creati.
Aggiornare a fine di ogni sessione UI significativa.

---

## Design system (scelte consolidate)

_(vuoto — da popolare alla prima review: palette, typography, spacing, dark mode)_

## Pattern approvati da Andrea

_(vuoto)_

## Componenti creati / adottati

| Componente | Progetto | Fonte (libreria o custom) | Data |
|---|---|---|---|

## Pattern bocciati / da evitare

- Inline style nei componenti responsive → blocca i breakpoint Tailwind; usare classi con prefisso `!` se serve override (regola di Andrea, 2026-05)

## Note competitor

_(osservazioni da Polymarket / Kalshi / OddsJam)_

---

## Engagement Ethics & Dark-Pattern Guardrails

L'agente `ui-andrea` deve **riconoscere** i meccanismi di "engagement architecture" (variable reward, FOMO, sunk cost, near-miss, valute offuscate) e usarli SOLO nella fascia lecita. Agentic Markets è un **prediction market con denaro reale** → i pattern che spingono spesa/tempo sfruttando vulnerabilità cognitive sono **vietati per legge** (DSA art. 25 dark patterns; UCPD/Dir. 2005/29 + CPC dark-pattern guidelines; tutela consumatore). In dubbio → flag a `legale-compliance`.

> ⚠️ **Prerequisito legale aperto (nota di testa).** La qualificazione di Agentic Markets come **gioco d'azzardo** non è ancora sciolta. Finché non lo è, questa tabella **presume il caso peggiore** (modello monetizzato = gambling) e applica i divieti più severi. In regime gambling molte voci 🔴 non sono "solo dark pattern" ma violazioni della normativa di **gioco responsabile** (più severa) e, a monte, dell'obbligo di **licenza** (IT: L.401/89, ADM; DE GlüStV; FR ANJ; UK LCCP). Vedi brief legale dedicato (`legale-societario`/`legale-compliance`).

**Regola operativa:** ogni flusso che tocca denaro, deposito o ripetizione di scommessa va valutato contro questa tabella PRIMA di implementarlo. Se scivola in 🔴, l'agente non lo costruisce: segnala il rischio ad Andrea.

**Nota AI Act art. 5:** citarlo **solo** sulle voci con personalizzazione/targeting via sistema AI (es. offerte/notifiche calibrate sul comportamento di perdita del singolo utente). Senza AI di profilazione, la base resta UCPD/DSA — non citare l'AI Act a tappeto.

| # | Meccanismo | Verde ✅ (usabile) | Giallo 🟡 (cautela) | Rosso 🔴 (vietato sul prodotto monetizzato) |
|---|---|---|---|---|
| 1 | Ricompense imprevedibili | — | Reveal animato su risultato *già determinato dallo skill* (es. esito mercato) | Loot box / pacchetti casuali / spin a pagamento; reward casuale legato a spesa |
| 2 | Progressione | XP/livello/badge **non monetari**, onboarding progress | Battle pass cosmetico | Progressione che si sblocca solo depositando |
| 3 | FOMO / scarsità | "Mercato chiude tra X" (informazione reale e veritiera) | Eventi a tempo cosmetici | Countdown finti, scarsità artificiale, "offerta scade" su deposito |
| 4 | Investimento / sunk cost | Storico operazioni, P&L trasparente | Streak di login non monetaria | UI che enfatizza "hai già investito N, continua"; ostacoli all'uscita/prelievo |
| 5 | Micro-obiettivi | Missioni informative/educative | Obiettivi settimanali cosmetici | Obiettivi che richiedono ulteriori scommesse per "completarsi" |
| 6 | Dopamina / anticipazione | Feedback chiaro post-azione | Animazione di attesa breve e onesta | Suspense artificiale prolungata per indurre "ancora una" |
| 7 | Frizione bassa | UX pulita, pochi tap per azioni informative | Quick-action su operazioni reversibili | One-tap re-bet, autoplay, pagamento pre-salvato senza conferma esplicita |
| 8 | Frustrazione/near-miss | — | — | "Quasi vinto" + offerta di boost/retry; qualsiasi near-miss su denaro reale |
| 9 | Pressione sociale | Leaderboard skill-based, profili pubblici opt-in | Inviti/referral trasparenti | "Il tuo amico ti aspetta", FOMO sociale, status legato alla spesa |
| 10 | Monetizzazione nascosta | Prezzi in **valuta reale**, chiari | — | Valute interne offuscanti (gemme/token), bundle col "resto inutile", costo reale nascosto |
| 11 | Bonus / free bet | — | — | "Deposita X ricevi Y", free bet, bonus referral di gioco — **vietati in toto dal Decreto Dignità (art. 9)** |
| 12 | Strumenti di gioco responsabile | Limiti deposito, auto-esclusione, reality check, time-out **ben visibili** | — | Assenza o occultamento di questi strumenti (dark pattern di omissione; violazione licenze) |
| 13 | Personalizzazione AI su perdite | — | — | Offerte/notifiche targetizzate su utenti in perdita o ad alta spesa via modello AI → **AI Act art. 5(1)(b)** + GDPR art. 22 |
| 14 | Push / re-engagement temporizzato | Notifiche fattuali su eventi reali, opt-in | — | "Torna a giocare", "il mercato chiude, scommetti ora" — pratica aggressiva + pubblicità gambling |
| 15 | Confirmshaming sull'uscita | Conferma neutra su azioni irreversibili | — | "Sei sicuro? Perdi la streak / il tuo amico vince senza di te" su uscita/limiti |
| 16 | Losses disguised as wins | Esito netto sempre chiaro (vinto/perso reale) | — | Celebrare come "vittoria" un esito in perdita netta |

**Basi normative di riferimento** (mappa famiglie → voci):
- **DSA art. 25** (+ Cons. 67) — dark pattern di interfaccia: voci 1-10, 14, 15.
- **UCPD / Dir. 2005/29 + CPC dark-pattern guidelines** — pratiche ingannevoli/aggressive: trasversale (urgenza/scarsità false → 3; obstruction/roach-motel → 4; drip pricing/disguised costs → 10; confirmshaming → 15).
- **Dir. 2011/83 Consumer Rights + Omnibus (2019/2161)** — prezzo totale reale pre-acquisto: voce 10.
- **PSD2 / SCA** — autenticazione forte: pagamento pre-salvato senza conferma (voce 7).
- **AI Act art. 5(1)(a)(b)** — manipolazione/sfruttamento vulnerabilità: SOLO se targeting AI (voci 1, 6, 8, 13).
- **GDPR art. 22** — decisioni automatizzate/profilazione: voce 13.
- **Normativa gambling** (IT L.401/89 + Decreto Dignità art. 9; DE GlüStV; FR ANJ; UK LCCP) — base **primaria** se modello monetizzato: voci 1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 14, 16.

**Principi guida:**
- Trasparenza sul denaro: l'utente deve sempre vedere il costo/rischio reale in valuta reale.
- Nessun design che renda **più difficile smettere** che iniziare (uscita ≥ facile dell'ingresso).
- Engagement = qualità dell'informazione e dello skill, **non** sfruttamento cognitivo.
- Posizionamento: Agentic Markets è "intelligenza/skill", non slot machine. Ogni pattern da casinò erode la narrativa oltre che la compliance.
- Cross-ref: per qualsiasi 🔴 o 🟡 dubbio → coordinarsi con `legale-compliance` (DSA/AI Act).

---

## Log sessioni

### 2026-06-10 — Model edge metric + WC card structural parity (branch ui/model-edge-wc-parity)
- **2 interventi APPROVATI da Andrea** (decisioni prese, non ridiscusse). Solo presentazione/copy: zero modifiche a probabilità, pick, gating, dati o modello. Branch `ui/model-edge-wc-parity` da `main`. NESSUN deploy prod — solo PREVIEW.
- **Intervento 1 — "model edge" su ogni card.** Nuovo helper `lib/best-bets.ts` → `export function modelEdge(pickProb, secondProb)` = `(pickProb−secondProb)*100` arrotondato a 1 decimale (input frazioni 0..1). Verificato numericamente contro gli esempi spec (47/28→19.0, 57/43→14.0, 53/47→6.0, tie→0). Usato in 3 punti di `app/page.tsx` (PredictionCard football, TennisMatchCard) e in `components/world-cup/WcBoard.tsx` (WcCard):
  - Gerarchia badge edge: **market edge** reale (p.edge/m.edge/edge_percent > 0) = chip coral PIENO (`.edge` / `.edge.evbtn`) → resta il segnale più forte, invariato. Il ramo che prima diceva "nessun edge · in linea col mercato" ora mostra **`⚡ +X.X pt · edge modello`** con nuova classe `.edge.model` (coral OUTLINE, non cliccabile, `cursor:default`) → distinta visivamente dal market edge. belowFloor/locked/preview invariati.
  - Prosa "Perché" (buildWhy football ~2810, buildTennisWhy ~2906, buildWcWhy WcBoard ~300): dove negava l'edge ("non dichiariamo nessun edge / niente quota") ora, con pick chiaro, dice "Il modello dà <pick> avanti di X punti sul secondo esito" + resta onesto che non c'è quota di mercato. Guard `me>0` per il caso dead-heat.
  - KPI header "CON EDGE": prima contava `valueBets+tennisValueBets` (market value bets → spesso 0). Ora `withEdgeCount` = card con **model_edge ≥ 10.0 pt** (escluse belowFloor), football+tennis. `valueBets`/`tennisValueBets` rimossi (orfani creati dalla modifica). Logica KPI verificata a tavolino (Mexico 51/28=23 conta; 40/33=7 no; tie no).
- **Intervento 2 — WC card = struttura identica a football.** `WcCard` riscritta da `.wc-board-card`/`.eyebrow`/`.wc-board-match`/`ProbRow`/`.wc-board-pick`/footer-inline → struttura condivisa `<article class="card"><div class="pred">` con `.top`(glyph #g-trophy + "World Cup · league · paper" + .when), `.fx`(.teams + .scorebar mappata da live-score-bar), `.rows`(.row/.lab/.track/.pct, `.row.pick` coral), `.edge` (market/model/below-floor), `.why` (toggle + buildWcWhy + Place Bet + DeepAnalysis premium-gated sotto). Lock = `.pred .lock-overlay.wc-lock` (anchor, link styling neutralizzato). Rimossi stili inline a favore delle classi condivise. Contenuti WC specifici tutti mantenuti.
  - CSS: rimosse classi orfanate dalla mia modifica (`.wc-board-card/-match/-pick*`, `.wc-prob-*`, `.wc-why`); aggiunte minimali `.wc-why-text`, `.wc-place-bet`, `.wc-why-toggle/-model`, `.edge.model`; `.wc-no-favourite-inline` ri-tokenizzato `var(--text)`→`var(--am-text)`/`--am-muted-2`. `.wc-board-grid` mantenuto (container ancora usato).
  - `ProbRow` rimosso (orfano). `confidence_score` non più mostrato (la card football non lo mostra → coerente con parità strutturale; resta nel type).
- **Verifica:** `tsc --noEmit` 0 errori, `npx eslint` 0 errori (40 warning tutti pre-esistenti, nessuno sul codice nuovo), `next build` verde. Visual check dark+light via render fedele dei 3 card affiancati (classi/CSS/sprite reali sulla route /world-cup) — struttura identica confermata, market-edge chip pieno vs model-edge chip outline, coral su white in light passa 4.5:1.
- **LIMITE di verifica (flag ad Andrea):** in locale E su preview tutte le card tornano **locked** per anonimo (il server proietta via sessione, strippa le probabilità → `p_*`/`p1`/`p2` null). Quindi il KPI "CON EDGE" mostra 0 e i badge model-edge non si vedono "live" senza un login autenticato. Il login va in 500 su preview (SESSION_SECRET solo Production). → la verifica "CON EDGE > 0 coi dati attuali" e i badge unlocked si possono confermare SOLO da loggato in Production. Logica e render già provati. Da ricontrollare post-merge in prod loggati.
- **AI-slop pre-esistente notato (NON toccato, fuori scope):** `.deep-analysis-panel`/`.da-badge` in globals.css usano `rgba(139,92,246,…)` = **VibeCode purple** (indigo/violet, tell #1 della bible). Pre-esistente, da ri-tokenizzare su `--am-coral-b`/`--am-line` in un task dedicato.

### 2026-06-09 — UI-ANDREA design-craft upgrade (anti-AI-slop)
- **Agente potenziato a "Senior Graphic & UI Designer".** Obiettivo: produrre UI human-made (non AI slop), product-agnostic.
- **Nuova knowledge base** `docs/design-craft/`: `design-bible.md` (manifesto · heritage pre-AI · craft typography/grid/color/composition/motion · catalogo 15 tell AI-slop · **checklist anti-slop operativa §5** · references) + `research-notes.md` (fonti per track + corrige della verifica adversariale). Origine: workflow multi-agente `wf_7898a119-785` — 5 track ricerca + fact-check, ~459k token, fonti reali citate.
- **Principio cardine (ora nell'agente):** "lo slop è l'assenza di una decisione; se una scelta poteva essere il default del framework, non è design". Antidoto = divergenza deliberata.
- **Rewrite chirurgica** `~/.claude/agents/ui-andrea.md`: aggiunto DESIGN-CRAFT CORE (flusso di ragionamento da designer: POV→tipografia→griglia→colore→dettaglio/motion) + **gate checklist anti-slop** prima di dichiarare finito + passata anti-slop in review + campo ANTI-SLOP nell'output. Librerie riformulate da "fonte pattern" a "materia prima da trasformare, mai shippare i default". Tutta la macchina operativa esistente + blocco Engagement Ethics **intatti**.
- **Guardrail recepiti dalla verifica:** floor WCAG (4.5:1 / 3:1) sopra la relatività di Albers; CVD → guidare col value contrast; `prefers-reduced-motion`; scope canone = tipografia latina occidentale; fatti corretti (Beethoven 1955, Lissajous non spirograph, Krebs 22%/46%, "Inter is the new Helvetica" non è di Krebs, Space Grotesk = convergence trap non blocklist, Turley = redesign print, Corporate Memphis = Alegria/BUCK 2017).
- Spec: `docs/superpowers/specs/2026-06-09-ui-andrea-design-craft-upgrade-design.md`.

### 2026-06-07
- File creato. Agente potenziato con fonti librerie: shadcn/ui, Magic UI, Aceternity UI, React Bits, Fancy Components, HeroUI (solo riferimento), 21st.dev, Tweakcn.
- MCP shadcn configurato (scope user) — componenti/blocks installabili direttamente dal registry.
- Aggiunta sezione "Engagement Ethics & Dark-Pattern Guardrails": tassonomia 10 meccanismi con classificazione verde/giallo/rosso tarata sul prodotto monetizzato. Origine: descrizione engagement architecture rivista come guardrail anti-dark-pattern. Cross-ref legale-compliance.

### 2026-06-07 — UI-ACCOUNT-UNIFY-1 (visual check + analisi uniformazione)
- **Stato build verificato (entrambi locali):** dashboard-web `next dev` :3000 → HTTP 200, 0 errori console, Next 16.2.4 Turbopack. client-portal `next dev` :3001 → su, redirect `/`→`/login` (auth gate), Next 16.2.6.
- **Visual check loggato (via injection localStorage `agentic-client-profile`, key in page.tsx:902).** Stati profilo screenshottati: not-logged (home + Settings empty "Create a profile"), free, base, premium (con pannello Risk profile/Autopilot limits premium-only), pending_payment (badge PENDING PAYMENT, header pill risolve requestedPlan). Account UI identica tra stati salvo badge stato + pannello Risk premium-only. La pausa stagionale ("no fixtures 48h") svuota la lista mercati: è data-state, non bug.
- **Divergenza design system misurata (fonte di verità = client-portal):**
  - dashboard-web: NO shadcn. Monolite `app/page.tsx` 5943 righe, 619 className, `globals.css` 4226 righe / **264 classi CSS uniche bespoke** (la cifra "603/691" era conteggio righe, non classi). Font Inter + system-mono. Token raw `--bg/--panel/--text/--cyan...`. Nessuna cartella `components/`. Prodotto = 4 file (page.tsx, admin/page 439, admin/login 61, privacy 110).
  - client-portal: shadcn (style base-nova) su Tailwind v4 `@theme inline` + base-ui + cva + tailwind-merge. Font **Space Grotesk + Space Mono** via next/font. Kit completo `components/ui/*` (button,card,input,label,select,badge,dialog,table,dropdown,avatar,separator,sonner) + magicui (border-beam,number-ticker) + componenti prodotto (BetTable,EquityChart,AllocationPie,DepositModal,Sidebar,Topbar).
  - **Chiave:** i VALORI palette sono GIÀ identici (client-portal dichiara `--am-*` = stessi hex di dashboard-web `--*`, e mappa `--primary/--card/--border...` shadcn su quegli stessi valori). La differenza è namespace token + font + paradigma componenti.
- **Decisione fonte di verità (proposta, attende APPROVE):** client-portal = standard. È già il bridge shadcn-native. Uniformazione = portare dashboard-web verso quel sistema, in FASI APPROVE-abili separate (font→token alias→migrazione componenti incrementale). Visual-diff before/after obbligatorio.
- C'è un duplicato annidato `dashboard-web/client-portal/` (copia separata) — da chiarire con Andrea, non toccato.

### 2026-06-08 — UI-REDESIGN-COBALT-CORAL (implementazione, branch locale)
- **Aesthetic "Refined Terminal · Cobalt & Coral"** su dashboard-web. Branch `ui/redesign-cobalt-coral` da `ui/account-unify`. 5 commit isolati (F1-F5). NESSUN deploy/push. Spec: `docs/superpowers/specs/2026-06-08-redesign-cobalt-coral-design.md`.
- **Ruoli colore (consolidati):** corallo `#FF6B6B` (light `#E5484D`) = primary brand (CTA, nav attiva, top-pick); arancio `#FB923C` = warm, gradiente CTA orange→coral; cobalto `#3B82F6` = dati/modello/link; ambra `#FBBF24` = highlight/eyebrow hero; verde `#34D399` (`--am-positive`) = **SOLO P&L/ROI**; rosso `--am-negative` = perdite.
- **Tecnica CSS-led (chiave riusabile):** restyle vive nel layer token `globals.css`. Legacy alias `--green` ripuntato a coral → ~96 accenti brand cambiano senza toccare le 264 classi. P&L tenuto separato perché page.tsx usa Tailwind `text-green-300`/SVG `#22C55E`/`.is-positive` (token `--am-positive`), indipendenti da `--green`. Sweep literal con perl: emerald `34,197,94`→coral; indigo `140,145,255`/`129,140,248`→cobalt `59,130,246`; value/correct `#4ade80`/`74,222,128`→`--am-positive`.
- **Tema dark/light:** `:root` dark default + blocco `:root[data-theme="light"]` (override solo valori base `--am-*`, alias ereditano). Toggle in header (page.tsx, unica aggiunta consentita) + persistenza `localStorage agentic-theme` + script no-flash pre-paint in layout.tsx (`suppressHydrationWarning` su `<html>`).
- **Light pass — lezione:** molte classi bespoke hardcodavano superfici/testo dark. Risolto tokenizzando: `#0d1020`→`var(--panel)`; bande header → nuovo `--am-bar`; ~24 superfici recessed (`rgba(6,7,15,*)` ecc.)→ nuovo `--am-inset`; ~22 heading near-white→`var(--text)`, muted near-white→`var(--muted)`; partner form `var(--surface,#1e2a3a)`→`var(--panel-2)`; fallback orfani `var(--fg,#f1f5f9)`→`var(--text)`. **Pattern da cercare sempre per nuovo light:** color literal `white`/`#fff`/near-white, `var(--token, #fallback)` con fallback dark, `rgba(255,255,255,.0x)` fill, opaque dark hex in surfaces.
- **Fascia verde rispettata:** solo estetica. Glow/ombre STATICI (no animazioni-loop, no pulse compulsivo sui CTA). Nessun re-bet/FOMO/near-miss introdotto.
- **Verifica:** `tsc --noEmit` + `next build` verdi a ogni commit. Visual-diff 1440×900 su 5 stati profilo × dark/light + tab interni (Account/History/Leaderboard/Partner) + modale register, console pulita. Harness: `.ui-diff/shoot-theme.mjs`, `.ui-diff/views.mjs`, `.ui-diff/zoom.mjs` (gitignored, riusabili: arg label/theme/baseUrl).
- **Dev server flakiness:** `next dev` muore se parte un `next build` nella stessa dir; per preview stabile usare `next start` (prod) e RIAVVIARLO dopo ogni build per servire lo snapshot fresco. Porta 3000 condivisa col dev del working tree; preview prod su 3200.

### 2026-06-08 — UI-REDESIGN live/state fix (QA follow-up, stesso branch)
- **Contesto:** QA ha trovato 4 gruppi di stili su componenti live/stato NON tokenizzati che degradano (alcuni AA-fail) in light. Fix CSS/token surgical, 2 commit isolati su `ui/redesign-cobalt-coral`. NESSUN deploy/push. Build prod su :3200.
- **Commit `ee1d4cd` (CSS, gruppi 1+2):** consolidata la DOPPIA definizione `.live-badge`. La regola a globals.css:335 aveva un `::before` che aggiungeva un secondo pallino sopra il "● LIVE" già nel JSX → "● ● LIVE", e dot rosso pulsante anche su HT/FT. Rimossa la 335 (incl. pill coral). Unica fonte di verità accanto a `.live-score-bar`: dot/pulse SOLO nello stato `live` (classe `.blink`); HT/FT senza dot. Colori per-stato tokenizzati: live→`--am-coral`, HT/paused→`--am-amber`, FT/finished→`--am-muted`; container tint via `--am-coral-b/-dim` + amber rgba + `--am-line-2`; `live-verdict.wrong`→`--am-negative`. Risolve FT slate `#94a3b8` (2.39:1) in light.
- **Commit `4b30dfa` (page.tsx, gruppi 3+4):** sostituiti `green-400`/`green-500` hardcoded con `var(--am-*)` SOLO sulle righe elencate dalla QA. Tennis surface badge (CLAY→amber, GRASS→positive, HARD→cobalt), Place Bet tennis+football, badge value/edge, heartbeat agent (alive→positive/stale→amber/offline→negative, 2 pannelli), legenda History, barra P&L leaderboard. Le altre ~31 occorrenze `green-400` (P&L/ROI/status fuori scope) NON toccate.
- **Tailwind v4 — opacity modifier su arbitrary `var()` FUNZIONA:** `bg-[var(--am-positive)]/10` compila a `color-mix(in oklab, var(--am-positive) 10%, transparent)`. Verificato nel bundle prod. Quindi per superfici/bordi tinti theme-aware si può usare `text-/bg-/border-[var(--am-*)]/NN` direttamente in JSX (niente bisogno di token `-dim`/`-b` dedicati per ogni colore).
- **Harness live (riusabile, gitignored):** `.ui-diff/zoom-livebadge.mjs <theme> <before|after>` (solo classi reali → CSS servita guida il render; before/after del bug strutturale) e `.ui-diff/zoom-live.mjs <theme> [tag]` (inietta markup faithful con classi/token reali per i componenti che NON montano off-season: live-score-bar live/HT/FT, hist-score, surface badge, heartbeat, Place Bet, verdict). Stessa tecnica di `zoom-3way.mjs`. Football live non renderizzabile a runtime (off-season, `/api/live` vuoto) → verifica via markup di test, come la QA.
- **Verifica:** `tsc --noEmit` + `next build` verdi. Visual-diff dark+light su tutti i componenti live (before/after del doppio pallino e degli stati HT/FT, GRASS/HARD badge, Place Bet, heartbeat, verdict) + r4 full profile-states (5 stati × 2 temi, console pulita). :3200 riavviato e HTTP 200.

### 2026-06-08 — UI-REDESIGN PORT legacy → PRODUZIONE (root app/)
- **Correzione critica:** tutto il redesign Cobalt & Coral + account-unify era stato costruito su `dashboard-web/` che è LEGACY (declassata 2026-06-05, NON deployata). La PRODUZIONE è la **root del repo** `~/Desktop/agentic-markets/` (app `app/`, Vercel Root Directory="."). Questa sessione ha PORTATO il redesign su `app/globals.css` + `app/layout.tsx` + `app/page.tsx` (root). Branch `ui/redesign-cobalt-coral`. NESSUN deploy/push.
- **Topologia divergenza (perché NON è copia-incolla):** root e legacy condividono un antenato (`b7ff82d`) ma sono EVOLUTI in parallelo. Root ha avuto fix di produzione che legacy NON ha: tab `match-builder` (#MB-1, condizionale loggati), array `VALID_TABS` (deep-link `?tab=`), label piano divergenti ("Signal Desk Pro"/PRO/FREE/SETUP), il gate "no clear favourite" (commit 355f53d: `surface.below_floor`/`belowFloor`, TRANSLATIONS `no_clear_favorite`/`open_match`, classi `.wc-no-favourite*`), un intero blocco WC (~250 righe CSS, 0 in legacy), e blocchi Task-7 (card blur/CTA/PotD/bonus). `git diff --stat`: globals 586/737, page 1566/1600 — gonfiato proprio da queste divergenze, NON dal redesign.
- **Metodo che ha funzionato (riusabile per port futuri legacy→root):**
  1. Isolare le modifiche redesign dai loro COMMIT (non dal diff dei file): `a3db116` (toggle tema page.tsx), `d408f24` (account-unify page.tsx+css), `c5ffedc`/`5fba7fa` (ProbBar token), `ee1d4cd` (live consolidation), F2-F5 (`globals.css`). Diff per-commit = piccolo, anchored, applicabile.
  2. globals.css: NON whole-file swap (perderebbe WC+Task-7 root-only). Sostituito SOLO il blocco `:root` (token `--am-*` dark+light+alias legacy) escludendo import shadcn/tw-animate-css e `@theme inline` (DORMIENTI: 0 componenti li consumano, pkg non installati a root). Poi sweep deterministico literal→token (verificato che ancestor==root sulle classi bespoke, quindi i pattern matchano).
  3. page.tsx: merge consapevole, preservando match-builder/VALID_TABS/label/gate.
- **Lezione luce (di nuovo!):** il primo passaggio token NON basta. In light molte superfici restano scure perché hardcoded literal (non `var()`). Pattern da tokenizzare SEMPRE per nuovo light: `background:#0d1020`→`--panel`; `rgba(6,7,15,X)`/`rgba(7,16,30,X)` insets→`--am-inset`; bande→`--am-bar`; `linear-gradient(135deg,#22C55E,#16A34A)` (bottoni verdi)→gradiente coral; `#4ade80`/`rgba(74,222,128)` value→`--am-positive`; near-white text→`--text`/`--muted`. Trovati confrontando il diff redesign con le literal ancora presenti a root via script.
- **Gate preservato + MIGLIORATO:** gli 8 righe `.wc-no-favourite*` usano `var(--text)`/`var(--muted)` → ora theme-aware automaticamente (neutri in dark E light, mai coral/verde → non si legge mai come pick). Verificato via getComputedStyle nei 2 temi. `components/world-cup/WcBoard.tsx` NON toccato.
- **shadcn/tw-animate a root:** NON installati e NON necessari — il redesign legacy li importava ma 0 componenti li usano (bridge dormiente). Port mantenuto dependency-free (root resta su lucide+supabase+next, niente shadcn/cva/clsx). Se in futuro si vuole il kit shadcn a root, è un lavoro separato.
- **Verifica:** `tsc --noEmit` 0 errori app (1 errore pre-esistente in `tests/password.test.ts`, fuori scope), `next build` verde DALLA ROOT (`cd ~/Desktop/agentic-markets`). Preview prod `next start -p 3201` (porta dedicata per non confondere con legacy :3200). Visual-diff dark+light su 5 stati (not-logged/free/base/premium/pending), viste Bets+board e Account con sub-nav unificata (Overview/Settings/Assistance/FAQ, default Overview). Rail = 5 voci desk (Bets/Account/History/Leaderboard/Partner) + extra root World Cup/Creator Picks/Match Builder. Console: solo 401 API-dati (no credenziali locali), nessun errore UI/JS. Screenshot in /tmp/qa-*.png.
- **Dev server:** stessa flakiness — `next start` muore se rebuildi nella stessa dir; riavviare dopo ogni build. 401 sugli endpoint dati in locale = atteso (no API keys), è data-state non bug UI.
- **3 commit per area:** `a5ca926` token system+layout, `30db7c8` page.tsx merge, `99c2f11` light-surface tokenization (F3/F5 follow-up trovato in visual-diff).
