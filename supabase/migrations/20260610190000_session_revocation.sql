-- #AUDIT MEDIUM-11: sessioni non revocabili. Il cookie firmato (identifier+iat)
-- restava valido 30 giorni anche dopo il logout (se rubato/copiato). Aggiungiamo
-- una soglia per-profilo: ogni cookie con iat PRECEDENTE a sessions_valid_from è
-- rifiutato. NULL = nessuna revoca (i cookie esistenti restano validi → nessun
-- utente buttato fuori). Il logout (e in futuro il cambio password) la bumpano.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sessions_valid_from timestamptz;

-- Rollback: ALTER TABLE public.profiles DROP COLUMN IF EXISTS sessions_valid_from;
