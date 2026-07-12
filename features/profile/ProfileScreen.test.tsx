import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseProfile = vi.fn();
vi.mock("./use-profile", () => ({ useProfile: () => mockUseProfile() }));

const mockUseReferral = vi.fn();
vi.mock("./use-referral", () => ({ useReferral: () => mockUseReferral() }));

import { ProfileScreen } from "./ProfileScreen";

const logoutMock = vi.fn().mockResolvedValue(undefined);
const claimMock = vi.fn();

beforeEach(() => {
  mockUseProfile.mockReset();
  logoutMock.mockClear();
  localStorage.clear();
  mockUseReferral.mockReturnValue({
    code: null, signups: 0, paid: 0, loading: false, error: null, claim: claimMock,
  });
});

describe("ProfileScreen", () => {
  it("stato loading → placeholder", () => {
    mockUseProfile.mockReturnValue({ profile: null, loading: true, error: null, loggedIn: false, logout: logoutMock });
    render(<ProfileScreen />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("anonimo → CTA accedi/crea account, niente dati account", () => {
    mockUseProfile.mockReturnValue({ profile: null, loading: false, error: null, loggedIn: false, logout: logoutMock });
    render(<ProfileScreen />);
    expect(screen.getByRole("button", { name: /accedi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crea account/i })).toBeInTheDocument();
    expect(screen.queryByText("a@b.c")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profilo/i })).toHaveAttribute("aria-current", "page");
  });

  it("loggato → mostra nome/email/piano, referral-slot, link piani, Logout funzionante", async () => {
    const user = userEvent.setup();
    mockUseProfile.mockReturnValue({
      profile: { identifier: "a@b.c", name: "Andrea", plan: "premium", planExpiresAt: "2026-08-01T00:00:00Z" },
      loading: false,
      error: null,
      loggedIn: true,
      logout: logoutMock,
    });
    render(<ProfileScreen />);

    expect(screen.getByText("Andrea")).toBeInTheDocument();
    expect(screen.getByText("a@b.c")).toBeInTheDocument();
    expect(screen.getByText(/\$29\.99/)).toBeInTheDocument();
    expect(screen.getByText(/scadenza/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gestisci piano|vedi piani/i })).toBeInTheDocument();
    expect(screen.getByTestId("referral-slot")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profilo/i })).toHaveAttribute("aria-current", "page");

    const logoutBtn = screen.getByRole("button", { name: /logout/i });
    await user.click(logoutBtn);
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("loggato con piano free → mostra Piano Free", () => {
    mockUseProfile.mockReturnValue({
      profile: { identifier: "free@b.c", name: null, plan: "free", planExpiresAt: null },
      loading: false,
      error: null,
      loggedIn: true,
      logout: logoutMock,
    });
    render(<ProfileScreen />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/piano free/i)).toBeInTheDocument();
  });

  it("loggato con piano admin_full → mostra Accesso completo", () => {
    mockUseProfile.mockReturnValue({
      profile: { identifier: "admin@b.c", name: "Admin", plan: "admin_full", planExpiresAt: null },
      loading: false,
      error: null,
      loggedIn: true,
      logout: logoutMock,
    });
    render(<ProfileScreen />);
    expect(screen.getByText(/accesso completo/i)).toBeInTheDocument();
  });
});
