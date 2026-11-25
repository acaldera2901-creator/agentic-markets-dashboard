# BetRedge — tracking registration to checkout

## Changes
- Preserve original landing source/agent in memory until consent, then save first touch. Store only external referrer host. Do not reuse stored attribution after withdrawal.
- Serialize initial signed-session setup before browser events and auth. Reuse readiness for 15 minutes per browser storage SID to avoid one bootstrap per click. Bootstrap has a 2-second timeout, never blocks registration indefinitely. Refusal/withdrawal prevents identification.
- When linking is enabled, signup_session_id comes from the signed cookie, not the client-supplied legacy identifier. Profile linkage still requires successful authentication/activation.
- Separate checkout_attempt, checkout_ready (provider returned payment URL/order), checkout_failed (HTTP status, network or malformed response). Instrument the main CheckoutModal Shopify flow, its PayGate fallback and CryptoDirectPanel. Other standalone Apple Pay / weekly PayGate entry points are outside this patch. No payment URLs, wallet addresses, email or raw provider error text in these events. Purchase remains an authoritative server event, never a browser success or a redirect.
- Internal test signup acquisition marked traffic_type=internal. GA4 signup skips internal browser contexts; MP sends only in production. First-party host comes from the request, so preview/test host classification is not omitted.
- Includes SEO draft PR #630's server-confirmed GA4 signup and duplicate-insert protection; do not independently merge both branches without reconciling.

## Agent attribution contract
Use `agent` for the executor, `utm_source` for the channel, `utm_medium` for placement, `utm_campaign` for campaign, `utm_content` for the specific post/creative. Never include email, handle, lead ID or other personal data in tags.

| Agent | agent value |
|---|---|
| Contatto Lead | contatto_lead |
| BetRedge Social | betredge_social |
| Social Growing | social_growing |
| Reddit | reddit |
| SEO | seo |
| Monatipster | monatipster |
| Jessika | jessika |
| Video Jessika | video_jessika |
| Tryshit | tryshit |

Example: `https://www.betredge.com/plans?agent=betredge_social&utm_source=instagram&utm_medium=bio&utm_campaign=nov25&utm_content=profile`
Contatto Lead example: `https://www.betredge.com/plans?agent=contatto_lead&utm_source=instagram&utm_medium=dm&utm_campaign=nov25`.
Scouter sourcing is an upstream assisted activity, not a site visitor or sale. Do not credit it with visits just for collecting contacts. SEO organic search usually cannot carry an agent tag; Google/referrer attribution is a channel, not proof that a particular agent caused the acquisition. Untagged traffic stays unknown. Published links and agent templates must adopt the contract at rollout; this code change does not edit social accounts or send outreach.

## Reports
- `traffic-by-agent.sql`: consenting sessions by declared arrival agent/source. Sessions are not unique or certified humans. Anonymous events must be reported separately.
- `funnel-by-agent.sql`: accounts created in [$1,$2), activation, linked coverage, first product usage, plans, opened checkout, attempt, provider-ready, errors, server-confirmed paying accounts observed up to $2. Uses account acquisition, session links and valid non-revoked signup SID. Retries and multi-session activity count once per account. Known internal/test and admins excluded; unmarked historic internal accounts may remain. No claim of bot-proof identity.
- These are activity milestones, not a strictly sequential conversion funnel. In particular a user may view plans before registration; post-signup counts intentionally exclude that earlier step. Traffic-window sessions and new-account cohorts have different denominators; never divide one by the other. No purchase revenue inferred from Pro status. Purchase is not net cash after refunds.
- Attribute losses only after linked coverage is adequate. Zero events with missing consent/configuration is not proof of abandonment.

When running these SQL files through `exec_sql`, remove SQL line comments and the final semicolon before interpolation. The legacy RPC wraps SELECTs in a subquery and silently returns `[]` on its fallback execution when the trailing semicolon breaks that wrapper; an empty RPC result alone is not proof of no activity. Run only trusted, server-side parameter interpolation.

## Read-only production preflight (25 November)
Vercel project betredge/betredge: NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED=0, ANALYTICS_LINKING_ENABLED=0, ANALYTICS_RETENTION_APPROVED=1. ANALYTICS_SESSION_SECRET and GA4_MEASUREMENT_PROTOCOL_SECRET not present in production env listing. Existing database connected from canonical project: br_analytics_sessions, session_links, signup_session_id, acquisition, br_insert_browser_event and br_emit_business_event present. No schema/config/data writes performed.

## Concrete activation steps — production approval required
1. Review this branch and reconcile draft #630. Verify latest main before merging.
2. Set a new random ANALYTICS_SESSION_SECRET (>=32 characters) directly in Vercel production secrets, never commit it. Set both ANALYTICS_LINKING_ENABLED and NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED to 1; keep ANALYTICS_RETENTION_APPROVED=1. The public flag requires a rebuild.
3. If GA4 signup is desired, create a new Measurement Protocol API secret in GA4 and store GA4_MEASUREMENT_PROTOCOL_SECRET. First-party attribution does not depend on GA4. Do not reuse the revoked secret.
4. Deploy reviewed commit. No migration required based on preflight. Roll back by restoring the previous deployment and disabling both linking flags; don't delete events or tables.
5. In a dedicated internal browser context set localStorage betredge_internal=1 before visiting; keep automated QA out of customer attribution. Validate consent, auth, and provider test-mode checkout. Never make a live charge merely to prove the path.
6. Check consented external traffic with appropriately authorized test setup: correct signed cookie, source, signup SID, activation binding, checkout counters. In GA4 verify delivery separately; HTTP 2xx from Measurement Protocol alone is not proof GA4 accepted the event.
7. Adopt tagged links in agent publishing templates and observe 24–48 hours. Compare registered/activated/engaged accounts and checkout errors per agent, with coverage shown. User signups with denied consent remain unlinked.

## Validation boundaries
Automated tests use simulated payment providers and isolated PGlite, not live purchases. Browser UI on the deployed candidate, real email delivery, provider production configuration, and GA4 reception must still be checked after approved rollout. Build/test results and exact tooling versions are recorded in the task report. No production deployment has been performed.
