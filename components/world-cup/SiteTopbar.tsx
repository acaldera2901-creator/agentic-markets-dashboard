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
import { Icon } from "@/components/ui/icons";

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

export default function SiteTopbar({
  backHref = "/",
  backLabel = "Board",
  hideLang = false,
  lang: langOverride,
  nav,
}: {
  backHref?: string;
  backLabel?: string;
  hideLang?: boolean;
  /** #TOOLS-HUB-0805: pagine che hanno la lingua NELL'URL (le /tools) la passano
   *  qui. Senza, la topbar leggeva solo localStorage (default "it") e mostrava
   *  "Accedi/Registrati" a un visitatore arrivato su una pagina inglese — con il
   *  dropdown nascosto non poteva nemmeno correggerlo. Le altre pagine non
   *  passano il prop e continuano a seguire localStorage. */
  lang?: SiteLang;
  /** #RESTYLING-0921 round 5 — la nav primaria, per le pagine che stanno FUORI
   *  dal desk e che senza di lei sembrano un altro sito: /tools ci si arriva
   *  dalla nav di ogni pagina e poi si restava con un solo «← Home».
   *  Opt-in: le pagine World Cup non la passano e non cambiano.
   *  Sono `Link` veri perché da qui ogni voce È una navigazione — la nav del
   *  desk cambia stato client, questa no, e non serve che lo faccia. */
  nav?: { href: string; label: string; icon: "home" | "explore" | "ledger" | "tools" | "profile" }[];
}) {
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

  // #RESTYLING-0921 round 14 — via lo stato del tema, il suo toggle e
  // l'ascolto di `prefers-color-scheme`. Il sito è solo scuro: `data-theme`
  // lo scrive il server in app/layout.tsx e nessuno lo cambia più. Questa
  // chrome viveva fuori dall'albero di page.tsx e quindi si portava dietro
  // una copia della stessa logica — tre copie da tenere in pari erano il
  // prezzo di una scelta che l'utente non ha più.

  // Language: the WC chrome lives outside page.tsx's LanguageCtx, so it reads the
  // shared `agentic-lang` key (same as WcBoard) and re-renders on mount. Toggling
  // here dispatches `agentic-lang-change` so the board updates live in step.
  const [storedLang, setLang] = useState<SiteLang>("it");
  const lang: SiteLang = langOverride ?? storedLang;
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
          {!nav && <Link href={backHref} className="wc-topbar-back" onClick={onBack}>← {backLabel}</Link>}
        </div>

        {nav && (
          <nav className="br-nav" aria-label={lang === "it" ? "Navigazione principale" : "Primary"}>
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="br-nav__item"
                aria-current={pathname === n.href || pathname.startsWith(n.href + "/") ? "page" : undefined}
              >
                <Icon name={n.icon} size={18} />
                {n.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="am-topright">
          {auth.status === "authed" ? (
            /* #UI-LOGOUT-TOPBAR-0623: Logout in topbar accanto alla pill nome+piano.
               WC è route separata dal desk → POST /api/auth {action:"logout"} poi
               reload su "/". */
            <>
              <Link href="/plans" className="am-acct" title={auth.identifier}>
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

          {/* #TOOLS-HUB-0805: le pagine /tools hanno la lingua NELL'URL e il loro
              selettore che ci naviga. Questo dropdown scrive solo localStorage:
              su quelle pagine sarebbero due controlli lingua, uno dei quali non
              cambierebbe niente di visibile. Le altre pagine non passano il prop
              e continuano ad averlo. */}
          {hideLang ? null : <LangDropdown value={lang} onSelect={selectLang} />}
        </div>
      </div>
    </header>
  );
}
