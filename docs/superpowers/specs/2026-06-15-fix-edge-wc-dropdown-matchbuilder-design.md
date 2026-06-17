# Fix bundle — Edge banner · WC place-bet · dropdown · Match Builder

**Data:** 2026-06-15 · **Owner:** Andrea via Claude Code · **Stato:** PROPOSAL (attende APPROVE)

Quattro interventi distinti su BetRedge (`dashboard-web`). Tutti nel working tree; **nessun deploy** senza APPROVE separato. Modifiche chirurgiche, logica invariata dove non richiesto.

---

## 1. Banner "Edge del giorno" — numero coerente

**Bug:** `FeaturedEdge` (`app/app/page.tsx:5414`) **seleziona/ordina** la card per *edge di mercato* (`p.edge`, `pickByEdge` a 5432-5448) ma **mostra** come numero in evidenza il *model edge* (margine tra le 2 probabilità del modello, `modelEdgePts` a 5476-5477 / 5506, reso a 5569-5572). I due numeri sono scollegati → l'edge mostrato sembra casuale.

**Decisione Andrea:** ordinare/selezionare la card con la **stessa** metrica mostrata (model edge), mantenendo il badge "edge modello" (FTC-safe, nessun claim di battere il mercato).

**Cosa cambia esattamente** — solo `FeaturedEdge`:
- Sostituire il comparatore `pickByEdge` (ordina per `edge`) con un ordinamento per **model edge** calcolato per item:
  - Football: `modelEdge(top1, top2)` su `[p_home, p_draw, p_away]` (stessa formula già usata a 5476-5477).
  - Tennis: `modelEdge(max(p1,p2), min(p1,p2))` (come 5506).
- Il confronto finale football-vs-tennis (`fEdge >= tEdge`, 5448) usa lo stesso model edge invece di `edge`.
- I filtri di qualificazione restano (`isFootballBestBet`/`isTennisBestBet` + fallback `…Any`): cambia **solo** la chiave di ordinamento, non l'insieme dei candidati.
- Display invariato (`+X.X pt · edge modello`), ma ora X.X **è** il massimo del giorno e corrisponde al match mostrato.

**Reversibilità:** banale (ripristino comparatore). **Blast radius:** un solo componente, presentazione. **Verifica:** la card mostra il match col model edge più alto e il numero del badge == quel massimo.

---

## 2. WC "Place bet" → dropdown (come football/tennis)

**Bug:** `components/world-cup/WcBoard.tsx:461-469` è un `<a href={p.affiliate?.url || "/app?tab=partners"}>` che naviga **diretto** al partner. Le card football/tennis usano `<PlaceBetMenu>` (dropdown book affiliati).

**Cosa cambia esattamente:**
- In `WcBoard` aggiungere il fetch del flag geo-gate `/api/bet-links` (stesso pattern di `page.tsx:5734-5740`) → stato `betLinksEnabled`.
- Sostituire l'`<a className="betbtn">` con:
  - se `betLinksEnabled`: `<PlaceBetMenu buttonClassName="betbtn" label={…Piazza scommessa…} disclaimer={…} selection={{ sport:"worldcup", league:"WC", homeTeam, awayTeam, market:"1X2", pick, odds:null, eventStartUtc: starts_at }} />` (stessa `selection` shape di `page.tsx:3408-3423`).
  - se non abilitato: fallback all'`<a>` verso `/app?tab=partners` (comportamento attuale, mai un target finto).
- Import di `PlaceBetMenu` in `WcBoard`.

**Reversibilità:** alta (ripristino `<a>`). **Blast radius:** card WC. **Verifica live:** su `/world-cup` il bottone apre il menu book, non naviga via.

---

## 3. Dropdown "buggati" su TUTTE le card — root cause CSS

**Sintomo (Andrea):** i dropdown "Piazza scommessa" sono ancora buggati ovunque. `PlaceBetMenu.tsx` è logicamente corretto (open/close/lazy-load OK).

**Ipotesi root-cause (da confermare LIVE prima del fix):** il dropdown è `position:absolute; z-index:50` dentro `.place-bet-menu.open{z-index:1000}`, ma la card `.pred` (`globals.css:5407`) è `position:relative` **senza** z-index e `.pred:hover` applica `transform` (5419) → stacking context. Il menu aperto viene **dipinto dietro la card successiva** (paint order tra card sorelle). `.pred` non ha `overflow:hidden`, quindi non è clipping ma stacking.

**Fix proposto (dopo conferma live):** alzare nello z-order la card che contiene un menu aperto, es. `.pred:has(.place-bet-menu.open){ z-index: 30 }` (+ eventuale `position:relative` esplicito), così il dropdown copre le card adiacenti. Se `:has()` o il transform-on-hover non bastano, ripiego su portal/`position:fixed` ancorato al bottone. Stessa verifica per la WC dopo il punto 2.

**Reversibilità:** alta (regole CSS additive). **Verifica:** screenshot logged-in del dropdown aperto su prima/ultima card e su griglia multi-colonna; il menu è interamente visibile e cliccabile.

> Nota processo: punti 2-3 verificati **dal vivo, da loggato** (memoria `visual_check_loggato`), non solo da codice.

---

## 4. Match Builder — gating per piano + ricomposizione

**Stato:** `MatchBuilderTab` (`app/app/page.tsx:4167`) riceve `isLoggedIn` ma **non** il `plan`; nessun gating per piano (mostra tutto ai loggati). Reso a `page.tsx:6544`.

### 4a. Gating (decisioni Andrea)
- **Free → niente:** locked gate con upsell (pattern `LockedGate` esistente). Il tab resta visibile ma bloccato.
- **Base → 3 match selezionabili:** solo i **top 3** (per model edge / probabilità) compaiono come righe; gli altri non vengono renderizzati.
- **Premium (+admin_full) → tutti.**

**Cosa cambia esattamente:**
- Passare il piano a `MatchBuilderTab` (nuova prop `plan`, da `clientProfile.plan`) al call-site `6544`.
- All'inizio del render: se `free`/non-loggato → render del `LockedGate` (mode `plan`/`auth`) con CTA upsell, niente lista.
- Per `base`: troncare `items` ai primi 3 ordinati per model edge **prima** del raggruppamento `mbGroups` (4335-4339). Premium/admin: nessun troncamento.
- Helper `profileHasPremium`/`profileHasAccess` (2892-2902) riusati per decidere la soglia.
- Il cap selezioni (max 5, 4292) resta per Premium; per Base il cap effettivo è 3 (non più di quanti ne vede).

### 4b. Ricomposizione layout (disorganizzazione)
Da rivedere **dal vivo** (screenshot logged-in) per individuare i problemi concreti prima di toccare il markup. Direzione: mantenere la griglia 2-col (`mb-layout`), riordinare la colonna sinistra (header "Seleziona 2–5" → gruppi sport più puliti) e la slip destra (conteggio · probabilità combinata · lista · codice influencer · CTA) con gerarchia visiva più netta. Spec di dettaglio dopo l'ispezione live; modifiche solo a markup/CSS `mb-*`, logica invariata.

**Reversibilità:** media (gating = nuove condizioni; layout = markup/CSS). **Blast radius:** tab Match Builder. **Verifica:** free=gate, base=3 righe, premium=tutte; layout coerente su desktop+mobile.

---

## Ordine di esecuzione
1. (1) Edge banner — chirurgico, isolato.
2. (4a) Gating Match Builder — logica isolata.
3. Diagnosi LIVE (loggato): dropdown su card standard + composizione MB.
4. (2)+(3) WC PlaceBetMenu + fix CSS dropdown — poi verifica live.
5. (4b) Ricomposizione MB — dopo diagnosi, poi verifica live.

**Deploy:** GATED, APPROVE separato dopo verifica nel working tree.
