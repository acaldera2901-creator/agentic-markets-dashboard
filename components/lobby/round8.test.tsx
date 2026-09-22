// #RESTYLING-0921 round 8 — il titolo tipografico della Home.
//
// Come i test del round 6: il punto non è «renderizza». È che il titolo sia UN
// h1 (la Home ne aveva già uno sul desk, e due nello stesso documento è una
// regressione SEO che si vede solo in audit), che la parola accento stia in un
// <em> separato — perché il lime glielo dà il CSS, non un colore inline — e
// che il componente non inventi la spalla quando il chiamante non la passa.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PageHeadline } from "./PageHeadline";

const base = {
  eyebrow: "CALCIO. TENNIS. IL TUO EDGE.",
  lead: "Il tuo",
  accent: "matchday.",
};

describe("PageHeadline", () => {
  it("il titolo è un h1 solo, con la parola accento in <em>", () => {
    const { container } = render(<PageHeadline {...base} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Il tuo matchday.");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    // L'accento è un nodo suo: il gradiente lime è CSS su .br-headline__accent.
    const em = within(h1).getByText("matchday.");
    expect(em.tagName).toBe("EM");
    expect(em).toHaveClass("br-headline__accent");
  });

  it("rende occhiello, spalla e nota di rischio, tutti dal chiamante", () => {
    render(
      <PageHeadline
        {...base}
        note={["Le partite. Le probabilità.", "Il contesto per leggerle."]}
        hint="Analisi probabilistica · nessuna garanzia di profitto · 18+"
      />,
    );
    expect(screen.getByText("CALCIO. TENNIS. IL TUO EDGE.")).toBeInTheDocument();
    expect(screen.getByText("Le partite. Le probabilità.")).toBeInTheDocument();
    expect(screen.getByText("Il contesto per leggerle.")).toBeInTheDocument();
    expect(screen.getByText(/nessuna garanzia di profitto/)).toBeInTheDocument();
  });

  it("le righe della spalla sono UN paragrafo spezzato da <br>, non paragrafi separati", () => {
    const { container } = render(<PageHeadline {...base} note={["Prima riga.", "Seconda riga."]} />);
    const note = container.querySelector(".br-headline__note")!;
    expect(note.querySelectorAll("p")).toHaveLength(1);
    expect(note.querySelectorAll("br")).toHaveLength(1);
  });

  it("senza spalla e senza nota non rende il blocco di destra", () => {
    const { container } = render(<PageHeadline {...base} />);
    expect(container.querySelector(".br-headline__note")).toBeNull();
  });
});
