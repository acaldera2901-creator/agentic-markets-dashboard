#!/usr/bin/env bash
# passo3-env-terms.sh — passo 3: AFFILIATE_TERMS_VERSION=aff-2026-10-22-v3 su Vercel Production.
#   passo3-env-terms.sh            # dry-run: legge il valore attuale
#   passo3-env-terms.sh --esegui   # imposta il valore (NON redeploya: lo prende il deploy del merge, passo 4)
# Impostata come NON sensitive: è un numero di versione pubblico e così resta verificabile.
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,5p' "$0"; }
du_parse_args "$@"
[ "${#EXTRA_ARGS[@]}" -eq 0 ] || die "argomento sconosciuto: ${EXTRA_ARGS[*]}"
du_init passo3-env-terms "Passo 3 — AFFILIATE_TERMS_VERSION=$TERMS_V3 (Production)" "rimettere il valore precedente stampato qui sotto (vercel env update AFFILIATE_TERMS_VERSION production). Il rollback vero dei termini è il revert del codice: con #549 il codice registra la costante della pagina."
du_require_cmd vercel
[ -f "$VERCEL_CWD/.vercel/project.json" ] || die "$VERCEL_CWD non è linkato a Vercel (.vercel/project.json): imposta VERCEL_CWD"
du_vercel whoami >/dev/null 2>&1 || die "vercel CLI non loggata (vercel login)"
echo "progetto Vercel: $(tr -d '\n' < "$VERCEL_CWD/.vercel/project.json")"

PREV="$(du_vercel_env_value AFFILIATE_TERMS_VERSION)"
if du_vercel_env_names | grep -qx AFFILIATE_TERMS_VERSION; then EXISTS=1; else EXISTS=0; fi
echo "valore attuale: ${PREV:-<vuota o sensitive>} (variabile esistente: $EXISTS)"
if [ "$PREV" = "$TERMS_V3" ]; then ok "già $TERMS_V3: niente da fare"; du_mark passo3; exit 0; fi
if [ "$EXISTS" = 1 ]; then echo "Comando: vercel env update AFFILIATE_TERMS_VERSION production --yes  (valore via stdin)"
else echo "Comando: vercel env add AFFILIATE_TERMS_VERSION production --yes --no-sensitive  (valore via stdin)"; fi
if [ "$ESEGUI" != 1 ]; then c_grn "DRY-RUN: nessuna modifica."; exit 0; fi
du_confirm "TERMINI V3"
echo "valore precedente (per il rollback): ${PREV:-<vuota o sensitive>}"
if [ "$EXISTS" = 1 ]; then du_vercel_env_set AFFILIATE_TERMS_VERSION "$TERMS_V3"
else du_vercel_env_set AFFILIATE_TERMS_VERSION "$TERMS_V3" --no-sensitive; fi

echo; echo "== Verifica post-passo =="
NOW="$(du_vercel_env_value AFFILIATE_TERMS_VERSION)"
if [ "$NOW" = "$TERMS_V3" ]; then ok "AFFILIATE_TERMS_VERSION=$NOW"
else die "valore letto «$NOW» ≠ $TERMS_V3"; fi
du_mark passo3 "$PREV"
c_grn "Passo 3 OK. Effetto al prossimo deploy (il merge del passo 4): niente redeploy adesso."
