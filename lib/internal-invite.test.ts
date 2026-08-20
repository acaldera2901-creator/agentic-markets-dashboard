import { describe, it, expect, afterEach } from "vitest";
import { internalInviteSpec, isInternalInviteCode } from "./internal-invite";

const ENV = "INTERNAL_INVITE_CODES";

function setEnv(v: string | undefined) {
  if (v === undefined) delete process.env[ENV];
  else process.env[ENV] = v;
}

afterEach(() => setEnv(undefined));

describe("internalInviteSpec", () => {
  it("legge codice e giorni dalla env", () => {
    setEnv("MAVEN30:30");
    expect(internalInviteSpec("MAVEN30")).toEqual({ code: "MAVEN30", days: 30 });
  });

  it("il lookup normalizza come il rail: minuscole e spazi combaciano", () => {
    setEnv("MAVEN30:30");
    expect(internalInviteSpec(" maven30 ")).toEqual({ code: "MAVEN30", days: 30 });
  });

  it("legge più codici separati da virgola, ognuno coi suoi giorni", () => {
    setEnv("MAVEN30:30, STAMPA:14");
    expect(internalInviteSpec("MAVEN30")?.days).toBe(30);
    expect(internalInviteSpec("STAMPA")?.days).toBe(14);
  });

  it("un codice non elencato non è interno", () => {
    setEnv("MAVEN30:30");
    expect(internalInviteSpec("PIPPO")).toBeNull();
  });

  it("senza la env nessun codice è interno", () => {
    setEnv(undefined);
    expect(internalInviteSpec("MAVEN30")).toBeNull();
  });

  it("una env vuota non è un codice vuoto", () => {
    setEnv("");
    expect(internalInviteSpec("")).toBeNull();
    expect(internalInviteSpec("MAVEN30")).toBeNull();
  });

  // Fail-closed: una env sporca non deve poter regalare niente. Ogni voce
  // malformata sparisce da sola, senza portarsi dietro quelle valide.
  it("scarta le voci malformate e tiene quelle valide", () => {
    setEnv("SENZAGIORNI, MAVEN30:30, :30, ROTTO:abc");
    expect(internalInviteSpec("SENZAGIORNI")).toBeNull();
    expect(internalInviteSpec("ROTTO")).toBeNull();
    expect(internalInviteSpec("MAVEN30")?.days).toBe(30);
  });

  // Il codice deve passare la STESSA regex del rail (lib/referral-code): se non
  // la passa non arriva mai in profiles.referred_by, quindi un codice così è
  // configurazione morta ed è meglio vederlo rosso qui che in prod.
  it("un codice che la regex del rail rifiuta non è interno", () => {
    setEnv("MA VEN:30, A:30, VENTUNOCARATTERIESATTI!:30");
    expect(internalInviteSpec("MA VEN")).toBeNull();
    expect(internalInviteSpec("A")).toBeNull(); // meno di 2 caratteri
    expect(internalInviteSpec("VENTUNOCARATTERIESATTI!")).toBeNull();
  });

  it("giorni fuori dal range sensato sono un errore di battitura, non un regalo", () => {
    setEnv("ZERO:0, NEGATIVO:-5, ETERNO:3000, MEZZO:1.5");
    for (const c of ["ZERO", "NEGATIVO", "ETERNO", "MEZZO"]) {
      expect(internalInviteSpec(c)).toBeNull();
    }
  });

  it("un anno intero è il massimo ammesso", () => {
    setEnv("ANNO:365");
    expect(internalInviteSpec("ANNO")?.days).toBe(365);
  });
});

describe("isInternalInviteCode", () => {
  it("distingue un codice interno da uno qualsiasi", () => {
    setEnv("MAVEN30:30");
    expect(isInternalInviteCode("maven30")).toBe(true);
    expect(isInternalInviteCode("AMICO")).toBe(false);
  });
});
