"""
Quando `unified_predictions.pick` e' vuoto, il ponte deve usare il favorito del
modello invece di buttare via un esito vero.

Misurato il 30/08: `pick` vuoto sul 47% delle righe tennis degli ultimi 3 giorni
(la riga dice «confidence 68» senza dire su CHI), e 14 delle prime 20 chiuse dopo
la riparazione del settlement sono finite in `void` per questo.
`tennis_predictions.best_selection` e' invece popolato al 100%.
"""
import pytest
from agents.tennis_settlement import TennisSettlementAgent


class Pred:
    def __init__(self, sel, p1="Jessica Pegula", p2="Elena-Gabriela Ruse"):
        self.best_selection = sel
        self.player1 = p1
        self.player2 = p2


def test_p1_da_il_primo_giocatore():
    assert TennisSettlementAgent._favorito(Pred("P1")) == "Jessica Pegula"


def test_p2_da_il_secondo():
    assert TennisSettlementAgent._favorito(Pred("P2")) == "Elena-Gabriela Ruse"


def test_e_insensibile_a_maiuscole_e_spazi():
    assert TennisSettlementAgent._favorito(Pred(" p2 ")) == "Elena-Gabriela Ruse"


@pytest.mark.parametrize("sel", [None, "", "   ", "X", "DRAW"])
def test_selezione_assente_o_incomprensibile_NON_si_indovina(sel):
    """Meglio un void che un vincitore inventato: il ponte tornera' al suo
    comportamento precedente invece di scegliere un giocatore a caso."""
    assert TennisSettlementAgent._favorito(Pred(sel)) is None


def test_il_favorito_e_sempre_uno_dei_due_giocatori():
    p = Pred("P1")
    assert TennisSettlementAgent._favorito(p) in (p.player1, p.player2)
