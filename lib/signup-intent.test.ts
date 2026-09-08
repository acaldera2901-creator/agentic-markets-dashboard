import { describe, it, expect } from "vitest";
import {
  normalizeSignupIntent,
  activationLanding,
  activationLinkParam,
  ACTIVATION_LANDING_DEFAULT,
} from "@/lib/signup-intent";

// #FUNNEL-INTENT-0908 — `goto` arriva dalla query string di una GET pubblica
// (/api/auth/activate), quindi da chiunque, non solo dalle nostre email. È input
// non fidato a un trust boundary e finisce in un redirect: qui si dimostra che
// l'unica cosa che può uscire sono i letterali scritti nel modulo.

const ALLOWED = ["plans:base", "plans:premium", "plans:weekly", "free"] as const;

describe("#FUNNEL-INTENT-0908 — allowlist dell'intento di signup", () => {
  it.each(ALLOWED)("accetta l'intento valido %s", (v) => {
    expect(normalizeSignupIntent(v)).toBe(v);
  });

  // Ogni riga è un modo con cui qualcuno prova a far uscire il redirect dal sito
  // o a inventarsi una destinazione.
  const REJECTED: [string, unknown][] = [
    ["stringa vuota", ""],
    ["intento inesistente", "plans:admin"],
    ["prefisso parziale", "plans"],
    ["maiuscole", "PLANS:BASE"],
    ["spazio in coda", "plans:base "],
    ["query appesa", "plans:base&admin=1"],
    ["secondo parametro", "plans:base?x=1"],
    ["open redirect protocol-relative", "//evil.example.com"],
    ["open redirect assoluto", "https://evil.example.com"],
    ["path traversal", "../../admin"],
    ["path assoluto", "/admin"],
    ["newline (header splitting)", "plans:base\r\nLocation: https://evil.example.com"],
    ["proprietà del prototipo", "constructor"],
    ["proprietà del prototipo 2", "__proto__"],
    ["toString", "toString"],
    ["numero", 1],
    ["null", null],
    ["undefined", undefined],
    ["oggetto", { toString: () => "plans:base" }],
    ["array", ["plans:base"]],
  ];

  it.each(REJECTED)("rifiuta %s", (_label, v) => {
    expect(normalizeSignupIntent(v)).toBeNull();
  });

  it("nessun valore rifiutato riesce a finire nel redirect", () => {
    for (const [label, v] of REJECTED) {
      expect(activationLanding(v), `${label} non deve cambiare la destinazione`)
        .toBe(ACTIVATION_LANDING_DEFAULT);
      expect(activationLinkParam(v), `${label} non deve entrare nel link email`).toBe("");
    }
  });

  // La regressione che il coordinatore ha chiesto di inchiodare: chi si registra
  // senza intento d'acquisto atterra dove atterra oggi.
  it("senza intento la destinazione resta quella di oggi", () => {
    expect(activationLanding(null)).toBe("?activated=1");
    expect(activationLinkParam(null)).toBe("");
  });

  it("con intento la destinazione è la pagina che serve a quell'intento", () => {
    expect(activationLanding("plans:base")).toBe("plans?activated=1&goto=plans:base");
    expect(activationLanding("plans:premium")).toBe("plans?activated=1&goto=plans:premium");
    expect(activationLanding("plans:weekly")).toBe("weekly-pick?activated=1");
    expect(activationLanding("free")).toBe("predictions?activated=1");
  });

  it("la destinazione è sempre relativa: mai un'origine, mai protocol-relative", () => {
    for (const v of [...ALLOWED, null, "plans:admin"]) {
      const dest = activationLanding(v);
      expect(dest.startsWith("//"), `${dest} è protocol-relative`).toBe(false);
      expect(/^[a-z][a-z0-9+.-]*:/i.test(dest), `${dest} ha uno schema`).toBe(false);
    }
  });
});
