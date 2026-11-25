-- Read only. $1 inclusive and $2 exclusive timestamps, explicitly in UTC.
-- New-account cohort, observed until $2. Accounts are not certified humans.
-- Source/agent are declared link tags, not proof of causation. No historic guessing.
WITH cohort AS (
 SELECT id, created_at, activated_at, signup_session_id,
   COALESCE(NULLIF(acquisition->>'agent',''),'unknown') AS agent,
   COALESCE(NULLIF(acquisition->>'utm_source',''),NULLIF(acquisition->>'src',''),'unknown') AS source
 FROM profiles
 WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
   AND plan <> 'admin_full'
   AND COALESCE(acquisition->>'traffic_type','') NOT IN ('internal','test')
), linked AS (
 SELECT c.id,s.session_id FROM cohort c JOIN session_links s ON s.profile_id=c.id
 JOIN br_analytics_sessions a ON a.session_id=s.session_id AND a.revoked_at IS NULL
 UNION
 SELECT c.id,a.session_id FROM cohort c JOIN br_analytics_sessions a
 ON a.session_id=c.signup_session_id AND a.revoked_at IS NULL
), usage AS (
 SELECT c.id,
   bool_or(e.event_type='card_open') AS used_product,
   bool_or(e.event_type='plan_view') AS viewed_plans,
   bool_or(e.event_type='checkout_opened') AS opened_checkout,
   bool_or(e.event_type='checkout_attempt') AS attempted_checkout,
   bool_or(e.event_type='checkout_ready') AS provider_ready,
   bool_or(e.event_type='checkout_failed') AS encountered_failure
 FROM cohort c JOIN linked l ON l.id=c.id JOIN events e ON e.session_id=l.session_id
 WHERE e.created_at >= c.created_at AND e.created_at < $2::timestamptz
 AND COALESCE(e.meta->>'internal','false') <> 'true' AND COALESCE(e.meta->>'test','false') <> 'true'
 GROUP BY c.id
), paid AS (
 SELECT DISTINCT c.id FROM cohort c JOIN events e ON e.meta->>'profile_id'=c.id::text
 WHERE e.event_type='purchase' AND e.created_at >= c.created_at AND e.created_at < $2::timestamptz
 AND (e.meta->>'amount')::numeric > 0
)
SELECT c.agent,c.source,count(*) AS registered_accounts,
 count(*) FILTER (WHERE c.activated_at < $2::timestamptz) AS activated_accounts,
 count(*) FILTER (WHERE EXISTS(SELECT 1 FROM linked l WHERE l.id=c.id)) AS linked_accounts,
 count(*) FILTER (WHERE u.used_product) AS used_product,
 count(*) FILTER (WHERE u.viewed_plans) AS viewed_plans,
 count(*) FILTER (WHERE u.opened_checkout) AS opened_checkout,
 count(*) FILTER (WHERE u.attempted_checkout) AS attempted_checkout,
 count(*) FILTER (WHERE u.provider_ready) AS provider_ready,
 count(*) FILTER (WHERE u.encountered_failure) AS encountered_failure,
 count(p.id) AS paying_accounts
FROM cohort c LEFT JOIN usage u ON u.id=c.id LEFT JOIN paid p ON p.id=c.id
GROUP BY c.agent,c.source ORDER BY registered_accounts DESC,c.agent,c.source;
