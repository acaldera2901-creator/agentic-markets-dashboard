# F7 — partner nel «best price» · cosa è fatto, cosa resta

Branch `betredge/v3c-partners` (da `betredge/v3c-preview`). Gate: `BETREDGE_PARTNER_FEEDS` (assente = come prima).

## Fatto e verificato
- Registro unico `lib/price-books.ts`: FortunePlay, YBets sempre; RollXO, N1 Bet (BetConstruct, `EXTRA_BOOKS`)
  e Wildz, Beazt (adapter Altenar `lib/altenar-feed.ts`) solo a gate acceso. Si confrontano solo book con link affiliato reale.
- `/api/v3/board`: `books[]` per partita (15 partner, `oddsAvailable` + `reason`), `partners` una volta; `book_prices` ordinati, max 6.
- UI v3c: nel pannello della riga, «Altri partner · quota sul loro sito» (BetScore, FeliceBet, GG.BET, VeloBet, Casea,
  Hollywin, Stonevegas) con link affiliato reale, `rel="nofollow sponsored"`, 18+. Nessun numero.
- Test con fixture registrate (fetch bloccato nei test). Quote feed = sito: 12/12 (05/10) + 6/6 (06/10).

## Resta
1. **APPROVE di Andrea** su `docs/v3c-partners-collector-proposal.md` (variabile in Preview, poi collector). — Andrea
2. **Wildz/Beazt**: quote del widget non confrontate col sito (Cloudflare Turnstile): da guardare a mano. — Andrea
3. **BetWinner** non compare in «quota sul sito»: non ha un link neutro (solo geo). Servirebbe la geo sul pannello. — programmatore
4. **«bonus»** del brief: non esiste un dato bonus per partner e il copy partner è volutamente senza claim su bonus (FTC). Non inventato. — marketing-betredge
5. **Loghi**: i chip usano il monogramma v3c (come FortunePlay/YBets), non il logo del file `/public/logos`. Da decidere in F10/ui. — ui-andrea
6. BetScore/Casea/Stonevegas: fornitore sportsbook non determinato (Altenar 400). Hollywin: feed region-restricted. Risposte partner in attesa. — Andrea
7. Lighthouse non disponibile in locale: fatto axe-core sulla sezione nuova (0 violazioni, chiaro e scuro).
