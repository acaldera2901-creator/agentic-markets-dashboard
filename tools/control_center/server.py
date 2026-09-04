"""Il server della pagina. Legge lo snapshot, mai le fonti."""

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .actions import (
    RESTARTABLE,
    ensure_token,
    jobs_stato,
    leggi_report,
    request_diagnosis,
    PERSONALI,
    ali_disponibili,
    apri_personale,
    apri_prodotto,
    apri_ala,
    restart_daemon,
    start_daemon,
    stop_daemon,
)
from . import council, sala
from .snapshot import HISTORY_FILE, STATE_FILE, read_state

HOST = "127.0.0.1"
PORT = 8790
STATIC = Path(__file__).resolve().parent / "static"
PAGE = STATIC / "index.html"          # la home: un piano unico, tutti i settori
# Le vecchie pagine sono diventate settori del piano: chi arriva dai vecchi
# indirizzi viene portato al settore giusto, non su un 404.
REDIRECT = {
    "/betredge": "/#sistema", "/betredge.html": "/#sistema",
    "/sala": "/#sala",
    "/architettura.html": "/#architettura",
}
# Font vendorizzati: la torre e' locale e deve aprirsi anche senza rete.
# Lista chiusa di nomi, nessuna mappatura path->file: niente traversal.
FONTS = {
    "/vendor/fonts/saira.woff2": STATIC / "vendor/fonts/saira.woff2",
    "/vendor/fonts/jetbrains-mono.woff2": STATIC / "vendor/fonts/jetbrains-mono.woff2",
}
HISTORY_LIMIT = 500


class Handler(BaseHTTPRequestHandler):
    server_version = "betredge-cc"

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _autorizzato(self) -> bool:
        """Token piu' controllo dell'Origin.

        Il loopback da solo non basta: qualsiasi pagina aperta nel browser puo'
        fare una POST verso 127.0.0.1. Il token vive solo nel file di stato e
        nella pagina servita da qui, quindi una pagina di terzi non lo ha.
        """
        origin = self.headers.get("Origin")
        if origin and origin not in self._origini_ammesse():
            return False
        return self.headers.get("X-CC-Token", "") == ensure_token()

    def _origini_ammesse(self) -> set[str]:
        porta = self.server.server_address[1]
        return {f"http://127.0.0.1:{porta}", f"http://localhost:{porta}"}

    def do_POST(self) -> None:  # noqa: N802 - firma imposta da BaseHTTPRequestHandler
        if self.path.split("?", 1)[0] != "/api/action":
            self._send(404, b'{"error":"not found"}', "application/json; charset=utf-8")
            return
        if not self._autorizzato():
            self._send(403, b'{"error":"token assente o non valido"}',
                       "application/json; charset=utf-8")
            return
        try:
            lunghezza = int(self.headers.get("Content-Length") or 0)
            corpo = json.loads(self.rfile.read(lunghezza) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send(400, b'{"error":"corpo non valido"}', "application/json; charset=utf-8")
            return

        check_id = str(corpo.get("check_id", ""))
        azione = str(corpo.get("azione", ""))

        if azione in ("archivia", "riapri"):
            # Archiviare NON tocca il Council: e' il nostro giudizio, locale.
            if azione == "archivia":
                esito = council.archivia(str(corpo.get("msg_id", "")),
                                         str(corpo.get("motivo", "")),
                                         str(corpo.get("prova", "")))
            else:
                esito = council.riapri(str(corpo.get("msg_id", "")))
            self._send(200, json.dumps(esito, ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
            return

        if azione == "approva":
            # Lo preme Andrea dal suo Mac: loopback + token. Il messaggio dice
            # da dove arriva, perche' nel Council non esiste un'identita' umana.
            esito = council.approva(str(corpo.get("msg_id", "")),
                                    str(corpo.get("nota", "")))
            self._send(200, json.dumps(esito, ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
            return

        if azione in ("apri_prodotto", "apri_personale"):
            chiave = str(corpo.get("chiave", ""))
            esito = (apri_prodotto(chiave) if azione == "apri_prodotto"
                     else apri_personale(chiave))
            self._send(200, json.dumps(esito, ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
            return

        if azione == "apri":
            # Non e' un check: e' un'ala del lab. Si risponde qui e si esce.
            esito = apri_ala(str(corpo.get("ala", "")))
            self._send(200, json.dumps(esito, ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
            return
        stato = read_state(STATE_FILE)
        check = (stato.get("checks") or {}).get(check_id)
        if check is None:
            self._send(404, b'{"error":"check sconosciuto"}',
                       "application/json; charset=utf-8")
            return

        if azione in ("riavvia", "accendi", "spegni"):
            if check_id not in RESTARTABLE:
                esito = {"ok": False, "errore": "questo check non ha un rimedio meccanico"}
            else:
                esito = {"riavvia": restart_daemon,
                         "accendi": start_daemon,
                         "spegni": stop_daemon}[azione](check_id)
        elif azione == "diagnosi":
            esito = request_diagnosis(check_id, check)
        else:
            esito = {"ok": False, "errore": f"azione non ammessa: {azione!r}"}

        self._send(200, json.dumps(esito, ensure_ascii=False).encode(),
                   "application/json; charset=utf-8")

    def do_GET(self) -> None:  # noqa: N802 - firma imposta da BaseHTTPRequestHandler
        path = self.path.split("?", 1)[0]
        # Whitelist esplicita: nessuna mappatura path->file, quindi nessun
        # traversal possibile per costruzione.
        if path in ("/", "/index.html"):
            # Il token viene iniettato nella pagina servita: cosi' vive solo
            # qui e nel file di stato, mai in un file versionato.
            html = PAGE.read_text(encoding="utf-8").replace(
                "__CC_TOKEN__", ensure_token()
            )
            self._send(200, html.encode(), "text/html; charset=utf-8")
        elif path in REDIRECT:
            self.send_response(302)
            self.send_header("Location", REDIRECT[path])
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path in FONTS:
            f = FONTS[path]
            if not f.exists():
                self._send(404, b"font non installato", "text/plain; charset=utf-8")
                return
            self.send_response(200)
            self.send_header("Content-Type", "font/woff2")
            self.send_header("Content-Length", str(f.stat().st_size))
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            self.end_headers()
            self.wfile.write(f.read_bytes())
        elif path == "/api/azienda":
            # Lo scrive `lab azienda --json`. Se non e' mai girato lo dice,
            # invece di restituire un portafoglio vuoto che sembra "niente in corso".
            f = STATE_FILE.parent / "azienda.json"
            corpo = f.read_bytes() if f.exists() else b'{"assente":true}'
            self._send(200, corpo, "application/json; charset=utf-8")
        elif path == "/api/sala":
            # Dal vivo, non dallo snapshot: il collector gira ogni 5 minuti e
            # una sala "in tempo reale" vecchia di 5 minuti sarebbe una bugia.
            # Costa 43 ms misurati su 3 sessioni (03/09).
            self._send(200, json.dumps(sala.stato(), ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
        elif path == "/api/council":
            # Puo' essere lento (chiama un servizio esterno): la pagina lo
            # carica a parte, non insieme al resto.
            self._send(200, json.dumps(council.stato(), ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
        elif path == "/api/certificazione":
            # Lo scrive `lab certifica --json`. Se non e' mai girata lo dice:
            # una certificazione assente non e' una certificazione superata.
            f = STATE_FILE.parent / "certificazione.json"
            corpo = f.read_bytes() if f.exists() else b'{"assente":true}'
            self._send(200, corpo, "application/json; charset=utf-8")
        elif path == "/api/personali":
            self._send(200, json.dumps(PERSONALI, ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
        elif path == "/api/ali":
            # Le ali del lab, per i pulsanti della pagina.
            self._send(200, json.dumps(ali_disponibili(), ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
        elif path == "/api/lab":
            # Lo scrive `lab stato --json`: se non e' mai girato, si dice, non
            # si finge un oggetto vuoto valido.
            f = STATE_FILE.parent / "lab.json"
            corpo = f.read_bytes() if f.exists() else b'{"assente":true}'
            self._send(200, corpo, "application/json; charset=utf-8")
        elif path == "/api/cervello":
            # Il grafo della memoria, scritto dal collector ogni 5 minuti.
            # Non si calcola qui: camminare 995 file markdown dentro una
            # richiesta HTTP costa 3 secondi a freddo.
            f = STATE_FILE.parent / "cervello.json"
            corpo = f.read_bytes() if f.exists() else b'{"assente":true}'
            self._send(200, corpo, "application/json; charset=utf-8")
        elif path == "/api/state":
            body = json.dumps(read_state(STATE_FILE), ensure_ascii=False).encode()
            self._send(200, body, "application/json; charset=utf-8")
        elif path == "/api/history":
            self._send(200, self._history(), "application/json; charset=utf-8")
        elif path == "/api/jobs":
            self._send(200, json.dumps(jobs_stato(), ensure_ascii=False).encode(),
                       "application/json; charset=utf-8")
        elif path == "/api/report":
            job = parse_qs(urlparse(self.path).query).get("id", [""])[0]
            testo = leggi_report(job)
            if testo is None:
                self._send(404, b'{"error":"report non trovato"}',
                           "application/json; charset=utf-8")
            else:
                self._send(200, testo.encode(), "text/plain; charset=utf-8")
        else:
            self._send(404, b'{"error":"not found"}', "application/json; charset=utf-8")

    def _history(self) -> bytes:
        try:
            righe = Path(HISTORY_FILE).read_text().splitlines()[-HISTORY_LIMIT:]
        except (FileNotFoundError, OSError):
            return b"[]"
        out = []
        for riga in righe:
            try:
                out.append(json.loads(riga))
            except json.JSONDecodeError:
                continue
        return json.dumps(out, ensure_ascii=False).encode()

    def log_message(self, fmt, *args) -> None:
        """Silenzio: il server gira sotto launchd e non deve gonfiare i log."""


def make_server(port: int = PORT) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((HOST, port), Handler)


def main(argv=None) -> int:
    httpd = make_server()
    print(f"control center su http://{HOST}:{httpd.server_address[1]}")
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
