"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Sheet, Button } from "@/components/ui";
import { useAuth } from "./AuthProvider";

// POST /api/auth { action: "login", identifier, password } — mirrors the
// register branch in app/api/auth/route.ts. 401 = invalid credentials, any
// other non-ok status gets a generic message (never echo server details).
function errorMessage(status: number): string {
  if (status === 401) return "Email o password non validi";
  return "Accesso non riuscito. Riprova.";
}

export function LoginSheet({
  open,
  onClose,
  onSignup,
}: {
  open: boolean;
  onClose: () => void;
  onSignup?: () => void;
}) {
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  const canSubmit = Boolean(email && password) && !busy;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "login",
          identifier: email,
          password,
        }),
      });
      if (!res.ok) {
        setError(errorMessage(res.status));
        return;
      }
      await refresh();
      onClose();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    background: "var(--am-inset)",
    border: "1px solid var(--am-line)",
    borderRadius: 11,
    padding: "11px 12px",
    color: "var(--am-text)",
    fontSize: 14,
    fontFamily: "var(--font-display)",
  };
  const labelStyle = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--am-muted)",
    marginBottom: 6,
  };

  return (
    <Sheet open={open} onClose={onClose} title="Accedi">
      <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--am-text)" }}>
          Accedi
        </h2>

        <div>
          <label htmlFor={emailId} style={labelStyle}>Email</label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor={passwordId} style={labelStyle}>Password</label>
          <input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <Link
          href="/reset-password"
          style={{ color: "var(--am-coral)", fontSize: 13, textAlign: "right" }}
        >
          Password dimenticata?
        </Link>

        {error && (
          <div style={{ fontSize: 13, color: "var(--am-red)" }}>{error}</div>
        )}

        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {busy ? "Accesso…" : "Accedi"}
        </Button>

        <button
          type="button"
          onClick={() => onSignup?.()}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--am-muted)",
            fontSize: 13,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Non hai un account? <span style={{ color: "var(--am-coral)" }}>Crea account</span>
        </button>
      </form>
    </Sheet>
  );
}
