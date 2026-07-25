"use client";

// #SHOPIFY-CRYPTO-2 — pagina di atterraggio del rail crypto.
// L'utente sceglie "Crypto" nel checkout Shopify; Shopify crea l'ordine NON
// pagato e mostra le istruzioni del metodo, che puntano qui. Questa pagina
// chiede al server di aprire l'ordine PayGate per QUELL'ordine Shopify e
// reindirizza alla pagina di pagamento (indirizzo + QR li mostra PayGate:
// nessuna UI nuova da mantenere, e l'importo resta quello dell'ordine Shopify).
// Route standalone come /reset-password, fuori dall'albero React di /app.

import { useEffect, useState } from "react";

type State = "loading" | "redirecting" | "no-order" | "unauthorized" | "unavailable" | "error";

export default function PayCryptoPage() {
  const [it, setIt] = useState(true);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    try {
      const lang = window.localStorage.getItem("agentic-lang");
      setIt(lang !== "en" && lang !== "es" && lang !== "fr" && lang !== "ru");
    } catch { /* storage off */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/shopify/crypto-order", { method: "POST" });
        if (cancelled) return;
        if (resp.ok) {
          const { url } = (await resp.json()) as { url?: string };
          if (url) {
            setState("redirecting");
            window.location.href = url;
            return;
          }
          setState("error");
          return;
        }
        if (resp.status === 401) setState("unauthorized");
        else if (resp.status === 404) setState("no-order");
        else if (resp.status === 503) setState("unavailable");
        else setState("error");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const copy: Record<State, { title: string; body: string }> = it
    ? {
        loading: { title: "Preparo il pagamento…", body: "Sto recuperando il tuo ordine." },
        redirecting: { title: "Ti porto al pagamento…", body: "Non chiudere questa pagina." },
        "no-order": {
          title: "Nessun ordine da pagare",
          body: "Non trovo un ordine crypto in attesa sul tuo account. Se hai appena completato il checkout, ricarica tra qualche secondo; altrimenti scegli di nuovo il piano.",
        },
        unauthorized: {
          title: "Accedi per continuare",
          body: "Il pagamento è legato al tuo account: entra con lo stesso indirizzo email che hai usato al checkout, poi torna su questa pagina.",
        },
        unavailable: {
          title: "Pagamento crypto non disponibile",
          body: "Il rail crypto è momentaneamente spento. Puoi pagare con carta dal tuo account.",
        },
        error: { title: "Qualcosa è andato storto", body: "Riprova tra poco. Se il problema resta, scrivici: nessun addebito è stato fatto." },
      }
    : {
        loading: { title: "Preparing your payment…", body: "Fetching your order." },
        redirecting: { title: "Taking you to payment…", body: "Please don't close this page." },
        "no-order": {
          title: "No order to pay",
          body: "We can't find a pending crypto order on your account. If you just completed checkout, reload in a few seconds; otherwise pick your plan again.",
        },
        unauthorized: {
          title: "Sign in to continue",
          body: "The payment is tied to your account: sign in with the same email you used at checkout, then come back to this page.",
        },
        unavailable: {
          title: "Crypto payment unavailable",
          body: "The crypto rail is temporarily off. You can pay by card from your account.",
        },
        error: { title: "Something went wrong", body: "Please retry shortly. If it persists, contact us — nothing has been charged." },
      };

  const c = copy[state];

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--am-bg, #0b0f17)",
        color: "var(--am-text, #e2e8f0)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14, padding: 24 }}>
        <p style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--am-muted, #94a3b8)", margin: 0 }}>
          BetRedge
        </p>
        <h1 style={{ fontSize: 20, margin: 0 }}>{c.title}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--am-muted, #94a3b8)", margin: 0 }}>{c.body}</p>
        {(state === "no-order" || state === "unauthorized" || state === "unavailable" || state === "error") && (
          <a href="/app" className="btn-primary" style={{ textAlign: "center", textDecoration: "none", padding: "10px 14px", borderRadius: 8 }}>
            {it ? "Torna su BetRedge" : "Back to BetRedge"}
          </a>
        )}
      </div>
    </main>
  );
}
