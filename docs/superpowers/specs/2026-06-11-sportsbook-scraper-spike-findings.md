# Spike findings — estrazione odds Stake/Roobet (#SPORTSBOOK-SCRAPER-1)

**Data:** 2026-06-11 · **Stato:** Roobet investigato, **Stake da fare**.

## Fatto cruciale che cambia il piano
I domini dei book (`roobet.com`, `stake.com`) **resettano la connessione al TLS Client Hello** per i client non-browser (curl/httpx/LibreSSL) — blocco per **TLS-fingerprint (JA3)**. Verificato: porta 443 aperta, ma `Recv failure: Connection reset by peer` al handshake; un sito Cloudflare normale risponde 200. → **Un client httpx puntato al dominio del book è morto in partenza.**

MA le odds non vengono servite dal dominio del book: vengono da un **feed provider** separato, e quel feed **è raggiungibile direttamente via httpx**.

## Roobet — RISOLTO (estrazione fattibile via httpx, no browser, no proxy)
- Sportsbook Roobet = **widget BetBy** (URL con `bt-path=/soccer`; asset da `start5.sptpub.com`).
- Le odds arrivano dal feed **BetBy / `sptpub.com`**:
  - host: `https://api-g-c7818b61-607.sptpub.com`
  - prematch: `/api/v4/prematch/brand/{BRAND}/en/{cursor}`
  - live: `/api/v4/live/brand/{BRAND}/en/{cursor}`
  - `BRAND = 2186449803775455232` (Roobet)
- **Raggiungibile direttamente via curl/httpx: HTTP 200, JSON**, con header `Origin: https://roobet.com` + `Referer: https://roobet.com/`. **Nessun blocco TLS su sptpub.com** (a differenza di roobet.com). Da questa macchina/regione: nessun proxy necessario.
- Protocollo: **delta versionato**. `/en/0` ritorna un envelope `{epoch, version, top_events_versions, rest_events_versions, status:{event_id:code}}`. I payload eventi+odds completi si pescano seguendo i cursori di sessione (nel browser la prima richiesta era `/en/3562354952381`, payload grande). **Da completare:** reverse-engineering esatto del giro cursori per estrarre evento→mercati→quote (1X2, O/U) + mapping nomi competitor (le immagini competitor hanno id numerici da `d1bvoel1nv172p.cloudfront.net`).
- **Implicazione business:** BetBy è un provider B2B noto. Un'eventuale partnership dati per Roobet passerebbe da BetBy, non da Roobet direttamente.

## Stake — PARZIALE + nodo legale nuovo
- `stake.com` è TLS-bloccato come Roobet. **Dall'Italia, stake.com redirige a `stake.it`** = **operatore ADM-licenziato italiano** (Stake Italy s.r.l., concessione GAD 16017, PIVA 01602370338). Quindi lo "Stake" che vede un utente italiano è la versione **regolamentata ADM**, dominio/mercati/odds diversi dal global stake.com.
- **Implicazioni:** (1) scraping di un operatore ADM-regolamentato = nodo legale più pesante del previsto (non un casino offshore qualsiasi); (2) **geo-dipendenza**: l'output dello scraper dipende da DOVE gira (Italia→stake.it; altrove→stake.com global). Da decidere quale Stake vogliamo.
- Host del feed odds **non ancora individuato** (la homepage non lo carica; serve entrare in Scommesse→Calcio e catturare le richieste). **Spike Stake incompleto.**

### Aggiornamento spike Stake (2026-06-11) — materialmente più difficile di Roobet
- Piattaforma stake.it = **Octavian Lab** (`live.octavianlab.com`, `cdn.octavianlab.com`). Le rotte ovvie del sportsbook (`/sports`, `/betting`) tornano **404**; gli endpoint Octavian (`/accounting/v3/{menubar,configs}`) richiedono parametri brand/operator e da soli tornano vuoti/400.
- Il feed odds **non si manifesta** dalla navigazione pubblica anonima: la sezione scommesse pare **login-gated** (sito ADM, KYC) e/o le quote arrivano via **websocket** (non un JSON pulito come BetBy/sptpub di Roobet).
- **Blocker reale:** per arrivare al feed odds servirebbe quasi certamente una **sessione loggata** (account ADM con KYC). L'agente **non può autenticarsi/loggarsi** (regola dura) né creare account → lo spike Stake non è completabile in autonomia. Inoltre resta il **nodo legale ADM** (scraping di un concessionario italiano).
- **Opzioni:** (a) Andrea fa login su stake.it nel browser, poi l'agente ispeziona/cattura il feed odds della sessione loggata; (b) si congela Stake fino ai contratti (l'API ufficiale eviterebbe sia login che ADM-scraping). Roobet resta consegnato e funzionante a prescindere.

## Impatto sul piano di implementazione (Plan 1)
- **Approach B (httpx) È viable** — ma i client puntano al **feed provider** (sptpub per Roobet), non al dominio del book. Buona notizia: niente scraping DOM via headless, niente proxy (per Roobet, da qui).
- `core/roobet_client.py` = client del protocollo BetBy/sptpub (cursori + parse eventi). `core/stake_client.py` = protocollo Stake in-house (TBD dopo spike Stake). Confermato: **un client per book, formati diversi**.
- I Task 3/4 del piano vanno riscritti contro questi feed reali (non contro roobet.com/stake.com).
- Fixture reali ancora da catturare: il payload eventi completo BetBy (post reverse-engineering cursori) + Stake.

## Prossimi step concreti
1. Roobet: completare il reverse-engineering del giro cursori sptpub → catturare un payload eventi reale (calcio+tennis) come fixture → scrivere il parser.
2. Stake: spike browser per trovare il feed odds + testarne l'accesso diretto.
3. Aggiornare Plan 1 (Task 3/4) coi protocolli reali.
