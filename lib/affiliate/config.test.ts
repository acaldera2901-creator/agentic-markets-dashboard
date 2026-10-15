import { describe, it, expect } from "vitest";
import {
  affiliateConfig,
  affiliateMode,
  affiliatePayoutsMode,
  affiliatePolygonRpcUrl,
  affiliateTermsVersion,
  AFFILIATE_DEFAULTS,
  DEFAULT_POLYGON_RPC_URL,
  payoutConfig,
} from "./config";
import { validatePayoutWallet } from "./wallet";

const POLY = "0x1111111111111111111111111111111111111111";
const TREASURY = "0x72e348d948e984c7d57d8ccb93fdd52710e47fa2";

describe("payout config D1–D5: default raccomandati, non decisi (#AFFILIATE-V2-CRYPTO-1007)", () => {
  it("senza env: solo Polygon, solo USDT, fee a BetRedge, KYC al wallet, nessun wallet di uscita", () => {
    expect(payoutConfig({})).toEqual({
      networks: ["polygon"],
      coins: ["USDT"],
      networkFeePayer: "betredge",
      kycAtWallet: true,
      payoutFrom: null,
    });
  });

  it("le env valide cambiano la scelta senza toccare lo schema", () => {
    const c = payoutConfig({
      AFFILIATE_PAYOUT_NETWORKS: "polygon, TRON",
      AFFILIATE_PAYOUT_COINS: "usdt,usdc",
      AFFILIATE_NETWORK_FEE_PAYER: "affiliate",
      AFFILIATE_KYC_AT_WALLET: "false",
      AFFILIATE_PAYOUT_FROM: POLY,
    });
    expect(c).toEqual({
      networks: ["polygon", "tron"],
      coins: ["USDT", "USDC"],
      networkFeePayer: "affiliate",
      kycAtWallet: false,
      payoutFrom: POLY,
    });
  });

  it("env malformate ricadono sul default; un refuso non spegne il KYC", () => {
    const c = payoutConfig({
      AFFILIATE_PAYOUT_NETWORKS: "ethereum,solana",
      AFFILIATE_PAYOUT_COINS: "BTC",
      AFFILIATE_NETWORK_FEE_PAYER: "nessuno",
      AFFILIATE_KYC_AT_WALLET: "no grazie",
      AFFILIATE_PAYOUT_FROM: "0x123",
    });
    expect(c.networks).toEqual(["polygon"]);
    expect(c.coins).toEqual(["USDT"]);
    expect(c.networkFeePayer).toBe("betredge");
    expect(c.kycAtWallet).toBe(true);
    expect(c.payoutFrom).toBeNull();
  });

  it("USDC senza Polygon non esiste: con solo Tron resta USDT", () => {
    const c = payoutConfig({ AFFILIATE_PAYOUT_NETWORKS: "tron", AFFILIATE_PAYOUT_COINS: "USDC" });
    expect(c.networks).toEqual(["tron"]);
    expect(c.coins).toEqual(["USDT"]);
  });

  it("D2: il wallet degli incassi PayGate non vale come wallet di uscita (default = dedicato)", () => {
    expect(
      payoutConfig({ AFFILIATE_PAYOUT_FROM: TREASURY.toUpperCase().replace("0X", "0x"), PAYGATE_PAYOUT_WALLET: TREASURY })
        .payoutFrom,
    ).toBeNull();
    expect(payoutConfig({ AFFILIATE_PAYOUT_FROM: `0x${"0".repeat(40)}` }).payoutFrom).toBeNull();
    expect(payoutConfig({ AFFILIATE_PAYOUT_FROM: POLY, PAYGATE_PAYOUT_WALLET: TREASURY }).payoutFrom).toBe(POLY);
  });

  it("il validatore del wallet rispetta le reti/coin accese", () => {
    const enabled = payoutConfig({});
    expect(validatePayoutWallet({ coin: "USDT", network: "polygon", address: POLY }, enabled).ok).toBe(true);
    expect(validatePayoutWallet({ coin: "USDC", network: "polygon", address: POLY }, enabled)).toEqual({
      ok: false,
      reason: "coin_not_enabled",
    });
    expect(
      validatePayoutWallet({ coin: "USDT", network: "tron", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" }, enabled),
    ).toEqual({ ok: false, reason: "network_not_enabled" });
    // Senza `enabled` resta la validità di schema (come prima).
    expect(validatePayoutWallet({ coin: "USDC", network: "polygon", address: POLY }).ok).toBe(true);
  });
});

describe("affiliate config: i default approvati (#AFFILIATE-V2-0930)", () => {
  it("senza env: 20% / 7% / hold 60 / clawback 120 / soglia 50 / rinnovi illimitati / off", () => {
    const c = affiliateConfig({});
    expect(c).toEqual({
      firstRate: 0.2,
      renewalRate: 0.07,
      renewalMaxMonths: null,
      holdDays: 60,
      clawbackDays: 120,
      minPayoutUsd: 50,
      attributionWindowDays: 60,
      mode: "off",
    });
    expect(AFFILIATE_DEFAULTS.RENEWAL_MAX_MONTHS).toBeNull();
  });

  it("le env valide sovrascrivono i default", () => {
    const c = affiliateConfig({
      AFFILIATE_FIRST_RATE: "0.25",
      AFFILIATE_RENEWAL_RATE: "0.05",
      AFFILIATE_RENEWAL_MAX_MONTHS: "12",
      AFFILIATE_HOLD_DAYS: "30",
      AFFILIATE_CLAWBACK_DAYS: "90",
      AFFILIATE_MIN_PAYOUT_USD: "100",
      AFFILIATE_MODE: "shadow",
    });
    expect(c.firstRate).toBe(0.25);
    expect(c.renewalRate).toBe(0.05);
    expect(c.renewalMaxMonths).toBe(12);
    expect(c.holdDays).toBe(30);
    expect(c.clawbackDays).toBe(90);
    expect(c.minPayoutUsd).toBe(100);
    expect(c.mode).toBe("shadow");
  });

  it("env malformate ricadono sul default, mai su un valore inventato", () => {
    const c = affiliateConfig({
      AFFILIATE_FIRST_RATE: "20", // percento invece di frazione: fuori [0,1]
      AFFILIATE_RENEWAL_RATE: "abc",
      AFFILIATE_RENEWAL_MAX_MONTHS: "-3",
      AFFILIATE_HOLD_DAYS: "1.5",
      AFFILIATE_MIN_PAYOUT_USD: "-1",
    });
    expect(c.firstRate).toBe(0.2);
    expect(c.renewalRate).toBe(0.07);
    expect(c.renewalMaxMonths).toBeNull();
    expect(c.holdDays).toBe(60);
    expect(c.minPayoutUsd).toBe(50);
  });

  it("RENEWAL_MAX_MONTHS vuoto o 'null' = illimitato", () => {
    expect(affiliateConfig({ AFFILIATE_RENEWAL_MAX_MONTHS: "" }).renewalMaxMonths).toBeNull();
    expect(affiliateConfig({ AFFILIATE_RENEWAL_MAX_MONTHS: "null" }).renewalMaxMonths).toBeNull();
  });

  it("AFFILIATE_MODE: solo shadow|live accendono, qualunque altro valore è off", () => {
    expect(affiliateMode({})).toBe("off");
    expect(affiliateMode({ AFFILIATE_MODE: "live" })).toBe("live");
    expect(affiliateMode({ AFFILIATE_MODE: " Shadow " })).toBe("shadow");
    expect(affiliateMode({ AFFILIATE_MODE: "on" })).toBe("off");
    expect(affiliateMode({ AFFILIATE_MODE: "true" })).toBe("off");
    expect(affiliateMode({ AFFILIATE_MODE: "" })).toBe("off");
  });
});

describe("affiliateTermsVersion (PR-5)", () => {
  it("senza env: nessuna versione → iscrizione chiusa", () => {
    expect(affiliateTermsVersion({})).toBeNull();
    expect(affiliateTermsVersion({ AFFILIATE_TERMS_VERSION: "  " })).toBeNull();
  });
  it("versione valida, spazi tolti", () => {
    expect(affiliateTermsVersion({ AFFILIATE_TERMS_VERSION: " 2026-11-v1 " })).toBe("2026-11-v1");
  });
  it("valore malformato → null, non un testo arbitrario nel registro dei consensi", () => {
    expect(affiliateTermsVersion({ AFFILIATE_TERMS_VERSION: "v1; DROP TABLE" })).toBeNull();
  });
});

describe("payout admin config (PR-9)", () => {
  it("AFFILIATE_PAYOUTS: solo 'live' accende, default e refusi = off", () => {
    expect(affiliatePayoutsMode({})).toBe("off");
    expect(affiliatePayoutsMode({ AFFILIATE_PAYOUTS: " LIVE " })).toBe("live");
    for (const v of ["on", "true", "1", "liv", "shadow"]) expect(affiliatePayoutsMode({ AFFILIATE_PAYOUTS: v })).toBe("off");
  });
  it("RPC Polygon: solo https, altrimenti il default", () => {
    expect(affiliatePolygonRpcUrl({})).toBe(DEFAULT_POLYGON_RPC_URL);
    expect(affiliatePolygonRpcUrl({ AFFILIATE_POLYGON_RPC_URL: "https://rpc.example/x" })).toBe("https://rpc.example/x");
    expect(affiliatePolygonRpcUrl({ AFFILIATE_POLYGON_RPC_URL: "http://rpc.example" })).toBe(DEFAULT_POLYGON_RPC_URL);
    expect(affiliatePolygonRpcUrl({ AFFILIATE_POLYGON_RPC_URL: "nonsense" })).toBe(DEFAULT_POLYGON_RPC_URL);
  });
});
