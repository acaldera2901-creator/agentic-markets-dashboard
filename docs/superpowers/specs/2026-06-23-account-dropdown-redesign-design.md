# Account dropdown redesign + Plans come tab — Design

**Data:** 2026-06-23 · **ID:** #UI-ACCOUNT-DROPDOWN-0623 · **Owner:** calde-aziendale (Andrea)
**Stato:** design approvato da Andrea (2026-06-23). Probability-neutral (solo UI/navigazione).

## Problema
L'Account oggi è una tab (`tab="account"`) raggiunta dal pill nome+piano in alto a dx, con sotto-nav `Account | Piani` e un bento che include un `SettingsTab` con **nome ed email liberamente editabili + "Salva"** — UX da sito improvvisato ("nessun sito ti lascia cambiare nome quando vuoi"). Andrea vuole un account **completamente rifatto** in un **menu a tendina** dal pill, e **Plans** promosso a tab di primo livello al posto di "Account".

## Soluzione

### 1. Navigazione
- La voce nav **"Account" → "Plans/Piani"** come tab di primo livello (label 5 lingue: it Piani / en Plans / es Planes / fr Offres / ru Тарифы). Contenuto = `PlansTab` attuale, invariato.
- Aggiornare: `navItems` (sidebar), rail/bottom-nav mobile. Rimuovere il bottone "Piani" duplicato in topnav (#UI-BATCH-0623) e la sotto-nav `Account | Piani` (`segmented-filter` in `AccountTab`).
- Il pill account in alto a dx **non fa più `setTab("account")`**: apre il **dropdown**.

### 2. Dropdown account (pannello ricco)
Nuovo componente `AccountMenu` (client). Trigger = pill nome+piano. Comportamento: apre/chiude su click sul pill, **chiude su click-fuori e su `Esc`**, ancorato sotto il pill (top-right). **Theme-aware** (token `--am-*`, funziona in light e dark). Contenuto:
1. **Intestazione**: nome + email (sola lettura) + badge piano (PRO/BASE/FREE/SETUP).
2. **Card piano**: nome piano + stato (`Free` / `Base` / `PRO · scade gg/mm` via `daysLeft`). Azione contestuale:
   - premium → **Gestisci abbonamento**: portale Stripe se `NEXT_PUBLIC_STRIPE_ENABLED==="true"` (riusa `openBillingPortal`), altrimenti riga stato/rinnovo.
   - free/base → **Vedi i piani / Upgrade** → apre la tab **Plans**.
3. **Preferenze inline** (auto-save onChange, niente bottone "Salva"): toggle **notifiche** (campi esistenti `profile.notifications`, riusa la mutation di `onSave`) + selettore **Lingua** (riusa `setLang`/`agentic-lang`).
4. **Footer**: **Aiuto/Supporto** (riusa `AccountHelpFooter`/contenuto) + **Esci** (logout, riusa `logoutClientProfile`).

### 3. Rimozioni (orfani creati dalla modifica)
- `SettingsTab` con nome/email editabili + "Salva": il save notifiche migra nel dropdown; nome/email diventano **sola lettura** (display). Se `SettingsTab` resta usato solo qui → rimuovere; altrimenti ridurre.
- Bento account (`account-bento`, `.ab-*`), sotto-nav `account-subnav`.
- Bottone **Logout separato in topbar** (aggiunto in #UI-BATCH-0623): ridondante col dropdown → rimuovere.

### 4. Mobile
Il pill apre lo stesso pannello (ancorato/centrato); la voce "Account" della bottom-nav apre il dropdown invece di navigare a una tab.

## Non-goal / vincoli
- Nessun cambio a modello/gate/confidence/pick/settlement/DB/pricing-logic/env.
- Email non modificabile (identità). Cambio nome: eventuale flusso dedicato in futuro (fuori scope).
- Riusa contratti esistenti: `/api/auth` (logout), save notifiche, Stripe portal, PlansTab.

## Criteri di successo (verificabili)
- Build verde.
- Nav: "Plans" è una tab; "Account" non è più una tab; nessuna sotto-nav Account|Piani.
- Click sul pill → dropdown apre; click-fuori/Esc → chiude. Funziona in **light e dark** (visual check da loggato).
- Dropdown: nome/email sola lettura; card piano con azione corretta per free/base/premium; toggle notifiche persiste; cambio lingua applica; Esci fa logout.
- Niente più form "cambia nome/email" libero.
- Probability-neutral (diff non tocca file modello/DB/pricing).
