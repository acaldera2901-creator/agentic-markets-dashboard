import { renderToStaticMarkup } from "react-dom/server";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PartnersPage from "./page";

vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/components/classic/ClassicChrome", () => ({ default: () => null }));

it("renders the public heading before checking geography and keeps the offers out of the initial HTML", () => {
  const html = renderToStaticMarkup(<PartnersPage />);
  expect(html).toContain("<h1");
  expect(html).toContain("Our partners");
  expect(html).not.toContain("partner-card");
  expect(html).not.toContain("/go/");
});


afterEach(() => {
  localStorage.removeItem("agentic-lang");
  vi.unstubAllGlobals();
});

it("keeps the localized heading visible while geography is pending and blocked", async () => {
  localStorage.setItem("agentic-lang", "it");
  let resolveGeo!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { resolveGeo = resolve; })));
  const { container } = render(<PartnersPage />);

  expect(screen.getByRole("heading", { level: 1, name: "I nostri partner" })).toBeInTheDocument();
  expect(container.querySelector(".partner-card")).toBeNull();

  await act(async () => {
    resolveGeo(Response.json({ blocked: true, country: "US" }));
  });

  expect(screen.getByRole("heading", { level: 1, name: "I nostri partner" })).toBeInTheDocument();
  expect(container.querySelector("#partners-unavailable")).toBeInTheDocument();
  expect(container.querySelector('a[href^="/go/"]')).toBeNull();
});
