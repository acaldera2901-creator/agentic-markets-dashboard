# Free Betting Tools — hub `/tools` (#TOOLS-HUB-0805)

**Data:** 2026-08-05 · **Stato:** design approvato da Andrea ("procedi", 2026-08-05)
**Branch:** `betredge/tools-hub` · **Base:** `716dd01` (origin/main)

## Perché

Il Mondiale 2026 è finito: `/world-cup` è un hub vivo ma senza domanda. Al suo posto,
nelle vie d'ingresso del sito, va una pagina di **calcolatori gratuiti** — le keyword
"odds converter", "EV calculator", "Kelly calculator" hanno domanda costante e
ricorrente, e chi le cerca è esattamente il nostro utente. Il tool è l'esca: gratuito,
senza login, con un rimando al prodotto che quel calcolo lo fa già su ogni partita.

Non è un prodotto nuovo: è acquisizione organica.

## Decisioni prese (Andrea, 2026-08-05)

| Decisione | Scelta |
|---|---|
| Sorte di `/world-cup` | **Archiviata**: resta online e funzionante, esce dalla nav |
| Struttura rotte | Hub + **una rotta per tool** (5 pagine indicizzabili, non tab) |
| Lingue | **Tutte e 11**, con **URL per lingua** (senza URL dedicate le traduzioni non portano un solo click organico) |
| Accesso | **100% libero**, nessun login/email, CTA al prodotto su ogni tool |
| Slug | **In inglese anche sulle lingue** (`/it/tools/kelly-criterion`); title/H1/contenuto tradotti |
| House-banner WC | I 4 banner "Vai alla World Cup →" **ritirati** dalla rotazione |

## 1. Architettura delle rotte

Una sola implementazione, 55 pagine statiche generate da essa (5 tool × 11 lingue).

```
app/tools/page.tsx                 → /tools                      hub EN (canonical)
app/tools/[tool]/page.tsx          → /tools/odds-converter        5 slug EN
app/[lang]/tools/page.tsx          → /it/tools · /es/tools · …    hub tradotto
app/[lang]/tools/[tool]/page.tsx   → /it/tools/odds-converter · … tool tradotto
```

Slug (invarianti su tutte le lingue):
`odds-converter` · `ev-calculator` · `kelly-criterion` · `margin-calculator` · `probability-calculator`

Lingue: `en` (senza prefisso, canonical) + `it es fr de pt nl pl tr sv ru`
(gli stessi locali già presenti in `lib/i18n/`).

**Vincoli obbligatori sui segmenti dinamici:**

- `generateStaticParams` su `[lang]` restituisce **solo** i 10 codici locale;
  `export const dynamicParams = false` → qualunque altro segmento 404.
  Senza questo, un segmento dinamico alla radice accetterebbe `/qualsiasi-cosa`.
  Le rotte statiche esistenti (`/terms`, `/partners`, `/r/[code]`, `/app`, …) hanno
  comunque precedenza su `[lang]` nella risoluzione di Next, ma il vincolo rende la
  cosa esplicita e non-regredibile.
- `generateStaticParams` su `[tool]` restituisce i 5 slug; `dynamicParams = false`.
- `export const dynamic = "force-static"` su tutte e quattro le page: nessun accesso
  a DB o API, tutto prerenderizzato al build e servito dalla CDN.

Le pagine sono server component; ogni calcolatore è un client component isolato.

## 2. Il modulo di calcolo (il cuore)

`lib/betting-math.ts` — funzioni **pure**, nessuna dipendenza UI, nessuno stato.
`lib/betting-math.test.ts` — scritto **prima** dell'implementazione (vitest, `npm test`).

### API

```ts
// formati quota
type OddsFormat = "decimal" | "american" | "fractional" | "hongkong" | "malay" | "indonesian";
parseOdds(input: string, format: OddsFormat): number | null   // → decimale, null se invalido
formatOdds(decimal: number, format: OddsFormat): string
impliedProbability(decimal: number): number                    // 0..1
probabilityToDecimal(p: number): number

// margine e quote eque
bookmakerMargin(decimals: number[]): number                    // overround, es. 0.0526
payoutPercent(decimals: number[]): number                      // 1 / (1 + margine)
noVigProbabilities(decimals: number[]): number[]               // metodo moltiplicativo
noVigOdds(decimals: number[]): number[]

// valore atteso
expectedValue(args: { probability: number; decimal: number; stake: number }):
  { ev: number; evPercent: number; fairDecimal: number; edge: number }

// Kelly
kelly(args: { probability: number; decimal: number; bankroll: number; fraction: number }):
  { edge: number; fullKelly: number; stakeFraction: number; stake: number; growthRate: number }

// probabilità
breakEvenProbability(decimal: number): number
parlayProbability(probabilities: number[]): number
parlayOdds(decimals: number[]): number
```

### Regole

- Nessun arrotondamento intermedio: si arrotonda **solo** in formattazione.
- Input invalido → `null` (mai `NaN` propagato, mai eccezioni verso la UI).
- Quota decimale valida: `> 1`. Americana valida: `<= -100` o `>= 100`
  (i valori tra −100 e +100 non esistono). Probabilità valida: `0 < p < 1`.
- `kelly` con `probability` ≤ break-even → `stake = 0` (nessun edge, nessuna puntata),
  non un numero negativo travestito da consiglio.
- `noVigProbabilities` usa il metodo **moltiplicativo** (proporzionale). È lo standard
  ed è quello che i competitor mostrano; il limite (sottostima i favoriti estremi) è
  scritto nel testo della pagina, non nascosto.

### Casi di test (calcolati a mano, non presi dall'output del codice)

| Caso | Atteso |
|---|---|
| `2.50` in tutti i formati | `+150` · `3/2` · `1.50` HK · `40%` |
| `-110` americana | `1.909090…` decimale · `52.38%` implicita |
| `11/4` frazionaria | `4.75` decimale |
| margine su `[1.90, 1.90]` | `5.26%` · payout `94.99%` |
| no-vig su `[1.90, 1.90]` | `[0.50, 0.50]` → quote eque `[2.00, 2.00]` |
| no-vig 3 esiti `[2.10, 3.40, 3.80]` | somma probabilità = 1 esatta |
| EV: `p=0.55`, `2.00`, stake `100` | `+10.00` · `+10%` · quota equa `1.8182` |
| EV: `p=0.45`, `2.00`, stake `100` | `−10.00` (il negativo si mostra, non si nasconde) |
| Kelly: `p=0.55`, `2.00`, bankroll `1000`, `f=1` | edge `0.10` · Kelly pieno `10%` · stake `100` |
| Kelly: `p=0.55`, `2.00`, `f=0.5` | stake `50` |
| Kelly: `p=0.40`, `2.00` | stake `0` |
| break-even a `1.75` | `57.14%` |
| multipla `[0.50, 0.50, 0.50]` | `12.5%`; quote `[2,2,2]` → `8.00` |

Bordi: stringa vuota, spazi, testo, `0`, negativi, `1.00`, `p=0`, `p=1`, virgola
decimale europea (`2,50`), array vuoto, array con un solo elemento.

## 3. I cinque tool

| Tool | Input | Output |
|---|---|---|
| **Odds Converter** | una quota in un formato | gli altri 5 formati + probabilità implicita, live |
| **Margin Calculator** | 2/3/N quote di un mercato | overround %, payout %, quote eque no-vig per esito |
| **EV Calculator** | quota offerta + probabilità stimata **oppure** quota di un book sharp da cui dedurla togliendo il margine + stake | EV in valuta, EV %, quota equa, edge % |
| **Kelly Criterion** | quota, probabilità, bankroll, frazione (1 · ½ · ¼) | edge, Kelly pieno %, stake consigliato, crescita attesa per scommessa |
| **Probability Calculator** | probabilità o quota; lista di eventi per la multipla | conversione ↔ quota, probabilità di break-even alla quota data, probabilità e quota combinata della multipla |

Il quinto tool così definito **non duplica** il converter: quello traduce formati,
questo risponde a "che probabilità mi serve perché questa quota abbia senso" e
"quanto vale davvero la mia multipla".

## 4. Pagina, contenuto, SEO

**Riuso del design system esistente**: `SiteTopbar` (`components/world-cup/SiteTopbar.tsx`),
`SiteFooter lang={lang}`, token `--am-*`, tema `data-theme`. Superfici nuove prefissate
`.tl-*` in `app/globals.css` per non collidere con classi esistenti (`lp-*`, `wc-*`, `wp-*`).

Struttura di ogni pagina tool, nell'ordine:

1. H1 + una riga su cosa fa
2. **il calcolatore sopra la piega** — input a sinistra, readout a destra, calcolo live
   mentre si digita, nessun bottone "calcola"
3. come si calcola, con la formula esplicita
4. testo esplicativo di 300–500 parole reali (è questo che classifica, non il widget)
5. 3–4 FAQ
6. link agli altri quattro tool
7. **un** blocco CTA verso `/app`

Hub `/tools`: griglia delle 5 card + due paragrafi di introduzione + CTA.

**SEO tecnico**
- `metadata` per pagina e per lingua (title, description tradotti)
- `alternates.canonical` + `alternates.languages` con **hreflang reciproci** su tutte
  le 11 varianti + `x-default` → EN
- JSON-LD `WebApplication` per il tool + `FAQPage` per le FAQ
- 55 voci in `app/sitemap.ts` (`weekly`, priorità 0.7 per i tool, 0.8 per gli hub)

**Lingua**: selettore esplicito che **naviga alla URL locale**. Nessun redirect
automatico da `localStorage("agentic-lang")`: romperebbe il crawl e infastidisce chi
arriva da Google. Il valore salvato serve solo a evidenziare la lingua corrente.

**Copy**: FTC-safe. Nessun profitto promesso, nessun "battiamo il mercato". La pagina
Kelly porta il suo avvertimento su varianza e rischio di rovina. Niente emoji, icone
SVG inline.

**Mobile-first**, verifica a 390px con Playwright (l'estensione Chrome non cambia il
viewport).

## 5. World Cup: archiviazione

`/world-cup` **resta online e funzionante** — nessun file cancellato, nessun redirect.
Escono solo le vie d'ingresso:

| File | Prima | Dopo |
|---|---|---|
| `app/page.tsx` (~737) | bottone sport `→ /world-cup` | `→ /tools` |
| `app/app/page.tsx` (~9020) | rail item `→ /world-cup` | `→ /tools` |
| `app/app/page.tsx` (~9054) | feature tile `→ /world-cup` | `→ /tools` |
| `lib/house-banners.ts` (4 voci) | CTA "Vai alla World Cup →" | ritirati dalla rotazione |
| `app/sitemap.ts` | `/world-cup` daily 0.8 | `monthly` 0.3 |

Il link `wc-back-link` interno alla dashboard (`app/app/page.tsx` ~2407) resta: serve a
chi è già dentro l'hub.

## 6. Criteri di successo (verificabili)

1. `npm test` verde, inclusa la suite `betting-math` con i casi calcolati a mano
2. `npm run build` genera le 55 pagine statiche, zero errori TS/ESLint
3. Ogni tool restituisce i valori della tabella dei casi di test, verificato in browser
4. `curl` sull'HTML del preview: canonical + hreflang reciproci + JSON-LD presenti
5. `/sitemap.xml` contiene le 55 URL
6. Nessun link interno rotto; `/world-cup` risponde ancora 200
7. Visual check desktop **e** mobile 390px su hub + 2 tool
8. `qa-andrea` sui 5 tool con input di bordo (vuoto, 0, negativi, testo)

## 7. Fuori perimetro (dichiarato)

- Slug tradotti (`/it/strumenti/convertitore-quote`) — si aggiungono dopo senza
  toccare la matematica
- Stato condivisibile in querystring (`?d=2.50`)
- Arbitrage / hedge / parlay calculator come tool separati (i più cercati dopo questi
  cinque): si valutano quando Search Console dice se i primi cinque prendono traffico
- Cattura email sui tool
- Traduzione dei testi esplicativi con revisione madrelingua: escono in traduzione mia

## 8. Nota legale (non un blocco)

I calcolatori sono matematica informativa: non offrono quote, non accettano puntate,
non rimandano a operatori. Ma "betting tools" è una superficie nuova rispetto alla
domanda VIA-A non-gambling ancora aperta con l'avvocato
(`project_gambling_qualification`). Va menzionata alla prossima review legale.
Non ferma la build.

## 9. Gate

Branch + PR. Nessun push su `main`. Deploy in produzione **solo con APPROVE** di Andrea.
