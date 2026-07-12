import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupSheet } from "./SignupSheet";

const refresh = vi.fn().mockResolvedValue(undefined);

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({ user: null, plan: null, loading: false, refresh }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

async function fillRequired() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^email$/i), "a@b.c");
  await user.type(screen.getByLabelText(/^password$/i), "supersecret1");
  await user.click(screen.getByLabelText(/\+18/i));
  await user.click(screen.getByLabelText(/termini/i));
  return user;
}

describe("SignupSheet", () => {
  it("non rende nulla se chiuso", () => {
    const { container } = render(
      <SignupSheet open={false} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra i campi e le 2 checkbox obbligatorie quando aperto", () => {
    render(<SignupSheet open onClose={() => {}} />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/\+18/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/termini/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/marketing/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /termini/i })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute("href", "/privacy");
  });

  it("submit disabilitato finché email+password+entrambe le checkbox obbligatorie non sono compilate", async () => {
    render(<SignupSheet open onClose={() => {}} />);
    const submit = screen.getByRole("button", { name: /crea account/i });
    expect(submit).toBeDisabled();
    await fillRequired();
    expect(submit).toBeEnabled();
  });

  it("submit con tutto compilato chiama fetch con action:register + consent flags, poi refresh+onClose su ok", async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ identifier: "a@b.c", plan: "free", name: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SignupSheet open onClose={onClose} />);
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: /crea account/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth");
    expect(opts.credentials).toBe("include");
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      action: "register",
      identifier: "a@b.c",
      password: "supersecret1",
      language: "it",
      age_confirmed: true,
      tos_accepted: true,
      marketing_opt_in: false,
    });

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("su risposta non-ok mostra un errore inline e non chiama onClose", async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "consent_required" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SignupSheet open onClose={onClose} />);
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: /crea account/i }));

    await waitFor(() =>
      expect(screen.getByText(/18\+.*termini|termini.*18\+/i)).toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("il link 'Hai già un account? Accedi' chiama onLogin", async () => {
    const onLogin = vi.fn();
    render(<SignupSheet open onClose={() => {}} onLogin={onLogin} />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/accedi/i));
    expect(onLogin).toHaveBeenCalledOnce();
  });

  it("su risposta 202 pending_activation mostra messaggio inline e non chiama refresh/onClose", async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ pending_activation: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SignupSheet open onClose={onClose} />);
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: /crea account/i }));

    await waitFor(() =>
      expect(screen.getByText(/email di attivazione.*controlla la posta/i)).toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("con email+password+ToS ma senza age, submit button resta disabilitato", async () => {
    render(<SignupSheet open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^email$/i), "a@b.c");
    await user.type(screen.getByLabelText(/^password$/i), "supersecret1");
    await user.click(screen.getByLabelText(/termini/i));
    // age NOT checked
    const submit = screen.getByRole("button", { name: /crea account/i });
    expect(submit).toBeDisabled();
  });
});
