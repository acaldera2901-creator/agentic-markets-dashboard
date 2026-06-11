# BetRedge Rebrand — Nome + Logo (Design Spec)

**Data:** 2026-06-11
**Stato:** Design approvato in brainstorming · implementazione in attesa di `APPROVE` (gate prodotto/frontend)
**Scope:** Rebrand identitario **Agentic Markets → BetRedge**. Nome, wordmark/logo, metadata, copy brand, asset. **Nessun ridisegno di layout.**

---

## 1. Decisioni (lockate in brainstorming)

| Tema | Decisione |
|---|---|
| **Posizionamento** | BetRedge con **copy ammorbidito**: tono analisi/segnali/edge predittivo. Vietati `bet` / `odds` / `play` / `profit` espliciti nel copy nuovo. (Mitiga rischio go-live #1 = qualificazione gambling.) |
| **Direzione visiva** | **Base Sleek Coral** (sobria, Hanken Grotesk + JetBrains Mono) **+ accenti BetRedge** (logo, dual-accent coral/cobalt). |
| **Scope di questo giro** | Solo **nome + logo**. No revisione layout, no nuove sezioni. |
| **Tagline** | EN: `PREDICT. ANALYZE. EDGE.` · IT: `PREVEDI. ANALIZZA. ANTICIPA.` |
| **Frontend target** | Root `app/` (canonico, deployato — `vercel.json` alla root). `dashboard-web/` è una copia stale → **fuori scope**. |

**Dual-accent già nei token** (`app/globals.css`): `--am-coral: #FF6A5E` (rosso) + `--am-cobalt: #3B82F6` (blu). Nessun token nuovo necessario.

---

## 2. Wordmark / Logo

**Oggi:** wordmark testuale `.am-wm` → `Agentic Markets` + `.dot` coral (Hanken 800, 18.5px, letter-spacing −0.025em).

**Nuovo wordmark (stessa meccanica, solo contenuto + accento):**

```
Bet R edge  ›
    ^coral   ^coral
```

- `Bet` + `edge` in `var(--text)`; **`R`** e chevron **`›`** in `var(--am-coral)`. La "R" è il perno del portmanteau Bet·R·edge (come nell'inspo).
- Font invariato (Hanken 800, letter-spacing stretto). Niente corsivo "sportsbook" → resta sleek.
- Markup: il contenuto di `.am-wm` cambia da `Agentic Markets<span class="dot">.</span>` a uno span strutturato (`Bet<span class="r">R</span>edge<span class="chev">›</span>`). La regola CSS `.am-wm .dot` viene affiancata/sostituita da `.am-wm .r, .am-wm .chev { color: var(--am-coral) }`.

**Mark circolare (SVG, opzionale):** cerchio sottile con arco ascendente gradiente coral→cobalt ("edge/crescita"). Posizionato a sinistra del wordmark in topbar e usato per favicon/icon. Se in review risulta di troppo → si tiene solo il wordmark testuale. Decisione finale in fase di plan/visual-check.

---

## 3. Inventario stringhe da cambiare (display name)

Tutte le occorrenze user-visible di "Agentic Markets" nel frontend attivo:

| File | Punti | Nota |
|---|---|---|
| `app/layout.tsx` | title metadata | → `BetRedge — Predictive Sports Intelligence` (drop "OS / Trading Desk") |
| `app/page.tsx` | `6067` wordmark, `1793` eyebrow, `2058-2059` risk-note, `208/450/4265` copy partners | risk-note già soft → solo nome |
| `app/privacy/page.tsx` | `5,6` title/desc, `15,104` back-link, `24` controller, `78` disclaimer | display name; **`info@agenticmarkets.com` resta** (vedi §5) |
| `app/admin/page.tsx` | `332` | |
| `app/admin/login/page.tsx` | `38` | |
| `app/world-cup/page.tsx` | `23` title | |
| `app/world-cup/[team]/page.tsx` | `58` title | |
| `components/world-cup/SiteTopbar.tsx` | `79` aria-label, `87` wordmark | usa `.am-wm` → eredita nuovo wordmark |
| `lib/email.ts` | `15-16` from, `60` subject, `69/81/124` header email, `115-116` subject OTP | display name nei template; **indirizzi `@agenticmarkets.com` restano** (§5) |
| `app/api/cron/subscriptions/route.ts` | `26` (+1) header email | |
| `lib/operating-costs.ts` | `1` commento | commento → coerenza, opzionale |
| `app/api/tennis-live/route.ts` | 1 occorrenza (commento) | opzionale |
| `lib/activation.ts` | 1 occorrenza | verificare contesto in plan |

> Inventario di partenza: `grep -rn "Agentic Markets" app components lib`. Il plan ri-esegue il grep come check di completezza.

---

## 4. Asset

- `app/favicon.ico` → nuovo (mark BetRedge).
- Aggiungere `app/icon.svg` (mark vettoriale) — Next la serve automaticamente.
- **Opzionale:** `app/opengraph-image` (oggi assente) per anteprime social brandizzate. Da confermare in plan.

---

## 5. Confine surgical — cosa NON si tocca

Per regola Surgical Changes (Karpathy): si cambia solo ciò che la richiesta impone (nome+logo user-visible).

- **Classi CSS `am-*`** (`.am-wm`, `.am-grain`, `--am-*` token): identificatori interni invisibili. Restano. Rinominare = churn non richiesto.
- **localStorage key `agentic-theme`** (5 usi): rinominarla farebbe **perdere la preferenza tema** agli utenti esistenti. Resta.
- **Repo / dir `agentic-markets`**, package name `dashboard-web`: interni. Restano.
- **Dominio & email tecniche** `agenticmarkets.com`, `info@`, `login@`, `RESEND_FROM`: **nessun dominio BetRedge ancora acquisito** (memoria: "manca dominio"). Si cambia solo il **display name** nei template; gli indirizzi tecnici restano finché non si decide/acquista un dominio BetRedge. → Flag per Andrea.
- **`dashboard-web/`** (copia stale): fuori scope.
- **Doc storici** in `docs/superpowers/plans|specs/`: storia, non si toccano.

---

## 6. Piano di verifica

1. `grep -rn "Agentic Markets" app components lib` → 0 occorrenze user-visible residue (restano solo: commenti interni se non rinominati, indirizzi `@agenticmarkets.com` per scelta §5).
2. `npm run build` verde.
3. Visual-check **da loggato** (cookie Chrome), dark + light: topbar wordmark, eyebrow hero, favicon tab, pagina privacy, login admin, world-cup title.
4. Email: render template attivazione/OTP (preview) → header "BetRedge", from display "BetRedge".
5. Nessuna regressione layout (diff visivo solo su testo brand + colore R/chevron).

---

## 7. Reversibilità & blast radius

- **Blast radius:** solo stringhe/markup brand + 1 regola CSS + asset. Logica invariata.
- **Rollback:** `git revert` del commit. Nessuna migrazione DB, nessun env, nessuna API contract change.
- **Gate:** task medium-risk (codice prodotto). Lo spec è la proposta; l'implementazione parte solo dopo `APPROVE` umano (Andrea/Michele).
