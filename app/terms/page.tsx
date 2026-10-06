import type { Metadata } from "next";
import { TermsBody } from "./TermsBody";

export const metadata: Metadata = {
  title: "Terms of Service | BetRedge",
  description: "Terms of Service for BetRedge: accounts, plans, payments, and acceptable use.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen font-mono mc-scene-clay" data-mc-ground style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      {/* #UI-MACHINA-0802 fase 3 — la scena del fondo cinematico, come sul desk. */}
      <span className="bgfix" aria-hidden="true" />
      <TermsBody />
    </div>
  );
}
