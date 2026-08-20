"""Il server della pagina. Legge lo snapshot, mai le fonti."""

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .snapshot import HISTORY_FILE, STATE_FILE, read_state

HOST = "127.0.0.1"
PORT = 8790
PAGE = Path(__file__).resolve().parent / "static" / "index.html"
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

    def do_GET(self) -> None:  # noqa: N802 - firma imposta da BaseHTTPRequestHandler
        path = self.path.split("?", 1)[0]
        # Whitelist esplicita di tre percorsi: nessuna mappatura path->file,
        # quindi nessun traversal possibile per costruzione.
        if path in ("/", "/index.html"):
            self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
        elif path == "/api/state":
            body = json.dumps(read_state(STATE_FILE), ensure_ascii=False).encode()
            self._send(200, body, "application/json; charset=utf-8")
        elif path == "/api/history":
            self._send(200, self._history(), "application/json; charset=utf-8")
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
