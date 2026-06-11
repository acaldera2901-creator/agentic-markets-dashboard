# Sportsbook affiliate links — "Piazza scommessa" multi-book

**Data:** 2026-06-11
**Owner:** Andrea
**Stato:** design approvato (brainstorming) — NON implementato, NON deployato
**Approccio:** A (registry book + adapter per-book, link risolti server-side)

---

## ⚠️ Premesse di rischio (a verbale)

- Questa feature **promuove operatori di gioco** (Stake, Roobet) — privi di licenza in molte
  giurisdizioni (Italia/ADM, USA, UK…).
- **Italia / Decreto Dignità**: divieto totale di pubblicità e sponsorizzazione di gioco
  d'azzardo. Mostrare i link a utenti IT può configurare pubblicità vietata.
- Contraddice la strategia documentata come rischio go-live #1 (**VIA A non-gambling**).
- **Decisione di Andrea (umano, 2026-06-11):** procedere col design e con l'implementazione;
  **revisione legale rimandata a un secondo momento.** Il rischio è stato segnalato in modo
  esplicito.
- **Mitigazione cablata nel design:** default OFF + geo-gate server-side. Il codice è inerte
  finché qualcuno non lo accende deliberatamente (vedi §4). Il *flip-to-live* in produzione
  resta vincolato a: PROPOSAL + `APPROVE #id` umano sul gate + (raccomandato) ok legale.

**Costruito ≠ Verificato ≠ Operativo.** Questo spec copre solo "Costruito".

---

## 1. Obiettivo

Quando l'utente vuole agire su una pick, un CTA **"Piazza scommessa"** apre un **menu a tendina**
con i book affiliati ammessi per la sua geo. Ogni voce è un **link in uscita** verso il book col
nostro codice affiliato, idealmente con la selezione più pertinente già aperta.

**Noi non gestiamo mai fondi né scommesse.** Solo routing affiliato in uscita.

Estende l'attuale `lib/affiliate.ts` (un solo book placeholder da env) e la compliance UI già
presente in `app/page.tsx` (badge 18+, disclosure, `rel="nofollow sponsored noopener"`).

## 2. Non-obiettivi (YAGNI)

- ❌ Betslip realmente precompilato via bet-code reverse-engineered (era approccio C — scartato).
- ❌ Lettura saldo/storico account utente sul book (nessuna API ufficiale, alto rischio TOS).
- ❌ Esecuzione scommesse per conto utente (VIA B sconsigliata).
- ❌ Backend "betslip service" dedicato.

## 3. Componenti & data model

### 3.1 Selezione (input dal menu)
Oggetto che card / Match Builder passano al componente:
```ts
type BetSelection = {
  sport: "football" | "tennis" | "worldcup";
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  market: string;        // es. "1X2", "MO"
  pick: string;          // es. "1", "Over 2.5", nome giocatore
  odds: number | null;
  eventStartUtc?: string;
};
```

### 3.2 Registry book — `lib/sportsbooks/registry.ts`
Aggiungere un book = una voce di config. Generalizza `lib/affiliate.ts`.
```ts
type SportsbookId = "stake" | "roobet"; // estendibile
type Sportsbook = {
  id: SportsbookId;
  name: string;
  logo: string;          // path asset
  affiliateCode: string; // da env: SPORTSBOOK_<ID>_CODE
  baseUrl: string;       // da env: SPORTSBOOK_<ID>_URL
  adapter: BookAdapter;  // vedi 3.3
};
```
- I codici/URL arrivano da **env** (come fa già `affiliate.ts`); se non configurati, il book non
  viene emesso. Affiliate "da creare" → finché manca il codice, link assente o senza attribuzione.

### 3.3 Adapter per-book — `lib/sportsbooks/adapters/{stake,roobet}.ts`
Interfaccia comune:
```ts
type BuildResult = { url: string; prefilled: boolean };
type BookAdapter = (sel: BetSelection, book: Sportsbook) => BuildResult;
```
- **Stake** (`stake.ts`): affiliate link + best-effort = porta l'utente alla **ricerca evento /
  sezione sport** pertinente (`prefilled: false` quando è solo landing). Il bet-code pieno NON è
  in scope v1.
- **Roobet** (`roobet.ts`): solo affiliate link alla sezione sport/home (`prefilled: false`).
- L'adapter **non lancia mai**: in caso di input incompleto → fallback all'URL base affiliato.

### 3.4 Risolutore — `lib/sportsbooks/index.ts`
```ts
resolveBooks(countryCode: string): Sportsbook[]   // applica geo-gate (§4)
buildBetUrl(book: Sportsbook, sel: BetSelection): BuildResult
```

### 3.5 UI — `components/PlaceBetMenu.tsx`
CTA "Piazza scommessa" + dropdown dei book ammessi. Client component. Riceve `books` (già
filtrati per geo, risolti server-side) e `selection`.
- Riusa la compliance UI esistente: badge **18+**, disclosure affiliate, link gioco responsabile
  (gli stessi pattern di `app/page.tsx:467,1490`).
- Link in uscita con `rel="nofollow sponsored noopener"` `target="_blank"` (come le CTA attuali).

## 4. Geo-gate & default sicuri

Due leve di config (env):
- `SPORTSBOOK_LINKS_ENABLED` — master on/off. **Default: `false`.**
- `SPORTSBOOK_GEO_ALLOWLIST` — CSV di country code ISO, oppure `*` per globale. **Default: vuoto.**

Risoluzione **server-side** (legge `x-vercel-ip-country`, pattern già usato in
`app/api/track/route.ts`). Il client non può aggirarla.

Regole:
- `ENABLED=false` **o** allowlist vuota → `resolveBooks()` ritorna `[]` → CTA **nascosta**.
- Country ∈ allowlist (o allowlist = `*`) → book ammessi mostrati.
- **Out-of-the-box la feature è inerte.** Andare "globale" (richiesta di Andrea) = settare
  `ENABLED=true` + `ALLOWLIST=*`. *Quella* è la riga legata al passaggio legale "in un secondo
  momento" e al gate di approvazione.

## 5. Data flow

1. Card / Match Builder rende `<PlaceBetMenu selection={…} books={…} />` (books risolti
   server-side per geo).
2. Click su "Piazza scommessa" → apre dropdown dei book ammessi.
3. Click su un book → `buildBetUrl()` produce l'URL → `window.open(url, "_blank", "noopener")`.
4. In parallelo: POST a `/api/track` evento `sportsbook_click` (book, sport, geo). Fire-and-forget.
5. Il book si apre col nostro codice affiliato. Fine del nostro coinvolgimento.

## 6. Tracking

- Riuso `app/api/track/route.ts`. Aggiungere `"sportsbook_click"` all'`ALLOWED_EVENTS`.
- Payload: `{ event_type: "sportsbook_click", meta: { book, sport }, country }`.
- `value` resta 0 (come da hardening MEDIUM-2 esistente). Mai fidarsi del client per revenue.
- Fire-and-forget: un errore di track **non** blocca mai l'apertura del link.

## 7. Error handling

| Caso | Comportamento |
|------|---------------|
| 0 book ammessi per la geo | CTA "Piazza scommessa" non renderizzata |
| Adapter con selezione incompleta | Fallback all'URL base affiliato del book |
| Codice/URL book non in env | Book escluso dal registry (no link rotto) |
| `/api/track` fallisce | Ignorato, navigazione procede |

## 8. Testing (criteri di successo verificabili)

- **Unit adapter** (`stake`, `roobet`): URL contiene il codice affiliato; fallback su input
  incompleto; flag `prefilled` corretto; nessun throw.
- **Unit geo-resolver**: `ENABLED=false` → `[]`; allowlist vuota → `[]`; country fuori lista →
  `[]`; country in lista / `*` → book attesi; default (env assenti) → `[]`.
- **Component** (`PlaceBetMenu`): mostra solo i book passati; click apre URL + invia `track`;
  CTA assente se `books=[]`; presenza badge 18+/disclosure.
- **Track route**: `sportsbook_click` accettato; `value` forzato a 0.
- **Visual check da loggato** (regola UI repo): dropdown su card football/tennis/WC e nel Match
  Builder; responsive; nessuna regressione sulle CTA affiliate esistenti.

## 9. Surgical changes — file toccati

| File | Cambiamento |
|------|-------------|
| `lib/sportsbooks/registry.ts` | **nuovo** — registry book da env |
| `lib/sportsbooks/adapters/stake.ts` | **nuovo** — adapter Stake |
| `lib/sportsbooks/adapters/roobet.ts` | **nuovo** — adapter Roobet |
| `lib/sportsbooks/index.ts` | **nuovo** — `resolveBooks`, `buildBetUrl`, geo-gate |
| `components/PlaceBetMenu.tsx` | **nuovo** — CTA + dropdown |
| `app/page.tsx` | aggancio `<PlaceBetMenu>` su card + Match Builder (selezione → props) |
| `app/api/track/route.ts` | +`"sportsbook_click"` in `ALLOWED_EVENTS` |
| `tests/` | nuovi test unit/component sopra |
| `.env` / config | `SPORTSBOOK_LINKS_ENABLED`, `SPORTSBOOK_GEO_ALLOWLIST`, `SPORTSBOOK_<ID>_CODE/URL` |

`lib/affiliate.ts` esistente: **non rimosso**, resta backward-compatible (la CTA bonus singola
continua a funzionare). Generalizzazione futura opzionale, fuori scope.

## 10. Percorso fino al deploy (gate)

`spec (qui)` → `piano (writing-plans)` → `implementazione` → `test + visual check` →
**PROPOSAL con change-spec esatta su `ch_deploy_gate`** → **`APPROVE #id` umano (Andrea/Michele)**
→ deploy. Anche dopo il deploy, il flip `ENABLED=true`/`ALLOWLIST=*` è decisione umana separata,
raccomandato dopo ok legale.
