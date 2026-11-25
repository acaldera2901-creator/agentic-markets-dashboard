import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("uses the configured GA4 stream", async () => {
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-TEST12345");
  expect((await import("./ga4-config")).GA_MEASUREMENT_ID).toBe("G-TEST12345");
});

it("disables GA4 in an unconfigured Vercel preview", async () => {
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
  expect((await import("./ga4-config")).GA_MEASUREMENT_ID).toBeUndefined();
});

it("keeps the production stream as the default in production", async () => {
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
  expect((await import("./ga4-config")).GA_MEASUREMENT_ID).toBe("G-8XWQD5N6T7");
});
