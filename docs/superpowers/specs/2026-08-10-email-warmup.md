# Warmup email — misurato, e perché non si fa ora (#EMAIL-WARMUP-0810)

**Data:** 2026-08-10 · **Richiesta:** Andrea, *«il warm up penso sia la cosa più importante»*

## Lo stato misurato, non assunto

| Cosa | Valore | Fonte |
|---|---|---|
| Contatti con **consenso marketing** | **7** | `SELECT count(*) FILTER (WHERE marketing_opt_in) FROM profiles` |
| Profili totali · attivati · paganti | 18 · 13 · 8 | stessa query |
| SPF | ✅ `send.betredge.com` → `include:amazonses.com` | `dig TXT send.betredge.com` |
| MX di feedback (bounce/complaint) | ✅ `feedback-smtp.us-east-1.amazonses.com` | `dig MX send.betredge.com` |
| DKIM | ✅ `resend._domainkey.betredge.com`, firma `d=betredge.com` | `dig TXT` |
| DMARC | ✅ `p=quarantine; rua=mailto:info@betredge.com` | `dig TXT _dmarc.betredge.com` |
| One-click unsubscribe | ✅ RFC 8058 (`List-Unsubscribe-Post`) + rotta + test | `app/api/cron/crm/route.ts:39` |

**Nota su una mia correzione:** lo SPF del dominio radice (`betredge.com`) include solo Google Workspace e **va bene così**. L'envelope di Resend è `send.betredge.com`, quindi SPF passa su quel sottodominio e l'allineamento DMARC arriva comunque dal DKIM che firma `d=betredge.com`. Avevo segnalato un problema che non c'è.

## Perché il warmup non è eseguibile oggi

Scaldare un dominio significa **alzare gradualmente il volume** verso destinatari coinvolti — l'ordine di grandezza è decine il primo giorno, centinaia dopo una settimana, migliaia dopo un mese — così che Gmail, Outlook e Yahoo costruiscano una reputazione positiva per il dominio mittente prima che arrivi il traffico vero.

Con **sette** destinatari:

- non esiste un volume da alzare: la rampa non ha gradini;
- i provider non generano segnale di reputazione su campioni di quella taglia — 7 invii sono indistinguibili dal rumore;
- mandare ripetutamente alle stesse 7 persone per «scaldare» non produce reputazione: produce disiscrizioni.

E la cosa che il warmup protegge — l'autenticazione — **è già a posto** (tabella sopra). Non c'è niente da riparare e niente da scaldare.

**Conclusione: il vincolo non è la deliverability, è la lista.** Il warmup è la risposta giusta a un problema che non abbiamo ancora.

## Cosa fare invece, in ordine

1. **Far crescere la lista.** Gli altri item del deck (Telegram free, X, TikTok/YT, Discord) **sono** il prerequisito del warmup, non il contorno. È il motivo per cui l'ordine di priorità va invertito rispetto a come era stato posto.
2. **Sbloccare la sequenza lifecycle**, che è ferma sull'OK di Steve su ordine e testi — quello è il vero blocco email di oggi, non la reputazione. Vedi [[project_crm_lifecycle]].
3. **Tenere l'igiene pronta** (§sotto): a costo quasi zero, così quando il volume arriva il warmup è una settimana e non un mese di recupero.

## Le soglie di innesco: quando il warmup diventa la cosa giusta

Da eseguire **quando** si verifica la prima di queste, non su calendario:

| Innesco | Azione |
|---|---|
| **≥ 500** contatti con consenso e almeno un'apertura negli ultimi 90 giorni | Parte la rampa (§tabella sotto) |
| Un invio singolo supererebbe **5.000** destinatari | Rampa **obbligatoria** prima di quell'invio — Gmail e Yahoo trattano ≥5.000/giorno come *bulk sender*, con requisiti più stretti |
| Bounce rate > **2%** o complaint rate > **0,1%** su qualsiasi invio | **Stop**, non rampa: prima si pulisce la lista |

Quelle due ultime soglie non sono opinioni: sono i limiti che i provider stessi dichiarano, e il complaint rate allo 0,1% è la soglia oltre la quale Gmail inizia a filtrare.

**La rampa, quando si innesca** — volume giornaliero verso i contatti **più coinvolti prima** (chi ha aperto di recente), stessa ora ogni giorno, e si sale solo se il giorno prima è stato pulito:

| Giorni | Invii/giorno | Condizione per salire |
|---|---|---|
| 1-3 | 50 | bounce < 2%, complaint < 0,1% |
| 4-7 | 150 | idem |
| 8-14 | 500 | idem |
| 15-21 | 1.500 | idem |
| 22+ | ×2 a settimana | idem, fino al volume reale |

Se una condizione non regge, **si resta al gradino** invece di salire. Non si recupera il ritardo raddoppiando.

## Igiene da tenere pronta (costo quasi zero, va fatto ora)

- **Rimuovere gli hard bounce dopo il primo**, non dopo il terzo: l'MX di feedback SES è già configurato, quindi il segnale arriva.
- **Sunset policy**: chi non apre da 180 giorni esce dagli invii marketing. Su 7 contatti è teorico, ma la regola va scritta prima di avere 5.000 contatti, non dopo.
- **Mai comprare o importare liste**: con DMARC a `p=quarantine` e un dominio giovane, un solo invio a indirizzi non consensuali brucia mesi di reputazione. È irreversibile in pratica.
- **Il reply-to è un Gmail** (`ACCOUNT_CONTACT_EMAIL` default `agenticmarketscb@gmail.com`). Funziona, ma un `@betredge.com` è un segnale di legittimità migliore e costa una casella. Da fare prima del primo invio di volume, non urgente adesso.

## Cosa NON è verificato

Non ho eseguito un invio reale per leggere gli header (`dmarc=pass`, `spf=pass`, `dkim=pass`) perché la `RESEND_API_KEY` vive solo nelle env di produzione. **Il DNS dice che dovrebbe passare; nessuno l'ha visto passare.** È un check da 5 minuti che vale la pena fare prima del primo invio di volume — e va fatto verso una casella Gmail *e* una Outlook, perché filtrano in modo diverso.
