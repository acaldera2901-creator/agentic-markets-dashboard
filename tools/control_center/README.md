# BetRedge Control Center

Torre di controllo locale. Spec: `docs/superpowers/specs/2026-08-20-betredge-control-center-design.md`.

**Aprire:** http://127.0.0.1:8790 (il server gira sotto launchd, KeepAlive)

**Misurare a mano senza scrivere niente:**

    venv/bin/python -m tools.control_center.collector --dry-run

Nota: gli script del venv hanno lo shebang rotto da uno spostamento di cartella.
Usare sempre `venv/bin/python -m ...`, mai `venv/bin/pytest`.

**Stato su disco:** `~/.betredge-cc/state.json` e `history.jsonl`
**Log:** `~/Library/Logs/betredge-cc/`
**launchd:** i due plist stanno in `ops/launchd/`, copiati in `~/Library/LaunchAgents/`

## Come si aggiunge un check

Una funzione che ritorna un `Verdict` in `checks/<gruppo>.py`, più una riga in
`checks()`. Il collector non si tocca — se un check nuovo costringe a
modificarlo, il contratto è sbagliato ed è un segnale, non un dettaglio.

## Le regole che tengono in piedi la fiducia nella pagina

- **`unknown` non è `red`.** Fonte non disponibile, credenziale mancante,
  tabella vuota → `unknown` col motivo. Mai uno zero al posto di un dato non
  misurato.
- **Si giudica l'artefatto, non l'invocazione.** Un cron è verde se ha prodotto
  la sua scrittura, non se ha risposto 200.
- **Cron incondizionati → freschezza. Cron condizionali → arretrato.** Un cron
  che scrive solo quando c'è lavoro non si misura sulla data dell'ultima
  scrittura: il 2026-08-20 `paygate-reconcile` sembrava fermo da 22 giorni
  mentre il suo arretrato era zero — nessuno comprava, e non è un guasto.
- **Le rotte dietro feature flag non si sorvegliano.** `/risultati` e `/oggi`
  fanno `notFound()` quando `NEXT_PUBLIC_UX_NEW != "1"`.
- **Le soglie si mettono su ciò che misurano.** `db_latency` guarda la query
  (65-200 ms), non connessione+query: l'handshake verso eu-west-1 costa ~650 ms
  stabili e una soglia sulla somma segnala la distanza da Dublino.
- **Ambra non notifica mai.** Vive sulla pagina, non sul telefono.

## Cosa NON fa

Non scrive sul DB (`SET TRANSACTION READ ONLY`, verificato: una `CREATE TABLE`
viene respinta). Non ascolta fuori da loopback. Non rimedia: osserva.

**Fasi 2 e 3** (pipeline, risultati, business, canali): sezione 9 della spec.
