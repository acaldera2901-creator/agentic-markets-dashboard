# Redesign Partner & Account — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans or subagent-driven-development. Steps use `- [ ]`.

**Goal:** Trasformare le schede Partner (Spotlight + griglia) e Account (Bento) di BetRedge con card "rich", mantenendo mood Sleek Coral, funzionalità, i18n, dark+light, responsive.

**Architecture:** Modifica chirurgica di `app/app/page.tsx` (riscrittura `PartnerCard`, `PartnersTab`, e del pane "Account" dentro `AccountTab`) + utility CSS riusabili in `app/globals.css`. Nessuna nuova dipendenza. Verifica = `tsc` + build + visual check da loggato (no unit test: è UI in monolite CSS-context).

**Tech Stack:** Next.js 16, React, Tailwind utility + CSS custom props `--am-*`.

**Spec:** `docs/superpowers/specs/2026-06-19-redesign-partner-account-design.md`

---

### Task 1: Utility CSS card "rich" in globals.css

**Files:** Modify `app/globals.css` (append in fondo, dopo i token `--am-*`)

- [ ] **Step 1: Aggiungere le classi** (riusano i token esistenti, funzionano in dark+light perché basate su `--am-*`):

```css
/* ── Rich cards (#REDESIGN-PA-1) ─────────────────────────────── */
.am-card{
  position:relative;border:1px solid var(--am-line);border-radius:14px;overflow:hidden;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.035), transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--am-surface) 92%, #fff 8%), var(--am-surface));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 1px 2px rgba(0,0,0,.35);
}
.am-card::after{ /* dot-grid sottile sfumato */
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:radial-gradient(rgba(127,127,127,.10) 1px, transparent 1px);background-size:13px 13px;
  -webkit-mask-image:linear-gradient(180deg,#000,transparent 70%);mask-image:linear-gradient(180deg,#000,transparent 70%);
}
.am-card-glow{ border-color:var(--am-coral-b);
  background:
    radial-gradient(90% 120% at 0% 0%, var(--am-coral-dim), transparent 55%),
    radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.04), transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--am-surface) 90%, var(--am-coral) 6%), var(--am-surface));
}
.am-card-glow::before{ content:"";position:absolute;width:160px;height:160px;right:-50px;bottom:-70px;border-radius:50%;
  background:radial-gradient(closest-side, var(--am-coral-dim), transparent);filter:blur(6px);pointer-events:none;}
.am-card > *{ position:relative; z-index:1; }
/* watermark logo/glifo che sborda */
.am-wm{ position:absolute;right:-16px;bottom:-22px;opacity:.13;pointer-events:none;transform:rotate(-6deg);z-index:0; }
.am-wm-img{ width:128px;height:128px;background:center/contain no-repeat; }
.am-wm-glyph{ font-size:80px;line-height:1;font-weight:800; }
```

- [ ] **Step 2: Verifica build** — `npm run build` (o `npx tsc --noEmit` per il check rapido). Atteso: nessun errore CSS/TS.
- [ ] **Step 3: Commit** — `git add app/globals.css && git commit -m "feat(ui): rich-card utilities (#REDESIGN-PA-1)"`

---

### Task 2: PartnerCard — card rich + watermark + rel sponsored

**Files:** Modify `app/app/page.tsx` (`PartnerCard`, attuale righe ~5690-5764)

- [ ] **Step 1: Sostituire il contenitore e il box logo.** Cambiare la root da `className="am-surface p-5 space-y-4 flex flex-col"` a `className={\`am-card \${p.featured ? "am-card-glow" : ""} p-5 space-y-4 flex flex-col\`}` (rimuovere lo `style` inline del bordo: il glow lo gestisce la classe). Dopo l'header, prima della chiusura del root div, aggiungere il watermark del logo quando presente:

```tsx
{p.logo_image && (
  <span className="am-wm am-wm-img" style={{ backgroundImage: `url(${p.logo_image})` }} aria-hidden="true" />
)}
```

- [ ] **Step 2: Hardening link affiliato** — sul `<a>` esterno cambiare `rel="noopener noreferrer"` → `rel="nofollow sponsored noopener noreferrer"` (compliance affiliate, come da spec). Lasciare invariati `href={p.url}`, `target`, `onClick={() => trackEvent("partner_click",{partner_id:p.id})}`.
- [ ] **Step 3: Verifica** — `npx tsc --noEmit` (atteso: nessun errore nei file toccati) + visual check rapido dopo Task 3.
- [ ] **Step 4: Commit** — `git add app/app/page.tsx && git commit -m "feat(ui): PartnerCard rich + watermark + rel sponsored"`

---

### Task 3: PartnersTab — Spotlight hero + griglia, rimuovere i 3 contatori

**Files:** Modify `app/app/page.tsx` (`PartnersTab`, attuale righe ~5769-5825)

- [ ] **Step 1: Rimuovere il blocco "Stats strip"** (la `div.grid.grid-cols-3` con i 3 contatori, ~5789-5801). Nessuna sostituzione.
- [ ] **Step 2: Sostituire il render del featured** con uno **Spotlight hero** (usa `.am-card-glow`, logo reale, CTA grande). Il featured resta `PARTNERS.filter(p=>p.featured)` (oggi = FortunePlay). Markup hero (un solo featured atteso; se >1, map):

```tsx
{featured.map((p) => (
  <div key={p.id} className="am-card am-card-glow p-6">
    <div className="text-[9px] font-mono text-[var(--am-coral)] uppercase tracking-widest">{t.partners_status_featured}</div>
    <div className="flex items-center gap-3 mt-2">
      <div className="w-14 h-14 rounded-xl bg-[var(--am-inset)] border border-[var(--am-line)] p-1.5 shrink-0 overflow-hidden">
        {p.logo_image
          ? <img src={p.logo_image} alt={p.name} className="w-full h-full object-contain" width={48} height={48} />
          : <span className="grid place-items-center w-full h-full font-bold">{p.logo_initials}</span>}
      </div>
      <span className="text-2xl font-bold text-[var(--am-text)] tracking-tight">{p.name}</span>
    </div>
    <p className="text-xs font-mono text-[var(--am-muted)] leading-relaxed mt-2 max-w-md">
      {lang === "it" ? p.description : (p.description_en ?? p.description)}
    </p>
    {p.url && (
      <a href={p.url} target="_blank" rel="nofollow sponsored noopener noreferrer"
         onClick={() => trackEvent("partner_click", { partner_id: p.id })}
         className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-[10px] font-bold text-[13px] bg-[var(--am-coral)] text-[var(--am-coral-ink)]">
        {lang === "it" ? `Vai a ${p.name} →` : `Go to ${p.name} →`}
      </a>
    )}
    {p.logo_image && <span className="am-wm am-wm-img" style={{ backgroundImage: `url(${p.logo_image})`, width: 150, height: 150 }} aria-hidden="true" />}
    <p className="text-[9px] font-mono text-[var(--am-muted-2)] italic mt-3">{t.partners_affiliate_note}</p>
  </div>
))}
```

- [ ] **Step 2b:** Mantenere il blocco "Others" (griglia) invariato nella logica (`others.map(p => <PartnerCard .../>)`); le card ora sono rich via Task 2. Tenere la riga finale 18+/responsabilità se presente, altrimenti aggiungere sotto la griglia: `<p className="text-[10px] font-mono text-[var(--am-muted-2)] mt-2">18+ · {t.partners_affiliate_note}</p>` (riusa chiave esistente, niente stringhe nuove non i18n).
- [ ] **Step 3: Verifica** — `npx tsc --noEmit` pulito.
- [ ] **Step 4: Commit** — `git commit -am "feat(ui): PartnersTab spotlight hero + griglia, rimossi contatori"`

---

### Task 4: Account pane → Bento

**Files:** Modify `app/app/page.tsx` (`AccountTab`, pane `section === "account"`, ~6557+). **Prerequisito:** leggere `ClientAreaTab` (~6368) per capire quali campi di `profile` rende oggi (piano, prezzo, rinnovo, carta, "Gestisci abbonamento" — quest'ultimo gated da `NEXT_PUBLIC_STRIPE_ENABLED`) e quali handler usa, così la **tile Piano** riusa ESATTAMENTE quella logica/quei dati (NON duplicarla: estrarre il markup in tile, o comporre `ClientAreaTab` dentro la tile grande). La subnav Account/Piani e il pane "Piani" (`PlansTab`) restano invariati.

- [ ] **Step 1:** Sostituire il contenuto di `section==="account"` con una griglia bento `<div className="grid grid-cols-1 sm:grid-cols-4 gap-3">`:
  - Tile **Piano** (`am-card am-card-glow`, `sm:col-span-2 sm:row-span-2`): piano/prezzo/stato/rinnovo/carta + CTA "Gestisci abbonamento" — **dai dati e handler esistenti di ClientAreaTab** (fail-soft se assenti). Watermark glifo "PRO" via `<span className="am-wm am-wm-glyph text-[var(--am-coral)]">PRO</span>`.
  - Tile **Membro dal** (`am-card`, `col-span-2`): `profile?.created_at` formattato (riusa l'helper data già nel file se presente; altrimenti `new Date(...).toLocaleDateString(lang)`). Nasconde la tile se `created_at` assente.
  - Tile **Cambia piano** (`am-card`, `col-span-2`): chips Free/Base/Pro (corrente evidenziato con `am-coral-dim`), click → `setSection("piani")`.
  - Tile **Impostazioni** (`am-card`, `col-span-2`): apre/contiene `SettingsTab` (lingua/fuso/unlock/save — props invariati `onUnlock,onSave`).
  - Tile **Sessione** (`am-card`, `col-span-2`): bottone logout (`onLogout`), reso solo se `profile` presente (come oggi).
  - In coda: `<AccountHelpFooter />` invariato.
- [ ] **Step 2:** NESSUNA statistica globale (Pick/Hit) come dato account (spec). Solo dati reali del profilo.
- [ ] **Step 3: Verifica** — `npx tsc --noEmit` pulito; nessun handler/prop rimosso (cercare che `onLogout,onUnlock,onSave,onActivateFree,onPaymentSubmit,onOpenDesk` siano ancora cablati).
- [ ] **Step 4: Commit** — `git commit -am "feat(ui): Account pane bento (piano-first)"`

---

### Task 5: Verifica finale + visual check

- [ ] **Step 1:** `npx tsc --noEmit` → 0 errori nei file toccati; `npm run build` verde.
- [ ] **Step 2: Visual check da loggato** (regola Andrea) su dev server: Partner + Account, in **dark E light**, profilo **free / base / pro**, desktop + mobile (bento → 2col/stack). Verificare: logo FortunePlay reale, glow, watermark, CTA, cambio piano, logout, lingua. Screenshot per Andrea.
- [ ] **Step 3:** Niente bonus inventati nel render (CTA neutra). Niente regressioni funzionali.
- [ ] **Step 4: PR + deploy** = gate (APPROVE Andrea), come da workflow standard (worktree → PR → merge → auto-deploy → verifica live).

---

## Self-review
- **Copertura spec:** Bento Account (T4), Spotlight+griglia Partner (T2/T3), card rich+glow+watermark+dot-grid (T1/T2/T3), logo reale (T2/T3), rimozione contatori (T3), rel sponsored/18+ (T2/T3), i18n riusate (nessuna stringa hardcoded nuova salvo "Vai a {name} →"/"Go to {name} →" e "Membro dal" — **da spostare in chiavi i18n** durante T3/T4 per coerenza 5 lingue), dark+light via `--am-*` (T1), responsive (T3/T4), no deps. ✔
- **Placeholder:** nessun TODO irrisolto; bonus volutamente assente (FTC).
- **Coerenza tipi:** classi `am-card`/`am-card-glow`/`am-wm` usate identiche in T1→T4.
- **Nota:** le stringhe nuove ("Vai a …", "Membro dal") vanno aggiunte ai dizionari i18n (IT/EN/ES/FR/RU) nello stesso commit che le introduce — non lasciarle hardcoded.
