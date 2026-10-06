import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { BROWSER_ANALYTICS_EVENT_SET } from "@/lib/analytics-events";
import { analyticsWriteAllowed } from "@/lib/events-write-gate";
import { createDropCounter, isBotUserAgent } from "@/lib/bot-filter";

export const dynamic = "force-dynamic";

// MEDIUM-2: this endpoint is public (analytics beacon). Harden it so it can't
// poison the admin dashboard:
// - event_type must be one of the events the app actually fires (allowlist).
// - `value` is ALWAYS stored as 0 here: the client never sends a real value
//   (it's an analytics counter), and admin revenue must derive only from
//   /api/admin/activations — never from attacker-controllable client events.
// - string fields + meta are length-capped.
// - a best-effort per-IP rate limit bounds write volume (per serverless
//   instance; not a hard guarantee across instances, but raises the bar).
//
// #RETENTION-ANALYTICS-0915 — l'allowlist e' emigrata in lib/analytics-events.ts
// perche' la legge anche il cron di retention: e' lo stesso elenco che dice
// "questo evento puo' entrare" e "su questo evento l'identificatore scade a 14
// mesi". Tenerne due copie significa un evento che entra e non scade mai.
const ALLOWED_EVENTS = BROWSER_ANALYTICS_EVENT_SET;

// #SESSIONI-1006 leva 2 — totale dei beacon scartati come bot, una riga ogni
// 10' per istanza. Solo il numero: lo user-agent non esce dalla richiesta.
const botDrops = createDropCounter(10 * 60_000);

// #SESSIONI-1006 leva 4 — l'esito del banner e' un conteggio AGGREGATO: niente
// session_id e meta ridotto a {choice}, cosi' un client che mandasse altro non
// puo' trasformarlo in un dato collegabile.
const CONSENT_CHOICES = new Set(["accepted", "declined"]);

const cap = (v: unknown, n: number): string | null =>
  typeof v === "string" && v.length ? v.slice(0, n) : null;

export async function POST(req: NextRequest) {
  try {
    // #SESSIONI-1006 leva 1 — dev e preview non scrivono su `events` di prod.
    if (!analyticsWriteAllowed()) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (rateLimit(`track:${clientIp(req)}`, 60, 60_000)) {
      return NextResponse.json({ ok: true, throttled: true }); // never block the client
    }

    const body = await req.json() as {
      event_type?: string;
      session_id?: string;
      country?: string;
      language?: string;
      plan?: string;
      partner_id?: string;
      meta?: Record<string, unknown>;
    };

    const eventType = typeof body.event_type === "string" ? body.event_type : "";
    // Unknown/invalid event types are silently dropped (don't let arbitrary
    // strings into the events vocabulary the admin dashboard aggregates).
    if (!ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // #SESSIONI-1006 leva 2 — lo UA si legge e si butta: mai salvato.
    if (isBotUserAgent(req.headers.get("user-agent"))) {
      const flush = botDrops.hit(Date.now());
      if (flush) {
        await dbQuery(
          `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
           VALUES ('track_bot_dropped', NULL, NULL, NULL, NULL, NULL, 0, $1)`,
          [JSON.stringify(flush)]
        );
      }
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (eventType === "consent_choice") {
      const choice = body.meta?.choice;
      if (typeof choice !== "string" || !CONSENT_CHOICES.has(choice)) {
        return NextResponse.json({ ok: true, ignored: true });
      }
      // Restano solo giorno, paese e lingua, come per un page_view anonimo.
      body.meta = { choice };
      body.session_id = undefined;
      body.plan = undefined;
      body.partner_id = undefined;
    }

    // #WIDGET-TRUTH-0824 — il widget gira sul sito di terzi e la guida partner
    // dichiara che non raccoglie nulla sul loro visitatore. Il paese derivato
    // dall'IP è un dato sul visitatore: per gli eventi widget non si registra,
    // così la frase è vera nel codice e non solo nel PDF. Del widget interessa
    // il DOMINIO (meta.host), che resta.
    const isWidgetEvent = eventType.startsWith("widget_");
    const country = isWidgetEvent
      ? null
      : cap(body.country, 8) ??
        req.headers.get("x-vercel-ip-country") ??
        req.headers.get("cf-ipcountry") ??
        null;

    // Cap meta size so a single beacon can't dump arbitrarily large payloads.
    let metaJson = "{}";
    try {
      const s = JSON.stringify(body.meta ?? {});
      metaJson = s.length <= 2048 ? s : "{}";
    } catch { metaJson = "{}"; }

    await dbQuery(
      `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventType,
        cap(body.session_id, 128),
        country,
        cap(body.language, 16),
        cap(body.plan, 32),
        cap(body.partner_id, 64),
        0, // value never trusted from the client (revenue comes from activations)
        metaJson,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[track] error:", err);
    return NextResponse.json({ ok: true }); // never block the client on tracking failures
  }
}
