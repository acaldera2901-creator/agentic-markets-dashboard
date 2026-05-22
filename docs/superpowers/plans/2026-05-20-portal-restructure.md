# AgenticMarkets Portal Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare la dashboard da app multi-tab con sidebar complessa a portale operativo con layout a 5 colonne, navigazione ridotta a 5 voci e Bets come pagina default.

**Architecture:** Layout esterno fisso (top banner → brand row → left-col | desk | right-col → bottom banner). Il desk centrale ha una sidebar ridotta a 5 voci. Tutti i dati prediction confluiscono in un unico tab Bets. Componenti esistenti vengono riutilizzati dove possibile, non riscritti.

**Tech Stack:** Next.js 16, React, TypeScript, CSS custom properties (no Tailwind nel CSS core), Vercel deploy.

**Regole operative (da lezioni apprese 2026-05-20):**
- Max ~200 righe di diff per task
- `npm run build` obbligatorio dopo ogni task
- NON deployare su Vercel fino al Task 6 finale
- Leggere l'intero blocco CSS/TSX interessato prima di modificarlo

---

## File coinvolti

| File | Operazione |
|---|---|
| `app/page.tsx` | Modifica — Tab type, nav, layout render, nuovi tab wrapper |
| `app/globals.css` | Modifica — nuovo layout portale, classi sponsor slot, pulizia classi vecchie |
| `app/layout.tsx` | Nessuna modifica |
| `app/api/*` | Nessuna modifica |

---

## Task 1: Nuovo tipo Tab e nav a 5 voci (Bets default)

**Files:**
- Modify: `app/page.tsx` — righe ~726 (type Tab) e ~4673 (useState tab) e ~4940 (navItems)

**Obiettivo:** Cambiare la struttura di navigazione senza toccare ancora il rendering. Dopo questo task la build deve passare e il sito funzionare con Bets come tab default.

- [ ] **Step 1.1: Aggiorna il tipo Tab**

Trova riga ~726:
```
type Tab = "overview" | "predictions" | "sports" | "bets";
```
Sostituisci con:
```typescript
type Tab = "bets" | "client-area" | "settings" | "assistance" | "faq";
```

- [ ] **Step 1.2: Aggiorna il tab default**

Trova riga ~4673:
```
const [tab, setTab] = useState<Tab>("overview");
```
Sostituisci con:
```typescript
const [tab, setTab] = useState<Tab>("bets");
```

- [ ] **Step 1.3: Sostituisci tutti i setTab con valori vecchi**

Cerca e sostituisci tutti i `setTab("overview")` con `setTab("bets")`.
Cerca e sostituisci `setTab("sports")` con `setTab("bets")`.
Cerca e sostituisci `setTab("predictions")` con `setTab("bets")`.
Cerca e sostituisci `setTab("plans")` con `setTab("client-area")` se presente.
Cerca e sostituisci `setTab("partner")` con `setTab("client-area")` se presente.
Cerca e sostituisci `setTab("settings")` con `setTab("settings")` (già ok).

- [ ] **Step 1.4: Aggiorna navItems (~riga 4940)**

Trova il blocco `const navItems` e sostituisci con:
```typescript
const navItems: { tab: Tab; label: string }[] = [
  { tab: "client-area", label: lang === "it" ? "Client Area" : "Client Area" },
  { tab: "bets",        label: lang === "it" ? "Bets" : "Bets" },
  { tab: "settings",    label: lang === "it" ? "Impostazioni" : "Settings" },
  { tab: "assistance",  label: lang === "it" ? "Assistenza" : "Assistance" },
  { tab: "faq",         label: lang === "it" ? "FAQ" : "FAQ" },
];
```

- [ ] **Step 1.5: Aggiorna guardie tab nel click handler (~riga 5042)**

Trova:
```
if (!hasClientProfile && ["predictions", "sports", "bets"].includes(item.tab)) {
```
Sostituisci con:
```typescript
if (!hasClientProfile && ["bets"].includes(item.tab)) {
```

- [ ] **Step 1.6: Aggiorna le h2 e eyebrow nel book-main-head (~riga 5066)**

Trova il blocco:
```
{tab === "overview" && tUI.page_overview}
{tab === "predictions" && tUI.page_bestbets}
{tab === "sports" && tUI.page_sports}
{tab === "bets" && tUI.page_bets}
```
Sostituisci con:
```typescript
{tab === "bets" && (lang === "it" ? "Bets" : "Bets")}
{tab === "client-area" && (lang === "it" ? "Client Area" : "Client Area")}
{tab === "settings" && (lang === "it" ? "Impostazioni" : "Settings")}
{tab === "assistance" && (lang === "it" ? "Assistenza" : "Assistance")}
{tab === "faq" && "FAQ"}
```

- [ ] **Step 1.7: Aggiorna il rendering dei tab (~riga 5081)**

Avvolgi tutti i tab render esistenti in fallback temporaneo:
```typescript
{tab === "bets" && (
  <div style={{padding: "20px", color: "white"}}>Bets tab — coming in Task 3</div>
)}
{tab === "client-area" && (
  <div style={{padding: "20px", color: "white"}}>Client Area — coming in Task 4</div>
)}
{tab === "settings" && (
  <SettingsTab ... /> // mantieni quello esistente
)}
{tab === "assistance" && (
  <div style={{padding: "20px", color: "white"}}>Assistance — coming in Task 5</div>
)}
{tab === "faq" && (
  <div style={{padding: "20px", color: "white"}}>FAQ — coming in Task 5</div>
)}
```
Per Settings passa le stesse props di prima (draft, betfair, setDraft, ecc.).

- [ ] **Step 1.8: Verifica build**
```bash
cd ~/Desktop/sistema-andrea/agentic-markets/dashboard-web && npm run build
```
Expected: `✓ Compiled successfully`, 0 TypeScript errors.

---

## Task 2: Nuovo layout portale (CSS + wrapper HTML)

**Files:**
- Modify: `app/globals.css` — aggiungi classi portale
- Modify: `app/page.tsx` — avvolgi il `<section className="book-layout">` nel nuovo wrapper

**Obiettivo:** Aggiungere top banner, brand row, colonne ads laterali e bottom banner attorno al desk esistente. Il desk interno rimane invariato in questo task.

- [ ] **Step 2.1: Aggiungi classi CSS portale alla fine di globals.css**

```css
/* ── Portal layout ───────────────────────────────────────────── */

.portal-root {
  display: grid;
  gap: 0;
  min-height: 100vh;
}

.portal-top-banner {
  min-height: 64px;
  border-bottom: 1px solid var(--line);
  background: rgba(8,12,22,.96);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
}

.portal-brand-row {
  min-height: 88px;
  border-bottom: 1px solid var(--line);
  background:
    linear-gradient(90deg, rgba(245,158,11,.08) 0%, transparent 40%),
    rgba(5,7,13,.98);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 24px;
}

.portal-brand-row .brand-name {
  font-size: clamp(1.4rem, 2.4vw, 2.2rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  color: var(--text);
}

.portal-brand-row .brand-tagline {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.portal-brand-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}

.portal-columns {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 190px;
  gap: 0;
  align-items: start;
  min-height: calc(100vh - 168px);
}

.portal-ad-col {
  padding: 14px 10px;
  display: grid;
  gap: 12px;
  align-content: start;
  border-right: 1px solid var(--line);
  min-height: 100%;
}

.portal-ad-col.right {
  border-right: none;
  border-left: 1px solid var(--line);
}

.portal-ad-slot {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(8,12,22,.7);
  padding: 14px;
  min-height: 120px;
  display: grid;
  gap: 6px;
  align-content: center;
  text-align: center;
}

.portal-ad-slot .ad-eyebrow {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--muted-2);
  margin: 0;
}

.portal-ad-slot .ad-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.portal-ad-slot .ad-desc {
  font-size: 11px;
  color: var(--muted-2);
  line-height: 1.4;
}

.portal-ad-slot.tall {
  min-height: 280px;
}

.portal-desk {
  padding: 14px;
  min-height: 100%;
}

.portal-bottom-banner {
  min-height: 56px;
  border-top: 1px solid var(--line);
  background: rgba(8,12,22,.96);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
}

.sponsor-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--muted-2);
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
}

@media (max-width: 1100px) {
  .portal-columns {
    grid-template-columns: 1fr;
  }
  .portal-ad-col {
    display: none;
  }
}
```

- [ ] **Step 2.2: Avvolgi il render principale in page.tsx**

Nel return del componente `Dashboard`, trova la struttura attuale:
```tsx
<section className="book-topbar"> ... </section>
<section className="book-layout"> ... </section>
<footer ...> ... </footer>
```

Avvolgi tutto così (mantieni esattamente il contenuto interno invariato):
```tsx
<div className="portal-root">
  {/* Top Banner */}
  <div className="portal-top-banner">
    <span className="sponsor-label">Top Sponsor Slot · Operator Placement</span>
  </div>

  {/* Brand Row */}
  <div className="portal-brand-row">
    <div>
      <div className="brand-name">AgenticMarkets</div>
      <div className="brand-tagline">Bets the Future · Predictive Intelligence for Sports Markets</div>
    </div>
    <div className="portal-brand-actions">
      {clientProfile ? (
        <button className="client-access-button" onClick={() => setTab("client-area")}>
          {clientProfile.name} · {isPremiumClient ? "Premium" : isClientUnlocked ? "Base" : clientProfile.plan === "free" ? "Free" : "Setup"}
        </button>
      ) : (
        <>
          <button className="btn-secondary" onClick={() => openAuth("login")}>
            {lang === "it" ? "Accedi" : "Sign In"}
          </button>
          <button className="btn-primary" onClick={() => openAuth("create")}>
            {lang === "it" ? "Registrati" : "Register / Get Access"}
          </button>
        </>
      )}
      <button className="lang-toggle" onClick={toggleLanguage}>{uiLanguage.toUpperCase()}</button>
    </div>
  </div>

  {/* 3-column layout */}
  <div className="portal-columns">
    {/* Left ad column */}
    <aside className="portal-ad-col left">
      <div className="portal-ad-slot">
        <p className="ad-eyebrow">Operator</p>
        <div className="ad-name">Left Column</div>
        <div className="ad-desc">Operator placement — inventory premium.</div>
      </div>
      <div className="portal-ad-slot tall">
        <p className="ad-eyebrow">Sponsor</p>
        <div className="ad-name">Partner Slot</div>
        <div className="ad-desc">Banner verticale partner.</div>
      </div>
    </aside>

    {/* Desk center */}
    <div className="portal-desk">
      {/* TUTTO il contenuto esistente (book-topbar + book-layout) va qui dentro */}
      <section className="book-topbar"> ... </section>
      <section className="book-layout"> ... </section>
    </div>

    {/* Right ad column */}
    <aside className="portal-ad-col right">
      <div className="portal-ad-slot">
        <p className="ad-eyebrow">Sportsbook</p>
        <div className="ad-name">Right Column</div>
        <div className="ad-desc">Sportsbook partner — inventory futura.</div>
      </div>
      <div className="portal-ad-slot tall">
        <p className="ad-eyebrow">Casino</p>
        <div className="ad-name">Partner Slot</div>
        <div className="ad-desc">Casino partner — campagne future.</div>
      </div>
    </aside>
  </div>

  {/* Bottom Banner */}
  <div className="portal-bottom-banner">
    <span className="sponsor-label">Bottom Operator Banner · Partner Network</span>
  </div>

  <footer ...> ... </footer>
</div>
```

Aggiungi anche nel CSS i bottoni brand row che non esistono ancora:
```css
.btn-primary {
  height: 38px;
  padding: 0 18px;
  border-radius: 8px;
  border: 1px solid rgba(34,197,94,.42);
  background: linear-gradient(135deg, #22C55E, #16A34A);
  color: #06120A;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.btn-secondary {
  height: 38px;
  padding: 0 18px;
  border-radius: 8px;
  border: 1px solid var(--line-2);
  background: rgba(255,255,255,.05);
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.lang-toggle {
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .08em;
  cursor: pointer;
}
```

Nota: rimuovi il vecchio blocco nella book-topbar che mostrava il client-access-button — ora è nel brand row.

- [ ] **Step 2.3: Riduci book-layout a 2 colonne (senza right-rail — ora ci sono le colonne portale)**

Nel CSS, cambia:
```css
.book-layout {
  grid-template-columns: 210px minmax(0, 1fr) minmax(0, 340px);
```
In:
```css
.book-layout {
  grid-template-columns: 210px minmax(0, 1fr);
```

Rimuovi la `<aside className="right-rail-stack">` dalla JSX (il BetSlip per Premium andrà integrato nel tab Bets in Task 3, il DeskAdRail non serve più con le colonne portale).

- [ ] **Step 2.4: Verifica build**
```bash
cd ~/Desktop/sistema-andrea/agentic-markets/dashboard-web && npm run build
```
Expected: `✓ Compiled successfully`, 0 TypeScript errors.

---

## Task 3: Tab Bets unificato (Available Bets + Old History)

**Files:**
- Modify: `app/page.tsx` — sostituisci placeholder Bets con componente reale

**Obiettivo:** Il tab Bets mostra in alto le predizioni disponibili (filtrate per piano) e sotto lo storico pubblico. Riusa `SportsbookBoard`, `BestBetsBoard` e `PublicOldBetsPanel` già esistenti.

- [ ] **Step 3.1: Crea componente UnifiedBetsTab inline in page.tsx**

Prima della funzione Dashboard (circa riga 4650), inserisci:

```typescript
function UnifiedBetsTab({
  predictions,
  tennisMatches,
  history,
  historyStats,
  historyLoading,
  clientProfile,
  isPremiumClient,
  isClientUnlocked,
  isFreeClient,
  onSelect,
  onUpgrade,
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  history: HistoryMatch[];
  historyStats: HistoryStats | null;
  historyLoading: boolean;
  clientProfile: ClientProfile | null;
  isPremiumClient: boolean;
  isClientUnlocked: boolean;
  isFreeClient: boolean;
  onSelect: (s: SlipSelection) => void;
  onUpgrade: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [sportFilter, setSportFilter] = useState<"all" | "football" | "tennis">("all");

  const previewLimit = isFreeClient ? 1 : isPremiumClient ? undefined : 3;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Available Bets */}
      <div>
        {clientProfile ? (
          <SportsbookBoard
            predictions={predictions}
            tennisMatches={tennisMatches}
            onSelect={isPremiumClient ? onSelect : () => undefined}
            onBetNow={onUpgrade}
            previewLimit={previewLimit}
          />
        ) : (
          <div className="locked-gate-card">
            <p className="eyebrow">{t.locked_eyebrow}</p>
            <h3>{t.locked_title}</h3>
            <p>{t.locked_desc}</p>
            <button className="btn-primary" onClick={onUpgrade}>{t.locked_btn}</button>
          </div>
        )}
      </div>

      {/* Old Bets / Signal History — sempre visibile */}
      <div>
        <div className="board-subhead" style={{ marginBottom: 12 }}>
          <span>{lang === "it" ? "Storico segnali" : "Signal History"}</span>
          <span>{lang === "it" ? "Visibile senza login" : "Public — no login required"}</span>
        </div>
        <PublicOldBetsPanel history={history} stats={historyStats} loading={historyLoading} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: Sostituisci il placeholder Bets nel render principale**

Trova:
```tsx
{tab === "bets" && (
  <div style={{padding: "20px", color: "white"}}>Bets tab — coming in Task 3</div>
)}
```
Sostituisci con:
```tsx
{tab === "bets" && (
  <UnifiedBetsTab
    predictions={predictions}
    tennisMatches={tennisMatches}
    history={history}
    historyStats={historyStats}
    historyLoading={historyLoading}
    clientProfile={clientProfile}
    isPremiumClient={isPremiumClient}
    isClientUnlocked={isClientUnlocked}
    isFreeClient={isFreeClient}
    onSelect={setSlipSelection}
    onUpgrade={() => setTab("client-area")}
  />
)}
```

Assicurati che `history`, `historyStats`, `historyLoading` siano già nello stato del Dashboard (se non ci sono, aggiungi il fetch — guarda il pattern già usato per `fetchHistory` in Dashboard).

- [ ] **Step 3.3: Verifica build**
```bash
npm run build
```

---

## Task 4: Tab Client Area (piani + partner placeholder)

**Files:**
- Modify: `app/page.tsx` — sostituisci placeholder client-area

**Obiettivo:** Il tab Client Area mostra le 3 card piano (Free/Base/Premium) + partner banners placeholder.

- [ ] **Step 4.1: Crea componente ClientAreaTab inline**

```typescript
function ClientAreaTab({
  clientProfile,
  isPremiumClient,
  isClientUnlocked,
  isFreeClient,
  onActivateFree,
  onCheckout,
  onLogin,
}: {
  clientProfile: ClientProfile | null;
  isPremiumClient: boolean;
  isClientUnlocked: boolean;
  isFreeClient: boolean;
  onActivateFree: () => void;
  onCheckout: (plan: "base" | "premium") => void;
  onLogin: () => void;
}) {
  const t = useT();
  const lang = useLang();

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Piano cards */}
      <section id="client-plans">
        <div className="board-subhead" style={{ marginBottom: 12 }}>
          <span>{lang === "it" ? "Accesso e piani" : "Access & Plans"}</span>
        </div>
        <div className="plans-grid-3">
          {/* Free */}
          <div className="plan-card">
            <p className="eyebrow">Free</p>
            <h3>{lang === "it" ? "Accesso educativo" : "Educational access"}</h3>
            <p>{lang === "it" ? "Pochi segnali selezionati, storico pubblico." : "Limited selected signals, public history."}</p>
            <button
              className={isFreeClient ? "plan-btn active" : "plan-btn"}
              onClick={clientProfile ? onActivateFree : onLogin}
              disabled={isFreeClient}
            >
              {isFreeClient ? (lang === "it" ? "Attivo" : "Active") : clientProfile ? (lang === "it" ? "Attiva Free" : "Start Free") : (lang === "it" ? "Crea profilo" : "Create profile")}
            </button>
          </div>
          {/* Base */}
          <div className="plan-card">
            <p className="eyebrow">Base</p>
            <h3>€29 / {lang === "it" ? "mese" : "month"}</h3>
            <p>{lang === "it" ? "Più segnali selezionati, market intelligence, spiegazioni." : "More selected signals, market intelligence, explanations."}</p>
            <button
              className={isClientUnlocked && !isPremiumClient ? "plan-btn active" : "plan-btn"}
              onClick={clientProfile ? () => onCheckout("base") : onLogin}
            >
              {isClientUnlocked && !isPremiumClient ? (lang === "it" ? "Attivo" : "Active") : (lang === "it" ? "Attiva Base" : "Get Base")}
            </button>
          </div>
          {/* Premium */}
          <div className="plan-card featured">
            <p className="eyebrow">Premium</p>
            <h3>€199 / {lang === "it" ? "mese" : "month"}</h3>
            <p>{lang === "it" ? "Tutti i segnali, desk avanzato, execution verificata futura." : "All signals, advanced desk, future verified execution."}</p>
            <button
              className={isPremiumClient ? "plan-btn active" : "plan-btn primary"}
              onClick={clientProfile ? () => onCheckout("premium") : onLogin}
            >
              {isPremiumClient ? (lang === "it" ? "Attivo" : "Active") : (lang === "it" ? "Attiva Premium" : "Get Premium")}
            </button>
          </div>
        </div>
      </section>

      {/* Partner banners placeholder */}
      <section>
        <div className="board-subhead" style={{ marginBottom: 12 }}>
          <span>{lang === "it" ? "Partner casino & sportsbook" : "Casino & Sportsbook Partners"}</span>
          <span>{lang === "it" ? "Placeholder — nessun brand reale" : "Placeholder — no real brands yet"}</span>
        </div>
        <div className="partner-grid">
          {[
            { type: "Casino", placement: "Exclusive", desc: lang === "it" ? "Partner casino esclusivo" : "Exclusive casino partner" },
            { type: "Sportsbook", placement: "Network", desc: lang === "it" ? "Partner sportsbook network" : "Sportsbook network partner" },
            { type: "Operator", placement: "Placement", desc: lang === "it" ? "Slot operatore disponibile" : "Operator placement available" },
          ].map((p) => (
            <div key={p.type} className="partner-card">
              <p className="eyebrow">{p.type}</p>
              <strong>{p.placement}</strong>
              <span>{p.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4.2: Aggiungi CSS per plans-grid-3, plan-card, partner-grid**

In globals.css:
```css
/* ── Client Area Tab ─────────────────────────────────────────── */

.plans-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .plans-grid-3 { grid-template-columns: 1fr; }
}

.plan-card {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255,255,255,.02);
  padding: 20px;
  display: grid;
  gap: 10px;
  align-content: start;
}

.plan-card.featured {
  border-color: rgba(34,197,94,.4);
  background: linear-gradient(135deg, rgba(34,197,94,.07), rgba(255,255,255,.015));
}

.plan-btn {
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--line-2);
  background: rgba(255,255,255,.05);
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity .15s;
}

.plan-btn.primary {
  border-color: rgba(34,197,94,.42);
  background: linear-gradient(135deg, #22C55E, #16A34A);
  color: #06120A;
}

.plan-btn.active {
  border-color: rgba(34,197,94,.3);
  background: rgba(34,197,94,.1);
  color: var(--green);
  cursor: default;
}

.plan-btn:hover:not(.active):not(:disabled) { opacity: .85; }

.partner-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .partner-grid { grid-template-columns: 1fr; }
}

.partner-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255,255,255,.02);
  padding: 16px;
  display: grid;
  gap: 6px;
}

.partner-card strong {
  color: var(--text);
  font-size: 14px;
}

.partner-card span {
  color: var(--muted-2);
  font-size: 12px;
}
```

- [ ] **Step 4.3: Sostituisci il placeholder nel render**

Trova:
```tsx
{tab === "client-area" && (
  <div style={{padding: "20px", color: "white"}}>Client Area — coming in Task 4</div>
)}
```
Sostituisci con:
```tsx
{tab === "client-area" && (
  <ClientAreaTab
    clientProfile={clientProfile}
    isPremiumClient={isPremiumClient}
    isClientUnlocked={isClientUnlocked}
    isFreeClient={isFreeClient}
    onActivateFree={activateFreePlan}
    onCheckout={submitCryptoPayment}
    onLogin={() => openAuth("login")}
  />
)}
```

- [ ] **Step 4.4: Verifica build**
```bash
npm run build
```

---

## Task 5: Settings aggiornato + Assistance + FAQ

**Files:**
- Modify: `app/page.tsx` — sostituisci placeholder assistance e faq, aggiorna settings

**Obiettivo:** Settings mostra i campi spec (email, wallet, password, telegram, lingua, subscription). Assistance e FAQ sono placeholder professionali.

- [ ] **Step 5.1: Crea AssistanceTab**

```typescript
function AssistanceTab() {
  const lang = useLang();
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 640 }}>
      <div className="board-subhead">
        <span>{lang === "it" ? "Supporto e assistenza" : "Support & Assistance"}</span>
      </div>
      <div className="assist-card">
        <p className="eyebrow">{lang === "it" ? "Live chat" : "Live Chat"}</p>
        <h3>{lang === "it" ? "Chat in arrivo" : "Live chat coming soon"}</h3>
        <p>{lang === "it" ? "Integrazione Telegram/WhatsApp in sviluppo." : "Telegram / WhatsApp support integration in development."}</p>
        <button className="plan-btn" disabled>
          {lang === "it" ? "Chat non disponibile" : "Chat not available yet"}
        </button>
      </div>
      <div className="assist-card">
        <p className="eyebrow">{lang === "it" ? "Contatto diretto" : "Direct contact"}</p>
        <h3>{lang === "it" ? "Scrivi al team" : "Contact the team"}</h3>
        <p>{lang === "it" ? "Per supporto urgente usa Telegram o email." : "For urgent support use Telegram or email."}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.2: Crea FAQTab**

```typescript
function FAQTab() {
  const lang = useLang();
  const items = lang === "it" ? [
    ["Come funziona il desk?", "Il desk mostra predizioni generate dai modelli Dixon-Coles, Pi Rating e Elo Surface. Le predizioni vengono aggiornate ogni 5 minuti."],
    ["Cosa sblocca ogni piano?", "Free: storico pubblico e pochi segnali. Base: segnali selezionati multi-sport. Premium: tutti i segnali e future execution verificata."],
    ["Paper vs Signal vs Verified?", "Paper = test simulato non live. Signal = suggerimento del modello. Verified = eseguito su conto reale con betID confermato."],
    ["Il tennis è live o paper?", "Il tennis è attualmente in signal layer (paper mode). I risultati non sono un track record verificato di esecuzione live."],
    ["Come pago?", "Solo USDT TRC20. Invia l'importo esatto all'address fornito nel checkout. Il piano viene attivato dopo verifica manuale del TX hash."],
  ] : [
    ["How does the desk work?", "The desk shows predictions generated by Dixon-Coles, Pi Rating and Elo Surface models, updated every 5 minutes."],
    ["What does each plan unlock?", "Free: public history and a few signals. Base: selected multi-sport signals. Premium: all signals and future verified execution."],
    ["Paper vs Signal vs Verified?", "Paper = simulated, not live. Signal = model suggestion. Verified = executed on a real account with a confirmed betID."],
    ["Is tennis live or paper?", "Tennis is currently in signal layer (paper mode). Results are not a verified live execution track record."],
    ["How do I pay?", "USDT TRC20 only. Send the exact amount to the address shown in checkout. The plan is activated after manual TX hash verification."],
  ];

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <div className="board-subhead">
        <span>FAQ</span>
      </div>
      {items.map(([q, a]) => (
        <div key={q} className="faq-item">
          <strong>{q}</strong>
          <p>{a}</p>
        </div>
      ))}
      <div className="faq-item" style={{ borderColor: "rgba(239,68,68,.2)", background: "rgba(239,68,68,.04)" }}>
        <strong>{lang === "it" ? "Disclaimer" : "Risk Disclaimer"}</strong>
        <p>{lang === "it"
          ? "Le predizioni sono basate su modelli statistici e non garantiscono profitto. Il betting comporta rischi. Gioca responsabilmente."
          : "Predictions are based on statistical models and do not guarantee profit. Betting carries risk. Gamble responsibly."
        }</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.3: Aggiungi CSS assist-card e faq-item**

```css
/* ── Assistance & FAQ ────────────────────────────────────────── */

.assist-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255,255,255,.02);
  padding: 20px;
  display: grid;
  gap: 10px;
}

.faq-item {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255,255,255,.02);
  padding: 16px;
  display: grid;
  gap: 6px;
}

.faq-item strong {
  color: var(--text);
  font-size: 14px;
}

.faq-item p {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
  line-height: 1.55;
}
```

- [ ] **Step 5.4: Sostituisci placeholder assistance e faq**

```tsx
{tab === "assistance" && <AssistanceTab />}
{tab === "faq" && <FAQTab />}
```

- [ ] **Step 5.5: Verifica build**
```bash
npm run build
```

---

## Task 6: Pulizia, visual check finale, deploy

**Obiettivo:** Rimuovere riferimenti orfani, fare visual check locale, deployare.

- [ ] **Step 6.1: Rimuovi componenti e tipi orfani**

Questi componenti non sono più referenziati — rimuovili o commenta se troppo rischioso:
- `PredictionsTab` (sostituito da UnifiedBetsTab)
- Riferimenti a `tab === "overview"` vecchi
- Importazioni/variabili inutilizzate che causano warning TypeScript

- [ ] **Step 6.2: Dev server visual check**
```bash
npm run dev
```
Apri http://localhost:3000 e verifica:
- [ ] Homepage mostra layout portale (top banner, brand row, colonne laterali, bottom banner)
- [ ] Nav ha 5 voci: Client Area · Bets · Settings · Assistance · FAQ
- [ ] Tab default è Bets
- [ ] Bets mostra predizioni + storico
- [ ] Client Area mostra 3 card piano + partner
- [ ] Settings funziona
- [ ] Assistance mostra placeholder
- [ ] FAQ mostra tutte le domande
- [ ] Lingua switch funziona (IT/EN)
- [ ] Nessun titolo doppio
- [ ] Filtri non tagliati
- [ ] Mobile: colonne ads nascoste, layout 1 colonna

- [ ] **Step 6.3: Build finale**
```bash
npm run build
```
Expected: 0 TypeScript errors, 0 build errors.

- [ ] **Step 6.4: Deploy produzione**
```bash
vercel --prod --yes
```

- [ ] **Step 6.5: Smoke check post-deploy**

Apri https://agentic-markets-roan.vercel.app e verifica le stesse checklist del Step 6.2.
