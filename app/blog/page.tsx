// #SORO-BETREDGE-0812: standalone top-level /blog route (EN-only for now, like
// /partners and /weekly-pick). Unlike those, this page is a Server Component so
// it exports `metadata` directly — no segment layout needed. Indexable by
// default. The Soro widget itself renders client-side (see soro-embed.tsx).
import type { Metadata } from "next";
import { SoroEmbed } from "./soro-embed";

export const metadata: Metadata = {
  title: "Blog — BetRedge",
  description: "Insights, guides and analysis from BetRedge on sports prediction models and value betting.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      <SoroEmbed />
    </div>
  );
}
