"""
Il cancello di coerenza dei set (#SETTLE-0909 A3).

Ogni test qui e' un caso MISURATO il 09/09 sulle 1.401 righe tennis pubblicate,
non un caso inventato: 289 di quelle righe portavano un punteggio da set
singolo, cioe' un esito scritto mentre la partita era in corso.
"""
from core.tennis_set_validation import (
    best_of, set_completo, sets_incompleti, sets_won, settlement_allowed,
)


class TestSetNonFiniti:
    """
    Il buco della PRIMA versione di questo validatore, trovato il 10/09
    guardando i dati invece dei test: contava come set vinto qualunque coppia
    col primo numero piu' grande, quindi `4-3` era «un set». Misurate 117 righe
    pubblicate con almeno un set aperto, 13 delle quali col punteggio `0-0`.
    """

    def test_il_caso_che_e_sfuggito_us_open_6_4_3_6_4_3(self):
        """Era segnata `won`: e' una partita al terzo set IN CORSO."""
        ok, motivo = _ok("6-4 3-6 4-3", tournament="US Open", gender="M")
        assert ok is False
        assert motivo == "set-non-finito-4-3"

    def test_punteggio_0_0_mai(self):
        """13 righe pubblicate con `0-0`: gradate prima di un game giocato."""
        ok, motivo = _ok("0-0", tournament="Kitzbuhel", gender="W")
        assert ok is False and motivo == "set-non-finito-0-0"

    def test_i_punteggi_parziali_reali_misurati_sono_tutti_rifiutati(self):
        for punteggio in ("1-6 3-2", "5-3", "4-6 0-0", "5-4", "1-6 5-2",
                          "6-2 4-2", "6-3 5-3", "6-2 3-2", "2-1", "4-1"):
            ok, motivo = _ok(punteggio, tournament="Cincinnati Open", gender="M")
            assert ok is False, f"{punteggio} e' passato: {motivo}"

    def test_i_set_legittimi_restano_legittimi(self):
        for a, b in ((6, 0), (6, 1), (6, 2), (6, 3), (6, 4), (7, 5), (7, 6)):
            assert set_completo(a, b) is True, f"{a}-{b}"
        # Set ad avvantaggio: non compaiono nei dati, ma non vanno respinti.
        assert set_completo(8, 6) is True
        assert set_completo(10, 8) is True

    def test_i_set_aperti_sono_riconosciuti(self):
        for a, b in ((4, 3), (5, 4), (5, 3), (2, 1), (0, 0), (6, 5), (6, 6), (1, 0)):
            assert set_completo(a, b) is False, f"{a}-{b}"

    def test_sets_won_non_conta_i_set_aperti(self):
        assert sets_won("6-4 3-6 4-3") == (1, 1)
        assert sets_won("6-2 4-2") == (1, 0)

    def test_sets_incompleti_elenca_quali(self):
        assert sets_incompleti("6-4 3-6 4-3") == ["4-3"]
        assert sets_incompleti("6-4 6-3") == []

    def test_un_ritiro_non_passa_da_questa_regola(self):
        """
        Un ritiro si ferma legittimamente a meta' set: la regola dei set
        non deve applicarsi, o 28 ritiri su 2 giorni finirebbero in unresolved.
        """
        ok, motivo = _ok("6-1 2-0", tournament="US Open", gender="M",
                         status_name="STATUS_RETIRED")
        assert ok is True


def _ok(score, **kw):
    kw.setdefault("source_completed", True)
    kw.setdefault("status_name", "STATUS_FINAL")
    return settlement_allowed(score, **kw)


class TestIDueCasiRealiDellaProposal:
    def test_michelsen_tiafoe_7_5_6_3_va_RIFIUTATO(self):
        """
        US Open maschile = al meglio dei 5. Due set non chiudono la partita:
        questa riga era pubblicata come esito definitivo con la partita in corso.
        """
        ok, motivo = _ok("7-5 6-3", tournament="US Open", gender="M")
        assert ok is False
        assert motivo == "due-set-in-bo5"

    def test_shelton_tsitsipas_6_2_6_3_6_4_va_ACCETTATO(self):
        ok, motivo = _ok("6-2 6-3 6-4", tournament="US Open", gender="M")
        assert ok is True
        assert motivo == "bo5-concluso"


class TestLeSeiClassi:
    def test_un_solo_set_del_vincitore_non_chiude_nessun_formato(self):
        """
        La firma delle righe difettose: un set solo. `6-1`, `7-5`, `6-0` sono
        set FINITI ma insufficienti; `4-2` non e' nemmeno un set finito e viene
        preso prima, dalla regola piu' forte. In entrambi i casi: non si settla.
        """
        for punteggio in ("6-1", "7-5", "6-0"):
            ok, motivo = _ok(punteggio, tournament="Winston-Salem", gender="M")
            assert ok is False, punteggio
            assert motivo == "set-vincitore-1", punteggio
        ok, motivo = _ok("4-2", tournament="Winston-Salem", gender="M")
        assert ok is False and motivo == "set-non-finito-4-2"

    def test_zero_set_del_vincitore_e_rifiutato(self):
        ok, motivo = _ok("4-6", tournament="Cincinnati", gender="M")
        assert ok is False
        assert motivo == "set-vincitore-0"

    def test_il_perdente_non_puo_avere_piu_set_del_vincitore(self):
        """
        Etichetta e punteggio si contraddicono: uno dei due e' sbagliato.
        `6-4 3-6 6-2 4-6` = 2 set a 2, che non e' un esito di nessuno.
        """
        ok, motivo = _ok("6-4 3-6 6-2 4-6", tournament="US Open", gender="M")
        assert ok is False
        assert motivo == "punteggio-contraddittorio-2-2"

    def test_tre_set_del_vincitore_chiudono_sempre(self):
        """Anche senza sapere il formato: nessun torneo va oltre i 3 set vinti."""
        ok, motivo = _ok("6-4 6-3 6-2", tournament="Wimbledon", gender="M")
        assert ok is True and motivo == "bo5-concluso"
        ok, motivo = _ok("6-4 3-6 6-2 4-6 7-5", tournament="US Open", gender=None)
        assert ok is True and motivo == "bo5-concluso"

    def test_una_partita_al_meglio_dei_5_ferma_al_terzo_set_e_rifiutata(self):
        """`6-4 3-6 6-2` sono DUE set al vincitore, non tre: partita in corso."""
        ok, motivo = _ok("6-4 3-6 6-2", tournament="Wimbledon", gender="M")
        assert ok is False and motivo == "due-set-in-bo5"

    def test_due_set_in_bo3_noto_sono_validi(self):
        ok, motivo = _ok("6-4 6-2", tournament="Cincinnati Masters", gender="M")
        assert ok is True and motivo == "bo3-concluso"
        ok, motivo = _ok("6-4 6-2", tournament="US Open", gender="W")
        assert ok is True and motivo == "bo3-concluso"

    def test_due_set_in_uno_slam_col_genere_ignoto_NON_si_settla(self):
        """
        Il caso indecidibile: 179 righe. Senza il genere, `6-4 6-2` a un US Open
        puo' essere una partita finita (femminile) o a meta' (maschile). In
        dubbio non si scrive.
        """
        ok, motivo = _ok("6-4 6-2", tournament="US Open", gender=None)
        assert ok is False
        assert motivo == "formato-ignoto-slam"

    def test_fuori_dagli_slam_il_genere_ignoto_non_serve(self):
        ok, motivo = _ok("6-4 6-2", tournament="Winston-Salem Open", gender=None)
        assert ok is True and motivo == "bo3-concluso"


class TestLaRegolaDedicataDeiRitiri:
    """
    Misurati sull'archivio ESPN del 06-07/09: 28 STATUS_RETIRED e 4
    STATUS_WALKOVER, tutti con `completed = true`. Un ritiro si ferma a
    `6-1 2-0`: se passasse dalle regole sui set verrebbe rifiutato per sempre e
    finirebbe in `unresolved`, gonfiando il void_rate senza motivo.
    """

    def test_un_ritiro_si_settla_anche_con_un_punteggio_parziale(self):
        ok, motivo = _ok("6-1 2-0", tournament="US Open", gender="M",
                         status_name="STATUS_RETIRED")
        assert ok is True
        assert motivo == "esito-irregolare:status_retired"

    def test_un_walkover_NON_si_settla_perche_non_si_e_giocato(self):
        """
        Un walkover e' un passaggio del turno, non un risultato: uno dei due si
        e' ritirato prima dell'inizio. Contarlo come pick vinta e' un claim che
        non ci siamo guadagnati; come persa e' punirsi per una partita mai
        avvenuta. Nessuna delle due e' vera, quindi non si settla.
        """
        ok, motivo = _ok(None, tournament="US Open", gender="M",
                         status_name="STATUS_WALKOVER")
        assert ok is False
        assert motivo == "nessuna-partita:status_walkover"

    def test_un_walkover_non_si_settla_nemmeno_con_un_punteggio(self):
        ok, motivo = _ok("6-0 6-0", tournament="Cincinnati", gender="M",
                         status_name="STATUS_WALKOVER")
        assert ok is False and motivo.startswith("nessuna-partita")

    def test_annullata_e_rinviata_non_si_settlano(self):
        for stato in ("STATUS_CANCELED", "STATUS_POSTPONED", "STATUS_FORFEIT"):
            ok, motivo = _ok("6-4 6-3", tournament="Cincinnati", gender="M",
                             status_name=stato)
            assert ok is False, stato
            assert motivo == f"nessuna-partita:{stato.lower()}"

    def test_il_RITIRO_invece_si_settla(self):
        """
        La differenza che conta: un ritiro la partita l'ha giocata e ha prodotto
        un vincitore. Il pronostico era su chi vince il match, e un vincitore
        c'e' stato. 28 ritiri misurati in 2 giorni di archivio: se non si
        settlassero, finirebbero tutti in `unresolved` senza motivo.
        """
        ok, motivo = _ok("6-1 2-0", tournament="US Open", gender="M",
                         status_name="STATUS_RETIRED")
        assert ok is True
        assert motivo == "esito-irregolare:status_retired"


class TestIlPrimoCancello:
    def test_senza_il_flag_della_fonte_non_si_settla_mai(self):
        """
        Questo e' il fix A2: il criterio e' `status.type.completed` della fonte,
        non il verbo di una stringa di note. Un punteggio perfetto con la fonte
        che non dichiara concluso resta pendente.
        """
        ok, motivo = settlement_allowed(
            "6-2 6-3 6-4", tournament="US Open", gender="M",
            status_name="STATUS_IN_PROGRESS", source_completed=False,
        )
        assert ok is False
        assert motivo == "fonte-non-conclusa"

    def test_concluso_senza_linescores_si_settla_senza_punteggio(self):
        ok, motivo = _ok(None, tournament="Cincinnati", gender="M")
        assert ok is True
        assert motivo == "concluso-senza-punteggio"


class TestFormatoEConteggio:
    def test_il_formato_degli_slam_dipende_dal_genere(self):
        assert best_of("US Open", "M") == 5
        assert best_of("Wimbledon", "M") == 5
        assert best_of("Roland-Garros", "M") == 5
        assert best_of("US Open", "W") == 3
        assert best_of("US Open", None) is None

    def test_fuori_dagli_slam_e_sempre_bo3(self):
        assert best_of("Cincinnati Masters", "M") == 3
        assert best_of("Cincinnati Masters", None) == 3

    def test_il_tiebreak_non_confonde_il_conteggio(self):
        assert sets_won("7-6(4) 6-3") == (2, 0)
        assert sets_won("6-7(5) 7-6(3) 6-4") == (2, 1)

    def test_un_set_pari_non_si_assegna_a_nessuno(self):
        assert sets_won("6-6") == (0, 0)
