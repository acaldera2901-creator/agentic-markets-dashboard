import type { Metadata } from "next";
import { Anton, Barlow_Condensed, JetBrains_Mono, Manrope } from "next/font/google";
import PageViewTracker from "@/components/PageViewTracker";
import CookieBanner from "@/components/CookieBanner";
import VercelAnalytics from "@/components/VercelAnalytics";
import "./globals.css";
import "./machina.css"; // #UI-MACHINA-0802 — agisce SOLO dentro [data-mc]
import "./mobile.css"; // #UI-MOBILE-0822 — agisce SOLO sotto i 640px
import "./design-system.css"; // #RESTYLING-0921 — componenti br-*, solo token --am-*

// #RESTYLING-0921 round 7 — i tre font del riferimento, misurati sul sito di
// Codex, non scelti a gusto: Manrope per il corpo (era Hanken Grotesk),
// Barlow Condensed per label/CTA/teste condensate (era Saira Condensed — stessi
// due pesi, quindi sostituzione uno-a-uno) e Anton per il display (H1, hero,
// numeri eroe), che prima non esisteva nel sistema.
const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// #CARD-HUD-0830 — la condensata pesante del registro gaming: regge i numeri
// enormi della scheda senza diventare Oswald, che si vede ovunque. Solo due pesi:
// 700 per i nomi, 800 per il numero eroe.
// #RESTYLING-0921 round 7: Saira Condensed → Barlow Condensed (il condensato del
// riferimento). Stesso ruolo, stessi due pesi: nessuna regola CSS cambia.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-tech",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

// #RESTYLING-0921 round 7 — Anton, il display del riferimento. Un solo peso
// (400) per disegno: dove serve "più grassetto" si va più grandi, non si chiede
// un 800 che il browser sintetizzerebbe sporcando le aste.
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// #RESTYLING-0921: aggiunto il 700. I numeri della PredictionCard (Model /
// Market / Edge) devono dominare le label: il 600 a 32px non basta, il 700 sì.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// #SEO-SCAFFOLDING-0721: metadataBase + OG/Twitter site-wide (prima: zero → le
// preview di link su Slack/TG/X/LinkedIn uscivano vuote). Le pagine figlie
// ereditano e possono sovrascrivere title/description con la Metadata API.
// #SEO-PACK-0810: titoli senza em-dash (regola dura Maven: l'em-dash è un tell
// da testo generato e il <title> è la copy più visibile del sito). Niente
// title.template: i tools portano già "| BetRedge" nei loro metaTitle e un
// template lo raddoppierebbe — ogni rotta scrive il title completo.
// #CONVERSION-COPY-0916: la categoria nel title (audit Tommy §8 — «sports
// probability», non «AI predictions»: il secondo è la parola dei tipster e
// confonde col brand omonimo). Adattato alla convenzione della root («BetRedge:
// …», niente pipe, niente em-dash). Descrizione sotto i 160 caratteri.
const SITE_TITLE = "BetRedge: Sports Probability, Market Odds and Transparent Match Analysis";
const SITE_DESCRIPTION = "Market-implied probability vs a calibrated model, on football and tennis. See the edge, the reasoning and the pre-kick-off record. No tips, no bookmaker.";
export const metadata: Metadata = {
  metadataBase: new URL("https://www.betredge.com"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: "https://www.betredge.com",
    siteName: "BetRedge",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/icon.png", alt: "BetRedge" }],
  },
  twitter: {
    card: "summary",
    site: "@BetrEdge",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
  // #CONVERSION-COPY-0916 (audit §8): la distinzione stabile, ripetuta nei dati
  // strutturati — non un bookmaker, non un exchange, non piazza scommesse.
  description: "BetRedge is a sports probability engine for football and tennis. It is not a bookmaker or a betting exchange and does not place bets.",
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

// #RESTYLING-0921 round 14 — IL TEMA È UNO SOLO, E LO DECIDE IL SERVER.
// Qui girava, prima del paint, uno script che leggeva `agentic-theme` da
// localStorage e ne ricavava `data-theme`. Aveva senso finché il tema era una
// scelta; Andrea l'ha chiusa: «togliamo la versione light, deve rimanere solo
// la dark ma senza bottone». Il valore lo scrive l'attributo statico qui
// sotto, quindi non c'è più niente da bootstrappare e niente da cui flashare.
// Le regole `:root[data-theme="light"]` restano nei CSS: non sono più
// raggiungibili (nessun codice scrive quel valore) e toglierle vorrebbe dire
// rigenerare app/machina.css, che è un file GENERATO e il cui tema scuro è
// scritto proprio come `:root:not([data-theme="light"])`. Si è tolto il modo
// di accenderlo, non le migliaia di righe che non si accendono più.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${manrope.variable} ${jetbrainsMono.variable} ${barlowCondensed.variable} ${anton.variable}`}>
      <head>
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
        {/* #SEO-ANALYTICS-0915: Vercel Web Analytics, montato SOLO dopo l'Accept
            del banner (la regola vive dentro il componente, come per LiveChat).
            Affianca il beacon di prima parte, non lo sostituisce. */}
        <VercelAnalytics />
        {/* #FUNNEL-MEAS-0813: il consenso si chiede su OGNI rotta (prima solo dentro
            /app): senza banner sulla landing nessuno accettava, e tutto ciò che è
            gated sul consenso — attribuzione compresa — non si attivava mai lì. */}
        <CookieBanner />
        {children}
      </body>
    </html>
  );
}
