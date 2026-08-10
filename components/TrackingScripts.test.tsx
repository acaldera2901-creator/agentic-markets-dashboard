// components/TrackingScripts.test.tsx — #PIXELS-TRACKING-0810
//
// Il gate che questo test difende è privacy, non funzionalità: "niente terze parti
// prima del consenso" (#PRELAUNCH-AUDIT). Se GTM si iniettasse senza Accept,
// Google riceverebbe un hit da un utente che non ha acconsentito — ed è il tipo di
// cosa che si scopre da un reclamo, non da un bug report.
//
// `GTM_ID` è letto a livello di MODULO (process.env.NEXT_PUBLIC_GTM_ID è inlinata
// al build): per questo ogni caso resetta i moduli e re-importa, invece di
// cambiare l'env e sperare.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";

const ENV = { ...process.env };

async function mountWith({ gtmId, consent }: { gtmId?: string; consent?: "accepted" | "declined" }) {
  if (gtmId === undefined) delete process.env.NEXT_PUBLIC_GTM_ID;
  else process.env.NEXT_PUBLIC_GTM_ID = gtmId;
  if (consent) localStorage.setItem("gdpr_consent", consent);
  vi.resetModules();
  const { TrackingScripts } = await import("./TrackingScripts");
  render(<TrackingScripts />);
}

const loader = () => document.getElementById("gtm-loader") as HTMLScriptElement | null;

beforeEach(() => {
  localStorage.clear();
  document.getElementById("gtm-loader")?.remove();
  delete (window as { dataLayer?: unknown[] }).dataLayer;
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("TrackingScripts — niente terze parti prima del consenso", () => {
  it("senza consenso NON inietta GTM, anche con il container id settato", async () => {
    await mountWith({ gtmId: "GTM-TEST123" });
    expect(loader()).toBeNull();
  });

  it("con consenso NEGATO non inietta", async () => {
    await mountWith({ gtmId: "GTM-TEST123", consent: "declined" });
    expect(loader()).toBeNull();
  });

  it("con consenso già dato inietta il container giusto", async () => {
    await mountWith({ gtmId: "GTM-TEST123", consent: "accepted" });
    const s = loader();
    expect(s).not.toBeNull();
    expect(s!.src).toContain("googletagmanager.com/gtm.js?id=GTM-TEST123");
    expect(s!.async).toBe(true);
  });

  it("dichiara Consent Mode v2 con default DENIED prima dell'update", async () => {
    // L'ordine conta: se l'update arrivasse prima del default, GTM partirebbe
    // senza uno stato di consenso dichiarato.
    await mountWith({ gtmId: "GTM-TEST123", consent: "accepted" });
    const dl = (window as { dataLayer?: unknown[] }).dataLayer ?? [];
    const consentCalls = dl.filter(
      (e): e is unknown[] => Array.isArray(e) && e[0] === "consent"
    );
    expect(consentCalls.length).toBeGreaterThanOrEqual(2);
    expect(consentCalls[0][1]).toBe("default");
    expect(consentCalls[0][2]).toMatchObject({ ad_storage: "denied", analytics_storage: "denied" });
    expect(consentCalls[1][1]).toBe("update");
    expect(consentCalls[1][2]).toMatchObject({ ad_storage: "granted", analytics_storage: "granted" });
  });

  it("l'Accept dato DOPO il mount attiva GTM senza reload", async () => {
    await mountWith({ gtmId: "GTM-TEST123" });
    expect(loader()).toBeNull();
    // È esattamente ciò che fa CookieBanner: scrive la chiave, poi l'evento.
    await act(async () => {
      localStorage.setItem("gdpr_consent", "accepted");
      window.dispatchEvent(new Event("betredge:gdpr-consent"));
    });
    expect(loader()).not.toBeNull();
  });

  it("due trigger di consenso non iniettano due volte", async () => {
    await mountWith({ gtmId: "GTM-TEST123", consent: "accepted" });
    await act(async () => {
      window.dispatchEvent(new Event("betredge:gdpr-consent"));
      window.dispatchEvent(new Event("betredge:gdpr-consent"));
    });
    expect(document.querySelectorAll("#gtm-loader")).toHaveLength(1);
  });

  it("senza container id è un no-op: la branch è mergiabile prima degli account", async () => {
    // È la proprietà che ha permesso di tenere questo codice pronto dal 10/08
    // mentre gli ID non esistevano ancora.
    await mountWith({ consent: "accepted" });
    expect(loader()).toBeNull();
  });
});
