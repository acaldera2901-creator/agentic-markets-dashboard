import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseReferral = vi.fn();
vi.mock("./use-referral", () => ({ useReferral: () => mockUseReferral() }));

import { ReferralSection } from "./ReferralSection";

const claimMock = vi.fn();

beforeEach(() => {
  mockUseReferral.mockReset();
  claimMock.mockReset();
});

describe("ReferralSection", () => {
  it("stato loading → placeholder", () => {
    mockUseReferral.mockReturnValue({
      code: null, signups: 0, paid: 0, loading: true, error: null, claim: claimMock,
    });
    render(<ReferralSection />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("errore reale (non 'nessun codice') → messaggio", () => {
    mockUseReferral.mockReturnValue({
      code: null, signups: 0, paid: 0, loading: false, error: "HTTP 500", claim: claimMock,
    });
    render(<ReferralSection />);
    expect(screen.getByText(/errore/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("code presente → mostra codice, link invito, contatori, niente reward $", () => {
    mockUseReferral.mockReturnValue({
      code: "ABC123", signups: 4, paid: 2, loading: false, error: null, claim: claimMock,
    });
    render(<ReferralSection />);
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText(/betredge\.com\/r\/ABC123/)).toBeInTheDocument();
    expect(screen.getByText(/4 iscritti/i)).toBeInTheDocument();
    expect(screen.getByText(/2 con piano/i)).toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/reward/i)).not.toBeInTheDocument();
  });

  it("nessun codice → form claim; submit chiama claim() col valore inserito", async () => {
    const user = userEvent.setup();
    claimMock.mockResolvedValue({ ok: true });
    mockUseReferral.mockReturnValue({
      code: null, signups: 0, paid: 0, loading: false, error: null, claim: claimMock,
    });
    render(<ReferralSection />);

    const input = screen.getByRole("textbox", { name: /codice/i });
    await user.type(input, "FRIEND10");
    const submitBtn = screen.getByRole("button", { name: /attiva codice/i });
    await user.click(submitBtn);

    expect(claimMock).toHaveBeenCalledWith("FRIEND10");
  });

  it("claim ritorna {ok:false, error} → messaggio inline", async () => {
    const user = userEvent.setup();
    claimMock.mockResolvedValue({ ok: false, error: "codice già in uso" });
    mockUseReferral.mockReturnValue({
      code: null, signups: 0, paid: 0, loading: false, error: null, claim: claimMock,
    });
    render(<ReferralSection />);

    const input = screen.getByRole("textbox", { name: /codice/i });
    await user.type(input, "TAKEN");
    const submitBtn = screen.getByRole("button", { name: /attiva codice/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/codice già in uso/i)).toBeInTheDocument();
  });
});
