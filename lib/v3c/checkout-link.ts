// lib/v3c/checkout-link.ts (#REDESIGN-V3C F8-UI · filone pages) — puro, sicuro nel client.
// ── Il passaggio al checkout esistente ─────────────────────────────────────────
// /pricing non apre un checkout suo: porta l'utente al CheckoutModal di sempre
// (app/app/page.tsx, intatto) con un parametro. /plans resta raggiungibile SOLO
// con questi parametri: senza, a flag acceso, /plans → /pricing (308).
export const CHECKOUT_PARAM = "checkout";
export const PRO_CHECKOUT_HREF = `/plans?${CHECKOUT_PARAM}=premium`;
export const FREE_SIGNUP_HREF = "/plans?auth=register";
export const SIGN_IN_HREF = "/plans?auth=login";

/** Il valore di `?checkout=` che la Dashboard accetta: solo Pro. Base non si vende più. */
export function checkoutDeepLink(search: string): "premium" | null {
  try {
    return new URLSearchParams(search).get(CHECKOUT_PARAM) === "premium" ? "premium" : null;
  } catch {
    return null;
  }
}
