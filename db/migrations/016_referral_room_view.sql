-- 016_referral_room_view.sql — #REFERRAL-ROOM-REVOKE
-- Eseguire nel SQL Editor Supabase (come 006/012/013/015).
--
-- PERCHÉ. Il gradino 10 promette la stanza Telegram riservata «finché resti
-- attivo» (revocabile): gradini crescenti, NESSUN premio eterno (Andrea,
-- 2026-08-08). La 015 ha creato solo il flag `profiles.referral_room_access`, e
-- il codice lo scriveva SOLO a TRUE — nessuna riga lo rimetteva mai a FALSE.
-- Risultato: la stanza era di fatto ETERNA, l'opposto della decisione.
--
-- Non si aggiunge un cron che risincronizza una copia: l'appartenenza è già
-- interamente derivabile da dati che esistono, quindi si CALCOLA.
--
--   membro = esiste una riga referral_rewards con tier = 10
--              (permanente: il gradino raggiunto non si perde mai, quindi chi
--               scade e poi ri-paga rientra SENZA rifare i 10 inviti)
--            E il piano è a pagamento e non scaduto
--              (questa è la revoca che oggi manca)
--
-- «Piano attivo» è la STESSA semantica di effectivePlan() in lib/auth.ts:
-- plan IN ('base','premium') e (plan_expires_at IS NULL OR non scaduto) — le
-- righe legacy senza scadenza restano attive. Lo specchio TS è hasRoomAccess()
-- in lib/referral-rewards.ts: se cambia una delle due vanno cambiate ENTRAMBE,
-- e un test in lib/referral-rewards.test.ts legge QUESTO file per accorgersene.
--
-- NB `admin_full` NON è membro: la regola del gradino 10 è esplicitamente
-- plan IN ('base','premium'). Un operatore interno va aggiunto a mano alla
-- stanza (a differenza di planHasAccess(), dove admin_full ha accesso pieno).
--
-- Il JOIN è su identifier ESATTO, non normalizzato: le righe tier = 10 le scrive
-- solo checkReferralTiers(), che passa l'identifier canonico letto da profiles.
-- Normalizzare con LOWER(TRIM(...)) qui duplicherebbe le righe sui profili che
-- differiscono per sole maiuscole (esistono: lib/auth.ts li disambigua con un
-- ORDER BY), trasformando un check di appartenenza in un moltiplicatore.
--
-- RLS / esposizione — VERIFICATO su questo database (PG 17.6), non assunto:
--   · referral_rewards ha RLS ON e ZERO policy (015) ⇒ la leggono solo i ruoli
--     BYPASSRLS. Verificato: service_role.rolbypassrls = true, anon e
--     authenticated = false.
--   · In Postgres una vista che NON dichiara `security_invoker` gira coi
--     permessi del PROPRIETARIO: posseduta da `postgres` (il ruolo del SQL
--     Editor) diventerebbe un canale di lettura che SCAVALCA l'RLS di
--     referral_rewards. Per questo è dichiarata `security_invoker = true` — che
--     è anche la postura di tutte e 10 le viste già presenti in questo database
--     (reloptions = {security_invoker=true}).
--   · I default privileges di questo progetto per gli oggetti creati da
--     `postgres` in public sono {postgres, service_role}: anon/authenticated
--     NON ricevono SELECT. Verificato: has_table_privilege('anon', <vista>,
--     'SELECT') = false su tutte le viste esistenti. La REVOKE qui sotto è
--     cintura + bretelle (stile delle migration 004 e 008), non l'unica difesa.
--   · Il backend legge via la RPC exec_sql (SECURITY DEFINER, owner postgres,
--     EXECUTE solo a postgres/service_role): la vista resta perfettamente
--     leggibile dall'app nonostante security_invoker.

CREATE OR REPLACE VIEW public.referral_room_members
  WITH (security_invoker = true) AS
SELECT p.identifier,
       p.plan,
       p.plan_expires_at,
       r.granted_at AS tier10_granted_at
  FROM public.profiles p
  JOIN public.referral_rewards r
    ON r.identifier = p.identifier
   AND r.tier = 10
 WHERE p.plan IN ('base', 'premium')
   AND (p.plan_expires_at IS NULL OR p.plan_expires_at > NOW());

-- Nessun ruolo pubblico legge la stanza: solo backend/operatore.
REVOKE ALL ON public.referral_room_members FROM anon, authenticated;

COMMENT ON VIEW public.referral_room_members IS
  'Appartenenza LIVE alla stanza del gradino 10 = riga referral_rewards tier 10 + piano a pagamento non scaduto. Fonte di verità per il bot Telegram: non può diventare stantia. Specchio TS: hasRoomAccess() in lib/referral-rewards.ts.';

-- La colonna resta (è in prod; un DROP è distruttivo e va approvato da Andrea)
-- ma non è più la verità e nessuno la scrive più: i suoi TRUE sono storici e
-- possono mentire. Il commento vive nel DB, dove sta il valore fuorviante.
COMMENT ON COLUMN public.profiles.referral_room_access IS
  'VESTIGIALE (016): non scritta e non letta da nessuno. Sapeva solo diventare TRUE, mai FALSE, quindi la stanza risultava eterna. Usare la vista referral_room_members.';
