# News social feed

Andrea requested removal of inline Photo credits and an Instagram-style news page with working likes and comments. The /blog#news feed retains source news titles, timestamps, ordering and image URLs while presenting full-width posts, BetRedge identity, real engagement, sharing and device-local bookmarks.

Inline attribution moves to /blog/credits, linked once below the feed; stored photo credits and license links remain intact. This is not deletion of required attribution.

Community reads are public; mutations use the existing signed BetRedge session and same-origin JSON requests. One like per account and news item is enforced by a primary key. Comments are plain text, max 1,000 characters, limited atomically to one/account/minute, with UUID retry idempotency. Public responses never expose account identifiers. Authors and admin_full can delete comments. Anonymous users enter the existing login modal and return to the post. Bookmarks are explicitly local to the device, not account-synced.

Migration: supabase/migrations/20261105220000_news_community.sql, additive tables with RLS and no direct anon/authenticated access. Applied to the existing BetRedge Supabase project on 2026-11-05. No existing news content altered. Reverting the UI/API commit leaves additive tables safe and unused; preserve engagement data.

Validation: 70 scoped tests including actual PostgreSQL-compatible PGlite comment/like persistence, unique constraints, cross-account delete denial, rate limit, retry and cascade cleanup. TypeScript check passes. Local browser desktop and 390px mobile: 20 posts, zero inline photo-credit elements, scrollWidth equals 390. Actual browser like persisted through reload, then removed to restore initial state. No public test comments posted.
