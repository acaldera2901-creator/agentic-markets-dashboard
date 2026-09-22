-- referral_room_members — file RICOSTRUITO il 2026-09-21 (#MIGRATION-RICONCILIAZIONE-0921)
--
-- Applicata a mano in produzione il 2026-08-08 (version 20260808182723) senza
-- file nel repo. Come la precedente, questo file descrive l'esistente.
--
-- ⚠️ ATTENZIONE AL NOME: la migration è registrata come `referral_room_view`,
-- ma l'oggetto che ha creato si chiama `referral_room_members`. Il nome del
-- file resta quello della version registrata (serve per il match del registro),
-- il nome dell'oggetto è quello vero letto da `pg_class`. Cercare in produzione
-- una vista chiamata `referral_room_view` non trova nulla: non esiste.
--
-- Definizione presa da `pg_get_viewdef` il 2026-09-21, non a memoria.

CREATE OR REPLACE VIEW public.referral_room_members AS
  SELECT p.identifier,
         p.plan,
         p.plan_expires_at,
         r.granted_at AS tier10_granted_at
    FROM public.profiles p
    JOIN public.referral_rewards r
      ON r.identifier = p.identifier
     AND r.tier = 10
   WHERE p.plan = ANY (ARRAY['base'::text, 'premium'::text])
     AND (p.plan_expires_at IS NULL OR p.plan_expires_at > now());

-- Chi ha raggiunto la soglia 10 ED è ancora su un piano attivo. Il filtro sulla
-- scadenza è nella vista, non nel chiamante: un membro decaduto sparisce da solo
-- senza che nessuno debba ricordarsi di ripulirlo.
-- GRANT in produzione: solo `postgres` e `service_role` (nessun accesso anon).
