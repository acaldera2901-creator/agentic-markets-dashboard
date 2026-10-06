import type { Metadata } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import "./globals.css";

// Brand faces (brandkits/betredge.json): Big Shoulders 800 at opsz 72 for the
// section titles, Archivo for everything else (numbers at wdth 75 / wght 800).
// next/font self-hosts them at build time: no request leaves for Google.
// No metric table for Big Shoulders in next/font → no size-adjusted fallback (titles only, the shift is tolerable).
const display = Big_Shoulders({ subsets: ["latin"], weight: "variable", axes: ["opsz"], variable: "--font-display", display: "swap", adjustFontFallback: false });
const text = Archivo({ subsets: ["latin"], weight: "variable", axes: ["wdth"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: "BetRedge Growth",
  robots: { index: false, follow: false },
};

// Paper is the default theme; navy only when the reader chose it (ui/ThemeToggle).
// Applied before first paint so the choice never flashes; storage may be
// unavailable (private window, blocked site data), hence the try/catch.
const THEME_SCRIPT = `try{var t=localStorage.getItem("growth-theme");if(t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
