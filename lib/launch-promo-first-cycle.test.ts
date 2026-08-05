// #LAUNCH-PROMO-CARD-0805 — «il 50% SOLO per il primo mese»: la prova.
//
// Michele ha chiesto di assicurarsi che lo sconto valga solo sul primo ciclo e che
// poi si torni a prezzo pieno. Qui c'è la verifica del pezzo che il NOSTRO server
// controlla (rail PayGate, PayPal, crypto): `discountedAmountFor` sconta solo se
// `firstPaidOrder`, e `promoEligibility` mette firstPaidOrder=false appena esiste
// un ordine pagato su QUALUNQUE rail (compreso Shopify, dopo #LAUNCH-PROMO-CARD).
//
// ⚠️ Sul rail CARTA il "solo primo ciclo" NON lo decide questo codice: lo decide la
// configurazione del selling plan di lancio nello store (`fixed` sul ciclo 1 +
// `recurring afterCycle: 1`). Da qui non è testabile — va verificato nell'admin
// Shopify, ed è scritto nella REQ. Quello che questo file garantisce è che noi non
// scontiamo mai un rinnovo, su nessun rail che controlliamo.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { discountedAmountFor, amountFor, launchPromoActive, LAUNCH_PROMO_DISCOUNT, type PlanKey, type Period } from "./paygate";
import { weeklyPickAmount } from "./weekly-pick";

const ENV = { ...process.env };
const FUTURE = "2026-09-04T23:59:00Z";   // la deadline decisa da Andrea (#PROMO-B)
const PAST = "2026-08-01T00:00:00Z";

function promoOn(deadline = FUTURE) {
  process.env.LAUNCH_PROMO_ENABLED = "true";
  process.env.LAUNCH_PROMO_DEADLINE = deadline;
}

beforeEach(() => {
  delete process.env.LAUNCH_PROMO_ENABLED;
  delete process.env.LAUNCH_PROMO_DEADLINE;
});
afterEach(() => {
  process.env = { ...ENV };
});

const CASES: Array<[PlanKey, Period]> = [
  ["base", "monthly"], ["base", "annual"], ["premium", "monthly"], ["premium", "annual"],
];
const NOW = new Date("2026-08-10T12:00:00Z");

describe("lo sconto vale SOLO sul primo ordine", () => {
  it("primo ordine → metà prezzo; rinnovo → prezzo PIENO", () => {
    promoOn();
    for (const [plan, period] of CASES) {
      const full = amountFor(plan, period);
      const first = discountedAmountFor(plan, period, { firstPaidOrder: true, now: NOW });
      const renewal = discountedAmountFor(plan, period, { firstPaidOrder: false, now: NOW });

      expect(first.discounted, `${plan}/${period} primo`).toBe(true);
      expect(first.amount).toBe(Math.round(full * (1 - LAUNCH_PROMO_DISCOUNT) * 100) / 100);

      // È QUESTA la garanzia "solo il primo": il secondo ordine paga tutto.
      expect(renewal.discounted, `${plan}/${period} rinnovo`).toBe(false);
      expect(renewal.amount).toBe(full);
    }
  });

  it("lo sconto è esattamente il 50%, non un valore approssimato", () => {
    promoOn();
    expect(discountedAmountFor("base", "monthly", { firstPaidOrder: true, now: NOW }).amount).toBe(7.5);
    expect(discountedAmountFor("premium", "monthly", { firstPaidOrder: true, now: NOW }).amount).toBe(15);
    expect(discountedAmountFor("base", "annual", { firstPaidOrder: true, now: NOW }).amount).toBe(82.5);
    expect(discountedAmountFor("premium", "annual", { firstPaidOrder: true, now: NOW }).amount).toBe(165);
  });

  it("la Weekly Pick segue la stessa costante, non una sua", () => {
    promoOn();
    const wp = weeklyPickAmount(NOW);
    expect(wp.discounted).toBe(true);
    expect(wp.amount).toBe(Math.round(wp.fullAmount * (1 - LAUNCH_PROMO_DISCOUNT) * 100) / 100);
    expect(wp.amount).toBe(6.5); // 12.99 → 6.50 (arrotondamento del codice)
  });
});

describe("la promo si spegne da sé: nessuno sconto fuori campagna", () => {
  it("flag spento → prezzo pieno anche al primo ordine", () => {
    process.env.LAUNCH_PROMO_DEADLINE = FUTURE; // deadline sì, flag no
    expect(launchPromoActive(NOW)).toBe(false);
    for (const [plan, period] of CASES) {
      const d = discountedAmountFor(plan, period, { firstPaidOrder: true, now: NOW });
      expect(d.discounted, `${plan}/${period}`).toBe(false);
      expect(d.amount).toBe(amountFor(plan, period));
    }
  });

  it("deadline assente → promo OFF anche col flag acceso (guardia anti-dark-pattern)", () => {
    process.env.LAUNCH_PROMO_ENABLED = "true";
    expect(launchPromoActive(NOW)).toBe(false);
    expect(discountedAmountFor("base", "monthly", { firstPaidOrder: true, now: NOW }).discounted).toBe(false);
  });

  it("deadline PASSATA → si spegne da sola, senza toccare nulla", () => {
    promoOn(PAST);
    expect(launchPromoActive(NOW)).toBe(false);
    for (const [plan, period] of CASES) {
      expect(discountedAmountFor(plan, period, { firstPaidOrder: true, now: NOW }).amount)
        .toBe(amountFor(plan, period));
    }
    expect(weeklyPickAmount(NOW).discounted).toBe(false);
  });

  it("l'istante esatto della scadenza NON è più scontato", () => {
    promoOn("2026-09-04T23:59:00Z");
    const justBefore = new Date("2026-09-04T23:58:59Z");
    const exact = new Date("2026-09-04T23:59:00Z");
    expect(launchPromoActive(justBefore)).toBe(true);
    expect(launchPromoActive(exact)).toBe(false);
    expect(discountedAmountFor("base", "monthly", { firstPaidOrder: true, now: exact }).discounted).toBe(false);
  });

  it("una deadline invalida non tiene la promo accesa", () => {
    promoOn("non-una-data");
    expect(launchPromoActive(NOW)).toBe(false);
  });
});

describe("in dubbio si paga pieno (fail-closed)", () => {
  it("firstPaidOrder=false ha la precedenza su tutto", () => {
    // promoEligibility() rende {firstPaidOrder:false} anche quando il lookup DB
    // FALLISCE: un problema di database non deve regalare sconti.
    promoOn();
    for (const [plan, period] of CASES) {
      expect(discountedAmountFor(plan, period, { firstPaidOrder: false, now: NOW }).amount)
        .toBe(amountFor(plan, period));
    }
  });
});
