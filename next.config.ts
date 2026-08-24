import type { NextConfig } from "next";

// Security headers (#SEC-HARDENING michele-side, pending Andrea review/deploy).
// Applied to every response. CSP shipped in Report-Only from #SEC-HARDENING
// to 2026-07-30, then promoted to enforcing once the allowlist was completed
// from a full census of the client code (#CSP-ENFORCE-0730).
const CSP_POLICY = [
  "default-src 'self'",
  // Next.js injects inline bootstrap + hydration scripts; 'unsafe-eval' kept for
  // dev/runtime. Tightening to nonces stays a future hardening step.
  // Tawk.to live-chat widget loads its script/styles/fonts/iframe from *.tawk.to.
  // #CHAT-PROXY-VPN: quando il widget è servito via Cloudflare Worker su
  // chat.betredge.com (per non farsi bloccare dalle VPN anti-tracker) le stesse
  // risorse arrivano dal nostro dominio → chat.betredge.com aggiunto a tutte le
  // direttive rilevanti. I domini *.tawk.to restano per la modalità di default (inerte).
  // #CSP-ALLOWLIST-0730: PayPal Buttons/Apple Pay SDK is injected client-side
  // (app/app/page.tsx loads https://www.paypal.com/sdk/js). Without these
  // origins an ENFORCING policy would kill the card/Apple Pay rail: the SDK
  // script, its checkout iframes and its XHR all cross to paypal.com.
  // *.paypal.com also covers www.sandbox.paypal.com (CSP host wildcards match
  // nested subdomains); paypalobjects/cdn-apple serve SDK assets.
  // #CSP-ENFORCE-0801: aggiunto https://vercel.live (decisione Andrea). E' il
  // feedback del toolbar Vercel, iniettato SOLO se il cookie del toolbar e'
  // presente — quindi lo carica il team quando naviga la produzione, mai un
  // cliente (verificato: non compare in nessuna delle 8 pagine pubbliche). In
  // enforce senza questa voce l'unica cosa che si romperebbe sarebbe la toolbar
  // per noi.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://embed.tawk.to https://*.tawk.to https://chat.betredge.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://applepay.cdn-apple.com https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://*.tawk.to https://chat.betredge.com",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://*.tawk.to https://chat.betredge.com",
  // Browser talks only to our own origin (the server proxies external APIs).
  // Supabase is allowed for any client SDK usage; Tawk.to needs https+wss for the
  // live chat channel; widen here if a real CSP report shows a legitimate origin.
  // #CSP-ALLOWLIST-0730: ipapi.co is fetched from the browser for language
  // auto-detect (app/app/page.tsx) — it was the known Report-Only violation
  // since 2026-06-08 and was never allowlisted; PayPal SDK XHRs cross-origin.
  "connect-src 'self' https://*.supabase.co https://*.tawk.to wss://*.tawk.to https://chat.betredge.com wss://chat.betredge.com https://ipapi.co https://www.paypal.com https://*.paypal.com",
  // Tawk.to renders its chat UI inside an iframe from *.tawk.to; the PayPal SDK
  // renders the button/checkout flow inside paypal.com iframes.
  "frame-src 'self' https://*.tawk.to https://chat.betredge.com https://www.paypal.com https://*.paypal.com",
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
  // #CSP-ENFORCE-0730: promoted from Report-Only after completing the
  // allowlist (ipapi.co + PayPal). 'unsafe-inline'/'unsafe-eval' are still
  // allowed (Next.js inline bootstrap), so enforcement cannot break first-party
  // rendering: it only blocks origins outside the allowlist. report-uri kept —
  // anything blocked keeps showing up in /api/csp-report.
  { key: "Content-Security-Policy", value: CSP_POLICY },
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
    return [
      // #WIDGET-EMBED-0824: /embed è l'unico path incorporabile da terzi e porta
      // i suoi header nella route handler (frame-ancestors *, CSP con l'hash
      // dello script inline). Va quindi ESCLUSO da questa regola: due regole che
      // impostano lo stesso header lascerebbero all'ordine di merge la decisione
      // su chi vince — qui invece è scritto, e c'è un test che lo verifica.
      { source: "/((?!embed$).*)", headers: securityHeaders },
      // Lo script del widget vive sui siti dei partner: cache lunga sul CDN,
      // revalidabile, così un fix arriva senza toccare il loro HTML.
      {
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
