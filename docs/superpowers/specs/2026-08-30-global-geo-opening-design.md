# Apertura geografica globale reversibile

**Data:** 2026-08-30  
**Stato:** approvazione di design ricevuta; implementazione non ancora eseguita  
**Approccio scelto:** blocklist centrale conservata ma temporaneamente vuota

## Obiettivo

Aprire temporaneamente a tutti i paesi:

- nuove registrazioni;
- link e CTA verso sportsbook;
- vetrina dei partner;
- quote e mercati FortunePlay.

La logica geografica non viene eliminata. Deve essere possibile ripristinare in futuro restrizioni mirate senza riprogettare il sistema.

## Vincoli

- Login, logout, recupero password e accesso degli utenti esistenti restano invariati.
- Database, profili, piani, pagamenti, sessioni e codici affiliati non vengono modificati.
- Casea resta visibile soltanto in NO, CH e FI finché il partner non fornisce un URL neutro globale.
- I controlli tecnici fail-closed in caso di errore dell'endpoint geo restano attivi.
- Nessun deploy o cambiamento delle variabili Vercel fa parte della modifica locale senza un'autorizzazione separata.
- I file non tracciati già presenti nel worktree sono estranei e non devono essere modificati o inclusi nei commit.

## Architettura proposta

### 1. Blocklist sportsbook e partner

`lib/sportsbooks/index.ts` resta la fonte unica della blocklist:

```ts
export const GEO_BLOCKED_COUNTRIES = new Set<string>();
```

`geoAllowed()` continua ad applicare, nello stesso ordine:

1. blocklist centrale;
2. `SPORTSBOOK_GEO_ALLOWLIST`;
3. master switch `SPORTSBOOK_LINKS_ENABLED` tramite `resolveBooks()`.

Con blocklist vuota e allowlist `*`, ogni paese, inclusa una geo non disponibile, viene ammesso. In futuro sarà sufficiente reinserire i codici ISO-2 nel set per bloccare paesi specifici.

### 2. Endpoint geo e client

`app/api/geo-books/route.ts` importa già `GEO_BLOCKED_COUNTRIES`; non richiede una nuova fonte dati. Con il set vuoto restituisce `blocked: false` per qualsiasi paese e continua a restituire `country`, necessario per scegliere gli URL regionali e per Casea.

I componenti client non vengono semplificati o resi fail-open. Continuano a montare contenuti partner solo dopo una risposta valida dall'endpoint. Questo evita regressioni durante errori di rete e conserva una base sicura per future restrizioni.

### 3. Quote e mercati FortunePlay

Le blocklist locali duplicate in:

- `app/api/fortuneplay-match/route.ts`;
- `app/api/fortuneplay-odds/route.ts`;

saranno rimosse. Entrambe le route importeranno `GEO_BLOCKED_COUNTRIES` da `@/lib/sportsbooks`, così una futura modifica della lista si applicherà contemporaneamente a vetrina partner, link, quote e mercati.

La cache TTL dei feed, la gestione best-effort degli errori, la struttura delle risposte e gli header di cache restano invariati.

### 4. Registrazioni

La logica in `lib/signup-geo.ts` non richiede modifiche. La configurazione:

```env
SIGNUP_COUNTRY_ALLOWLIST=*
```

ammette ogni paese, anche quando l'header geografico manca. Il gate riguarda esclusivamente `action=register`; login, logout e recupero password restano indipendenti e aperti.

La separazione tra signup e contenuti sportsbook viene mantenuta intenzionalmente: in futuro sarà possibile limitare le nuove registrazioni senza impedire agli utenti esistenti di accedere.

### 5. Configurazione runtime richiesta

Per ottenere l'apertura globale in un ambiente Vercel devono essere presenti:

```env
SIGNUP_COUNTRY_ALLOWLIST=*
SPORTSBOOK_LINKS_ENABLED=true
SPORTSBOOK_GEO_ALLOWLIST=*
```

La modifica del repository non aggiorna automaticamente le variabili dell'ambiente di produzione. Il loro cambiamento e il deploy restano operazioni separate.

## File previsti

### Codice

- `lib/sportsbooks/index.ts`: svuotamento tipizzato della blocklist centrale e aggiornamento dei commenti.
- `app/api/fortuneplay-match/route.ts`: rimozione blocklist locale e import della fonte centrale.
- `app/api/fortuneplay-odds/route.ts`: rimozione blocklist locale e import della fonte centrale.

### Test

- `lib/sportsbooks/geo.test.ts`: verifica blocklist vuota e apertura globale con `*`.
- `tests/sportsbooks-resolver.test.ts`: verifica accesso globale e conservazione di master switch/allowlist.
- `app/api/geo-books/route.test.ts`: verifica `blocked: false` anche per i paesi precedentemente bloccati.
- `app/api/fortuneplay-match/route.test.ts`: verifica mercati disponibili anche per IT.
- `app/api/fortuneplay-odds/route.test.ts`: verifica quote e URL disponibili anche per IT, con `geoBlocked: false`.

### Documentazione

- `docs/handoffs/2026-08-30-global-geo-opening-handoff.md`: consegna condivisa per Claude Code e Andrea.

`.env.example` conserva i default sicuri e documenta la configurazione globale; non deve trasformarsi in una configurazione di produzione implicita.

## Impatto e rischi

### Autenticazione

L'apertura geografica non bypassa validazione email, password, consenso, attivazione o rate limiting. Può aumentare il volume di registrazioni e il rischio di spam perché la superficie diventa mondiale. Il rate limiter corrente è best-effort per istanza serverless; dopo il deploy vanno monitorati HTTP 429, nuove registrazioni e anomalie per IP.

### Feed sportsbook

`fortuneplay-match` inizierà a interrogare il feed anche per visitatori provenienti da paesi precedentemente bloccati. La cache TTL riduce il carico, ma vanno monitorati errori upstream, latenza e rate limit.

`fortuneplay-odds` interroga già i feed prima della redazione geografica; l'apertura cambia il payload consegnato, non il numero fondamentale di fetch effettuati dalla route.

### Cache

L'header `Vary` geografico resta presente. Con una blocklist vuota può frammentare la cache più del necessario, ma conservarlo rende sicura la futura riattivazione dei blocchi e riduce il rischio di esposizione causato da cache condivise dopo un cambio policy.

### Link esterni

BetRedge può rendere visibili i link globalmente, ma non controlla disponibilità, redirect, KYC o restrizioni applicate dai siti esterni. Gli URL regionali continueranno a usare il percorso esistente: override per paese, poi `default`, poi `baseUrl`.

### Casea

Casea non viene aperto artificialmente. Rimane disponibile soltanto dove esiste un URL fornito dal partner: NO, CH e FI. Quando arriverà un URL neutro sarà oggetto di una modifica separata e testata.

## Verifica

L'implementazione deve seguire test-first e includere:

1. test mirati delle cinque aree geo;
2. suite Vitest completa;
3. lint;
4. build Next.js;
5. controllo del diff per escludere file estranei;
6. smoke test locale o preview per IT, DE, US, GB e header assente.

Criteri di successo:

- signup ammesso con `SIGNUP_COUNTRY_ALLOWLIST=*` per ogni paese e geo ignota;
- `/api/geo-books` restituisce sempre `blocked: false` con blocklist vuota;
- `/api/bet-links` è abilitato globalmente quando master switch e wildcard sono attivi;
- FortunePlay restituisce quote e mercati completi anche per IT;
- Casea compare soltanto per NO, CH e FI;
- nessuna regressione nei test non geografici.

## Rollback

Rollback operativo immediato dei link sportsbook:

```env
SPORTSBOOK_LINKS_ENABLED=false
```

Chiusura completa tramite allowlist:

```env
SPORTSBOOK_GEO_ALLOWLIST=
```

Restrizione delle sole nuove registrazioni:

```env
SIGNUP_COUNTRY_ALLOWLIST=CH,GB,US
```

Ripristino di blocchi mirati su partner, link e FortunePlay:

```ts
export const GEO_BLOCKED_COUNTRIES = new Set(["IT", "DE"]);
```

Quest'ultima operazione richiede deploy. Gli utenti esistenti continuano ad accedere perché il gate signup non viene applicato al login.

## Esclusioni

- Nessuna modifica o deploy delle variabili Vercel in questa fase.
- Nessun nuovo URL Casea.
- Nessuna modifica alle policy dei siti sportsbook esterni.
- Nessun refactoring non necessario dei componenti client.
- Nessuna valutazione o approvazione legale implicita: l'apertura tecnica e l'autorizzazione compliance restano decisioni distinte.
