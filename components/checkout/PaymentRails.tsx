"use client";
// #ONE-CHECKOUT-1031 — the ONE purchase UI shared by the plan checkout modal
// (app/app/page.tsx) and the Weekly Model Case (app/weekly-model-case/page.tsx).
// Two rails, two destinations, no third:
//   - card   -> Shopify checkout ONLY. If Shopify fails we show a clear,
//               retryable error; we never fall back to another payment method
//               (the PayGate hosted page is a card->crypto on-ramp, banned in
//               user flows by Andrea, 31/10/2026).
//   - crypto -> CryptoDirectPanel (per-order deposit address, on-chain check).
//               Shown only when NEXT_PUBLIC_SHOPIFY_CRYPTO_ENABLED === "true".
// The PayGate backend (callback, settle-mine, reconcile cron) stays for orders
// that already exist; this file just never sends anyone there.

import { useRef, useState, type ReactNode } from "react";
import { CryptoDirectPanel, type CryptoTarget } from "@/components/CryptoDirectPanel";

type Lang = "it" | "en" | "es" | "fr" | "ru";

function pick5<T>(lang: Lang, v: { it: T; en: T; es: T; fr: T; ru: T }): T {
  return v[lang];
}

// Read at render time (not module load) so tests can stub the flag.
export const cryptoDirectEnabled = () => process.env.NEXT_PUBLIC_SHOPIFY_CRYPTO_ENABLED === "true";

export type ShopifyCheckoutResult =
  | { kind: "redirect"; url: string }
  | { kind: "unauthenticated" }
  | { kind: "subscription_active" }
  | { kind: "error"; status?: number };

/** Asks /api/shopify/checkout for a checkout URL. Never touches any other rail. */
export async function startShopifyCheckout(body: Record<string, unknown>): Promise<ShopifyCheckoutResult> {
  try {
    const res = await fetch("/api/shopify/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const { url } = ((await res.json().catch(() => ({}))) ?? {}) as { url?: string };
      return url ? { kind: "redirect", url } : { kind: "error", status: res.status };
    }
    if (res.status === 401) return { kind: "unauthenticated" };
    if (res.status === 409) {
      const { code } = ((await res.json().catch(() => ({}))) ?? {}) as { code?: string };
      if (code === "shopify_subscription_active") return { kind: "subscription_active" };
    }
    return { kind: "error", status: res.status };
  } catch (e) {
    console.error("shopify checkout unavailable", e);
    return { kind: "error" };
  }
}

const DEFAULT_ERROR = {
  it: "Non siamo riusciti ad aprire il pagamento con carta. Riprova tra poco.",
  en: "We couldn't open the card payment. Please try again in a moment.",
  es: "No pudimos abrir el pago con tarjeta. Inténtalo de nuevo en un momento.",
  fr: "Impossible d'ouvrir le paiement par carte. Réessayez dans un instant.",
  ru: "Не удалось открыть оплату картой. Попробуйте ещё раз чуть позже.",
};
const SUB_ACTIVE = {
  it: "Hai già un abbonamento attivo. Per cambiare piano disdici quello attuale dal tuo account, poi riprova.",
  en: "You already have an active subscription. To change plan, cancel the current one from your account, then try again.",
  es: "Ya tienes una suscripción activa. Para cambiar de plan, cancela la actual desde tu cuenta y vuelve a intentarlo.",
  fr: "Vous avez déjà un abonnement actif. Pour changer de plan, annulez l'actuel depuis votre compte, puis réessayez.",
  ru: "У вас уже есть активная подписка. Чтобы сменить план, отмените текущую в аккаунте и повторите.",
};

/** EU distance-selling consent (#GOLIVE-QW-A). Gates every payment CTA. */
export function WithdrawalConsent({ lang, checked, onChange }: { lang: Lang; checked: boolean; onChange: (v: boolean) => void }) {
  const frags = pick5(lang, {
    it: ["Ho letto i ", " e la ", " e chiedo l'esecuzione immediata del servizio."],
    en: ["I have read the ", " and the ", " and I request immediate performance of the service."],
    es: ["He leído los ", " y la ", " y solicito la ejecución inmediata del servicio."],
    fr: ["J'ai lu les ", " et la ", " et je demande l'exécution immédiate du service."],
    ru: ["Я прочитал(а) ", " и ", " и прошу немедленно предоставить услугу."],
  }) as [string, string, string];
  const termsLabel = pick5(lang, { it: "Termini", en: "Terms", es: "Términos", fr: "Conditions", ru: "Условия" });
  const privacyLabel = pick5(lang, { it: "Privacy", en: "Privacy Policy", es: "Privacidad", fr: "Confidentialité", ru: "Политику конфиденциальности" });
  const linkStyle = { color: "var(--am-coral)", textDecoration: "underline" };
  const segStyle = { cursor: "pointer", display: "inline" };
  // Links stay outside the <label htmlFor> so clicking them opens the page
  // without ticking the checkbox.
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "12px 0 4px", fontSize: 12, lineHeight: 1.5, color: "var(--am-muted)" }}>
      <input id="withdrawal-consent" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>
        <label htmlFor="withdrawal-consent" style={segStyle}>{frags[0]}</label>
        <a href="/terms" target="_blank" rel="noopener noreferrer" style={linkStyle}>{termsLabel}</a>
        <label htmlFor="withdrawal-consent" style={segStyle}>{frags[1]}</label>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={linkStyle}>{privacyLabel}</a>
        <label htmlFor="withdrawal-consent" style={segStyle}>{frags[2]}</label>
      </span>
    </div>
  );
}

/** Modal shell shared by both purchase points (same classes as the plan modal). */
export function CheckoutDialog({ title, subtitle, onClose, children }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal checkout-modal" role="dialog" aria-modal="true" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-head">
          <p className="eyebrow">Checkout</p>
          <h3>{title}</h3>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function PaymentRails({
  lang,
  shopifyBody,
  cryptoTarget,
  cardPrice,
  cryptoPrice,
  disabled,
  onCryptoPaid,
  cryptoNote,
}: {
  lang: Lang;
  /** Body for /api/shopify/checkout, e.g. { requested_plan, period, lang }. */
  shopifyBody: Record<string, unknown>;
  cryptoTarget: CryptoTarget;
  cardPrice: string;
  cryptoPrice: string;
  disabled: boolean;
  onCryptoPaid: () => void;
  cryptoNote?: ReactNode;
}) {
  const [redirecting, setRedirecting] = useState(false);
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [error, setError] = useState("");
  // Sync guard: two quick clicks must not create two orders (the disabled
  // attribute only lands after the re-render).
  const inFlight = useRef(false);

  const payWithCard = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setRedirecting(true);
    const r = await startShopifyCheckout(shopifyBody);
    if (r.kind === "redirect") { window.location.href = r.url; return; }
    if (r.kind === "unauthenticated") { window.location.href = "/plans"; return; }
    setError(pick5(lang, r.kind === "subscription_active" ? SUB_ACTIVE : DEFAULT_ERROR));
    setRedirecting(false);
    inFlight.current = false;
  };

  const off = disabled || redirecting;
  const btn = (primary: boolean) => ({
    width: "100%", marginTop: primary ? 0 : 8, padding: "8px 0", borderRadius: 6, background: "none",
    border: `1px solid ${primary ? "var(--am-coral)" : "var(--am-line)"}`, color: primary ? "var(--am-coral)" : "var(--am-text)",
    cursor: off ? "not-allowed" : "pointer", borderStyle: off ? "dashed" : "solid",
  });

  return (
    <>
      <button className="checkout-payment" aria-busy={redirecting} type="button" onClick={payWithCard} disabled={off} style={btn(true)}>
        {redirecting
          ? pick5(lang, { it: "Reindirizzamento al pagamento sicuro…", en: "Redirecting to secure payment…", es: "Redirigiendo al pago seguro…", fr: "Redirection vers le paiement sécurisé…", ru: "Перенаправление на безопасную оплату…" })
          : <>{pick5(lang, { it: "Paga con carta", en: "Pay with card", es: "Pagar con tarjeta", fr: "Payer par carte", ru: "Оплатить картой" })} · {cardPrice}</>}
      </button>
      {cryptoDirectEnabled() && (
        <>
          {!cryptoOpen ? (
            <button className="checkout-payment" type="button" onClick={() => setCryptoOpen(true)} disabled={off} style={btn(false)}>
              {pick5(lang, { it: "Paga in crypto", en: "Pay with crypto", es: "Pagar con crypto", fr: "Payer en crypto", ru: "Оплатить криптовалютой" })} · {cryptoPrice}
            </button>
          ) : (
            <CryptoDirectPanel lang={lang} target={cryptoTarget} onPaid={onCryptoPaid} />
          )}
          {cryptoNote && <p style={{ fontSize: 11, color: "var(--am-muted)", margin: "6px 0 0" }}>{cryptoNote}</p>}
        </>
      )}
      {error && (
        <p role="alert" style={{ fontSize: "12px", fontFamily: "var(--font-mono), ui-monospace, monospace", color: "var(--am-negative)", lineHeight: 1.5, margin: "8px 0 0" }}>
          {error}
        </p>
      )}
    </>
  );
}
