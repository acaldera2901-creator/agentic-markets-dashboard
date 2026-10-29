"use client";
// components/news/use-news.ts (#NEWS-FOTMOB-PROD-1026) — what the three news
// surfaces share in the browser: the feed (one GET /api/news per page, shared
// by every card and strip), the board matches for the «On the board» links
// (the same /api/predictions the desk loads), a clock to the minute (one
// interval for everyone) and the site language (the `agentic-lang` key every
// page outside the desk already reads, see ClassicChrome).
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { newsCopy } from "@/lib/news/copy";
import { notesForMatch, rowsFor, type BoardMatch, type NewsRow, type WireFeed } from "@/lib/news/view";

// ─── the feed ────────────────────────────────────────────────────────────────
type Store<T> = { value: T; listeners: Set<() => void>; started: boolean };
const feedStore: Store<WireFeed | null> = { value: null, listeners: new Set(), started: false };

function startFeed() {
  if (feedStore.started || typeof window === "undefined") return;
  feedStore.started = true;
  fetch("/api/news", { credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<WireFeed>) : Promise.reject(new Error(String(r.status)))))
    .then((f) => { feedStore.value = f; })
    .catch(() => { feedStore.value = { state: "error" }; })
    .then(() => feedStore.listeners.forEach((l) => l()));
}

/** The feed, null until it arrives (and on the server). */
export function useNewsFeed(): WireFeed | null {
  return useSyncExternalStore(
    (cb) => { feedStore.listeners.add(cb); startFeed(); return () => { feedStore.listeners.delete(cb); }; },
    () => feedStore.value,
    () => null,
  );
}

// ─── the board, for the links ───────────────────────────────────────────────
type Pred = { match_id: string; home_team: string; away_team: string; league_name?: string | null; league?: string | null };
const boardStore: Store<BoardMatch[] | null> = { value: null, listeners: new Set(), started: false };

function startBoard() {
  if (boardStore.started || typeof window === "undefined") return;
  boardStore.started = true;
  fetch("/api/predictions", { credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<{ predictions?: Pred[] }>) : Promise.reject(new Error(String(r.status)))))
    .then((d) => {
      boardStore.value = (d.predictions ?? [])
        .filter((p) => p && typeof p.match_id === "string" && typeof p.home_team === "string" && typeof p.away_team === "string")
        .map((p) => ({ id: p.match_id, home: p.home_team, away: p.away_team, league: p.league_name ?? p.league ?? null }));
    })
    .catch(() => { boardStore.value = []; })
    .then(() => boardStore.listeners.forEach((l) => l()));
}

/** The football board (id, home, away), [] when it cannot be read: a missing link is better than a wrong one. */
export function useBoardMatches(enabled: boolean): BoardMatch[] {
  const v = useSyncExternalStore(
    (cb) => { boardStore.listeners.add(cb); if (enabled) startBoard(); return () => { boardStore.listeners.delete(cb); }; },
    () => boardStore.value,
    () => null,
  );
  return v ?? [];
}

/** The desk's deep link to a football match (app/app/page.tsx: `?match=football:<id>`). */
export const boardHref = (m: BoardMatch): string => `/predictions?match=${encodeURIComponent(`football:${m.id}`)}`;

// ─── the clock ──────────────────────────────────────────────────────────────
const clock = { listeners: new Set<() => void>(), timer: null as ReturnType<typeof setInterval> | null };
const minute = () => Math.floor(Date.now() / 60_000) * 60_000;

/** «now» to the minute, client only (null on the server and at hydration): relative times never mismatch. */
export function useNow(): number | null {
  return useSyncExternalStore(
    (cb) => {
      clock.listeners.add(cb);
      if (!clock.timer) clock.timer = setInterval(() => clock.listeners.forEach((l) => l()), 60_000);
      return () => {
        clock.listeners.delete(cb);
        if (!clock.listeners.size && clock.timer) { clearInterval(clock.timer); clock.timer = null; }
      };
    },
    minute,
    () => null,
  );
}

// ─── the language ───────────────────────────────────────────────────────────
const LANGS: readonly string[] = ["it", "en", "es", "fr", "ru"];

/** The site language outside the desk (`agentic-lang`, as ClassicChrome and CookieBanner read it). "en" until mount. */
export function useSiteLang(): string {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    const read = () => {
      try { const v = localStorage.getItem("agentic-lang") ?? ""; setLang(LANGS.includes(v) ? v : "en"); } catch { /* storage off → en */ }
    };
    read();
    window.addEventListener("agentic-lang-change", read);
    return () => window.removeEventListener("agentic-lang-change", read);
  }, []);
  return lang;
}

// ─── the match sheet ────────────────────────────────────────────────────────
export type SheetNews = { label: string; inEnglish: string; rows: NewsRow[] };

/** The News card of a football match sheet: the notes naming either team, strings in the desk language. null = nothing to show. */
export function useMatchNews(home: string, away: string, lang: string): SheetNews | null {
  const feed = useNewsFeed();
  const now = useNow();
  return useMemo(() => {
    if (!feed || feed.state !== "ok") return null;
    const notes = notesForMatch(feed.cards, home, away);
    if (!notes.length) return null;
    const c = newsCopy(lang);
    const rows = rowsFor(notes, lang, now);
    return { label: c.newsSection, inEnglish: c.inEnglish, rows };
  }, [feed, now, home, away, lang]);
}
