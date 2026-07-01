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

// Mirror the home topbar pill (app/page.tsx `.am-acct`): premium/admin → PRO,
// base → BASE, free → FREE, everything else (pending_payment, …) → SETUP. Keeps
// the WC chrome label identical to the main site (base was wrongly shown as PRO).
function planPillLabel(plan: string): string {
  if (["premium", "admin_full"].includes(plan)) return "PRO";
  if (plan === "base") return "BASE";
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

  // #UI-LOGOUT-TOPBAR-0623: logout dalla chrome WC (route separata dal desk).
  const logout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action: "logout" }),
      });
    } catch { /* il reload riporta allo stato pubblico comunque */ }
    window.location.href = "/";
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
    // #UI-THEME-HARDEN-0623: ri-applica la scelta salvata (localStorage → prefers) e
    // ri-asserta data-theme, così un reset da idratazione non lascia il tema sbagliato.
    let t = "";
    try { t = localStorage.getItem("agentic-theme") ?? ""; } catch {}
    if (t !== "light" && t !== "dark") {
      t = (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ri-assert post-idratazione: una lazy initializer mismatcherebbe l'HTML SSR.
    setTheme(t as "dark" | "light");
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  const setThemeTo = (next: "dark" | "light") => {
    if (next === theme) return;
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("agentic-theme", next); } catch {}
  };
  // #THEME-CONSISTENCY-0623: segue il tema di sistema SOLO finché l'utente non
  // ha scelto manualmente (agentic-theme vuoto). Stesso contratto di home/desk.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      let chosen = "";
      try { chosen = localStorage.getItem("agentic-theme") ?? ""; } catch {}
      if (chosen === "light" || chosen === "dark") return;
      const next: "dark" | "light" = e.matches ? "light" : "dark";
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
          <Link href="/" className="wc-topbar-home" aria-label="BetrEdge">
            {/* #UI-LOGO-THEME-0623: logo theme-aware (bianco dark / nero light), swap CSS no-flash */}
            <img className="brand-logo-dark" src="/logos/betredge-logo-white.png" alt="BetrEdge" style={{ height: 30, width: "auto" }} />
            <img className="brand-logo-light" src="/logos/betredge-logo-black.png" alt="" aria-hidden="true" style={{ height: 30, width: "auto" }} />
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
            /* #UI-LOGOUT-TOPBAR-0623: Logout in topbar accanto alla pill nome+piano.
               WC è route separata dal desk → POST /api/auth {action:"logout"} poi
               reload su "/". */
            <>
              <Link href="/app?tab=account" className="am-acct" title={auth.identifier}>
                {auth.name || auth.identifier}
                <span className="plan">{planPillLabel(auth.plan)}</span>
              </Link>
              <button type="button" className="am-auth-secondary" onClick={logout}>
                {lang === "it" ? "Esci" : "Logout"}
              </button>
            </>
          ) : auth.status === "anonymous" ? (
            <>
              <Link href="/app?auth=login" className="am-auth-secondary">{lang === "it" ? "Accedi" : "Sign In"}</Link>
              <Link href="/app?auth=register" className="am-auth-primary">{lang === "it" ? "Registrati" : "Register"}</Link>
            </>
          ) : null /* loading: render nothing, no flicker of wrong state */}

          <LangDropdown value={lang} onSelect={selectLang} />
        </div>
      </div>
    </header>
  );
}
