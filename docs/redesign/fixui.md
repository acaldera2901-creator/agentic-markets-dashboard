# Filone INTERFACCIA E TESTI — `betredge/v3c-fixui` (07/10/2026, ui-andrea)

Base `betredge/v3c-final4` 8a187b07. Parallelo a `fixdata` (dati e logica): questo filone non tocca
`lib/v3c/board*.ts`, query, API, matching, dedup, protezione EV/Kelly, live-data. Non pushato.

## Cosa cambia (ID del QA-REPORT / UX-AUDIT)
- **B3/A4 Fase 0** (DECISIONI-FREE-PRO §f): /pricing = «Free e Pro anteprima». Tabella Free vs Pro (7 righe, solo
  ciò che esiste; il «perché» al futuro, «planned»), $29.99/mese «coming» come testo, etichetta P9 in cima, nota
  dei 7 giorni di preavviso + T4. Via «Go Pro», «Create a free account», metodi di pagamento, promo, recesso.
  Il paywall del perché resta solo come bozza dichiarata, senza bottone (`WhyPaywall draft`). FAQ della home: la
  domanda sui pagamenti diventa «Do I have to pay anything?», Pro «aggiungerà» il perché. «Sign in» resta.
  Recesso, IVA e indirizzo: li decide il legale (non scritti).
- **B4**: arbitraggio, 11 lingue — «Guaranteed profit» → «Arbitrage margin», formula con «if the prices are still
  available». **File condiviso col sito di oggi**: `lib/tools/copy/<11>.ts`, blocco arbitrage — `labels.profit`,
  la riga «Profit» dell'esempio, e `verdictArb` + «if all prices are still available». A flag spento cambia SOLO
  quel testo (verificato: build OFF contro main ec106c52, unica differenza sulle rotte del sito di oggi).
  Meta di / e /predictions (flag ON): niente «predictions», niente «calibrated»; breadcrumb «Board».
- **B7**: piè v3c senza «66 Paul Street…»: «BetRedge · Terms». `lib/legal-entity.ts` intatto (email, sito di oggi).
- **A1/UX-1**: frase sotto la data (≤22 parole, 11 lingue) + una partita vera della board come esempio, altezza riservata.
- **UX-2**: pannello «How to read this page» (9 voci UX-AUDIT §5, 11 lingue) da legenda board (anche su mobile),
  pagina partita e piè; «i» accanto a Market, Estimate, Gap, Tennis, Sealed, margin removed. `<dialog>` nativo.
- **UX-3**: stima a contorno sottile, la frase-verdetto è il pezzo grande.
- **M2**: un fuso: ora locale ovunque (board, partita, sigillo, grafico, price check, Books, tool), sigla dichiarata
  una volta per vista («Times in your time zone (CEST)»). UTC resta solo nelle ricevute del registro.
- **UX-nav**: barra in basso 5 voci + «More» (News, Method, Pricing, lingua).
- **A5**: Books «Live prices» = `books[].oddsAvailable` sulla board; hollywin «feed blocked in our region»,
  slotsbonus «not a sportsbook» (lista invariata). FAQ/intro v3c senza predictions/picks/call (`lib/v3c/partners-seo.ts`;
  `app/partners/seo.ts` intatto).
- **A7/M7**: «Build yours» nascosto; link assoluti a betredge.com negli articoli → relativi.
- **A8**: /price-check slot ≥ 1 schermo e risultato ad altezza fissa (misurata 352/426 px).
- **M1**: `<html lang>` e `<title>` per lingua sulle rotte v3c (`lib/v3c/doc-titles.ts`, client).
- **M3**: banner cookie della cornice dopo il contenuto, sopra la barra (54 px); quello del layout radice nascosto
  sulle rotte v3c. Ordine del focus: «Skip to content» per primo.
- **M8**: og:image sull'hub tool; title di /record descrittivo. **M10**: tema da `prefers-color-scheme` senza scelta salvata.
- **L2** nome del logo «BetRedge, home» · **L3** tooltip sui nomi troncati · **L5** occhiello «Board · …».
- Extra: a 390 px la fascia in russo allargava la pagina di 106 px (tab nowrap): contenuta.

## File condivisi toccati (aggiunte minime)
`components/v3c/Chrome.tsx`, `BottomNav.tsx`, `Fascia.tsx` (prop `lede`), `Sigillo.tsx` (prop `tz`), `V3cShell.tsx`
(preferenza OS), `lib/v3c/copy.ts` (occhiello), `lib/i18n/v3c-tools/*` (logo, arbitraggio), `lib/tools/copy/*` (sopra).
CSS nuovo in `components/v3c/fixui.css`, importato solo dai moduli server v3c.

## Non fatto
M9 (tracking prima del consenso: parere legale), lista partner/casinò. Banner cookie ancora EN/IT soltanto
(componente globale). Articoli del blog con «Value Bets»/«CLV» (contenuto DB, non codice).
