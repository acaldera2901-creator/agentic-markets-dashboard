import {analyticsWriteAllowed} from '@/lib/events-write-gate';
import {recordTrackingCounter} from '@/lib/tracking-counters';
import { after, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { dbExecute } from "@/lib/db";
import { NETWORKS, networkOfPartner } from "@/lib/affiliate-networks";
import { targetUrlFor } from "@/lib/partners";

// #POSTBACK-1014 — outbound click: record it in partner_clicks and 302 to the
// partner's real tracking link (same geo resolution as the showcase). Our clickid is
// appended ONLY for networks that confirmed the param; otherwise the link is untouched.
export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "no-store"); // a cached 302 would reuse one clickid for everyone
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
};

// Append without re-serialising: `new URL(...).searchParams.set` would re-encode the
// partner's existing query (e.g. BetWinner's p=%2Fregistration%2F). clickid is hex-only.
function withParam(target: string, param: string, value: string): string {
  const hash = target.indexOf("#");
  const [base, frag] = hash === -1 ? [target, ""] : [target.slice(0, hash), target.slice(hash)];
  return `${base}${base.includes("?") ? "&" : "?"}${param}=${value}${frag}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ partner: string }> }) {
  const { partner } = await params;
  const network = networkOfPartner(partner);
  const country = req.headers.get("x-vercel-ip-country")?.trim().toUpperCase().slice(0, 8) || null;
  const target = network ? targetUrlFor(partner, country) : undefined;
  if (!network || !target) return noStore(NextResponse.redirect(new URL("/partners", req.url), 302));

  const clickid = randomUUID().replace(/-/g, "");
  const param = NETWORKS[network].clickParam;
  // Fail-open and off the critical path: the user reaches the partner even if the
  // insert fails (dbQuery logs and swallows).
  if(analyticsWriteAllowed())after(async () => {
    try{await dbExecute(
      `INSERT INTO partner_clicks (clickid, partner, network, clickid_sent, country) VALUES ($1, $2, $3, $4, $5)`,
      [clickid, partner, network, param !== null, country],
    );}catch{await recordTrackingCounter('insert_failed');}
  });
  return noStore(NextResponse.redirect(param ? withParam(target, param, clickid) : target, 302));
}
