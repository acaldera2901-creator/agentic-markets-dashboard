import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbQuery, dbExecute } = vi.hoisted(() => ({ dbQuery: vi.fn(), dbExecute: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery, dbExecute }));
vi.mock("@/lib/auth", () => ({ getSessionPlan: vi.fn() }));
import { GET, POST, DELETE } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("retired leaderboard API", () => {
  it.each([GET, POST, DELETE])("returns Gone without reading or changing historical data", async (handler) => {
    const response = await handler();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "Leaderboard is no longer available." });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(dbQuery).not.toHaveBeenCalled();
    expect(dbExecute).not.toHaveBeenCalled();
  });
});
