# Redesign UI dashboard-web — "Refined Terminal · Cobalt & Coral"

**Data:** 2026-06-08
**Owner design:** Andrea (via Claude Code) + ui-andrea
**Branch base:** `ui/account-unify` (Account unificata + font + token + kit shadcn già presenti)
**Stato:** spec approvanda → poi writing-plans

---

## 1. Obiettivo

Stravolgere l'**estetica** del sito pubblico `dashboard-web` rendendola più attraente, moderna e ad alta energia cromatica, **mantenendo invariata la logica** attualmente deployata. Direzione concordata: aesthetic **Refined Terminal** con palette vibrant **Cobalt & Coral**, in **dark + light** con toggle utente, su **tutte le viste** del sito pubblico.

### Criteri di successo
- Tutte le viste pubbliche adottano la nuova palette e i nuovi trattamenti, in entrambi i temi.
- Zero regressioni funzionali: la logica, i dati, i flussi sono identici al deployato.
- Build verde (`tsc` + `next build`), visual-diff controllato sui 5 stati profilo, in dark e light.
- Toggle dark/light funzionante e persistente.

## 2. Non-goals (vincoli espliciti)

- **Nessuna modifica a logica, dati, API, auth, pagamenti, routing.**
- **Nessun refactor del monolite** `page.tsx`: il restyle vive nel layer CSS/token, non nella struttura React.
- **Nessuna migrazione a componenti shadcn** (era non-surgical su questo codebase — vedi memoria `project-dashboard-web-architecture`). Il kit resta installato solo come fondamenta per UI future.
- **Fascia verde — vincolante (tabella Engagement Ethics, `ui_memory.md`).** Il redesign è puramente estetico. NON si introducono e sono esplicitamente esclusi: ricompense a sorpresa/variabili (voce 1), suspense artificiale o effetti tarati per massimizzare tempo-sul-sito / "dopamina a ogni click" (voce 6/8), FOMO o scarsità finta (voce 3), one-tap re-bet / autoplay (voce 7), near-miss (voce 8). Colore acceso = estetica lecita; loop di compulsione = vietato e fuori scope. Costo/rischio reale sempre visibile; uscita facile quanto l'ingresso.

## 3. Sistema visivo

### 3.1 Tipografia
Invariata rispetto a `ui/account-unify`: **Space Grotesk** (display/UI) + **Space Mono** (dati/label) via `next/font`.

### 3.2 Palette — Cobalt & Coral

Ruoli semantici (validi in entrambi i temi):
- **Primary / corallo** — CTA, nav attiva, top-pick, accento dominante
- **Warm / arancio** — secondario caldo, gradiente con il corallo
- **Cool / cobalto** — dati e output del modello, link, contrappunto freddo
- **Highlight / ambra** — evidenziazioni puntuali
- **Positive / verde** — **solo** P&L positivo / ROI (mai come colore brand)
- **Negative / rosso** — perdite / errori (riuso del rosso esistente)

#### Token tema DARK (default)
```
--am-bg:        #07080F
--am-panel:     #0F1118
--am-panel-2:   #131626
--am-line:      rgba(255,255,255,.08)
--am-text:      #EAECF5
--am-muted:     rgba(234,236,245,.62)
--am-coral:     #FF6B6B   /* primary */
--am-coral-2:   #FB7185
--am-orange:    #FB923C
--am-cobalt:    #3B82F6
--am-cobalt-2:  #60A5FA
--am-amber:     #FBBF24
--am-positive:  #34D399
--am-negative:  #F87171
```

#### Token tema LIGHT (override)
Accenti leggermente approfonditi dove servono come testo/bordo su fondo chiaro (contrasto AA).
```
--am-bg:        #F6F7F9
--am-panel:     #FFFFFF
--am-panel-2:   #F1F3F7
--am-line:      rgba(15,18,30,.10)
--am-text:      #0E1118
--am-muted:     rgba(14,17,24,.60)
--am-coral:     #E5484D   /* primary su light, contrasto AA */
--am-coral-2:   #FF6B6B   /* fill/gradiente */
--am-orange:    #EA7317
--am-cobalt:    #2563EB
--am-cobalt-2:  #3B82F6
--am-amber:     #B5730A
--am-positive:  #0F7A56
--am-negative:  #DC2626
```

> Nota: i token legacy (`--bg`, `--text`, `--muted`, ecc.) restano alias verso gli `--am-*` (impostato in Fase 2 di `ui/account-unify`), quindi cambiare i valori `--am-*` ripropaga su tutte le 264 classi bespoke senza toccarle una a una.

### 3.3 Trattamenti componenti
- **CTA primaria**: gradiente `--am-orange` → `--am-coral`, testo scuro, ombra morbida colorata (no glow pulsante/animato che induca click compulsivo).
- **Nav attiva (rail)**: pill gradiente corallo.
- **Barre probabilità**: gradiente caldo (corallo/arancio) per il favorito, cobalto per dati alternativi; glow **statico** misurato, non animato a loop.
- **Hero "Top pick"**: card con wash gradiente corallo+cobalto, eyebrow ambra.
- **Card standard**: pannello con bordo `--am-line`, profondità sottile, hover discreto.
- **KPI (ROI / hit-rate)**: verde solo se positivo, rosso se negativo, neutro altrimenti.

### 3.4 Tema dark/light — meccanismo
- Default **dark**. Override light via attributo `data-theme="light"` su `<html>` (o `documentElement`), che ridefinisce i token `--am-*` in un blocco `:root[data-theme="light"] { … }` in `globals.css`.
- Toggle in header; preferenza persistita in `localStorage` (`agentic-theme`), con fallback a `prefers-color-scheme` al primo accesso.
- Nessun flash: set del tema il prima possibile (script inline minimale nel layout o classe su `<html>`).

## 4. Approccio implementativo

**CSS-led, zero restructure.** Lo stravolgimento si realizza in due punti:
1. **Layer token** (`globals.css` `:root` dark + blocco `:root[data-theme="light"]`): nuovi valori `--am-*` → ripropagazione automatica su tutte le classi bespoke.
2. **Restyle mirato delle classi bespoke** (`globals.css`): card, rail, bottoni, barre, hero — trattamenti gradiente/ombra/spacing della §3.3.

`page.tsx` si tocca **solo** se serve aggiungere il bottone toggle tema e lo stato relativo (aggiunta minima, non refactor).

### 4.1 Branch
Nuovo branch `ui/redesign-cobalt-coral` a partire da `ui/account-unify` (così eredita Account unificata + font + token).

### 4.2 Fasi (un commit per gruppo, visual-diff a ogni step)
- **F1 — Token + tema**: nuovi `--am-*` dark, blocco light, toggle + persistenza. Visual-diff: tutte le viste devono restare coerenti col solo cambio palette.
- **F2 — Trattamenti core**: rail, CTA, card standard, barre probabilità.
- **F3 — Hero & viste principali**: Bets (hero top-pick), Account + sub-tab.
- **F4 — Viste restanti**: History, Leaderboard, Partner, modali (login/register/crypto-pay), footer.
- **F5 — Light pass**: rifinitura del tema light su tutte le viste (contrasti, ombre).

### 4.3 Verifica (gate di qualità per ogni fase)
- Visual-diff headless 1440×900 sui 5 stati profilo (not-logged / free / base / premium / pending_payment), **in dark e in light**.
- `tsc --noEmit` + `next build` verdi.
- Toggle tema verificato (persistenza + no flash).
- Mobile/responsive: rail→bottom, hero e card adattati.

## 5. Gate di approvazione
Codice di prodotto = medium-risk. L'implementazione procede sul branch; **nessun deploy in produzione** senza PROPOSAL + `APPROVE` umano (Andrea/Michele) come da CLAUDE.md. Merge su main e deploy restano gate separati.

## 6. Rischi e mitigazioni
- **Contrasto su light** (corallo/arancio/ambra su bianco): usati i valori approfonditi §3.2; verifica AA in F5.
- **Componenti context-styled fragili**: alcune classi bespoke hanno override responsive intricati → visual-diff per vista intercetta le regressioni.
- **Flash di tema errato al load**: mitigato con set del tema prima del paint.
- **Glow/animazioni**: tenere statici/sobri per non scivolare in fascia gialla/rossa (vincolo §2).

## 7. Artefatti di design
Mockup di brainstorming in `.superpowers/brainstorm/` (gitignored): direzioni A/B/C, 20 palette dark/light, 8 vibrant, vista Bets con Cobalt & Coral. Palette finale: fusione vibrant #4 (Sunset Blaze) + #7 (Cobalt & Coral).
