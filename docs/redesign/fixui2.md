# Filone INTERFACCIA, terzo giro — `betredge/v3c-fixui2` (07/10/2026, ui-andrea)

Base `betredge/v3c-final5` fc9f1773. Parallelo a `fixdata2` (dati e logica): non tocca `lib/v3c/board*.ts`,
query, API, matching, protezione/EV, live-data. Non pushato.

## Cosa cambia (ID di QA-REPORT-2)
- **N1** banco della home: solo partite non iniziate e non trattenute dalla protezione (`exampleEligible`, filtro
  sia nel server `BenchBlock` sia nel client `Bench`); nessun importo (`withoutMoney`: Kelly «10.7% · €54» → «10.7%»).
  Senza partita idonea: numeri d'esempio dichiarati («Example numbers, not a real match…»). Test di regressione con
  la forma di Botafogo–Vasco (`components/v3c/fixui2.test.tsx`). Il price check apre per default la prima partita non
  trattenuta.
- **B3** scelta (b): «Sign in» tolto da barra in alto e piè (nel menu «More» non c'era); un solo link discreto
  «Existing members» nella riga finale del piè → `/plans?auth=login` (il flusso di oggi, intatto). Perché non (a):
  il modale di accesso vive dentro la Dashboard e dice lui stesso «BetRedge Pro is crypto-only» e «Continue to
  plans»; ogni tab della Dashboard è il sito vecchio scuro, e a flag acceso le tab neutre (`/predictions`) sono già
  riscritte su v3c. Nessun rewrite poteva togliere «crypto-only» senza toccare il codice del login, che è vietato.
  La Fase 0 non ha nulla dietro un account.
- **N4** price check: si apre sui prezzi di un book connesso che quota tutti gli esiti, altrimenti caselle vuote con
  «Enter the price you see» e uno stato vuoto (non un errore); mai il prezzo composito di mercato (resta il chip
  «Market price», scelta esplicita). Kelly solo in frazione, campo bankroll tolto.
- **N6** `?m=` di una partita fuori dalle prime 80: la si aggiunge alla lista; se la board non la può aprire
  (iniziata, senza prezzi, id ignoto) il price check si apre vuoto con «This match is not in the price check…».
- **N7** Books: i nomi nascosti (`.v3c-sr`, assoluti) del confronto prezzi uscivano dal contenitore a scorrimento e
  allargavano la pagina; il contenitore ora è il loro blocco di riferimento. Overflow 0 a 360/375/390/430, anche con
  9 colonne di book in più; ACCEPT del banner intero.
- **N8** sigillo con giorno e ora («Sealed 6 Oct 16:30», «UTC» solo prima del mount); se la riga è dopo il calcio
  d'inizio diventa «logged» + «Logged after kick-off», mai «sealed before kick-off». Nessun dato nuovo da fixdata2.
- **N5** /leaderboard, /invite, /community: `noindex, nofollow` solo sulle rotte v3c, /community fuori dalla sitemap
  a flag acceso, /community senza paywall («Creator slips · preview»). Vedi `fixui2-legal-hold.md`.
- **N12/N13** banner Pro del record: «Pro preview: nothing to buy yet» / «Read the Pro preview» (11 lingue).
- **M7** gli 8 link assoluti degli articoli pubblicati (SELECT 07/10) passano già per `relativizeSiteLinks`: test
  sulle 8 URL reali. **M9** solo documentazione (`fixui2-legal-hold.md`).

## Richieste a fixdata2 (non fatte qui, file loro)
- `lib/v3c/board-source.ts` `liveBoardMatches`: le pagine tool precompilano EV/Kelly e la colonna «EV at» con TUTTE
  le partite con mercato, comprese quelle trattenute dalla protezione. Serve `valueToolsAllowed(m)` nel filtro (stesso
  criterio di N1).
- N4 lato dati: se il «market price» del price check deve diventare il miglior prezzo dei book, è loro.

## File condivisi toccati
`components/v3c/Chrome.tsx` (accesso, import `fixui2.css`), `Sigillo.tsx` (prop `kickoff/afterLabel/afterTitle`),
`board/BoardRow.tsx`, `match/MatchView.tsx`, `lib/v3c/banner-copy.ts`, `app/sitemap.ts` (solo flag acceso),
`lib/v3c/i18n-parity.test.ts`, fixture di `tennis2.test.tsx`/`ui3.test.tsx`/`final3.test.tsx`, `scripts/v3c/mock-db.ts`
(`MOCK_FIXUI2=1`).

## Verifica locale
`MOCK_DB_PORT=54411 MOCK_FIXDATA=1 MOCK_FIXUI2=1 npx tsx scripts/v3c/mock-db.ts`, build ON con
`NEXT_PUBLIC_SUPABASE_URL` sul mock, `next start` con `no-network.cjs`, poi `scripts/v3c/fixui2-shots.mjs`.
Il `next dev` di Next 16 non idrata sotto Playwright (websocket HMR rifiutato): gli scatti vanno fatti sulla build.
