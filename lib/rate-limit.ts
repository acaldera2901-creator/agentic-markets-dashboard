// Best-effort in-memory sliding-window rate limiter. Per serverless instance
// (Vercel runs several), so it's NOT a hard global guarantee — but it
// meaningfully slows brute-force / flooding from a single source without a
// dedicated KV. Keyed by an arbitrary string (IP, IP+identifier, …).

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  buckets.set(key, arr);
  // crude memory cap so the map can't grow unbounded under attack
  if (buckets.size > 5000) {
    for (const k of buckets.keys()) { buckets.delete(k); if (buckets.size <= 4000) break; }
  }
  return arr.length > max;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}
