# Redesign v3c · F5 — chiavi nuove da tradurre in F10

**Fonte:** `lib/i18n/v3c-tools/en.ts` (inglese, fallback) · **completo:** `it.ts` · **in fallback inglese, dichiarato in `FALLBACK_TO_EN`:** es, fr, de, pt, nl, pl, tr, sv, ru.

Il test `lib/i18n/v3c-tools/copy.test.ts` impone: stesse chiavi dell'inglese foglia per foglia, nessuna stringa vuota, stessi segnaposto `{…}`, **≤ 22 parole** per stringa. Per aggiungere una lingua: copiare `it.ts` in `<lang>.ts`, tradurre, registrarla in `index.ts` (`V3C_TOOLS_COPY`) e toglierla da `FALLBACK_TO_EN` — il test fallisce finché i due elenchi non coincidono.

Tutto il resto delle pagine tool (meta title/description, h1 SEO, lede, spiegazioni, esempio, FAQ, «Other free tools», «Questions») è già tradotto in 11 lingue in `lib/tools/copy/*.ts` e NON va rifatto.

## Chiavi (una riga = una stringa)

### `nav` (15)
board · tools · price · priceShort · record · books · news · pro · signIn · primary · primaryMobile · brand · toPaper · toDark · language

### `footer` (12)
tagline · product · trust · booksCol · toolsLink · method · terms · privacy · responsible · notAdvice · blend · affiliates

### `hub` (21)
tab · title · metaStrong · metaRest · searchLabel · searchPlaceholder · count `{n} {match}` · countMatch `{n} {total} {q}` · empty `{q}` · toolsN `{n}` · toolOne · notATool · lineQ · lineS · lineRow `{match}` · lineRowLine · priceCheck · priceCheckLine · explain · openBoard · sampleNote

### `questions` (3 × 2)
price.q · price.s · stake.q · stake.s · record.q · record.s

### `tool` (20)
tab `{q}` · crumbs · prefilled `{match} {outcome} {price}` · typeYours · sameMaths · leadAsOf `{asOf}` · colMatch · colPrice · colEstimate · tapRow · pickLegs · pickLegsBody · sameRatio · sameRatioBody · openBoard · seeRecord · allTools · noStake · invalid · sample

### `tools.<slug>` (11 tool)
Per ognuno: `name` · `line` · `formula` · `column` (solo i 7 con colonna: odds-converter, probability-calculator, margin-calculator, arbitrage-calculator, ev-calculator, kelly-criterion, stake-calculator) · `inputs.<key>` · `results.<key>`.

| slug | inputs | results |
|---|---|---|
| odds-converter | price | implied · fractional · american |
| probability-calculator | p1 · p2 · p3 | o1 · o2 · o3 |
| margin-calculator | p1 · p2 · p3 | margin · sum · kept |
| arbitrage-calculator | p1 · p2 · p3 · total | profit · shortfall · sum · stake `{n}` |
| parlay-calculator | l1 · l2 · mg | combined · implied · compounded |
| ev-calculator | price · prob | ev · fair `{prob}` · breakeven |
| kelly-criterion | price · prob · bank | full · none · half · quarter |
| stake-calculator | price · target · bank | stake · return · share |
| bankroll-calculator | bank · unit · streak | unit · streakLoss `{n}` · ruin |
| roi-calculator | cap · profit | roi · end |
| yield-calculator | bets · avg · profit | yield · turnover |

Totale: 15 + 12 + 21 + 6 + 20 + (11 × 3 + 7 + 30 input + 33 risultati) ≈ **177 stringhe** per lingua.

## Glossario (da tenere uguale in tutte le lingue)
EV · Kelly · yield · bankroll · Brier · «at our estimate» (il numero nasce da una stima nostra, non da un risultato) · sky = mercato, evidenziatore lime = stima (ruoli colore, non si traducono).

## Stato di chiusura F5 (2026-10-05)

Verificato: tsc pulito · eslint pulito sui file toccati · vitest 233 file / 2781 test (baseline 231 / 2754) · Playwright `e2e/v3c-tools.spec.ts` 31 verdi (1440/390, chiaro/scuro, overflow 0, 0 errori console) · `e2e/v3c-tools-off.spec.ts` 10 verdi (flag spento = base am-v3c-ds: title, canonical, hreflang, JSON-LD, testo visibile) · Lighthouse a11y 100 (hub), 100 desktop / ≥95 (tool), dev server.
Note: nel run OFF il primo confronto a freddo di /tools è fallito una volta per differenza di testo (compilazione dev), poi 10/10; un run ON ha avuto 1 test intermittente non riprodotto.
Non fatto: Lighthouse su build di produzione (solo dev), le 9 lingue (F10), la verifica con dati reali del board (`lib/v3c/board-source.ts` usa il campione, etichettato «Sample»).
