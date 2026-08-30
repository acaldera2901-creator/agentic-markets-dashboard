"""
L'archivio ESPN per data — la seconda meta' della causa per cui il settlement
del tennis era andato a zero.

`scoreboard/header` e' il tabellone CORRENTE: un risultato e' visibile solo per
poche ore dopo la fine della partita. Lo scoreboard PER DATA ha un archivio, e
porta il flag `winner` esplicito invece della stringa «A bt B».
"""
from datetime import date, datetime, timezone

from core.espn_tennis_client import (
    _completed_from_scoreboard,
    _score_from_competition,
)
from agents.tennis_settlement import TennisSettlementAgent


def _comp(p1, p2, vince_p1, ls1=None, ls2=None, completato=True):
    def lato(nome, vince, ls):
        c = {"athlete": {"displayName": nome}, "winner": vince}
        if ls is not None:
            c["linescores"] = [{"value": v} for v in ls]
        return c
    return {
        "status": {"type": {"completed": completato}},
        "date": "2026-08-29T16:00Z",
        "competitors": [lato(p1, vince_p1, ls1), lato(p2, not vince_p1, ls2)],
    }


def _payload(comps):
    return {"events": [{"name": "US Open", "date": "2026-08-29T00:00Z",
                        "groupings": [{"grouping": {"displayName": "Men's Singles"},
                                       "competitions": comps}]}]}


class TestPunteggio:
    def test_il_punteggio_e_dal_lato_del_VINCITORE_non_del_primo_competitor(self):
        """
        Regressione: le linescores arrivano in ordine di competitor. Prese cosi'
        il collaudo del 30/08 stampava «James Duckworth vince 3-6 6-7» — un
        vincitore con un punteggio da sconfitto, che sarebbe finito su una card.
        Qui il vincitore e' il SECONDO competitor.
        """
        c = _comp("Mariano Navone", "James Duckworth", vince_p1=False,
                  ls1=[3, 6], ls2=[6, 7])
        assert _score_from_competition(c) == "6-3 7-6"

    def test_i_valori_float_diventano_interi(self):
        c = _comp("A", "B", True, ls1=[6.0, 7.0], ls2=[4.0, 6.0])
        assert _score_from_competition(c) == "6-4 7-6"

    def test_senza_linescores_nessun_punteggio_inventato(self):
        assert _score_from_competition(_comp("A", "B", True)) is None

    def test_set_di_lunghezza_diversa_non_si_indovinano(self):
        assert _score_from_competition(_comp("A", "B", True, ls1=[6, 6], ls2=[4])) is None


class TestEstrazione:
    def test_prende_i_completati_col_vincitore(self):
        out = _completed_from_scoreboard(_payload([_comp("Alfa", "Beta", True, [6, 6], [4, 3])]))
        assert len(out) == 1
        assert out[0]["winner_name"] == "Alfa"
        assert out[0]["loser_name"] == "Beta"
        assert out[0]["score_text"] == "6-4 6-3"

    def test_salta_i_non_completati(self):
        out = _completed_from_scoreboard(_payload([_comp("A", "B", True, completato=False)]))
        assert out == []

    def test_senza_vincitore_esplicito_si_salta_invece_di_indovinare(self):
        c = _comp("A", "B", True)
        for x in c["competitors"]:
            x["winner"] = None
        assert _completed_from_scoreboard(_payload([c])) == []

    def test_ignora_i_doppi(self):
        p = _payload([_comp("A", "B", True)])
        p["events"][0]["groupings"][0]["grouping"]["displayName"] = "Men's Doubles"
        assert _completed_from_scoreboard(p) == []

    def test_payload_vuoto_non_esplode(self):
        assert _completed_from_scoreboard({}) == []


class TestGiorniDaChiedere:
    """Si chiedono solo i giorni che servono: una finestra fissa spenderebbe
    richieste per giorni in cui non c'e' niente da chiudere."""

    class P:
        def __init__(self, quando): self.scheduled = quando

    def test_deduplica_i_giorni(self):
        p = [self.P(datetime(2026, 8, 29, 10, tzinfo=timezone.utc)),
             self.P(datetime(2026, 8, 29, 20, tzinfo=timezone.utc)),
             self.P(datetime(2026, 8, 30, 1, tzinfo=timezone.utc))]
        assert TennisSettlementAgent._giorni_di(p) == {date(2026, 8, 29), date(2026, 8, 30)}

    def test_una_riga_senza_data_non_rompe_le_altre(self):
        p = [self.P(None), self.P(datetime(2026, 8, 29, tzinfo=timezone.utc))]
        assert TennisSettlementAgent._giorni_di(p) == {date(2026, 8, 29)}

    def test_accetta_le_date_in_stringa(self):
        p = [self.P("2026-08-29T16:00:00Z")]
        assert TennisSettlementAgent._giorni_di(p) == {date(2026, 8, 29)}

    def test_nessuna_riga_nessun_giorno(self):
        assert TennisSettlementAgent._giorni_di([]) == set()
