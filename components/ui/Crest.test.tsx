import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Crest } from "./Crest";
import { crestUrl } from "@/lib/ui/crest-assets";

describe("crestUrl", () => {
  it("SP0: sconosciuto → null", () => {
    expect(crestUrl("Inter", "football")).toBeNull();
    expect(crestUrl(null, "football")).toBeNull();
  });
});

// #RESTYLING-0921 round 4 — senza crest con licenza non c'è più lo scudo tinto
// proceduralmente ma un TOTEM disegnato (lib/ui/totem-assets.ts). Lo scudo
// resta solo dove un totem non si può assegnare: senza nome squadra.
describe("Crest", () => {
  it("senza crest con licenza rende il totem (nessun testo/monogramma)", () => {
    const { container } = render(<Crest team="Inter" sport="football" />);
    const img = container.querySelector("img")!;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toMatch(/^\/badges\/totem-[a-z]+-sm\.png$/);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toBe(""); // niente lettere dentro il crest
  });
  it("totem deterministico: stesso nome → stesso badge", () => {
    const a = render(<Crest team="Inter" sport="football" />).container.querySelector("img")!.getAttribute("src");
    const b = render(<Crest team="Inter" sport="football" />).container.querySelector("img")!.getAttribute("src");
    expect(a).toBe(b);
  });
  it("sopra i 48px prende il totem grande invece di stirare il -sm", () => {
    const { container } = render(<Crest team="Inter" sport="football" size={56} />);
    expect(container.querySelector("img")!.getAttribute("src")).toMatch(/^\/badges\/totem-[a-z]+\.png$/);
  });
  it("il totem passato dal chiamante (totemPair) vince su quello derivato", () => {
    const { container } = render(
      <Crest
        team="Inter"
        sport="football"
        totem={{ name: "moon", color: "ivory", hex: "#F5F2E9", src: "/badges/totem-moon.png", srcSm: "/badges/totem-moon-sm.png" }}
      />,
    );
    expect(container.querySelector("img")!.getAttribute("src")).toBe("/badges/totem-moon-sm.png");
  });
  it("senza nome squadra resta lo scudo neutro: un totem non si assegna al nulla", () => {
    const { container } = render(<Crest team={null} sport="football" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
