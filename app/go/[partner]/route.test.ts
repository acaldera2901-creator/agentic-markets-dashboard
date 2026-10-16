import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// #POSTBACK-1014 — /go/[partner]: records the click and 302s to the partner's real
// tracking link. The invariant that protects existing attribution: for a network whose
// clickid param is not confirmed, the Location is the current link BYTE FOR BYTE.

const dbQuery = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery,dbExecute:dbQuery }));
// `after()` needs a request scope that vitest does not have: run the callback inline.
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => { void fn(); },
}));

const load = async () => (await import("./route")).GET;
const { NETWORKS, PARTNER_NETWORK } = await import("@/lib/affiliate-networks");
const { targetUrlFor } = await import("@/lib/partners");

const CCS = ["", "NO", "CH", "FI", "IT", "IN", "BR", "NG"];

const call = async (partner: string, cc?: string) => {
  const headers: Record<string, string> = cc ? { "x-vercel-ip-country": cc } : {};
  return (await load())(new Request(`https://www.betredge.com/go/${partner}`, { headers }), {
    params: Promise.resolve({ partner }),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV","production");
  dbQuery.mockResolvedValue([]);
});

afterEach(()=>vi.unstubAllEnvs());

describe("GET /go/[partner]", () => {
  it("leaves the link byte-for-byte unchanged for every network without a confirmed param", async () => {
    let checked = 0;
    for (const [partner, network] of Object.entries(PARTNER_NETWORK)) {
      if (NETWORKS[network].clickParam !== null) continue;
      for (const cc of CCS) {
        const target = targetUrlFor(partner, cc);
        if (!target) continue; // e.g. BetWinner outside its geos: covered below
        const res = await call(partner, cc || undefined);
        expect(res.status, `${partner}/${cc}`).toBe(302);
        expect(res.headers.get("location"), `${partner}/${cc}`).toBe(target);
        expect(res.headers.get("cache-control")).toBe("no-store");
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("keeps BetWinner's encoded query intact (%2F is not re-serialised)", async () => {
    const res = await call("betwinner", "NG");
    expect(res.headers.get("location")).toBe("https://bwredir.com/3aME?p=%2Fregistration%2F");
  });

  it("appends our clickid only on the networks that declared the param", async () => {
    for (const [partner, param] of [["stonevegas", "clickid"], ["ggbet", "click_id"]] as const) {
      const target = targetUrlFor(partner, "NO")!;
      const loc = (await call(partner, "NO")).headers.get("location")!;
      expect(loc.startsWith(`${target}&${param}=`), loc).toBe(true);
      expect(loc.slice(`${target}&${param}=`.length)).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("records the click with network, clickid_sent and country", async () => {
    await call("stonevegas", "no");
    await call("rollxo", "DE");
    expect(dbQuery).toHaveBeenCalledTimes(2);
    const [sql1, p1] = dbQuery.mock.calls[0];
    expect(sql1).toMatch(/INSERT INTO partner_clicks \(clickid, partner, network, clickid_sent, country\)/);
    expect(p1).toEqual([expect.stringMatching(/^[0-9a-f]{32}$/), "stonevegas", "playfina", true, "NO"]);
    expect(dbQuery.mock.calls[1][1].slice(1)).toEqual(["rollxo", "n1", false, "DE"]);
  });

  it("the clickid in the Location is the one recorded", async () => {
    const loc = (await call("stonevegas", "NO")).headers.get("location")!;
    expect(loc.endsWith(`clickid=${dbQuery.mock.calls[0][1][0]}`)).toBe(true);
  });

  it("sends unknown, non-network or out-of-geo partners to /partners without writing", async () => {
    for (const [partner, cc] of [["slotsbonus", "IT"], ["sconosciuto", "IT"], ["constructor", "IT"], ["betwinner", "IT"], ["betwinner", undefined]] as const) {
      const res = await call(partner, cc);
      expect(res.status, partner).toBe(302);
      expect(res.headers.get("location"), partner).toBe("https://www.betredge.com/partners");
    }
    expect(dbQuery).not.toHaveBeenCalled();
  });
});

it('preview preserves redirects and clickid contract while avoiding production analytics writes',async()=>{vi.stubEnv('VERCEL_ENV','preview');const res=await call('stonevegas','NO');expect(res.status).toBe(302);expect(res.headers.get('location')).toMatch(/clickid=[a-f0-9]{32}$/);expect(dbQuery).not.toHaveBeenCalled();});
