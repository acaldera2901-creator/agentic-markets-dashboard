// #PERF-CLS-1110 — the header logos must carry width/height (aspect reserved before the PNG loads).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("SiteTopbar header logos", () => {
  it("every logo <img> declares width and height", () => {
    const src = readFileSync(join(__dirname, "SiteTopbar.tsx"), "utf8");
    const logos = src.match(/<img[^>]*\/logos\/[^>]*>/g) ?? [];
    expect(logos.length).toBeGreaterThanOrEqual(2);
    for (const tag of logos) {
      expect(tag).toMatch(/width=\{\d+\}/);
      expect(tag).toMatch(/height=\{\d+\}/);
    }
  });
  it("while the session loads, the auth buttons' space is reserved (hidden, aria-hidden twins), not left empty", () => {
    const src = readFileSync(join(__dirname, "SiteTopbar.tsx"), "utf8");
    expect(src).toContain('className="am-auth-reserve"');
    expect(src).toMatch(/am-auth-reserve[\s\S]{0,200}aria-hidden="true"/);
    expect(src).not.toContain("loading: render nothing");
  });
});
