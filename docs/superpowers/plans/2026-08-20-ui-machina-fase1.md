# Restyling BetRedge fase 1 — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`.
> Gli step usano checkbox (`- [ ]`).

**Goal:** il prodotto vero indossa il fondo cinematico, la scala tipografica e il
trattamento delle schede della preview approvata, senza toccare logica, dati o
struttura informativa.

**Architecture:** un foglio nuovo `app/machina.css` importato dopo
`app/globals.css`, con **ogni selettore incapsulato in `[data-mc]`**. Nessuna
regola agisce finché un contenitore non porta l'attributo: il rollout è per
sottoalbero, la rimozione è un attributo in meno. `globals.css` non si tocca.

**Tech Stack:** Next.js (App Router), CSS puro, Playwright per le armature.

**Spec:** `docs/superpowers/specs/2026-08-02-betredge-ui-machina-design.md`

## Global Constraints

- Nessun file sotto `lib/`, `app/api/`, `db/`, `supabase/` nel diff.
- `app/globals.css` non si modifica. I token `--am-*` non si ri-tingono.
- Nessun feature flag nuovo.
- Nessun test nuovo: la verifica sono le armature. Le due suite (`npx vitest run`
  **e** `pytest`) devono restare come sono oggi.
- Struttura informativa delle schede invariata: ordine delle zone, dati,
  stringhe, traduzioni, lucchetto, verdetto, apertura del modal.
- `SLIDE_DEFS` in `app/components/LandingCarousel.tsx` **non si tocca**: deve
  comparire nel diff vuoto.
- Le icone raster custom si aggiungono, non si tolgono: il conteggio dei
  riferimenti `menu-*` / `sport-*` non cala.
- Nessun claim di performance nuovo, nessuna scaletta `01/02/03`.
- Deploy: branch + PR + preview. Nessun merge senza `APPROVE` umano.

### Due scostamenti dalla spec, dichiarati

1. **§7.1 — la copertina della landing non sostituisce l'Edge Scanner.** La spec
   prevedeva copertina + countdown al posto dell'hero. L'hero di oggi contiene
   l'Edge Scanner, che mostra **dati reali** del giorno (`scanLive`,
   `scanCounts` da `/api/predictions`): è già «il prodotto, non il pitch», cioè
   ciò che la spec voleva ottenere. Si veste col sistema nuovo invece di
   demolirlo. Motivo: cancellare un elemento vivo con dati veri per una
   copertina è una perdita, non un restyling.
2. **Il countdown non entra.** Servirebbe o un timer JS (vietato) o un dato dal
   server (tocca `lib/`, vietato dai vincoli). Gli orari di calcio d'inizio sono
   già sulle schede del board, due schermate sotto.

Entrambi sono reversibili e vanno riportati nel PR.

---

### Task 1: il foglio, incapsulato e inerte

Il primo commit non deve cambiare **un pixel**. Serve a provare che il foglio
esiste, compila, e non agisce fuori dal suo scope.

**Files:**
- Create: `app/machina.css`
- Modify: `app/layout.tsx` (una riga di import)
- Source: `docs/ui-machina/machina.css` (579 righe: impianto 1–400, blocco
  `FONDO CINEMATICO` 403–579)

**Interfaces:**
- Produces: l'attributo di scope **`data-mc`** (nessun valore) e le classi di
  scena `mc-scene-stadium` / `mc-scene-court` / `mc-scene-clay` sul medesimo
  elemento. I task successivi non ne introducono altri.

- [ ] **Step 1: copiare il sorgente e togliere ciò che è solo della preview**

```bash
cp docs/ui-machina/machina.css app/machina.css
```

Rimuovere da `app/machina.css`:
- i due blocchi `@font-face` (contengono i segnaposto `{{HANKEN}}` / `{{JBMONO}}`
  e sarebbero CSS invalido — i font arrivano da `next/font`, `app/layout.tsx`);
- le regole della barra di preview: `.pbar`, `.pbar .wrap`, `.pbar b`,
  `.pbar .sp`, `.pchip`, `.pchip.on`, `.pchip:hover`, `.pchip.on:hover`;
- la riga `*{box-sizing:border-box}` (è già in `globals.css`; ripeterla globale
  fuori scope è l'unica regola del foglio che sfuggirebbe all'incapsulamento);
- la frase `Tema unico: il prodotto è a carta chiara` nel commento di testa,
  sostituita da: `Fondo cinematico scuro — vedi la spec, §4.3.`

- [ ] **Step 2: incapsulare ogni selettore in `[data-mc]`**

Regola di trasformazione, applicata a mano e verificata a occhio riga per riga
(il foglio è di 579 righe, non serve uno script):

| sorgente | destinazione |
|---|---|
| `:root{…}` | `[data-mc]{…}` — i token si ereditano nel sottoalbero |
| `body{…}` | `[data-mc]{…}` — fondo, colore, famiglia |
| `body::after{…}` | `[data-mc]::after{…}` |
| `.x{…}` | `[data-mc] .x{…}` |
| `.x .y{…}` | `[data-mc] .x .y{…}` |
| `@media(…){ .x{…} }` | `@media(…){ [data-mc] .x{…} }` |
| `:root,:root[data-theme="dark"],:root[data-theme="light"]{color-scheme:light}` | **cancellare** — il fondo è scuro, e il tema del documento non è affare di questo foglio |

`[data-mc]` deve avere `position:relative` e `isolation:isolate`, così
`::after` e `.bgfix` (z-index negativi) restano dentro il sottoalbero invece di
finire dietro al `<body>` del prodotto.

- [ ] **Step 3: mappare le immagini sui file veri**

Nella preview le `.im-*` erano data-URI. In coda al foglio, il blocco che le
aggancia agli asset già in repo (`public/banners/gen/`, presenti da `a48bb7e`):

```css
/* ── le scene: file veri, non data-URI ── */
[data-mc] .bgfix{background-position:center;background-size:cover}
[data-mc].mc-scene-stadium .bgfix{background-image:url(/banners/gen/scene-stadium.jpg)}
[data-mc].mc-scene-court   .bgfix{background-image:url(/banners/gen/scene-court.jpg)}
[data-mc].mc-scene-clay    .bgfix{background-image:url(/banners/gen/scene-clay.jpg)}
```

- [ ] **Step 4: importare il foglio**

In `app/layout.tsx`, subito dopo `import "./globals.css";`:

```ts
import "./machina.css"; // #UI-MACHINA-0802 — agisce solo dentro [data-mc]
```

- [ ] **Step 5: provare che il foglio è inerte**

```bash
npm run build
npx tsc --noEmit
grep -c "data-mc" app/machina.css          # atteso: > 200
grep -rn "data-mc" app components features --include='*.tsx' | wc -l   # atteso: 0
```

Atteso: build verde, `tsc` pulito, e **zero** occorrenze di `data-mc` nel JSX —
quindi nessuna regola può agire. Se il build fallisce, il colpevole è nel foglio,
non nel prodotto.

- [ ] **Step 6: commit**

```bash
git add app/machina.css app/layout.tsx
git commit -m "feat(ui): il sistema visivo nuovo, incapsulato e inerte (#UI-MACHINA-0802)"
```

---

### Task 2: il fondo cinematico sul desk

Prima superficie accesa. Il desk è dove Andrea guarda per capire se «è quello».

**Files:**
- Modify: `app/app/page.tsx` — il contenitore di pagina del desk (il wrapper che
  contiene testata + rail + contenuto) e l'inserimento di `.bgfix`
- Modify: `app/machina.css` — solo se una regola di `globals.css` vince per
  specificità

**Interfaces:**
- Consumes: `data-mc`, `mc-scene-*`, `.bgfix` dal Task 1.

- [ ] **Step 1: trovare il contenitore di pagina del desk**

```bash
grep -n "className=\"page\|className=\"desk\|className={`page" app/app/page.tsx | head
```

- [ ] **Step 2: accendere lo scope e montare la scena**

Sul contenitore trovato: aggiungere `data-mc` e la classe di scena, e come
**primo figlio** l'elemento della scena:

```tsx
<div className="page mc-scene-stadium" data-mc>
  <span className="bgfix" aria-hidden="true" />
  {/* … contenuto esistente, non toccato … */}
```

`aria-hidden` perché è decorazione: non deve entrare nell'albero
dell'accessibilità.

- [ ] **Step 3: guardare cosa si è rotto, con numeri**

```bash
npm run dev &   # :3000
node docs/ui-machina/src/audit-overflow.mjs   # 0 overflow a 360/390/768/1440
node docs/ui-machina/src/audit-contrast.mjs   # 0 nodi sotto soglia AA
```

Le armature vanno puntate su `http://localhost:3000/app`, non sui file della
preview. Se non accettano un URL come argomento, si aggiunge il parametro **nel
file dell'armatura** (è strumentazione, non prodotto).

Atteso al primo giro: **alcuni nodi sotto soglia**. Il fondo è cambiato sotto a
testo scritto per un altro fondo: è esattamente ciò che l'armatura serve a
trovare. Si correggono nel foglio nuovo — mai in `globals.css`.

- [ ] **Step 4: iterare fino a 0 e commit**

```bash
git add app/app/page.tsx app/machina.css
git commit -m "feat(ui): il desk sul fondo cinematico, contrasto e overflow a zero (#UI-MACHINA-0802)"
```

---

### Task 3: le schede della board

**Files:**
- Modify: `app/app/page.tsx` — `PredictionCard`, `TennisMatchCard`
- Modify: `app/machina.css`

**Interfaces:**
- Consumes: lo scope acceso dal Task 2.
- Produces: `.card-bg` (foto) e `.card-veil` (velatura) come **primi due figli**
  di `article.card`; nient'altro cambia nel markup.

Misura che rende questo task economico: **51 classi di `machina.css` esistono
già nel `className` del prodotto** — `.pred`, `.v2r` e tutte le sue undici
sotto-classi, `.scorebar`, `.teams`, `.league`, `.when`, `.top`, `.fx`,
`.pulse`, `.pred-more`, `.pm-lab`, `.pm-chev`. Il trattamento grafico del §5.2
arriva **senza toccare il JSX**: basta che le regole vivano dentro `[data-mc]`.

- [ ] **Step 1: verificare che il readout non si muova**

Prima di cambiare, fotografare lo stato: per una scheda, l'ordine dei nodi di
testo e le stringhe.

```bash
node -e "1" # segnaposto: si usa l'armatura di contrasto, che stampa i nodi in ordine
node docs/ui-machina/src/audit-contrast.mjs > /tmp/prima.txt
```

- [ ] **Step 2: aggiungere i due figli decorativi**

In `PredictionCard` e `TennisMatchCard`, dentro `article.card`, come primi due
figli:

```tsx
<span className={`card-bg im-${sceneFor(index)}`} aria-hidden="true" />
<span className="card-veil" aria-hidden="true" />
```

`sceneFor` è una funzione **locale al file**, deterministica sull'indice, così
due schede adiacenti non portano la stessa foto:

```ts
// #UI-MACHINA-0802 — la foto segue lo sport, l'alternanza è deterministica
const SCENES_FOOTBALL = ["stadium", "pitch", "action"] as const;
const SCENES_TENNIS = ["court", "clay"] as const;
function sceneFor(sport: "football" | "tennis" | "wc", i: number) {
  if (sport === "tennis") return SCENES_TENNIS[i % SCENES_TENNIS.length];
  if (sport === "wc") return "crowd";
  return SCENES_FOOTBALL[i % SCENES_FOOTBALL.length];
}
```

Le classi `.im-*` si agganciano alle foto **già in repo** (`public/banners/`:
`stadium-night.jpg`, `football-pitch.jpg`, `football-action.jpg`,
`tennis-player.jpg`, `stadium-crowd.jpg`). In fase 1 non si genera nulla.

- [ ] **Step 3: il contrasto per ogni foto usata**

```bash
node docs/ui-machina/src/audit-contrast.mjs
```

Deve dare **0 nodi sotto soglia** con la foto dietro. Se una foto fa scendere
`.teams` o `.v2r-qn` sotto 4,5:1, si scurisce la velatura o si scarta la foto —
non si «aggiusta a occhio».

- [ ] **Step 4: il conteggio meccanico**

```bash
curl -s localhost:3000/app | grep -o 'card-bg' | wc -l     # = numero di schede
curl -s localhost:3000/app | grep -o 'class="card' | wc -l
```

E in console, che gli sfondi ci siano **davvero**:

```js
[...document.querySelectorAll('.card-bg')].filter(e => !getComputedStyle(e).backgroundImage.startsWith('url(')).length  // atteso: 0
```

- [ ] **Step 5: che il readout non si sia mosso**

```bash
node docs/ui-machina/src/audit-contrast.mjs > /tmp/dopo.txt
diff <(grep -o '"[^"]*"' /tmp/prima.txt | sort) <(grep -o '"[^"]*"' /tmp/dopo.txt | sort) | head
```

Atteso: nessuna stringa comparsa o sparita. Se una stringa cambia, il task ha
toccato la struttura e va rifatto.

- [ ] **Step 6: commit**

```bash
git add app/app/page.tsx app/machina.css
git commit -m "feat(ui): la foto dietro le schede, i numeri sugli incassi (#UI-MACHINA-0802)"
```

---

### Task 4: il chrome del desk

**Files:**
- Modify: `app/app/page.tsx` — testata e rail (solo `className`)
- Modify: `components/SiteFooter.tsx`
- Modify: `app/machina.css`

- [ ] **Step 1: contare le icone, prima**

```bash
grep -o "menu-[a-z0-9-]*\|sport-[a-z0-9-]*" app/app/page.tsx | sort | uniq -c | tee /tmp/icone-prima.txt | wc -l
```

- [ ] **Step 2: vestire la testata**

Fascia `--night` piena, filetto `--rule` sotto, wordmark col blocchetto verde,
voci in mono `.66rem` tracking `.16em` uppercase, l'attiva col filetto verde
sotto, badge PRO in `#23A559` su testo scuro. Tutto via regole
`[data-mc] .<classe-esistente>`: **nessun nodo aggiunto o rimosso**.

- [ ] **Step 3: vestire il rail**

Titoli di gruppo in `.t-key`; voce attiva marcata da
`box-shadow: inset 3px 0 0 var(--verde-b)` — **non** da un fondo pieno. Le icone
restano le stesse, stessi file.

- [ ] **Step 4: il footer**

`SiteFooter.tsx` sui token nuovi. Entità legale e 18+ **più visibili, non meno**:
la qualificazione gambling è ancora aperta.

- [ ] **Step 5: le icone non sono calate**

```bash
grep -o "menu-[a-z0-9-]*\|sport-[a-z0-9-]*" app/app/page.tsx | sort | uniq -c > /tmp/icone-dopo.txt
diff /tmp/icone-prima.txt /tmp/icone-dopo.txt   # atteso: nessuna differenza
```

- [ ] **Step 6: armature + commit**

```bash
node docs/ui-machina/src/audit-contrast.mjs && node docs/ui-machina/src/audit-overflow.mjs
git add app/app/page.tsx components/SiteFooter.tsx app/machina.css
git commit -m "feat(ui): testata, rail e footer nel sistema nuovo (#UI-MACHINA-0802)"
```

---

### Task 5: la landing

**Files:**
- Modify: `app/landing-client.tsx` — attributi di scope, nessuna sezione
  rimossa
- Modify: `app/machina.css`
- **Non** modificare: `app/components/LandingCarousel.tsx`

- [ ] **Step 1: accendere lo scope**

Sul contenitore di pagina della landing: `data-mc mc-scene-stadium` + `.bgfix`
come primo figlio, come al Task 2.

- [ ] **Step 2: vestire le sezioni esistenti**

Le sezioni della landing sono `v-hero`, `v-sec` (×5), `v-final`, più `lp-nav` e
`lp-house`. Si scrivono regole `[data-mc] .v-*` che portano il sistema nuovo:
scala tipografica (`t-h1`, `t-lead`), occhiello col filetto da 3px al posto di
`.v-kick`, pannelli su `--card` con filetto `--rule`, verde solo dove significa
soldi. **Nessuna sezione si cancella, nessuna si aggiunge.**

- [ ] **Step 3: il carosello, guardato non toccato**

```bash
git diff --stat app/components/LandingCarousel.tsx   # atteso: nessun output
```

Verificare a occhio sulla preview che le slide siano **7**, che la prima sia
`hero-allsports.jpg` e che il banner si veda **intero** (16:9, logo in alto e
disclaimer in basso non tagliati).

- [ ] **Step 4: armature su `/`**

```bash
node docs/ui-machina/src/audit-contrast.mjs   # 0 sotto soglia
node docs/ui-machina/src/audit-overflow.mjs   # 0 overflow su 4 larghezze
```

- [ ] **Step 5: commit**

```bash
git add app/landing-client.tsx app/machina.css
git commit -m "feat(ui): la landing nel sistema nuovo, il carosello intatto (#UI-MACHINA-0802)"
```

---

### Task 6: la verifica che vale, e il gate

- [ ] **Step 1: le due suite**

```bash
npx vitest run
python3 -m pytest -q
```

`vitest` **non** esegue `tests/`: girano entrambe, e il confronto è col verde di
prima, non con l'assenza di errori.

- [ ] **Step 2: la palette contro le superfici nuove**

```bash
node scripts/validate_palette.js --pairs all --surfaces "#0A0C0F,#0F1216,#15181C"
```

Comando e output **interi** nel PR. Se lo script non accetta `--surfaces`, si
riporta il comando realmente usato: mai un riassunto.

- [ ] **Step 3: il peso**

```bash
npm run build   # e si riporta la dimensione del CSS prima/dopo
```

- [ ] **Step 4: 390px reale, da loggato**

Playwright, non l'estensione Chrome (che non cambia il viewport). Due sessioni:
anonima e **loggata** — metà dei difetti visivi vivono dietro il login.

- [ ] **Step 5: PR, e fermarsi**

```bash
git push -u origin feat/ui-machina
gh pr create --title "Restyling fase 1 — il fondo cinematico sul prodotto (#UI-MACHINA-0802)" --body "…"
```

Nel corpo del PR: i due scostamenti dichiarati, l'output delle armature, il peso
prima/dopo, il link della preview Vercel, e la frase che chiude il gate —
**nessun merge senza `APPROVE` di Andrea o Michele.**

Verificare che la preview Vercel **esista davvero**: l'auto-deploy è già stato
rotto in passato e i merge non deployavano da soli.
