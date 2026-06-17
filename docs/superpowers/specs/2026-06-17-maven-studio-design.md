# Maven Studio — Atelier creativo AI interno

**Data:** 2026-06-17
**Owner:** Andrea
**Stato:** Design approvato (brainstorming) — pronto per writing-plans
**Rischio:** la fase di design è low-risk. La costruzione di codice prodotto passerà dal gate PROPOSAL/APPROVE (`ch_deploy_gate`).

---

## 1. Obiettivo

Creare uno **studio creativo AI interno** — un team di agenti-grafici specializzati, a disposizione di Andrea, che condividono **un unico tool potente** ("Studio Toolkit") assemblato dal meglio dell'ecosistema open-source ("Frankenstein" di repo GitHub) più le capacità di design di Claude.

Lo studio produce tutta la parte grafica dei progetti (a partire da BetRedge). È progettato fin da subito come **base riusabile**: domani lo stesso toolkit verrà esposto a un bot Telegram e all'iniziativa "startup accelerator" (entrambi fuori scope ora).

**Non-obiettivi (ora):** bot Telegram, integrazione accelerator, motion/video, 3D. Sono fasi successive.

## 2. Decisioni prese (brainstorming)

| Tema | Decisione |
|------|-----------|
| Esecuzione del team | **Subagent dentro Claude Code** (come `ui-andrea`), nessuna infra nuova per partire |
| Architettura tool | **Approccio A — Toolkit unico come MCP server, costruito per fasi** |
| Percorsi di creazione | Tutti e tre fusi: Claude-as-designer (codice→render) · design-skill già installate · generazione AI vera (FLUX) |
| Provider cloud generazione/editing | **Entrambi (fal.ai + Replicate), il toolkit instrada per modello** |
| Brand Kit condiviso | **Nel vault Maven-Brain** (master globale; override per progetto in fasi successive) |
| Task di validazione Fase 1 | **Match Result Card BetRedge** (immagine da dati: esito, pick, probabilità calcolata, vinto/perso) |

## 3. Architettura a 3 livelli

```
Livello 1 · IL TEAM (subagent in ~/.claude/agents/)
  Art Director (orchestratore) — riceve brief, scompone, delega, garantisce coerenza via Brand Kit
  ├ Graphic Designer       (impaginazione, cataloghi, brochure, materiale stampa)
  ├ Brand/Visual Designer  (logo, palette, font, manuali identità coordinata)
  ├ UI/UX Designer         (= ui-andrea potenziato — NON un agente nuovo parallelo)
  ├ Motion/Video Designer  (fase 3)
  └ Illustrator / 3D Artist (illustrazioni/icone ora; 3D fase 3)
        ↓ tutti chiamano UN solo tool + le design-skill
Livello 2 · STUDIO TOOLKIT (1 MCP server interno)
  verbi: compose · generate · edit · brandkit
  + design-skills già installate (consultation / shotgun / review)
        ↓ ogni verbo instrada al motore migliore
Livello 3 · MOTORI (Frankenstein di repo)
  compose → Satori/@vercel/og + headless Chrome (Playwright) + sharp  [LOCALE]
  generate → FLUX via fal.ai / Replicate (router per modello)         [CLOUD]
  edit → rembg · Real-ESRGAN · IOPaint                                [locale/cloud]
```

**Principio chiave:** gli agenti sono "persone" sottili (personalità + competenza). Tutta la potenza sta nel toolkit. Cambiare un motore (es. da FLUX a un modello nuovo) **non tocca nessun agente**.

**Il collante = il Brand Kit.** Un contesto condiviso (palette, font, logo, tono, regole d'uso) che l'Art Director possiede e tutti gli agenti leggono → rende l'output **coerente** invece di 6 stili scollegati. Vive nel vault Maven-Brain.

**Anti-duplicazione:** il ruolo "UI/UX Designer" **è** `ui-andrea` potenziato, non un secondo agente. Riusiamo l'esistente.

## 4. Studio Toolkit — il contratto (v1)

MCP server interno. Ogni verbo restituisce **path del file + metadati** e salva gli asset in una cartella `assets/` del progetto.

| Verbo | Cosa fa | Motore (repo) | Dove gira |
|-------|---------|---------------|-----------|
| `compose` | Claude scrive HTML/CSS/SVG on-brand → immagine/PDF. Copre banner, social card, **result card**, brochure/cataloghi, brand sheet, mockup UI, loghi vettoriali | `@vercel/og`+`satori`, headless Chrome (Playwright), `sharp`, skill `make-pdf` | Locale (gratis, deterministico) |
| `generate` | Testo→immagine: foto, illustrazioni, texture, concept logo | **FLUX** via `fal.ai`/`Replicate` (router) | Cloud |
| `edit` | `remove_bg` · `upscale` · `inpaint/cleanup` · varianti | `rembg` · `Real-ESRGAN` · `IOPaint` | Locale o cloud |
| `brandkit` | Legge/scrive il contesto condiviso (palette, font, logo, tono) dal vault Maven-Brain | file nel vault | Locale |

Le **design-skill** (`design-consultation`, `design-shotgun`, `design-review`) restano skill che gli agenti invocano per ragionare sul design — non duplicate dentro il toolkit.

**Insight di scoping:** ~70% del fabbisogno reale (banner, result card, brand identity, UI, social, print) è `compose` → **zero GPU, gratis, on-brand, ripetibile**. I modelli pesanti (e i costi) servono solo per foto/illustrazioni reali.

## 5. Fasi

### Fase 1 — MVP (questo spec)
- Toolkit MCP con `compose` + `generate` + `edit(remove_bg, upscale)` + `brandkit`.
- Agenti: **Art Director + Brand/Visual + Graphic Designer**.
- **Validazione: Match Result Card BetRedge** — vedi §6.

### Fase 2
- Aggiunta **UI/UX (= ui-andrea potenziato)** + **Illustrator**.
- `edit` ricco (inpaint/cleanup), integrazione `design-shotgun`.

### Fase 3
- **Motion/Video**: Remotion (video programmatico code-native, stessa filosofia di `compose`) + video generativo via fal.
- **3D**: TripoSR / Hunyuan3D via Replicate.
- Esposizione del toolkit a **Telegram** e **startup accelerator**.

## 6. Task di validazione Fase 1 — Match Result Card

A fine partita, da **dati reali**, generare un'immagine on-brand BetRedge:
- esito del match (squadre/giocatori, punteggio/risultato);
- la **nostra pick** e la **probabilità calcolata** dal modello;
- **vinto / perso**.

Forma: dati-in → immagine-out, **templato e parametrico** → percorso `compose` puro (Satori/@vercel/og nasce per immagini dinamiche da dati). Zero GPU.

**Fonte dati:** `pick_ledger` + `pick_settlement` (già LIVE e immutabili in prod). Il toolkit legge l'esito settlato e i campi pick/probabilità.

**Vincolo di onestà FTC:** la card mostra la probabilità calcolata e l'esito reale (anche le perse) — coerente con il track-record onesto. Nessun claim "battiamo il mercato". (Cfr. memoria edge/CLV e track-record.)

**Consegna Telegram:** FUORI SCOPE ora. Il toolkit produce l'immagine + metadati; l'invio sul gruppo lo aggancia un passo successivo (bot). La card è progettata in formato adatto a Telegram.

**Criteri di successo (verificabili):**
1. Dato un match settlato reale, il toolkit produce un PNG on-brand corretto (dati giusti, palette/font BetRedge, vinto/perso evidente).
2. Rigenerazione deterministica: stesso input → stessa immagine.
3. Funziona per i casi limite: pick persa, void/unresolved (escluso o marcato), tennis e calcio.
4. L'Art Director valida la coerenza visiva col Brand Kit.

## 7. Distinta dei pezzi (Frankenstein BOM)

| Capacità | Repo / strumento | Note |
|----------|------------------|------|
| compose (render) | `vercel/satori` + `@vercel/og`, `Playwright` headless Chrome, `lovell/sharp` | Locale. Chrome per layout CSS complessi; Satori per OG/card veloci |
| print/PDF | skill `make-pdf` (gstack) | Cataloghi/brochure |
| generate | **FLUX** (Black Forest Labs) via `fal.ai` + `Replicate` | Router per modello/costo |
| edit: remove bg | `danielgatis/rembg` | Locale o cloud |
| edit: upscale | `xinntao/Real-ESRGAN` | |
| edit: inpaint/cleanup | `Sanster/IOPaint` | Fase 2 |
| design intelligence | gstack design-skills + `shadcn` MCP | Già installati |
| motion (F3) | `Remotion` + video generativo (fal) | |
| 3D (F3) | TripoSR / Hunyuan3D via Replicate | |

## 8. Componenti e confini (per implementazione)

Unità isolate, ciascuna con un solo scopo:

1. **MCP server "studio-toolkit"** — espone i 4 verbi. Non contiene logica di dominio BetRedge; è generico.
2. **Router dei motori** — dietro `generate`/`edit`, sceglie fal.ai vs Replicate vs locale per modello/costo. Sostituibile senza toccare i verbi.
3. **Renderer `compose`** — HTML/CSS/SVG → immagine/PDF (Satori/Chrome/sharp). Input = spec di design Claude-authored.
4. **Brand Kit store** — lettura/scrittura del contesto condiviso dal vault Maven-Brain. Interfaccia stabile.
5. **Agenti (persone)** — file in `~/.claude/agents/`: Art Director (orchestratore) + Brand/Visual + Graphic. Solo prompt; chiamano il toolkit.
6. **Template "Match Result Card"** — un template `compose` parametrico + adapter dati da `pick_ledger`/`pick_settlement`. È l'unità che valida la Fase 1.

Confini: un agente non conosce i motori; il toolkit non conosce gli agenti; il template card non conosce il trasporto Telegram.

## 9. Gestione errori (Fase 1)

- `generate`/`edit` cloud: timeout + retry + fallback provider (router). Se entrambi falliscono → errore esplicito, nessun output silenzioso.
- `compose`: errore di render = errore esplicito con il markup che ha fallito (debug).
- Match Result Card: se mancano campi pick/probabilità o l'esito è `unresolved`/void → niente card (o card marcata), mai dati inventati.
- Segreti (API key fal/Replicate): mai in repo; via env. (Coerente con esclusione claude-mem per rischio leak.)

## 10. Test

- `compose`: snapshot test su template card con input fissi → output deterministico (criterio §6.2).
- Router: test che instrada al provider giusto e fa fallback.
- Match Result Card: test su match reali settlati (calcio + tennis), incluso caso pick persa e void.
- Verifica visiva finale (Costruito ≠ Verificato ≠ Operativo): l'Art Director + Andrea validano la card reale prima di dichiararla pronta.

## 11. Decisioni aperte (da risolvere in planning)

- Formato/i esatti della Match Result Card (dimensioni Telegram: square 1080, story 1080x1920?).
- Dove vive il codice del toolkit nel repo `agentic-markets` (es. `studio/` o `tools/studio-toolkit/`).
- Linguaggio del MCP server (Node/TS — coerente con stack Satori/@vercel/og — vs Python).
- Struttura esatta del Brand Kit nel vault Maven-Brain (schema file).

---

*Prossimo passo: writing-plans skill → piano di implementazione dettagliato della Fase 1.*
