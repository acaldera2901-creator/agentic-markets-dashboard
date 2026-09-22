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

// #RESTYLING-0921 round 7 — senza crest con licenza il default NON è più il
// totem illustrato del round 4 ma il quadratino con le iniziali del
// riferimento: due tinte per RUOLO (casa/trasferta), zero asset. I totem
// restano raggiungibili passandoli esplicitamente.
describe("Crest", () => {
  it("senza crest con licenza rende il quadratino con le iniziali", () => {
    const { container } = render(<Crest team="Inter" sport="football" />);
    const crest = container.querySelector(".br-crest")!;
    expect(crest).toBeInTheDocument();
    expect(crest.textContent).toBe("INT");
    expect(container.querySelector("img")).toBeNull();
  });

  it("il ruolo, non la squadra, decide la tinta", () => {
    const home = render(<Crest team="Inter" sport="football" role="home" />).container.querySelector(".br-crest")!;
    const away = render(<Crest team="Milan" sport="football" role="away" />).container.querySelector(".br-crest")!;
    expect(home.getAttribute("data-role")).toBe("home");
    expect(away.getAttribute("data-role")).toBe("away");
  });

  it("senza ruolo esplicito vale casa", () => {
    const { container } = render(<Crest team="Inter" sport="football" />);
    expect(container.querySelector(".br-crest")!.getAttribute("data-role")).toBe("home");
  });

  it("la misura arriva dal chiamante e trascina il corpo del testo", () => {
    const { container } = render(<Crest team="Inter" sport="football" size={56} />);
    const el = container.querySelector(".br-crest") as HTMLElement;
    expect(el.style.width).toBe("56px");
    expect(el.style.fontSize).toBe("19px"); // 56 * .34 arrotondato
  });

  it("il nome della squadra resta leggibile dagli screen reader", () => {
    const { container } = render(<Crest team="Manchester United" sport="football" />);
    const el = container.querySelector(".br-crest")!;
    expect(el.getAttribute("aria-label")).toBe("Manchester United");
    expect(el.textContent).toBe("MU");
  });

  it("un totem passato esplicitamente vince ancora sul quadratino", () => {
    const { container } = render(
      <Crest
        team="Inter"
        sport="football"
        totem={{ name: "moon", color: "ivory", hex: "#F5F2E9", src: "/badges/totem-moon.png", srcSm: "/badges/totem-moon-sm.png" }}
      />,
    );
    expect(container.querySelector("img")!.getAttribute("src")).toBe("/badges/totem-moon-sm.png");
  });

  it("senza nome squadra il quadratino resta vuoto: non si inventa un monogramma", () => {
    const { container } = render(<Crest team={null} sport="football" />);
    const el = container.querySelector(".br-crest")!;
    expect(el).toBeInTheDocument();
    expect(el.textContent).toBe("");
    expect(el.getAttribute("aria-label")).toBe("squadra");
  });
});
