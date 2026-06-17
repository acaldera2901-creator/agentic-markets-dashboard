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
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import LangDropdown from "@/components/LangDropdown";

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

type SiteLang = "it" | "en" | "es" | "fr" | "ru";
function readLang(): SiteLang {
  if (typeof window === "undefined") return "it";
  const s = window.localStorage.getItem("agentic-lang");
  return s === "en" || s === "es" || s === "fr" || s === "ru" ? s : "it";
}

export default function SiteTopbar({ backHref = "/", backLabel = "Board" }: { backHref?: string; backLabel?: string }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const router = useRouter();
  const pathname = usePathname();

  // #QA-SERGIO-BAGS-1: segna che l'hub WC è stato visto in questa scheda, così
  // le pagine team possono tornarci via history back (ripristinando il tab
  // "Match calendar"/Groups/… e lo scroll da cui l'utente è partito).
  useEffect(() => {
    if (pathname === "/world-cup") {
      try { sessionStorage.setItem("wc:hubSeen", "1"); } catch { /* storage off */ }
    }
  }, [pathname]);

  // Back dal dettaglio squadra: torna DOVE eri (tab+scroll), non al top dell'hub
  // con un flash. Se l'hub è già stato visto in questa scheda → history back;
  // altrimenti (deep-link/scheda nuova) lascia che il <Link> vada a backHref.
  // Solo click semplici: modifier/middle → "apri in nuova scheda".
  const onBack = (e: MouseEvent) => {
    if (backHref !== "/world-cup") return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let hubSeen = false;
    try { hubSeen = sessionStorage.getItem("wc:hubSeen") === "1"; } catch { /* storage off */ }
    if (hubSeen && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

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

  // Language: the WC chrome lives outside page.tsx's LanguageCtx, so it reads the
  // shared `agentic-lang` key (same as WcBoard) and re-renders on mount. Toggling
  // here dispatches `agentic-lang-change` so the board updates live in step.
  const [lang, setLang] = useState<SiteLang>("it");
  useEffect(() => {
    const sync = () => setLang(readLang());
    sync();
    window.addEventListener("agentic-lang-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("agentic-lang-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const selectLang = (next: SiteLang) => {
    setLang(next);
    try { localStorage.setItem("agentic-lang", next); } catch {}
    window.dispatchEvent(new Event("agentic-lang-change"));
  };

  return (
    <header className="am-topbar">
      <div className="am-topbar-in">
        <div className="am-brandmark">
          <Link href="/" className="wc-topbar-home" aria-label="BetRedge">
            {/* logo: mira/target con cuneo coral = "probabilità di precisione" */}
            <svg className="am-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M5 21A11 11 0 0 1 27 21" stroke="var(--am-muted)" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M5 21A11 11 0 0 1 9.2 13.2" stroke="var(--am-coral)" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="16" y1="21" x2="23.5" y2="12.5" stroke="var(--am-coral)" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="16" cy="21" r="2.2" fill="var(--am-coral)" />
            </svg>
            <span className="am-wm">Bet<span className="r">R</span>edge<span className="chev">›</span></span>
          </Link>
          <Link href={backHref} className="wc-topbar-back" onClick={onBack}>← {backLabel}</Link>
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
            <Link href="/app?tab=account" className="am-acct" title={auth.identifier}>
              {auth.name || auth.identifier}
              <span className="plan">{planPillLabel(auth.plan)}</span>
            </Link>
          ) : auth.status === "anonymous" ? (
            <>
              <Link href="/app" className="am-auth-secondary">{lang === "it" ? "Accedi" : "Sign In"}</Link>
              <Link href="/app?tab=account" className="am-auth-primary">{lang === "it" ? "Registrati" : "Register"}</Link>
            </>
          ) : null /* loading: render nothing, no flicker of wrong state */}

          <LangDropdown value={lang} onSelect={selectLang} />
        </div>
      </div>
    </header>
  );
}
