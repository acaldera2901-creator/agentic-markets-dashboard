import { describe, it, expect } from "vitest";
import nextConfig from "@/next.config";

const rules = async () => (await nextConfig.headers!()) as Array<{
  source: string; headers: Array<{ key: string; value: string }>;
}>;

// path-to-regexp non è importabile qui: si verifica il pattern negativo
// direttamente, che è ciò che decide se /embed eredita gli header globali.
const matchesGlobal = (source: string, path: string): boolean => {
  const body = source.replace(/^\//, "");
  return new RegExp(`^${body}$`).test(path.replace(/^\//, ""));
};

describe("header di embeddabilità (#WIDGET-EMBED-0824)", () => {
  it("la regola globale NON copre /embed (che porta i suoi header)", async () => {
    const global = (await rules()).find((r) => r.headers.some((h) => h.key === "X-Frame-Options"))!;
    expect(matchesGlobal(global.source, "/embed")).toBe(false);
  });

  it("ogni altro path resta non-incorporabile: SAMEORIGIN e frame-ancestors 'self'", async () => {
    const global = (await rules()).find((r) => r.headers.some((h) => h.key === "X-Frame-Options"))!;
    for (const p of ["/", "/app", "/plans", "/embedded-stuff", "/api/v2/predictions"]) {
      expect(matchesGlobal(global.source, p)).toBe(true);
    }
    expect(global.headers.find((h) => h.key === "X-Frame-Options")!.value).toBe("SAMEORIGIN");
    expect(global.headers.find((h) => h.key === "Content-Security-Policy")!.value).toContain("frame-ancestors 'self'");
  });

  it("/widget.js è servito con una cache lunga ma revalidabile", async () => {
    const widget = (await rules()).find((r) => r.source.includes("widget.js"))!;
    expect(widget.headers.find((h) => h.key === "Cache-Control")!.value).toMatch(/max-age/);
  });
});
