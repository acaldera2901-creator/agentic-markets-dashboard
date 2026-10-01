"""#SETTLE-1001 a3 — il check «History coerente col DB» confronta al netto del
cutover del 25/09.

Dal 25/09 /api/v2/history toglie dall'headline le righe calcio post-cutover
sotto il floor di lega e le pubblica a parte in `stats.post_cutover_excluded`.
La SQL del check non lo sapeva: contava anche quelle, e lo scarto diventava
un falso allarme. Il netto si fa col numero che l'API PUBBLICA, non
replicando il floor in SQL (sarebbe una terza copia della stessa regola).
"""
import io
import json
from unittest.mock import patch

from tools.control_center.checks import results


def _api(stats):
    return io.BytesIO(json.dumps({"stats": stats}).encode())


def _run(db_row, stats):
    with patch.object(results, "fetch_all", return_value=[db_row]), \
         patch("urllib.request.urlopen", return_value=_api(stats)):
        return results.check_history_coerente()


BASE = {"n": 1000, "win_rate": "60.0%", "coverage": 0.98}


def test_le_escluse_post_cutover_non_sono_uno_scarto():
    # DB: 1100 decise / 655 vinte; l'API ne esclude 100 (55 vinte) -> 1000 / 600.
    v = _run((1100, 655), {**BASE, "post_cutover_excluded": {"n": 100, "won": 55, "lost": 45}})
    assert v.level == "green", v.headline
    assert v.evidence["escluse_post_cutover"] == 100


def test_senza_il_campo_il_confronto_resta_quello_di_prima():
    v = _run((1000, 600), BASE)
    assert v.level == "green"


def test_un_vero_scarto_resta_rosso_anche_al_netto():
    v = _run((1200, 655), {**BASE, "post_cutover_excluded": {"n": 100, "won": 55, "lost": 45}})
    assert v.level == "red"


def test_un_campo_incoerente_non_si_sottrae():
    # Trust boundary: un'esclusione piu' grande del DB non si usa per «aggiustare».
    v = _run((1000, 600), {**BASE, "post_cutover_excluded": {"n": 5000, "won": 1, "lost": 1}})
    assert v.level == "green"
    assert v.evidence["escluse_post_cutover"] == 0
