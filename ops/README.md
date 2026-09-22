# `ops/` — copie dei plist launchd, e come si verifica che descrivano la realtà

I file `.plist` in questa cartella sono **copie di riferimento**. Quelli che macOS esegue
davvero stanno in `~/Library/LaunchAgents/` sulla macchina che ospita la flotta: launchd
legge quelli, non questi. Le due cose possono divergere senza che nulla si rompa — e il
22/09/2026 abbiamo scoperto che erano divergenti da tempo.

## Il caso che ha reso necessario questo file (#FLOTTA-FERMA-0912)

Per quattro volte (12/09, 14/09, 21/09, 22/09) la flotta è stata riavviata e ha continuato
a eseguire il codice dell'11/09: 17 agenti su 17 con lo stesso `code_sha`, un solo `boot_at`
nuovo a ogni giro. Il riavvio funzionava — `launchctl kickstart -k` riesegue la cartella
così com'è, non la aggiorna — e la cartella non la aggiornava nessuno.

Cercando *dove* si trovasse quella cartella, il plist in questo repo diceva
`/Users/calde/Desktop/agentic-markets`. Il plist **caricato** diceva
`/Users/calde/Desktop/agentic-markets-worker`. Chi avesse seguito il repo per riallineare
la flotta avrebbe aggiornato una cartella che non esegue niente, riavviato, e visto un
riavvio riuscito: un «deploy fatto» senza nessun codice nuovo in esecuzione.

`ops/com.agentic-markets.agents.plist` è stato corretto in quel commit sulla base di una
verifica in loco (Calde, 22/09/2026 11:55Z, plist caricato + `git rev-parse` nella cartella).

## ⚠️ Gli altri file di questa cartella NON sono stati verificati

Tutti gli altri plist qui dentro puntano ancora a `/Users/calde/Desktop/agentic-markets`.
Può darsi che sia giusto — il servizio degli agenti è l'unico che sappiamo essere stato
spostato — ma **nessuno lo ha misurato**, e correggerli a intuito significherebbe
sostituire un'affermazione non verificata con un'altra. Restano come sono, e questa riga
dice che sono da verificare:

| file | cartella dichiarata | verificato in loco |
|---|---|---|
| `com.agentic-markets.agents.plist` | `agentic-markets-worker` | ✅ 22/09/2026 |
| `com.agentic-markets.watchdog.plist` | `agentic-markets` | ❌ |
| `com.agentic-markets.live-monitor.plist` | `agentic-markets` | ❌ |
| `launchd/com.betredge.control-center.*.plist` | `agentic-markets` | ❌ |
| `plist-staging/*.plist` | varie | ❌ (staging, non caricati) |

## Come si verifica, prima di fidarsi di un file di questa cartella

Sulla macchina che ospita il servizio:

```bash
# la cartella che il job USA davvero (plist caricato, non questo repo)
plutil -extract WorkingDirectory raw -o - ~/Library/LaunchAgents/<label>.plist

# in alternativa, dal servizio vivo
launchctl print "gui/$(id -u)/<label>" | grep -i 'working directory'

# e il codice che sta eseguendo
git -C "<cartella appena stampata>" rev-parse --short HEAD
```

Se il risultato non coincide con il file qui dentro, **fa fede la macchina**: si corregge
il file, non la macchina.

## Regola

Un plist di questa cartella si modifica solo dopo aver letto quello caricato. Un plist che
descrive una cartella sbagliata non dà errore da nessuna parte: produce un'operazione che
riesce e non fa niente, che è il modo più costoso di sbagliare.
