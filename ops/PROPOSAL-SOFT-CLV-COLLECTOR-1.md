# PROPOSAL #SOFT-CLV-COLLECTOR-1 — Collector forward quote soft FortunePlay (verso l'edge soft)

**Origine:** analisi ML read-only 2026-07-01 (sblocco: FortunePlay espone le quote soft per-partita). Fase 1 del percorso "accendere corner/cartellini/falli".
**Stato:** ⏳ in attesa di `APPROVE #SOFT-CLV-COLLECTOR-1` (Andrea). È modifica **DB + polling partner** → gate.

## Task
Raccogliere in avanti (forward) le **quote soft FortunePlay** (Corners/Fouls/Cards, tutte le linee) + settlement, per poter validare con rigore (CLV su chiusura, CI bootstrap) se il nostro modello soft ha edge reale vs il book partner — prerequisito FTC per mostrare "value" sui soft al cliente. Oggi i soft restano "stima".

## Perché ora
Prima l'edge soft era non calcolabile (FortunePlay non esponeva quote soft). Ora sì: `GET /_sb_api/api/v2/matches/{id}/markets` dà Corners: Total, **Fouls: Total**, Yellow Cards: Total, Total Red Cards con Over/Under de-viggabili. Verdetto direzionale (N=6, non bancabile): **cartellini** = candidato serio, **falli** = bias di livello da ricalibrare, **corner** = no.

## COSA CAMBIERÀ ESATTAMENTE
| Voce | Dettaglio |
|---|---|
| File modificati | `agents/sportsbook_scraper.py` (aggiunge fetch soft per-match, EXPERIMENT_MODE, isolato) · `scripts/settle_soft_markets.py` (aggiunge P/L vs chiusura = CLV) · replica parse da `lib/fortuneplay-match.ts` in `core/sportsbook/` |
| **Migration DB** | nuova tabella **isolata** `soft_odds_snapshots(match_key, source, market, line, over, under, captured_at, phase)` — write-only, nessun consumer di serving (come `odds_snapshots`) |
| Env | nessuno nuovo (riusa header/endpoint esistenti) |
| Cliente / card | **ZERO impatto**: i soft restano "stima calibrata" (stato `992e14d`); nessun claim edge finché non passa la validazione |
| Cosa NON tocca | modello prediction, serving card, pagamenti, adapter Stake/Roobet |

**Comportamento:** per ogni fixture in `soft_predictions` con id FP noto, snapshot ripetuti (T−24h, T−2h, T−0 chiusura) delle linee soft → tabella isolata. Anti-hammering: cache TTL + cap pagine + poche fixture/ciclo. Settlement calcola CLV.

## Reversibilità / blast radius
Reversibile: drop tabella + revert codice. Isolato (EXPERIMENT_MODE, tabella non letta dal serving) → **nessun rischio cliente**. Blast radius = solo raccolta dati interna.

## Piano di verifica
- Snapshot popolati per ≥N fixture/giorno; parse corretto per linea.
- Dopo ~4-6 settimane: settlement + CLV per-mercato con **CI bootstrap** (per-lega, per-arbitro dove disponibile).
- **Criterio GO** per accendere un mercato: CLV positivo con CI 95% che esclude lo zero, su campione con potere statistico. Atteso: cartellini forse, falli solo post-ricalibrazione, corner no.

## Gate successivo (separato)
Mostrare "edge/value" soft sul cliente = **nuovo APPROVE Andrea + OK legale-compliance (FTC)** dopo la validazione. Questa PROPOSAL copre SOLO la raccolta dati (nessun claim cliente).

## Serve OK da
Andrea (`APPROVE #SOFT-CLV-COLLECTOR-1`) — è nuova tabella DB + polling partner.
