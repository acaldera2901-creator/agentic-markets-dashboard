"""#PICK-PERSIST-0907 — ricostruisce `unified_predictions.pick` sulle righe gia'
chiuse che l'hanno perso.

Il difetto (riparato per il futuro in `settle_unified_prediction`): il settlement
recuperava il pick dalla sorgente, lo usava per graduare won/lost, e non lo
scriveva. Lo storico pubblico e' rimasto con l'esito e senza la scelta, e ogni
superficie che filtra `pick not null` seleziona quindi sugli ESITI.

IL PROBLEMA DI QUESTO BACKFILL. `match_predictions` e `tennis_predictions` sono
scritte in UPSERT: non sono un audit trail. Un `best_selection` letto oggi puo'
essere stato riscritto DOPO il fischio d'inizio (misurato: Orgryte-Hammarby,
espn:401842817, best_selection=DRAW con computed_at successivo al kickoff mentre
la riga servita diceva AWAY). Un backfill cieco riscriverebbe la storia con un
valore post-hoc — cioe' costruirebbe un track record migliore di quello vero.

LA DIFESA e' il controllo incrociato, ed e' esatta. La riga porta gia' un esito
won/lost, e quell'esito e' stato calcolato dal pick VERO al momento della
chiusura. Quindi: si ricostruisce il pick dalla sorgente, si ri-grada contro il
risultato reale della partita, e si SCRIVE SOLO SE il grado ricostruito coincide
con quello gia' registrato. Se la sorgente e' stata riscritta con un valore
diverso, i due gradi divergono e la riga viene scartata. Non e' un'euristica: e'
un'identita' — un pick che riproduce l'esito registrato E' il pick che l'ha
prodotto (salvo il caso degenere di due selezioni che danno lo stesso esito, che
per il tennis e' impossibile e per il calcio significa che l'esito e' comunque
quello giusto).

Per questo il bacino sono SOLO le righe won/lost. Una riga `void` non porta
informazione direzionale, quindi il controllo incrociato non esiste e il pick
non e' verificabile: quelle righe restano fuori.

NON ESEGUIRE --apply. Il controllo incrociato qui sopra NON basta, e la misura
del 07/09 lo dimostra. E' circolare: l'esito registrato e la ricostruzione
derivano ENTRAMBI da `best_selection`, letto a due momenti diversi ma sempre
DOPO la partita. Difende dalla sorgente che cambia fra la chiusura e oggi, non
dalla sorgente che era gia' contaminata alla chiusura.

Che lo sia, si vede dai numeri. Le 598 righe di tennis ricostruibili hanno
confidenza mediana 52 e quota equa mediana 1,92 (probabilita' implicita 52%:
testa o croce) e vincerebbero il 78%. Per fascia di confidenza il profilo e'
capovolto rispetto al campione pubblicato:

    confidenza      ricostruite        gia' pubblicate
    0-55            84%  (n=487)       53%  (n=38)
    55-65           53%  (n=104)       59%  (n=597)
    65-75           67%  (n=3)         65%  (n=406)
    75+             75%  (n=4)         78%  (n=354)

Il campione pubblicato e' calibrato (piu' confidenza -> piu' vittorie). Le
ricostruite fanno l'opposto: la fascia in cui il modello dichiara testa o croce
vince l'84%, meglio della sua fascia migliore. Non e' bravura, e' l'esito che e'
entrato nella previsione.

E si vede da dove entra. Per mese di chiusura:

    2026-06  83,1%      2026-07  81,5%      2026-08  73,9%      2026-09  46,7%

Piu' la riga e' vecchia, piu' "vince". `best_selection` e' riscritto in upsert a
ogni giro del modello (agents/tennis_model_agent.py: e' sempre il giocatore con
probabilita' piu' alta), e l'Elo che alimenta quella probabilita' ha ormai
assorbito il risultato della partita. Ogni ri-esecuzione sposta la selezione
verso il vincitore noto. Settembre, che ha avuto meno giri sopra, sta al 46,7% —
cioe' dove deve stare un campione di teste o croci.

`computed_at` non protegge: 590 di quelle 598 righe hanno computed_at PRIMA del
fischio d'inizio e sono contaminate lo stesso.

Applicarlo aggiungerebbe ~470 vittorie fabbricate al registro pubblico e
alzerebbe il tasso dichiarato dal 64,0% al 67,7%. Lo script resta come STRUMENTO
DI MISURA (il dry-run e' quello che ha prodotto i numeri qui sopra) e come
documentazione di perche' la strada e' chiusa.

    dry-run (default, SOLA LETTURA):  python scripts/backfill_unified_pick.py
    --apply:                          NON usare. Vedi sopra.
"""
import argparse
import asyncio
import json
import os
import sys
from collections import Counter

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.tennis_names import canonical_player_key  # noqa: E402

SEL_CALCIO = {"HOME": "home", "DRAW": "draw", "AWAY": "away"}


def _base_e_headers():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY assenti.")
    return f"{url}/rest/v1", {"apikey": key, "Authorization": f"Bearer {key}"}


async def _get(client, base, headers, path, **params):
    r = await client.get(f"{base}/{path}", params=params, headers=headers)
    r.raise_for_status()
    return r.json()


async def _a_blocchi(client, base, headers, tabella, select, ids, campo="match_id", n=15):
    """PostgREST `in.()` ha un limite pratico sulla lunghezza dell'URL."""
    fuori = {}
    for i in range(0, len(ids), n):
        elenco = ",".join(f'"{x}"' for x in ids[i : i + n])
        for riga in await _get(
            client, base, headers, tabella, select=select, **{campo: f"in.({elenco})"}
        ):
            fuori[str(riga[campo])] = riga
    return fuori


async def _bersagli(client, base, headers):
    """Righe chiuse won/lost senza pick — l'unico bacino verificabile."""
    fuori, off = [], 0
    while True:
        blocco = await _get(
            client, base, headers, "unified_predictions",
            select="id,sport,source_id,pick,result,starts_at,home_team,away_team,notes",
            result="in.(won,lost)", pick="is.null",
            order="settled_at.asc", limit="1000", offset=str(off),
        )
        fuori += blocco
        if len(blocco) < 1000:
            return fuori
        off += 1000


def _pre_partita(computed_at, starts_at):
    if not computed_at or not starts_at:
        return None
    return computed_at.replace("Z", "")[:19] < starts_at.replace("Z", "")[:19]


async def piano(client, base, headers):
    """Costruisce le scritture candidate. SOLA LETTURA."""
    righe = await _bersagli(client, base, headers)
    tennis = [r for r in righe if r["sport"] == "tennis" and r.get("source_id")]
    calcio = [r for r in righe if r["sport"] == "football" and r.get("source_id")]

    src_t = await _a_blocchi(
        client, base, headers, "tennis_predictions",
        "match_id,best_selection,player1,player2,winner,computed_at",
        [str(r["source_id"]) for r in tennis],
    )
    src_c = await _a_blocchi(
        client, base, headers, "match_predictions",
        "match_id,best_selection,home_score,away_score,computed_at,kickoff",
        [str(r["source_id"]) for r in calcio],
    )

    scritture, scarti = [], Counter()

    for r in tennis:
        s = src_t.get(str(r["source_id"]))
        if not s:
            scarti["tennis: sorgente sparita"] += 1
            continue
        sel = (s.get("best_selection") or "").strip().upper()
        vincitore = (s.get("winner") or "").strip()
        if sel not in ("P1", "P2") or not vincitore:
            scarti["tennis: selezione o vincitore assenti"] += 1
            continue
        favorito = s["player1"] if sel == "P1" else s["player2"]
        atteso = (
            "won"
            if canonical_player_key(favorito) == canonical_player_key(vincitore)
            else "lost"
        )
        if atteso != r["result"]:
            scarti["tennis: CONTESA (sorgente riscritta dopo)"] += 1
            continue
        scritture.append({
            "id": r["id"], "sport": "tennis", "pick": favorito, "notes": r.get("notes"),
            "pre_partita": _pre_partita(s.get("computed_at"), r.get("starts_at")),
        })

    for r in calcio:
        s = src_c.get(str(r["source_id"]))
        if not s:
            scarti["calcio: sorgente sparita"] += 1
            continue
        sel = SEL_CALCIO.get((s.get("best_selection") or "").strip().upper())
        gc, go = s.get("home_score"), s.get("away_score")
        if not sel or gc is None or go is None:
            scarti["calcio: selezione o punteggio assenti"] += 1
            continue
        reale = "draw" if gc == go else ("home" if gc > go else "away")
        if ("won" if sel == reale else "lost") != r["result"]:
            scarti["calcio: CONTESA (sorgente riscritta dopo)"] += 1
            continue
        scritture.append({
            "id": r["id"], "sport": "football", "pick": sel, "notes": r.get("notes"),
            "pre_partita": _pre_partita(
                s.get("computed_at"), r.get("starts_at") or s.get("kickoff")
            ),
        })

    return righe, scritture, scarti


async def applica(client, base, headers, scritture):
    fatte = 0
    for w in scritture:
        try:
            note = json.loads(w.get("notes") or "{}")
            if not isinstance(note, dict):
                note = {}
        except (TypeError, ValueError):
            note = {}
        # La riga dice di essere stata RICOSTRUITA. Un pick ricostruito e un pick
        # scritto alla previsione non sono la stessa cosa, e il registro pubblico
        # non deve far finta che lo siano.
        note["pick_source"] = "backfill_best_selection_0907"
        r = await client.patch(
            f"{base}/unified_predictions",
            params={"id": f"eq.{w['id']}", "pick": "is.null"},  # idempotente
            json={"pick": w["pick"], "notes": json.dumps(note)},
            headers={**headers, "Content-Type": "application/json"},
        )
        if r.status_code in (200, 204):
            fatte += 1
        else:
            print(f"  ! riga {w['id']}: {r.status_code} {r.text[:120]}")
    return fatte


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="scrive davvero (default: sola lettura)")
    ap.add_argument("--solo-pre-partita", action="store_true",
                    help="scarta anche le righe la cui sorgente e' stata calcolata "
                         "dopo il fischio d'inizio")
    ap.add_argument("--sport", choices=["tennis", "football"], default=None)
    a = ap.parse_args()

    base, headers = _base_e_headers()
    async with httpx.AsyncClient(timeout=60.0) as client:
        righe, scritture, scarti = await piano(client, base, headers)

        if a.sport:
            scritture = [w for w in scritture if w["sport"] == a.sport]
        if a.solo_pre_partita:
            prima = len(scritture)
            scritture = [w for w in scritture if w["pre_partita"] is True]
            scarti["scartate perche' non pre-partita"] += prima - len(scritture)

        print(f"bersagli (won/lost, pick nullo): {len(righe)} "
              f"{dict(Counter(r['sport'] for r in righe))}")
        print(f"ricostruibili e VERIFICATE dal controllo incrociato: {len(scritture)} "
              f"{dict(Counter(w['sport'] for w in scritture))}")
        print(f"  di cui sorgente pre-partita: "
              f"{sum(1 for w in scritture if w['pre_partita'] is True)}"
              f" | post-partita: {sum(1 for w in scritture if w['pre_partita'] is False)}"
              f" | data assente: {sum(1 for w in scritture if w['pre_partita'] is None)}")
        for k, v in sorted(scarti.items()):
            print(f"  scarto — {k}: {v}")
        residuo = len(righe) - len(scritture)
        print(f"\nDOPO: righe won/lost senza pick = {residuo} (oggi {len(righe)})")

        if not a.apply:
            print("\n[DRY-RUN] nessuna scrittura. --apply per eseguire.")
            return
        print(f"\n[APPLY] scrivo {len(scritture)} righe…")
        print(f"scritte: {await applica(client, base, headers, scritture)}")


if __name__ == "__main__":
    asyncio.run(main())
