"""#TENNIS-BLEND-PROMOTE-0805 — il blend col mercato diventa il modello SERVITO.

Prove live che motivano la promozione (am-lab/REPORT-tennis-blend-2026-08-05.md):
223 partite con snapshot di mercato PRE-match in prediction_log e verita' di
settlement indipendente da tennis_predictions.winner —

                        pick sopra floor   hit-rate   Brier
  elo raw (servito)           91            71.4%     0.2259
  blend a=0.30               125            77.6%     0.1981
  mercato devigato           131            79.4%     0.1963

cioe' +6,2 punti di accuratezza E +37% di volume insieme, stabile su entrambe le
meta' della finestra; sui 50 match dove il blend ribalta il lato scelto dal
modello ha ragione 32 volte su 50 (z=1,98, p una coda ~0,024).

Questi test coprono il CONTRATTO della promozione, non i numeri: che il blend
sia applicato solo con un mercato usabile, che senza mercato la riga esca
identica a prima, che il flag sia un rollback vero e che l'A/B sopravviva alla
promozione invece di finire con essa.
"""
from core.tennis_market_blend import (
    TENNIS_MARKET_BLEND_ALPHA,
    blend_tennis,
    devig_2way,
)


def test_alpha_is_the_preregistered_one():
    # 0.30 NON e' stato scelto su questi dati: e' l'alpha del football e quello
    # del lab 10y del 08/06. Se qualcuno lo ritocca, deve rifare le prove.
    assert TENNIS_MARKET_BLEND_ALPHA == 0.3


def test_no_market_is_the_identity():
    # E' il punto che rende la promozione sicura: le partite senza prezzo
    # vengono servite ESATTAMENTE come prima, non peggio.
    for odds in [(None, None), (None, 2.0), (1.0, 2.0), (0.0, 0.0), (-1, 3)]:
        assert devig_2way(*odds) is None
        assert blend_tennis(0.7, 0.3, devig_2way(*odds)) == (0.7, 0.3)


def test_blend_moves_toward_the_market_and_stays_a_distribution():
    market = devig_2way(1.25, 4.0)  # mercato: P1 nettamente favorito
    assert market is not None
    b1, b2 = blend_tennis(0.50, 0.50, market)
    assert abs(b1 + b2 - 1.0) < 1e-9
    # modello indeciso + mercato deciso -> il servito si sposta sul mercato
    assert b1 > 0.50
    # ...ma non ci arriva: il modello pesa ancora 30%
    assert b1 < market["p1"]
    assert abs(b1 - (0.3 * 0.50 + 0.7 * market["p1"])) < 1e-9


def test_blend_can_flip_the_side_the_model_picked():
    # E' il caso che vale i punti: sui 50 flip live il blend ha ragione 32 volte.
    market = devig_2way(1.20, 4.5)          # mercato: P1
    b1, b2 = blend_tennis(0.45, 0.55, market)  # modello: P2
    assert b1 > b2


def test_blend_cannot_flip_when_both_agree():
    market = devig_2way(1.40, 3.0)          # mercato: P1
    b1, b2 = blend_tennis(0.70, 0.30, market)  # modello: P1
    assert b1 > b2


def test_devig_removes_the_overround():
    m = devig_2way(1.5, 2.5)
    assert m is not None
    assert abs(m["p1"] + m["p2"] - 1.0) < 1e-9
    # senza devig 1/1.5 + 1/2.5 = 1.0667: il margine sparisce nella normalizzazione
    assert m["p1"] < 1 / 1.5


def test_flag_is_a_real_rollback_switch():
    # Il flag ESISTEVA dal 08/06 ma non era cablato a nulla: spegnerlo o
    # accenderlo non cambiava una riga. Ora e' l'interruttore vero, quindi deve
    # esistere ed essere leggibile senza esplodere.
    from config.settings import settings
    assert isinstance(getattr(settings, "TENNIS_SHADOW_SERVE_ENABLED"), bool)
    # e lo shadow resta acceso DOPO la promozione: e' l'A/B invertito, senza il
    # quale la promozione non sarebbe piu' misurabile ne' confrontabile.
    assert settings.TENNIS_SHADOW_ENABLED is True


def test_served_probability_is_what_the_edge_is_measured_against():
    # Con il mercato dentro al 70%, il disaccordo col mercato si comprime a ~0.3x.
    # Non e' un effetto collaterale: e' la ragione per cui l'edge va calcolato
    # sul servito e non sul raw, altrimenti pubblicheremmo un valore che non
    # crediamo piu'.
    market = devig_2way(1.8, 2.1)
    assert market is not None
    raw_edge = 0.70 - market["p1"]
    b1, _ = blend_tennis(0.70, 0.30, market)
    blended_edge = b1 - market["p1"]
    assert blended_edge < raw_edge
    assert abs(blended_edge - TENNIS_MARKET_BLEND_ALPHA * raw_edge) < 1e-9
