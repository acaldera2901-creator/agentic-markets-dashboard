"use client";

import { useState } from "react";
import { useReferral } from "./use-referral";
import { Button } from "@/components/ui";

const sectionTitle = {
  fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em",
  color: "var(--am-muted)", margin: "0 0 8px",
} as const;

const panel = {
  display: "flex", flexDirection: "column", gap: 10,
  background: "var(--am-panel-2)", border: "1px solid var(--am-line)",
  borderRadius: 12, padding: 14,
} as const;

export function ReferralSection() {
  const { code, signups, paid, loading, error, claim } = useReferral();
  const [input, setInput] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <section>
        <h2 style={sectionTitle}>Referral</h2>
        <div style={panel}>
          <span style={{ fontSize: 13, color: "var(--am-muted)" }}>Caricamento…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 style={sectionTitle}>Referral</h2>
        <div style={panel}>
          <span style={{ fontSize: 13, color: "var(--am-muted)" }}>Errore nel caricamento del referral.</span>
        </div>
      </section>
    );
  }

  if (code) {
    const inviteLink = `https://betredge.com/r/${code}`;

    async function handleCopy() {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(inviteLink);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      } catch {
        // no-op: clipboard non disponibile
      }
    }

    return (
      <section>
        <h2 style={sectionTitle}>Referral</h2>
        <div style={panel}>
          <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: ".04em" }}>{code}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--am-muted)", wordBreak: "break-all", flex: 1 }}>{inviteLink}</span>
            <Button variant="ghost" onClick={handleCopy}>{copied ? "Copiato" : "Copia"}</Button>
          </div>
          <span style={{ fontSize: 13, color: "var(--am-text)" }}>
            {signups} iscritti · {paid} con piano
          </span>
        </div>
      </section>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    setClaimError(null);
    const result = await claim(input.trim());
    setSubmitting(false);
    if (!result.ok) {
      setClaimError(result.error ?? "Errore nell'attivazione del codice");
    }
  }

  return (
    <section>
      <h2 style={sectionTitle}>Referral</h2>
      <form onSubmit={handleSubmit} style={panel}>
        <label htmlFor="referral-code-input" style={{ fontSize: 13, color: "var(--am-muted)" }}>
          Hai un codice referral?
        </label>
        <input
          id="referral-code-input"
          aria-label="Codice referral"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Codice"
          style={{
            fontFamily: "var(--font-display)", fontSize: 13, padding: "9px 10px",
            borderRadius: 10, border: "1px solid var(--am-line)", background: "var(--am-bg)", color: "var(--am-text)",
          }}
        />
        {claimError && (
          <span style={{ fontSize: 12, color: "var(--am-red)" }}>{claimError}</span>
        )}
        <Button type="submit" variant="primary" disabled={submitting}>Attiva codice</Button>
      </form>
    </section>
  );
}
