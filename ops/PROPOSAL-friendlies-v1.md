# PROPOSAL #FRIENDLY-1 — Amichevoli nazionali sul board (dry-run pre-Mondiale)

**Task**: pubblicare predizioni paper sulle amichevoli internazionali in corso (finestra 10 giorni: 34 partite, tra cui Greece–Italy, Denmark–Ukraine, France–N. Ireland, Peru–Spain), riusando il modello nazionali del WC. Dry-run reale del sistema WC prima dell'11/6.

**Approccio scelto**: nuovo codice competizione `FRIENDLY` (ESPN `fifa.friendly`, gratis, zero quota API-Football), instradato sullo stesso path nazionale del WC. Righe **SEMPRE paper** in v1 (mai signal), gate fail-closed sulla qualità del profilo nazionale (≥ 0.75, stessa soglia del gate WC `national_team_model`).

## COSA È CAMBIATO ESATTAMENTE (già implementato in locale, NON ancora attivo)

| File | Modifica |
|---|---|
| `core/world_cup_registry.py` | +`FRIENDLIES_CODE="FRIENDLY"`, +`is_friendlies_code()`, +`is_national_team_code()` |
| `core/espn_soccer_client.py` | +slug `"FRIENDLY": "fifa.friendly"`; +`get_match_result()`/`parse_summary_result()` (settlement via ESPN summary) |
| `config/settings.py` | +`FRIENDLY_MODEL_VERSION="football-friendlies-v1"`, `FRIENDLY_SOURCE_TABLE="friendly_model"`, `FRIENDLY_MIN_NATIONAL_QUALITY=0.75` |
| `agents/data_collector.py` | loop su `{**LEAGUE_IDS, FRIENDLY: 0}` (FRIENDLY **non** entra in LEAGUE_IDS → DataHub e bootstrap non lo vedono, zero quota); odds skip per FRIENDLY (nessuna fonte copre amichevoli; evita fuzzy-match falsi "Chile"≈"Chelsea"); niente club features per nazionali; guard `league_id` truthy sul fallback API-Football |
| `agents/model.py` | routing `is_national_team_code` → path nazionale; writer: amichevoli pubblicate solo se quality ≥ 0.75, `signal_allowed=False` forzato, `league_name="International Friendly"`, `neutral_venue=False`; heartbeat WC non sovrascritto dalle amichevoli; snapshot calibrazione con model_version dedicata |
| `core/supabase_client.py` | `wc_prediction_to_unified_row(friendly=True)` → competition "International Friendly", namespace dedup `friendly_model`, `world_cup_stage=None` |
| `agents/result_settlement.py` | righe `espn:<id>` → result via ESPN summary (unica fonte per amichevoli); guard anti-spreco quota fdorg per FRIENDLY |
| `core/world_cup_history.py` | fix alias: `"china"→"China PR"` (alias pre-esistente era invertito rispetto al CSV), `"kyrgyz republic"→"Kyrgyzstan"` |
| `tests/test_friendlies_pipeline.py` | NUOVO: 9 test (routing, retag mapper, gate persist, parsing settlement ESPN) |

**Prima → dopo**: oggi 0 predizioni football non-WC a giugno → dopo restart ~34 righe paper "International Friendly" in `unified_predictions`, servite dal fallback board esistente (PROPOSAL #016) senza alcuna modifica TS/frontend. Tabelle: solo `unified_predictions` (+`prediction_log` snapshot), namespace separato `friendly_model` — il track record WC non si mescola mai.

## Verifica già fatta (build ≠ verificato ≠ operativo — siamo a "verificato in locale")
- Suite completa: **802 test passed** (0 regressioni) + 9 test nuovi
- Smoke E2E read-only: ESPN → canonical names → profilo → probabilità: **34/34 pubblicabili** (es. Greece–Italy 0.24/0.27/0.48; Peru–Spain 0.09/0.19/0.72)
- Settlement ESPN live su 3 amichevoli già concluse: 3/3 risultati corretti (es. Singapore–China 1-2 FT)
- Garanzie: mai `signal`, mai odds/edge fabbricati, fail-closed su profili mancanti, zero quota API-Football/fdorg consumata da FRIENDLY

## Step di attivazione (richiede APPROVE)
```bash
launchctl kickstart -k gui/$(id -u)/com.agentic-markets.agents
```
(restart dell'agent già in esecuzione, PID 52516 — unico step che rende operativo il codice)

**Reversibilità**: rollback = `git checkout` dei 8 file + stesso kickstart (≈1 min). Le righe già scritte si ripuliscono con `DELETE FROM unified_predictions WHERE source_table='friendly_model'` (namespace dedicato, chirurgico).

**Blast radius**: backend Python only; board invariato (le amichevoli appaiono solo via fallback off-season già approvato #016, etichettate paper/estimate). WC path intatto (gate monitor_only inalterato, 802 test verdi). Limite noto: quando riparte il campionato (agosto) il fallback non serve più le amichevoli — accettato per v1.

**Piano di verifica post-attivazione**: log `published N fixtures for FRIENDLY` + `FRIENDLY row written:` entro 15 min; query righe `friendly_model` su Supabase; visual check board da loggato; dopo i match di stasera: verifica settlement (`unified settled: ... International Friendly`).

**Owner esecuzione**: Andrea (o Claude su APPROVE)
**Serve OK da**: Andrea o Michele su `ch_deploy_gate` → `APPROVE #FRIENDLY-1`
