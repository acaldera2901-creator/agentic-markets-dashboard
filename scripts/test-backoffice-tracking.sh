#!/usr/bin/env bash
# Synthetic fixtures only. Does not require provider credentials or a live DB.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
npx vitest run \
  app/api/analytics/session/route.test.ts \
  app/api/webhooks/resend/route.test.ts \
  app/api/track/route.test.ts \
  'app/go/[partner]/route.test.ts' \
  app/api/auth/acquisition.test.ts \
  app/api/auth/invitee-bonus.test.ts \
  app/api/shopify/webhook/route.test.ts \
  app/api/cron/shopify-reconcile/route.test.ts \
  lib/analytics-session.test.ts \
  lib/business-events.test.ts \
  lib/business-event-rail.test.ts \
  lib/email-outcomes.test.ts \
  lib/product-analytics-migration.test.ts \
  lib/tracking-counters.test.ts \
  lib/tracking-retention.test.ts \
  lib/analytics-quality.test.ts \
  lib/track-event.test.ts \
  lib/analytics-events.test.ts \
  lib/sql-guard.test.ts \
  lib/events-write-gate.test.ts \
  lib/bot-filter.test.ts \
  lib/affiliate/rail-hooks.test.ts \
  lib/crypto-settle.test.ts \
  lib/paygate-settle.test.ts \
  lib/email-sender-split.test.ts \
  lib/classic-tracking-overlay.test.tsx \
  components/classic/ClassicLobby.test.tsx \
  components/CookiePreferences.test.tsx \
  components/CookieBanner.test.tsx \
  components/PageViewTracker.test.tsx \
  components/HouseBanner.test.tsx \
  components/VercelAnalytics.test.tsx
