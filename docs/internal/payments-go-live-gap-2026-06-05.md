# Agentic Markets — Pagamenti: Gap Analysis per il Go-Live Completo

**Documento aziendale** · Agentic Markets (Maven) · Redatto: 5 giugno 2026
**Stato:** bozza per decisione Andrea + Michele · **Fonte:** audit del codice in produzione (`main @ 0eecfc9`)

---

## 1. Executive Summary

Il prodotto (Signal Desk Pro, 49.50 USDT/mese) ha oggi un **flusso di pagamento manuale end-to-end funzionante ma non scalabile**: il cliente invia USDT a un wallet fisso e un amministratore attiva il piano a mano. Per andare *completamente* live mancano **7 componenti**, di cui 3 bloccanti (verifica pagamento, ciclo di abbonamento, inquadramento fiscale) e 4 importanti ma non bloccanti.

**Effort stimato per il minimo vendibile in autonomia (Fase 1): 3–5 giorni di sviluppo + decisioni legali/fiscali.**

---

## 2. Cosa esiste oggi (verificato nel codice)

| Componente | Stato | Dettaglio |
|---|---|---|
| Piano commerciale | ✅ Live | Signal Desk Pro — 49.50 USDT/mese, piano unico (`lib/commercial-plan.ts`) |
| Checkout UI | ✅ Live | Flusso a 3 step: profilo → scelta piano → invio USDT. Wallet mostrato solo dentro il checkout |
| Wallet incasso | ✅ Live | USDT **TRC20**, indirizzo statico hardcoded nel frontend |
| Stato `pending_payment` | ✅ Live | Il profilo resta in attesa finché un admin non attiva |
| Attivazione manuale | ✅ Live | Pannello admin + endpoint `POST /api/admin/activations` (protetto, anti-CSRF) |
| Gating contenuti per piano | ✅ Live | Projection per stato: anonimo/free → blur; pagante → reveal completo |
| Footer responsible gambling | ✅ Live | Disclaimer informativo presente |

**Il flusso oggi:** Cliente si registra → sceglie il piano → vede il wallet TRC20 → invia 49.50 USDT → *qualcuno controlla il wallet a mano* → admin clicca "attiva" → cliente sbloccato.

---

## 3. Cosa manca — Gap bloccanti (senza questi non si scala)

### GAP 1 — Verifica pagamento automatica ⛔
**Oggi:** nessun controllo on-chain. L'attivazione dipende da un umano che guarda il wallet e incrocia a mano importo/orario con l'utente in `pending_payment`.
**Rischi:** latenza di attivazione (cliente paga e aspetta ore), errori di attribuzione, non scala oltre pochi clienti/giorno, nessuna prova automatica di pagamento.
**Soluzioni possibili (decisione richiesta):**
- **(a) Payment processor crypto** — NOWPayments / BTCPay / Coinbase Commerce: webhook automatico, importi univoci per ordine, gestione sottopagamenti. Fee ~0.5–1%. *Velocità di integrazione: 1–2 giorni.* ✅ Consigliata per la Fase 1
- **(b) Verifica on-chain fai-da-te** — polling TronGrid API sul wallet + matching importo univoco per utente (es. 49.51, 49.52…). Zero fee ma tutta la logica edge-case (sottopagamenti, doppi invii, reorg) è nostra. *3–4 giorni.*

### GAP 2 — Ciclo di vita dell'abbonamento ⛔
**Oggi:** il campo `plan` non ha scadenza. **Un piano attivato resta attivo per sempre** — di fatto oggi vendiamo un lifetime a 49.50.
**Serve:**
- Campo `plan_expires_at` su `profiles` + migrazione
- Downgrade automatico a scadenza (cron giornaliero: `expires_at < NOW()` → `plan = 'unpaid'`)
- Reminder di rinnovo (email a −5 e −1 giorni)
- UI stato abbonamento (giorni rimanenti, CTA rinnovo)
**Effort:** 1–2 giorni.

### GAP 3 — Inquadramento fiscale e legale ⛔ *(decisione umana, non codice)*
**Oggi:** incasso crypto su wallet personale, nessuna fattura/ricevuta, nessuna entità formalizzata sul flusso.
**Da decidere con il commercialista / legale (anche in ottica deal Maven 50/50):**
- **Chi incassa?** Entità giuridica titolare del wallet e del revenue (rilevante per il cap table Maven)
- **Fatturazione/ricevute** per i clienti (obbligo dipende dalla giurisdizione dell'entità)
- **IVA/imposte** su servizi digitali B2C (UE: MOSS/OSS se entità UE)
- **AML/KYC**: soglie e obblighi sull'incasso crypto ricorrente
- **T&C + Refund policy** pubblicati (oggi assenti) — obbligatori per vendere
- Nota: il prodotto è **informativo** (probabilità calibrate, non gambling né gestione fondi) — categoria comunque "alta attenzione" per i processor fiat

---

## 4. Cosa manca — Gap importanti (non bloccanti per il primo cliente)

### GAP 4 — Email transazionali 🟡
Nessuna email automatica: conferma registrazione, pagamento ricevuto, piano attivato, scadenza in arrivo. Resend è già usato in altri progetti del gruppo — integrazione rapida. *Effort: 0.5–1 giorno.*

### GAP 5 — Pagamento in fiat (carta) 🟡
Solo USDT TRC20 oggi = barriera per il cliente medio non-crypto. Opzioni: Stripe (richiede entità + categoria merceologica da validare), Paddle/LemonSqueezy come merchant of record (gestiscono loro IVA — semplifica GAP 3 per il fiat). *Decisione post-Fase 1; il WC può partire crypto-only.*

### GAP 6 — Hardening del wallet 🟡
- Indirizzo TRC20 hardcoded nel sorgente del frontend → spostare in variabile d'ambiente (rotazione senza deploy di codice)
- Definire **custodia**: chi detiene la chiave del wallet di incasso, sweep periodico verso cold wallet/exchange, 2FA sull'exchange di destinazione
- Log delle attivazioni admin (audit trail di chi ha attivato chi e quando)

### GAP 7 — Operatività e supporto 🟡
Finché l'attivazione resta (anche solo in fallback) manuale:
- **SLA dichiarato** al cliente ("attivazione entro X ore") nella UI di checkout
- Canale di supporto visibile (email dedicata) per "ho pagato ma non vedo nulla"
- Processo: chi controlla il wallet, con che frequenza, chi ha accesso admin

---

## 5. Roadmap proposta

| Fase | Contenuto | Effort | Esito |
|---|---|---|---|
| **Fase 1 — "Vendibile in autonomia"** | GAP 1a (processor crypto + webhook) + GAP 2 (scadenza/rinnovo) + GAP 4 (email) + GAP 6 (env wallet) | **3–5 giorni dev** | Cliente paga → attivazione automatica in minuti → scade dopo 30 giorni |
| **Fase 2 — "In regola"** | GAP 3 completo (entità, fatture, T&C/refund, IVA) | Decisioni + supporto legale | Si può promuovere pubblicamente senza rischi |
| **Fase 3 — "Mass market"** | GAP 5 (carta via merchant of record) + GAP 7 a regime | 2–3 giorni dev | Conversione clienti non-crypto |

**Raccomandazione:** Fase 1 subito dopo il go-live Mondiale (la finestra WC porterà i primi utenti sul board gratuito; il funnel pagante deve essere pronto a riceverli). GAP 3 da avviare **in parallelo già ora** perché ha tempi esterni (commercialista, eventuale entità) e tocca il deal Maven.

---

## 6. Decisioni richieste

| # | Decisione | Owner | Urgenza |
|---|---|---|---|
| 1 | Processor crypto (NOWPayments/BTCPay) vs verifica fai-da-te | Andrea + Michele | Alta |
| 2 | Entità che incassa + titolarità wallet (impatta deal Maven) | Andrea + Michele (+ legale) | Alta |
| 3 | Durata piano: 30 giorni rolling confermata? Prezzo annuale? | Andrea | Media |
| 4 | T&C + Refund policy: redazione (template legale-contratti) | Andrea | Alta |
| 5 | Fiat in Fase 3: Paddle/LemonSqueezy vs Stripe diretto | Posticipabile | Bassa |

---

*Documento generato dall'audit tecnico del 2026-06-05 · Sistema Andrea — Claude aziendale*

---

## 7. Budget — Spese attuali e da aggiungere (rev. 2)

### 7.1 Run-rate attuale: $0/mese — ma il free tier È il collo di bottiglia
| Voce | Piano | Costo | Limite bloccante |
|---|---|---|---|
| The Odds API | Free | $0 | **500 cr/mese esauriti: 0 quote = 0 segnali** |
| API-Football (RapidAPI) | Free | $0 | **100 req/g — 403 in corso, fixtures WC a singhiozzo** |
| football-data.org / OpenWeatherMap / ESPN | Free | $0 | Sufficienti |
| Vercel | Hobby | $0 | Ok per ora |
| Supabase | Org Maven (Pro) | $0 per noi | A carico org Maven/Tommy — da formalizzare nel deal |

### 7.2 Da aggiungere ORA — Scenario C approvato
| Voce | Piano | Costo/mese | Sblocca |
|---|---|---|---|
| **The Odds API** | 100K | **$59** | Quote tennis+WC, polling fitto, snapshot, tornei 250/500 |
| **API-Football diretto** | Pro | **$19** | Fixtures senza 403 + **lineups/infortuni (P4)** = 40% residuo del gap |
| **TOTALE** | | **$78/mese** | Post-WC, con quota guard già live: downgrade a **$49** |

### 7.3 Spese collegate al go-live pagamenti
| Voce | Quando | Costo |
|---|---|---|
| **Dominio brand** (oggi su vercel.app!) | Subito | ~$12-15/anno |
| Processor crypto (GAP 1) | Fase 1 | ~0.5-1% sul transato |
| Resend email (GAP 4) | Fase 1 | $0 → $20 |
| Entità legale + commercialista (GAP 3) | Fase 2 | variabile, preventivo da chiedere |
| Merchant of record fiat (GAP 5) | Fase 3 | ~5% sul transato carta |
| Matchbook | Opzionale | $0 (serve KYC) |

### 7.4 Sintesi
**Run-rate Fase 1 (Mondiale): $78/mese** → **break-even: 2 abbonamenti** (99 USDT > $78). Da luglio: $49 → break-even 1 abbonamento.

### Decisioni aggiunte
1. **Acquisto API Scenario C — IMMEDIATA, bloccante Mondiale** (Andrea, carte)
2. **Dominio brand** — Alta (Andrea + Michele)
3. Matchbook KYC: chi lo intesta? — Media
