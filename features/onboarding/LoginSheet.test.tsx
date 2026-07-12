import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginSheet } from "./LoginSheet";

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
  return user;
}

describe("LoginSheet", () => {
  it("non rende nulla se chiuso", () => {
    const { container } = render(<LoginSheet open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra i campi email e password quando aperto", () => {
    render(<LoginSheet open onClose={() => {}} />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("submit disabilitato finché email+password non sono compilate", async () => {
    render(<LoginSheet open onClose={() => {}} />);
    const submit = screen.getByRole("button", { name: /^accedi$/i });
    expect(submit).toBeDisabled();
    await fillRequired();
    expect(submit).toBeEnabled();
  });

  it("submit con email+password chiama fetch con action:login + identifier/password, poi refresh+onClose su ok", async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ identifier: "a@b.c", plan: "free", name: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginSheet open onClose={onClose} />);
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: /^accedi$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth");
    expect(opts.credentials).toBe("include");
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      action: "login",
      identifier: "a@b.c",
      password: "supersecret1",
    });

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("su risposta 401 mostra errore inline specifico e non chiama onClose", async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_credentials" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginSheet open onClose={onClose} />);
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: /^accedi$/i }));

    await waitFor(() =>
      expect(screen.getByText(/email o password non validi/i)).toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("su risposta non-ok generica (500) mostra errore generico e non chiama onClose", async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginSheet open onClose={onClose} />);
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: /^accedi$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => {
      const err = screen.getByText(/non riuscit|riprova/i);
      expect(err).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("il link 'Password dimenticata?' punta a /reset-password", () => {
    render(<LoginSheet open onClose={() => {}} />);
    expect(screen.getByRole("link", { name: /password dimenticata/i })).toHaveAttribute(
      "href",
      "/reset-password"
    );
  });

  it("il link 'Crea account' chiama onSignup", async () => {
    const onSignup = vi.fn();
    render(<LoginSheet open onClose={() => {}} onSignup={onSignup} />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/crea account/i));
    expect(onSignup).toHaveBeenCalledOnce();
  });
});
