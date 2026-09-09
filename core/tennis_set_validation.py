"""
Coerenza del punteggio a set — il gate che rifiuta un esito impossibile.
(#SETTLE-0909, punto A3)

Il difetto misurato il 09/09: 289 righe tennis su 1.401 pubblicate portavano
un'etichetta con un punteggio da SET SINGOLO (`6-1`, `4-2`, `7-5`). Nessun
formato del tennis si chiude con un set: erano partite gradate mentre erano in
corso, perche' il settlement deduceva il «concluso» dal verbo di una stringa di
note (`A bt B`) invece che da un flag della fonte.

Questo modulo e' il secondo cancello, indipendente dal primo: anche con un flag
`completed` esplicito, un punteggio che non descrive una partita finita non
viene scritto. In dubbio NON si settla — la riga resta pendente e al massimo
scade in `unresolved`, che e' un buco dichiarato invece di un esito falso.
"""
from __future__ import annotations

import re

# I quattro Slam: gli unici tornei dove il maschile e' al meglio dei 5 set.
# Il femminile e' al meglio dei 3 in ogni torneo, Slam compresi.
_SLAM = re.compile(
    r"australian open|roland[- ]garros|french open|wimbledon|us open",
    re.IGNORECASE,
)
_SET = re.compile(r"(\d{1,2})\s*-\s*(\d{1,2})(?:\s*\(\d+\))?")

# Stati che la fonte marca `completed = true` ma che NON chiudono un punteggio
# regolare: un ritiro puo' fermarsi a `6-1 2-0`, un walkover non ha punteggio.
# Misurati sull'archivio ESPN del 06-07/09: 1.986 STATUS_FINAL, 28
# STATUS_RETIRED, 4 STATUS_WALKOVER — tutti con `completed = true`.
# Il vincitore resta un fatto esplicito della fonte (flag `winner`), quindi si
# settla — ma senza passare dalle regole sui set, che qui non si applicano.
INCOMPLETE_STATUSES = {"STATUS_RETIRED", "STATUS_WALKOVER", "STATUS_FORFEIT"}


def best_of(tournament: str | None, gender: str | None) -> int | None:
    """Set necessari a vincere, o None se il formato non e' deducibile."""
    slam = bool(_SLAM.search(tournament or ""))
    if gender == "W":
        return 3
    if gender == "M":
        return 5 if slam else 3
    # Genere ignoto: fuori dagli Slam il formato e' BO3 per entrambi i tour,
    # quindi e' noto comunque. Dentro uno Slam dipende dal genere -> ignoto.
    return None if slam else 3


def sets_won(score_text: str | None) -> tuple[int, int]:
    """
    Set vinti (vincitore, perdente) da un punteggio in ottica vincitore.

    `_score_from_competition()` produce sempre il punteggio dal lato del
    vincitore, quindi `6-3 4-6 7-5` significa: primo set vinto, secondo perso.
    Un set con games pari (`6-6`) non e' assegnato a nessuno.
    """
    v = p = 0
    for a, b in _SET.findall(score_text or ""):
        ia, ib = int(a), int(b)
        if ia > ib:
            v += 1
        elif ib > ia:
            p += 1
    return v, p


def settlement_allowed(
    score_text: str | None,
    *,
    tournament: str | None = None,
    gender: str | None = None,
    status_name: str | None = None,
    source_completed: bool = False,
) -> tuple[bool, str]:
    """
    (si_puo_settlare, motivo). Il motivo si logga: serve a contare quante righe
    il cancello rifiuta, che e' la metrica del fix.

    Test format-free dove possibile: le due regole che bocciano le 289 righe
    difettose (`set vincitore <= 1`, `perdente >= vincitore`) non hanno bisogno
    di sapere se si gioca al meglio dei 3 o dei 5.
    """
    if not source_completed:
        return False, "fonte-non-conclusa"

    if (status_name or "").upper() in INCOMPLETE_STATUSES:
        # Ritiro/walkover: il punteggio non deve essere regolare, ma va
        # dichiarato a chi legge — se ne occupa chi pubblica (marker nel testo).
        return True, f"esito-irregolare:{(status_name or '').lower()}"

    if not score_text:
        # La fonte dice concluso ma non porta le linescores. Il vincitore e' un
        # flag esplicito, quindi l'esito e' noto; non c'e' nessun punteggio che
        # possa contraddirlo. Si settla senza punteggio pubblicato.
        return True, "concluso-senza-punteggio"

    v, p = sets_won(score_text)

    if v <= 1:
        # Nessun formato del tennis si chiude con un set solo: e' la firma
        # esatta delle righe gradate a partita in corso.
        return False, f"set-vincitore-{v}"
    if p >= v:
        # Etichetta e punteggio si contraddicono: chi ha vinto non puo' avere
        # meno set di chi ha perso.
        return False, f"punteggio-contraddittorio-{v}-{p}"
    if v > 3:
        return False, f"set-vincitore-{v}-impossibile"
    if v == 3:
        return True, "bo5-concluso"

    # v == 2: valido solo se il formato e' al meglio dei 3.
    bo = best_of(tournament, gender)
    if bo == 3:
        return True, "bo3-concluso"
    if bo == 5:
        return False, "due-set-in-bo5"
    return False, "formato-ignoto-slam"
