"""
Il cancello di coerenza dei set (#SETTLE-0909 A3).

Ogni test qui e' un caso MISURATO il 09/09 sulle 1.401 righe tennis pubblicate,
non un caso inventato: 289 di quelle righe portavano un punteggio da set
singolo, cioe' un esito scritto mentre la partita era in corso.
"""
from core.tennis_set_validation import best_of, sets_won, settlement_allowed


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
        """La firma esatta delle 289 righe difettose: `6-1`, `4-2`, `7-5`."""
        for punteggio in ("6-1", "4-2", "7-5", "6-0"):
            ok, motivo = _ok(punteggio, tournament="Winston-Salem", gender="M")
            assert ok is False, punteggio
            assert motivo == "set-vincitore-1"

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

    def test_un_walkover_senza_punteggio_si_settla(self):
        ok, motivo = _ok(None, tournament="US Open", gender="M",
                         status_name="STATUS_WALKOVER")
        assert ok is True
        assert motivo == "esito-irregolare:status_walkover"


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
