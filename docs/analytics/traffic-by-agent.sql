-- $1 inclusive, $2 exclusive timestamps. Traffic window, NOT the signup cohort.
-- Anonymous events are aggregates; sessions are NOT unique people or proven humans.
WITH clean AS (
 SELECT * FROM events WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
 AND event_type IN ('session_start','page_view','entry_attributed')
 AND COALESCE(meta->>'internal','false') <> 'true' AND COALESCE(meta->>'test','false') <> 'true'
), arrivals AS (
 SELECT DISTINCT ON (session_id) session_id,
 COALESCE(NULLIF(meta->>'agent',''),'unknown') AS agent,
 COALESCE(NULLIF(meta->>'utm_source',''),NULLIF(meta->>'src',''),'unknown') AS source
 FROM clean WHERE session_id IS NOT NULL
 ORDER BY session_id,CASE event_type WHEN 'session_start' THEN 0 WHEN 'entry_attributed' THEN 1 ELSE 2 END,created_at
)
SELECT agent,source,count(*) AS consenting_sessions FROM arrivals GROUP BY agent,source ORDER BY consenting_sessions DESC;
-- Separately monitor the share of page_view rows with session_id IS NULL.
-- Do not divide new-account conversions by this denominator: cohorts differ.
