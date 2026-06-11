"use client";

// app/admin/banners-preview/page.tsx (#HOUSE-BANNERS-1)
// Anteprima/export degli house banner a dimensioni px esatte. Protetta dal
// middleware /admin. Da qui si catturano i PNG (Chrome headless) per usi esterni
// (social, email). Nessuna logica di business: renderizza HOUSE_CAMPAIGNS.

import { useState } from "react";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";
import { HouseBanner } from "@/components/HouseBanner";
import { HOUSE_CAMPAIGNS, type HouseFormat, type Lang } from "@/lib/house-banners";

const SIZES: Record<HouseFormat, { w: number; h: number; label: string }> = {
  leaderboard: { w: 728, h: 90, label: "Leaderboard 728×90" },
  rectangle: { w: 300, h: 250, label: "Rectangle 300×250" },
  billboard: { w: 970, h: 250, label: "Billboard 970×250" },
  halfpage: { w: 300, h: 600, label: "Half Page 300×600" },
};

export default function BannersPreviewPage() {
  const [lang, setLang] = useState<Lang>("it");

  return (
    <div style={{ minHeight: "100vh", background: "var(--am-bg)", padding: "32px 28px" }}>
      <SportGlyphSprite />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--am-text)", margin: 0 }}>
          House Banners — preview / export
        </h1>
        <div className="am-tt" role="group" aria-label="Lang">
          <button className={lang === "it" ? "on" : ""} onClick={() => setLang("it")}>IT</button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {HOUSE_CAMPAIGNS.map((c) => {
          const size = SIZES[c.format];
          return (
            <div key={c.id}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted)", margin: "0 0 8px" }}>
                {c.id} · {c.slot} · {size.label} · [{c.audiences.join(", ")}]
              </p>
              <div
                data-export={c.id}
                style={{ width: size.w, height: size.h, maxWidth: "100%" }}
              >
                <HouseBanner campaign={c} lang={lang} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
