// Test only. One local HTTP server that plays two parts:
//  · PostgREST for the single RPC the app uses: POST /rest/v1/rpc/exec_sql → the
//    repo's exec_sql() on the LOCAL Postgres (so readiness.mjs and lib/db work);
//  · a stub of the deployed site with the responses passo5/7/9 check. It proves the
//    scripts' logic only, not the real site.
//   node stub-server.mjs <port> <local postgres url>
import http from "node:http";
import postgres from "postgres";

const [port, pgUrl] = process.argv.slice(2);
if (!/^postgres:\/\/[^@]+@(127\.0\.0\.1|localhost):/.test(pgUrl ?? "")) { console.error("solo Postgres locale"); process.exit(2); }
const sql = postgres(pgUrl, { max: 2, onnotice: () => {} });
const V3 = "aff-2026-10-22-v3";
const pages = {
  "/affiliates/terms": `<p>Version <!-- -->${V3}<!-- --> · 22 October 2026 … section 7A applies 30 days after we notify them</p>`,
  "/privacy": `<li><strong>am_ref</strong> (localStorage)</li><footer>18+ Terms Privacy</footer>`,
  "/terms": `<footer>18+ Terms Privacy Affiliate terms</footer>`,
  "/sitemap.xml": `<urlset><url><loc>https://www.betredge.com/invite</loc></url></urlset>`,
  "/invite": `<h1>Invite</h1>`,
};
const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer /, "");
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const send = (code, body, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
  if (req.method === "POST" && u.pathname === "/rest/v1/rpc/exec_sql") {
    let b = ""; for await (const c of req) b += c;
    try { const r = await sql.unsafe("SELECT exec_sql($1) AS r", [JSON.parse(b).query]); return send(200, r[0].r ?? []); }
    catch (e) { return send(400, { message: String(e.message ?? e) }); }
  }
  if (pages[u.pathname]) return send(200, pages[u.pathname], { "content-type": "text/html" });
  if (u.pathname === "/api/affiliate/me") return send(401, { error: "login required" });
  if (u.pathname.startsWith("/api/cron/affiliate-")) {
    if (bearer(req) !== "cron-test") return send(401, { error: "unauthorized" });
    if (u.pathname.endsWith("clicks-retention")) return send(200, { ok: true, purged: 0, retention_days: 90 });
    return send(200, { ok: true, checked: 0, written: 0, reasons: {} });
  }
  if (u.pathname === "/api/admin/affiliate/export") return bearer(req) === "admin-test" ? send(200, []) : send(401, { error: "unauthorized" });
  if (u.pathname.startsWith("/r/")) return send(302, "", { location: `/?ref=${u.pathname.slice(3)}&utm_source=${u.searchParams.get("utm_source")}`, "cache-control": "private, no-store" });
  send(404, { error: "not found" });
}).listen(Number(port), "127.0.0.1", () => console.log(`stub su 127.0.0.1:${port}`));
