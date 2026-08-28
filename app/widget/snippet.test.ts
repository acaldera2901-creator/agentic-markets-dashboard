import { describe, it, expect } from "vitest";
import { buildSnippet, buildPreviewUrl, WIDGET_DEFAULTS, type WidgetConfig } from "@/app/widget/snippet";

const cfg = (over: Partial<WidgetConfig> = {}): WidgetConfig => ({ ...WIDGET_DEFAULTS, ...over });

describe("buildSnippet", () => {
  it("produce il tag con il codice del partner e le opzioni scelte", () => {
    const s = buildSnippet(cfg({ ref: "SERGIO", sport: "tennis", limit: 4, lang: "en", theme: "dark" }));
    expect(s).toContain('src="https://www.betredge.com/widget.js"');
    expect(s).toContain('data-ref="SERGIO"');
    expect(s).toContain('data-sport="tennis"');
    expect(s).toContain('data-limit="4"');
    expect(s).toContain('data-lang="en"');
    expect(s).toContain('data-theme="dark"');
    expect(s).toContain("async");
  });

  it("mostra un segnaposto quando il partner non ha ancora un codice", () => {
    const s = buildSnippet(cfg({ ref: "" }));
    expect(s).toContain('data-ref="YOUR-CODE"');
  });

  it("non lascia passare virgolette o markup dentro il tag", () => {
    const s = buildSnippet(cfg({ ref: 'X" onload="alert(1)' }));
    expect(s).not.toContain("onload");
    expect(s).toContain('data-ref="XONLOADALERT1"'); // ripulito alla stessa regex del server
  });

  it("tiene il codice entro i 20 caratteri accettati dal server", () => {
    const s = buildSnippet(cfg({ ref: "A".repeat(40) }));
    expect(s).toContain(`data-ref="${"A".repeat(20)}"`);
  });
});

describe("buildPreviewUrl", () => {
  it("l'anteprima non si conta come impression di un partner", () => {
    const u = new URL(buildPreviewUrl(cfg({ ref: "SERGIO" })), "https://x.test");
    expect(u.searchParams.get("preview")).toBe("1");
  });

  it("chiede all'anteprima gli stessi parametri dello snippet", () => {
    const u = new URL(buildPreviewUrl(cfg({ ref: "SERGIO", sport: "football", limit: 2, lang: "it", theme: "light" })), "https://x.test");
    expect(u.pathname).toBe("/embed");
    expect(u.searchParams.get("sport")).toBe("football");
    expect(u.searchParams.get("limit")).toBe("2");
    expect(u.searchParams.get("lang")).toBe("it");
    expect(u.searchParams.get("theme")).toBe("light");
  });

  it("l'anteprima non finge un'attribuzione che il partner non ha", () => {
    const u = new URL(buildPreviewUrl(cfg({ ref: "" })), "https://x.test");
    expect(u.searchParams.get("ref")).toBeNull();
  });
});
