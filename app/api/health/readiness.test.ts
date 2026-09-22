import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CORE_AGENTS } from "@/lib/agent-roster";
const mock = vi.hoisted(() => ({ query: vi.fn(), authorized: false }));
vi.mock("@/lib/db", () => ({ dbQuery: mock.query }));
vi.mock("@/lib/admin-auth", () => ({ verifyBearer: () => mock.authorized }));
import { GET } from "./route";
beforeEach(() => {
  vi.stubEnv("FLEET_EXPECTED_CODE_SHA", "abcdef12");
  mock.authorized = false;
  mock.query.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM agent_heartbeats")) return CORE_AGENTS.map(agent_name => ({ agent_name, last_seen: new Date().toISOString(), status_detail: JSON.stringify({ code_sha: "abcdef12" }) }));
    return [];
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("health readiness integration", () => {
  it("public heartbeat-green status is no longer green when AH data are empty", async () => {
    const body = await (await GET(new Request("https://local/api/health"))).json();
    expect(body).toMatchObject({ status: "warning", liveness: "ok" });
    expect(body).not.toHaveProperty("readiness");
    expect(body).not.toHaveProperty("fleet");
    expect(body).not.toHaveProperty("agents");
  });
  it("authenticated monitoring distinguishes empty data from an unavailable query", async () => {
    mock.authorized = true;
    mock.query.mockImplementation(async (sql: string) => {
      if (sql.includes("ah_odds_history")) throw new Error("DB unavailable");
      return [];
    });
    const body = await (await GET(new Request("https://local/api/health"))).json();
    expect(body.readiness.runtime.ah_history.state).toBe("unavailable");
    expect(body.status).toBe("degraded");
    expect(body.readiness.history.leagues).toBeDefined();
  });
});
