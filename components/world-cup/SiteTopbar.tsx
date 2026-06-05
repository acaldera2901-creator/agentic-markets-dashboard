// Site chrome for the World Cup hub. The real topbar lives inside the home
// monolith (app/page.tsx, ~5152) and is wired to client state (auth modal,
// language toggle, client profile) — it can't be lifted out cleanly. This is a
// visual replica using the SAME classes (.portal-brand-row, .brand-name,
// .btn-primary/.btn-secondary) so the WC pages read as part of the site.
// Auth CTAs and the "back" link route to the main board (/), where the live
// auth flow lives. Server component — no interactivity needed here.
import Link from "next/link";

export default function SiteTopbar({ backHref = "/", backLabel = "Board" }: { backHref?: string; backLabel?: string }) {
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
        <Link href="/" className="btn-secondary wc-topbar-btn">Accedi</Link>
        <Link href="/" className="btn-primary wc-topbar-btn">Registrati</Link>
      </div>
    </header>
  );
}
