"""
La guardia temporale del settlement tennis (#SETTLE-0909 B).

Perche' questi test esistono: la guardia era GIA' SCRITTA da mesi (#18) e non si
applicava a NESSUNA riga. `scheduled_at` e' un TIMESTAMP naive, e un datetime
naive **ha** l'attributo `tzinfo` (vale None): il vecchio
`hasattr(pred_when, "tzinfo")` era sempre vero, il ramo di conversione era
codice morto, la sottrazione aware - naive alzava TypeError, e un
`except Exception: pass` lo inghiottiva. Nessun test la copriva, quindi il
difetto e' rimasto invisibile.

Ogni test qui FALLISCE se la guardia viene disattivata di nuovo.
"""
import logging
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from agents.tennis_settlement import TennisSettlementAgent
from core.tennis_names import canonical_player_key

QUANDO = datetime(2026, 6, 5, 12, 0, tzinfo=timezone.utc)


def _agent():
    a = TennisSettlementAgent.__new__(TennisSettlementAgent)
    a.logger = logging.getLogger("test")
    return a


def _pred(scheduled_at=QUANDO, p1="Petra Kvitova", p2="Anna Kalinskaya"):
    return SimpleNamespace(player1=p1, player2=p2, scheduled_at=scheduled_at,
                           tournament="Birmingham Open")


def _res(event_date=QUANDO, score="6-4 6-3", **over):
    r = {
        "winner_key": canonical_player_key("Anna Kalinskaya"),
        "loser_key": canonical_player_key("Petra Kvitova"),
        "winner_name": "Anna Kalinskaya", "loser_name": "Petra Kvitova",
        "tournament": "Birmingham Open", "score_text": score,
        "event_date": event_date, "gender": "W",
        "status_name": "STATUS_FINAL", "source_completed": True,
    }
    r.update(over)
    return r


async def _resolve(agent, preds, results):
    with patch("agents.tennis_settlement.get_completed_results_for_days",
               new=AsyncMock(return_value=results)):
        return await agent._resolve_via_espn(preds)


class TestLaGuardiaSiApplicaDAVVERO:
    @pytest.mark.asyncio
    async def test_un_risultato_di_un_ALTRA_data_non_settla(self):
        """
        Il difetto in una riga: gli stessi due giocatori si rincontrano, e la
        pick di giugno veniva chiusa col risultato di settembre. Se questo test
        passa con `resolved` non vuoto, la guardia e' di nuovo spenta.
        """
        resolved = await _resolve(
            _agent(), [_pred()], [_res(event_date=QUANDO + timedelta(days=90))]
        )
        assert resolved == []

    @pytest.mark.asyncio
    async def test_un_scheduled_at_NAIVE_non_disattiva_la_guardia(self):
        """
        Il cuore del bug B1: in produzione `scheduled_at` arriva naive. Prima
        alzava TypeError, l'`except Exception: pass` lo mangiava e la riga
        veniva settlata comunque — cioe' la guardia esisteva solo sulla carta.
        Qui la data e' naive E sbagliata: NON si deve settlare.
        """
        pred = _pred(scheduled_at=datetime(2026, 6, 5, 12, 0))  # naive, no tzinfo
        resolved = await _resolve(
            _agent(), [pred], [_res(event_date=QUANDO + timedelta(days=90))]
        )
        assert resolved == [], "la guardia si e' spenta su un datetime naive"

    @pytest.mark.asyncio
    async def test_un_scheduled_at_naive_CORRETTO_settla(self):
        """L'altra faccia: la guardia non deve bloccare la data giusta."""
        pred = _pred(scheduled_at=datetime(2026, 6, 5, 12, 0))
        resolved = await _resolve(_agent(), [pred], [_res()])
        assert len(resolved) == 1 and resolved[0][1] == "P2"

    @pytest.mark.asyncio
    async def test_la_finestra_e_di_un_giorno_non_di_tre(self):
        resolved = await _resolve(
            _agent(), [_pred()], [_res(event_date=QUANDO + timedelta(hours=20))]
        )
        assert len(resolved) == 1, "20h deve stare dentro la finestra"
        resolved = await _resolve(
            _agent(), [_pred()], [_res(event_date=QUANDO + timedelta(days=2))]
        )
        assert resolved == [], "2 giorni deve stare fuori (era +-3)"


class TestAmbiguita:
    @pytest.mark.asyncio
    async def test_due_eventi_nella_stessa_finestra_non_si_settlano(self):
        """
        Due candidati per la stessa coppia+data: non si indovina. E' la stessa
        regola che il football applica su ESPN (candidato unico o niente).
        """
        due = [_res(), _res(event_date=QUANDO + timedelta(hours=3))]
        assert await _resolve(_agent(), [_pred()], due) == []

    @pytest.mark.asyncio
    async def test_una_pick_senza_data_non_si_settla(self):
        """
        Prima, senza data, si teneva l'abbinamento per SOLA coppia di nomi: e'
        il buco da cui passava il risultato di un altro incontro.
        """
        assert await _resolve(_agent(), [_pred(scheduled_at=None)], [_res()]) == []

    @pytest.mark.asyncio
    async def test_un_risultato_senza_data_non_si_usa(self):
        assert await _resolve(_agent(), [_pred()], [_res(event_date=None)]) == []


class TestIlCancelloDiCompletamentoNelResolver:
    """A2 + A3 visti dall'esterno: il resolver non produce esiti impossibili."""

    @pytest.mark.asyncio
    async def test_un_punteggio_da_set_singolo_non_diventa_un_esito(self):
        """La firma esatta delle 289 righe difettose pubblicate."""
        assert await _resolve(_agent(), [_pred()], [_res(score="6-1")]) == []

    @pytest.mark.asyncio
    async def test_due_set_in_uno_slam_maschile_non_diventano_un_esito(self):
        pred = _pred(p1="Frances Tiafoe", p2="Alex Michelsen")
        res = _res(score="7-5 6-3", tournament="US Open", gender="M",
                   winner_key=canonical_player_key("Alex Michelsen"),
                   loser_key=canonical_player_key("Frances Tiafoe"))
        assert await _resolve(_agent(), [pred], [res]) == []

    @pytest.mark.asyncio
    async def test_senza_il_flag_completed_della_fonte_non_si_settla(self):
        """
        Il resolver non si fida di chi lo chiama: una fonte che non dichiara
        `source_completed` fallisce chiusa, anche con un punteggio perfetto.
        """
        assert await _resolve(_agent(), [_pred()], [_res(source_completed=False)]) == []

    @pytest.mark.asyncio
    async def test_un_ritiro_si_settla_e_il_punteggio_porta_il_marker(self):
        """
        28 ritiri e 4 walkover misurati in 2 giorni di archivio ESPN. Si
        settlano (il vincitore e' un fatto esplicito della fonte), ma il
        punteggio pubblicato deve dire che non e' un finale regolare.
        """
        resolved = await _resolve(
            _agent(), [_pred()],
            [_res(score="6-1 2-0", status_name="STATUS_RETIRED")],
        )
        assert len(resolved) == 1
        assert resolved[0][2] == "6-1 2-0 ret."

    @pytest.mark.asyncio
    async def test_un_walkover_senza_punteggio_si_settla_col_marker(self):
        resolved = await _resolve(
            _agent(), [_pred()],
            [_res(score=None, status_name="STATUS_WALKOVER")],
        )
        assert len(resolved) == 1
        assert resolved[0][2] == "w/o"
