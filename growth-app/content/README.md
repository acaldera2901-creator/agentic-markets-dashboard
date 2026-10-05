# Come si aggiorna la pagina /lavoro (per Steve)

La pagina **/lavoro** non ha un database: mostra i file di questa cartella.
Per cambiarla modifichi un file, fai un commit e, al deploy successivo, la pagina
si aggiorna. Dalla pagina non si salva nulla.

| Sezione della pagina | File da modificare |
|---|---|
| Tracking gaps | `tracking-gaps.json` |
| Backlog esperimenti | `experiments.json` |
| Memo settimanale | un file nuovo in `memo/` (es. `memo/2026-W41.md`) |
| Accessi e fonti | `sources.json` |

## Il modo più semplice: da GitHub nel browser

1. Apri il file su GitHub, nel branch della dashboard, e clicca la matita (Edit).
2. Modifica il testo. Nei `.json` lascia invariate virgolette, virgole e parentesi.
3. «Commit changes» → scegli «Create a new branch» e apri una PR. Il merge lo fa Andrea o Calde.

## Le regole dei campi (se sbagli, la build si ferma e dice dove)

- **tracking-gaps.json** — `priority`: `P0` | `P1` | `P2`. `status`: `aperto` | `in corso` | `mitigato` | `chiuso`.
  `owner` e `unlocks` (i KPI che il gap sblocca) non possono essere vuoti. Gli `id` (G01, G02 …) non si ripetono.
  Un gap chiuso non si cancella: si mette `"status": "chiuso"`, così resta la storia.
- **experiments.json** — tutti i campi sono obbligatori: `hypothesis`, `kpiTarget`, `dataSource`, `duration`,
  `decisionThreshold`. `status`: `proposto` | `in corso` | `scale` | `fix` | `kill`. La soglia si scrive **prima** di partire.
  I tre esperimenti E01–E03 sono esempi con numeri reali dello snapshot del 05/10: tienili, modificali o mettili in `kill`.
- **memo/** — copia `memo/_template.md` in `memo/AAAA-Www.md` (anno e numero della settimana ISO, es. `2026-W41.md`).
  I memo compaiono dal più recente. Il template non compare come memo.
  Il memo si vede come testo semplice: la formattazione markdown non viene interpretata.
- **sources.json** — un blocco per fonte: `reads`, `role` (il ruolo minimo, mai admin né password condivise),
  `steps` (passi per concederlo), `owner` (chi lo concede), `verify` (il numero che prova che funziona), `status`:
  `da concedere` → `concesso` (l'owner ha fatto i passi) → `verificato` (il numero torna). Si parte sempre da `da concedere`.
- **tracking-gaps.json** — `tiles` (facoltativo) elenca le tile PROXY che il gap rende reali, `dependsOn` da cosa dipende.

## Controllo prima del commit (se lavori in locale)

```bash
cd growth-app && npm test      # dice quale campo di quale riga è sbagliato
```
