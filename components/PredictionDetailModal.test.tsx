// #TAWK-UNDER-MODAL-0831 — la bolla di Tawk.to e' `fixed` con uno z-index che
// mette lei (~2e9) e su telefono finiva SOPRA la CTA «Place your bet» della
// scheda aperta: sopra l'unico bottone che porta al partner.
// La difesa e' un marcatore su <html> mentre il modale e' aperto; il CSS lo usa
// per riportare la chat sotto la soglia del modale. Qui si sorveglia il
// marcatore — che il CSS legga il marcatore lo garantisce `globals.css`, che di
// suo non e' testabile in jsdom.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PredictionDetailModal } from "@/components/PredictionDetailModal";

afterEach(cleanup);

const base = {
  onClose: () => {},
  anchorRect: null,
  titleId: "t",
  title: <>Casa <span>v</span> Fuori</>,
  lang: "it" as const,
  hideHead: true,
  hideExtraMarkets: true,
};

describe("il marcatore che fa passare la chat sotto", () => {
  it("con la scheda CHIUSA non c'e'", () => {
    render(<PredictionDetailModal {...base} open={false}><p>x</p></PredictionDetailModal>);
    expect(document.documentElement.dataset.pdmOpen).toBeUndefined();
  });

  it("con la scheda APERTA c'e'", () => {
    render(<PredictionDetailModal {...base} open><p>x</p></PredictionDetailModal>);
    expect(document.documentElement.dataset.pdmOpen).toBe("1");
  });

  it("smontando il modale il marcatore NON resta appeso", () => {
    const { unmount } = render(<PredictionDetailModal {...base} open><p>x</p></PredictionDetailModal>);
    expect(document.documentElement.dataset.pdmOpen).toBe("1");
    unmount();
    expect(document.documentElement.dataset.pdmOpen).toBeUndefined();
  });

  it("chiudendo con `open=false` il marcatore va via", () => {
    const { rerender } = render(<PredictionDetailModal {...base} open><p>x</p></PredictionDetailModal>);
    expect(document.documentElement.dataset.pdmOpen).toBe("1");
    rerender(<PredictionDetailModal {...base} open={false}><p>x</p></PredictionDetailModal>);
    expect(document.documentElement.dataset.pdmOpen).toBeUndefined();
  });

  it("va via insieme allo scroll-lock, non prima ne' dopo", () => {
    // sono la stessa cosa: la pagina sotto e' fuori gioco. Tenerli separati vuol
    // dire che uno dei due prima o poi resta appeso.
    const { unmount } = render(<PredictionDetailModal {...base} open><p>x</p></PredictionDetailModal>);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.dataset.pdmOpen).toBe("1");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(document.documentElement.dataset.pdmOpen).toBeUndefined();
  });
});
