// #LEGAL-FOOTER-1022 — /terms e /privacy hanno il footer standard del sito (18+, gioco
// responsabile, link a Termini/Privacy/Termini affiliati), come /affiliates/terms.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("@/components/classic/ClassicChrome", () => ({ default: () => null }));
vi.mock("@/components/CookiePreferences", () => ({ default: () => null }));

afterEach(() => cleanup());

describe.each([
  ["/terms", () => import("./terms/page")],
  ["/privacy", () => import("./privacy/page")],
])("%s — footer standard", (_route, load) => {
  it("rende il SiteFooter con 18+ e i link legali interni", async () => {
    const { default: Page } = await load();
    const { container } = render(<Page />);
    const footer = container.querySelector("footer.site-footer");
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toMatch(/18\+/);
    const hrefs = Array.from(footer!.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/terms", "/privacy", "/affiliates/terms"]));
  });
});
