"use client";

import { useState } from "react";
import { useProfile } from "./use-profile";
import { BottomNav } from "@/features/feed/BottomNav";
import { Chip, Button } from "@/components/ui";
import { PUBLIC_PAID_PLANS, planPriceCopy, type PublicPlanKey } from "@/lib/commercial-plan";

const LANG_KEY = "agentic-lang";

function isPaidPlan(plan: string): plan is PublicPlanKey {
  return plan in PUBLIC_PAID_PLANS;
}

function planCopy(plan: string): string {
  if (isPaidPlan(plan)) return planPriceCopy(plan, "it");
  if (plan === "free") return "Piano Free";
  if (plan === "admin_full") return "Accesso completo";
  return plan;
}

function planBadge(plan: string): string {
  if (isPaidPlan(plan)) return PUBLIC_PAID_PLANS[plan].label.it;
  if (plan === "free") return "Free";
  if (plan === "admin_full") return "Admin";
  return plan;
}

function readStoredLang(): string {
  if (typeof window === "undefined") return "it";
  try {
    return window.localStorage.getItem(LANG_KEY) ?? "it";
  } catch {
    return "it";
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--am-bg)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 12px", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <strong style={{ fontSize: 18, letterSpacing: "-.01em" }}>BetRedge</strong>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--am-muted)" }}>Profilo</span>
      </header>
      <main style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto", padding: "0 12px" }}>{children}</main>
      <footer style={{ padding: "12px 16px", textAlign: "center", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: "var(--am-muted-2)", margin: 0 }}>
          18+ · Gioco responsabile. Le previsioni sono stime statistiche del modello, non garanzia di vincita.
        </p>
      </footer>
      <BottomNav active="profilo" />
    </div>
  );
}

export function ProfileScreen() {
  const { profile, loading, loggedIn, logout } = useProfile();
  const [lang, setLang] = useState<string>(() => readStoredLang());

  if (loading) {
    return (
      <Shell>
        <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Caricamento…</p>
      </Shell>
    );
  }

  if (!loggedIn || !profile) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "48px 8px" }}>
          <h1 style={{ fontSize: 20, margin: 0, textAlign: "center" }}>Accedi al tuo profilo</h1>
          <p style={{ fontSize: 13, color: "var(--am-muted)", textAlign: "center", margin: 0 }}>
            Accedi o crea un account per vedere piano, referral e impostazioni.
          </p>
          {/* shortcut: /app resta il router auth finché SP3 non introduce sheet dedicati */}
          <a href="/app" style={{ width: "100%" }}>
            <Button variant="primary" style={{ width: "100%" }}>Accedi</Button>
          </a>
          <a href="/app" style={{ width: "100%" }}>
            <Button variant="ghost" style={{ width: "100%" }}>Crea account</Button>
          </a>
        </div>
      </Shell>
    );
  }

  const planExpiry = profile.planExpiresAt && isPaidPlan(profile.plan)
    ? new Date(profile.planExpiresAt).toLocaleDateString("it-IT")
    : null;

  function handleLangChange(next: string) {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // no-op: localStorage non disponibile
    }
  }

  async function handleLogout() {
    await logout();
    window.location.href = "/oggi";
  }

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "12px 4px" }}>
        <section>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--am-muted)", margin: "0 0 8px" }}>Account</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--am-panel-2)", border: "1px solid var(--am-line)", borderRadius: 12, padding: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{profile.name ?? "—"}</span>
            <span style={{ fontSize: 13, color: "var(--am-muted)" }}>{profile.identifier}</span>
            <Chip variant="pro">{planBadge(profile.plan)}</Chip>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--am-muted)", margin: "0 0 8px" }}>Piano</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--am-panel-2)", border: "1px solid var(--am-line)", borderRadius: 12, padding: 14 }}>
            <span style={{ fontSize: 14 }}>{planCopy(profile.plan)}</span>
            {planExpiry && <span style={{ fontSize: 12, color: "var(--am-muted)" }}>Scadenza: {planExpiry}</span>}
            {/* shortcut: /app?tab=plans resta il router piani finché SP3 non introduce lo sheet dedicato */}
            <a href="/app?tab=plans">
              <Button variant="ghost">{isPaidPlan(profile.plan) ? "Gestisci piano" : "Vedi piani"}</Button>
            </a>
          </div>
        </section>

        <div data-testid="referral-slot" />

        <section>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--am-muted)", margin: "0 0 8px" }}>Lingua</h2>
          <select
            value={lang}
            onChange={(e) => handleLangChange(e.target.value)}
            style={{
              fontFamily: "var(--font-display)", fontSize: 13, padding: "9px 10px",
              borderRadius: 10, border: "1px solid var(--am-line)", background: "var(--am-panel-2)", color: "var(--am-text)",
            }}
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </section>

        <Button variant="ghost" onClick={handleLogout} style={{ width: "100%" }}>Logout</Button>
      </div>
    </Shell>
  );
}
