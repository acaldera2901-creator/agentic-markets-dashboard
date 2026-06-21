# Goalscorer Model — Design (sotto-progetto B-model, funzione pura)

**Data:** 2026-06-21
**Stato:** Design approvato (Andrea: "Sì, come proposto"). Scope ridotto alla FUNZIONE PURA TS, verificabile senza prod.
**Scope:** SOLO `lib/goalscorer-model.ts` (calcolo P(anytime) + Edge) + test. NON il wiring in `/api/predictions` (B-serve), NON la card (B-card, richiede dati live + visual check Andrea).

## Contesto / scoperta
Il λ di squadra è GIÀ servito: colonne `lambda_home/lambda_away` (lega, `match_predictions`) e `enrichment.lambdas` (WC, `unified_predictions`); `/api/predictions` GET già idrata i mercati gol via `lib/poisson-model.ts` (`computeExtraMarkets`/`computeGoalsSummary`). Quindi B-model è una funzione TS gemella, NON Python che ri-espone Dixon-Coles. Riusa il λ esistente.

## Modello (confermato)
Per ciascuna squadra (λ noto):
- quota interna alla squadra del giocatore: `share = g90 / Σ g90 (compagni eleggibili)` (auto-normalizzante; il λ partita incorpora già forza avversario/contesto).
- `λ_giocatore = λ_squadra × share × minutes_factor`, con `minutes_factor = clamp(minutes_share, 0, 1)`.
- `P(segna) = 1 − e^(−λ_giocatore)`.
- **Edge** = `P_modello − implied_best`, dove `implied_best = 1/best_price` (best price = quota decimale più alta tra i book US). L'implied include il vig → Edge **conservativo** (non sovrastima). Se nessuna quota → `market=null, edge=null` (stato onesto "–", coerente con lo standard card).
- **Confidence**: dal tier del dato (Tier1=xG disponibile → "alta"; Tier2=solo conteggio → "media"). Lega-agnostico.

NB: base = `goals_per90` (scelta Andrea "come proposto", non la variante xG).

## Interfaccia (pura, no I/O, no import Next)
```ts
type GsPlayer = { playerId: string|null; name: string; goalsPer90: number; minutesShare: number; tier: number };
type GsOdd = { playerName: string; price: number; bookmaker: string };
type GoalscorerMarket = {
  playerId: string|null; name: string; side: "home"|"away";
  pScores: number;                       // Modello
  marketImplied: number|null;            // Mercato (1/best_price) o null
  bestPrice: number|null; bookmaker: string|null;
  edge: number|null;                     // Modello − Mercato, o null
  confidence: "alta"|"media";
};
computeGoalscorerMarkets(
  lambdaHome: number, lambdaAway: number,
  homePlayers: GsPlayer[], awayPlayers: GsPlayer[],
  odds: GsOdd[], topN = 5
): GoalscorerMarket[]
```
- Output ordinato per `pScores` desc, max `topN` per squadra.
- Match odds↔giocatore per nome normalizzato (lowercase/trim/collapse spazi); best price = max price tra i match.
- Squadra con `Σ g90 <= 0` → nessun mercato per quella squadra (fail-closed).

## Error handling / edge
- `λ<=0` o lista vuota → [] per quella squadra.
- `minutesShare` fuori [0,1] → clamp.
- `price<=1.0` ignorato.
- Nessuna eccezione su input malformati ragionevoli (numeri mancanti → trattati come 0 → giocatore escluso se g90=0).

## Test (vitest, scoped — primo test TS del repo)
- P monotona: λ o share maggiore ⇒ pScores maggiore.
- P in (0,1); `P=1−e^−λ` esatta su un caso noto.
- Edge: con quota presente, `edge = pScores − 1/best_price`; sceglie il best price tra più book.
- Nessuna quota ⇒ `marketImplied/edge/bestPrice = null`.
- topN e ordinamento; fail-closed su Σg90=0; confidence per tier.

## Fuori scope (→ B-serve / B-card)
Wiring in `/api/predictions` (fetch player_profiles+player_odds, attach enrichment, tier projection); card UI marcatore + redirect; de-vig esplicito; mercati non-anytime.
