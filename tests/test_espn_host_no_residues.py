"""L'host ESPN filtrato non deve ricomparire nel repo (#ESPN-UA-403-0820).

Perche' un test-grep e non un commento: il 20/08 lo stesso bug viveva in **otto**
copie — `core/espn_tennis_client.py`, `core/espn_soccer_client.py`,
`core/espn_player_backfill.py`, due script one-off, `lib/world-cup.ts`,
`lib/summer-leagues.ts`, `app/api/tennis-live/route.ts` — ognuna col suo host e
il suo User-Agent inventato. Il 05/08 una sessione ne ha corretta UNA con un
fallback e il board e' rimasto dimezzato per quindici giorni, perche' nessuno
sapeva quante fossero le altre.

Un commento non ferma la nona copia. Questo test si.

`site.api.espn.com` ha un WAF che filtra sullo User-Agent e 403-a tutto quello
che un runtime nostro manda naturalmente (nessun UA, `undici/*`, `node-fetch/*`,
qualunque `Mozilla/*`). `site.web.api.espn.com` serve lo STESSO payload senza
filtro — misurato identico il 2026-08-20. Gli host stanno in `core/espn_http.py`
e `lib/espn.ts`: chi chiama ESPN importa da la'.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
FILTERED_HOST = "site.api.espn.com"

# Solo i file che possono DAVVERO fare una richiesta. Documenti, spec, report di
# audit e diari nominano l'host filtrato per raccontare il guasto: la prosa non
# apre connessioni, e vietarglielo vorrebbe dire non poter piu' scrivere questa
# storia da nessuna parte.
CODE_SUFFIXES = (".py", ".ts", ".tsx", ".js", ".mjs", ".jsx")

# I due file gemelli documentano l'host filtrato per spiegare PERCHE' non si usa,
# e i test lo nominano nel raccontare il guasto. Tutto il resto e' un residuo.
ALLOWED = {
    "core/espn_http.py",
    "lib/espn.ts",
    "tests/test_espn_host_no_residues.py",
    "tests/test_espn_tennis_client.py",
    "tests/test_tennis_feed_fallback.py",
}


def _tracked_hits() -> dict[str, list[str]]:
    """File tracciati da git che citano l'host filtrato, con le righe."""
    # `git grep` guarda solo i file tracciati: niente venv, node_modules, log.
    # -F: match letterale. Exit 1 = nessun match, non un errore.
    proc = subprocess.run(
        ["git", "grep", "-n", "-F", FILTERED_HOST],
        cwd=REPO, capture_output=True, text=True,
    )
    if proc.returncode not in (0, 1):
        raise AssertionError(f"git grep ha fallito: {proc.stderr.strip()}")

    hits: dict[str, list[str]] = {}
    for line in proc.stdout.splitlines():
        path, _, rest = line.partition(":")
        if not path.endswith(CODE_SUFFIXES):
            continue
        # `site.web.api.espn.com` contiene `api.espn.com` ma NON l'host filtrato:
        # il match letterale su "site.api.espn.com" non lo prende, quindi non
        # serve escluderlo a mano.
        hits.setdefault(path, []).append(rest.strip())
    return hits


def test_the_filtered_espn_host_appears_nowhere_new():
    residues = {p: lines for p, lines in _tracked_hits().items() if p not in ALLOWED}
    assert not residues, (
        "qualcuno e' tornato a chiamare l'host ESPN filtrato — ci 403-a in "
        "silenzio e il board si dimezza senza un errore.\n"
        "Importa ESPN_SITE_API / ESPN_V2_API / ESPN_HEADERS da core/espn_http.py "
        "(Python) o @/lib/espn (TypeScript).\n"
        + "\n".join(f"  {p}: {lines}" for p, lines in sorted(residues.items()))
    )


def test_the_guard_would_actually_catch_a_residue():
    """Il test sopra passa perche' guarda davvero, non perche' non trova nulla.

    Senza questo, un `git grep` rotto (cwd sbagliata, flag cambiato) renderebbe
    la guardia verde per sempre: e' esattamente il modo in cui i controlli
    muoiono senza dirlo.
    """
    hits = _tracked_hits()
    assert "core/espn_http.py" in hits, (
        "la guardia non vede nemmeno il file che documenta l'host filtrato: "
        "il grep non sta cercando dove crede"
    )
