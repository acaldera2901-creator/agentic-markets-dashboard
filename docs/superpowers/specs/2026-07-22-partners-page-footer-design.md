# Partner: pagina `/partners` + vetrina nel footer — Design

Data: 2026-07-22 · Owner: Andrea via Claude Code · Ticket: `#PARTNERS-PAGE-1`

## Obiettivo

Dare visibilità a tutti i partner affiliati di BetRedge con:
1. una **riga loghi partner nel footer** (oggi c'è solo un link testuale a slotsbonus);
2. una **pagina pubblica `/partners`** attraente, coerente col brand, che fa da vetrina.

## Vincolo non negoziabile — compliance gambling

Tutti i partner sono operatori gambling (sportsbook + casino). Promuoverli è il **rischio go-live #1**; in IT/DE/FR/NL/ES/BE è pubblicità gambling vietata. Quindi:

- **L'intera sezione partner (footer + pagina) è geo-gated fail-closed**, riusando la fonte unica di verità già esistente: `GEO_BLOCKED_COUNTRIES` in `lib/sportsbooks/index.ts` (`{IT, DE, FR, NL, ES, BE}`).
- La geo è letta **server-side** (header `x-vercel-ip-country` / `cf-ipcountry`, non falsificabile dal client).
- **Fail-closed:** geo ignota o fetch fallito → nessun contenuto gambling mostrato.
- Copy **FTC-safe**: descrizioni neutre dei partner, **nessun claim** ("quote migliori", "battiamo il mercato", bonus garantiti).
- Ogni link in uscita: `rel="nofollow sponsored noopener"` + `target="_blank"`.
- Disclosure 18+ / gioco responsabile (GamCare, BeGambleAware) / "link affiliati commerciali" presente sia in pagina sia (invariata) nel footer.

## Set partner (finale)

Stake e Roobet **esclusi** (decisione Andrea 2026-07-22).

| id | nome | categoria | logo | featured | fonte URL |
|---|---|---|---|---|---|
| `fortuneplay` | FortunePlay | sportsbook | `/logos/fortuneplay.svg` (esistente) | ✅ | `FORTUNEPLAY_BET_URL` (`lib/affiliate.ts`) |
| `ybets` | YBets | sportsbook | `/logos/ybets.svg` (**da creare**, monogramma) | — | landing `betconstruct-books.ts` (`ybetspromo.io/dputempxc`) |
| `betscore` | BetScore | sportsbook | `/logos/betscore.svg` (**fornito da Andrea**, wordmark a colori — già copiato) | — | `LANDING_PARTNERS[0].url` (`lib/affiliate.ts`) ⚠️ dipende da PR #193 |
| `slotsbonus` | slotsbonus | casino | `/logos/slotsbonus.svg` (**da creare**, monogramma) | — | URL cross-referral già hardcoded nel footer |

Nota BetScore: la sua integrazione CTA è in PR #193 non ancora in prod. Nella vetrina è indipendente (solo landing) → la includo. Il redirect `bsr.lynmonkel.com/?mid=...` è già valido a prescindere dal merge di #193.

## Architettura

### 1. Fonte di verità — `lib/partners.ts` (nuovo)

Oggi i dati partner sono sparsi (`affiliate.ts`, `betconstruct-books.ts`, `registry.ts`, `SiteFooter.tsx` hardcoded). Li consolido in un unico modulo che **riusa** le costanti URL già esistenti (niente duplicazione degli URL affiliati).

```ts
export type PartnerCategory = "sportsbook" | "casino";
export type Partner = {
  id: string;
  name: string;
  category: PartnerCategory;
  logo: string;            // path /logos/*.svg
  url: string;             // landing affiliato (importato dalle costanti esistenti)
  featured?: boolean;
  // tagline NON qui: vive nell'i18n (vedi sotto), keyed by id
};

export const PARTNERS: Partner[] = [ /* fortuneplay(featured), ybets, betscore, slotsbonus */ ];
```

- Gli URL sono **importati** da `lib/affiliate.ts` / `lib/betconstruct-books.ts` dove già esistono; slotsbonus resta l'unica URL nuova centralizzata qui (spostata dal footer).
- Nessuna logica geo in questo file: è solo il catalogo. Il gate geo resta in `lib/sportsbooks`.

### 2. Pagina — `app/partners/page.tsx` (nuovo, server component)

- Legge la geo server-side e calcola `blocked = GEO_BLOCKED_COUNTRIES.has(country)`.
- **Geo bloccata:** rende uno stato neutro `PartnersUnavailable` — messaggio "Questa sezione non è disponibile nella tua area" + link alla home. Nessun logo/nome/URL di partner nel markup (né per SEO né per il client). *(Decisione: stato neutro, non redirect — nessun link morto, più onesto.)*
- **Geo consentita:** rende `<PartnersShowcase partners={PARTNERS} lang={lang} />`.
- `lang` risolto col pattern già usato dalle altre pagine (vedi `app/page.tsx`); fallback `en`.
- `export const dynamic = "force-dynamic"` (dipende dalla geo header, non cacheabile staticamente).
- `<SiteFooter lang={lang} />` in fondo come le altre pagine.

### 3. Presentazione — `components/PartnersShowcase.tsx` (nuovo, <300 righe)

Presentazionale puro. Brand VERDE `#23A559`, token `--am-*`, componenti coerenti col sito (anti-slop: niente scalette 01/02/03, niente box-su-box generici). Sezioni:

1. **Hero** — headline + subhead (i partner dove agire sulle analisi di BetRedge). No claim.
2. **Partner in evidenza** — card grande FortunePlay: logo, tagline neutra, CTA "Visita".
3. **Griglia sportsbook** — YBets, BetScore (card uniformi: logo + tagline + CTA).
4. **Casino** — slotsbonus in sezione etichettata "Casino".
5. **Striscia compliance** — 18+, GamCare/BeGambleAware, "link affiliati commerciali" (riuso wording footer).

Ogni CTA: `<a href={p.url} target="_blank" rel="nofollow sponsored noopener">`.

Coerenza loghi: FortunePlay (logo reale) e BetScore (wordmark reale) convivono con YBets/slotsbonus (monogrammi). ui-andrea armonizza la griglia (contenitore logo a dimensione fissa, sfondo/allineamento uniformi) così che monogrammi e wordmark non stonino.

### 4. Footer — `components/SiteFooter.tsx` (edit)

- Aggiungo una **riga loghi partner** (`site-footer-partners`), renderizzata **solo se `partnerAllowed`** (lo state geo fail-closed già presente nel componente, via `/api/geo-books`).
- I loghi linkano in uscita (`rel="nofollow sponsored noopener"`); i dati vengono da `PARTNERS` (`lib/partners.ts`).
- Il link testuale "Partner" (oggi → slotsbonus diretto) diventa **"Partner" → `/partners`** (interno, `<Link>`).
- Compliance line + impressum invariati.

### 5. Loghi mancanti (asset)

- `public/logos/betscore.svg` — **già copiato** dal file fornito da Andrea.
- `public/logos/ybets.svg` e `public/logos/slotsbonus.svg` — **da creare** (badge-monogramma SVG originali, stile coerente con `stake.svg`/`roobet.svg` esistenti; placeholder finché non arrivano asset ufficiali). Delegati a **ui-andrea**.

### 6. i18n

- Copy pagina + tagline partner (keyed by partner id) nelle 5 lingue del desk: it/en/es/fr/ru, fallback en. Stesso pattern del `COPY` in `SiteFooter.tsx`.
- Tagline neutre e brevi, FTC-safe.

### 7. CSS

- Stili footer: estendere il blocco `site-footer-*` dove già definito (globals). Nuova classe `site-footer-partners` per la riga loghi.
- Stili pagina: nuove classi coerenti coi token `--am-*`; nessun inline-style che blocchi il responsive (lezione `feedback_inline_style_responsive`).

## Fuori scope (YAGNI)

- **Nessun** form "Diventa partner" (decisione Andrea: solo vetrina). La tabella `partner_requests` + `/api/partner-request` restano intatte, non toccate.
- **Nessuna** voce nella nav top/sidebar (chirurgico: solo footer + pagina). Aggiungibile dopo su richiesta.
- Nessun ripristino della vecchia `PartnersTab` dentro l'app.
- Stake/Roobet non compaiono nella vetrina (restano nell'infra `registry.ts` inerte, non rimossi).

## Testing / verifica (Costruito ≠ Verificato ≠ Operativo)

- `tsc` + `next build` verdi.
- Test unità su `lib/partners.ts` (catalogo non vuoto, URL non vuoti, categorie valide) e, se fattibile senza rete, sul branching geo della pagina (blocked → nessun nome partner nel render; allowed → tutti presenti).
- **Visual check da loggato** su preview (headless + cookie Chrome): pagina `/partners` da geo consentita (simulata) e footer con riga loghi; verifica responsive mobile.
- Verifica geo: da IT la pagina rende lo stato neutro e il footer **non** mostra la riga partner.
- QA con `qa-andrea` pre-deploy.

## Rischi / gate

- Medium/high → codice prodotto su betredge.com. **Branch + PR obbligatori**, no push diretto su main.
- Deploy prod **gated**: PROPOSAL con change-spec + `APPROVE #id` umano prima del merge/prod.
- Rischio compliance mitigato dal geo-gate fail-closed riusato (nessuna nuova esposizione rispetto al footer attuale).

## Criterio di successo (verificabile)

Da geo consentita: `/partners` è live, mostra FortunePlay/YBets/BetScore/slotsbonus con loghi, tagline neutre e CTA affiliate corrette; il footer mostra la riga loghi partner + link a `/partners`; layout attraente e responsive verificato da loggato. Da geo bloccata (IT): pagina in stato neutro e footer senza partner. `tsc`/`build`/test verdi.
