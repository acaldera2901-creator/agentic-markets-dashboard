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

export const metadata: Metadata = {
  title: "Agentic Markets OS — Sports Trading Desk",
  description: "Football and tennis multi-agent AI sports prediction desk",
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
