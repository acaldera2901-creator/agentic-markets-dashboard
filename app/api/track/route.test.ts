import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// #SESSIONI-1006 — leve 1, 2, 4 viste dalla route: cosa arriva all'INSERT.
// Il DB e' un mock: nessuna riga va da nessuna parte.

const dbQuery = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/db", () => ({ dbQuery }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => false, clientIp: () => "1.2.3.4" }));

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

function req(body: unknown, ua: string | null = CHROME) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-vercel-ip-country": "IT" };
  if (ua !== null) headers["user-agent"] = ua;
  return new NextRequest("https://x/api/track", { method: "POST", headers, body: JSON.stringify(body) });
}

const inserts = () => dbQuery.mock.calls.filter((c) => /INSERT INTO events/.test(String(c[0])));

let POST: (r: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules(); // il contatore dei bot e' stato di modulo
  dbQuery.mockClear();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("TRACK_ALLOW_WRITE", "");
  ({ POST } = await import("./route"));
});

afterEach(() => vi.unstubAllEnvs());

describe("leva 1 — fuori produzione non si scrive", () => {
  it("production scrive", async () => {
    const res = await POST(req({ event_type: "page_view", meta: { path: "/" } }));
    expect(await res.json()).toEqual({ ok: true });
    expect(inserts()).toHaveLength(1);
  });

  for (const env of ["preview", "development", ""]) {
    it(`VERCEL_ENV="${env}" risponde ignored e non tocca il DB`, async () => {
      vi.stubEnv("VERCEL_ENV", env);
      const res = await POST(req({ event_type: "page_view", meta: { path: "/" } }));
      expect(await res.json()).toEqual({ ok: true, ignored: true });
      expect(dbQuery).not.toHaveBeenCalled();
    });
  }

  it("TRACK_ALLOW_WRITE=1 riapre la scrittura in preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TRACK_ALLOW_WRITE", "1");
    await POST(req({ event_type: "page_view", meta: { path: "/" } }));
    expect(inserts()).toHaveLength(1);
  });
});

describe("leva 2 — bot scartati, UA mai salvato", () => {
  it("un bot risponde ignored e non scrive l'evento", async () => {
    const res = await POST(req({ event_type: "page_view", meta: { path: "/pt" } }, "Mozilla/5.0 (compatible; Googlebot/2.1)"));
    expect(await res.json()).toEqual({ ok: true, ignored: true });
    expect(inserts()).toHaveLength(0);
  });

  it("senza user-agent e' uno script", async () => {
    await POST(req({ event_type: "page_view" }, null));
    expect(inserts()).toHaveLength(0);
  });

  it("lo user-agent non finisce mai nei parametri dell'INSERT", async () => {
    await POST(req({ event_type: "page_view", meta: { path: "/" } }));
    expect(JSON.stringify(inserts())).not.toContain("Chrome/129");
  });

  it("il contatore scrive una riga aggregata (solo numero) a finestra chiusa", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
      for (let i = 0; i < 5; i++) await POST(req({ event_type: "page_view" }, "GPTBot/1.2"));
      expect(inserts()).toHaveLength(0);
      vi.setSystemTime(new Date("2026-10-06T10:10:00Z"));
      await POST(req({ event_type: "page_view" }, "GPTBot/1.2"));
      expect(inserts()).toHaveLength(1);
      const [sql, params] = inserts()[0];
      expect(String(sql)).toContain("'track_bot_dropped', NULL");
      expect(JSON.parse(params[0])).toEqual({ count: 6, since: "2026-10-06T10:00:00.000Z" });
      expect(JSON.stringify(params)).not.toContain("GPTBot");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("leva 3 — entry_attributed entra con la sua sessione", () => {
  it("e' in allowlist e porta session_id e fonte", async () => {
    await POST(req({ event_type: "entry_attributed", session_id: "abc", meta: { path: "/", utm_source: "reddit" } }));
    const params = inserts()[0][1];
    expect(params[0]).toBe("entry_attributed");
    expect(params[1]).toBe("abc");
    expect(JSON.parse(params[7])).toEqual({ path: "/", utm_source: "reddit" });
  });
});

describe("leva 4 — consent_choice aggregato, senza identificatori", () => {
  it("scrive choice, paese e lingua; butta session_id, plan, partner e meta extra", async () => {
    await POST(req({
      event_type: "consent_choice", session_id: "abc", plan: "pro", partner_id: "p1", language: "it",
      meta: { choice: "declined", path: "/secret", utm_source: "x" },
    }));
    const params = inserts()[0][1];
    expect(params[0]).toBe("consent_choice");
    expect(params[1]).toBeNull(); // session_id
    expect(params[2]).toBe("IT");
    expect(params[3]).toBe("it");
    expect(params[4]).toBeNull(); // plan
    expect(params[5]).toBeNull(); // partner_id
    expect(JSON.parse(params[7])).toEqual({ choice: "declined" });
  });

  it("una choice non valida viene ignorata", async () => {
    const res = await POST(req({ event_type: "consent_choice", meta: { choice: "maybe" } }));
    expect(await res.json()).toEqual({ ok: true, ignored: true });
    expect(inserts()).toHaveLength(0);
  });
});
