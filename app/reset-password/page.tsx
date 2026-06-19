"use client";

// Landing page for the password-reset email link (/reset-password?token=…&id=…).
// Standalone route (outside the /app React tree, like the WC chrome): it reads
// the site language from the shared `agentic-lang` key and POSTs the new password
// to /api/auth/reset. On success it sends the user to the login modal — the reset
// endpoint does not issue a session (see app/api/auth/reset/route.ts).

import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [it, setIt] = useState(true);
  const [token, setToken] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const lang = window.localStorage.getItem("agentic-lang");
      setIt(lang !== "en" && lang !== "es" && lang !== "fr" && lang !== "ru");
    } catch { /* storage off */ }
    try {
      const p = new URLSearchParams(window.location.search);
      setToken(p.get("token") ?? "");
      setId((p.get("id") ?? "").trim().toLowerCase());
    } catch { /* URL unavailable */ }
  }, []);

  const pwValid = password.length >= 8;
  const match = password === confirm;
  const canSubmit = Boolean(token && id) && pwValid && match && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError("");
    try {
      const resp = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, id, password }),
      });
      if (resp.ok) {
        setDone(true);
        window.setTimeout(() => { window.location.href = "/app?auth=login"; }, 1800);
        return;
      }
      const data = await resp.json().catch(() => ({})) as { error?: string };
      if (data.error === "expired_token") {
        setError(it ? "Link scaduto. Richiedi un nuovo link di reset dalla pagina di accesso." : "Link expired. Request a new reset link from the login page.");
      } else if (data.error === "invalid_token") {
        setError(it ? "Link non valido o già usato. Richiedi un nuovo link di reset." : "Invalid or already-used link. Request a new reset link.");
      } else if (resp.status === 400) {
        setError(it ? "La password deve avere almeno 8 caratteri." : "Password must be at least 8 characters.");
      } else if (resp.status === 429) {
        setError(it ? "Troppi tentativi. Riprova tra poco." : "Too many attempts. Try again shortly.");
      } else {
        setError(it ? "Qualcosa è andato storto. Riprova." : "Something went wrong. Please retry.");
      }
    } catch {
      setError(it ? "Errore di rete. Riprova." : "Network error. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  const missingLink = !token || !id;

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24,
      background: "var(--am-bg, #0b0f17)", color: "var(--am-text, #e2e8f0)", fontFamily: "system-ui, sans-serif" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 14,
        background: "var(--am-surface, #131a26)", border: "1px solid var(--am-border, #243044)", borderRadius: 14, padding: 24 }}>
        <p style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--am-muted, #94a3b8)", margin: 0 }}>BetRedge</p>
        <h1 style={{ fontSize: 20, margin: 0 }}>{it ? "Reimposta la password" : "Reset your password"}</h1>

        {done ? (
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--am-coral, #ff6b5e)" }}>
            {it ? "Password aggiornata. Ti porto alla pagina di accesso…" : "Password updated. Redirecting you to login…"}
          </p>
        ) : missingLink ? (
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--am-muted, #94a3b8)" }}>
            {it ? "Link non valido o incompleto. Apri il link dall'email di reset, oppure richiedine uno nuovo dalla pagina di accesso." : "Invalid or incomplete link. Open the link from the reset email, or request a new one from the login page."}
          </p>
        ) : (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <span>{it ? "Nuova password" : "New password"}</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password" placeholder={it ? "almeno 8 caratteri" : "at least 8 characters"}
                  style={{ width: "100%", padding: "10px 52px 10px 12px", borderRadius: 8, border: "1px solid var(--am-border, #243044)",
                    background: "var(--am-bg, #0b0f17)", color: "inherit", fontSize: 14 }} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}
                  aria-label={showPw ? (it ? "Nascondi password" : "Hide password") : (it ? "Mostra password" : "Show password")}
                  style={{ position: "absolute", right: 8, background: "none", border: "none", color: "var(--am-muted, #94a3b8)",
                    fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", cursor: "pointer", padding: "4px 6px" }}>
                  {showPw ? (it ? "Nascondi" : "Hide") : (it ? "Mostra" : "Show")}
                </button>
              </div>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <span>{it ? "Conferma password" : "Confirm password"}</span>
              <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--am-border, #243044)",
                  background: "var(--am-bg, #0b0f17)", color: "inherit", fontSize: 14 }} />
            </label>
            {password && confirm && !match && (
              <p style={{ fontSize: 12, color: "var(--am-coral, #ff6b5e)", margin: 0 }}>{it ? "Le password non coincidono." : "Passwords don't match."}</p>
            )}
            {error && <p style={{ fontSize: 13, color: "var(--am-coral, #ff6b5e)", margin: 0 }}>{error}</p>}
            <button disabled={!canSubmit}
              style={{ padding: "11px 16px", borderRadius: 8, border: "none", cursor: canSubmit ? "pointer" : "not-allowed",
                background: canSubmit ? "var(--am-coral, #ff6b5e)" : "var(--am-border, #243044)", color: "#0b0f17", fontWeight: 700, fontSize: 14 }}>
              {busy ? "…" : (it ? "Imposta nuova password" : "Set new password")}
            </button>
          </>
        )}
        <a href="/app?auth=login" style={{ fontSize: 12, color: "var(--am-muted, #94a3b8)", textAlign: "center" }}>
          {it ? "Torna all'accesso" : "Back to login"}
        </a>
      </form>
    </main>
  );
}
