# Mobile refresh — parità PC (icone + In Evidenza) · design

**Data**: 2026-07-09 · **Ticket**: #MOBILE-FEATURED-1 · **Rischio**: medium (codice prodotto + deploy) → deploy-gate + APPROVE.

## Problema
Su mobile (≤760px) il rail sinistro (`.sports-rail`) è nascosto e lo sostituisce la bottom bar (`.am-bottomnav`), che però ha solo 4 tab in-page (Prediction/History/Leaderboard/Piani) con **glifi generici**. Rispetto al PC mancano: le **nostre icone illustrate**, e l'intero gruppo **In Evidenza** (World Cup, Creator Picks, Weekly Pick) + gli accessi **Match Builder** e **Invita** (loggato-only). Andrea: parità col PC, tutto "bene in evidenza".

## Design (scelta Andrea: sezione in-page + nostre icone)

**1. Bottom bar — nostre icone.** Nel render di `am-bottomnav` sostituire il glifo generico con `MenuIcon` quando la voce è in `RAIL_ICONS` (bets→prediction, history→history, plans→plans), fallback al glifo per le altre (leaderboard resta sul glifo `#g-rank` finché non c'è l'icona podio, come #MENU-ICONS-0626). Stessa logica del rail desktop. Core invariato (4 voci).

**2. Sezione "In Evidenza" (nuova, solo ≤760px).** Griglia di **tile prominenti che vanno a capo** (nessuno scroll orizzontale → tutto visibile insieme), in cima a `.book-main`, che rispecchia il gruppo FEATURED del rail PC:
- **World Cup** → `/world-cup` (`SportIcon worldcup`)
- **Creator Picks** → `/community` (`MenuIcon creator`)
- **Weekly Pick** → `/weekly-pick` (glifo `#g-ticket`)
- **Match Builder** → `setTab("match-builder")` (`MenuIcon builder`) — solo loggati
- **Invita** → `setTab("invita")` (glifo `#g-acct` o simile) — solo loggati

Tile = icona (nostra) + label, superficie card col tema verde (bordo `--am-line`, hover/active), tappabile. Le voci route usano `<Link>`/`<a>`, le voci tab un `<button onClick={setTab}>`. Le due loggato-only compaiono solo con `hasClientProfile` (come sul PC). Titolo sezione = `tNav.featured_label` (già i18n 5 lingue).

## Architettura / confini
Solo presentazione. Nessun dato/DB/API nuovo. Riuso: `MenuIcon`, `SportIcon`, `RAIL_ICONS`, `RAIL_GLYPHS`, route esistenti, `setTab`, `hasClientProfile`, `tNav.featured_label`. Zero nuovi asset/copy (label riusate: "World Cup"/"Creator Picks"/"Weekly Pick"/"Match Builder"/Invita già presenti).

**File toccati (chirurgico):**
- `app/app/page.tsx`: (a) render bottom bar → icone nostre; (b) nuovo blocco JSX `.am-featured` in cima a `.book-main`.
- `app/globals.css`: classi `.am-featured*` (default `display:none`; `@media (max-width:760px)` → grid visibile), coerenti col resto `.am-*`.

## Visibilità (breakpoint)
- `.am-featured { display:none }` di default (desktop usa il rail).
- `@media (max-width:760px) { .am-featured { display:grid } }` — stesso breakpoint dove il rail sparisce e appare la bottom bar. Nessuna doppia esposizione.

## Error handling / edge
- Voci loggato-only assenti da anonimo (gated su `hasClientProfile`) — come PC.
- Nessuna icona podio per leaderboard → resta il glifo (non nel featured comunque).
- Griglia responsive: `repeat(auto-fill, minmax(...))` con `min(…,100%)` per non forzare scroll orizzontale su schermi piccoli.

## Testing / verifica reale
- `tsc`/`eslint`/`build` verdi.
- Visual-check reale su **viewport mobile (≤760px) da Pro** su prod-like: la sezione In Evidenza è prominente e completa (5 tile loggato / 3 anonimo), icone nostre rese, le route navigano e i tab (Builder/Invita) si aprono; bottom bar con icone nostre; **desktop invariato** (rail identico, sezione nascosta). Screenshot mobile prima/dopo.

## Rollback
Additivo, dietro breakpoint. Rollback = revert PR. Nessuno schema toccato.

## Gate
Medium (codice prodotto + deploy). PROPOSAL + `APPROVE #MOBILE-FEATURED-1` umano prima del deploy. Branch+PR, deploy manuale `vercel --prod` (auto-deploy rotto).
