import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// L'allowlist è la ragione per cui un evento nuovo può sparire in silenzio
// (già successo con i tre eventi del funnel referral): questo test la lega
// agli eventi che il widget emette davvero.
const ROUTE = readFileSync(join(process.cwd(), "app/api/track/route.ts"), "utf8");
const SCRIPT = readFileSync(join(process.cwd(), "app/embed/embed-html.ts"), "utf8");

describe("eventi del widget (#WIDGET-EMBED-0824)", () => {
  it("ogni evento emesso dal widget è nell'allowlist di /api/track", () => {
    const emitted = [...SCRIPT.matchAll(/beacon\("([a-z_]+)"\)/g)].map((m) => m[1]);
    expect(emitted.sort()).toEqual(["widget_click", "widget_view"]);
    for (const e of emitted) expect(ROUTE).toContain(`"${e}"`);
  });
});
