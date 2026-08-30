# Handoff — apertura geografica globale reversibile

**Data:** 2026-08-30  
**Destinatari:** Claude Code e Andrea  
**Stato:** implementazione completata e verificata localmente; deploy e configurazione Vercel non eseguiti

## Sezione tecnica per Claude Code

Obiettivo: aprire signup, link partner/sportsbook e feed FortunePlay a tutti i paesi, conservando i gate per restrizioni future.

Design approvato:

- `GEO_BLOCKED_COUNTRIES` rimane la fonte centrale, temporaneamente `new Set<string>()`.
- Le route FortunePlay importano la lista centrale e non mantengono più `new Set(["IT"])` locali.
- Signup resta separato e si apre con `SIGNUP_COUNTRY_ALLOWLIST=*`.
- Link sportsbook si aprono con `SPORTSBOOK_LINKS_ENABLED=true` e `SPORTSBOOK_GEO_ALLOWLIST=*`.
- Casea resta limitato a NO/CH/FI fino alla disponibilità di un URL neutro.
- Client, gestione errori, cache TTL, `Vary`, auth, DB e pagamenti non devono essere modificati.

Spec autorevole: `docs/superpowers/specs/2026-08-30-global-geo-opening-design.md`.

## Spiegazione non tecnica per Andrea

Il codice è pronto per aprire il sito globalmente senza cancellare il sistema di controllo geografico. La blocklist resta al suo posto ma, per ora, non contiene paesi. L'apertura diventa effettiva soltanto dopo deploy e configurazione Vercel; in futuro sarà possibile aggiungere nuovamente singoli paesi da un unico punto.

Le nuove registrazioni saranno aperte a tutti. Gli utenti esistenti continueranno ad accedere normalmente. I link e le quote sportsbook saranno visibili globalmente, ma i siti esterni potranno comunque applicare proprie regole o verifiche.

Casea rimane disponibile soltanto in Norvegia, Svizzera e Finlandia perché sono gli unici paesi per cui esistono link forniti dal partner. Non verrà usato un link nazionale sbagliato in altri mercati.

## File modificati

Codice applicativo:

- `lib/sportsbooks/index.ts` — blocklist centrale conservata ma temporaneamente vuota.
- `app/api/fortuneplay-match/route.ts` — rimossa la lista locale `IT`; importa la blocklist centrale.
- `app/api/fortuneplay-odds/route.ts` — rimossa la lista locale `IT`; importa la blocklist centrale.

Test aggiornati:

- `lib/sportsbooks/geo.test.ts`
- `tests/sportsbooks-resolver.test.ts`
- `app/api/geo-books/route.test.ts`
- `app/api/fortuneplay-match/route.test.ts`
- `app/api/fortuneplay-odds/route.test.ts`

Documentazione e isolamento:

- `docs/superpowers/specs/2026-08-30-global-geo-opening-design.md`
- `docs/superpowers/plans/2026-08-30-global-geo-opening.md`
- `docs/handoffs/2026-08-30-global-geo-opening-handoff.md`
- `.gitignore` — aggiunta `.worktrees/` per impedire commit accidentali dei worktree locali.

Commit:

- `def390a1` — design e prima versione dell'handoff;
- `4a61c6fa` — piano di implementazione;
- `38f578a5` — isolamento dei worktree;
- `83d92610` — apertura della policy geo centrale;
- `bc49fadd` — FortunePlay match sulla policy centrale;
- `c1eca9f6` — FortunePlay odds sulla policy centrale;
- `eced2d8a` — test di riattivazione futura della blocklist.

## Configurazione Vercel necessaria

Da applicare separatamente solo dopo test e approvazione del deploy:

```env
SIGNUP_COUNTRY_ALLOWLIST=*
SPORTSBOOK_LINKS_ENABLED=true
SPORTSBOOK_GEO_ALLOWLIST=*
```

La sola modifica Git non aggiorna Vercel. Preview e Production devono essere configurati separatamente soltanto dopo l'approvazione del deploy.

Devono inoltre restare configurati gli URL/codici degli sportsbook già attivi, per esempio le variabili `SPORTSBOOK_<ID>_URL`/`SPORTSBOOK_<ID>_CODE` o le mappe regionali esistenti. Il gate può essere aperto globalmente, ma senza almeno un book configurato `resolveBooks()` restituisce una lista vuota.

## Verifiche eseguite

- Baseline prima delle modifiche: `npm test` → 129 file, 1.780 test passati.
- Ciclo RED centrale: i nuovi test hanno fallito su set di 6 paesi, `geoAllowed("IT") === false` e `blocked: true`.
- Ciclo GREEN centrale: 2 file Vitest, 8 test passati; `sportsbooks-resolver ok`.
- Ciclo RED/GREEN FortunePlay match: fallimento iniziale `markets: []` per IT, poi 2 test passati.
- Ciclo RED/GREEN FortunePlay odds: fallimento iniziale `geoBlocked: true` per IT, poi 3 test passati.
- Regressione geo incrociata: 7 file, 46 test passati.
- Revisione della reversibilità: 4 file, 17 test passati; reinserendo temporaneamente IT vengono riattivati API blocked, mercati vuoti e redazione quote.
- Resolver standalone: `sportsbooks-resolver ok`, `sportsbooks-regional registry ok`, `sportsbooks-regional resolve/build ok`.
- Suite completa sul branch di implementazione: `npm test -- --reporter=dot --silent` → exit code 0, 129 file e 1.784 test passati.
- Verifica post-merge su `main`, dopo l'integrazione con `origin/main`: `npm test -- --reporter=dot --silent` → exit code 0, 131 file e 1.800 test passati.
- Lint dei soli 8 file applicativi/test modificati: exit code 0, nessun errore o warning.
- Lint globale: exit code 1 per 15 errori e 84 warning preesistenti in file estranei al cambiamento, tra cui `features/feed/market-groups.test.ts`, `features/feed/use-match-detail.ts`, `features/onboarding/AuthProvider.tsx`, `features/profile/use-referral.ts` e `scripts/backtest_2025_football.ts`.
- Build Next.js 16.2.7: exit code 0, compilazione TypeScript completata e 171 pagine statiche generate.
- Primo build nel percorso worktree lungo: panic Turbopack per limite path Windows. Il medesimo commit ha compilato correttamente dopo lo spostamento fisico del worktree in `C:\codex-wt\agentic-global-geo`; nessuna modifica applicativa è stata necessaria.
- Smoke test con wildcard, master switch e un book simulato configurato: IT, DE, US, GB e geo assente hanno restituito `allowed: true` e `books: 1`.
- `git diff --check`: nessun errore di whitespace nei file implementati.

## Rischi e monitoraggio

- Maggiore volume potenziale di registrazioni e spam: monitorare 429, errori auth e creazione profili.
- Maggiore uso di `fortuneplay-match` dai paesi prima bloccati: monitorare latenza, errori upstream e rate limit.
- Verificare che almeno uno sportsbook conservi URL/codice configurati; altrimenti il gate è aperto ma non esistono link risolvibili.
- I link esterni possono applicare restrizioni proprie, non controllabili da BetRedge.
- L'apertura globale dei contenuti gambling richiede una decisione compliance separata dalla correttezza tecnica.
- La cache continua a variare per paese per rendere sicura una futura riattivazione dei blocchi.
- `npm ci` segnala 8 vulnerabilità del lockfile (2 low, 6 high) già presenti e non corrette perché fuori ambito; pianificare un audit separato.

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
