import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import GlobalError from "./global-error";

// #INVITE-ROBUSTNESS-0813 — perché questi test esistono: il 2026-08-13 un utente
// ha visto questa schermata e non è rimasta NESSUNA traccia — né digest, né log,
// né evento. Undici ambienti riprodotti a mano per non trovare niente. Il
// boundary deve dire cosa è successo, altrimenti la prossima volta si ricomincia.

const err = Object.assign(new Error("boom"), { digest: "abc123" });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Il body della prima POST verso /api/track. */
function trackedBody(): Record<string, unknown> | null {
  const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/api/track"));
  if (!call) return null;
  return JSON.parse(String((call[1] as RequestInit).body));
}

describe("global-error", () => {
  it("mostra il messaggio e il bottone di ricarica", () => {
    render(<GlobalError error={err} reset={() => {}} />);
    expect(screen.getByText(/Qualcosa non ha caricato correttamente/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ricarica/i })).toBeInTheDocument();
  });

  it("riporta il digest dell'errore a /api/track", () => {
    render(<GlobalError error={err} reset={() => {}} />);
    const body = trackedBody();
    expect(body).not.toBeNull();
    expect(body!.event_type).toBe("client_error");
    const meta = body!.meta as Record<string, unknown>;
    expect(meta.digest).toBe("abc123");
    expect(meta.message).toBe("boom");
  });

  it("riporta dove e con cosa è successo, per poterlo riprodurre", () => {
    render(<GlobalError error={err} reset={() => {}} />);
    const meta = trackedBody()!.meta as Record<string, unknown>;
    expect(typeof meta.path).toBe("string");
    expect(typeof meta.ua).toBe("string");
    expect(String(meta.ua).length).toBeGreaterThan(0);
  });

  it("un errore senza digest si riporta lo stesso", () => {
    render(<GlobalError error={new Error("nudo")} reset={() => {}} />);
    const meta = trackedBody()!.meta as Record<string, unknown>;
    expect(meta.message).toBe("nudo");
    expect(meta.digest ?? null).toBeNull();
  });

  // La schermata d'errore è l'ultima cosa che resta all'utente: se il report
  // fallisse rumorosamente, sostituirebbe un errore con una pagina bianca.
  it("se il report fallisce, la schermata resta in piedi", () => {
    fetchMock.mockRejectedValue(new Error("rete giù"));
    expect(() => render(<GlobalError error={err} reset={() => {}} />)).not.toThrow();
    expect(screen.getByText(/Qualcosa non ha caricato correttamente/i)).toBeInTheDocument();
  });

  // Precedente in questo repo: `referral_code_claimed`, `referral_link_copied` e
  // `withdrawal_consent` erano GIÀ emessi dal client e scartati in silenzio
  // dall'allowlist di /api/track. Un report che non arriva è peggio di nessun
  // report: sembra che non sia successo niente.
  it("l'evento è nell'allowlist di /api/track, altrimenti il report sparisce", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "api", "track", "route.ts"),
      "utf8"
    );
    const allowlist = src.slice(src.indexOf("ALLOWED_EVENTS"), src.indexOf("]);", src.indexOf("ALLOWED_EVENTS")));
    expect(allowlist).toMatch(/"client_error"/);
  });

  it("non riporta due volte lo stesso errore", () => {
    const { rerender } = render(<GlobalError error={err} reset={() => {}} />);
    rerender(<GlobalError error={err} reset={() => {}} />);
    const posts = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/track"));
    expect(posts).toHaveLength(1);
  });
});
