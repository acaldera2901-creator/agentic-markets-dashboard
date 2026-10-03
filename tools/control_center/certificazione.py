"""Il voto di certificazione del prodotto: UN solo calcolo, due chiamanti.

`lab certifica prodotto` (certifica_prodotto.py) e il sigillo della torre
(rimedi.sigillo) devono dire lo stesso numero. Prima non lo facevano: la torre
contava i check (28 su 40) e il comando espandeva il registro dei claim in una
voce per claim (43/100): due voti per la stessa cosa, e il primo che qualcuno
confrontava faceva dubitare di entrambi.

Qui vive solo la parte pura: da una lista di check (dizionari) alle *voci* del
referto, e dalle voci al voto. Niente rete, niente DB: lo importano anche i
test e la pagina.

  esito True = a posto · False = rosso o ambra · None = non misurato
  (un non misurato NON e' un verde: conta nel totale e abbassa il voto).
  I KPI senza giudizio (livello `info`) non sono controlli: si contano e basta.
"""

from __future__ import annotations

ESITO = {"green": True, "red": False, "amber": False, "unknown": None}


def voci_da_dizionari(righe) -> tuple[list[dict], int]:
    """`righe`: dict con id, nome, group, level, value, headline, evidence.
    Ritorna (voci del referto, numero di KPI info esclusi)."""
    voci, info = [], 0
    for r in righe:
        level = r.get("level")
        if level == "info":
            info += 1
            continue
        prova = r.get("evidence") or {}
        claims = prova.get("claims") if r.get("id") == "claim_registry" else None
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
        value = r.get("value")
        headline = r.get("headline")
        voci.append({
            "area": r.get("group"), "id": r.get("id"), "nome": r.get("nome") or r.get("id"),
            "misura": value if value is not None else "-",
            "soglia": prova.get("soglia", "verde"),
            "esito": ESITO.get(level),
            "riparo": prova.get("riparo", ""),
            "nota": f"ambra: {headline}" if level == "amber" else headline,
        })
    return voci, info


def conteggi(voci: list[dict]) -> dict:
    ok = sum(v["esito"] is True for v in voci)
    ko = sum(v["esito"] is False for v in voci)
    nm = sum(v["esito"] is None for v in voci)
    return {"ok": ok, "ko": ko, "non_misurati": nm, "totale": len(voci),
            "voto": round(ok / len(voci) * 100) if voci else 0}
