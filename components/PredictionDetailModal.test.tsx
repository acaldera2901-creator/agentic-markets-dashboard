// #TAWK-UNDER-MODAL-0831 — la bolla di Tawk.to e' `fixed` con uno z-index che
// mette lei (~2e9) e su telefono finiva SOPRA la CTA «Place your bet» della
// scheda aperta: sopra l'unico bottone che porta al partner.
// La difesa e' un marcatore su <html> mentre il modale e' aperto; il CSS lo usa
// per riportare la chat sotto la soglia del modale. Qui si sorveglia il
// marcatore — che il CSS legga il marcatore lo garantisce `globals.css`, che di
// suo non e' testabile in jsdom.
import { describe, it, expect, afterEach, vi } from "vitest";
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

describe("la chat si nasconde con la SUA API (#TAWK-API-HIDE-0831)", () => {
  // Il primo tentativo abbassava lo z-index del contenitore di Tawk via CSS, e
  // dal telefono la bolla restava sopra: quel fix dipendeva dal DOM del widget,
  // che cambia fra le versioni. `hideWidget`/`showWidget` sono l'interfaccia
  // documentata e non dipendono dal markup.
  const monta = () => {
    const hideWidget = vi.fn();
    const showWidget = vi.fn();
    (window as unknown as { Tawk_API?: unknown }).Tawk_API = { hideWidget, showWidget };
    return { hideWidget, showWidget };
  };
  afterEach(() => { delete (window as unknown as { Tawk_API?: unknown }).Tawk_API; });

  it("aprendo la scheda la chat si nasconde", () => {
    const { hideWidget, showWidget } = monta();
    render(<PredictionDetailModal {...base} open><p>x</p></PredictionDetailModal>);
    expect(hideWidget).toHaveBeenCalledTimes(1);
    expect(showWidget).not.toHaveBeenCalled();
  });

  it("chiudendo la scheda la chat torna", () => {
    const { hideWidget, showWidget } = monta();
    const { rerender } = render(<PredictionDetailModal {...base} open><p>x</p></PredictionDetailModal>);
    rerender(<PredictionDetailModal {...base} open={false}><p>x</p></PredictionDetailModal>);
    expect(hideWidget).toHaveBeenCalledTimes(1);
    expect(showWidget).toHaveBeenCalledTimes(1);
  });

  it("smontando il modale la chat torna: non si resta senza chat", () => {
    const { showWidget } = monta();
    const { unmount } = render(<PredictionDetailModal {...base} open><p>x</p></PredictionDetailModal>);
    unmount();
    expect(showWidget).toHaveBeenCalledTimes(1);
  });

  it("senza `Tawk_API` (consenso negato) non lancia e la scheda si apre", () => {
    delete (window as unknown as { Tawk_API?: unknown }).Tawk_API;
    expect(() => render(<PredictionDetailModal {...base} open><p>contenuto</p></PredictionDetailModal>)).not.toThrow();
    expect(document.documentElement.dataset.pdmOpen).toBe("1");
  });

  it("se il widget lancia, la scheda si apre comunque", () => {
    (window as unknown as { Tawk_API?: unknown }).Tawk_API = {
      hideWidget: () => { throw new Error("widget non pronto"); },
      showWidget: () => { throw new Error("widget non pronto"); },
    };
    expect(() => {
      const { unmount } = render(<PredictionDetailModal {...base} open><p>contenuto</p></PredictionDetailModal>);
      unmount();
    }).not.toThrow();
  });
});
