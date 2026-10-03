from tools.control_center import actions, cockpit, rimedi, sala


def _corpo():
    return {
        "area": "betredge", "assente": False, "eta_min": 3, "stale": False,
        "progetto": {"nome": "BetRedge", "done_quando": "da decidere (Andrea)"},
        "richiedono_te": [{"tipo": "task", "titolo": "infortuni: la strada ESPN non e' usabile",
                           "owner": "Andrea", "fonte": "card:x riga 1", "perche": "claim_registry red"}],
        "in_coda_per_te": [{"titolo": "decidere i goal", "scad": None, "nome_card": "BetRedge", "fonte": "card:y riga 2"}],
        "in_carico": [{"titolo": "token IG scaduto", "owner": "collaboratrice", "giorni_fermo": 2,
                       "nome_card": "Instagram", "checks": ["instagram_en"], "fonte": "card:z"}],
        "da_osservare": [{"check": "launchd_watchdog", "level": "red", "headline": "morto"},
                         {"check": "cron_crm", "level": "amber", "headline": "fermo"}],
    }


def test_routing_sceglie_l_agente_e_ha_un_default():
    assert rimedi.agente_per("instagram_en token scaduto") == "social-media-manager"
    assert rimedi.agente_per("claim_registry infortuni") == "legale-compliance"
    assert rimedi.agente_per("history_orfane pick") == "ml-engineer-agentic"
    assert rimedi.agente_per("qualcosa di mai visto") == rimedi.AGENTE_DEFAULT


def test_ogni_agente_instradato_e_aziendale():
    for _rx, agente in rimedi.ROUTING:
        assert agente in sala.AGENTI_AZIENDALI
    assert rimedi.AGENTE_DEFAULT in sala.AGENTI_AZIENDALI


def test_riavvia_solo_se_e_un_daemon_di_perimetro():
    c = rimedi.arricchisci(_corpo(), {"checks": {}})
    per = {x["check"]: x for x in c["da_osservare"]}
    assert per["launchd_watchdog"]["rimedio"]["riavvia"] == "launchd_watchdog"
    assert per["cron_crm"]["rimedio"]["riavvia"] in (None, False)
    assert all(x["rid"] for x in c["richiedono_te"] + c["in_coda_per_te"] + c["in_carico"])


def test_owner_normalizzato():
    assert rimedi.owner_normalizzato("collaboratrice") == "Collaboratrice"
    assert rimedi.owner_normalizzato("Andrea (merge #504) → Claude") == "Andrea"
    assert rimedi.owner_normalizzato(None) == "Andrea"


def test_sigillo_non_certifica_senza_dati_ne_con_rossi():
    c = rimedi.arricchisci(_corpo(), {"checks": {"a": {"level": "green"}, "b": {"level": "red"}}})
    s = c["sigillo"]
    assert s["certificato"] is False and s["voto"] == 50
    assert [k["ok"] for k in s["criteri"]] == [False, False, False, True]
    vuoto = rimedi.arricchisci(_corpo(), {"checks": {}})["sigillo"]
    assert vuoto["criteri"][1]["dettaglio"] == "non misurato" and not vuoto["certificato"]


def test_sigillo_certificato_solo_con_quattro_su_quattro():
    c = _corpo()
    c["progetto"]["done_quando"] = "ogni goal ha il check verde"
    c["in_coda_per_te"][0]["scad"] = "2026-10-10"
    c["da_osservare"] = []
    s = rimedi.arricchisci(c, {"checks": {"a": {"level": "green"}}})["sigillo"]
    assert s["certificato"] is True and s["ok"] == 4


def test_il_prompt_porta_problema_gate_e_criterio_senza_dati_dal_browser():
    c = rimedi.arricchisci(_corpo(), {"checks": {}})
    lista, x = rimedi.trova(c, "check:launchd_watchdog")
    p = rimedi.prompt_per(c, lista, x)
    assert "launchd_watchdog" in p and "PROPOSAL" in p and "APPROVE" in p
    assert "worktree" in p and "torna verde" in p


def test_apri_scrive_il_prompt_in_un_file_e_non_nella_riga_di_comando(tmp_path, monkeypatch):
    monkeypatch.setattr(rimedi, "PROMPTS_DIR", tmp_path)
    visti = []
    monkeypatch.setattr(actions, "_esegui", lambda argv, az: visti.append(argv) or {"ok": True})
    corpo = _corpo()
    rid = rimedi.arricchisci(corpo, {"checks": {}})["da_osservare"][0]["rid"]
    e = rimedi.apri("betredge", rid, {"checks": {}}, lambda a, s: _corpo())
    assert e["ok"] and list(tmp_path.glob("*.md"))
    assert "cat '" in visti[0][2] and "launchd_watchdog" not in visti[0][2]
    assert rimedi.apri("betredge", "t-inesistente", {}, lambda a, s: _corpo())["ok"] is False
