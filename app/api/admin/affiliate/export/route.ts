// /api/admin/affiliate/export — #AFFILIATE-OPS-1022 (B2, B3, B4)
// GET ?kind=affiliates|commissions|attributions|payouts|clicks|actions
//     [&format=json|csv] [&affiliate_id=N] [&status=…] [&from=YYYY-MM-DD] [&to=YYYY-MM-DD]
// Sola lettura, auth admin. La base di pagamento è il ledger (affiliate_commissions),
// non profiles.referred_by. Contiene dati personali (email di affiliati e
// referiti): il backoffice la espone solo ai ruoli owner/admin. Max 5000 righe
// (`truncated: true` se ce ne sono di più: restringere con i filtri). Righe dalla
// più recente (review indipendente P2-7): se si tronca, cadono le più vecchie.
import { NextResponse, type NextRequest } from "next/server";
import { dbQueryStrict } from "@/lib/db";
import { csvCell } from "@/lib/affiliate/admin-ops";
import { adminGuard } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

const LIMIT = 5000;
const DAY = /^20[2-9][0-9]-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const STATUS = /^[a-z_]{2,20}$/;

// $1 affiliate_id, $2 status, $3 from, $4 to (NULL = nessun filtro). Niente `$`
// letterali nelle query: interpolate li sostituirebbe.
// Ordine delle colonne CSV: dichiarato in COLUMNS, perché exec_sql restituisce
// jsonb e jsonb riordina le chiavi.
const COLUMNS: Record<string, string[]> = {
  affiliates: ["affiliate_id", "code", "identifier", "status", "created_at", "terms_version", "payee_country", "referred_valid", "referred_fraud_review", "shadow_usd", "pending_usd", "payable_usd", "in_payout_usd", "paid_usd", "clicks_30d", "wallet_id", "coin", "network", "usable_after", "screening_result", "screened_at", "screened_by"],
  commissions: ["id", "affiliate_id", "code", "referred_identifier", "rail", "rail_payment_ref", "rail_event_ref", "kind", "gross_usd", "net_usd", "rate", "amount_usd", "renewal_index", "status", "paid_at", "payable_after", "reverses_id", "payout_id", "created_at"],
  attributions: ["referred_identifier", "affiliate_id", "code", "source", "attributed_at", "status", "status_reason"],
  payouts: ["id", "affiliate_id", "code", "period_month", "amount_usd", "coin", "network", "to_address", "status", "tx_hash", "amount_coin", "created_by", "created_at", "sent_marked_at", "sent_marked_by", "submitted_at", "paid_at", "cancel_code", "cancel_reason"],
  clicks: ["day", "affiliate_id", "code", "utm_source", "utm_campaign", "clicks", "unique_ip_day"],
  actions: ["id", "at", "actor", "action", "affiliate_id", "target", "reason", "detail"],
};
const QUERIES: Record<string, string> = {
  affiliates: `
    SELECT a.id AS affiliate_id, a.code, a.identifier, a.status, a.created_at, a.terms_version, a.payee_country,
           (SELECT count(*) FROM affiliate_attributions t WHERE t.affiliate_id = a.id AND t.status = 'valid') AS referred_valid,
           (SELECT count(*) FROM affiliate_attributions t WHERE t.affiliate_id = a.id AND t.status = 'fraud_review') AS referred_fraud_review,
           COALESCE(s.shadow, 0) AS shadow_usd, COALESCE(s.pending, 0) AS pending_usd, COALESCE(s.payable, 0) AS payable_usd,
           COALESCE(s.in_payout, 0) AS in_payout_usd, COALESCE(s.paid, 0) AS paid_usd,
           (SELECT count(*) FROM affiliate_referral_clicks k WHERE k.affiliate_id = a.id AND k.clicked_at > now() - interval '30 days') AS clicks_30d,
           w.id AS wallet_id, w.coin, w.network, w.usable_after, w.screening_result, w.screened_at, w.screened_by
      FROM affiliates a
      LEFT JOIN LATERAL (
        SELECT SUM(amount_usd) FILTER (WHERE status = 'shadow') AS shadow,
               SUM(amount_usd) FILTER (WHERE status = 'pending') AS pending,
               SUM(amount_usd) FILTER (WHERE status = 'payable') AS payable,
               SUM(amount_usd) FILTER (WHERE status = 'in_payout') AS in_payout,
               SUM(amount_usd) FILTER (WHERE status = 'paid') AS paid
          FROM affiliate_commissions c WHERE c.affiliate_id = a.id
      ) s ON true
      LEFT JOIN affiliate_wallets w ON w.affiliate_id = a.id AND w.revoked_at IS NULL
     WHERE ($1::bigint IS NULL OR a.id = $1::bigint) AND ($2::text IS NULL OR a.status = $2::text)
       AND ($3::date IS NULL OR a.created_at >= $3::date) AND ($4::date IS NULL OR a.created_at < $4::date + 1)
     ORDER BY a.id DESC`,
  commissions: `
    SELECT c.id, c.affiliate_id, a.code, c.referred_identifier, c.rail, c.rail_payment_ref, c.rail_event_ref, c.kind,
           c.gross_usd, c.net_usd, c.rate, c.amount_usd, c.renewal_index, c.status, c.paid_at, c.payable_after,
           c.reverses_id, c.payout_id, c.created_at
      FROM affiliate_commissions c JOIN affiliates a ON a.id = c.affiliate_id
     WHERE ($1::bigint IS NULL OR c.affiliate_id = $1::bigint) AND ($2::text IS NULL OR c.status = $2::text)
       AND ($3::date IS NULL OR c.paid_at >= $3::date) AND ($4::date IS NULL OR c.paid_at < $4::date + 1)
     ORDER BY c.id DESC`,
  attributions: `
    SELECT t.referred_identifier, t.affiliate_id, a.code, t.source, t.attributed_at, t.status, t.status_reason
      FROM affiliate_attributions t JOIN affiliates a ON a.id = t.affiliate_id
     WHERE ($1::bigint IS NULL OR t.affiliate_id = $1::bigint) AND ($2::text IS NULL OR t.status = $2::text)
       AND ($3::date IS NULL OR t.attributed_at >= $3::date) AND ($4::date IS NULL OR t.attributed_at < $4::date + 1)
     ORDER BY t.attributed_at DESC`,
  payouts: `
    SELECT p.id, p.affiliate_id, a.code, p.period_month, p.amount_usd, p.coin, p.network, p.to_address, p.status,
           p.tx_hash, p.amount_coin, p.created_by, p.created_at, p.sent_marked_at, p.sent_marked_by,
           p.submitted_at, p.paid_at, p.cancel_code, p.cancel_reason
      FROM affiliate_payouts p JOIN affiliates a ON a.id = p.affiliate_id
     WHERE ($1::bigint IS NULL OR p.affiliate_id = $1::bigint) AND ($2::text IS NULL OR p.status = $2::text)
       AND ($3::date IS NULL OR p.created_at >= $3::date) AND ($4::date IS NULL OR p.created_at < $4::date + 1)
     ORDER BY p.id DESC`,
  clicks: `
    SELECT (k.clicked_at AT TIME ZONE 'UTC')::date AS day, k.affiliate_id, a.code,
           substring(k.landing from '[?&]utm_source=([^&]*)') AS utm_source,
           substring(k.landing from '[?&]utm_campaign=([^&]*)') AS utm_campaign,
           count(*) AS clicks, count(DISTINCT k.ip_hash) AS unique_ip_day
      FROM affiliate_referral_clicks k JOIN affiliates a ON a.id = k.affiliate_id
     WHERE ($1::bigint IS NULL OR k.affiliate_id = $1::bigint)
       AND ($3::date IS NULL OR k.clicked_at >= $3::date) AND ($4::date IS NULL OR k.clicked_at < $4::date + 1)
     GROUP BY 1, 2, 3, 4, 5
     ORDER BY 1 DESC, 2`,
  actions: `
    SELECT id, at, actor, action, affiliate_id, target, reason, detail
      FROM affiliate_admin_actions
     WHERE ($1::bigint IS NULL OR affiliate_id = $1::bigint) AND ($2::text IS NULL OR action = $2::text)
       AND ($3::date IS NULL OR at >= $3::date) AND ($4::date IS NULL OR at < $4::date + 1)
     ORDER BY id DESC`,
};

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req, false);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind") ?? "";
  const sql = QUERIES[kind];
  if (!sql) return NextResponse.json({ error: "invalid kind", kinds: Object.keys(QUERIES) }, { status: 400 });
  const format = q.get("format") ?? "json";
  if (format !== "json" && format !== "csv") return NextResponse.json({ error: "invalid format" }, { status: 400 });
  const idRaw = q.get("affiliate_id");
  const id = idRaw === null ? null : /^[1-9][0-9]{0,15}$/.test(idRaw) ? Number(idRaw) : NaN;
  const status = q.get("status");
  const from = q.get("from");
  const to = q.get("to");
  if (Number.isNaN(id) || (status !== null && !STATUS.test(status)) || (from !== null && !DAY.test(from)) || (to !== null && !DAY.test(to))) {
    return NextResponse.json({ error: "invalid filter" }, { status: 400 });
  }

  let rows: Record<string, unknown>[];
  try {
    rows = await dbQueryStrict<Record<string, unknown>>(`${sql} LIMIT ${LIMIT + 1}`, [id, status, from, to]);
  } catch (e) {
    console.error(`[admin/affiliate/export] ${kind} failed:`, String(e));
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  const truncated = rows.length > LIMIT;
  if (truncated) rows = rows.slice(0, LIMIT);

  if (format === "json") return NextResponse.json({ kind, count: rows.length, truncated, rows });
  const cols = COLUMNS[kind];
  const body = [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="affiliate-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-Truncated": truncated ? "1" : "0",
    },
  });
}
