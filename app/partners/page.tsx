"use client";
// /partners — vetrina pubblica dei partner. Tutti i partner sono gambling →
// contenuto gattato FAIL-CLOSED sulla geo via /api/geo-books (autorevole
// server-side). Il contenuto gambling NON è mai nell'HTML iniziale: viene
// montato solo dopo che il server conferma blocked===false. Lingua da
// localStorage["agentic-lang"] come le altre pagine standalone (community).
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PartnersShowcase } from "@/components/PartnersShowcase";
import { PARTNERS_COPY, pickPartnersLang, type PartnersLang } from "@/lib/partners";

type GeoState = "loading" | "allowed" | "blocked";

export default function PartnersPage() {
  const [lang, setLang] = useState<PartnersLang>("en");
  const [geo, setGeo] = useState<GeoState>("loading");

  useEffect(() => {
    try {
      const sl = localStorage.getItem("agentic-lang");
      if (sl) setLang(pickPartnersLang(sl));
    } catch { /* default en */ }
  }, []);

  useEffect(() => {
    fetch("/api/geo-books", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setGeo(d?.blocked === false ? "allowed" : "blocked")) // fail-closed
      .catch(() => setGeo("blocked"));
  }, []);

  const t = PARTNERS_COPY[lang];

  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      {geo === "allowed" ? (
        <PartnersShowcase lang={lang} />
      ) : geo === "blocked" ? (
        <div className="partners-page" style={{ textAlign: "center" }}>
          <h1 className="partners-title">{t.unavailableTitle}</h1>
          <p className="partners-subtitle">{t.unavailableBody}</p>
          <p style={{ marginTop: 20 }}>
            <Link href="/" className="partners-back">{t.unavailableBack}</Link>
          </p>
        </div>
      ) : (
        // loading: nessun contenuto partner (fail-closed anche durante il fetch)
        <div className="partners-page" aria-busy="true" />
      )}
      <SiteFooter lang={lang} />
    </div>
  );
}
