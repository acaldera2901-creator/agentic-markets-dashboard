// lib/feed-stamp.ts (#REDESIGN-V3C fixdata B2) — when a book's feed map was read.
// The feeds (lib/betconstruct-feed.ts, lib/altenar-feed.ts) serve a cached map, stale
// while it revalidates, or the last good copy when the book is down: the map a caller
// gets can be minutes or hours old. They stamp each map they cache with the time it
// was read, so a price can say WHEN it was the price («price at 14:31»), not when the
// page asked. A WeakMap: nothing changes for the callers that never ask.
const fetchedAt = new WeakMap<object, number>();

export function stampFeedMap(map: object, at: number): void {
  fetchedAt.set(map, at);
}

/** When this map was read from the book (epoch ms); null = unknown (not stamped). */
export function feedMapAt(map: object): number | null {
  return fetchedAt.get(map) ?? null;
}
