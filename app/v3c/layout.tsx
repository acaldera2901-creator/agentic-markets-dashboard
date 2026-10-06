// app/v3c/layout.tsx (#REDESIGN-V3C polish) — le icone del marchio v3c.
// Vale SOLO per le pagine servite da app/v3c/* (a flag acceso, via le rewrite di
// lib/v3c/rewrites.ts). A flag spento nessuna URL pubblica arriva qui, quindi
// app/favicon.ico e app/icon.png del sito di oggi restano quelli di sempre.
// Set ufficiale STANDARD di redesign/brand/favicon (la variante «small» non è
// approvata e non si usa).
import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/brand/v3c/app/favicon.ico", sizes: "48x48" },
      { url: "/brand/v3c/app/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/v3c/app/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/brand/v3c/app/site.webmanifest",
};

export default function V3cLayout({ children }: { children: React.ReactNode }) {
  return children;
}
