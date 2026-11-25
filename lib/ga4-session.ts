import { GA_MEASUREMENT_ID } from "./ga4-config";

export async function getGa4SignupSession() {
  try {
    if (localStorage.getItem("gdpr_consent") !== "accepted") return undefined;
    const { gtag } = window as Window & { gtag?: (...args: unknown[]) => void };
    if (!gtag || !GA_MEASUREMENT_ID) return undefined;

    const get = (field: string) => new Promise<string>((resolve) => {
      gtag("get", GA_MEASUREMENT_ID, field, (value: unknown) => {
        resolve(typeof value === "string" || typeof value === "number" ? String(value) : "");
      });
    });
    let timer: number | undefined;
    try {
      const ids = await Promise.race([
        Promise.all([get("client_id"), get("session_id")]),
        new Promise<undefined>((resolve) => { timer = window.setTimeout(resolve, 350); }),
      ]);
      if (ids?.every(Boolean) && localStorage.getItem("gdpr_consent") === "accepted") {
        return { client_id: ids[0], session_id: ids[1] };
      }
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    // Analytics must never prevent registration.
  }
  return undefined;
}
