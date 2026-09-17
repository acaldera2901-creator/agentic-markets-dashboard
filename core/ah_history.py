"""#AH-PERSISTENZA-0917 — scrive su `ah_odds_history` quello che finora finiva
solo nello stream Redis `ah:odds`.

Due regole, entrambe imparate a spese nostre:

1. **Una riga senza chiave di join non e' un dato, e' zavorra.** I record
   dell'AHCollector non portavano l'orario di inizio, quindi non erano
   agganciabili ne' a una pick ne' a un prezzo. Qui una riga senza
   `commence_time` o senza `team_pair_key` viene SCARTATA e contata: meglio una
   tabella piu' piccola e interrogabile che una grande e inservibile.

2. **Il conteggio si scrive, non si deduce.** Chi scarta deve dire quanto ha
   scartato: un collector che non riporta niente e' indistinguibile da uno che
   non raccoglie niente (lezione #SILENZIO-COME-ASSENZA).
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from core.odds_api_client import football_pair_key
from core.supabase_client import _rest_base, _service_headers

logger = logging.getLogger("ah_history")

TABLE = "ah_odds_history"


@dataclass
class EsitoAh:
    """Cosa e' successo in un giro. Si logga e finisce nell'heartbeat."""
    visti: int = 0
    candidati: int = 0
    scartati_senza_inizio: int = 0
    scartati_senza_chiave: int = 0
    scartati_senza_prezzo: int = 0
    scartati_linea_alt: int = 0
    scritti: int = 0
    falliti: int = 0

    def compatto(self) -> dict:
        return {
            "visti": self.visti,
            "scritti": self.scritti,
            "scartati": self.scartati_senza_inizio
            + self.scartati_senza_chiave
            + self.scartati_senza_prezzo
            + self.scartati_linea_alt,
            "falliti": self.falliti,
        }


def _num(v) -> float | None:
    """Le fonti mandano i prezzi come stringa. Un prezzo <= 1.0 non e' un prezzo."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):
        return None
    return f


def _quota(v) -> float | None:
    f = _num(v)
    return f if f is not None and f > 1.0 else None


def _istante(valore) -> datetime | None:
    if not valore:
        return None
    try:
        dt = datetime.fromisoformat(str(valore).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def costruisci_righe(
    records: list[dict], adesso: datetime | None = None
) -> tuple[list[dict], EsitoAh]:
    """Proietta i record dello stream sulle colonne di `ah_odds_history`.

    Funzione pura: nessuna rete, nessun DB. E' qui che vivono i test.
    """
    adesso = adesso or datetime.now(timezone.utc)
    esito = EsitoAh()
    righe: list[dict] = []

    for rec in records or []:
        esito.visti += 1

        # Solo la linea principale. Le altLines di Pinnacle moltiplicano le
        # righe per dieci-venti senza aggiungere la cosa che si vuole misurare:
        # il movimento della linea di riferimento. Le fonti che emettono una
        # sola linea non marcano il campo -> valgono come principale.
        if not rec.get("is_main_line", True):
            esito.scartati_linea_alt += 1
            continue

        inizio = _istante(rec.get("commence_time"))
        if inizio is None:
            esito.scartati_senza_inizio += 1
            continue
        # Una partita gia' cominciata non e' un prezzo pre-partita: misurarci un
        # movimento di linea significherebbe misurare il punteggio.
        if inizio <= adesso:
            esito.scartati_senza_inizio += 1
            continue

        chiave = football_pair_key(
            rec.get("home_team") or "", rec.get("away_team") or "", inizio.isoformat()
        )
        if not chiave:
            esito.scartati_senza_chiave += 1
            continue

        casa = _quota(rec.get("ah_odds_home"))
        ospite = _quota(rec.get("ah_odds_away"))
        if casa is None or ospite is None:
            esito.scartati_senza_prezzo += 1
            continue

        esito.candidati += 1
        righe.append(
            {
                "team_pair_key": chiave,
                "match_id": str(rec.get("match_id") or "") or None,
                "source": str(rec.get("source") or "sconosciuta"),
                "sport": str(rec.get("sport") or "soccer"),
                "league": str(rec.get("league") or "") or None,
                "home_name": rec.get("home_team") or None,
                "away_name": rec.get("away_team") or None,
                "ah_line": _num(rec.get("ah_line")),
                "ah_odds_home": casa,
                "ah_odds_away": ospite,
                "commence_time": inizio.isoformat(),
                "captured_at": adesso.isoformat(),
                "minuti_al_via": int(round((inizio - adesso).total_seconds() / 60)),
            }
        )

    return righe, esito


async def scrivi_storia_ah(
    records: list[dict], adesso: datetime | None = None
) -> EsitoAh:
    """Costruisce le righe e le inserisce. Fail-soft: non alza mai."""
    righe, esito = costruisci_righe(records, adesso)
    if not righe:
        return esito

    base = _rest_base()
    if not base:
        # Nessuna configurazione Supabase: non e' un errore, e' un ambiente
        # senza DB (test, locale). Le righe scartate restano contate.
        logger.debug("ah_history: Supabase non configurato, %d righe non scritte", len(righe))
        return esito

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{base}/{TABLE}", json=righe, headers=_service_headers()
            )
            if resp.status_code in (200, 201, 204):
                esito.scritti = len(righe)
            else:
                esito.falliti = len(righe)
                logger.warning(
                    "ah_history insert fallito: %s %s",
                    resp.status_code,
                    resp.text[:200],
                )
    except Exception as exc:  # rete giu', timeout, DNS: mai far cadere l'agente
        esito.falliti = len(righe)
        logger.warning("ah_history insert error: %s", exc)

    return esito
