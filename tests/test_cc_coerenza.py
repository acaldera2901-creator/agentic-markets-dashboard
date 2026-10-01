"""#CERTIFICA-1001 — i controlli di coerenza del prodotto e `lab certifica prodotto`."""
import re
from pathlib import Path
from unittest.mock import patch

import pytest

from tools.control_center import certifica_prodotto as cp
from tools.control_center.checks import all_checks, coerenza
from tools.control_center.contract import Check, green, info, red, unknown

REPO = Path(__file__).resolve().parents[1]


# ── 1 · parita' sorgente / unified ──────────────────────────────────────────
@pytest.mark.parametrize("riga,livello", [
    ((142, 0, 0), "red"),        # il 30/09: il tennis sparito da unified
    ((100, 60, 60), "red"),      # sotto il 70%
    ((100, 80, 80), "amber"),
    ((214, 212, 212), "green"),
    ((0, 0, 0), "unknown"),      # niente da confrontare non e' un verde
])
def test_parita(riga, livello):
    with patch.object(coerenza, "fetch_all", return_value=[riga]):
        assert coerenza.check_parita("tennis").level == livello


def test_freschezza_per_lega_vede_la_lega_ferma_anche_se_le_altre_girano():
    with patch.object(coerenza, "fetch_all", return_value=[("LOI", 30.0), ("PL", 1.5)]):
        v = coerenza.check_freschezza_leghe()
    assert v.level == "red" and v.evidence["ferme"] == [("LOI", 30.0)]
    with patch.object(coerenza, "fetch_all", return_value=[("LOI", 5.7), ("PL", 1.5)]):
        assert coerenza.check_freschezza_leghe().level == "green"


# ── 2 · /history = DB ricalcolato col codice vero ───────────────────────────
def _replay(n, won, lost, cov_honest=0.98, dropped=0):
    return {"headline": {"n": n, "won": won, "lost": lost},
            "declared": {"dedup_dropped": dropped}, "route_rows": n,
            "honest": {"coverage": cov_honest, "finished_shown": 100, "counted": 98}}


def test_le_gemelle_note_non_sono_piu_un_rosso_falso():
    # Il vecchio check confrontava una SQL senza dedup: 156 gemelle -> rosso.
    stats = {"n": 3092, "won": 1798, "lost": 1294, "coverage": 0.984}
    with patch.object(coerenza, "misura_history", return_value=(_replay(3092, 1798, 1294, dropped=156), stats)):
        assert coerenza.check_history_coerente().level == "green"


def test_history_diverso_dal_ricalcolo_e_rosso_anche_di_una_riga():
    stats = {"n": 3093, "won": 1799, "lost": 1294}
    with patch.object(coerenza, "misura_history", return_value=(_replay(3092, 1798, 1294), stats)):
        assert coerenza.check_history_coerente().level == "red"


def test_senza_tsx_o_api_e_non_misurato_mai_verde():
    with patch.object(coerenza, "misura_history", side_effect=coerenza.ReplayUnavailable("no tsx")):
        assert coerenza.check_history_coerente().level == "unknown"
        assert coerenza.check_copertura_onesta().level == "unknown"


def test_il_vecchio_check_sql_non_e_piu_registrato_due_volte():
    with patch("tools.control_center.checks.pipeline._providers", return_value=[]):
        ids = [c.id for c in all_checks()]
    assert ids.count("history_coerente") == 1
    for nuovo in ("parita_tennis", "parita_calcio", "freschezza_leghe",
                  "copertura_onesta", "claim_registry"):
        assert nuovo in ids


def _corpo(testo: str) -> list[str]:
    m = re.search(r"if \(!row\.pick\) return false;(.*?)return row\.competition === \"World Cup\";",
                  testo, re.S)
    assert m, "wasShownAsPick non trovato"
    return [r.strip() for r in m.group(1).splitlines()
            if r.strip() and not r.strip().startswith("//")]


def test_la_copia_di_wasShownAsPick_e_identica_alla_route():
    route = (REPO / "app/api/v2/history/route.ts").read_text()
    copia = (REPO / "tools/control_center/checks/history_replay.ts").read_text()
    assert _corpo(route) == _corpo(copia)


def test_il_replay_esegue_il_codice_vero_dedup_compreso():
    """Integrazione: due righe gemelle (stessa partita, id diversi) contano una."""
    if not coerenza._node() or not (coerenza.REPO_ROOT / "node_modules/tsx/dist/cli.mjs").exists():
        pytest.skip("tsx non disponibile")
    base = {"sport": "football", "competition": "Premier League", "market": "1X2",
            "home_team": "Arsenal", "away_team": "Chelsea", "pick": "HOME", "notes": None,
            "result": "won", "starts_at": "2026-08-10T15:00:00+00:00",
            "settled_at": "2026-08-10T18:00:00+00:00", "confidence_score": 70,
            "verification_state": "verified", "is_historical": True}
    gemella = {**base, "settled_at": "2026-08-11T18:00:00+00:00", "result": "lost"}
    altra = {**base, "home_team": "Leeds", "away_team": "Everton"}
    out = coerenza._replay([base, gemella, altra], [base, gemella, altra, {**altra, "home_team": "Fulham", "result": "unresolved", "verification_state": None}])
    # vince la gemella settlata dopo (lost), come in route.ts
    assert out["headline"] == {"n": 2, "won": 1, "lost": 1}
    assert out["declared"]["dedup_dropped"] == 1
    assert out["honest"]["finished_shown"] == 3 and out["honest"]["counted"] == 2


# ── 3 · copertura ───────────────────────────────────────────────────────────
def test_copertura_dichiarata_che_ignora_gli_unresolved_e_rossa():
    stats = {"n": 3092, "won": 1, "lost": 1, "coverage": 0.984}
    with patch.object(coerenza, "misura_history", return_value=(_replay(1, 1, 0, cov_honest=0.563), stats)):
        assert coerenza.check_copertura_onesta().level == "red"
    stats["coverage"] = 0.57
    with patch.object(coerenza, "misura_history", return_value=(_replay(1, 1, 0, cov_honest=0.563), stats)):
        assert coerenza.check_copertura_onesta().level == "green"
    del stats["coverage"]
    with patch.object(coerenza, "misura_history", return_value=(_replay(1, 1, 0, cov_honest=0.563), stats)):
        assert coerenza.check_copertura_onesta().level == "unknown"


# ── 4 · registro dei claim ──────────────────────────────────────────────────
def _claim(**kw):
    riga = {"id": "x", "dove": "f.ts:1", "testo": "t", "misura": "sql:select 1",
            "operatore": ">=", "soglia": "1", "stato": "attivo", "atteso": "rotto"}
    return {**riga, **kw}


def test_valuta_claim():
    with patch.object(coerenza, "fetch_all", return_value=[(0,)]):
        assert coerenza.valuta_claim(_claim())["esito"] is False
    with patch.object(coerenza, "fetch_all", return_value=[(3,)]):
        assert coerenza.valuta_claim(_claim())["esito"] is True
    with patch.object(coerenza, "fetch_all", return_value=[(None,)]):
        assert coerenza.valuta_claim(_claim())["esito"] is None  # nessun dato != zero
    assert coerenza.valuta_claim(_claim(misura="-"))["esito"] is None
    assert coerenza.valuta_claim(_claim(stato="ritirato 2026-10-02"))["esito"] == "ritirato"
    # trust boundary: niente scritture, nemmeno dal file versionato
    assert coerenza.valuta_claim(_claim(misura="sql:delete from x"))["esito"] is None
    assert coerenza.valuta_claim(_claim(misura="sql:select 1; delete from x"))["esito"] is None


def test_il_registro_versionato_e_completo_e_valido():
    claims = coerenza.leggi_claims()
    assert len(claims) >= 37
    assert len({c["id"] for c in claims}) == len(claims)
    for c in claims:
        if c["misura"] != "-":
            assert c["misura"].startswith(("sql:", "api:")), c["id"]
            assert c["operatore"] in coerenza._OPERATORI, c["id"]
            float(c["soglia"])
        assert c["stato"] == "attivo" or c["stato"].startswith("ritirato 20"), c["id"]
    # i claim gia' noti rotti sono misurati, non lasciati a '?'
    misurati = {c["id"] for c in claims if c["misura"] != "-"}
    assert {"c01-clv-email", "c03-xg-faq", "c03b-injuries", "c09-creator-picks"} <= misurati


def test_check_claims_rosso_se_uno_e_rotto():
    with patch.object(coerenza, "leggi_claims", return_value=[_claim(), _claim(id="y", misura="-")]), \
         patch.object(coerenza, "fetch_all", return_value=[(0,)]):
        v = coerenza.check_claims()
    assert v.level == "red" and len(v.evidence["claims"]) == 2


# ── 6 · il referto ──────────────────────────────────────────────────────────
def _chk(cid, group="g"):
    return Check(cid, group, cid.upper(), lambda: None)


def test_referto_mappa_i_livelli_ed_espande_i_claim():
    lista = [_chk("a"), _chk("b"), _chk("c"), _chk("kpi"), _chk("claim_registry", "coerenza")]
    verdetti = {
        "a": green("ok", "s"), "b": red("ko", "s", evidence={"soglia": "0", "riparo": "fai X"}),
        "c": unknown("non so", "s"), "kpi": info("42", "s"),
        "claim_registry": red("1 rotto", "s", evidence={"claims": [
            {"id": "c1", "dove": "d", "testo": "t", "misura": 0, "soglia": ">= 1",
             "esito": False, "atteso": "rotto"},
            {"id": "c2", "dove": "d", "testo": "t", "misura": "-", "soglia": ">= 1",
             "esito": "ritirato", "atteso": "rotto"}]}),
    }
    voci, n_info = cp.voci_da_verdetti(lista, verdetti)
    assert n_info == 1
    assert [(v["id"], v["esito"]) for v in voci] == [
        ("a", True), ("b", False), ("c", None), ("claim:c1", False)]
    assert voci[1]["soglia"] == "0" and voci[1]["riparo"] == "fai X"
    assert cp.codice_uscita(voci) == 1
    assert cp.codice_uscita(voci[:1]) == 0
    assert cp.codice_uscita([{"esito": None}]) == 1   # un '?' non e' un verde
    assert cp.codice_uscita([]) == 1                  # nessun controllo non e' un passaggio


def test_argomento_sconosciuto_fallisce():
    with pytest.raises(SystemExit) as e:
        cp.main(["--boh"])
    assert e.value.code == 2


# ── revisione: niente verde senza popolazione misurata ──────────────────────
@pytest.mark.parametrize("db_n,stats,livello", [
    (0, {"n": 0, "won": 0, "lost": 0}, "unknown"),   # DB e API vuoti: non e' coerenza
    (0, {}, "unknown"),                               # API senza campi
    (5, {"won": 3, "lost": 2}, "unknown"),            # 'n' assente nelle stats
    (5, {"n": 0, "won": 0, "lost": 0}, "red"),        # l'API dice 0, il DB no
])
def test_history_senza_popolazione_non_e_verde(db_n, stats, livello):
    rep = _replay(db_n, db_n, 0)
    with patch.object(coerenza, "misura_history", return_value=(rep, stats)):
        assert coerenza.check_history_coerente().level == livello


def test_registro_vuoto_o_tutto_ritirato_non_e_verde():
    with patch.object(coerenza, "leggi_claims", return_value=[]):
        assert coerenza.check_claims().level == "unknown"
    ritirati = [_claim(stato="ritirato 2026-10-02"), _claim(id="y", stato="ritirato 2026-10-03")]
    with patch.object(coerenza, "leggi_claims", return_value=ritirati):
        v = coerenza.check_claims()
    assert v.level == "unknown" and "2 ritirati" in v.headline


def test_ritirato_senza_data_valida_non_si_salta():
    for stato in ("ritirato", "ritirato ieri", "ritirato 2026-13-40"):
        assert coerenza.valuta_claim(_claim(misura="-", stato=stato))["esito"] is None
    assert coerenza.valuta_claim(_claim(stato="boh"))["esito"] is None


def test_registro_con_header_monco_o_troncato_e_illeggibile(tmp_path):
    monco = tmp_path / "a.tsv"
    monco.write_text("id\tdove\ttesto\nx\td\tt\n", encoding="utf-8")
    with pytest.raises(ValueError):
        coerenza.leggi_claims(monco)
    troncato = tmp_path / "b.tsv"
    troncato.write_text("\t".join(coerenza.CAMPI) + "\nx\td\tt\tsql:select 1\n", encoding="utf-8")
    with pytest.raises(ValueError):
        coerenza.leggi_claims(troncato)
    with patch.object(coerenza, "CLAIMS_FILE", monco):
        assert coerenza.check_claims().level == "unknown"


def test_claim_uguale_zero_su_popolazione_vuota_non_e_verde():
    # weekly_pick vuota: 0 gambe partner su 0 gambe non e' «regge»
    zero = _claim(operatore="==", soglia="0", misura="sql:select 0, 0")
    with patch.object(coerenza, "fetch_all", return_value=[(0, 0)]):
        assert coerenza.valuta_claim(zero)["esito"] is None
    with patch.object(coerenza, "fetch_all", return_value=[(0, 3)]):
        assert coerenza.valuta_claim(zero)["esito"] is True
    # '== 0' senza la colonna della popolazione: non misurabile
    with patch.object(coerenza, "fetch_all", return_value=[(0,)]):
        assert coerenza.valuta_claim(_claim(operatore="==", soglia="0"))["esito"] is None


def test_i_claim_uguale_zero_del_registro_dichiarano_la_popolazione():
    for c in coerenza.leggi_claims():
        if c["operatore"] == "==" and c["misura"] != "-":
            assert c["misura"].count(" as popolazione") == 1, c["id"]


def test_parita_conta_partite_distinte_e_segnala_i_duplicati():
    sql, _ = coerenza._PARITA["tennis"]
    assert "count(distinct s.match_id)" in sql and "count(distinct u.source_id)" in sql
    # 100 partite, 100 abbinate ma 150 righe unified: duplicati -> non verde
    with patch.object(coerenza, "fetch_all", return_value=[(100, 100, 150)]):
        assert coerenza.check_parita("tennis").level == "amber"
    # quota impossibile (>110%): anomalia, rosso
    with patch.object(coerenza, "fetch_all", return_value=[(100, 150, 150)]):
        assert coerenza.check_parita("tennis").level == "red"


def test_history_e_copertura_si_rimisurano_a_ogni_giro():
    # CONFIRM_RUNS=2 deve voler dire due misure, non una riusata due volte.
    with patch("tools.control_center.checks.pipeline._providers", return_value=[]):
        ttl = {c.id: c.ttl_seconds for c in all_checks()}
    assert ttl["history_coerente"] == 0 and ttl["copertura_onesta"] == 0


def test_history_dichiara_cosa_prova():
    stats = {"n": 2, "won": 1, "lost": 1}
    with patch.object(coerenza, "misura_history", return_value=(_replay(2, 1, 1), stats)):
        v = coerenza.check_history_coerente()
    assert "non la correttezza" in v.evidence["cosa_prova"]


def test_senza_database_url_messaggio_chiaro_e_exit_1(monkeypatch, capsys):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with patch("tools.control_center.db.load_env", return_value={}):
        assert cp.main([]) == 1
    assert "DATABASE_URL assente" in capsys.readouterr().err


def test_popolazione_finita_limitata_e_troncamento_non_verde():
    assert "limit 20000" in coerenza._FINITE_SQL
    stats = {"n": 1, "won": 1, "lost": 0, "coverage": 0.56}
    rep = _replay(1, 1, 0, cov_honest=0.563)
    rep["finished_rows"] = coerenza.FINITE_MAX
    with patch.object(coerenza, "misura_history", return_value=(rep, stats)):
        assert coerenza.check_copertura_onesta().level == "unknown"
