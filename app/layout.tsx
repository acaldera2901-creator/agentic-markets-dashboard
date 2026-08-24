import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import PageViewTracker from "@/components/PageViewTracker";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";
import "./machina.css"; // #UI-MACHINA-0802 — agisce SOLO dentro [data-mc]
import "./mobile.css"; // #UI-MOBILE-0822 — agisce SOLO sotto i 640px

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
// #SEO-PACK-0810: titoli senza em-dash (regola dura Maven: l'em-dash è un tell
// da testo generato e il <title> è la copy più visibile del sito). Niente
// title.template: i tools portano già "| BetRedge" nei loro metaTitle e un
// template lo raddoppierebbe — ogni rotta scrive il title completo.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.betredge.com"),
  title: "BetRedge: AI Football and Tennis Predictions",
  description: "A multi-agent AI desk that turns football and tennis odds into readable probabilities. See how every number is produced.",
  openGraph: {
    type: "website",
    url: "https://www.betredge.com",
    siteName: "BetRedge",
    title: "BetRedge: AI Football and Tennis Predictions",
    description: "A multi-agent AI desk that turns football and tennis odds into readable probabilities. See how every number is produced.",
    images: [{ url: "/icon.png", alt: "BetRedge" }],
  },
  twitter: {
    card: "summary",
    site: "@BetrEdge",
    title: "BetRedge: AI Football and Tennis Predictions",
    description: "A multi-agent AI desk that turns football and tennis odds into readable probabilities. See how every number is produced.",
    images: ["/icon.png"],
  },
};

// #SEO-SCAFFOLDING-0721: dati strutturati per Google/AI answer engines.
// Prezzi da PUBLIC_PAID_PLANS (display USD, fonte lib/commercial-plan.ts) —
// tenuti letterali qui perché JSON-LD vuole stringhe stabili nel markup;
// se il listino cambia, aggiornare entrambi.
// #SEO-PACK-0810: @id unico — il provider del Service referenzia QUESTA entità
// invece di dichiararne una seconda (i validatori contavano Organization x2).
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.betredge.com/#organization",
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
  provider: { "@id": "https://www.betredge.com/#organization" },
  offers: [
    { "@type": "Offer", name: "BetRedge Base", price: "14.99", priceCurrency: "USD" },
    { "@type": "Offer", name: "BetRedge Pro", price: "29.99", priceCurrency: "USD" },
  ],
};

// No-flash theme bootstrap (Cobalt & Coral redesign, F1).
// Runs before paint: resolves agentic-theme (localStorage) → prefers-color-scheme,
// then sets data-theme on <html>. Default dark. Pure presentation, no logic change.
// #UI-MACHINA-0802: senza una scelta esplicita il tema e' SCURO, non quello del
// sistema operativo. Il restyling e' un mondo visivo scuro (fondo cinematico) e
// vive dentro :root:not([data-theme="light"]): seguendo il sistema, chi ha il
// Mac in chiaro non vedrebbe MAI la veste nuova. La scelta manuale continua a
// vincere e a persistere: chi preme LIGHT resta sul prodotto di oggi.
const themeScript = `(function(){try{var t=localStorage.getItem('agentic-theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

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
        {/* #FUNNEL-MEAS-0813: page_view su OGNI rotta (prima solo dentro /app). */}
        <PageViewTracker />
        {/* #FUNNEL-MEAS-0813: il consenso si chiede su OGNI rotta (prima solo dentro
            /app): senza banner sulla landing nessuno accettava, e tutto ciò che è
            gated sul consenso — attribuzione compresa — non si attivava mai lì. */}
        <CookieBanner />
        {children}
      </body>
    </html>
  );
}
