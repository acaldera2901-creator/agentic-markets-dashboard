// /lavoro has no auth of its own: it relies on proxy.ts. This proves the
// proxy actually covers the route and locks it.
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const PW = "correct-horse-battery";
const req = (auth?: string) => new NextRequest("http://localhost/lavoro", auth ? { headers: { authorization: auth } } : undefined);

describe("/lavoro is behind the shared password", () => {
  const prev = process.env.GROWTH_PASSWORD;
  afterEach(() => {
    process.env.GROWTH_PASSWORD = prev;
  });

  it("is matched by the proxy matcher", () => {
    const matchers = config.matcher.map((m) => new RegExp(`^${m}$`));
    expect(matchers.some((re) => re.test("/lavoro"))).toBe(true);
  });

  it("returns 401 without credentials and 503 when the password is not configured", async () => {
    process.env.GROWTH_PASSWORD = PW;
    expect((await proxy(req())).status).toBe(401);
    expect((await proxy(req("Basic " + btoa(`steve:${PW}x`)))).status).toBe(401);
    delete process.env.GROWTH_PASSWORD;
    expect((await proxy(req())).status).toBe(503);
  });

  it("lets the right password through", async () => {
    process.env.GROWTH_PASSWORD = PW;
    const res = await proxy(req("Basic " + btoa(`steve:${PW}`)));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
