import { describe, it, expect } from "vitest";
import { NETWORKS, PARTNER_NETWORK, hasNetwork, hrefFor, networkOfPartner, secretEnvOf } from "@/lib/affiliate-networks";
import { PARTNERS } from "@/lib/partners";

// #POSTBACK-1014 — the network registry. What these tests defend: a partner can only
// go through /go if it exists in the catalog, a network's clickid param is only ever
// switched on with the network's confirmation (today: playfina and ggbet), and path
// segments from the URL cannot hit Object.prototype keys.
describe("affiliate network registry", () => {
  const ids = PARTNERS.map((p) => p.id);

  it("every mapped partner exists in the catalog, on a registered network", () => {
    for (const [partner, network] of Object.entries(PARTNER_NETWORK)) {
      expect(ids, `${partner} is not in lib/partners`).toContain(partner);
      expect(hasNetwork(network), `${partner} -> unknown network ${network}`).toBe(true);
    }
  });

  it("every catalog partner has a network except slotsbonus (not an affiliate network)", () => {
    expect(ids.filter((id) => !networkOfPartner(id))).toEqual(["slotsbonus"]);
  });

  it("the clickid param is switched on only for the networks that declared it", () => {
    const active = Object.entries(NETWORKS).filter(([, n]) => n.clickParam !== null);
    expect(Object.fromEntries(active.map(([id, n]) => [id, n.clickParam]))).toEqual({
      playfina: "clickid",
      ggbet: "click_id",
    });
  });

  it("ultrapari is a registered network but not yet a partner on the site", () => {
    expect(hasNetwork("ultrapari")).toBe(true);
    expect(NETWORKS.ultrapari.clickParam).toBeNull();
    expect(Object.values(PARTNER_NETWORK)).not.toContain("ultrapari");
  });

  it("has 13 networks", () => {
    expect(Object.keys(NETWORKS)).toHaveLength(13);
  });

  it("URL segments cannot match prototype keys", () => {
    for (const k of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(hasNetwork(k), k).toBe(false);
      expect(networkOfPartner(k), k).toBeUndefined();
    }
  });

  it("derives the secret env from the network id", () => {
    expect(secretEnvOf("playfina")).toBe("POSTBACK_SECRET_PLAYFINA");
    expect(secretEnvOf("ultrapari")).toBe("POSTBACK_SECRET_ULTRAPARI");
  });

  it("hrefFor sends network partners through /go and leaves the others direct", () => {
    expect(hrefFor("rollxo", "https://rollxo.media/x")).toBe("/go/rollxo");
    expect(hrefFor("slotsbonus", "https://slotsbonus.bet/?a=1")).toBe("https://slotsbonus.bet/?a=1");
    expect(hrefFor("constructor", "https://x.test/")).toBe("https://x.test/");
  });
});
