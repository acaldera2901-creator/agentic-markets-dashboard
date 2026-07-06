import type { NextConfig } from "next";

// Security headers (#SEC-HARDENING michele-side, pending Andrea review/deploy).
// Applied to every response. CSP ships in Report-Only first so it can NEVER
// break the live site: it only logs violations. Promote to enforcing
// `Content-Security-Policy` after observing zero legitimate violations in prod.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next.js injects inline bootstrap + hydration scripts; 'unsafe-eval' kept for
  // dev/runtime. Tighten to nonces when promoting to enforcing.
  // Tawk.to live-chat widget loads its script/styles/fonts/iframe from *.tawk.to.
  // #CHAT-PROXY-VPN: quando il widget è servito via Cloudflare Worker su
  // chat.betredge.com (per non farsi bloccare dalle VPN anti-tracker) le stesse
  // risorse arrivano dal nostro dominio → chat.betredge.com aggiunto a tutte le
  // direttive rilevanti. I domini *.tawk.to restano per la modalità di default (inerte).
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://embed.tawk.to https://*.tawk.to https://chat.betredge.com",
  "style-src 'self' 'unsafe-inline' https://*.tawk.to https://chat.betredge.com",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://*.tawk.to https://chat.betredge.com",
  // Browser talks only to our own origin (the server proxies external APIs).
  // Supabase is allowed for any client SDK usage; Tawk.to needs https+wss for the
  // live chat channel; widen here if a real CSP report shows a legitimate origin.
  "connect-src 'self' https://*.supabase.co https://*.tawk.to wss://*.tawk.to https://chat.betredge.com wss://chat.betredge.com",
  // Tawk.to renders its chat UI inside an iframe from *.tawk.to.
  "frame-src 'self' https://*.tawk.to https://chat.betredge.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // LOW-26: send violations to our sink so they're observable — without this
  // the Report-Only policy could never be validated for promotion to enforcing.
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  // Force HTTPS for 2 years incl. subdomains (Vercel terminates TLS already).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Clickjacking: this dashboard is never meant to be framed cross-origin.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop MIME-sniffing (defense against content-type confusion).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry ?ref=/session hints) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful APIs we never use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  // Pin the workspace root so dev/build always resolve from this directory
  // (a stray lockfile above the repo can otherwise make Next mis-infer it).
  turbopack: { root: __dirname },
  // #UI-SCROLLTOP-0623: route navigations land at the top (and restore the
  // remembered position on back/forward) instead of inheriting the previous
  // scroll. Supported in this Next version (config-schema: experimental
  // .scrollRestoration). Presentational only.
  experimental: { scrollRestoration: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
