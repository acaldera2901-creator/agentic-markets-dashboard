import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// #SEO-SCAFFOLDING-0721: metadataBase + OG/Twitter site-wide (prima: zero → le
// preview di link su Slack/TG/X/LinkedIn uscivano vuote). Le pagine figlie
// ereditano e possono sovrascrivere title/description con la Metadata API.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.betredge.com"),
  title: "BetRedge — Predictive Sports Intelligence",
  description: "Football and tennis multi-agent AI sports prediction desk",
  openGraph: {
    type: "website",
    url: "https://www.betredge.com",
    siteName: "BetRedge",
    title: "BetRedge — Predictive Sports Intelligence",
    description: "Football and tennis multi-agent AI sports prediction desk",
    images: [{ url: "/icon.png", alt: "BetRedge" }],
  },
  twitter: {
    card: "summary",
    site: "@BetrEdge",
    title: "BetRedge — Predictive Sports Intelligence",
    description: "Football and tennis multi-agent AI sports prediction desk",
    images: ["/icon.png"],
  },
};

// #SEO-SCAFFOLDING-0721: dati strutturati per Google/AI answer engines.
// Prezzi da PUBLIC_PAID_PLANS (display USD, fonte lib/commercial-plan.ts) —
// tenuti letterali qui perché JSON-LD vuole stringhe stabili nel markup;
// se il listino cambia, aggiornare entrambi.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BetRedge",
  url: "https://www.betredge.com",
  logo: "https://www.betredge.com/icon.png",
  description: "Football and tennis multi-agent AI sports prediction desk",
  sameAs: ["https://x.com/BetrEdge", "https://www.instagram.com/betr.edge/"],
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "BetRedge Sports Prediction Subscription",
  provider: { "@type": "Organization", name: "BetRedge" },
  offers: [
    { "@type": "Offer", name: "BetRedge Base", price: "14.99", priceCurrency: "USD" },
    { "@type": "Offer", name: "BetRedge Pro", price: "29.99", priceCurrency: "USD" },
  ],
};

// No-flash theme bootstrap (Cobalt & Coral redesign, F1).
// Runs before paint: resolves agentic-theme (localStorage) → prefers-color-scheme,
// then sets data-theme on <html>. Default dark. Pure presentation, no logic change.
const themeScript = `(function(){try{var t=localStorage.getItem('agentic-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${hankenGrotesk.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
        />
      </head>
      <body className="antialiased">
        {/* Grana sub-percettiva: texture = segnale human-made (vedi .am-grain in
            globals.css). Fissa, dietro al contenuto (z-index:-1), non interattiva. */}
        <div className="am-grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
