"""#LEDGER-MIRROR-0831 — le funzioni pure del backfill delle orfane.

Offline: nessuna rete, nessun credenziale. Quello che si prova qui e' la parte
che decide COSA finisce sulla prova pubblica — e in particolare che non ci
finisca niente di inventato.
"""
import pytest

from scripts.backfill_sealed_orphans import (
    _final_score_from_notes,
    outcome_from_score,
    settlement_row,
)


class TestEsitoDalPunteggio:
    @pytest.mark.parametrize(
        "punteggio,atteso",
        [("2-1", "HOME"), ("0-3", "AWAY"), ("1-1", "DRAW"), ("0-0", "DRAW"), ("10-9", "HOME")],
    )
    def test_esiti(self, punteggio, atteso):
        assert outcome_from_score(punteggio) == atteso

    @pytest.mark.parametrize("brutto", [None, "", "non un punteggio", "2:1", "-", "a-b", "2-"])
    def test_senza_un_punteggio_leggibile_NON_si_indovina(self, brutto):
        """Il valore di ritorno e' None, non "DRAW". Un pareggio finto sulla
        prova pubblica e' peggio di una casella vuota: la casella vuota si vede,
        il pareggio finto si somma."""
        assert outcome_from_score(brutto) is None


class TestPunteggioDalleNote:
    def test_dal_json_in_stringa(self):
        assert _final_score_from_notes('{"final_score":"2-1"}') == "2-1"

    def test_da_un_dizionario_gia_deserializzato(self):
        assert _final_score_from_notes({"final_score": "0-0"}) == "0-0"

    def test_le_altre_chiavi_non_disturbano(self):
        assert _final_score_from_notes('{"x":1,"final_score":"3-2","y":"z"}') == "3-2"

    @pytest.mark.parametrize(
        "brutto", [None, "", "   ", "non-json", "[1,2,3]", '{"altro":"1"}', '{"final_score":""}', 42]
    )
    def test_qualunque_forma_inattesa_vale_nessun_punteggio(self, brutto):
        """`notes` e' una colonna TEXT scritta da due percorsi diversi (il cron
        TS e l'agente Python). Una forma inattesa non deve far fallire il
        backfill: vale «non lo so»."""
        assert _final_score_from_notes(brutto) is None


class TestRigaDiChiusura:
    def _orfana(self):
        return {
            "source_table": "match_predictions",
            "source_id": "espn:401896770",
            "model_version": "football-v4-xg-model",
        }

    def test_la_chiave_e_quella_della_FK_e_arriva_dal_ledger(self):
        """La chiave si copia dalla riga SIGILLATA, non si ricostruisce: e'
        l'unico modo di essere certi che la FK agganci."""
        r = settlement_row(self._orfana(), {"result": "lost", "notes": '{"final_score":"0-2"}'})
        assert r["source_table"] == "match_predictions"
        assert r["source_id"] == "espn:401896770"
        assert r["model_version"] == "football-v4-xg-model"

    def test_esito_e_punteggio_dalla_riga_servita(self):
        r = settlement_row(self._orfana(), {"result": "lost", "notes": '{"final_score":"0-2"}'})
        assert r["result"] == "lost"
        assert r["final_score"] == "0-2"
        assert r["outcome"] == "AWAY"

    def test_una_unresolved_resta_unresolved_senza_punteggio_ne_outcome(self):
        """Sono 60 delle 88: partite che non abbiamo mai scorato. La riga di
        chiusura deve esistere — altrimenti il pick sigillato resta orfano — ma
        non deve pretendere di sapere com'e' finita."""
        r = settlement_row(self._orfana(), {"result": "unresolved", "notes": None})
        assert r["result"] == "unresolved"
        assert r["final_score"] is None
        assert r["outcome"] is None

    def test_closing_odds_sempre_nullo(self):
        """Misurato il 31/08: zero sovrapposizione fra le partite con una quota
        di chiusura e quelle su cui abbiamo dato un pick. Qualunque CLV scritto
        qui sarebbe inventato."""
        r = settlement_row(self._orfana(), {"result": "won", "notes": '{"final_score":"2-1"}'})
        assert r["closing_odds"] is None

    def test_marcata_come_backfill(self):
        """`is_backfill=TRUE` tiene queste righe distinguibili per sempre dalle
        chiusure scritte in avanti: una statistica che le mescolasse senza
        saperlo starebbe misurando due cose diverse."""
        r = settlement_row(self._orfana(), {"result": "won", "notes": None})
        assert r["is_backfill"] is True

    def test_un_result_sconosciuto_degrada_a_unresolved_non_a_void(self):
        """`void` significa rimborso e conta come non-perdita; `unresolved` e'
        escluso dalla history. Degradare verso `void` gonfierebbe il record."""
        r = settlement_row(self._orfana(), {"result": "boh", "notes": None})
        assert r["result"] == "unresolved"
