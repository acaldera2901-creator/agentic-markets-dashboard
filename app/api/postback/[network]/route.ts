import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { dbExecute } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { hasNetwork, NETWORKS, secretEnvOf, type NetworkId, type PostbackField } from "@/lib/affiliate-networks";

// #POSTBACK-1014 — inbound conversion postbacks from the affiliate networks.
// Per-network secret (fail-closed), raw payload always stored, aliases from the
// registry, idempotent via dedup_key. 500 only on DB error, so the network retries.
export const dynamic = "force-dynamic";

const EVENTS: Record<string, string> = {
  reg: "registration", registration: "registration", signup: "registration",
  dep: "deposit", deposit: "deposit",
  ftd: "ftd", cpa: "cpa_qualified", cpa_qualified: "cpa_qualified", qualified: "cpa_qualified",
};

function secretOk(network: NetworkId, key: string | null): boolean {
  const expected = process.env[secretEnvOf(network)];
  if (!expected || !key) return false; // missing env = fail-closed
  const a = Buffer.from(key), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request, { params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!hasNetwork(network)) return new NextResponse("unknown network", { status: 404 });
  if (rateLimit(`postback:${clientIp(req)}`, 300, 60_000)) return new NextResponse("slow down", { status: 429 });

  const q = new URL(req.url).searchParams;
  if (!secretOk(network, q.get("key"))) {
    console.warn(`[postback] ${network}: bad or missing key`); // nothing written
    return new NextResponse("forbidden", { status: 401 });
  }

  const raw: Record<string, string> = {};
  for (const [k, v] of q) if (k !== "key") raw[k.slice(0, 64)] = v.slice(0, 512);
  const extra = NETWORKS[network].aliases ?? {};
  const pick = (f: PostbackField) => {
    for (const a of [f, ...(extra[f] ?? [])]) {
      const v = raw[a]?.trim();
      if (v) return v;
    }
    return null;
  };
  const num = (v: string | null) => (v !== null && Number.isFinite(Number(v)) ? Number(v) : null);

  const clickid = pick("clickid")?.slice(0, 64) ?? null;
  const evRaw = pick("event")?.toLowerCase() ?? null;
  const txn = pick("txn")?.slice(0, 128) ?? null;
  const sorted = JSON.stringify(Object.keys(raw).sort().map((k) => [k, raw[k]]));
  const dedup = txn ? `txn:${network}:${txn}` : `raw:${network}:${createHash("sha256").update(sorted).digest("hex")}`;

  try {
    await dbExecute(
      `INSERT INTO partner_conversions (network, clickid, partner, event, amount, currency, payout, txn_id, dedup_key, raw)
       VALUES ($1, $2, (SELECT partner FROM partner_clicks WHERE clickid = $2), $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (dedup_key) DO NOTHING`,
      [network, clickid, evRaw ? (EVENTS[evRaw] ?? evRaw.slice(0, 32)) : null,
       num(pick("amount")), pick("currency")?.slice(0, 8)?.toUpperCase() ?? null, num(pick("payout")),
       txn, dedup, JSON.stringify(raw)],
    );
  } catch (e) {
    console.error(`[postback] ${network}: db error`, String(e));
    return new NextResponse("retry", { status: 500 }); // idempotent: a network retry is safe
  }
  return new NextResponse("OK", { status: 200, headers: { "Cache-Control": "no-store" } });
}
