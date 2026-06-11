"use client";
// Site chrome for the World Cup hub. The real topbar lives inside the home
// monolith (app/page.tsx) and is wired to client state — it can't be lifted
// out cleanly. This is a visual replica using the SAME sleek-coral classes
// (.am-topbar / .am-topbar-in / .am-brandmark / .am-topnav / .am-tt / .am-acct /
// .am-auth-*) so the WC pages read as part of the site.
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

// Mirror the home topbar pill (app/page.tsx `.am-acct`): unlocked plan → PRO,
// free → FREE, everything else (pending_payment, raw "premium" not yet mapped)
// → SETUP. Keeps the WC chrome label identical to the main site instead of
// echoing the raw plan string (e.g. "PREMIUM").
function planPillLabel(plan: string): string {
  if (["base", "premium", "admin_full"].includes(plan)) return "PRO";
  if (plan === "free") return "FREE";
  return "SETUP";
}

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

  // Theme toggle — presentation only, mirrors app/page.tsx (data-theme on <html>
  // + agentic-theme in localStorage; the pre-paint script in layout.tsx already
  // set data-theme, here we just sync + flip). WcBoard is outside page.tsx's
  // React tree, so the WC chrome owns its own toggle, same contract.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync with the pre-paint data-theme script: a lazy initializer would mismatch the server-rendered markup at hydration.
    if (current === "light" || current === "dark") setTheme(current);
  }, []);
  const setThemeTo = (next: "dark" | "light") => {
    if (next === theme) return;
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("agentic-theme", next); } catch {}
  };

  return (
    <header className="am-topbar">
      <div className="am-topbar-in">
        <div className="am-brandmark">
          <Link href="/" className="wc-topbar-home" aria-label="BetRedge">
            {/* logo: mira/target con cuneo coral = "probabilità di precisione" */}
            <svg className="am-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="13" stroke="var(--am-muted)" strokeWidth="1.6" />
              <circle cx="16" cy="16" r="7" stroke="var(--am-muted)" strokeWidth="1.6" />
              <path d="M16 16 26 9.5A12 12 0 0 1 16 28Z" fill="var(--am-coral)" />
              <circle cx="16" cy="16" r="2" fill="var(--am-text)" />
            </svg>
            <span className="am-wm">Bet<span className="r">R</span>edge<span className="chev">›</span></span>
          </Link>
          <Link href={backHref} className="wc-topbar-back">← {backLabel}</Link>
        </div>

        <div className="am-topright">
          <div className="am-tt" role="group" aria-label="Theme">
            <button
              className={theme === "dark" ? "on" : ""}
              aria-pressed={theme === "dark"}
              onClick={() => setThemeTo("dark")}
            >
              DARK
            </button>
            <button
              className={theme === "light" ? "on" : ""}
              aria-pressed={theme === "light"}
              onClick={() => setThemeTo("light")}
            >
              LIGHT
            </button>
          </div>

          {auth.status === "authed" ? (
            <Link href="/" className="am-acct" title={auth.identifier}>
              {auth.name || auth.identifier}
              <span className="plan">{planPillLabel(auth.plan)}</span>
            </Link>
          ) : auth.status === "anonymous" ? (
            <>
              <Link href="/" className="am-auth-secondary">Accedi</Link>
              <Link href="/" className="am-auth-primary">Registrati</Link>
            </>
          ) : null /* loading: render nothing, no flicker of wrong state */}
        </div>
      </div>
    </header>
  );
}
