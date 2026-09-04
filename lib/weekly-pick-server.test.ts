// #WEEKLY-PICK-CLOSED-0904 — stato della settimana per le guardie d'acquisto.
import { describe, it, expect, vi, beforeEach } from "vitest";

const dbQueryStrict = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(), dbQueryStrict, dbExecute: vi.fn() }));
vi.mock("@/lib/email", () => ({ weeklyPickReceiptEmail: vi.fn() }));
vi.mock("@/lib/notify", () => ({ sendTransactional: vi.fn() }));

const load = () => import("./weekly-pick-server");

const legs = [
  { id: "wp_a", label: "A vs B", sport: "tennis", market: "A", prob: 0.9 },
  { id: "wp_b", label: "C vs D", sport: "tennis", market: "D", prob: 0.9 },
];
const pred = (id: string, result: string | null) => ({ id, status: result ? "settled" : "pending", result, starts_at: "2026-08-31T18:00:00+00:00" });

beforeEach(() => vi.clearAllMocks());

describe("weeklyPickWeekStateStrict", () => {
  it("nessuna riga per la settimana → exists=false (il chiamante risponde 404)", async () => {
    dbQueryStrict.mockResolvedValueOnce([]);
    const s = await (await load()).weeklyPickWeekStateStrict("2026-09-07");
    expect(s).toEqual({ exists: false, legs: 0, remaining: 0 });
    expect((await load()).weeklyPickClosed(s)).toBe(false);
    expect(dbQueryStrict).toHaveBeenCalledTimes(1);
  });

  it("tutte le gambe decise → remaining 0 → CHIUSA (il caso misurato in prod il 04/09)", async () => {
    dbQueryStrict.mockResolvedValueOnce([{ selections: JSON.stringify(legs) }]);
    dbQueryStrict.mockResolvedValueOnce([pred("a", "won"), pred("b", "won")]);
    const s = await (await load()).weeklyPickWeekStateStrict("2026-08-31");
    expect(s).toEqual({ exists: true, legs: 2, remaining: 0 });
    expect((await load()).weeklyPickClosed(s)).toBe(true);
    expect(String(dbQueryStrict.mock.calls[1][0])).toContain("IN ($1, $2)");
    expect(dbQueryStrict.mock.calls[1][1]).toEqual(["a", "b"]);
  });

  it("una gamba ancora da giocare → APERTA, anche se un'altra è persa", async () => {
    dbQueryStrict.mockResolvedValueOnce([{ selections: legs }]);
    dbQueryStrict.mockResolvedValueOnce([pred("a", "lost")]);
    const s = await (await load()).weeklyPickWeekStateStrict("2026-08-31");
    expect(s).toEqual({ exists: true, legs: 2, remaining: 1 });
    expect((await load()).weeklyPickClosed(s)).toBe(false);
  });

  it("riga senza gambe → exists ma NON chiusa (vuota, non finita)", async () => {
    dbQueryStrict.mockResolvedValueOnce([{ selections: [] }]);
    const s = await (await load()).weeklyPickWeekStateStrict("2026-08-31");
    expect(s).toEqual({ exists: true, legs: 0, remaining: 0 });
    expect((await load()).weeklyPickClosed(s)).toBe(false);
    expect(dbQueryStrict).toHaveBeenCalledTimes(1);
  });

  it("errore DB → propaga (fail-loud), non degrada ad aperta", async () => {
    dbQueryStrict.mockRejectedValueOnce(new Error("timeout"));
    await expect((await load()).weeklyPickWeekStateStrict("2026-08-31")).rejects.toThrow("timeout");
  });
});
