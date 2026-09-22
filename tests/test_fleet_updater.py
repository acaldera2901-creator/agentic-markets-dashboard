# tests/test_fleet_updater.py
"""#FLOTTA-FERMA-0912 — le guardie di core/fleet_updater.

Ogni test qui sotto corrisponde a un modo in cui l'aggiornamento potrebbe «riuscire»
senza aggiornare niente. Sono i casi che il 22/09/2026 sono stati misurati sul campo o
che quella misura ha reso evidenti: la cartella sbagliata, il ff senza fetch, il clone
divergente, l'albero sporco.
"""
import subprocess

from core.fleet_updater import (
    AGGIORNATO,
    GIA_ALLINEATO,
    SALTATO,
    fleet_workdir,
    update_fleet_checkout,
)

WORKER = "/Users/calde/Desktop/agentic-markets-worker"


def _cp(stdout="", returncode=0, stderr=""):
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


class FakeRunner:
    """Risponde ai comandi per prefisso e REGISTRA il cwd di ognuno.

    Il cwd non e' un dettaglio: e' la prova che i comandi git girano nella cartella
    della flotta e non in quella del watchdog — la trappola 1 del modulo.
    """

    def __init__(self, risposte):
        self.risposte = risposte
        self.chiamate = []

    def __call__(self, args, cwd=None, timeout=None):
        self.chiamate.append((tuple(args), cwd))
        for prefisso, risposta in self.risposte.items():
            if tuple(args)[: len(prefisso)] == prefisso:
                return risposta
        return _cp()

    def cwd_di(self, *prefisso):
        for args, cwd in self.chiamate:
            if args[: len(prefisso)] == prefisso:
                return cwd
        return None

    def ha_eseguito(self, *prefisso):
        return any(args[: len(prefisso)] == prefisso for args, _ in self.chiamate)


def _base(locale="aaaaaaaa1111", remoto="bbbbbbbb2222", stato="", branch="main", ancestor=0):
    return {
        ("git", "rev-parse", "--is-inside-work-tree"): _cp("true\n"),
        ("git", "rev-parse", "--abbrev-ref", "HEAD"): _cp(branch + "\n"),
        ("git", "status", "--porcelain"): _cp(stato),
        ("git", "fetch"): _cp(),
        ("git", "rev-parse", "HEAD"): _cp(locale + "\n"),
        ("git", "rev-parse", "origin/main"): _cp(remoto + "\n"),
        ("git", "merge-base", "--is-ancestor"): _cp(returncode=ancestor),
        ("git", "merge", "--ff-only"): _cp(),
    }


# ─── da dove si legge la cartella ───────────────────────────────────────────────

def test_la_cartella_viene_dal_plist_caricato():
    runner = FakeRunner({("plutil",): _cp(WORKER + "\n")})
    assert fleet_workdir(runner) == WORKER


def test_se_plutil_fallisce_si_legge_il_servizio_vivo():
    runner = FakeRunner({
        ("plutil",): _cp(returncode=1, stderr="No such file"),
        ("id", "-u"): _cp("501\n"),
        ("launchctl", "print"): _cp("\tstate = running\n\tworking directory = " + WORKER + "\n"),
    })
    assert fleet_workdir(runner) == WORKER


def test_cartella_non_determinabile_non_aggiorna_niente():
    runner = FakeRunner({
        ("plutil",): _cp(returncode=1),
        ("id", "-u"): _cp("501\n"),
        ("launchctl", "print"): _cp(returncode=1),
    })
    res = update_fleet_checkout(runner=runner)
    assert res.esito == SALTATO
    assert "non determinabile" in res.motivo
    # La prova che conta: nessun comando git e' partito da nessuna parte.
    assert not runner.ha_eseguito("git")


# ─── il caso buono ──────────────────────────────────────────────────────────────

def test_indietro_di_commit_fa_fetch_poi_ff_e_dichiara_lo_sha_nuovo():
    risposte = _base()
    # dopo il merge, HEAD vale il remoto: la seconda lettura di HEAD deve differire
    letture = iter([_cp("aaaaaaaa1111\n"), _cp("bbbbbbbb2222\n")])
    risposte[("git", "rev-parse", "HEAD")] = None
    runner = FakeRunner(risposte)

    def call(args, cwd=None, timeout=None):
        runner.chiamate.append((tuple(args), cwd))
        if tuple(args)[:3] == ("git", "rev-parse", "HEAD"):
            return next(letture)
        for prefisso, risposta in risposte.items():
            if risposta is not None and tuple(args)[: len(prefisso)] == prefisso:
                return risposta
        return _cp()

    res = update_fleet_checkout(runner=call, workdir=WORKER)
    assert res.esito == AGGIORNATO
    assert (res.sha_prima, res.sha_dopo) == ("aaaaaaaa", "bbbbbbbb")
    # il fetch precede il confronto, e i comandi girano nella cartella della flotta
    assert runner.ha_eseguito("git", "fetch")
    assert runner.cwd_di("git", "merge", "--ff-only") == WORKER


def test_gia_allineato_non_esegue_nessun_merge():
    runner = FakeRunner(_base(locale="cccccccc3333", remoto="cccccccc3333"))
    res = update_fleet_checkout(runner=runner, workdir=WORKER)
    assert res.esito == GIA_ALLINEATO
    assert not runner.ha_eseguito("git", "merge")


# ─── le guardie ─────────────────────────────────────────────────────────────────

def test_albero_sporco_non_si_tocca():
    runner = FakeRunner(_base(stato=" M core/model.py\n?? nota.txt\n"))
    res = update_fleet_checkout(runner=runner, workdir=WORKER)
    assert res.esito == SALTATO
    assert res.dettagli["file_sporchi"] == 2
    assert not runner.ha_eseguito("git", "merge")
    # e nemmeno il fetch: su un albero sporco non si va a toccare la rete
    assert not runner.ha_eseguito("git", "fetch")


def test_branch_diverso_da_main_non_si_tocca():
    runner = FakeRunner(_base(branch="michele/prova"))
    res = update_fleet_checkout(runner=runner, workdir=WORKER)
    assert res.esito == SALTATO
    assert "michele/prova" in res.motivo
    assert not runner.ha_eseguito("git", "merge")


def test_checkout_divergente_non_si_forza():
    runner = FakeRunner(_base(ancestor=1))
    res = update_fleet_checkout(runner=runner, workdir=WORKER)
    assert res.esito == SALTATO
    assert "divergente" in res.motivo
    assert not runner.ha_eseguito("git", "merge")


def test_fetch_fallito_ferma_tutto():
    risposte = _base()
    risposte[("git", "fetch")] = _cp(returncode=128, stderr="could not read Username")
    runner = FakeRunner(risposte)
    res = update_fleet_checkout(runner=runner, workdir=WORKER)
    assert res.esito == SALTATO
    assert "fetch" in res.motivo
    assert not runner.ha_eseguito("git", "merge")


def test_non_e_un_repo_git():
    risposte = _base()
    risposte[("git", "rev-parse", "--is-inside-work-tree")] = _cp(returncode=128)
    runner = FakeRunner(risposte)
    res = update_fleet_checkout(runner=runner, workdir=WORKER)
    assert res.esito == SALTATO
    assert "checkout git" in res.motivo


def test_ff_che_riesce_ma_non_sposta_lo_sha_e_un_salto_non_un_successo():
    """Il caso «il comando riesce e non aggiorna», che e' l'intero motivo di questo modulo."""
    runner = FakeRunner(_base(locale="aaaaaaaa1111", remoto="bbbbbbbb2222"))
    # HEAD risponde sempre lo stesso sha: il merge "riesce" ma la cartella non si e' mossa
    res = update_fleet_checkout(runner=runner, workdir=WORKER)
    assert res.esito == SALTATO
    assert "non e' quello di origin/main" in res.motivo
