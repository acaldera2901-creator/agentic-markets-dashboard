# reddit_ctl — l'account di BetRedge su Reddit

Strumento operativo dell'agente `reddit-betredge`. Un solo account (`u/Betredge`), nessun
secondo tentativo: tutto qui dentro esiste per non perderlo.

## Comandi

```bash
python3 scripts/reddit/reddit_ctl.py health      # i nostri commenti sono ancora vivi? giorni di silenzio?
python3 scripts/reddit/reddit_ctl.py scan        # thread candidati nei sub target, ordinati
python3 scripts/reddit/reddit_ctl.py check FILE --sub algobetting
python3 scripts/reddit/reddit_ctl.py send --file FILE --thing t3_<id> --sub algobetting
python3 scripts/reddit/reddit_ctl.py verify      # entro un'ora da ogni invio
python3 scripts/reddit/reddit_ctl.py selftest    # dopo ogni modifica al validatore
python3 scripts/reddit/reddit_ctl.py daily       # il giro completo, non presidiato
```

`scan`, `health`, `verify` e `daily` sono in sola lettura e non hanno bisogno di credenziali.

## Il giro automatico

`com.agentic-markets.reddit-daily` gira **ogni giorno alle 08:00** (`~/Library/LaunchAgents/`)
ed esegue `daily`: health, verify, scan. Scrive `data/reddit/digest/YYYY-MM-DD.md` e log in
`logs/reddit-daily.log`.

**Suona solo quando c'è un problema vero**, cioè le due cose che hanno già ucciso il canale
una volta: l'account non più visibile o la cadenza rotta, e una rimozione nuova. Un allarme
che suona ogni giorno smette di essere un allarme.

L'allarme è una notifica di macOS. Per averlo anche su Telegram, aggiungi
`TELEGRAM_BOT_TOKEN` e `REDDIT_DIGEST_CHAT_ID` in `EnvironmentVariables` del plist —
**non** riusare `TELEGRAM_CHAT_ID`, che è il canale pubblico.

Spegnerlo: `launchctl bootout gui/$(id -u)/com.agentic-markets.reddit-daily`.

## Armare l'invio (una volta sola, lo fa Andrea)

1. `reddit.com/prefs/apps` → **create app** → tipo **script** → redirect `http://localhost:8080`.
2. In `.env` (già gitignorato):

```
REDDIT_CLIENT_ID=...          # la stringa sotto il nome dell'app
REDDIT_CLIENT_SECRET=...
REDDIT_USERNAME=Betredge
REDDIT_PASSWORD=...
REDDIT_SEND_ENABLED=1         # l'interruttore: senza questo lo strumento è read-only
REDDIT_MAX_PER_DAY=3          # opzionale, default 3
```

L'account non deve avere la 2FA attiva, altrimenti il password grant non funziona.

## Cosa protegge l'account

**Il validatore** gira dentro `send` e non è aggirabile. Blocca: em-dash, la struttura
«non è X, è Y», link, la nomina del brand, «CLV verified», prezzi e inviti all'acquisto,
più di 4 frasi, zero numeri, un sub fuori perimetro. `--force` scavalca **solo** i limiti
di cadenza, mai il validatore.

**I limiti di cadenza:** massimo 3 invii al giorno, almeno 45 minuti fra due, e **stop
totale per 7 giorni dopo una rimozione**.

**Il feed di controllo:** un feed vuoto non prova niente da solo, perché Reddit risponde
429 a raffica. `health` e `verify` leggono anche `r/algobetting/new/.rss`: se è vuoto pure
quello, sei rate-limited e non concludono nulla.

**Il registro** (`data/reddit/sent_log.json`, versionato) tiene cosa abbiamo mandato, dove,
quanti caratteri e frasi, e se è ancora vivo.

## Prima di toccare il validatore

`selftest`. Il conteggio delle frasi decide se una bozza parte, e se sbaglia sbaglia in
silenzio: il primo bug era che `z=3.51. Point` veniva contato come una frase sola.

Strategia: `docs/superpowers/specs/2026-08-31-reddit-strategia-account-artefatto.md`
