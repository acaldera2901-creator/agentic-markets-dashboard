"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Sheet, Button } from "@/components/ui";
import { useAuth } from "./AuthProvider";

// POST /api/auth { action: "register", ... } — real field names confirmed from
// app/api/auth/route.ts (register branch, ~L256-337) + consent.ts:
// identifier (or email), password, name, language, age_confirmed, tos_accepted,
// marketing_opt_in. Consent (age_confirmed/tos_accepted) is also enforced
// server-side (assertConsent) — the client gate here is UX only, not the
// security boundary.
function errorMessage(status: number, code: string | undefined): string {
  if (code === "consent_required") return "Devi confermare 18+ e i Termini e Condizioni.";
  if (status === 409) return "Account già esistente — prova ad accedere.";
  return "Registrazione non riuscita. Riprova.";
}

export function SignupSheet({
  open,
  onClose,
  onLogin,
  language = "it",
}: {
  open: boolean;
  onClose: () => void;
  onLogin?: () => void;
  language?: string;
}) {
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [ageChecked, setAgeChecked] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const nameId = useId();
  const ageId = useId();
  const tosId = useId();
  const marketingId = useId();

  const canSubmit = Boolean(email && password && ageChecked && tosChecked) && !busy;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "register",
          identifier: email,
          password,
          name: name || undefined,
          language,
          age_confirmed: true,
          tos_accepted: true,
          marketing_opt_in: marketing,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as { error?: string });
        setError(errorMessage(res.status, json.error));
        return;
      }
      const json = await res.json().catch(() => ({})) as { pending_activation?: boolean };
      if (res.status === 202 || json.pending_activation) {
        setInfo("Ti abbiamo inviato un'email di attivazione. Controlla la posta.");
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
  const checkboxRowStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    color: "var(--am-text)",
  };

  return (
    <Sheet open={open} onClose={onClose} title="Crea account">
      <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--am-text)" }}>
          Crea account
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor={nameId} style={labelStyle}>Nome (opzionale)</label>
          <input
            id={nameId}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <label htmlFor={ageId} style={checkboxRowStyle}>
          <input
            id={ageId}
            type="checkbox"
            checked={ageChecked}
            onChange={(e) => setAgeChecked(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>Confermo di avere almeno 18 anni (+18)</span>
        </label>

        <label htmlFor={tosId} style={checkboxRowStyle}>
          <input
            id={tosId}
            type="checkbox"
            checked={tosChecked}
            onChange={(e) => setTosChecked(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            Accetto i{" "}
            <Link href="/terms" style={{ color: "var(--am-coral)" }}>Termini</Link>
            {" "}e la{" "}
            <Link href="/privacy" style={{ color: "var(--am-coral)" }}>Privacy</Link>
          </span>
        </label>

        <label htmlFor={marketingId} style={checkboxRowStyle}>
          <input
            id={marketingId}
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>Voglio ricevere aggiornamenti e offerte via email (marketing, opzionale)</span>
        </label>

        {error && (
          <div style={{ fontSize: 13, color: "var(--am-red)" }}>{error}</div>
        )}

        {info && (
          <div style={{ fontSize: 13, color: "var(--am-muted)" }}>{info}</div>
        )}

        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {busy ? "Creazione…" : "Crea account"}
        </Button>

        <button
          type="button"
          onClick={() => onLogin?.()}
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
          Hai già un account? <span style={{ color: "var(--am-coral)" }}>Accedi</span>
        </button>
      </form>
    </Sheet>
  );
}
