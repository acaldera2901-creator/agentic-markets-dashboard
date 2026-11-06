// #PERF-LOGO-1106 — the landing BrandMark must not ship the 567 KB master for a 32 px logo.
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

describe("landing BrandMark logo", () => {
  it("uses the small copy, and that copy is small", () => {
    const src = readFileSync(join(__dirname, "landing-client.tsx"), "utf8");
    expect(src).toContain("/logos/betredge-logo-white-96.png");
    expect(src).not.toContain('src="/logos/betredge-logo-white.png"');
    expect(statSync(join(__dirname, "../public/logos/betredge-logo-white-96.png")).size).toBeLessThan(60 * 1024);
  });
});
