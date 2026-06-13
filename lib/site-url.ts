// Canonical public base URL for links rendered server-side (transactional
// emails, renewal reminders). Driven by env so switching to a custom domain is
// a one-line env change (NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_BASE_URL) — never a
// code edit. Falls back to the live Vercel URL. No trailing slash.
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  return (env || "https://betredge-app.vercel.app").replace(/\/$/, "");
}
