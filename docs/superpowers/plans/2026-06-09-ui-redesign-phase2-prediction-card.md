# UI Redesign "Sleek Coral" — Fase 2: Atomo PredictionCard (barre + CTA)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development o superpowers:executing-plans. Step con checkbox (`- [ ]`).

**Goal:** Portare le card-predizione (football + tennis) al linguaggio Sleek Coral: **barre probabilità monocromatiche con coral SOLO sull'esito scelto dal modello** (via il rainbow HOME/DRAW/AWAY) e **bottone bet reso sobrio** (via verde/urgenza "🔴 Live —"), mantenendone funzione e logica.

**Architecture:** Modifiche chirurgiche dentro `PredictionCard` (football) e `TennisMatchCard` (tennis) in `app/page.tsx`. Nessun cambio di markup strutturale, nessun cambio di logica/flussi. Il `ProbBar` resta invariato: cambia solo il `color` che gli si passa.

**Tech Stack:** Next.js, React, Tailwind utility classes inline + CSS custom properties `--am-*`.

**Vincolo:** logica invariata. Il **bottone bet resta funzionante** (è il redirect ai bookmaker/sportsbook partner = revenue affiliate, decisione Andrea 2026-06-09): si tocca SOLO il suo aspetto + si toglie il prefisso urgenza "🔴 Live —". `onBetNow`, `onSelect`, `handleSelect`, affiliate, gating: intatti.

**Spec:** `docs/superpowers/specs/2026-06-09-ui-redesign-sleek-coral-design.md` (§4.1, §5, §7 — aggiornata con la decisione CTA).
**Branch:** `ui/sleek-coral-redesign` (continua dalla Fase 1).

---

## Verifica (come Fase 1: build + visivo + no-reg)
- **BUILD OK** = `npm run build` verde.
- **VISUAL OK** = preview Vercel (`vercel deploy --yes`) o dev locale; controllo dark+light: barre grigie con SOLO il pick in coral; bottone bet sobrio (non verde, niente "🔴 Live"); il match coin-flip/below-floor non ha coral su nessuna barra.
- **NO-REG** = cliccando il bottone bet si apre ancora il flusso `onBetNow` (bet slip / redirect); il "+EV" e il toggle "perché" funzionano; click sulle barre tennis seleziona ancora (onSelect).
- **Backup:** `cp app/page.tsx app/page.tsx.bak-p2` (rimuovere a fine fase).

## File coinvolti
- Modify: `app/page.tsx` — `PredictionCard` (bars ~3087-3092, CTA ~3188-3194), `TennisMatchCard` (bars ~3446-3451, CTA ~3501-3508).

---

### Task 1: Football — barre monocromatiche, coral solo sul pick

**Files:** Modify `app/page.tsx` (~3087-3092, dentro `PredictionCard`)

`belowFloor` è già in scope (riga ~2985). Coral solo sull'esito `p.best_selection`; sotto floor nessun coral.

- [ ] **Step 1: Backup** — `cp app/page.tsx app/page.tsx.bak-p2`

- [ ] **Step 2: Sostituisci i 3 `<ProbBar>` (~3087-3092)**

Da:
```tsx
            <ProbBar label="HOME" pct={p.p_home} color="var(--am-coral)"
              odds={p.odds_home} isValue={hasOdds && p.best_selection === "HOME" && isValueBet} />
            <ProbBar label="DRAW" pct={p.p_draw} color="var(--am-amber)"
              odds={p.odds_draw} isValue={hasOdds && p.best_selection === "DRAW" && isValueBet} />
            <ProbBar label="AWAY" pct={p.p_away} color="var(--am-cobalt)"
              odds={p.odds_away} isValue={hasOdds && p.best_selection === "AWAY" && isValueBet} />
```
A:
```tsx
            <ProbBar label="HOME" pct={p.p_home} color={!belowFloor && p.best_selection === "HOME" ? "var(--am-coral)" : "var(--am-muted-2)"}
              odds={p.odds_home} isValue={hasOdds && p.best_selection === "HOME" && isValueBet} />
            <ProbBar label="DRAW" pct={p.p_draw} color={!belowFloor && p.best_selection === "DRAW" ? "var(--am-coral)" : "var(--am-muted-2)"}
              odds={p.odds_draw} isValue={hasOdds && p.best_selection === "DRAW" && isValueBet} />
            <ProbBar label="AWAY" pct={p.p_away} color={!belowFloor && p.best_selection === "AWAY" ? "var(--am-coral)" : "var(--am-muted-2)"}
              odds={p.odds_away} isValue={hasOdds && p.best_selection === "AWAY" && isValueBet} />
```

- [ ] **Step 3: BUILD OK** — `npm run build` verde.
- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): football prob bars monochrome, coral only on model pick (sleek-coral P2)"
```

---

### Task 2: Football — bottone bet sobrio (resta il redirect, via verde/urgenza)

**Files:** Modify `app/page.tsx` (~3188-3194, dentro `PredictionCard`)

- [ ] **Step 1: Sostituisci il bottone bet**

Da:
```tsx
        <button
          className="w-full mt-1 py-1.5 rounded-lg border border-green-400/30 bg-green-400/8 text-green-400 text-xs font-mono tracking-wider hover:bg-green-400/15 hover:border-green-400/50 transition-colors"
          onClick={onBetNow}
        >
          {!isFutureMarket(p.kickoff) ? (lang === "it" ? "🔴 Live — " : "🔴 Live — ") + t.bet_now : t.bet_now}
        </button>
```
A (stile sobrio neutro con hover coral; `onClick={onBetNow}` invariato; tolto il prefisso urgenza):
```tsx
        <button
          className="w-full mt-1 py-1.5 rounded-lg border border-[var(--am-line-2)] bg-[var(--am-panel-2)] text-[var(--am-text)] text-xs font-mono tracking-wider hover:border-[var(--am-coral-b)] hover:text-[var(--am-coral)] transition-colors"
          onClick={onBetNow}
        >
          {t.bet_now}
        </button>
```

- [ ] **Step 2: BUILD OK** — `npm run build` verde.
- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): football bet CTA sober (drop green/live urgency, keep affiliate redirect) (sleek-coral P2)"
```

---

### Task 3: Tennis — barre monocromatiche, coral solo sul favorito (neutro sul coin-flip)

**Files:** Modify `app/page.tsx` (~3446-3451, dentro `TennisMatchCard`)

Coral al leader stretto; su parità (coin-flip, es. Shelton 50/50) nessun coral.

- [ ] **Step 1: Sostituisci i 2 `<ProbBar>`**

Da:
```tsx
              <ProbBar label={(m.player1.split(" ").pop() ?? m.player1)} pct={m.p1} color={m.p1 >= m.p2 ? "var(--am-coral)" : "var(--am-cobalt)"}
                odds={m.odds_p1} isValue={isValue && m.best_selection === "P1"} wideLabel />
```
... e ...
```tsx
              <ProbBar label={(m.player2.split(" ").pop() ?? m.player2)} pct={m.p2} color={m.p1 >= m.p2 ? "var(--am-cobalt)" : "var(--am-coral)"}
                odds={m.odds_p2} isValue={isValue && m.best_selection === "P2"} wideLabel />
```
A:
```tsx
              <ProbBar label={(m.player1.split(" ").pop() ?? m.player1)} pct={m.p1} color={m.p1 > m.p2 ? "var(--am-coral)" : "var(--am-muted-2)"}
                odds={m.odds_p1} isValue={isValue && m.best_selection === "P1"} wideLabel />
```
... e ...
```tsx
              <ProbBar label={(m.player2.split(" ").pop() ?? m.player2)} pct={m.p2} color={m.p2 > m.p1 ? "var(--am-coral)" : "var(--am-muted-2)"}
                odds={m.odds_p2} isValue={isValue && m.best_selection === "P2"} wideLabel />
```

- [ ] **Step 2: BUILD OK** — `npm run build` verde.
- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): tennis prob bars monochrome, coral only on favourite (sleek-coral P2)"
```

---

### Task 4: Tennis — bottone bet sobrio

**Files:** Modify `app/page.tsx` (~3501-3508, dentro `TennisMatchCard`)

- [ ] **Step 1: Sostituisci il bottone bet**

Da:
```tsx
        <button
          className="w-full mt-1 py-1.5 rounded-lg border border-green-400/30 bg-green-400/8 text-green-400 text-xs font-mono tracking-wider hover:bg-green-400/15 hover:border-green-400/50 transition-colors"
          onClick={onBetNow}
        >
          {liveIsOn ? "🔴 Live — " + t.bet_now : t.bet_now}
        </button>
```
A:
```tsx
        <button
          className="w-full mt-1 py-1.5 rounded-lg border border-[var(--am-line-2)] bg-[var(--am-panel-2)] text-[var(--am-text)] text-xs font-mono tracking-wider hover:border-[var(--am-coral-b)] hover:text-[var(--am-coral)] transition-colors"
          onClick={onBetNow}
        >
          {t.bet_now}
        </button>
```

- [ ] **Step 2: BUILD OK** — `npm run build` verde.
- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): tennis bet CTA sober (drop green/live urgency, keep affiliate redirect) (sleek-coral P2)"
```

---

### Task 5: Verifica di fase + cleanup

- [ ] **Step 1: BUILD OK finale** — `npm run build` verde.
- [ ] **Step 2: Deploy preview** — `vercel deploy --yes`, prendi l'URL.
- [ ] **Step 3: VISUAL OK** (dark+light, su preview, da loggato dove serve):
  - Card football: barre grigie, SOLO l'esito del modello in coral; below-floor → tutte grigie.
  - Card tennis: coral solo sul favorito; coin-flip 50/50 → nessun coral.
  - Bottone bet: sobrio (neutro, hover coral), niente verde, niente "🔴 Live —".
- [ ] **Step 4: NO-REG** — il bottone bet apre ancora `onBetNow`; "+EV", "perché", click-su-barra tennis (onSelect) funzionano.
- [ ] **Step 5: Cleanup** — `rm -f app/page.tsx.bak-p2 && git add -A && git commit -m "chore(ui): drop phase-2 backup"`

---

## Self-review (coverage vs spec §4.1/§5/§7)
- Barre monocromatiche + coral solo sul pick (no rainbow) → Task 1 (football) + Task 3 (tennis). ✓
- Bet CTA sobrio, redirect affiliate preservato, no verde/urgenza → Task 2 + Task 4. ✓
- Coin-flip senza accento (onestà calibrazione) → Task 3 (parità → muted). ✓
- Glifi sport nelle card → **rimandati alla Fase 4** (lì si monta lo sprite `SportGlyphSprite` col chrome di pagina); annotato per non lasciare scope nascosto.
- Logica invariata; nessun placeholder; before→after esatti.

## Note
- `--am-muted-2` (neutro) per le barre non-pick: dopo Fase 1 è `#6E7682` (dark) / `#79818D` (light) — leggibile come barra quieta. Se in visual risultasse troppo simile al track, valutare `--am-muted` (più chiaro) — decisione in VISUAL OK.
- Resta fuori-fase il restyle strutturale completo della card al mockup (score-readout inset, layout confidence) → Fase 4 (layout) se vorrai spingerlo oltre il puro de-rainbow/de-green.
