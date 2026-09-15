import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import VercelAnalytics from "@/components/VercelAnalytics";

// #SEO-ANALYTICS-0915 — il gate di consenso è il requisito di compliance di
// questo componente, non un dettaglio: <Analytics /> inietta
// /_vercel/insights/script.js e manda i pageview a Vercel. Caricarlo prima
// dell'Accept è esattamente ciò che ePrivacy vieta, ed è il tipo di regola che
// si perde al primo refactor del layout. Qui la si inchioda.
//
// Il componente di Vercel è mockato con una sentinella: quello che va
// verificato è SE lo montiamo, non cosa fa dentro (è codice di terze parti,
// testarlo sarebbe testare il loro SDK).
vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

const mounted = () => screen.queryByTestId("vercel-analytics") !== null;

describe("VercelAnalytics — gate di consenso (ePrivacy)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("senza consenso NON monta lo script", () => {
    render(<VercelAnalytics />);
    expect(mounted()).toBe(false);
  });

  it("con consenso RIFIUTATO non monta lo script", () => {
    localStorage.setItem("gdpr_consent", "declined");
    render(<VercelAnalytics />);
    expect(mounted()).toBe(false);
  });

  it("con consenso già accettato monta subito", () => {
    localStorage.setItem("gdpr_consent", "accepted");
    render(<VercelAnalytics />);
    expect(mounted()).toBe(true);
  });

  it("Accept durante la sessione monta senza reload (evento del banner)", () => {
    render(<VercelAnalytics />);
    expect(mounted()).toBe(false);

    // Esattamente ciò che fa CookieBanner.decide("accepted").
    act(() => {
      localStorage.setItem("gdpr_consent", "accepted");
      window.dispatchEvent(new Event("betredge:gdpr-consent"));
    });
    expect(mounted()).toBe(true);
  });

  it("l'evento del banner senza un consenso 'accepted' non basta", () => {
    render(<VercelAnalytics />);
    act(() => {
      localStorage.setItem("gdpr_consent", "declined");
      window.dispatchEvent(new Event("betredge:gdpr-consent"));
    });
    expect(mounted()).toBe(false);
  });

  it("Accept in un altro tab monta anche qui (evento storage)", () => {
    render(<VercelAnalytics />);
    act(() => {
      localStorage.setItem("gdpr_consent", "accepted");
      window.dispatchEvent(new StorageEvent("storage", { key: "gdpr_consent" }));
    });
    expect(mounted()).toBe(true);
  });

  it("uno storage event su un'altra chiave non sblocca nulla", () => {
    render(<VercelAnalytics />);
    act(() => {
      localStorage.setItem("gdpr_consent", "accepted");
      window.dispatchEvent(new StorageEvent("storage", { key: "agentic-lang" }));
    });
    expect(mounted()).toBe(false);
  });
});
