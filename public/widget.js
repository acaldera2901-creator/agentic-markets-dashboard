/*! BetRedge embed widget — #WIDGET-EMBED-0824
 *  Uso:
 *  <script src="https://www.betredge.com/widget.js" async
 *          data-ref="CODICE" data-sport="tennis" data-limit="3"
 *          data-lang="it" data-theme="auto"></script>
 *
 *  È l'unico codice nostro che gira sul sito del partner: nessun global,
 *  nessun cookie, nessuno storage, nessuna lettura del DOM ospite.
 */
(function () {
  "use strict";

  // Con un tag manager che valuta il codice (eval), currentScript è null: si
  // ricade sul primo tag non ancora servito, in ordine di documento.
  var tag = document.currentScript;
  if (!tag || tag.getAttribute("data-br-done")) {
    tag = document.querySelector('script[src*="widget.js"]:not([data-br-done])');
  }
  if (!tag) return;
  tag.setAttribute("data-br-done", "1");

  var MIN_H = 120, MAX_H = 2000;
  var base;
  try {
    base = new URL(tag.getAttribute("src"), window.location.href);
  } catch (e) {
    return;
  }

  var url = new URL("/embed", base.origin);
  var pass = ["ref", "sport", "limit", "lang", "theme"];
  for (var i = 0; i < pass.length; i++) {
    var v = tag.getAttribute("data-" + pass[i]);
    if (v) url.searchParams.set(pass[i], v);
  }
  // L'hostname serve a sapere QUALE sito converte. È dichiarato dal client come
  // ogni altro dato di analytics: buono per misurare, mai per decidere accessi.
  url.searchParams.set("host", window.location.hostname);

  var iframe = document.createElement("iframe");
  iframe.src = url.toString();
  iframe.title = "BetRedge — pronostici";
  iframe.loading = "lazy";
  // allow-same-origin serve al widget per parlare con la NOSTRA API dalla sua
  // origin; non è la origin dell'ospite, quindi non apre nulla su di lui.
  // Niente allow-top-navigation: il widget non può portarsi via la pagina del
  // partner, i link si aprono in una scheda nuova (allow-popups).
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
  iframe.setAttribute("scrolling", "no");
  iframe.style.cssText = "display:block;width:100%;border:0;overflow:hidden;height:" +
    Math.max(MIN_H, parseInt(tag.getAttribute("data-height") || "0", 10) || 260) + "px";

  tag.parentNode.insertBefore(iframe, tag.nextSibling);

  window.addEventListener("message", function (ev) {
    if (ev.source !== iframe.contentWindow) return;      // solo dal NOSTRO iframe
    if (ev.origin !== base.origin) return;               // e solo dalla nostra origin
    var d = ev.data;
    if (!d || d.type !== "betredge-embed-height") return;
    var h = parseInt(d.height, 10);
    if (!isFinite(h)) return;
    iframe.style.height = Math.min(MAX_H, Math.max(MIN_H, h)) + "px";
  });
})();
