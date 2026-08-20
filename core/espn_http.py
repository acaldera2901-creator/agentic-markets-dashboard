"""Un solo posto dove si decide COME si parla a ESPN (#ESPN-UA-403-0820).

Esisteva in otto copie sparse — cinque in Python, tre in TypeScript — ognuna col
suo host e il suo User-Agent inventato. Il 20/08 quella dispersione e' costata un
board tennis dimezzato per quindici giorni: il fix di una copia non toccava le
altre sette, e nessuno sapeva quante fossero.

## I due host

ESPN espone la STESSA site-API su due hostname:

    site.api.espn.com        <- ha un WAF che filtra sullo User-Agent
    site.web.api.espn.com    <- nessun filtro

Misurato il 2026-08-20 sullo stesso path (`.../tennis/atp/scoreboard?dates=
20260820`): payload **identici** — 262 match singolari, stessi id, stesse date,
stessi stati, stesse chiavi top-level. Non e' una API ridotta: e' la stessa,
davanti a una porta senza buttafuori.

## Perche' non si combatte col User-Agent

Sull'host filtrato la regola non e' documentata e NON e' un semplice "contiene un
token di client noto". Misurato 4/4 deterministico per riga:

    curl/8.6.0                        -> 200
    BetRedge/1.0 curl/8.6.0           -> 403   <- lo stesso token, prefissato
    python-httpx/0.28.1               -> 200
    BetRedge/1.0 python-httpx/0.28.1  -> 200   <- qui il prefisso passa
    axios/1.7.2                       -> 200
    undici/6.19.8 · node-fetch/3.3.2  -> 403
    Mozilla/5.0 (qualunque) · nessuno UA -> 403

Cioe': ogni token ha una regola sua, e le regole cambiano quando vuole Akamai.
Inseguirle vuol dire riscrivere questo file ogni volta che ESPN gira una
manopola, e scoprirlo dal board vuoto. Per questo la scelta e' **l'host senza
filtro + uno User-Agent che dice la verita' su chi siamo**, non uno UA
camuffato da client riconosciuto.

Guardia meccanica: `tests/test_espn_host_no_residues.py` fallisce se
`site.api.espn.com` ricompare da qualsiasi parte nel repo fuori da qui.
"""
from __future__ import annotations

# Host senza WAF. Stesso payload dell'host filtrato — vedi il docstring.
ESPN_SITE_API = "https://site.web.api.espn.com/apis/site/v2/sports"
# L'endpoint `apis/v2/...` (standings, scoreboard/header) sta sotto un prefisso
# diverso dello stesso host.
ESPN_V2_API = "https://site.web.api.espn.com/apis/v2"

# Ci identifichiamo per quello che siamo: su questo host non serve altro, e uno
# UA onesto e' l'unico che non scade quando ESPN cambia le sue regole.
ESPN_HEADERS = {"User-Agent": "BetRedge/1.0 (+https://betredge.com)"}
