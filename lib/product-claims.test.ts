import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOME_FAQ, homeFaq } from "./home-faq";
import { CRM_LANGS, renewalClause, renderCrm } from "./crm-content";

const landing = readFileSync("app/landing-client.tsx", "utf8");
const desk = readFileSync("app/app/page.tsx", "utf8");
const terms = readFileSync("app/terms/page.tsx", "utf8");
beforeEach(() => vi.stubEnv("CRM_UNSUB_SECRET", "copy-test-secret-never-production"));
afterEach(() => vi.unstubAllEnvs());

describe("product copy matches the available evidence", () => {
  it("live means scores/status with frozen pre-match estimates", () => {
    expect(HOME_FAQ.en[3][1]).toMatch(/scores.*status/i);
    expect(HOME_FAQ.en[3][1]).toMatch(/pre-match.*frozen/i);
    expect(HOME_FAQ.it[3][1]).toMatch(/pre-partita.*congelat/i);
    expect(landing).not.toMatch(/model updates while the match runs|Probabilities that update as the match state changes|probabilità che si aggiornano al cambiare/i);
  });
  it("does not promise abstention below the floor or an untouched universal history", () => {
    expect(landing).not.toMatch(/We never force one|Non lo forziamo mai|Below our confidence floor we publish|Sotto la soglia di confidenza pubblichiamo|Nothing edited after the fact|Nulla modificato a posteriori/);
    expect(landing).toMatch(/reconstructed.*regraded/i);
    expect(landing).toMatch(/ricostruit.*riclassificat/i);
    expect(HOME_FAQ.en[1][1]).toMatch(/prospective ledger/i);
    expect(HOME_FAQ.en[1][1]).toMatch(/reconstructed/i);
  });
  it("keeps Shopify renewal uncertain in all five CRM languages", () => {
    for (const lang of CRM_LANGS) {
      expect(renewalClause(lang, "shopify")).toMatch(/checkout/i);
      expect(renewalClause(lang, "shopify")).not.toBe(renewalClause(lang, "paygate"));
      for (const key of ["ret_7d_before", "ret_3d_before", "ret_1d_before"]) {
        const mail = renderCrm(key, lang, "reader@example.com", { planSource: "shopify" });
        expect(mail?.text).toMatch(/checkout/i);
      }
    }
  });
  it("does not make universal automatic renewal or cancellation promises", () => {
    expect(HOME_FAQ.en[0][1]).toMatch(/checkout.*account/i);
    expect(HOME_FAQ.en[0][1]).not.toMatch(/They renew automatically|nothing further is charged/);
    expect(desk).not.toMatch(/Subscription: renews automatically|Abbonamento: si rinnova automaticamente|Card or crypto · auto-renewing|BetRedge Pro · monthly renewal/);
    expect(terms).not.toContain("You may cancel at any time. Cancellation stops future renewals");
    expect(terms).toMatch(/renewal conditions.*checkout/i);
  });
  it("keeps FAQ visible and structured data on the same translated source", () => {
    for (const lang of ["en", "it", "es", "fr", "ru"]) expect(homeFaq(lang)).toHaveLength(6);
    expect(landing).toContain("homeFaq(");
    expect(readFileSync("app/page.tsx", "utf8")).toContain("HOME_FAQ");
  });
});
