-- #AUDIT HIGH-3 (account takeover): profili legacy senza password potevano
-- essere "reclamati" da chiunque (il primo login impostava la password e
-- apriva una sessione). Introduciamo l'attivazione via email: register imposta
-- la password ma il profilo resta NON attivo finché l'utente non clicca il link
-- di attivazione ricevuto per email; il login richiede activated_at NOT NULL.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activated_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activation_token_hash text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activation_token_expires timestamptz;

-- Backfill CRITICO: gli account che HANNO già una password l'hanno impostata
-- sotto il vecchio flusso e sono utenti reali (17/18, inclusi i paganti) — vanno
-- marcati come attivati, altrimenti il nuovo login li bloccherebbe fuori.
-- L'unico profilo senza password (legacy, mai reclamato) resta NON attivo e
-- dovrà registrarsi + attivare via email.
UPDATE public.profiles
   SET activated_at = COALESCE(updated_at, created_at, NOW())
 WHERE password_hash IS NOT NULL AND activated_at IS NULL;

-- Rollback:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS activated_at;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS activation_token_hash;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS activation_token_expires;
