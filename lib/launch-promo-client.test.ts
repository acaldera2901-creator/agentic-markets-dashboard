// #PROMO-DEADLINE-0904 — il bug che questo test blocca: la claim "-50%" in due
// punti dell'interfaccia era gatata sul SOLO flag, senza la deadline. Con la
// promo scaduta il checkout server tornava a prezzo pieno mentre il sito
// continuava a prometterla. Qui il caso "flag acceso, deadline passata" è la
// riga che conta: senza il fix era `true`.
import { describe, it, expect, afterEach } from "vitest";
import { launchPromoLive } from "./launch-promo-client";

const PAST = "2020-01-01T00:00:00Z";
const FUTURE = "2999-01-01T00:00:00Z";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED;
  delete process.env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE;
});

describe("launchPromoLive", () => {
  it("è attiva solo con flag acceso E deadline futura", () => {
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED = "true";
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE = FUTURE;
    expect(launchPromoLive()).toBe(true);
  });

  it("si spegne da sola alla scadenza, anche col flag ancora acceso", () => {
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED = "true";
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE = PAST;
    expect(launchPromoLive()).toBe(false);
  });

  it("l'istante esatto della deadline è già scaduto (now < deadline, come il server)", () => {
    const iso = "2026-09-04T23:59:00.000Z";
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED = "true";
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE = iso;
    const t = Date.parse(iso);
    expect(launchPromoLive(t - 1)).toBe(true);
    expect(launchPromoLive(t)).toBe(false);
  });

  it("flag spento = niente claim, qualunque sia la deadline", () => {
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE = FUTURE;
    expect(launchPromoLive()).toBe(false);
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED = "false";
    expect(launchPromoLive()).toBe(false);
  });

  it("deadline mancante o non parsabile = niente claim (fail-closed, A4 FTC)", () => {
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED = "true";
    expect(launchPromoLive()).toBe(false);
    process.env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE = "not-a-date";
    expect(launchPromoLive()).toBe(false);
  });
});
