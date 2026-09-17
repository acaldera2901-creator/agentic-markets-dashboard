"""#AH-PERSISTENZA-0917 — test della proiezione su `ah_odds_history`.

Tutti sulla funzione PURA `costruisci_righe`: nessuna rete, nessun DB. Quello
che si vuole dimostrare non e' «il codice gira», e' che una riga non
agganciabile non entra in tabella e che lo scarto viene CONTATO.
"""
from datetime import datetime, timedelta, timezone

import pytest

from core.ah_history import costruisci_righe, EsitoAh


ADESSO = datetime(2026, 9, 17, 12, 0, tzinfo=timezone.utc)
FRA_DUE_ORE = (ADESSO + timedelta(hours=2)).isoformat()


def _rec(**kw) -> dict:
    base = {
        "match_id": "123",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "league": "soccer_epl",
        "ah_line": "-0.5",
        "ah_odds_home": "1.95",
        "ah_odds_away": "1.95",
        "source": "odds_api_ah",
        "commence_time": FRA_DUE_ORE,
    }
    base.update(kw)
    return base


def test_riga_completa_diventa_una_riga_di_tabella():
    righe, esito = costruisci_righe([_rec()], adesso=ADESSO)
    assert len(righe) == 1
    r = righe[0]
    assert r["team_pair_key"] == "2026-09-17:arsenal|chelsea"
    assert r["ah_line"] == -0.5
    assert r["ah_odds_home"] == 1.95
    assert r["minuti_al_via"] == 120
    assert r["source"] == "odds_api_ah"
    assert esito.scritti == 0  # scrive chi persiste, non chi proietta
    assert esito.candidati == 1


def test_la_chiave_e_ordinata_quindi_non_dipende_da_chi_gioca_in_casa():
    a, _ = costruisci_righe([_rec()], adesso=ADESSO)
    b, _ = costruisci_righe(
        [_rec(home_team="Chelsea", away_team="Arsenal")], adesso=ADESSO
    )
    assert a[0]["team_pair_key"] == b[0]["team_pair_key"]


@pytest.mark.parametrize("valore", [None, "", "non-una-data"])
def test_senza_orario_di_inizio_la_riga_non_entra_e_lo_scarto_e_contato(valore):
    righe, esito = costruisci_righe([_rec(commence_time=valore)], adesso=ADESSO)
    assert righe == []
    assert esito.scartati_senza_inizio == 1
    assert esito.compatto()["scartati"] == 1


def test_partita_gia_iniziata_scartata():
    """Su una partita in corso il prezzo non e' piu' pre-partita: misurarci un
    movimento significa misurare il punteggio."""
    passato = (ADESSO - timedelta(minutes=1)).isoformat()
    righe, esito = costruisci_righe([_rec(commence_time=passato)], adesso=ADESSO)
    assert righe == []
    assert esito.scartati_senza_inizio == 1


@pytest.mark.parametrize("home,away", [("", "Chelsea"), ("Arsenal", ""), ("Ajax", "Ajax")])
def test_senza_due_squadre_distinte_niente_chiave_niente_riga(home, away):
    righe, esito = costruisci_righe(
        [_rec(home_team=home, away_team=away)], adesso=ADESSO
    )
    assert righe == []
    assert esito.scartati_senza_chiave == 1


@pytest.mark.parametrize("prezzo", [None, "0", "1.0", "0.85", "abc"])
def test_una_quota_non_maggiore_di_uno_non_e_una_quota(prezzo):
    righe, esito = costruisci_righe([_rec(ah_odds_home=prezzo)], adesso=ADESSO)
    assert righe == []
    assert esito.scartati_senza_prezzo == 1


def test_le_alt_lines_non_entrano_la_principale_si():
    records = [
        _rec(ah_line="-0.5", is_main_line=True),
        _rec(ah_line="-1.0", is_main_line=False),
        _rec(ah_line="-1.5", is_main_line=False),
    ]
    righe, esito = costruisci_righe(records, adesso=ADESSO)
    assert [r["ah_line"] for r in righe] == [-0.5]
    assert esito.scartati_linea_alt == 2
    assert esito.visti == 3


def test_una_fonte_che_non_marca_la_linea_vale_come_principale():
    righe, _ = costruisci_righe([_rec()], adesso=ADESSO)
    assert len(righe) == 1


def test_minuti_al_via_e_negativo_solo_se_il_fischio_e_passato():
    """Guardia sul senso del segno: e' la dimensione su cui si legge il
    movimento, un segno sbagliato ribalterebbe ogni analisi futura."""
    righe, _ = costruisci_righe(
        [_rec(commence_time=(ADESSO + timedelta(minutes=30)).isoformat())],
        adesso=ADESSO,
    )
    assert righe[0]["minuti_al_via"] == 30


def test_lista_vuota_non_esplode():
    righe, esito = costruisci_righe([], adesso=ADESSO)
    assert righe == []
    assert esito == EsitoAh()


def test_il_lotto_misto_conta_tutto_quello_che_scarta():
    records = [
        _rec(),                                   # buona
        _rec(commence_time=None),                 # senza inizio
        _rec(home_team=""),                       # senza chiave
        _rec(ah_odds_away="1.0"),                 # senza prezzo
        _rec(is_main_line=False),                 # alt line
    ]
    righe, esito = costruisci_righe(records, adesso=ADESSO)
    assert len(righe) == 1
    assert esito.visti == 5
    assert esito.compatto()["scartati"] == 4


# ─── la guardia di cadenza dell'agente ───────────────────────────────────────
# Non e' un dettaglio: e' il meccanismo che impedisce di scrivere 1.400 giri al
# giorno per evento, cioe' di ricreare su una tabella nuova il problema che ha
# reso `odds_snapshots` illeggibile.

@pytest.mark.asyncio
async def test_il_secondo_giro_ravvicinato_non_riscrive(monkeypatch):
    from agents.ah_collector import AHCollectorAgent

    chiamate = []

    async def finta_scrittura(records, adesso=None):
        chiamate.append(len(records))
        return EsitoAh(visti=len(records), scritti=len(records))

    monkeypatch.setattr("agents.ah_collector.scrivi_storia_ah", finta_scrittura)
    agente = AHCollectorAgent()

    await agente._persisti([_rec()])
    await agente._persisti([_rec()])  # subito dopo: deve essere ignorato
    assert chiamate == [1]


@pytest.mark.asyncio
async def test_passato_l_intervallo_riscrive(monkeypatch):
    from agents.ah_collector import AHCollectorAgent

    chiamate = []

    async def finta_scrittura(records, adesso=None):
        chiamate.append(len(records))
        return EsitoAh(visti=len(records), scritti=len(records))

    monkeypatch.setattr("agents.ah_collector.scrivi_storia_ah", finta_scrittura)
    agente = AHCollectorAgent()

    await agente._persisti([_rec()])
    # l'orologio dell'agente e' monotonic: lo si sposta indietro invece di
    # dormire 900 secondi in un test.
    agente._last_persist -= agente.PERSIST_INTERVAL + 1
    await agente._persisti([_rec()])
    assert chiamate == [1, 1]


@pytest.mark.asyncio
async def test_il_conteggio_finisce_nell_heartbeat(monkeypatch):
    """Un collector che non riporta e' indistinguibile da uno che non raccoglie."""
    from agents.ah_collector import AHCollectorAgent

    async def finta_scrittura(records, adesso=None):
        return EsitoAh(visti=3, candidati=1, scartati_linea_alt=2, scritti=1)

    monkeypatch.setattr("agents.ah_collector.scrivi_storia_ah", finta_scrittura)
    agente = AHCollectorAgent()
    await agente._persisti([_rec()])

    assert agente._status_detail == {
        "ah_storia": {"visti": 3, "scritti": 1, "scartati": 2, "falliti": 0}
    }


@pytest.mark.asyncio
async def test_una_scrittura_che_esplode_non_ferma_la_raccolta(monkeypatch):
    from agents.ah_collector import AHCollectorAgent

    async def esplode(records, adesso=None):
        raise RuntimeError("DB giu'")

    monkeypatch.setattr("agents.ah_collector.scrivi_storia_ah", esplode)
    agente = AHCollectorAgent()
    await agente._persisti([_rec()])  # non deve alzare
