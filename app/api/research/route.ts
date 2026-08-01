import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";

/** GET — recent research summaries (match_id → summary). Stesso gate del POST.
 *
 * #RESEARCH-GET-GATE-0801 — era l'unico verbo aperto di questa route: il POST è
 * default-deny da sempre (`verifyBearer` + secret mancante = chiuso), il GET no.
 * L'asimmetria era stata trovata dall'audit pre-lancio dell'08/06 e il fix era
 * pronto sul branch `michele/prelaunch-fixes`, che non è mai stato deciso — così
 * è rimasta aperta per due mesi.
 *
 * Cosa esponeva: `match_id`, `summary` e `created_at` di ogni ricerca delle
 * ultime 48 ore, cioè il testo generato dall'agente Research, a chiunque
 * conoscesse l'URL. Verificato stasera: oggi risponde `{"research":[]}` perché
 * non ci sono righe recenti — quindi non ha perso nulla finora, ma è una porta
 * che si apre da sola appena l'agente scrive.
 *
 * Nessun consumer client (verificato con grep su app/, components/, lib/): il
 * board legge le ricerche server-side dentro /api/predictions, non da qui.
 * Chiudere il GET non toglie niente a nessuna pagina.
 */
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.RESEARCH_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await dbQuery<{ match_id: string; summary: string; created_at: string }>(
    `SELECT match_id, summary, created_at FROM match_research
     WHERE created_at > NOW() - INTERVAL '48 hours'
     ORDER BY created_at DESC`
  );
  return NextResponse.json({ research: rows });
}

/** POST — stores a research summary from the Python ResearchAgent (Ollama) */
export async function POST(req: Request) {
  // Default-deny: a missing RESEARCH_SECRET must close the endpoint, not open
  // it (same pattern as the cron routes). Unauthenticated writes are never ok.
  if (!verifyBearer(req, process.env.RESEARCH_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { match_id: string; summary: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.match_id || !body.summary) {
    return NextResponse.json({ error: "match_id and summary required" }, { status: 400 });
  }

  await dbQuery(
    `INSERT INTO match_research (match_id, summary, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (match_id) DO UPDATE SET summary = EXCLUDED.summary, created_at = NOW()`,
    [body.match_id, body.summary]
  );

  return NextResponse.json({ ok: true });
}
