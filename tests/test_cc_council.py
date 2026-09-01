"""Il Council dalla sala controllo. Nessun test tocca la rete: si sostituiscono
`messaggi` e `_post`, perche' un test che chiama un servizio vero non e' un test,
e' una scommessa sul suo uptime."""
import pytest

from tools.control_center import council


def msg(id_, canale="ch_council_main", autore="michele-claude", testo="ciao @claude",
        chiede=True, nome="Claude Michele"):
    return {"id": id_, "channelId": canale, "authorAgentId": autore, "authorName": nome,
            "content": testo, "requiresResponse": chiede, "createdAt": "2026-09-01T00:00:00Z",
            "riskLevel": "low"}


# ── il routing, che e' la trappola gia' pagata una volta ─────────────────────

def test_il_canale_diventa_slug_non_id():
    # Passando channelId il messaggio finisce in council-main in silenzio.
    assert council._slug("ch_deploy_gate") == "deploy-gate"
    assert council._slug("ch_council_main") == "council-main"
    assert council._slug("ch_models_ai") == "models-ai"


def test_un_canale_sconosciuto_non_inventa_un_posto():
    assert council._slug("") == "council-main"
    assert council._slug("robaccia") == "council-main"


# ── cosa conta come «aperta» ─────────────────────────────────────────────────

def test_e_aperta_solo_se_dopo_non_abbiamo_risposto_noi():
    a = msg("msg_a")
    nostra = msg("msg_b", autore=council.NOI, chiede=False)
    assert len(council.aperte([a])) == 1
    assert council.aperte([a, nostra]) == []


def test_una_risposta_in_un_altro_canale_non_chiude_niente():
    a = msg("msg_a", canale="ch_deploy_gate")
    altrove = msg("msg_b", canale="ch_lumio", autore=council.NOI, chiede=False)
    assert len(council.aperte([a, altrove])) == 1


def test_senza_requiresResponse_non_e_una_richiesta():
    assert council.aperte([msg("msg_a", chiede=False)]) == []


def test_se_non_ci_nomina_non_e_nostra():
    assert council.aperte([msg("msg_a", testo="cosa vostra, non mia")]) == []
    assert len(council.aperte([msg("msg_a", testo="cosa vostra")], solo_nostre=False)) == 1


def test_il_gate_si_riconosce():
    ap = council.aperte([msg("msg_a", canale="ch_deploy_gate")])
    assert ap[0]["gate"] is True
    assert council.aperte([msg("msg_b")])[0]["gate"] is False


# ── l'APPROVE ────────────────────────────────────────────────────────────────

def test_approve_rifiuta_un_id_inventato(mocker):
    inviato = mocker.patch.object(council, "_post")
    for cattivo in ["", "../../etc", "msg_x", "msg_" + "a" * 200, "'; drop"]:
        esito = council.approva(cattivo)
        assert esito["ok"] is False, cattivo
    inviato.assert_not_called()


def test_approve_rifiuta_un_messaggio_che_non_esiste(mocker):
    mocker.patch.object(council, "messaggi", return_value=[msg("msg_altro")])
    inviato = mocker.patch.object(council, "_post")
    esito = council.approva("msg_inesistente0")
    assert esito["ok"] is False and "non trovato" in esito["errore"]
    inviato.assert_not_called()


def test_approve_va_nel_canale_del_messaggio_approvato(mocker):
    # Non nel canale di default: approvare una cosa del gate e vederla comparire
    # in council-main sarebbe peggio che non approvarla.
    mocker.patch.object(council, "messaggi", return_value=[
        msg("msg_gate001", canale="ch_deploy_gate", testo="#REQ-310831-betredge-01 @andrea")])
    inviato = mocker.patch.object(council, "_post", return_value={})
    esito = council.approva("msg_gate001")
    assert esito["ok"] is True
    corpo = inviato.call_args[0][1]
    assert corpo["channelSlug"] == "deploy-gate"
    assert corpo["requiresResponse"] is False


def test_approve_nomina_il_riferimento_e_dice_da_dove_arriva(mocker):
    mocker.patch.object(council, "messaggi", return_value=[
        msg("msg_gate002", canale="ch_deploy_gate", testo="#GEO-OPEN-GLOBAL-0831 @andrea")])
    inviato = mocker.patch.object(council, "_post", return_value={})
    council.approva("msg_gate002", nota="ok, ma misura il servito")
    testo = inviato.call_args[0][1]["content"]
    assert "#GEO-OPEN-GLOBAL-0831" in testo
    assert "Andrea" in testo and "Sala Controllo" in testo
    assert "ok, ma misura il servito" in testo
    # deve dire che la firma resta dell'agente: senza, sembra un'auto-approvazione
    assert "identita' umana" in testo or "identità umana" in testo


def test_una_nota_lunghissima_viene_respinta(mocker):
    inviato = mocker.patch.object(council, "_post")
    esito = council.approva("msg_gate003", nota="x" * 501)
    assert esito["ok"] is False
    inviato.assert_not_called()


def test_se_il_council_non_risponde_lo_dice(mocker):
    mocker.patch.object(council, "messaggi",
                        side_effect=council.CouncilNonRaggiungibile("rete giu'"))
    s = council.stato()
    assert s["raggiungibile"] is False and "rete giu'" in s["errore"]
    esito = council.approva("msg_gate004")
    assert esito["ok"] is False


# ── l'archivio locale (#BR-TRIAGE-0901) ──────────────────────────────────────
# Il Council non ha un campo «risolto», e postare una chiusura nel canale
# marcherebbe risolte tutte le richieste di quel canale insieme: l'euristica
# ragiona per canale. Quindi l'archivio e' nostro, locale, e non tocca il Council.


@pytest.fixture(autouse=True)
def archivio_isolato(tmp_path, mocker):
    mocker.patch.object(council, "ARCHIVIO", tmp_path / "arch.json")
    return tmp_path


def test_senza_file_l_archivio_e_vuoto():
    assert council.archiviate() == {}


def test_una_archiviata_sparisce_dalle_aperte():
    a = msg("msg_aaa1")
    assert len(council.aperte([a])) == 1
    council.archivia("msg_aaa1", "gia' in main", "1 commit che cita il tag")
    assert council.aperte([a]) == []
    # ma si puo' ancora vedere, se la si chiede
    assert len(council.aperte([a], includi_archiviate=True)) == 1


def test_non_si_archivia_senza_un_motivo():
    # «obsoleto» senza il perche' e' un'opinione che fra un mese nessuno sa piu'
    # ricostruire: meglio rifiutare che archiviare al buio.
    for vuoto in ("", "   ", "\n"):
        assert council.archivia("msg_aaa2", vuoto)["ok"] is False
    assert council.archiviate() == {}


def test_non_si_archivia_un_id_inventato():
    for cattivo in ("", "../../etc", "msg_x", "'; drop"):
        assert council.archivia(cattivo, "motivo")["ok"] is False
    assert council.archiviate() == {}


def test_il_motivo_e_la_prova_restano_scritti():
    council.archivia("msg_aaa3", "superata dalla catena geo", "GET /api/geo-books -> blocked:false")
    v = council.archiviate()["msg_aaa3"]
    assert v["motivo"] == "superata dalla catena geo"
    assert "geo-books" in v["prova"]
    assert v["quando"]


def test_si_puo_riaprire():
    a = msg("msg_aaa4")
    council.archivia("msg_aaa4", "sembrava fatta")
    assert council.aperte([a]) == []
    assert council.riapri("msg_aaa4")["ok"] is True
    assert len(council.aperte([a])) == 1


def test_riaprire_cio_che_non_era_archiviato_non_e_un_successo():
    assert council.riapri("msg_aaa5")["ok"] is False


def test_un_archivio_corrotto_non_fa_sparire_le_richieste(archivio_isolato):
    # Se il file si rompe, il rischio da evitare e' il silenzio: meglio
    # ri-mostrare tutto che nascondere una richiesta viva.
    council.ARCHIVIO.write_text("{ non json", encoding="utf-8")
    assert council.archiviate() == {}
    assert len(council.aperte([msg("msg_aaa6")])) == 1
