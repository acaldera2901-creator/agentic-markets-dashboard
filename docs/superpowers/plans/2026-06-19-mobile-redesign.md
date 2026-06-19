# Mobile Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans o subagent-driven-development. Step con checkbox.

**Goal:** Su mobile (≤760px) sostituire il "muro di menu" (`.sports-rail` impilata) con una **bottom tab bar** content-first, banner WC compatto e header snello — desktop pixel-invariato.

**Architecture:** Modifica chirurgica `app/app/page.tsx` (JSX: nuova bottom bar in `.portal-root`, entry-point Match Builder in Prediction, gestione controlli header su mobile) + `app/globals.css` (stili bottom bar, hide `.sports-rail`/`.am-tt` su mobile, padding contenuto, banner compatto). Tutto dietro `@media (max-width:760px)`. No nuove dipendenze. Verifica = tsc + visual check mobile (no unit test: UI monolite).

**Tech Stack:** Next.js 16, React, CSS custom props `--am-*`. Anchor: `.sports-rail`(7784), `.am-topnav`(7720, già `display:none` mobile @3983), `.portal-root`(7683), `.portal-desk`(7782), `.am-tt`(7740), `navItems`, `RAIL_GLYPHS`.

**Spec:** `docs/superpowers/specs/2026-06-19-mobile-redesign-design.md`

---

### Task 1: CSS bottom tab bar + hide muro su mobile

**Files:** Modify `app/globals.css` (append in fondo)

- [ ] **Step 1: Append stili** (theme-aware via `--am-*`, safe-area iOS):

```css
/* ── Mobile bottom tab bar (#MOBILE-1) — solo ≤760px, desktop invariato ── */
.am-bottomnav { display: none; }
@media (max-width: 760px) {
  /* il muro di menu (sidebar) sparisce: lo sostituisce la bottom bar */
  .sports-rail { display: none !important; }
  /* contenuto a tutta larghezza + spazio per la barra fissa */
  .portal-columns { display: block !important; }
  .portal-desk { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important; }
  /* header snello: nascondi toggle tema su mobile (resta in Account) */
  .am-tt { display: none !important; }

  .am-bottomnav {
    display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    background: color-mix(in srgb, var(--am-bg2) 92%, transparent);
    backdrop-filter: blur(10px); border-top: 1px solid var(--am-line);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .am-bottomnav .bn {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 8px 2px 7px; color: var(--am-muted-2); font-family: var(--mono, ui-monospace);
    font-size: 9px; letter-spacing: .03em; background: none; border: 0; cursor: pointer; min-width: 0;
  }
  .am-bottomnav .bn svg { width: 20px; height: 20px; }
  .am-bottomnav .bn.on { color: var(--am-coral); }
  .am-bottomnav .bn .bn-l { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
```

- [ ] **Step 2: Verifica** — `npx tsc --noEmit` (CSS non rompe TS) e build dopo i task JSX.
- [ ] **Step 3: Commit** — `git add app/globals.css && git commit -m "feat(mobile): css bottom tab bar + hide rail (#MOBILE-1)"`

---

### Task 2: JSX bottom tab bar in portal-root

**Files:** Modify `app/app/page.tsx` — dentro `<main className="portal-root">` (7683), come ULTIMO figlio prima della chiusura `</main>`.

- [ ] **Step 1: Definire i 5 tab** subito prima del `return (<main className="portal-root">` del Dashboard (riusa `setTab`/`setAccountSection`/`uiLanguage`):

```tsx
const BOTTOM_TABS: { tab: Tab; label: string; glyph: string }[] = [
  { tab: "bets",        label: tNav.nav_predictions, glyph: RAIL_GLYPHS["bets"] ?? "#g-desk" },
  { tab: "history",     label: tNav.nav_history,     glyph: RAIL_GLYPHS["history"] ?? "#g-desk" },
  { tab: "leaderboard", label: tNav.nav_leaderboard, glyph: RAIL_GLYPHS["leaderboard"] ?? "#g-desk" },
  { tab: "partners",    label: tNav.nav_partner,     glyph: RAIL_GLYPHS["partners"] ?? "#g-desk" },
  { tab: "account",     label: "Account",            glyph: RAIL_GLYPHS["account"] ?? "#g-desk" },
];
```

- [ ] **Step 2: Inserire la barra** come ultimo figlio di `<main className="portal-root">` (prima di `</main>`):

```tsx
      <nav className="am-bottomnav" aria-label="Mobile navigation">
        {BOTTOM_TABS.map((b) => (
          <button
            key={b.tab}
            className={`bn ${tab === b.tab ? "on" : ""}`}
            aria-current={tab === b.tab ? "page" : undefined}
            onClick={() => { setTab(b.tab); if (b.tab === "account") setAccountSection("account"); trackEvent("tab_click", { meta: { tab: b.tab, src: "bottomnav" } }); }}
          >
            <svg aria-hidden="true"><use href={b.glyph} /></svg>
            <span className="bn-l">{b.label}</span>
          </button>
        ))}
      </nav>
```

- [ ] **Step 3: Verifica** — `npx tsc --noEmit` pulito; `RAIL_GLYPHS` ha chiavi per bets/history/leaderboard/partners/account (verificare; se manca una chiave il fallback `#g-desk` regge).
- [ ] **Step 4: Commit** — `git commit -am "feat(mobile): bottom tab bar (5 voci) in portal-root"`

---

### Task 3: Entry-point Match Builder dentro Prediction (mobile)

**Files:** Modify `app/app/page.tsx` — header della scheda Prediction (`UnifiedBetsTab`, dopo il titolo "Prediction"/descrizione).

- [ ] **Step 1: Aggiungere un bottone mobile-only** (classe `.mb-entry`, visibile solo ≤760px via CSS) che porta al Match Builder, accanto/sotto al titolo Prediction:

```tsx
<button className="mb-entry" onClick={() => onGate ? null : null}>{/* placeholder rimosso al passo 2 */}</button>
```

- [ ] **Step 2: Wiring reale** — `UnifiedBetsTab` non ha `setTab`; passare una prop `onOpenMatchBuilder?: () => void` da Dashboard (`onOpenMatchBuilder={() => setTab("match-builder")}`) e renderla:

```tsx
{onOpenMatchBuilder && (
  <button className="mb-entry" onClick={onOpenMatchBuilder}>
    {uiLanguage === "it" ? "Match Builder →" : "Match Builder →"}
  </button>
)}
```

- [ ] **Step 3: CSS** in `globals.css` (dentro la sezione mobile o globale con hide desktop):

```css
.mb-entry { display: none; }
@media (max-width: 760px) {
  .mb-entry { display: inline-flex; align-items: center; gap: 6px; margin: 4px 0 12px;
    font-family: var(--mono, ui-monospace); font-size: 12px; padding: 7px 12px; border-radius: 9px;
    border: 1px solid var(--am-coral-b); color: var(--am-coral); background: var(--am-coral-dim); }
}
```

- [ ] **Step 4: Verifica** — `npx tsc --noEmit` pulito; su desktop `.mb-entry` resta `display:none`.
- [ ] **Step 5: Commit** — `git commit -am "feat(mobile): entry-point Match Builder in Prediction"`

---

### Task 4: Banner WC top compatto su mobile

**Files:** Modify `app/globals.css`. **Prereq:** individuare il selettore del ribbon WC "World Cup is live" in alto (probabile `.portal-top-banner` / classe del HouseBanner billboard, o un componente WC dedicato — cercare in page.tsx/components la stringa renderizzata e la sua classe). Documentare il selettore trovato qui prima di scrivere.

- [ ] **Step 1: Trovare il selettore** (grep "World Cup is" / classe del ribbon top). Registrare: `SELETTORE = <…>`.
- [ ] **Step 2: CSS mobile** — forzare 1 riga, ellissi, niente overflow:

```css
@media (max-width: 760px) {
  /* <SELETTORE> .testo */ {
    /* white-space: nowrap; overflow: hidden; text-overflow: ellipsis; */
  }
}
```
(riempire col selettore reale; obiettivo: testo su 1 riga, X non sovrapposta).

- [ ] **Step 3: Verifica** — visual check: banner WC 1 riga, leggibile, X cliccabile.
- [ ] **Step 4: Commit** — `git commit -am "fix(mobile): banner WC compatto 1 riga"`

---

### Task 5: Verifica finale + visual check

- [ ] **Step 1:** `npx tsc --noEmit` 0 errori; `npm run build` verde.
- [ ] **Step 2: Visual check mobile (390px)** dark+light: si atterra su Prediction (contenuto), bottom bar coi 5 tab funzionante (ogni tab cambia vista), Match Builder raggiungibile dal bottone in Prediction, World Cup/Creator come banner, contenuto non coperto dalla barra, banner WC 1 riga, header senza toggle tema.
- [ ] **Step 3: Desktop invariato (1280px):** sidebar/topnav/header come prima; `.am-bottomnav` e `.mb-entry` `display:none`.
- [ ] **Step 4: PR + preview** → gate APPROVE Andrea → merge → prod.

---

## Self-review
- **Copertura spec:** bottom bar 5 voci (T2 + T1 css) ✔ · hide sidebar mobile (T1) ✔ · Match Builder entry-point (T3) ✔ · banner WC compatto (T4) ✔ · header snello/no theme toggle mobile (T1 `.am-tt` hide) ✔ · desktop invariato (tutto dietro `@media 760`) ✔ · dark+light via token ✔ · i18n riusate (`nav_*`) ✔.
- **Scostamento dichiarato vs spec:** lo spec diceva "DARK/LIGHT + lingua spostati DENTRO Account". Qui (T1) **nascondo il toggle tema su mobile** (default dark) e **mantengo la lingua** nell'header (è 1 pill compatta), per evitare il plumbing theme→AccountTab. Il "move completo in Account" resta follow-up se Andrea lo vuole. ⚠️ confermare con Andrea.
- **Placeholder:** T4 ha il selettore da individuare (step esplicito al passo 1, non un TODO silenzioso). T3 step1 placeholder rimosso esplicitamente al passo 2.
- **Coerenza tipi:** `BOTTOM_TABS`/`.am-bottomnav`/`.bn`/`.mb-entry` usati identici tra T1–T3; `onOpenMatchBuilder` definito in T3 e passato da Dashboard.
