// app/api/cron/analytics-retention/route.ts — #RETENTION-ANALYTICS-0915
//
// Applica il termine del registro dei trattamenti (voce «Analytics di prodotto
// (BetRedge)»): l'identificatore di sessione degli eventi di analytics vive 14
// mesi, poi viene azzerato. Le RIGHE restano — servono come conteggio
// aggregato e senza `session_id` non sono piu' collegabili fra loro, quindi
// non sono piu' un dato personale (Cons. 26 GDPR).
//
// Perche' conteggio-poi-UPDATE e non un UPDATE che si conta da solo:
// `exec_sql` avvolge ogni statement in `SELECT ... FROM (<stmt>) t`, wrapper
// invalido per una scrittura; la funzione intercetta l'errore, riesegue lo
// statement nudo e restituisce SEMPRE '[]'. Vale anche per un CTE
// `WITH ... (UPDATE ... RETURNING) SELECT count(*)`, che dentro una subquery
// non e' piu' un WITH di primo livello — provato contro il DB di produzione il
// 15/09: risposta `[]`. Quindi il row-count non esiste: si contano le righe
// prima, si scrive, e si ricontano dopo. Il secondo conteggio e' la verifica,
// non una formalita': un job di retention che fallisce in silenzio lascia
// pubblicato su /privacy un termine che nulla applica.
import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { dbQueryStrict, dbExecute } from "@/lib/db";
import {
  ANALYTICS_SESSION_RETENTION_INTERVAL,
  expiredPseudonymousRows,
  unclassifiedExpiredRows,
  type SqlFragment,
} from "@/lib/analytics-events";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const countRows = async (f: SqlFragment): Promise<number> => {
  const rows = await dbQueryStrict<{ n: string }>(
    `SELECT COUNT(*) AS n FROM events WHERE ${f.where}`,
    f.params
  );
  return Number(rows[0]?.n ?? 0);
};

export async function GET(req: NextRequest) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ?dry=1 — conta e basta, nessuna scrittura. Serve a verificare il
  // cablaggio del cron senza toccare una riga.
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const expired = expiredPseudonymousRows();
  const unknown = unclassifiedExpiredRows();

  try {
    const eligible = await countRows(expired);

    // Eventi scaduti con un identificatore che nessuna delle due liste
    // conosce: non li tocchiamo (potrebbero essere ID ordine), ma vanno
    // visti. Silenzio qui = conservazione a tempo indeterminato invisibile.
    const unclassified = await dbQueryStrict<{ event_type: string; n: string }>(
      `SELECT event_type, COUNT(*) AS n FROM events WHERE ${unknown.where}
       GROUP BY event_type ORDER BY n DESC LIMIT 20`,
      unknown.params
    );
    if (unclassified.length > 0) {
      console.warn(
        "[cron/analytics-retention] event_type non classificati oltre i 14 mesi:",
        unclassified.map((r) => `${r.event_type}=${r.n}`).join(", ")
      );
    }

    const body = {
      retention: ANALYTICS_SESSION_RETENTION_INTERVAL,
      eligible,
      unclassified: unclassified.map((r) => ({ event_type: r.event_type, n: Number(r.n) })),
      ran_at: new Date().toISOString(),
    };

    if (dryRun) {
      return NextResponse.json({ ...body, dry_run: true, purged: 0 });
    }

    if (eligible > 0) {
      await dbExecute(
        `UPDATE events SET session_id = NULL WHERE ${expired.where}`,
        expired.params
      );
    }

    const remaining = await countRows(expired);
    if (remaining > 0) {
      // La scrittura non ha fatto quello che doveva. 500 perche' il cron di
      // Vercel lo segnali: il modo peggiore di rompersi e' un 200 che dice
      // "ripulito" mentre gli identificatori sono ancora li'.
      console.error(
        `[cron/analytics-retention] purge incompleto: ${remaining} righe ancora con session_id oltre i ${ANALYTICS_SESSION_RETENTION_INTERVAL}`
      );
      return NextResponse.json(
        { ...body, error: "purge_incomplete", purged: eligible - remaining, remaining },
        { status: 500 }
      );
    }

    return NextResponse.json({ ...body, purged: eligible, remaining: 0 });
  } catch (e) {
    console.error("[cron/analytics-retention] failed:", String(e));
    return NextResponse.json({ error: "retention_failed", detail: String(e) }, { status: 500 });
  }
}
