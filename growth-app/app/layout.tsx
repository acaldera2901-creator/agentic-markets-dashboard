import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BetRedge Growth",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
