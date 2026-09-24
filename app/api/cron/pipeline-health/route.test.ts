import { it, expect, vi, beforeEach } from "vitest";

const dbQuery = vi.fn();
const opsAlert = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery }));
vi.mock("@/lib/ops-alert", () => ({ opsAlert }));
// Il mock deve guardare l'HEADER, non solo il secret: altrimenti il test del 401
// passerebbe per finta (verifyBearer tornerebbe true anche senza authorization).
vi.mock("@/lib/admin-auth", () => ({
  verifyBearer: (r: Request, s?: string) => Boolean(s) && r.headers.get("authorization") === `Bearer ${s}`,
}));

function req() {
  return new Request("https://x/api/cron/pipeline-health", {
    headers: { authorization: "Bearer sekret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "sekret";
});

it("401 senza cron secret", async () => {
  const { GET } = await import("./route");
  const res = await GET(new Request("https://x/api/cron/pipeline-health"));
  expect(res.status).toBe(401);
});

it("tutte le leghe con partite future: nessun alert", async () => {
  dbQuery.mockResolvedValueOnce([
    { league: "PL", upcoming: 9, last_updated: "2026-09-24T10:00:00Z" },
    { league: "SA", upcoming: 7, last_updated: "2026-09-24T10:00:00Z" },
    { league: "PD", upcoming: 8, last_updated: "2026-09-24T10:00:00Z" },
    { league: "BL1", upcoming: 6, last_updated: "2026-09-24T10:00:00Z" },
    { league: "FL1", upcoming: 5, last_updated: "2026-09-24T10:00:00Z" },
  ]);
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.stale).toEqual([]);
  expect(opsAlert).not.toHaveBeenCalled();
});

it("una lega senza partite future: alert con quella lega nominata", async () => {
  dbQuery.mockResolvedValueOnce([
    { league: "PL", upcoming: 9, last_updated: "2026-09-24T10:00:00Z" },
    { league: "SA", upcoming: 0, last_updated: "2026-09-20T21:01:00Z" },
    { league: "PD", upcoming: 8, last_updated: "2026-09-24T10:00:00Z" },
    { league: "BL1", upcoming: 6, last_updated: "2026-09-24T10:00:00Z" },
    { league: "FL1", upcoming: 5, last_updated: "2026-09-24T10:00:00Z" },
  ]);
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.stale).toEqual(["SA"]);
  expect(opsAlert).toHaveBeenCalledTimes(1);
  const [source, lines] = opsAlert.mock.calls[0];
  expect(source).toBe("pipeline-health/football-data-org");
  expect(lines[0]).toContain("Serie A");
  expect(lines[0]).toContain("2026-09-20");
});

it("lega assente dal risultato (mai una riga): trattata come stale", async () => {
  dbQuery.mockResolvedValueOnce([
    { league: "PL", upcoming: 9, last_updated: "2026-09-24T10:00:00Z" },
  ]);
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.stale).toEqual(expect.arrayContaining(["SA", "PD", "BL1", "FL1"]));
});

it("dbQuery vuoto (query fallita): tutte e 5 stale, un solo alert", async () => {
  dbQuery.mockResolvedValueOnce([]);
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.stale).toHaveLength(5);
  expect(opsAlert).toHaveBeenCalledTimes(1);
});
