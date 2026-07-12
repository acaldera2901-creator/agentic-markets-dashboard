"use client";

import { useState } from "react";
import { usePicks } from "./use-picks";
import { selectPickOfDay } from "./select-pick-of-day";
import { PickCard } from "./PickCard";
import { PickCardExpanded } from "./PickCardExpanded";
import { BottomNav } from "./BottomNav";
import { Sheet, Button } from "@/components/ui";
import { AuthProvider, useAuth } from "../onboarding/AuthProvider";
import { PaywallProvider, usePaywall } from "../onboarding/PaywallProvider";
import { SignupSheet } from "../onboarding/SignupSheet";
import { LoginSheet } from "../onboarding/LoginSheet";

type AuthSheetKind = "signup" | "login" | null;

function FeedScreenInner() {
  const { user, plan } = useAuth();
  const { openUpgrade } = usePaywall();
  const { picks, loading, error } = usePicks();
  const [openPickId, setOpenPickId] = useState<string | null>(null);
  const [authSheet, setAuthSheet] = useState<AuthSheetKind>(null);
  const openPick = openPickId != null ? picks.find((p) => p.id === openPickId) ?? null : null;

  let body: React.ReactNode;
  if (loading) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Caricamento dei pick di oggi…</p>;
  } else if (error) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Qualcosa è andato storto. Riprova.</p>;
  } else if (picks.length === 0) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Nessun pick per oggi. Torna più tardi.</p>;
  } else {
    const podId = selectPickOfDay(picks);
    const ordered = podId
      ? [...picks.filter((p) => p.id === podId), ...picks.filter((p) => p.id !== podId)]
      : picks;
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 4px" }}>
        {ordered.map((p) => (
          <PickCard key={p.id} pick={p} pickOfDay={p.id === podId} onOpen={setOpenPickId} onUpgrade={() => openUpgrade()} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--am-bg)" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 12px", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong style={{ fontSize: 18, letterSpacing: "-.01em" }}>BetRedge</strong>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--am-muted)" }}>Oggi</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          {user ? (
            <span style={{ fontSize: 12, color: "var(--am-muted)" }}>
              {user.name ?? user.identifier}{plan ? ` · ${plan}` : ""}
            </span>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setAuthSheet("login")}>Accedi</Button>
              <Button variant="primary" onClick={() => setAuthSheet("signup")}>Crea account</Button>
            </>
          )}
        </div>
      </header>
      <main style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>{body}</main>
      <footer style={{ padding: "12px 16px", textAlign: "center", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: "var(--am-muted-2)", margin: 0 }}>
          18+ · Gioco responsabile. Le previsioni sono stime statistiche del modello, non garanzia di vincita.
        </p>
      </footer>
      <BottomNav active="oggi" />
      {openPick && (
        <Sheet open title={`${openPick.homeTeam ?? ""} · ${openPick.decision}`} onClose={() => setOpenPickId(null)}>
          <PickCardExpanded pick={openPick} onUpgrade={() => openUpgrade()} />
        </Sheet>
      )}
      <SignupSheet
        open={authSheet === "signup"}
        onClose={() => setAuthSheet(null)}
        onLogin={() => setAuthSheet("login")}
      />
      <LoginSheet
        open={authSheet === "login"}
        onClose={() => setAuthSheet(null)}
        onSignup={() => setAuthSheet("signup")}
      />
    </div>
  );
}

export function FeedScreen() {
  return (
    <AuthProvider>
      <PaywallProvider>
        <FeedScreenInner />
      </PaywallProvider>
    </AuthProvider>
  );
}
