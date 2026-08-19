// #EMAIL-WARMUP-0819 — due invarianti che proteggono la reputazione del dominio:
// 1) non si spedisce verso domini che per standard non esistono (ogni bounce è a
//    nostro carico e su volumi bassi un solo indirizzo finto sfonda la soglia);
// 2) il marketing esce dal dominio marketing, il transazionale dalla radice.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isUnroutableAddress, marketingFromAddress, sendEmail } from "./email";

vi.mock("@/lib/db", () => ({ dbExecute: vi.fn(async () => undefined) }));
vi.mock("./db", () => ({ dbExecute: vi.fn(async () => undefined) }));

describe("isUnroutableAddress", () => {
  it("riconosce i TLD riservati che non possono ricevere posta", () => {
    for (const addr of [
      "qa-manual@betredge-test.local",
      "x@foo.test",
      "x@foo.example",
      "x@foo.invalid",
      "x@localhost",
      "X@FOO.LOCAL", // case-insensitive
      "x@foo.local.", // FQDN con punto finale
    ]) {
      expect(isUnroutableAddress(addr), addr).toBe(true);
    }
  });

  it("lascia passare i domini reali, compresi quelli del seed", () => {
    for (const addr of [
      "calde@mavenagency.io",
      "acaldera2901@gmail.com",
      "info@betredge.com",
      "news@news.betredge.com",
      "x@localhost.com", // .com, non .localhost
    ]) {
      expect(isUnroutableAddress(addr), addr).toBe(false);
    }
  });
});

describe("marketingFromAddress", () => {
  const prevMarketing = process.env.MARKETING_FROM;
  const prevFrom = process.env.RESEND_FROM;

  afterEach(() => {
    if (prevMarketing === undefined) delete process.env.MARKETING_FROM;
    else process.env.MARKETING_FROM = prevMarketing;
    if (prevFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = prevFrom;
  });

  it("usa MARKETING_FROM quando impostata", () => {
    process.env.MARKETING_FROM = "BetRedge <news@news.betredge.com>";
    process.env.RESEND_FROM = "BetRedge <noreply@betredge.com>";
    expect(marketingFromAddress()).toBe("BetRedge <news@news.betredge.com>");
  });

  it("senza MARKETING_FROM ricade su RESEND_FROM: il deploy non rompe le lifecycle", () => {
    delete process.env.MARKETING_FROM;
    process.env.RESEND_FROM = "BetRedge <noreply@betredge.com>";
    expect(marketingFromAddress()).toBe("BetRedge <noreply@betredge.com>");
  });
});

describe("sendEmail — guardia al trust boundary", () => {
  const prevKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mail = { subject: "s", html: "<p>h</p>", text: "t" };

  it("dominio irraggiungibile → rifiuta e NON chiama Resend", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      sendEmail({ to: "qa-manual@betredge-test.local", ...mail }),
    ).rejects.toThrow(/unroutable domain/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dominio reale → chiama Resend una volta", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await sendEmail({ to: "calde@mavenagency.io", ...mail });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("sendTransactional — quale dominio per quale flusso", () => {
  const prevMarketing = process.env.MARKETING_FROM;
  const prevFrom = process.env.RESEND_FROM;
  const prevKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.MARKETING_FROM = "BetRedge <news@news.betredge.com>";
    process.env.RESEND_FROM = "BetRedge <noreply@betredge.com>";
  });

  afterEach(() => {
    if (prevMarketing === undefined) delete process.env.MARKETING_FROM;
    else process.env.MARKETING_FROM = prevMarketing;
    if (prevFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = prevFrom;
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function sentFrom(type: string): Promise<string> {
    let captured = "";
    const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
      captured = JSON.parse(String(init.body)).from;
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { sendTransactional } = await import("./notify");
    await sendTransactional({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      to: "calde@mavenagency.io",
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
    return captured;
  }

  it.each(["acquisition", "retention", "onboarding", "winback"])(
    "%s è marketing → esce da news.betredge.com",
    async (type) => {
      expect(await sentFrom(type)).toBe("BetRedge <news@news.betredge.com>");
    },
  );

  it.each(["activation", "receipt", "password_reset", "renewal_reminder"])(
    "%s è servizio → resta sulla radice",
    async (type) => {
      expect(await sentFrom(type)).toBe("BetRedge <noreply@betredge.com>");
    },
  );
});
