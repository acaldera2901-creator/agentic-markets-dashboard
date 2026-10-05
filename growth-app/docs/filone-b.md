# Filone B — /lavoro, lo spazio di lavoro di Steve

Branch `feat/growth-b`, partito da `origin/feat/growth-standalone`.

## Cosa c'è

Nuova rotta `/lavoro`, statica (prerenderizzata alla build) e protetta dalla stessa Basic auth di
`proxy.ts`, che copre tutte le rotte. Ha quattro sezioni e copre gli output del PDF «BetRedge
Execution System» che la dashboard dei numeri non copre già:

| Sezione | File sorgente | Output del PDF |
|---|---|---|
| Tracking gaps (13 gap noti dalla v3: priorità, KPI sbloccati, owner suggerito, stato) | `content/tracking-gaps.json` | tracking gaps list |
| Backlog esperimenti (3 esempi E01–E03, «esempio da validare con Steve») | `content/experiments.json` | experiment proposal |
| Memo settimanale scale/fix/kill (template + elenco dei memo) | `content/memo/_template.md`, `content/memo/AAAA-Www.md` | scale/fix/kill memo |
| Accessi e fonti (v3: 17 fonti, un blocco operativo ciascuna — ruolo minimo, passi, owner, verifica — tutte «da concedere») | `content/sources.json` | prerequisito per tutto il resto |

La guida di una pagina per Steve sta in `content/README.md`.

### File
- `app/lavoro/page.tsx`: collega i contenuti alla UI.
- `ui/work/content.ts`: tipi, validazione e lettura dei memo. Se un JSON è malformato, la build e i test falliscono dicendo file, riga e campo.
- `ui/work/WorkPage.tsx`: componente di presentazione. Sotto `md` usa card al posto della tabella, così non c'è scroll orizzontale.
- `ui/work/content.test.ts`: 12 gap, ognuno con owner e KPI sbloccati. Esperimenti marcati come esempi. Nessun accesso dichiarato verificato. Nessun memo finto. La validazione rifiuta le modifiche sbagliate.
- `ui/work/auth.test.ts`: il matcher del proxy copre `/lavoro`. Senza credenziali risponde 401, con password sbagliata 401, senza config 503, con la password giusta passa.

## Da dove vengono i dati degli esempi
I numeri di partenza di E01–E03 vengono da `data/snapshot.json` (generato il 05/10, finestra 30
giorni): 13 sessioni con fonte su 400, `plan_cta_click/plan_view` = 4/126, `signup_completed/started` = 24/66.
Con questi volumi un A/B test non ha potenza statistica: gli esempi sono confronti prima/dopo, con un minimo di volume
dichiarato. Priorità e owner dei gap sono **proposte**: per gli owner ho ripreso quelli di `MISSING_KPIS`
in `core/kpi.ts`, dove esistevano. G12 è «mitigato» perché la dashboard già separa comp/team con `plan_source`.

## Limite dichiarato: niente DB, niente salvataggio dalla pagina
L'app standalone non ha un DB scrivibile e non ne è stato creato uno: servirebbero infrastruttura e credenziali nuove, che passano dal gate di Andrea.
La pagina mostra file versionati: Steve aggiorna con un commit o una PR, il deploy successivo li mostra.
I memo appaiono come testo semplice, perché il markdown non viene interpretato. Non ho aggiunto un parser per questo.

## PROPOSTA (non implementata): contenuto editabile in-app, insieme al CRM di Michele
Da fare quando la dashboard si unirà al CRM. L'implementazione si sceglie in base a cosa intende Michele per «CRM» (vedi README principale):
1. Le 4 sezioni diventano tabelle (`growth_gaps`, `growth_experiments`, `growth_memos`, `growth_access`), con lo stesso schema dei JSON. La validazione di `ui/work/content.ts` diventa il controllo lato server sulle scritture.
2. Le scritture passano da un ruolo dedicato, **distinto** dal `growth_ro` di sola lettura della PROPOSAL #GROWTH-LIVE, e solo sulle tabelle `growth_*`. Mai scrittura sulle tabelle prodotto.
3. Auth per utente al posto della password condivisa: lo storico deve sapere chi ha cambiato cosa. Serve l'auth del CRM.
4. Migrazione: si importano una volta i JSON attuali, poi `content/` va in sola lettura e si archivia.

Gate: nuova tabella, ruolo e credenziali vogliono una PROPOSAL e l'APPROVE di Andrea.

## Per l'integratore
- **Link di navigazione** fra `/` (dashboard) e `/lavoro`: aggiunto in v2 (prop opzionali `workHref` di `GrowthDashboard` e `dashboardHref` di `WorkPage`).
- Non ho toccato `core/`, `data/`, `ui/GrowthDashboard.tsx`, `proxy.ts`, `app/page.tsx`.

## Verifica (06/10)
- `npm test`: 38 passati, 2 saltati (integrazione LIVE senza env). `npm run typecheck`, `npm run lint` e `npm run build` verdi. `/lavoro` risulta `○ (Static)`.
- `next start` locale: `/lavoro` senza auth → 401, con auth → 200.
- Playwright con viewport a 1440 e 390 px: `scrollWidth == clientWidth` in entrambi (1440/1440 e 390/390), quindi niente scroll orizzontale. Screenshot controllati a occhio.
- NON VERIFICATO: deploy su Vercel (non fatto, non richiesto).
