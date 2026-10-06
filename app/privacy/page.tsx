import type { Metadata } from "next";
import { PrivacyBody } from "./PrivacyBody";

export const metadata: Metadata = {
  title: "Privacy Policy | BetRedge",
  description: "Privacy Policy and GDPR information for BetRedge.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen font-mono mc-scene-clay" data-mc-ground style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      {/* #UI-MACHINA-0802 fase 3 — la scena del fondo cinematico, come sul desk. */}
      <span className="bgfix" aria-hidden="true" />
      <PrivacyBody />
    </div>
  );
}
