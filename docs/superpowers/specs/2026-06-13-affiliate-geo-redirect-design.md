# Spec — Affiliate geo-aware (link per giurisdizione)

**Data:** 2026-06-13
**Stato:** design approvato (Andrea) → pronto per implementation plan
**Branch:** `feat/affiliate-geo`

## 1. Obiettivo

I link affiliate "Piazza scommessa" devono puntare al **dominio regionale corretto del book in base alla geolocalizzazione del visitatore** (es. utente US → `stake.us` / `roobet.us`, utente IT → `stake.it`, ecc.), invece di una singola URL globale.

È un **link-swap** lato server: cambia solo l'URL in uscita. Il sito BetRedge non viene reindirizzato.

## 2. Non-obiettivi (YAGNI)

- Nessun redirect/instradamento dell'esperienza BetRedge per giurisdizione.
- Nessun deep-link al betslip precompilato (resta `prefilled:false`, come v1).
- Nessuna geo-detection lato client nuova (si usa quella server di Vercel già presente).
- Nessun nuovo book oltre a quelli già nel registry (stake, roobet); l'aggiunta di book resta fuori scope.

## 3. Stato attuale (cosa esiste già)

In `lib/sportsbooks/`:
- `linksEnabled()` — master switch `SPORTSBOOK_LINKS_ENABLED === "true"` (default **OFF**).
- `geoAllowed(country)` — allowlist `SPORTSBOOK_GEO_ALLOWLIST` (vuota = nessun paese, `"*"` = globale, oppure CSV di codici paese).
- `resolveBooks(country)` — ritorna i book ammessi se master ON **e** geo ammessa; `[]` altrimenti.
- `buildBetUrl(book, sel)` — chiama `book.adapter(sel, book)`; l'adapter (`landingAdapter`) costruisce `joinUrl(book.baseUrl, book.sportPaths?.[sport])`. **Il codice affiliate è già dentro `baseUrl`** (la URL env include il referral); l'adapter non lo appende separatamente.
- `app/api/bet-links/route.ts` — legge **già** `x-vercel-ip-country`, fa `resolveBooks(country)` (gate) e `buildBetUrl(b, sel)`.
- Registry env-driven: ogni book ha `SPORTSBOOK_<BOOK>_CODE / _URL / _PATHS`. Un book è incluso solo se `_URL` è valorizzata.

**Cosa manca:** `buildBetUrl` usa **una sola `baseUrl` per book**, senza variante regionale per paese.

## 4. Design (Approccio A — mappa env per-paese per book)

### 4.1 Tipi — `lib/sportsbooks/types.ts`
Aggiungere a `Sportsbook` un campo opzionale:
```ts
regionalUrls?: Record<string, string>; // chiave = codice paese ISO-3166-1 alpha-2 MAIUSCOLO, oppure "default"
```
`baseUrl` resta il globale/legacy (fallback finale).

### 4.2 Registry — `lib/sportsbooks/registry.ts`
- Aggiungere allo `Spec` un `urlsEnv: "SPORTSBOOK_<BOOK>_URLS"`.
- Parsare il JSON con lo stesso helper difensivo di `_PATHS` (`parsePaths` → o un `parseJsonObject` condiviso), normalizzando le chiavi paese a maiuscolo (la chiave `default` resta minuscola).
- Popolare `regionalUrls` sul `Sportsbook`. Se il JSON è assente/invalido → `regionalUrls` `undefined` (degrada a `baseUrl`).
- **Invariato:** un book è incluso solo se `_URL` (baseUrl globale) è valorizzata; `regionalUrls` è additivo e non cambia l'inclusione.

### 4.3 Risoluzione dominio — `lib/sportsbooks/index.ts`
Nuova funzione pura:
```ts
export function resolveBaseUrl(book: Sportsbook, country: string | null | undefined): string {
  const cc = country?.trim().toUpperCase();
  return (cc && book.regionalUrls?.[cc]) || book.regionalUrls?.default || book.baseUrl;
}
```
`buildBetUrl` riceve il paese e passa all'adapter un book col `baseUrl` risolto (gli adapter restano invariati, continuano a leggere `book.baseUrl`):
```ts
export function buildBetUrl(book: Sportsbook, sel: BetSelection, country?: string | null): BuildResult {
  const effective = { ...book, baseUrl: resolveBaseUrl(book, country) };
  try { return book.adapter(sel, effective); }
  catch { return { url: effective.baseUrl, prefilled: false }; }
}
```
(Il `catch` di fallback usa la `baseUrl` regionale risolta, non quella globale.)

### 4.4 Route — `app/api/bet-links/route.ts`
Passare il `country` già letto da `x-vercel-ip-country` a `buildBetUrl(b, sel, country)`. Nessun'altra modifica (GET di enablement e gate restano invariati).

### 4.5 Flusso dati
PlaceBetMenu → POST `/api/bet-links` → route legge paese (Vercel) → `resolveBooks(country)` (gate enable+allowlist) → per ogni book `buildBetUrl(book, sel, country)` → `resolveBaseUrl` sceglie dominio regionale → adapter costruisce path sul dominio giusto → opzioni con URL regionale al client.

## 5. Configurazione (env) — fornita da Andrea

- `SPORTSBOOK_LINKS_ENABLED=true` (master)
- `SPORTSBOOK_GEO_ALLOWLIST=*` o CSV paesi (dove mostrare i link)
- Per book, es. `SPORTSBOOK_STAKE_URLS={"US":"https://stake.us/?c=CODE_US","IT":"https://stake.it/?c=CODE_IT","default":"https://stake.com/?c=CODE_GLOBAL"}`
- `SPORTSBOOK_ROOBET_URLS={"US":"https://roobet.us/?c=…","default":"https://roobet.com/?c=…"}`
- Restano validi `_URL` (baseUrl/legacy default), `_CODE`, `_PATHS`.

**Nessun dominio/codice gambling è hardcoded nel repository:** tutto vive in env, gestito al deploy.

## 6. Fallback ed edge case

- Paese con variante → quella variante.
- Paese senza variante → chiave `default` → altrimenti `baseUrl` globale (`.com`). **Scelta: fallback al dominio globale.**
- Header paese assente (preview/locale/IP non geolocalizzabile) → `default`/`baseUrl`.
- Ogni URL regionale nel JSON include il proprio codice affiliate → niente doppio append.
- JSON env malformato → `regionalUrls` ignorato, si usa `baseUrl` (degrado pulito, mai crash).

## 7. Legale / rollout ⚠️

- L'attivazione è **100% via env**: finché `SPORTSBOOK_LINKS_ENABLED≠true` o l'allowlist è vuota, la feature è inerte (comportamento odierno).
- Il go-live in produzione resta **gated** (PROPOSAL + `APPROVE` umano, è soldi + gambling).
- **Andrea è responsabile** della clearance legale e di fornire **domini licenziati corretti per giurisdizione**. La memoria `project_sportsbook_affiliate_links` segnalava "legale rimandato": Andrea ha indicato "attiva live" affermando che il legale è a posto → da aggiornare in memoria al go-live.
- Il fallback `.com` può essere **non licenziato in alcune giurisdizioni**: rischio esplicitamente accettato da Andrea (in alternativa, in futuro, si può passare al fail-closed "nascondi dove non c'è variante" cambiando solo `resolveBaseUrl`/`resolveBooks`).

## 8. Testing

Estendere `tests/sportsbooks-*.test.ts`:
- `resolveBaseUrl`: hit paese; fallback a `default`; fallback a `baseUrl` quando nessuno dei due; case-insensitive sul paese; paese `null/undefined`.
- `buildBetUrl(book, sel, country)`: usa il dominio regionale corretto e ci aggancia il sport-path; fallback corretto; il `catch` ritorna la baseUrl regionale.
- Registry: parsing di `_URLS` valido / assente / malformato.

## 9. Rollback

- Disattivazione immediata senza deploy: `SPORTSBOOK_LINKS_ENABLED=false` o svuotare `SPORTSBOOK_GEO_ALLOWLIST` (la feature torna inerte).
- Rollback codice: revert del merge (le modifiche sono additive e dietro env, basso blast radius).

## 10. File toccati (riepilogo)

- `lib/sportsbooks/types.ts` — campo `regionalUrls`.
- `lib/sportsbooks/registry.ts` — env `_URLS` + parsing.
- `lib/sportsbooks/index.ts` — `resolveBaseUrl` + `buildBetUrl(country)`.
- `app/api/bet-links/route.ts` — passa `country`.
- `tests/sportsbooks-*.test.ts` — copertura.

Nessuna migration DB, nessun cambio al motore/predizioni.
