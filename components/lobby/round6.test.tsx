// #RESTYLING-0921 round 6 — i due componenti nuovi del percorso verso Pro.
// Come per i test del round 2: il punto non è «renderizza». È che il BADGE
// dell'hero di sezione mostra solo conteggi veri (mai uno zero, mai un
// trattino) e che la fascia Pro non ha una sola parola sua — se il chiamante
// non passa headline, sub e CTA, non ne inventa.
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { ProBand } from "./ProBand";
import { SportHero } from "./SportHero";

describe("ProBand", () => {
  it("rende label, headline, sottotesto e CTA, tutti dal chiamante", () => {
    render(
      <ProBand
        label="BetRedge Pro"
        headline="La lettura completa del match."
        sub="Forma, infortuni e campo nella Deep Analysis."
        cta={{ label: "Confronta i piani", href: "/plans" }}
      />,
    );
    const band = screen.getByRole("complementary", { name: /BetRedge Pro/i });
    expect(within(band).getByText("La lettura completa del match.")).toBeInTheDocument();
    expect(within(band).getByText("Forma, infortuni e campo nella Deep Analysis.")).toBeInTheDocument();
    const cta = within(band).getByRole("link", { name: /Confronta i piani/i });
    expect(cta).toHaveAttribute("href", "/plans");
  });

  it("senza `sub` non rende nulla al suo posto", () => {
    render(
      <ProBand label="BetRedge Pro" headline="Ogni partita, fino in fondo." cta={{ label: "Scopri Pro", href: "/plans" }} />,
    );
    const band = screen.getByRole("complementary", { name: /BetRedge Pro/i });
    expect(band.querySelector(".br-proband__sub")).toBeNull();
  });

  it("la CTA chiama onClick: la tab Piani è già in pagina, non si naviga", () => {
    const onClick = vi.fn((ev: { preventDefault: () => void }) => ev.preventDefault());
    render(
      <ProBand label="BetRedge Pro" headline="x" cta={{ label: "Scopri Pro", href: "/plans", onClick }} />,
    );
    fireEvent.click(screen.getByRole("link", { name: /Scopri Pro/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("SportHero", () => {
  const base = {
    eyebrow: "BetRedge Football",
    title: "Calcio.",
    accent: "Leggi il gioco.",
    subtitle: "Probabilità e contesto, partita per partita.",
  };

  it("mette la seconda riga in <em> (lime dal CSS) e tiene il testo in HTML, non nell'immagine", () => {
    render(<SportHero {...base} image={{ src: "/images/hero/section-football-wide.jpg" }} />);
    const hero = screen.getByRole("region", { name: /BetRedge Football/i });
    const h1 = within(hero).getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Calcio.Leggi il gioco.");
    expect(within(hero).getByText("Leggi il gioco.").tagName).toBe("EM");
    // L'immagine è decorativa: il contenuto è il testo accanto.
    expect(hero.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("senza immagine resta un hero valido (fondo a gradiente), non un buco", () => {
    render(<SportHero {...base} />);
    const hero = screen.getByRole("region", { name: /BetRedge Football/i });
    expect(hero).toHaveAttribute("data-art", "type");
    expect(hero.querySelector("img")).toBeNull();
  });

  it("il badge mostra il conteggio vero, con lo zero-padding a due cifre", () => {
    render(<SportHero {...base} stat={{ value: 8, label: "partite sul board" }} />);
    expect(screen.getByText("08")).toBeInTheDocument();
    expect(screen.getByText("partite sul board")).toBeInTheDocument();
  });

  it("oltre il 9 il numero si scrive com'è", () => {
    render(<SportHero {...base} stat={{ value: 23, label: "partite sul board" }} />);
    expect(screen.getByText("23")).toBeInTheDocument();
  });

  it("a zero e a null il badge NON si rende: meglio nessuna cifra che una finta", () => {
    const { rerender } = render(<SportHero {...base} stat={{ value: 0, label: "partite sul board" }} />);
    expect(screen.queryByText("partite sul board")).toBeNull();
    rerender(<SportHero {...base} stat={{ value: null, label: "partite sul board" }} />);
    expect(screen.queryByText("partite sul board")).toBeNull();
  });
});
