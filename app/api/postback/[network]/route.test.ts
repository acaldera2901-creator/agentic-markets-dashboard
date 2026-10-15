import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// #POSTBACK-1014 — /api/postback/[network]: per-network secret (fail-closed), raw
// payload always stored, aliases from the registry, idempotent via dedup_key.

const dbExecute = vi.fn();
vi.mock("@/lib/db", () => ({ dbExecute }));

const load = async () => (await import("./route")).GET;
let ip = 0;

const call = async (network: string, query: string) =>
  (await load())(
    new Request(`https://www.betredge.com/api/postback/${network}?${query}`, {
      headers: { "x-forwarded-for": `10.0.0.${++ip % 250}` },
    }),
    { params: Promise.resolve({ network }) },
  );

const SECRETS = { POSTBACK_SECRET_PLAYFINA: "s-playfina", POSTBACK_SECRET_N1: "s-n1", POSTBACK_SECRET_ULTRAPARI: "s-ultra" };
const params = () => dbExecute.mock.calls[0][1] as unknown[];
// [network, clickid, event, amount, currency, payout, txn, dedup, raw]

beforeEach(() => {
  vi.clearAllMocks();
  dbExecute.mockResolvedValue([]);
  Object.assign(process.env, SECRETS);
});
afterEach(() => {
  for (const k of Object.keys(SECRETS)) delete process.env[k];
});

describe("GET /api/postback/[network]", () => {
  it("404 on unknown networks and prototype keys, nothing written", async () => {
    for (const n of ["xyz", "constructor", "__proto__", "toString"]) {
      expect((await call(n, "key=s-playfina")).status, n).toBe(404);
    }
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("401 on wrong, missing, another network's key or missing env; nothing written", async () => {
    expect((await call("playfina", "key=nope&event=reg")).status).toBe(401);
    expect((await call("playfina", "event=reg")).status).toBe(401);
    expect((await call("playfina", "key=s-n1&event=reg")).status).toBe(401);
    expect((await call("ggbet", "key=&event=reg")).status).toBe(401); // no POSTBACK_SECRET_GGBET set
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("stores a registration with canonical names, without the key in raw", async () => {
    const res = await call("playfina", "key=s-playfina&event=reg&clickid=abc");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
    const p = params();
    expect(p.slice(0, 3)).toEqual(["playfina", "abc", "registration"]);
    expect(JSON.parse(p[8] as string)).toEqual({ event: "reg", clickid: "abc" });
    expect(dbExecute.mock.calls[0][0]).toMatch(/ON CONFLICT \(dedup_key\) DO NOTHING/);
  });

  it("parses amount/currency/payout/txn and dedups on txn", async () => {
    await call("playfina", "key=s-playfina&event=dep&clickid=abc&amount=50&currency=eur&payout=12.5&txn=T-1");
    expect(params()).toEqual(expect.arrayContaining([50, "EUR", 12.5, "T-1", "txn:playfina:T-1"]));
    expect(params()[2]).toBe("deposit");
  });

  it("accepts the n1 aliases cid/et", async () => {
    await call("n1", "key=s-n1&cid=xyz&et=dep");
    expect(params().slice(0, 3)).toEqual(["n1", "xyz", "deposit"]);
  });

  it("stores an unparsable payload with clickid and event NULL", async () => {
    expect((await call("ultrapari", "key=s-ultra&foo=bar")).status).toBe(200);
    const p = params();
    expect(p[1]).toBeNull();
    expect(p[2]).toBeNull();
    expect(JSON.parse(p[8] as string)).toEqual({ foo: "bar" });
  });

  it("without txn, the dedup key ignores param order and the key", async () => {
    await call("n1", "key=s-n1&cid=a&et=reg");
    await call("n1", "et=reg&cid=a&key=s-n1");
    const [a, b] = dbExecute.mock.calls.map((c) => c[1][7]);
    expect(a).toMatch(/^raw:n1:[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it("keeps unknown event names raw (lowercased, truncated)", async () => {
    await call("playfina", "key=s-playfina&event=Bonus_Claimed");
    expect(params()[2]).toBe("bonus_claimed");
  });

  it("500 when the DB write fails, so the network retries", async () => {
    dbExecute.mockRejectedValue(new Error("down"));
    expect((await call("playfina", "key=s-playfina&event=reg")).status).toBe(500);
  });
});
