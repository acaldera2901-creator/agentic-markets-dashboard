from tools.control_center import sincronizza as S


def test_perimetro_esclude_per_glob():
    esc = ["2-semantic/progetti/project_kelia.md", "1-episodic/learning/[!_]*"]
    assert S._fuori_perimetro("2-semantic/progetti/project_kelia.md", esc)
    assert S._fuori_perimetro("1-episodic/learning/2026-07-08.md", esc)
    assert not S._fuori_perimetro("1-episodic/learning/_LEDGER.md", esc)
    assert not S._fuori_perimetro("2-semantic/progetti/project_betredge.md", esc)


def test_il_profilo_privato_non_e_una_fonte():
    assert set(S.FONTI) == {"azienda"}
    assert S.CERVELLO.name == "cervello-maven"


def test_la_torre_non_elenca_card_private_o_di_sistema():
    from tools.control_center import progetti
    assert {k for k, *_ in progetti.REGISTRI} == {"azienda"}
    for s in progetti.elenco()["schede"]:
        assert s["id"].startswith("azienda/")


def test_la_sala_non_mostra_agenti_personali():
    from tools.control_center import actions, sala
    assert {a["agente"] for a in actions.PERSONALI} <= sala.AGENTI_AZIENDALI
    for privato in ("segretaria", "ceo-andrea", "cfo-andrea", "trader", "custode-mac"):
        assert privato not in sala.AGENTI_AZIENDALI
