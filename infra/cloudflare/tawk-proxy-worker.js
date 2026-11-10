// tawk-proxy-worker.js — Cloudflare Worker (#CHAT-PROXY-VPN)
// ---------------------------------------------------------------------------
// PERCHÉ: le VPN con filtro anti-tracker/anti-malware (NordVPN Threat Protection,
// Proton NetShield, AdGuard DNS, Mullvad blocklist…) bloccano *.tawk.to SUL
// DISPOSITIVO dell'utente → il widget di supporto non appare. Il blocco è
// client-side (DNS/tracker), non del nostro backend. Servendo il widget dal NOSTRO
// dominio (che le VPN non bloccano) la chat funziona anche con VPN attiva.
//
// COME: reverse-proxy dei sottodomini *.tawk.to sotto chat.betredge.com con schema
//   https://chat.betredge.com/__tk/<host>/<path...>  ->  https://<host>/<path...>
// Il Worker riscrive TUTTI i riferimenti *.tawk.to nei body testuali (JS/JSON/HTML/
// CSS) in /__tk/<host>/… così anche le richieste RUNTIME del widget (XHR, iframe,
// websocket) restano sul proxy. Gestisce anche il canale WebSocket (wss).
//
// SICUREZZA: proxa SOLO host che matchano ^<sub>.tawk.to$ → non è un open-proxy.
//
// DEPLOY (lane Maven/Cloudflare, zona betredge.com — non tocca apex/www/email):
//   1) DNS: record A  `chat`  ->  IP arbitrario (es. 192.0.2.1)  ·  Proxied (nuvola arancione ON)
//   2) Workers & Pages: nuovo Worker (es. `tawk-proxy`) con questo codice
//   3) Worker → Settings → Triggers → Route:  chat.betredge.com/*   (zona betredge.com)
//   4) Test:  https://chat.betredge.com/__tk/embed.tawk.to/6a3ac896707bc21d4a185b17/1jrqpv3j1
//             deve restituire lo script embed di Tawk (200, content-type javascript).
//   5) Vercel (prod, team betredge): env  NEXT_PUBLIC_TAWK_PROXY_HOST=chat.betredge.com  → redeploy.
//
// ROLLBACK ISTANTANEO: rimuovi l'env NEXT_PUBLIC_TAWK_PROXY_HOST + redeploy → il
// widget torna a caricare da embed.tawk.to. Il Worker/DNS restano innocui.
//
// ⚠️ DA VERIFICARE LIVE (con VPN anti-tracker attiva): se il minified di Tawk
// costruisce qualche host dinamicamente (concatenazione "sub" + ".tawk.to") quelle
// chiamate potrebbero sfuggire alla riscrittura e restare su *.tawk.to → bloccate.
// In tal caso: guardare i request in DevTools/Network, aggiungere il pattern
// mancante alla riscrittura sotto. Consigliato un fallback "Contattaci" nel client
// come garanzia (vedi handoff council #CHAT-PROXY-VPN).
// ---------------------------------------------------------------------------

const SELF_HOST = "chat.betredge.com";
const PREFIX = "/__tk/";
const TAWK_HOST_RE = /^[a-z0-9-]+\.tawk\.to$/i;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith(PREFIX)) {
      return new Response("Not found", { status: 404 });
    }

    // /__tk/<host>/<rest...>
    const rest = url.pathname.slice(PREFIX.length);
    const slash = rest.indexOf("/");
    const upstreamHost = slash === -1 ? rest : rest.slice(0, slash);
    const upstreamPath = slash === -1 ? "/" : rest.slice(slash);

    if (!TAWK_HOST_RE.test(upstreamHost)) {
      return new Response("Forbidden host", { status: 403 });
    }

    const upstreamUrl = `https://${upstreamHost}${upstreamPath}${url.search}`;

    // WebSocket passthrough (canale live della chat).
    if ((request.headers.get("Upgrade") || "").toLowerCase() === "websocket") {
      return fetch(upstreamUrl, request);
    }

    const upstreamReq = new Request(upstreamUrl, request);
    upstreamReq.headers.set("Host", upstreamHost);
    const resp = await fetch(upstreamReq);

    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    const rewritable = /text\/|javascript|json|xml|css/.test(ct);

    const headers = new Headers(resp.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.delete("Content-Security-Policy");
    headers.delete("Content-Security-Policy-Report-Only");
    headers.delete("X-Frame-Options");
    // fetch() ha già decompresso il body: togli gli header che ingannerebbero il browser.
    headers.delete("Content-Encoding");
    headers.delete("Content-Length");

    if (!rewritable) {
      return new Response(resp.body, { status: resp.status, headers });
    }

    let body = await resp.text();
    // Riscrivi ogni riferimento *.tawk.to → /__tk/<host>/ sul nostro dominio.
    // Copre: https://, wss://, protocol-relative //, e JSON-escaped https:\/\/.
    body = body
      .replace(/https:\/\/([a-z0-9-]+\.tawk\.to)/gi, `https://${SELF_HOST}${PREFIX}$1`)
      .replace(/wss:\/\/([a-z0-9-]+\.tawk\.to)/gi, `wss://${SELF_HOST}${PREFIX}$1`)
      .replace(/https:\\\/\\\/([a-z0-9-]+\.tawk\.to)/gi, `https:\\/\\/${SELF_HOST}${PREFIX}$1`)
      .replace(/(^|[^a-z:\\])\/\/([a-z0-9-]+\.tawk\.to)/gi, `$1//${SELF_HOST}${PREFIX}$2`);

    return new Response(body, { status: resp.status, headers });
  },
};
