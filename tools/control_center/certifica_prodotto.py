"""`lab certifica prodotto` — il referto di coerenza del prodotto.

Non ha controlli suoi: esegue gli STESSI check della torre (checks.all_checks,
in sola lettura, come `collector --dry-run`) e li stampa nel formato di
`lab certifica`. Cosi' comando e torre non possono dire due cose diverse.

  ✔ verde · ✘ rosso o ambra · ? non misurato (che NON e' verde)
  exit 0 solo se tutto e' verde; 1 altrimenti; 2 su argomento sconosciuto.

I KPI senza giudizio (livello `info`) non sono controlli: si contano e basta.
"""

import argparse
import datetime
import json
import subprocess
import sys
from pathlib import Path

from .checks import all_checks
from .db import REPO_ROOT, _dsn
from .runner import run_checks
from .snapshot import STATE_DIR

DEST_JSON = STATE_DIR / "certificazione-prodotto.json"
ESITO = {"green": True, "red": False, "amber": False, "unknown": None}


def _colore(testo, codice):
    return f"\033[{codice}m{testo}\033[0m"


def voci_da_verdetti(lista, verdetti) -> tuple[list[dict], int]:
    """(voci del referto, numero di KPI info esclusi)."""
    voci, info = [], 0
    for chk in lista:
        v = verdetti.get(chk.id)
        if v is None:
            continue
        if v.level == "info":
            info += 1
            continue
        prova = v.evidence or {}
        claims = prova.get("claims") if chk.id == "claim_registry" else None
        if claims:
            # Il registro si espande: un claim per riga, come li legge chi ripara.
            for c in claims:
                if c["esito"] == "ritirato":
                    continue
                voci.append({
                    "area": "claim", "id": f"claim:{c['id']}", "nome": c["id"],
                    "misura": c["misura"], "soglia": c["soglia"] if c["misura"] != "-" else "misurabile",
                    "esito": c["esito"], "riparo": f"{c['testo']} — {c['dove']}",
                    "nota": c.get("nota") or f"audit 01/10: {c['atteso']}",
                })
            continue
        voci.append({
            "area": chk.group, "id": chk.id, "nome": chk.label,
            "misura": v.value if v.value is not None else "-",
            "soglia": prova.get("soglia", "verde"),
            "esito": ESITO[v.level],
            "riparo": prova.get("riparo", ""),
            "nota": (f"ambra: {v.headline}" if v.level == "amber" else v.headline),
        })
    return voci, info


def _ultima_riga(testo: str) -> str:
    righe = [r for r in testo.strip().splitlines() if r.strip()]
    return righe[-1][:90] if righe else ""


def voci_test() -> list[dict]:
    """pytest e vitest del repo: ✔ se passano, ✘ se falliscono, ? se non girano."""
    from .checks.coerenza import _node  # noqa: PLC0415 - stessa risoluzione di node

    comandi = [("pytest", [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"])]
    node = _node()
    vitest = REPO_ROOT / "node_modules" / "vitest" / "vitest.mjs"
    comandi.append(("vitest", [node, str(vitest), "run"] if node and vitest.exists() else None))
    voci = []
    for nome, cmd in comandi:
        voce = {"area": "test", "id": f"test:{nome}", "nome": nome, "soglia": "exit 0",
                "riparo": f"cd {REPO_ROOT} && " + (" ".join(cmd[1:]) if cmd else nome)}
        if cmd is None:
            voci.append({**voce, "misura": "-", "esito": None, "nota": "non eseguibile qui"})
            continue
        try:
            esito = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True, timeout=900)
        except subprocess.TimeoutExpired:
            voci.append({**voce, "misura": "timeout", "esito": None, "nota": "oltre 900s"})
            continue
        voci.append({**voce, "misura": f"exit {esito.returncode}", "esito": esito.returncode == 0,
                     "nota": _ultima_riga(esito.stdout or esito.stderr)})
    return voci


def stampa(voci: list[dict], info: int) -> None:
    ok = sum(v["esito"] is True for v in voci)
    ko = sum(v["esito"] is False for v in voci)
    ig = sum(v["esito"] is None for v in voci)
    voto = round(ok / len(voci) * 100) if voci else 0
    col = "32" if voto >= 85 else ("33" if voto >= 65 else "31")
    print(_colore(f"\n  CERTIFICAZIONE PRODOTTO — {voto}/100", f"1;{col}"))
    print(_colore(f"  {ok} a posto · {ko} da sistemare · {ig} non misurati "
                  f"(un non misurato NON e' un verde) · {info} KPI senza soglia esclusi\n", "90"))
    aree = list(dict.fromkeys(v["area"] for v in voci))
    for area in aree:
        print(_colore(f"  {area.upper()}", "1"))
        for v in (x for x in voci if x["area"] == area):
            seg = _colore("✔", "32") if v["esito"] is True else \
                (_colore("✘", "31") if v["esito"] is False else _colore("?", "33"))
            print(f"   {seg} {str(v['nome'])[:42]:<42} {str(v['misura'])[:26]:<26} "
                  f"{_colore('(atteso ' + str(v['soglia'])[:40] + ')', '90')}")
            if v["esito"] is not True and v["riparo"]:
                print(_colore(f"       → {v['riparo'][:104]}", "90"))
            if v["esito"] is not True and v["nota"]:
                print(_colore(f"       · {v['nota'][:104]}", "90"))
        print()


def codice_uscita(voci: list[dict]) -> int:
    return 0 if voci and all(v["esito"] is True for v in voci) else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lab certifica prodotto",
                                     description="coerenza del prodotto: gli stessi check della torre")
    parser.add_argument("--json", action="store_true", help=f"scrive {DEST_JSON}")
    parser.add_argument("--test", action="store_true", help="esegue anche pytest e vitest")
    args = parser.parse_args(argv)  # argomento sconosciuto -> exit 2

    try:
        _dsn()
    except ValueError as exc:
        # Senza DB i check del registro esplodono gia' alla costruzione della
        # lista (pipeline._providers): un traceback non dice cosa fare.
        print(f"lab certifica prodotto: {exc}: lancia dalla vetrina "
              "(~/Desktop/agentic-markets) o passala nell'ambiente", file=sys.stderr)
        return 1
    lista = all_checks()
    voci, info = voci_da_verdetti(lista, run_checks(lista))
    if args.test:
        voci += voci_test()

    if args.json:
        ok = sum(v["esito"] is True for v in voci)
        DEST_JSON.parent.mkdir(parents=True, exist_ok=True)
        DEST_JSON.write_text(json.dumps({
            "generato": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
            "voto": round(ok / len(voci) * 100) if voci else 0, "ok": ok,
            "ko": sum(v["esito"] is False for v in voci),
            "non_misurati": sum(v["esito"] is None for v in voci),
            "totale": len(voci), "info_esclusi": info, "voci": voci,
        }, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
        print(DEST_JSON)
    else:
        stampa(voci, info)
    return codice_uscita(voci)


if __name__ == "__main__":
    sys.exit(main())
