"use client";

import { useEffect, useState } from "react";

// One shared /api/auth probe for client islands that live on otherwise-static
// pages (e.g. the /world-cup hub, revalidate=300). The promise is cached at the
// module level so multiple islands on the same page share a single request.
// The cache is short-lived: with soft navigation the module survives a
// login/logout, and a forever-cache left paying users gated (or logged-out
// users revealed) until a hard reload.
let cached: Promise<boolean> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

// Call after any auth state change (login/logout) so the next island mount
// re-probes instead of serving the pre-auth answer.
export function resetAccessCache(): void {
  cached = null;
  cachedAt = 0;
}

function fetchAccess(): Promise<boolean> {
  if (!cached || Date.now() - cachedAt > CACHE_TTL_MS) {
    cachedAt = Date.now();
    cached = fetch("/api/auth", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const plan = d?.plan;
        return plan === "base" || plan === "premium" || plan === "admin_full";
      })
      .catch(() => {
        resetAccessCache();
        return false;
      });
  }
  return cached;
}

// True only for paid tiers (base/premium/admin). Defaults to false so the
// server/static render and anonymous/free viewers stay in the gated state;
// paid viewers flip to true after the client probe (no name flash for the
// gated case, only a brief reveal delay for paid).
export function useHasAccess(): boolean {
  const [hasAccess, setHasAccess] = useState(false);
  useEffect(() => {
    let on = true;
    fetchAccess().then((v) => { if (on) setHasAccess(v); });
    return () => { on = false; };
  }, []);
  return hasAccess;
}
