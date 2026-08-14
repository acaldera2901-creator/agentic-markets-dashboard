import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CookieBanner from "@/components/CookieBanner";

// #FUNNEL-MEAS-0813: la parità visiva fra Accetta e Rifiuta è un requisito di
// compliance (EDPB Guidelines 03/2022 — accettare e rifiutare devono avere la
// stessa prominenza), non una preferenza estetica. È il tipo di proprietà che
// si rompe in silenzio la prossima volta che qualcuno "sistema" un bottone, e
// non se ne accorge nessuno finché non arriva un audit. Qui la si inchioda.

// Proprietà che determinano il PESO VISIVO. Possono divergere solo colore del
// testo e del bordo: la tinta fa lavoro semantico, la struttura no.
const WEIGHT_PROPS = [
  "fontSize", "fontFamily", "fontWeight", "letterSpacing", "textTransform",
  "lineHeight", "padding", "minWidth", "minHeight", "borderRadius",
  "borderWidth", "borderStyle", "backgroundColor",
] as const;

function buttons() {
  const decline = screen.getByRole("button", { name: /decline|rifiuta/i });
  const accept = screen.getByRole("button", { name: /accept|accetta/i });
  return { decline, accept };
}

describe("CookieBanner — parità dei due bottoni (EDPB)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  for (const [lang, label] of [["en", "EN"], ["it", "IT"]] as const) {
    it(`${label}: accetta e rifiuta condividono ogni proprietà di peso visivo`, () => {
      localStorage.setItem("agentic-lang", lang);
      render(<CookieBanner />);
      const { decline, accept } = buttons();

      for (const prop of WEIGHT_PROPS) {
        const d = getComputedStyle(decline)[prop];
        const a = getComputedStyle(accept)[prop];
        expect(a, `${prop} deve essere identico sui due bottoni`).toBe(d);
      }
    });
  }

  it("nessuno dei due è un ghost button: stesso fill, entrambi con bordo pieno", () => {
    localStorage.setItem("agentic-lang", "en");
    render(<CookieBanner />);
    const { decline, accept } = buttons();

    // Il fill identico è ciò che smonta l'opposizione pieno-vs-ghost.
    const fill = getComputedStyle(decline).backgroundColor;
    expect(getComputedStyle(accept).backgroundColor).toBe(fill);
    expect(fill).not.toBe("transparent");
    expect(fill).not.toBe("rgba(0, 0, 0, 0)");

    for (const b of [decline, accept]) {
      expect(getComputedStyle(b).borderStyle).toBe("solid");
      expect(getComputedStyle(b).borderWidth).toBe("1px");
    }
  });

  it("il rifiuto non è meno leggibile dell'accettazione", () => {
    localStorage.setItem("agentic-lang", "en");
    render(<CookieBanner />);
    const { decline, accept } = buttons();

    // #64748b (4,10:1 sulla barra) era sotto la soglia AA di 4,5. Il valore
    // vivo è --am-muted #AEB4BE. Il test blocca il ritorno dello slate morto.
    expect(getComputedStyle(decline).color).toBe("rgb(174, 180, 190)");
    // Nessun residuo pre-rebrand: il ciano #67e8f9 non deve tornare.
    expect(getComputedStyle(accept).color).not.toBe("rgb(103, 232, 249)");
  });

  it("il rifiuto viene prima nell'ordine di tabulazione", () => {
    localStorage.setItem("agentic-lang", "en");
    render(<CookieBanner />);
    const all = screen.getAllByRole("button");
    expect(all[0]).toBe(buttons().decline);
  });

  it("la disclosure affiliate resta nella sostanza in entrambe le lingue", () => {
    localStorage.setItem("agentic-lang", "en");
    const { unmount } = render(<CookieBanner />);
    expect(screen.getByText(/cookies/i).textContent).toMatch(/commission/i);
    unmount();

    localStorage.clear();
    localStorage.setItem("agentic-lang", "it");
    render(<CookieBanner />);
    expect(screen.getByText(/cookie/i).textContent).toMatch(/commissione/i);
  });
});
