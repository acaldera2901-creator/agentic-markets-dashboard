# PROPOSAL #TEAM-MATCHER-1007 — `matchModelTeam` abbina la squadra sbagliata

> Stato: **PROPOSAL, NON eseguita.** Serve `APPROVE #TEAM-MATCHER-1007` di **Andrea** (informare Michele su `ch_council_main`).
> Branch `hotfix/team-matcher` (worktree `~/Desktop/01-BETREDGE/am-hotfix-matcher`, da `origin/main` 62804a41), **non pushato**.
> Data 2026-10-07 · autore programmatore-andrea · diagnosi di partenza: `proposals/outlier-modello.md` (ml-engineer-agentic).
> Tutte le misure sotto sono **SELECT in sola lettura** + replay offline; nessuna scrittura sul DB.

## 1. Task

`matchModelTeam` (lib/summer-leagues.ts) risolve il nome della fixture contro il roster del modello Poisson
delle 26 leghe «snapshot». Prima cercava, **dentro lo stesso ciclo**, l'uguaglianza OPPURE il contenimento fra
**stringhe**, e restituiva la **prima** squadra del roster che passava. Il roster è `Object.keys(model.strengths)`,
il cui ordine cambia a ogni refresh dello snapshot: il verso dell'errore si ribaltava.
Il modello `football-v4-xg-model` vive in `app/api/predictions/route.ts` (righe ~489-500); il risultato finisce in
`prediction_log`, `unified_predictions` e `pick_ledger` (sigillo al primo passaggio, immutabile).

## 2. Approccio scelto (fix minimale, solo `matchModelTeam`)

1. **Uguaglianza normalizzata su tutto il roster prima di tutto** (diacritici, ł/ø…, maiuscole, punteggiatura, sigle
   della lista dichiarata `NOISE`). Più di una squadra uguale → `null`.
2. **Contenimento a token interi**, solo se la candidata è **unica**; più d'una → `null` (fail-closed: la fixture viene
   saltata, nessuna previsione — è il comportamento già previsto dal route per squadra sconosciuta, riga ~495).
   Due token valgono uguali anche se uno è l'**inizio** dell'altro e il più corto ha ≥4 lettere
   (*deviazione dichiarata* dal brief «token interi»: misurata, vedi §3.4 — senza, 7 nomi veri sparivano dal board).
   Mai una sottostringa a metà parola: è esattamente il difetto («aris» ⊂ «larisa», «rakow» ⊂ «krakow»).
3. La sovrapposizione a soglia 0.6 (#TEAM-MATCH-SAFETY-0727) resta **identica**.
4. `NOISE` + `"ksv"` (lista dichiarata delle sigle: fc, if, ik, bk, afc, sk, fk, ff, aif, cf, sc, club, cd, **ksv**).

Nient'altro cambia: il route, la soglia, i consumer (`lib/odds-join.ts`, `lib/soft-lookup.ts`, che chiamano la stessa
funzione con roster di 1 elemento) non sono toccati.

## 3. Misure (sola lettura) — quanto è esteso

Metodo: `scripts/replay-team-matcher.ts` (committato). Per ogni versione dello snapshot arrivata su `main`
(8 versioni, assegnate a ogni riga per `computed_at`/`captured_at`), ricostruisce il roster esattamente come il route e
confronta matcher VECCHIO (copia verbatim di main @ 62804a41) e NUOVO su ogni nome di `prediction_log` (26 leghe snapshot,
114.794 righe, 1.967 partite, 25/06→07/10). Controllo del metodo: il VECCHIO matcher ricostruisce la probabilità servita
salvata entro 0,5 pp su 31/52 partite, max scarto 1,6 pp (differenze di calibrazione/sorgente nel tempo) — gli errori da
squadra sbagliata sono di 5–17 pp, quindi il segnale è netto.

Export (psql, solo SELECT; il pooler ha ignorato `default_transaction_read_only`, le query sono comunque solo SELECT):
```sql
-- pl_epochs.tsv: match_id, league, home, away, kickoff, <epoca snapshot da computed_at>, count(*)  GROUP BY 1..6
-- pl_last.tsv : DISTINCT ON (match_id) ultima riga con computed_at < kickoff (p_*, model_p_*, market_p_*, result)
-- ledger.tsv  : pick_ledger (source_table='match_predictions') ⨝ pick_settlement_current su (source_table, source_id, model_version)
```
Poi `npx tsx scripts/replay-team-matcher.ts /tmp/matcher-replay`.

### 3.1 `prediction_log`
| | partite | righe |
|---|---|---|
| abbinamento **sbagliato** col vecchio matcher | **49** | **2.926** |
| solo «fortunato» (vecchio giusto per ordine del roster, nuovo → null, ambiguo) | 3 (ARG, «Estudiantes») | 100 |

Per lega (sbagliate): POL 16 · SWZ 9 · BEL 9 · SCO 8 · MLS 7. Coppie (nome fixture → squadra usata dal modello):

| Lega | Nome fixture | Vecchio | Nuovo | partite |
|---|---|---|---|---|
| SWZ | Grasshopper Zürich | **FC Zürich** | null (ambiguo: Grasshoppers / FC Zürich) | 9 |
| POL | Wisła Kraków | **Rakow** («rakow» ⊂ «krakow») | Wisla | 8 |
| POL | Wieczysta Kraków | **Rakow** | Wieczysta Krakow | 8 |
| POL | Cracovia Kraków | **Rakow** | Cracovia | 1 |
| BEL | Club Brugge | **Cercle Brugge KSV** (snapshot 12/08) | Club Brugge | 8 |
| BEL | Cercle Brugge KSV | **Club Brugge** (snapshot 22/09) | Cercle Brugge KSV | 1 |
| MLS | Los Angeles FC | **Los Angeles Galaxy** | Los Angeles FC | 7 |
| SCO | Dundee United | **Dundee** (snapshot 12/08) | Dundee United | 7 |
| SCO | Dundee FC | **Dundee United** (snapshot 22/09) | Dundee | 1 |
| ARG | Estudiantes | Estudiantes L.P. (per caso) | null (ambiguo con Estudiantes de Río Cuarto) | 3 |

Differenze dalla diagnosi ML: **Aris→Larisa non ha mai colpito** una riga servita (le fixture arrivano come «Aris» /
«Aris Thessaloniki» e il roster ha «Aris» prima di «Larisa» in entrambi gli snapshot: uguaglianza vinta per ordine). È
latente, il test lo copre. **Charleroi–Cercle 19/09 NON è sbagliata** (con lo snapshot 12/08 Cercle risolveva esatta);
lo erano le partite di **Club Brugge** fino al 22/09. Nuove rispetto alla diagnosi: **Rakow** (3 squadre di Cracovia) e
**Grasshopper→FC Zürich**.

### 3.2 Brier e record
Ultima riga prima del calcio d'inizio, partite chiuse col mercato, solo le ricalcolabili (n=30; escluse Grasshopper ed
Estudiantes, che il nuovo matcher non serve):
| | Brier 3-vie | argmax giusti |
|---|---|---|
| servito oggi (squadra sbagliata) | 0,5839 | 16 |
| ricalcolato con la squadra giusta | **0,5721** | 15 |
| mercato | 0,5676 | — |
Su tutte le 40 chiuse: servito 0,5719, mercato 0,5558. L'impatto sul Brier di coda (1.604 partite) è piccolo; il danno
vero è sulle singole partite (Cercle–Anderlecht: casa 0,444 servito → 0,313 corretto, mercato 0,275).

### 3.3 Registro sigillato (`pick_ledger` ⨝ `pick_settlement_current`)
**49** righe sigillate su partite colpite (**46** sbagliate + 3 Estudiantes). Esito corrente:
- **con pick e regolate won/lost: 10** → sbagliate **9**: vinte 5 (Club Brugge–Genk ×2 [espn+oddsapi], FC Luzern–Grasshopper,
  Grasshopper–FC Sion, Wisła Kraków–Śląsk [paper]), perse 4 (St Mirren–Dundee United ×2, San Jose–LAFC, Widzew–Wieczysta).
  La decima è Lanús–Estudiantes (vinta, matcher «fortunato»: non toccarla).
- senza pick ma con esito won/lost: 3 (Club Brugge–Antwerp won, Pogoń–Wieczysta won, Thun–Grasshopper lost).
- void: 29 (27 senza pick) · aperte: **7, tutte senza pick** (quindi saranno void per #VOID-SENZA-PICK-0907).
ID: `ledger_affected.json` dello replay (id ledger 110248, 110245, 98009, 93599, 93454 [paper], 93855, 101364, 101462,
93269 · Lanús 110472).

### 3.4 Copertura: cosa il fix TOGLIE dal board
Con il contenimento a token interi *puri* il replay perdeva anche 7 nomi giusti (FC Lausanne-Sport/Lausanne Sports,
Djurgardens IF/Djurgården, Stade Lavallois/Stade Laval, Sint Truiden/Sint-Truidense, Asteras Tripolis/Tripoli,
Amed SK/Amedspor; Estudiantes): da qui la regola del prefisso ≥4. Con la versione proposta restano fuori solo
**Grasshopper Zürich** (prima servita col modello di FC Zürich: va tolta) ed **Estudiantes** (ambigua). Seguito
consigliato, *non* in questo hotfix: alias espliciti `Grasshopper Zürich→Grasshoppers`, `Estudiantes→Estudiantes L.P.`.

### 3.5 Partite FUTURE con previsione sbagliata oggi (ultima riga `prediction_log`)
| Calcio d'inizio (UTC) | Partita | servito (1/X/2) | mercato | servito−mercato max | corretto (nuovo) | `unified_predictions` oggi |
|---|---|---|---|---|---|---|
| 09/10 16:00 | Wieczysta Kraków–Wisła Płock | .441/.253/.306 | .431/.253/.316 | +0,9 | .426/.257/.317 | edge −1,40 · conf 44 · base · no pick |
| 10/10 12:45 | Cracovia–Zagłębie Lubin | .470/.265/.265 | .497/.265/.238 | +2,6 | .450/.273/.277 | edge −5,05 · conf 47 · base |
| 10/10 14:00 | **Cercle Brugge KSV–Anderlecht** | **.444**/.207/.349 | .275/.253/.472 | **+16,9 (casa)** | .313/.245/.441 | **odds 3.47 · edge_percent 15.54** · conf 44 · base |
| 10/10 14:00 | Falkirk–Dundee FC | .459/.253/.288 | .463/.269/.269 | +1,9 | .489/.259/.252 | edge −1,27 · conf 46 · base |
| 11/10 02:30 | LAFC–Vancouver | .324/.254/.422 | .356/.263/.381 | +4,1 (trasf.) | .381/.261/.359 | edge 2,85 · conf 42 · base |
| 11/10 12:00 | Grasshopper–Young Boys | .224/.190/.585 | .190/.190/.620 | +3,5 | **non servita** | edge −6,82 · conf 59 · base |
| 11/10 18:15 | Legia–Wisła Kraków | .467/.254/.278 | .474/.246/.279 | +0,8 | .500/.242/.258 | non in unified (ancora) |
| 12/10 18:30 | GKS Katowice–Wieczysta | .466/.241/.293 | .434/.248/.318 | +3,2 | .518/.222/.260 | non in unified (ancora) |
| 15/10 02:30 | LAFC–Austin | .626/.204/.170 | .655/.198/.147 | +2,2 | .683/.185/.132 | non in unified (ancora) |
| 10/10 20:00 | Central Córdoba–Estudiantes (fortunata) | .266/.333/.401 | .267/.318/.414 | +1,4 | non servita | edge −3,40 · base |

Cosa vedono i clienti oggi: nessuna di queste ha `pick` (tutte sotto il floor), tutte `plan_access base`. **Solo
Cercle–Anderlecht** supera la soglia lobby «High edge» (`EDGE_HIGH_PP` 5 pp su servito−mercato): +16,9 pp →
quasi certamente nella sezione High edge (non verificato via HTTP). Nota onesta: dopo il fix **GKS–Wieczysta** salirebbe
a +8,4 pp sulla casa — non è un bug, è il modello (vedi la coda non calibrata in `outlier-modello.md` §3): motivo in più
per la protezione di presentazione (§9).

## 4. COSA CAMBIERÀ ESATTAMENTE

**File (commit sul branch, nessun altro file):**
| File | Prima | Dopo |
|---|---|---|
| `lib/summer-leagues.ts` | `NOISE` 13 sigle; ciclo unico con `t === src` / `t.includes(src) \|\| src.includes(t)` → `return team` (prima che passa) | `NOISE` + `ksv`; passo 1 uguaglianza su tutto il roster (unica); passo 2 contenimento a token (prefisso ≥4) solo se candidata unica; passo 3 overlap invariato |
| `lib/summer-leagues-matcher.test.ts` (nuovo) | — | 11 test: 4 casi prod in entrambi gli ordini, Wieczysta/Rakow, Wisła/Wisła Płock, KSV, ambiguità → null, prefisso, roster reali di tutte le 26 leghe in entrambi gli ordini (ogni nome → se stesso) |
| `scripts/replay-team-matcher.ts` (nuovo) | — | replay di sola lettura (non importato dall'app) |

Diff del codice (sostanza):
```diff
-const NOISE = new Set([... "club", "cd"]);
+const NOISE = new Set([... "club", "cd", "ksv"]);
+const MIN_PREFIX = 4;
+function samePrefix(a, b) { const [s, l] = a.length <= b.length ? [a, b] : [b, a]; return s.length >= MIN_PREFIX && l.startsWith(s); }
 export function matchModelTeam(sourceName, modelTeams) {
+  const roster = [...modelTeams];
+  const exact = roster.filter((team) => tokens(team).join(" ") === src);
+  if (exact.length === 1) return exact[0];
+  if (exact.length > 1) return null;
+  const contained = roster.filter(/* every token of the smaller name is in the bigger (equal or prefix ≥4) */);
+  if (contained.length === 1) return contained[0];
+  if (contained.length > 1) return null;
   for (const team of roster) {
-    if (t === src) return team;
-    if (t.includes(src) || src.includes(t)) return team;
     ...overlap ≥ 0.6, tie → null (unchanged)
```

**Tabelle:** nessuna migrazione, nessuno schema. Dopo il deploy il cron esistente `/api/predictions/refresh`
(`0 */2 * * *`) scrive come sempre:
- `prediction_log`: **nuove righe** (append) con la squadra giusta; le vecchie restano come storico.
- `unified_predictions`: upsert esistente (`syncMatchPredictionsToUnified`) aggiorna le partite non ancora iniziate.
  Grasshopper–Young Boys e Central Córdoba–Estudiantes **non vengono più ricalcolate**: la riga `unified` già scritta
  resta con l'ultimo valore — vedi passo 5.
- `pick_ledger`: **nessun cambiamento** (vincolo `UNIQUE (source_table, source_id, model_version)` + `REVOKE UPDATE`):
  le 7 aperte restano sigillate coi numeri sbagliati, ma sono **tutte senza pick** → void alla regolazione.

**Passi (owner esecuzione: Andrea o programmatore-andrea su APPROVE):**
1. `git -C ~/Desktop/01-BETREDGE/am-hotfix-matcher fetch origin && git -C … rebase origin/main` → `npx vitest run`,
   `npx tsc --noEmit` verdi (oggi: 230 file / 2.739 test, baseline main 229 / 2.728).
2. `git push -u origin hotfix/team-matcher` → `gh pr create` (titolo `fix(leagues): matchModelTeam mai la squadra
   sbagliata (#TEAM-MATCHER-1007)`). Preview Vercel: `GET /api/predictions` sulla preview, controllare che
   Cercle–Anderlecht abbia casa ≈0,31 e che il log riporti `unmatched team, skipped: Grasshopper Zürich…`.
3. **Merge = deploy in produzione (momento critico).** Prima: `git fetch origin` e verificare che nessun altro merge
   sia in coda negli ultimi minuti (Vercel annulla i deploy intermedi); squash-merge **singolo**, nessun push
   ravvicinato su main. Dopo: `vercel ls` / dashboard → deploy `READY` sullo sha del merge; health `GET /api/health`.
4. **Ricalcolo partite future**: nessun comando speciale, è il cron delle :00 pari. Per non aspettare, un'unica
   chiamata autorizzata: `curl -H "Authorization: Bearer $CRON_SECRET" https://<prod>/api/predictions/refresh`
   (stesso endpoint del cron, append-only, non tocca nulla di sigillato: `pronosticoDaCongelare` salta le partite
   iniziate e `pick_ledger` è in `ON CONFLICT DO NOTHING`).
5. **Righe `unified_predictions` orfane** (Grasshopper–Young Boys, Central Córdoba–Estudiantes): proposta separata,
   *opzionale* e da approvare a parte: `UPDATE unified_predictions SET edge_percent = NULL, notes = coalesce(notes,'') ||
   ' [TEAM-MATCHER-1007: squadra non risolta, stima ritirata]' WHERE external_event_id IN ('oddsapi:8f147dbbad29f65671873cb80f3558f1','oddsapi:4d9ca33b88d61314c79c75fc7a109dec') AND starts_at > now()`
   — oppure lasciarle scadere (entrambe giocano entro l'11/10; edge già negativi, nessuna in High edge). Consiglio: lasciarle.
6. **Righe sigillate già regolate (NON riscriverle).** Strategia più sicura, coerente con `recupera_calcio_1001.py`:
   nuova riga append-only in `pick_settlement` con **stesso `result` e `outcome`** della corrente,
   `settlement_revision = corrente + 1`, `is_backfill = true`,
   `correction_reason = 'marcatura:TEAM-MATCHER-1007 squadra abbinata erroneamente (<nome>→<squadra usata>)'`.
   Il record W/L **non cambia** (nessun esito inventato o cancellato), la riga diventa riconoscibile, e la pagina
   record/calibrazione la esclude dal Brier dichiarandolo: «9 pick regolate (5 vinte, 4 perse) calcolate su una squadra
   abbinata erroneamente: incluse nel record, escluse dal Brier». Script dedicato in dry-run prima, poi `--apply`, in
   una transazione, `ON CONFLICT (source_table, source_id, model_version, settlement_revision) DO NOTHING`; righe: le 9
   id §3.3 + (scelta di Andrea) le 3 senza pick con esito e le 7 aperte dopo la regolazione. **Alternativa** che Andrea
   può preferire: `result='void'` (le 9 escono dal record: 5 vittorie e 4 sconfitte in meno) — più severa, cambia il
   record pubblico, la sconsiglio senza decisione esplicita. **Non** incluso nell'hotfix: è una scrittura su prod da
   approvare con un suo APPROVE.

## 5. Reversibilità / rollback
- Codice: `git revert <sha del merge>` → un solo commit, redeploy automatico; oppure Vercel «Promote» del deploy
  precedente (anche il recovery è un deploy gated: PROPOSAL + APPROVE).
- Dati: il fix non scrive niente di nuovo che le vecchie righe non scrivessero già (append di `prediction_log`, upsert
  `unified`). Passo 6 (se approvato): rollback come owner `DELETE FROM pick_settlement WHERE correction_reason LIKE 'marcatura:TEAM-MATCHER-1007%'`.

## 6. Blast radius
- **Chi usa `matchModelTeam`:** il route delle previsioni (solo leghe snapshot) e, con roster di 1 elemento, `lib/odds-join.ts`
  (fallback a token delle quote, *tutte* le leghe) e `lib/soft-lookup.ts` (corner/cartellini). Su questi due il cambio è:
  niente più sottostringa a metà parola (es. «Aris»≠«Larisa», «Milan»≠«Internazionale Milano» resta com'era), sì
  prefisso ≥4. Non misurato sui nomi del feed quote (non sono salvati): **rischio residuo** di qualche quota in più/in
  meno abbinata per token; il log del route stampa già `quote abbinate per token` / `AMBIGUE` per controllarlo.
- **Effetto sul board:** 9 partite future cambiano numeri; Grasshopper Zürich ed Estudiantes escono dal board finché
  non c'è un alias. Nessun cambio a floor, pagamenti, piani, SEO.
- **Limite noto:** una squadra **assente** dal roster il cui nome contiene per intero quello di un'altra (es. «Cercle Brugge»
  senza Cercle nello snapshot) passa ancora dal passo 2 se la candidata è unica. Oggi il test sui 26 roster reali è verde.

## 7. Piano di verifica
- Prima del merge: test rossi sul vecchio codice (9/10 falliti, verificato), verdi sul nuovo; suite intera; `tsc` 0; eslint 0.
- Preview: Cercle–Anderlecht casa ∈ [0,30; 0,33]; Falkirk–Dundee FC casa ≈ 0,49; LAFC–Austin casa ≈ 0,68; log `unmatched` per Grasshopper.
- Dopo il deploy (prima riga nuova di `prediction_log`, SELECT): `SELECT home_team, away_team, p_home, lambda_home, lambda_away, computed_at FROM prediction_log WHERE match_id='oddsapi:8247c76fda17e722cbfca878c81bad67' ORDER BY computed_at DESC LIMIT 2` → λ ≈ 1,72/1,64 (non 3,38/0,89);
  `unified_predictions.edge_percent` di Cercle–Anderlecht non più 15,54; Cercle fuori dalla sezione High edge.
- Rilanciare `scripts/replay-team-matcher.ts` sulle righe nuove: 0 differenze vecchio/nuovo **errate** oltre a quelle elencate.

## 8. Owner / approvazioni
- Owner esecuzione: Andrea (merge) — programmatore-andrea per PR e verifiche.
- **Serve OK da: Andrea** (`APPROVE #TEAM-MATCHER-1007` per i passi 1–4; APPROVE separati per passo 5 e passo 6).
- Informare **Michele** su `ch_council_main` (record: 9 pick regolate calcolate su squadra sbagliata).

## 9. Proposta SEPARATA (non in questo branch) — protezione sulla presentazione nel route di produzione
Da `outlier-modello.md` §5 (soglie scelte sulla curva storica, non a caso). In `app/api/predictions/route.ts`, dopo il
blend (riga ~535), con `gap = model_p − market_p` per esito:
- **gap > +15 pp** → niente `best_selection`/edge/EV/Kelly/badge «edge» su quell'esito (la riga resta come stima con
  nota «il modello si discosta molto dal mercato: dato da verificare»); così `unified_predictions.edge_percent` e la
  lobby «High edge» (≥5 pp) smettono di mostrare edge falsi.
- **|gap| > 25 pp** → probabilità servita = mercato (peso modello 0) per quella partita.
Effetto misurato sul Brier storico (n 1.604): soglia 15 → 0,6010 (oggi 0,6034, mercato 0,6001). È codice prodotto su
prod → PROPOSAL a sé con test e APPROVE di Andrea; la v3c lo applica già in presentazione.

## 10. Altri matcher della stessa famiglia (censiti, NON toccati: Surgical Changes)
| Dove | Regola | Stesso difetto? |
|---|---|---|
| `lib/odds-join.ts` `abbinaQuote` | chiama `matchModelTeam(nome, [uno])` su entrambe le squadre + candidata unica | ereditava la sottostringa («Aris»→«Larisa»); **corretto da questo fix** |
| `lib/soft-lookup.ts` (corner/cartellini) | idem, ma prende la **prima** fixture dello stesso giorno che combacia | ereditava la sottostringa (corretto); resta il «primo che passa» fra fixture — basso rischio (stesso giorno, due squadre) |
| `lib/understat.ts` `matchTeam` (xG, 5 leghe top) | esatto, poi **sottostringa di stringa** ma solo se unica | stessa classe (es. «inter»⊂«internazionale»), mitigata dall'unicità; xG in shadow (`XG_BLEND_ENABLED`) → nessun effetto sui numeri oggi |
| `lib/dedupe-fixtures.ts` `stessaSquadra` | sottoinsieme di token, blocca sigle ≤4 lettere | «dundee»⊂«dundee united» passa («united» 6 lettere); serve anche l'altra squadra e lo stesso giorno → rischio di fondere due partite, non di sbagliare modello |
| `lib/fp-odds-join.ts` `stessaSquadra` (quote partner) | token, contenimento se `overlap = min`, nessuna unicità qui | «Dundee»≈«Dundee United» → quota partner potenzialmente della partita sbagliata se entrambe le squadre combaciano lo stesso giorno |
| `lib/v3c/*` | non presente su `main` (solo branch v3c) | non verificato su questo branch |
