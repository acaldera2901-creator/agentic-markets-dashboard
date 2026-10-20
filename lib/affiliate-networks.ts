// #POSTBACK-1014 — one row per affiliate network = one account that sends us postbacks
// and owns one secret (env POSTBACK_SECRET_<ID>). Adding a network = one row here,
// one row per partner in PARTNER_NETWORK, one env var. No migration.
export type PostbackField = "clickid" | "event" | "amount" | "currency" | "payout" | "txn";

type Network = {
  // Query param the network reads OUR clickid from on the tracking link.
  // null = not confirmed by the network: /go records the click but redirects to the
  // link byte-for-byte unchanged. Turn it on only with the network's written
  // confirmation + a curl showing the redirect still lands with attribution intact.
  clickParam: string | null;
  // Inbound aliases on top of the canonical field names (always accepted).
  aliases?: Partial<Record<PostbackField, readonly string[]>>;
};

const DEFS = {
  playfina: { clickParam: "clickid" }, // Tech Affiliate: declared main macro
  ggbet: { clickParam: "click_id" }, // from the network's own link template (06/08)
  n1: { clickParam: null, aliases: { clickid: ["cid"], event: ["et"] } }, // Affilka example
  lynmonkel: { clickParam: null },
  bluewin: { clickParam: null },
  velobet: { clickParam: null },
  rootz: { clickParam: null },
  betwinner: { clickParam: null },
  rooster: { clickParam: null },
  ybets: { clickParam: null },
  ibet: { clickParam: null },
  tonybet: { clickParam: null },
  ultrapari: { clickParam: null },
} satisfies Record<string, Network>;
export type NetworkId = keyof typeof DEFS;
// Widened so every row exposes the optional `aliases` (a union of literals would not).
export const NETWORKS: Readonly<Record<NetworkId, Network>> = DEFS;

// Partner id (lib/partners) -> network. A partner missing here keeps its direct link
// and never goes through /go (today: slotsbonus, not an affiliate network).
export const PARTNER_NETWORK: Readonly<Record<string, NetworkId>> = {
  stonevegas: "playfina", betscore: "lynmonkel", casea: "lynmonkel",
  felicebet: "bluewin", velobet: "velobet", beazt: "rootz", wildz: "rootz",
  rollxo: "n1", hollywin: "n1", n1bet: "n1", ggbet: "ggbet",
  betwinner: "betwinner", fortuneplay: "rooster", ybets: "ybets",
  ibet: "ibet", tonybet: "tonybet", ultrapari: "ultrapari",
};

// Path segments come from the URL: plain `obj[key]` would accept "constructor"/"__proto__".
export const hasNetwork = (n: string): n is NetworkId => Object.hasOwn(DEFS, n);
export const networkOfPartner = (id: string): NetworkId | undefined =>
  Object.hasOwn(PARTNER_NETWORK, id) ? PARTNER_NETWORK[id] : undefined;
export const secretEnvOf = (n: NetworkId) => `POSTBACK_SECRET_${n.toUpperCase()}`;
export const hrefFor = (partnerId: string, directUrl: string) =>
  networkOfPartner(partnerId) ? `/go/${partnerId}` : directUrl;
