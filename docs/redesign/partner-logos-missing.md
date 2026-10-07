# Loghi dei partner — cosa c'è e cosa manca (ui2, 07/10/2026)

Fonte dei loghi nel redesign: il catalogo `lib/partners.ts` (campo `logo`, file in `public/logos/`),
lo stesso che usa la vetrina /partners di oggi. Componente: `components/v3c/PartnerLogo.tsx`.
Nessun logo è stato generato con AI né ridisegnato in questo filone.

## Partner senza logo
**Nessuno.** Tutti i 15 partner del catalogo hanno un file in `public/logos/`:

| Partner | File | Nota |
|---|---|---|
| Beazt | beazt.svg | marchio ufficiale (CDN della rete Rootz) |
| BetScore | betscore.svg | SVG che incapsula un PNG |
| BetWinner | betwinner.svg | wordmark estratto dal lockup del sito affiliati (vedi nota in lib/partners.ts) — sostituire se BetWinner manda il file ufficiale |
| Casea | casea.png | wordmark dal sito del partner |
| FeliceBet | felicebet.png | fornito dal partner |
| FortunePlay | fortuneplay.svg | **solo emblema (leone), senza nome scritto** |
| GG.BET | ggbet.png | dal file 300×300 del partner |
| Hollywin | hollywin.svg | **solo emblema, senza nome scritto** |
| N1 Bet | n1bet.svg | **solo emblema («N1»)** |
| RollXO | rollxo.svg | **solo emblema («XO»)** |
| slotsbonus | slotsbonus.svg | |
| Stonevegas | stonevegas.png | lockup ufficiale |
| VeloBet | velobet.png | wordmark dal sito del partner |
| Wildz | wildz.svg | marchio ufficiale (Rootz) |
| YBets | ybets.svg | |

## Da chiedere alla rete affiliata (non bloccante)
I quattro marchi senza nome scritto (FortunePlay, Hollywin, N1 Bet, RollXO): nel redesign accanto
al logo compare sempre il nome in testo, tranne nel chip stretto della riga della board (logo + quota,
nome nel nome accessibile e nel `title`). Se le reti hanno un **lockup orizzontale con il nome**
(fortuneplay.com, hollywin.com, n1bet.com, rollxo.com — via N1 Partners / programma FortunePlay),
basta sostituire il file in `public/logos/` e togliere l'id da `WORDLESS` in `PartnerLogo.tsx`.

## Fallback
Se un partner nuovo entra nel catalogo senza `logo`, `PartnerLogo` mostra il **nome** del partner
sulla stessa placca (mai le iniziali). Aggiungerlo a questa tabella.

## Compliance (da confermare, Andrea)
L'uso dei loghi dei partner nelle pagine affiliate va confermato come permesso dai rispettivi
programmi (termini d'uso del brand/creatività di ogni rete). I file sono gli stessi già pubblicati
sulla vetrina /partners di oggi; il redesign li mostra in più punti (board, partita, price check, Books).
