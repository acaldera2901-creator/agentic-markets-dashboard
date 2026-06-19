# Redesign mobile BetRedge — bottom tab bar, content-first

**Data:** 2026-06-19 · **File:** `app/app/page.tsx` + `app/globals.css` · **Branch:** `feat/mobile-redesign`

## Problema (verificato su prod, 390px)
Il layout è desktop-first. Su mobile la **sidebar DESK/FEATURED** (Prediction/History/Leaderboard/Match Builder/Partner/Account + World Cup/Creator + Refresh) si impila **sopra** il contenuto: aprendo l'app si vede solo un muro di menu, le prediction sono fuori vista. Inoltre: banner World Cup in alto si accavalla/taglia; header (logo + DARK/LIGHT + badge piano + lingua) compresso; strisce orizzontali tagliate. → "molto controintuitiva".

## Direzione approvata (Andrea)
**Opzione A — bottom tab bar** (pattern app-native, contenuto in primo piano). Desktop **invariato**.

## Design

### 1. Bottom tab bar (solo mobile)
- Barra **fissa in basso**, visibile solo sotto il breakpoint mobile (allinearsi a quello esistente: `max-width: 760px`).
- **5 voci** (icona + label corta), mappate sui tab esistenti via `setTab`:
  - **Prediction** → `bets` · **Storico** → `history` · **Classifica** → `leaderboard` · **Partner** → `partners` · **Account** → `account`
  - Voce attiva in coral; tap = `setTab(...)` (+ reset `accountSection` su "account" quando si entra in Account, coerente col fix #66).
- Il contenuto riceve `padding-bottom` pari all'altezza barra (niente contenuto coperto). Safe-area iOS (`env(safe-area-inset-bottom)`).

### 2. Sidebar DESK/FEATURED su mobile → nascosta
- La sidebar che oggi si impila viene `display:none` sotto 760px (la sua funzione è sostituita dalla bottom bar). Su desktop resta invariata.

### 3. Voci non in barra
- **Match Builder** → raggiungibile **dentro Prediction** su mobile: un entry-point compatto (bottone/card "Match Builder →", `setTab("match-builder")`) nell'header della scheda Prediction. La tab match-builder resta valida (deep-link/desktop).
- **World Cup / Creator Picks** → restano come **banner/sezioni featured dentro Prediction** (già presenti) + route `/world-cup`. Nessuno slot in barra.
- **Refresh odds** → spostato come azione nell'header di Prediction (mobile), non in barra.

### 4. Banner World Cup (top ribbon) — mobile
- Compatto **1 riga**, testo troncato con ellissi, niente accavallamento; "Go to World Cup →" come freccia/tap sull'intera ribbon; X dismiss che non si sovrappone al testo.

### 5. Header — mobile snello
- `logo` (sx) + `badge piano` (dx). **DARK/LIGHT** e **lingua** si spostano dentro **Account** su mobile (la lingua è già in impostazioni; il toggle tema va aggiunto lì) per de-clutterare l'header. Su desktop l'header resta com'è.

## Vincoli (NON rompere)
- **Solo mobile**: tutte le modifiche dietro `@media (max-width:760px)` o flag mobile; **desktop pixel-invariato**.
- Funzionalità: nessun handler/tab rimosso; tutti i tab restano raggiungibili (5 in barra + Match Builder/World Cup/Creator via entry-point/route).
- i18n 5 lingue (label barra: riusare `nav_*` esistenti — predictions/history/leaderboard/partner + "Account").
- **dark + light** via token `--am-*`. Responsive fino a ~320px.
- Niente nuove dipendenze; monolite CSS-context; surgical.
- Coerenza fix #66: entrando in Account resettare `accountSection` a "account".

## Verifica
- `tsc` pulito; build verde.
- **Visual check mobile** (390px) dark+light: si atterra sul **contenuto** (Prediction), barra in basso col pollice, tutti i tab raggiungibili, Match Builder/World Cup raggiungibili, contenuto non coperto dalla barra, banner WC 1 riga, header snello. Desktop invariato (verifica a 1280px).

## Fuori scope
- Redesign delle singole card prediction / match builder interno (solo entry-point).
- Nuove feature; ogni cosa oltre nav+banner+header mobile.
