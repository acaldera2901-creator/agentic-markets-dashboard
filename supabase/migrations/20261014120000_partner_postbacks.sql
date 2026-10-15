-- #POSTBACK-1014 — click in uscita e conversioni in ingresso dei partner affiliati.
-- Tabelle NUOVE e separate: affiliate_links / affiliate_clicks / affiliate_click_stats
-- appartengono al backoffice e NON vanno toccate né riusate.
-- Idempotente (IF NOT EXISTS) per check_migrations_replayable.py.
-- Rollback: DROP TABLE IF EXISTS public.partner_conversions, public.partner_clicks;

CREATE TABLE IF NOT EXISTS public.partner_clicks (
  clickid      text PRIMARY KEY,              -- 32 hex, generato da /go/[partner]
  partner      text NOT NULL,                 -- id di lib/partners (stonevegas, ggbet, rollxo, casea, …)
  network      text NOT NULL,                 -- id di lib/affiliate-networks (playfina, ggbet, n1, …)
  clickid_sent boolean NOT NULL,              -- false = rete col parametro ignoto: link lasciato intatto
  country      text,                          -- x-vercel-ip-country; nessun IP, UA o session_id
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_clicks_created_at_idx ON public.partner_clicks (created_at);

CREATE TABLE IF NOT EXISTS public.partner_conversions (
  id           bigserial PRIMARY KEY,
  network      text NOT NULL,                 -- dal path /api/postback/[network]
  clickid      text,                          -- NULL se il payload non lo porta (si salva comunque)
  partner      text,                          -- copiato da partner_clicks all'insert; NULL se clickid non nostro
  event        text,                          -- registration|deposit|ftd|cpa_qualified, altrimenti il valore grezzo
  amount       numeric(14,2),
  currency     text,
  payout       numeric(14,2),
  txn_id       text,
  dedup_key    text NOT NULL UNIQUE,          -- 'txn:<network>:<txn>' oppure 'raw:<network>:<sha256 query ordinata senza key>'
  raw          jsonb NOT NULL,                -- tutta la query string tranne `key`
  received_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_conversions_clickid_idx ON public.partner_conversions (clickid);
CREATE INDEX IF NOT EXISTS partner_conversions_received_at_idx ON public.partner_conversions (received_at);

-- Come #RLS-0310: ENABLE senza policy, scrittura via exec_sql (SECURITY DEFINER). Niente FORCE.
ALTER TABLE public.partner_clicks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_conversions ENABLE ROW LEVEL SECURITY;
