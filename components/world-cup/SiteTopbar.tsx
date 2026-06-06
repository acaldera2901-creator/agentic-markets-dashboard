"use client";
// Site chrome for the World Cup hub. The real topbar lives inside the home
// monolith (app/page.tsx) and is wired to client state — it can't be lifted
// out cleanly. This is a visual replica using the SAME classes
// (.portal-brand-row, .brand-name, .btn-primary/.btn-secondary) so the WC
// pages read as part of the site.
//
// #021 item 1: the topbar is auth-AWARE. The session cookie (am_session,
// path=/) is already valid on /world-cup — the old static replica simply never
// asked, so logged-in users saw "Accedi/Registrati" and believed they had
// been logged out. On mount we ask GET /api/auth (same call the home makes)
// and render the real state.
import Link from "next/link";
import { useEffect, useState } from "react";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authed"; identifier: string; plan: string; name: string | null };

export default function SiteTopbar({ backHref = "/", backLabel = "Board" }: { backHref?: string; backLabel?: string }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/auth", { credentials: "same-origin", cache: "no-store" });
        if (cancelled) return;
        if (resp.ok) {
          const data = await resp.json();
          setAuth({
            status: "authed",
            identifier: String(data.identifier ?? ""),
            plan: String(data.plan ?? ""),
            name: data.name ? String(data.name) : null,
          });
        } else {
          setAuth({ status: "anonymous" });
        }
      } catch {
        if (!cancelled) setAuth({ status: "anonymous" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <header className="portal-brand-row wc-topbar">
      <div className="wc-topbar-brand">
        <Link href="/" className="wc-topbar-home">
          <div className="brand-name">AgenticMarkets</div>
          <div className="brand-tagline">Bets the Future · Predictive Intelligence for Sports Markets</div>
        </Link>
        <Link href={backHref} className="wc-topbar-back">← {backLabel}</Link>
      </div>
      <div className="portal-brand-actions">
        {auth.status === "authed" ? (
          <>
            <span className="wc-topbar-user" title={auth.identifier}>
              {auth.name || auth.identifier}
            </span>
            <span className="badge-pill wc-topbar-plan">{auth.plan}</span>
          </>
        ) : auth.status === "anonymous" ? (
          <>
            <Link href="/" className="btn-secondary wc-topbar-btn">Accedi</Link>
            <Link href="/" className="btn-primary wc-topbar-btn">Registrati</Link>
          </>
        ) : null /* loading: render nothing, no flicker of wrong state */}
      </div>
    </header>
  );
}
