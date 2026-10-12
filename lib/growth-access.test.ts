// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueAdminToken, verifyAdminToken } from "@/lib/admin-session";
import { GROWTH_SESSION_PREFIX, canViewGrowth } from "@/lib/growth-access";

vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => false, clientIp: () => "test" }));

const ADMIN = "admin-secret-test";
const GROWTH = "growth-secret-test";

const growthToken = () => issueAdminToken(GROWTH, 3600, GROWTH_SESSION_PREFIX);
const adminToken = () => issueAdminToken(ADMIN);

function req(path: string, cookies: Record<string, string> = {}) {
  const r = new NextRequest(`https://x${path}`);
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

async function gate(path: string, cookies: Record<string, string> = {}) {
  const { middleware } = await import("@/middleware");
  const res = await middleware(req(path, cookies));
  const loc = res.headers.get("location");
  return loc && new URL(loc).pathname === "/admin/login" ? "login" : "pass";
}

beforeEach(() => {
  vi.stubEnv("ADMIN_SECRET", ADMIN);
  vi.stubEnv("GROWTH_VIEW_SECRET", GROWTH);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("canViewGrowth", () => {
  it("growth session opens growth; admin session still opens growth", async () => {
    expect(await canViewGrowth(undefined, await growthToken())).toBe(true);
    expect(await canViewGrowth(await adminToken(), undefined)).toBe(true);
  });

  it("unset GROWTH_VIEW_SECRET grants nothing to a growth session (fail-closed)", async () => {
    const t = await growthToken();
    expect(await canViewGrowth(undefined, t, { ADMIN_SECRET: ADMIN })).toBe(false);
    expect(await canViewGrowth(undefined, t, {})).toBe(false);
  });

  it("a growth token never verifies as an admin token, even with equal secrets", async () => {
    const t = await issueAdminToken(ADMIN, 3600, GROWTH_SESSION_PREFIX);
    expect(await verifyAdminToken(t, ADMIN)).toBe(false);
  });
});

describe("middleware", () => {
  it("growth session opens /admin/growth but not other admin pages", async () => {
    const c = { growth_token: await growthToken() };
    expect(await gate("/admin/growth", c)).toBe("pass");
    for (const p of ["/admin", "/admin/segments", "/admin/blog", "/admin/growthx"]) {
      expect(await gate(p, c)).toBe("login");
    }
  });

  it("growth token in the admin cookie is rejected everywhere else", async () => {
    expect(await gate("/admin", { admin_token: await growthToken() })).toBe("login");
  });

  it("admin session opens everything, growth included", async () => {
    const c = { admin_token: await adminToken() };
    for (const p of ["/admin", "/admin/segments", "/admin/growth"]) expect(await gate(p, c)).toBe("pass");
  });

  it("no session → login; unset GROWTH_VIEW_SECRET → growth session refused", async () => {
    expect(await gate("/admin/growth")).toBe("login");
    const c = { growth_token: await growthToken() };
    vi.stubEnv("GROWTH_VIEW_SECRET", "");
    expect(await gate("/admin/growth", c)).toBe("login");
  });
});

describe("POST /api/admin/login", () => {
  async function login(password: unknown) {
    const { POST } = await import("@/app/api/admin/login/route");
    const r = new NextRequest("https://x/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
    return POST(r);
  }

  it("growth secret → growth_token scoped to /admin/growth, no admin_token", async () => {
    const res = await login(GROWTH);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, scope: "growth" });
    const g = res.cookies.get("growth_token");
    expect(g?.path).toBe("/admin/growth");
    expect(g?.httpOnly).toBe(true);
    expect(res.cookies.get("admin_token")).toBeUndefined();
    expect(await canViewGrowth(undefined, g?.value)).toBe(true);
    expect(await verifyAdminToken(g?.value, ADMIN)).toBe(false);
  });

  it("admin secret → admin_token as before", async () => {
    const res = await login(ADMIN);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await verifyAdminToken(res.cookies.get("admin_token")?.value, ADMIN)).toBe(true);
    expect(res.cookies.get("growth_token")).toBeUndefined();
  });

  it("wrong or empty password → 401, no cookie", async () => {
    for (const p of ["nope", "", undefined, GROWTH + "x"]) {
      const res = await login(p);
      expect(res.status).toBe(401);
      expect(res.cookies.getAll()).toHaveLength(0);
    }
  });

  it("unset GROWTH_VIEW_SECRET → growth password refused", async () => {
    vi.stubEnv("GROWTH_VIEW_SECRET", "");
    vi.resetModules();
    expect((await login(GROWTH)).status).toBe(401);
    expect((await login("")).status).toBe(401);
  });
});
