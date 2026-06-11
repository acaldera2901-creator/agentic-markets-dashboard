# Gate tuning — tennis segmenti deboli + volume commerciale football (2026-06-11)

**Richiesta Michele:** (1) rafforzare il segmento debole del tennis (live 58,1%, 25W/18L);
(2) rendere il football commerciabile — "non troppe poche bets".
**Script:** `lab_tennis_segment_floors.py`, `lab_tennis_hybrid_policy.py`, `lab_football_commercial_tiers.py`.
Walk-forward leak-free, ricette identiche al servito (EloSurface tennis; blend club 0.3elo+0.7mkt;
v2-elo internazionali). Held-out: tennis 2023+ (19.790), club 2022+ (22.142), internazionali 2022+.

## 1) TENNIS — il floor giusto non è uniforme

Diagnosi (held-out, floor live 62): hi-grass 76,7% · hi-nongrass 73,1% · **lo-grass 69,4%** ·
lo-nongrass 70,3%. Il 58,1% live = cella lo-grass (Libéma/250/WTA minori, esattamente lo slate
di giugno) + sfortuna small-sample (n=43; a p=0.70 un ≤25/43 capita ~5% delle volte).

**Policy ibride (held-out 2023+):**
| policy | hit | volume | cella lo-grass |
|---|---|---|---|
| LIVE uniforme 62 | 72,1% | 52,1% | 69,4% (n=281) |
| **hi 62 / lo-nongrass 64 / lo-grass 66** | **72,9%** | 48,7% | **73,8%** (n=172) |
| hi 62 / lo-ng 65 / lo-grass 68 | 73,1% | 47,2% | 71,8% |
| sopprimere lo-grass | 72,2% | 50,7% | — |

→ **RACCOMANDATA: hi 62 / lo-nongrass 64 / lo-grass 66.** Probability-neutral (solo surfacing),
−6,5% volume tennis, +4,4pt proprio nella cella dove pubblichiamo ORA. Coerente col feedback
"qualità>volume". Mappatura prod: hi = {G, M, F, PM, P, O, 1000} (Slam/Masters/Premier/Finals),
lo = tutto il resto (A=250/500, I, D). Complementare al market-blend shadow (che copre gli hi).

## 2) FOOTBALL — il problema volume NON è il floor, è il calendario/copertura

**Club (held-out 4 stagioni):** floor 56 tiene il 28,1% = **~1.558 pick/stagione (~30+/settimana
in stagione)** a hit 69,6%. In stagione il volume club è già commerciale. Il board è magro ORA
perché è giugno: zero club, resta il WC.

**La banda "lean" 0.50-0.56 è una trappola:** hit 54,7% sui club (54,4% anche ristretta a
top-flight big-5 non-derby), **41,4% sul WC**. Un secondo tier di pick "soft" diluirebbe metrica
e brand. NON pubblicarla come pick (sotto floor resta "no clear favourite" + prob, com'è oggi).

**WC-like (neutral finals, n=364 held-out):** floor 56 → hit 64,2% tenendo 47,5%. Abbassare a
0.52 = +20% pick ma 62,0%. Alzare a 0.60 = 66,7% ma −19% pick. **Floor 56 è giusto sul WC.**
⚠️ Comms: l'atteso WC è ~64-67%, NON il 93,8% live (small-sample) — gestire le aspettative.

**La leva volume vera (a hit superiore, non inferiore): i QUALIFIERS.**
| segmento | floor 56: hit | pick/stagione |
|---|---|---|
| qualifiers | **75,2%** | **218** |
| friendlies (floor 61 live) | ~74% | ~100 |
| club | 69,6% | 1.558 |
| WC-like | 64,2% | 35 (73 match/anno) |

→ **RACCOMANDAZIONE football:** floor invariati; aggiungere copertura **qualificazioni**
(WC/Euro qualifiers = il segmento più accurato che abbiamo, 337 match/stagione) e a settembre
le leghe club. Volume commerciale = più partite coperte sopra-floor, non floor più basso.
Da fine WC (luglio) i qualifiers/club riempiono il buco del calendario.

## Sintesi operativa (entrambe probability-neutral tranne la copertura)
1. Tennis: floors segment-aware 62/64/66 (patch surfacing-gate, ~stessa meccanica di
   SURFACE_FLOOR_FRIENDLY; serve il tier del torneo nel path tennis).
2. Football: floor fermi; niente tier "lean"; proposta prodotto = coprire qualifiers.
3. Comms: aspettativa WC ~64-67% (non cavalcare il 94% small-sample).

Pending: review Michele → PROPOSAL council (formato Context/Findings/Proposal/Risks/Recommendation)
→ APPROVE Andrea deploy-gate. Nessun codice prod toccato.
