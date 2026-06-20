from core.tennis_tour_filter import filter_main_tour, is_placeholder

def _fx(p1, p2, tournament="ATP Halle", round="Round 1"):
    return {"player1": p1, "player2": p2, "tournament": tournament, "round": round}

def test_is_placeholder():
    assert is_placeholder(_fx("TBD", "TBD"))
    assert is_placeholder(_fx("Sinner", "TBD"))
    assert is_placeholder(_fx("", "Alcaraz"))
    assert is_placeholder(_fx(None, "Alcaraz"))
    assert not is_placeholder(_fx("Sinner", "Alcaraz"))

def test_filter_drops_tbd_keeps_real():
    fx = [_fx("TBD", "TBD"), _fx("Sinner", "Alcaraz"), _fx("Musetti", "TBD")]
    kept, report = filter_main_tour(fx, denylist=())
    names = {(f["player1"], f["player2"]) for f in kept}
    assert names == {("Sinner", "Alcaraz")}
    assert report["placeholder"] == 2
