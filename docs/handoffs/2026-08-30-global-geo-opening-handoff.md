# Handoff — apertura geografica globale reversibile

**Data:** 2026-08-30  
**Destinatari:** Claude Code e Andrea  
**Stato:** bozza pre-implementazione; aggiornare risultati e commit dopo le verifiche

## Sezione tecnica per Claude Code

Obiettivo: aprire signup, link partner/sportsbook e feed FortunePlay a tutti i paesi, conservando i gate per restrizioni future.

Design approvato:

- `GEO_BLOCKED_COUNTRIES` rimane la fonte centrale, temporaneamente `new Set<string>()`.
- Le route FortunePlay devono importare la lista centrale invece di mantenere `new Set(["IT"])` locali.
- Signup resta separato e si apre con `SIGNUP_COUNTRY_ALLOWLIST=*`.
- Link sportsbook si aprono con `SPORTSBOOK_LINKS_ENABLED=true` e `SPORTSBOOK_GEO_ALLOWLIST=*`.
- Casea resta limitato a NO/CH/FI fino alla disponibilità di un URL neutro.
- Client, gestione errori, cache TTL, `Vary`, auth, DB e pagamenti non devono essere modificati.

Spec autorevole: `docs/superpowers/specs/2026-08-30-global-geo-opening-design.md`.

## Spiegazione non tecnica per Andrea

Il sito verrà aperto globalmente senza cancellare il sistema di controllo geografico. Le liste restano al loro posto ma, per ora, non contengono paesi bloccati. In futuro sarà possibile aggiungere nuovamente singoli paesi da un unico punto.

Le nuove registrazioni saranno aperte a tutti. Gli utenti esistenti continueranno ad accedere normalmente. I link e le quote sportsbook saranno visibili globalmente, ma i siti esterni potranno comunque applicare proprie regole o verifiche.

Casea rimane disponibile soltanto in Norvegia, Svizzera e Finlandia perché sono gli unici paesi per cui esistono link forniti dal partner. Non verrà usato un link nazionale sbagliato in altri mercati.

## File modificati

Da compilare al termine dell'implementazione con il diff effettivo. File previsti:

- `lib/sportsbooks/index.ts`
- `app/api/fortuneplay-match/route.ts`
- `app/api/fortuneplay-odds/route.ts`
- `lib/sportsbooks/geo.test.ts`
- `tests/sportsbooks-resolver.test.ts`
- `app/api/geo-books/route.test.ts`
- `app/api/fortuneplay-match/route.test.ts`
- `app/api/fortuneplay-odds/route.test.ts`

## Configurazione Vercel necessaria

Da applicare separatamente solo dopo test e approvazione del deploy:

```env
SIGNUP_COUNTRY_ALLOWLIST=*
SPORTSBOOK_LINKS_ENABLED=true
SPORTSBOOK_GEO_ALLOWLIST=*
```

Ambienti da aggiornare: indicare qui Preview/Production al momento dell'operazione. La sola modifica Git non aggiorna Vercel.

## Verifiche eseguite

Stato attuale: non ancora eseguite; implementazione non iniziata.

Da registrare:

- test mirati e relativo esito;
- suite completa;
- lint;
- build;
- smoke test IT, DE, US, GB e geo assente;
- controllo diff e file estranei esclusi.

## Rischi e monitoraggio

- Maggiore volume potenziale di registrazioni e spam: monitorare 429, errori auth e creazione profili.
- Maggiore uso di `fortuneplay-match` dai paesi prima bloccati: monitorare latenza, errori upstream e rate limit.
- I link esterni possono applicare restrizioni proprie, non controllabili da BetRedge.
- L'apertura globale dei contenuti gambling richiede una decisione compliance separata dalla correttezza tecnica.
- La cache continua a variare per paese per rendere sicura una futura riattivazione dei blocchi.

## Procedura di rollback

Spegnimento immediato dei link sportsbook senza modifica del codice:

```env
SPORTSBOOK_LINKS_ENABLED=false
```

Chiusura tramite allowlist:

```env
SPORTSBOOK_GEO_ALLOWLIST=
```

Limitazione delle nuove registrazioni senza bloccare gli utenti esistenti:

```env
SIGNUP_COUNTRY_ALLOWLIST=CH,GB,US
```

Se necessario, ripristinare una blocklist centrale e fare deploy.

## Aggiungere paesi bloccati in futuro

Modificare esclusivamente `GEO_BLOCKED_COUNTRIES` in `lib/sportsbooks/index.ts`:

```ts
export const GEO_BLOCKED_COUNTRIES = new Set([
  "IT",
  "DE",
]);
```

Usare codici ISO 3166-1 alpha-2 uppercase, aggiornare i test con gli stessi paesi, eseguire l'intera verifica e poi fare deploy. Poiché le route FortunePlay useranno la stessa fonte, non dovranno essere aggiornate separatamente.

Per restringere soltanto le nuove iscrizioni, modificare invece `SIGNUP_COUNTRY_ALLOWLIST`; login, logout e recupero password restano aperti.
