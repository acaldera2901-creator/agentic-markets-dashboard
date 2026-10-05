import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomNav } from "./BottomNav";
import { ChipPartner } from "./ChipPartner";
import { Fascia } from "./Fascia";
import { Monogramma, ToolMark } from "./Monogramma";
import { Nastro } from "./Nastro";
import { Sigillo } from "./Sigillo";
import { BenchTool } from "./BenchTool";
import { parseMode } from "@/lib/v3c/mode";

describe("v3c componenti", () => {
  it("Fascia: tab, titolo h1 in maiuscolo da cartellone, meta", () => {
    render(<Fascia tab="Board · football & tennis" title="Saturday 10 October" meta={<b>8 matches</b>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Saturday 10 October" })).toHaveClass("v3c-t-page");
    expect(screen.getByText("Board · football & tennis")).toHaveClass("v3c-fascia-tab");
    expect(screen.getByText("8 matches")).toBeInTheDocument();
  });

  it("Monogramma calcio: sigla, banda con i colori, «to verify» nell'etichetta", () => {
    const { container } = render(<Monogramma team={{ name: "Genoa", code: "GEN", colours: ["#A31E25", "#0F2140"] }} />);
    expect(screen.getByRole("img", { name: "Genoa · club colours, to verify" })).toBeInTheDocument();
    const band = container.querySelector("i") as HTMLElement;
    expect(band.getAttribute("style")).toContain("--c1: #A31E25");
    expect(band.dataset.verified).toBe("false");
    expect(container.querySelector("img")).toBeNull(); // mai uno stemma
  });

  it("Monogramma tennis: iniziali + nazione nella banda", () => {
    const { container } = render(<Monogramma team={{ name: "Carlos Alcaraz", nation: "ESP" }} />);
    expect(container.querySelector("b")?.textContent).toBe("CA");
    expect(container.querySelector("i.v3c-tn")?.textContent).toBe("ESP");
  });

  it("ToolMark: sigla della formula, banda royal, decorativo", () => {
    const { container } = render(<ToolMark sigla="EV" name="EV calculator" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("v3c-mg-tool");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.textContent).toBe("EV");
  });

  it("Nastro: descrizione accessibile e due punti sulla scala 30–60", () => {
    const { container } = render(<Nastro market={44} estimate={48} />);
    expect(screen.getByRole("img", { name: "Market 44 percent, estimate 48 percent, gap +4 points. Scale 30 to 60 percent." })).toBeInTheDocument();
    expect(container.querySelectorAll("u")).toHaveLength(7);
    expect(container.querySelector("i.v3c-tm")?.getAttribute("style")).toContain("46.67%");
    expect(container.querySelector("i.v3c-te")?.getAttribute("style")).toMatch(/left: 60(\.00)?%/);
    expect(container.textContent).toContain("gap +4 pp");
  });

  it("Nastro: sotto 1.5 pp dice «in line» e si spegne", () => {
    const { container } = render(<Nastro market={29} estimate={28} />);
    expect(container.querySelector(".v3c-gl-g")).toHaveClass("v3c-g-flat");
    expect(container.textContent).toContain("in line");
  });

  it("Sigillo: ora UTC e hash abbreviato in mono; hash non valido → niente", () => {
    const { container, rerender } = render(<Sigillo sealedAt="2026-10-10T09:02:00Z" hash="a91f3c7e0b2d44c3" />);
    expect(container.textContent).toContain("09:02 UTC");
    expect(container.querySelector("code")?.textContent).toBe("a91f…c3");
    rerender(<Sigillo sealedAt="09:02 UTC" hash="not a hash" />);
    expect(container.firstChild).toBeNull();
  });

  it("ChipPartner: link commerciale con rel nofollow sponsored e aria-label", () => {
    render(<ChipPartner book={{ code: "NB", name: "NorthBet", colour: "#0B4FA8" }} price={2.15} href="#" sample />);
    const a = screen.getByRole("link", { name: "2.15 NorthBet, affiliate link, sample" });
    expect(a.getAttribute("rel")).toBe("nofollow sponsored");
    expect(a.dataset.partner).toBe("NB");
    expect(a.textContent).toContain("2.15");
  });

  it("BenchTool: input → risultato; «in linea» grigio, mercato sky", () => {
    const { container, rerender } = render(<BenchTool sigla="EV" name="EV calculator" line="is the price worth it?" href="/tools/ev-calculator" example={{ input: "2.15 at 48%", output: "+3.2%" }} />);
    expect(screen.getByRole("link", { name: /EV calculator/ })).toHaveAttribute("href", "/tools/ev-calculator");
    expect(container.querySelector(".v3c-out")?.textContent).toBe("+3.2%");
    rerender(<BenchTool sigla="p%" name="Probability" line="…" href="#" example={{ input: "x", output: "44%", market: true }} />);
    expect(container.querySelector(".v3c-out")).toHaveClass("v3c-m");
    rerender(<BenchTool sigla="f*" name="Kelly" line="…" href="#" example={{ input: "x", output: "no stake", flat: true }} />);
    expect(container.querySelector(".v3c-out")).toHaveClass("v3c-g-flat");
  });

  it("BottomNav: cinque voci nell'ordine deciso, una sola corrente", () => {
    render(<BottomNav current="tools" />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Board", "Tools", "Price", "Record", "Books"]);
    expect(links.filter((l) => l.getAttribute("aria-current") === "page").map((l) => l.textContent)).toEqual(["Tools"]);
  });

  it("parseMode: scuro solo se chiesto, altrimenti carta", () => {
    expect(parseMode("dark")).toBe("dark");
    expect(parseMode(["dark"])).toBe("dark");
    expect(parseMode("light")).toBe("light");
    expect(parseMode(undefined)).toBe("light");
    expect(parseMode("banana")).toBe("light");
  });
});
