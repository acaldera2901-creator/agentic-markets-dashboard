-- Product tracking contract. Reviewed/apply separately; no live execution in this change.
-- Shared base tables exactly match BO foundation (202610160001), created idempotently.
-- Product owns writer functions and br_* tables; BO only reads them.
BEGIN;
CREATE TABLE IF NOT EXISTS public.session_links (
 session_id text PRIMARY KEY CHECK (length(session_id) BETWEEN 16 AND 128),
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 linked_at timestamptz NOT NULL DEFAULT now(),
 via text NOT NULL CHECK (via IN ('login','signup'))
);
CREATE TABLE IF NOT EXISTS public.email_events (
 event_id text PRIMARY KEY,message_id text NOT NULL,event_type text NOT NULL,
 occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS public.bo_tracking_counters (
 day date NOT NULL,reason text NOT NULL CHECK (reason IN ('bot','internal','test','throttled','insert_failed')),
 count bigint NOT NULL DEFAULT 0 CHECK(count>=0),PRIMARY KEY(day,reason)
);
CREATE TABLE IF NOT EXISTS public.br_analytics_sessions (
 session_id text PRIMARY KEY CHECK (session_id ~ '^[a-f0-9-]{36}$'),
 created_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,anchored_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.br_business_event_keys (
 event_key text PRIMARY KEY,occurred_at timestamptz NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.br_email_messages (
 message_id text PRIMARY KEY,profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 sent_at timestamptz NOT NULL DEFAULT now(),engagement_allowed boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS session_links_retention_idx ON public.session_links(linked_at);
CREATE INDEX IF NOT EXISTS email_events_time_idx ON public.email_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_events_message_idx ON public.email_events(message_id);
CREATE INDEX IF NOT EXISTS br_analytics_sessions_time_idx ON public.br_analytics_sessions(created_at);
CREATE INDEX IF NOT EXISTS br_business_keys_time_idx ON public.br_business_event_keys(occurred_at);
CREATE INDEX IF NOT EXISTS br_email_messages_time_idx ON public.br_email_messages(sent_at);
ALTER TABLE public.session_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bo_tracking_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.br_analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.br_business_event_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.br_email_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_links,public.email_events,public.bo_tracking_counters,public.br_analytics_sessions,public.br_business_event_keys,public.br_email_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.session_links,public.email_events,public.bo_tracking_counters,public.br_analytics_sessions,public.br_business_event_keys,public.br_email_messages TO service_role;

-- Caller already verified the password/session server-side; only service_role can execute.
-- Lock order is shared with revocation so a concurrent login cannot recreate a revoked link.
CREATE OR REPLACE FUNCTION public.br_link_analytics_session(p_sid text,p_identifier text,p_via text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target uuid;prior uuid;
BEGIN
 IF p_via NOT IN ('login','signup') THEN RAISE EXCEPTION 'invalid link source'; END IF;
 PERFORM 1 FROM public.br_analytics_sessions WHERE session_id=p_sid AND revoked_at IS NULL AND created_at>now()-interval '1 day' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT id INTO target FROM public.profiles WHERE identifier=p_identifier AND plan<>'admin_full' ORDER BY created_at LIMIT 1;
 IF target IS NULL THEN RETURN false; END IF;
 SELECT profile_id INTO prior FROM public.session_links WHERE session_id=p_sid;
 IF prior IS NOT NULL THEN RETURN prior=target; END IF;
 INSERT INTO public.session_links(session_id,profile_id,via) VALUES(p_sid,target,p_via) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.br_revoke_analytics_session(p_sid text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.br_analytics_sessions SET revoked_at=now() WHERE session_id=p_sid;
 DELETE FROM public.session_links WHERE session_id=p_sid;
 -- Withdrawal stops linkage and removes its SID from prior browser events in the same transaction.
 UPDATE public.events SET session_id=NULL WHERE session_id=p_sid;
END $$;
CREATE OR REPLACE FUNCTION public.br_record_session_start(p_sid text,p_meta jsonb,p_country text,p_language text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.br_analytics_sessions SET anchored_at=now() WHERE session_id=p_sid AND anchored_at IS NULL AND revoked_at IS NULL AND created_at>now()-interval '1 day';
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.events(event_type,session_id,country,language,value,meta)
 VALUES('session_start',p_sid,left(p_country,8),left(p_language,16),0,p_meta);
END $$;
-- Same row lock as revoke: either insert finishes first and revoke anonymizes it,
-- or revoke finishes first and the insertion is rejected. No check/insert gap.
CREATE OR REPLACE FUNCTION public.br_insert_browser_event(p_type text,p_sid text,p_country text,p_language text,p_plan text,p_partner text,p_meta jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_sid IS NOT NULL THEN
  PERFORM 1 FROM public.br_analytics_sessions WHERE session_id=p_sid AND revoked_at IS NULL AND created_at>now()-interval '1 day' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
 END IF;
 INSERT INTO public.events(event_type,session_id,country,language,plan,partner_id,value,meta)
 VALUES(p_type,p_sid,left(p_country,8),left(p_language,16),left(p_plan,32),left(p_partner,64),0,p_meta);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.br_emit_business_event(p_type text,p_identifier text,p_source text,p_order text,p_plan text,p_amount numeric,p_currency text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE profile uuid;occurred timestamptz;dedup text;claimed text;
BEGIN
 IF p_type NOT IN ('signup_created','account_activated','purchase') OR length(p_identifier)>320 THEN RAISE EXCEPTION 'invalid event'; END IF;
 SELECT id,CASE WHEN p_type='signup_created' THEN created_at WHEN p_type='account_activated' THEN activated_at ELSE now() END INTO profile,occurred FROM public.profiles WHERE identifier=p_identifier AND plan<>'admin_full' ORDER BY created_at LIMIT 1;
 IF profile IS NULL OR occurred IS NULL OR occurred<now()-interval '14 months' THEN RETURN false; END IF;
 IF p_type='purchase' THEN
  IF p_source NOT IN ('paygate','paypal','crypto','stripe','shopify','weekly_pick','weekly_pick_crypto','weekly_pick_paygate') OR p_order IS NULL OR length(p_order)>160 OR p_amount<0 THEN RAISE EXCEPTION 'invalid purchase'; END IF;
  -- Direct/hosted PayGate use the same order ledger, so the key cannot duplicate a rail variant.
  dedup:='purchase:'||CASE WHEN p_source='crypto' THEN 'paygate' WHEN p_source LIKE 'weekly_pick%' THEN 'weekly_pick' ELSE p_source END||':'||p_order;
 ELSE
  dedup:=p_type||':'||profile::text;
 END IF;
 INSERT INTO public.br_business_event_keys(event_key,occurred_at) VALUES(dedup,occurred) ON CONFLICT DO NOTHING RETURNING event_key INTO claimed;
 IF claimed IS NULL THEN RETURN false; END IF;
 INSERT INTO public.events(event_type,session_id,plan,value,meta,created_at)
 VALUES(p_type,NULL,left(p_plan,32),0,jsonb_strip_nulls(jsonb_build_object('profile_id',profile,'order_id',p_order,'source',p_source,'amount',p_amount,'currency',p_currency)),occurred);
 RETURN true;
END $$;
-- Mapping and retroactive event correlation are atomic: outcomes can arrive before the send response.
CREATE OR REPLACE FUNCTION public.br_correlate_email_message(p_message text,p_identifier text,p_engagement boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE profile uuid;
BEGIN
 SELECT id INTO profile FROM public.profiles WHERE identifier=p_identifier ORDER BY created_at LIMIT 1;
 INSERT INTO public.br_email_messages(message_id,profile_id,engagement_allowed) VALUES(p_message,profile,p_engagement) ON CONFLICT DO NOTHING;
 UPDATE public.email_events SET profile_id=profile WHERE message_id=p_message AND profile_id IS NULL AND event_type NOT IN ('email.opened','email.clicked');
END $$;
CREATE OR REPLACE FUNCTION public.br_record_email_unsubscribe(p_event text,p_contact text,p_identifier text,p_occurred timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE profile uuid;
BEGIN
 SELECT id INTO profile FROM public.profiles WHERE identifier=p_identifier ORDER BY created_at LIMIT 1;
 INSERT INTO public.email_events(event_id,message_id,event_type,occurred_at,profile_id)
 VALUES(p_event,'contact:'||p_contact,'contact.unsubscribed',p_occurred,profile) ON CONFLICT DO NOTHING;
 -- Never re-subscribe from provider updates; unsubscribe is monotonic.
 UPDATE public.profiles SET marketing_opt_out=true WHERE id=profile;
 UPDATE public.br_email_messages SET engagement_allowed=false WHERE profile_id=profile;
END $$;
CREATE OR REPLACE FUNCTION public.br_run_tracking_retention(p_email_days integer,p_counter_days integer,p_browser_events jsonb,p_dry boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE summary jsonb;
BEGIN
 IF p_email_days NOT BETWEEN 7 AND 730 OR p_counter_days NOT BETWEEN 7 AND 730 OR jsonb_typeof(p_browser_events)<>'array' THEN RAISE EXCEPTION 'invalid retention'; END IF;
 summary:=jsonb_build_object(
  'session_links',(SELECT count(*) FROM public.session_links WHERE linked_at<now()-interval '14 months'),
  'sessions',(SELECT count(*) FROM public.br_analytics_sessions WHERE created_at<now()-interval '14 months'),
  'email_events',(SELECT count(*) FROM public.email_events WHERE occurred_at<now()-make_interval(days=>p_email_days)),
  'email_messages',(SELECT count(*) FROM public.br_email_messages WHERE sent_at<now()-make_interval(days=>p_email_days)),
  'counters',(SELECT count(*) FROM public.bo_tracking_counters WHERE day<current_date-p_counter_days),'dry_run',p_dry);
 IF p_dry THEN RETURN summary; END IF;
 UPDATE public.events SET session_id=NULL WHERE created_at<now()-interval '14 months' AND event_type IN (SELECT jsonb_array_elements_text(p_browser_events));
 DELETE FROM public.session_links WHERE linked_at<now()-interval '14 months';
 DELETE FROM public.br_analytics_sessions WHERE created_at<now()-interval '14 months';
 UPDATE public.events SET meta=meta-'profile_id'-'order_id' WHERE created_at<now()-interval '14 months' AND event_type IN ('signup_created','account_activated','purchase');
 DELETE FROM public.br_business_event_keys WHERE occurred_at<now()-interval '14 months';
 DELETE FROM public.email_events WHERE occurred_at<now()-make_interval(days=>p_email_days);
 DELETE FROM public.br_email_messages WHERE sent_at<now()-make_interval(days=>p_email_days);
 DELETE FROM public.bo_tracking_counters WHERE day<current_date-p_counter_days;
 RETURN summary;
END $$;
REVOKE ALL ON FUNCTION public.br_link_analytics_session(text,text,text),public.br_revoke_analytics_session(text),public.br_record_session_start(text,jsonb,text,text),public.br_insert_browser_event(text,text,text,text,text,text,jsonb),public.br_emit_business_event(text,text,text,text,text,numeric,text),public.br_correlate_email_message(text,text,boolean),public.br_record_email_unsubscribe(text,text,text,timestamptz),public.br_run_tracking_retention(integer,integer,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.br_link_analytics_session(text,text,text),public.br_revoke_analytics_session(text),public.br_record_session_start(text,jsonb,text,text),public.br_insert_browser_event(text,text,text,text,text,text,jsonb),public.br_emit_business_event(text,text,text,text,text,numeric,text),public.br_correlate_email_message(text,text,boolean),public.br_record_email_unsubscribe(text,text,text,timestamptz),public.br_run_tracking_retention(integer,integer,jsonb,boolean) TO service_role;
COMMIT;
