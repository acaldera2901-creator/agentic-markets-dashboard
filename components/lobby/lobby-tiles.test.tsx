// #RESTYLING-0921 round 2 — i tre componenti nuovi della Home. Il punto dei
// test non è «renderizza»: è che i NUMERI e le PROMESSE compaiono solo se il
// chiamante li passa. Un banner che inventa «Trusted by 100K+» o una tile che
// dice «0 picks» per uno sport senza pipeline type-checkano benissimo.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HeroBanner } from "./HeroBanner";
import { SportCategoryTile, SportTileRow } from "./SportCategoryTile";
import { AccumulatorPromoTile } from "./AccumulatorPromoTile";

describe("HeroBanner", () => {
  it("rende eyebrow, headline con la parola accentata, i conteggi passati e la CTA", () => {
    render(
      <HeroBanner
        eyebrow="AI powered predictions"
        title={<>Top opportunities <em>today.</em></>}
        subtitle="Model-driven picks across football and tennis."
        stats={[
          { kind: "live", label: "Live now", value: 8, href: "/app?view=live" },
          { kind: "starting-soon", label: "Starting soon", value: 14 },
          { kind: "high-edge", label: "High edge", value: 12 },
        ]}
        cta={{ label: "Explore today's picks", href: "/app" }}
      />,
    );
    const hero = screen.getByRole("region", { name: /AI powered predictions/i });
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent("Top opportunities today.");
    expect(within(hero).getByText("today.").tagName).toBe("EM");
    expect(within(hero).getByText("8")).toBeInTheDocument();
    expect(within(hero).getByText("14")).toBeInTheDocument();
    expect(within(hero).getByText("12")).toBeInTheDocument();
    // La pill con href è un link; le altre no.
    expect(within(hero).getByRole("link", { name: /Live now/ })).toHaveAttribute("href", "/app?view=live");
    expect(within(hero).queryByRole("link", { name: /Starting soon/ })).toBeNull();
    expect(within(hero).getByRole("link", { name: /Explore today's picks/ })).toHaveAttribute("href", "/app");
  });

  it("una stat senza valore NON si rende, e senza `aside` non c'è la scatola", () => {
    render(
      <HeroBanner
        eyebrow="Predictions"
        title="Hello"
        stats={[{ kind: "live", label: "Live now", value: null }, { kind: "high-edge", label: "High edge", value: 3 }]}
        cta={{ label: "Go", href: "/app" }}
      />,
    );
    expect(screen.queryByText("Live now")).toBeNull();
    expect(screen.getByText("High edge")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByRole("region")).toHaveAttribute("data-has-aside", "false");
    // Nessun claim di default: il componente non conosce numeri di utenti.
    expect(screen.queryByText(/trusted by/i)).toBeNull();
  });

  it("la scatola dei value prop rende solo i punti passati", () => {
    render(
      <HeroBanner
        eyebrow="Predictions"
        title="Hello"
        cta={{ label: "Go", href: "/app" }}
        aside={{ title: <>Bet smarter <em>with data</em></>, points: ["Models vs market probabilities", "Covers football and tennis"] }}
      />,
    );
    const aside = screen.getByRole("complementary");
    expect(within(aside).getAllByRole("listitem")).toHaveLength(2);
    expect(within(aside).getByText("Covers football and tennis")).toBeInTheDocument();
    expect(screen.getByRole("region")).toHaveAttribute("data-has-aside", "true");
  });

  it("senza `image` c'è il pattern svg, con `image` la foto", () => {
    const { container, unmount } = render(<HeroBanner eyebrow="P" title="T" cta={{ label: "Go", href: "/" }} />);
    expect(container.querySelector(".br-hero__art svg")).not.toBeNull();
    expect(container.querySelector(".br-hero__art img")).toBeNull();
    expect(screen.getByRole("region")).toHaveAttribute("data-art", "type");
    unmount();
    render(<HeroBanner eyebrow="P" title="T" cta={{ label: "Go", href: "/" }} image={{ src: "/banners/x.jpg", alt: "A striker" }} />);
    expect(screen.getByRole("img", { name: "A striker" })).toHaveAttribute("src", "/banners/x.jpg");
    expect(screen.getByRole("region")).toHaveAttribute("data-art", "photo");
  });

  // #RESTYLING-0921 round 4 — il quadrato è piccolo, e su telefono non deve
  // scaricare il 960²: `srcSm` diventa la candidata a 480w. Senza `srcSm` non
  // si dichiara un srcset, che punterebbe a un file che non esiste.
  it("con `srcSm` l'immagine ha il srcset a due candidate, senza `srcSm` nessuno", () => {
    const { container, unmount } = render(
      <HeroBanner eyebrow="P" title="T" cta={{ label: "Go", href: "/" }}
        image={{ src: "/images/hero/hero-square.jpg", srcSm: "/images/hero/hero-square-480.jpg" }} />,
    );
    expect(container.querySelector(".br-hero__tex")).toHaveAttribute(
      "srcset", "/images/hero/hero-square-480.jpg 480w, /images/hero/hero-square.jpg 960w",
    );
    unmount();
    const second = render(
      <HeroBanner eyebrow="P" title="T" cta={{ label: "Go", href: "/" }} image={{ src: "/images/hero/hero-square.jpg" }} />,
    );
    expect(second.container.querySelector(".br-hero__tex")).not.toHaveAttribute("srcset");
  });
});

describe("SportCategoryTile", () => {
  it("con il conteggio è un link e mostra il numero", () => {
    render(<SportCategoryTile sport="football" label="Football" count={45} href="/app?view=football" />);
    const tile = screen.getByRole("link", { name: /Football/ });
    expect(tile).toHaveAttribute("data-state", "ready");
    expect(tile).toHaveAttribute("href", "/app?view=football");
    expect(within(tile).getByText("45").tagName).toBe("B");
    expect(tile).toHaveTextContent("45 picks today");
  });

  it("senza conteggio dice «Coming soon», non è un link e non mostra zeri", () => {
    render(<SportCategoryTile sport="basketball" label="Basketball" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    const tile = screen.getByText("Basketball").closest(".br-tile") as HTMLElement;
    expect(tile).toHaveAttribute("data-state", "soon");
    expect(tile).toHaveAttribute("aria-disabled", "true");
    expect(tile).toHaveTextContent("Coming soon");
    expect(tile).not.toHaveTextContent("0");
  });

  // #RESTYLING-0921 round 4 — un'icona passata è un raster della casa, e il
  // disco inset con bordo (cornice dell'icona di linea) le taglierebbe gli
  // angoli: il marcatore che lo spegne nel CSS deve esserci.
  it("l'icona passata marca la cornice come raster; senza icona resta quella di linea", () => {
    const { container, unmount } = render(
      <SportCategoryTile sport="basketball" label="Basketball" icon={<img src="/banners/sport-basketball-sm.png" alt="" />} />,
    );
    expect(container.querySelector(".br-tile__icon")).toHaveAttribute("data-kind", "raster");
    unmount();
    const second = render(<SportCategoryTile sport="football" label="Football" count={3} href="/x" />);
    expect(second.container.querySelector(".br-tile__icon")).toHaveAttribute("data-kind", "line");
  });

  it("senza href ma con onClick è un bottone; `active` marca aria-current; la riga è un nav nominato", () => {
    render(
      <SportTileRow label="Browse by sport">
        <SportCategoryTile sport="tennis" label="Tennis" count={80} onClick={() => {}} active countLabel="{n} match oggi" />
      </SportTileRow>,
    );
    const nav = screen.getByRole("navigation", { name: "Browse by sport" });
    const btn = within(nav).getByRole("button", { name: /Tennis/ });
    expect(btn).toHaveAttribute("aria-current", "true");
    expect(btn).toHaveTextContent("80 match oggi");
  });
});

describe("AccumulatorPromoTile", () => {
  it("è un link verso l'href passato, con titolo e sottotitolo", () => {
    render(<AccumulatorPromoTile title="Build your own accumulator" subtitle="Combine model picks." href="/probability-view" />);
    const a = screen.getByRole("link", { name: /Build your own accumulator/ });
    expect(a).toHaveAttribute("href", "/probability-view");
    expect(a).toHaveTextContent("Combine model picks.");
  });
});
