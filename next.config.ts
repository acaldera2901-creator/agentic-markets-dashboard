import type { NextConfig } from "next";

// Security headers (#SEC-HARDENING michele-side, pending Andrea review/deploy).
// Applied to every response. CSP ships in Report-Only first so it can NEVER
// break the live site: it only logs violations. Promote to enforcing
// `Content-Security-Policy` after observing zero legitimate violations in prod.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next.js injects inline bootstrap + hydration scripts; 'unsafe-eval' kept for
  // dev/runtime. Tighten to nonces when promoting to enforcing.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // Browser talks only to our own origin (the server proxies external APIs).
  // Supabase is allowed for any client SDK usage; widen here if a real CSP
  // report shows a legitimate blocked origin.
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
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
  // Nested lockfiles (dashboard-web/, client-portal/) make Next mis-infer the
  // workspace root; pin it so dev/build always resolve from this directory.
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
