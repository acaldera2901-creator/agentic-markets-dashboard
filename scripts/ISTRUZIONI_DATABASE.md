# Come popolare il Database Google Sheets

## Metodo A — Google Apps Script (consigliato, no credentials)

**Tempo: ~5 minuti setup + ~3 minuti esecuzione**

1. Apri il foglio master:  
   👉 https://docs.google.com/spreadsheets/d/1aFbrx-w2uI4tRvHjEfWskNcfMuWY5GgwCYNMYE3Q8Mo

2. Menu → **Extensions → Apps Script**

3. Cancella il codice di default, colla tutto il contenuto di:  
   `scripts/gas_populate_database.js`

4. Salva (Ctrl+S), seleziona funzione **`populateDatabase`**, clicca **Run**

5. La prima volta ti chiede di autorizzare → **Review permissions → Allow**

6. Attendi ~3 minuti (il script va in rate limiting con l'API football-data.org)

7. Al termine apparirà: ✅ "Database Agentic Markets aggiornato con successo!"

**Cosa fa il GAS:**
- Scarica tutti i match 2023-2024 da football-data.org API
- Importa Team Stats e League Stats dagli sheet già caricati su Drive
- Crea/aggiorna tutti i 10 tab con formattazione professionale
- Aggiunge dati benchmark Model Performance e Context Module v5.0

---

## Metodo B — Script Python (aggiornamenti live dal DB)

Per aggiornamenti automatici (Predictions_Log, Bets_Log, PnL da PostgreSQL):

```bash
# Setup una volta
mkdir credentials
# Scarica OAuth client JSON da: https://console.cloud.google.com
# APIs & Services → Credentials → OAuth 2.0 Client ID (Desktop)
# Salva come: credentials/oauth_client.json

pip install gspread google-auth-oauthlib

# Esegui
FOOTBALL_DATA_ORG_API_KEY=<YOUR_FOOTBALL_DATA_ORG_API_KEY> \
python scripts/populate_gsheets.py
```

---

## Sheet già caricati su Drive

| File | Drive ID |
|------|----------|
| Team Stats | `11qbPqKBGio_uquAt-MoGvgvlbRlk8-CnJfBlYhBdJFo` |
| League Stats | `15mX1rMAFXTox0tYT0YnhX6so8sf4cDxLVSrfS61tv40` |
| Master Spreadsheet | `1aFbrx-w2uI4tRvHjEfWskNcfMuWY5GgwCYNMYE3Q8Mo` |

---

## Struttura Tab nel Master Sheet

| Tab | Contenuto | Fonte |
|-----|-----------|-------|
| README | Guida e legenda | GAS |
| Match_Results | 3.800+ match 2023-2024 | football-data.org API |
| Team_Stats | 260+ squadre con stats | Drive sheet |
| League_Stats | 12 righe metriche lega | Drive sheet |
| Odds_Calibration | Calibrazione quote | Da DB (placeholder) |
| Predictions_Log | Log previsioni modello | Da DB live |
| Bets_Log | Storico scommesse | Da DB live |
| PnL_Monthly | P&L per mese | Da DB live |
| Model_Performance | Brier, hit rate, CLV | Benchmark pre-caricati |
| Context_Module | Match type / lega factors | Pre-caricati v5.0 |
