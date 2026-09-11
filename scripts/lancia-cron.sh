#!/usr/bin/env bash
# #CRON-MANUALE-0911 — lancia a mano i cron di produzione, senza toccare la
# pianificazione automatica di Vercel (che resta quella di `vercel.json`).
#
# PERCHE' ESISTE. Gli endpoint cron sono normali GET protetti da bearer: dopo un
# deploy si vuole vedere l'effetto subito invece di aspettare il prossimo scatto.
# Lanciarli a mano non disattiva né anticipa nulla: il cron automatico parte
# comunque alla sua ora, e tutti questi percorsi sono idempotenti (upsert,
# ON CONFLICT DO NOTHING, riconciliazioni).
#
# PERCHE' NON LI LANCIA TUTTI. Due di questi endpoint parlano al mondo esterno:
#   * /api/cron/crm?send=1  -> INVIA EMAIL VERE ai clienti (sendTransactional)
#   * /api/cron/indexnow    -> notifica Google/Bing
# Un giro "completo" che parte per errore manda una campagna a tutta la lista, e
# quella non si richiama indietro. Stanno dietro a --anche-esterni, e il flag va
# scritto per intero: e' scomodo apposta.
#
# IL SEGRETO NON PASSA MAI DA UN ARGOMENTO. Si legge da stdin senza eco, oppure
# dall'ambiente (CRON_SECRET). Un segreto sulla riga di comando finisce nella
# cronologia della shell e in `ps`.
#
# Uso:
#   ./scripts/lancia-cron.sh                  # i cron di contenuto e stato
#   ./scripts/lancia-cron.sh --anche-esterni  # + email CRM e IndexNow
#   ./scripts/lancia-cron.sh --solo predictions
#   CRON_SECRET=... ./scripts/lancia-cron.sh  # non interattivo (CI, alias)
set -uo pipefail

BASE="${BETREDGE_BASE:-https://www.betredge.com}"
ANCHE_ESTERNI=0
SOLO=""

while [ $# -gt 0 ]; do
  case "$1" in
    --anche-esterni) ANCHE_ESTERNI=1 ;;
    --solo) SOLO="${2:-}"; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "argomento sconosciuto: $1" >&2; exit 2 ;;
  esac
  shift
done

# ── il segreto ───────────────────────────────────────────────────────────────
# Non tutte le shell hanno un terminale: quella integrata di un editor, una
# pipeline, un hook. Il primo tentativo assumeva /dev/tty e moriva con
# «Device not configured», che non dice a nessuno cosa fare.
#
# E NON basta `[ -r /dev/tty ]`: su macOS quel nodo esiste sempre e i permessi
# passano anche quando aprirlo fallisce. L'unico test che dice la verita' e'
# PROVARE ad aprirlo — misurato, perche' la versione coi soli permessi e'
# morta lo stesso.
tty_utilizzabile() { { exec 3<>/dev/tty; } 2>/dev/null && { exec 3<&-; exec 3>&-; return 0; }; return 1; }

# Terza via, e in pratica la migliore: un file di ambiente gia' sul disco.
# `vercel env pull .env.vercel` lo scrive una volta sola, e da li' in poi il
# segreto non viene piu' ne' digitato ne' incollato — quindi non finisce in
# nessuna cronologia, in nessun `ps`, in nessuna trascrizione di sessione.
# Si legge SOLO la riga CRON_SECRET: non si carica l'intero file con `source`,
# perche' quello eseguirebbe qualunque cosa ci sia dentro.
if [ -z "${CRON_SECRET:-}" ]; then
  for f in "${CRON_ENV_FILE:-}" .env.vercel .env.local .env.production.local; do
    [ -n "$f" ] && [ -r "$f" ] || continue
    riga=$(grep -m1 '^CRON_SECRET=' "$f" 2>/dev/null) || continue
    valore=${riga#CRON_SECRET=}
    valore=${valore%\"}; valore=${valore#\"}
    valore=${valore%\'}; valore=${valore#\'}
    if [ -n "$valore" ]; then
      CRON_SECRET="$valore"
      echo "segreto letto da $f" >&2
      break
    fi
  done
fi

if [ -z "${CRON_SECRET:-}" ]; then
  if tty_utilizzabile; then
    printf 'CRON_SECRET (non verra mostrato): ' >&2
    IFS= read -rs CRON_SECRET </dev/tty
    printf '\n' >&2
  else
    # nessun terminale utilizzabile: l'unica via sicura e' l'ambiente
    cat >&2 <<'AIUTO'
Nessun terminale per chiedere il segreto senza mostrarlo.
Passalo dall'ambiente, che e' comunque il modo migliore:

    CRON_SECRET='...' ./scripts/lancia-cron.sh

Per non lasciarlo nella cronologia della shell, fallo precedere da uno spazio
(con HISTCONTROL=ignorespace attivo) oppure leggilo in una variabile prima:

    read -rs CRON_SECRET && export CRON_SECRET
    ./scripts/lancia-cron.sh
    unset CRON_SECRET
AIUTO
    exit 2
  fi
fi
if [ -z "${CRON_SECRET:-}" ]; then
  echo "nessun segreto: mi fermo." >&2
  exit 2
fi
# Guardia contro l'incolla andato a vuoto — e' gia' successo: un segreto
# troncato produce solo una fila di 401 che sembrano un guasto del server.
if [ "${#CRON_SECRET}" -lt 16 ]; then
  echo "il segreto e lungo ${#CRON_SECRET} caratteri: sembra troncato. Mi fermo." >&2
  exit 2
fi

# ── gli endpoint ─────────────────────────────────────────────────────────────
# nome|percorso|gruppo   (gruppo: contenuto | stato | esterno)
ENDPOINT=(
  "predictions|/api/predictions/refresh|contenuto"
  "weekly-pick|/api/weekly-pick/generate|contenuto"
  "settle|/api/cron/settle|contenuto"
  "soro-rss|/api/cron/soro-rss|contenuto"
  "subscriptions|/api/cron/subscriptions|stato"
  "segments-sync|/api/cron/segments-sync|stato"
  "paygate|/api/cron/paygate-reconcile|stato"
  "shopify|/api/cron/shopify-reconcile|stato"
  "crm-INVIA-EMAIL|/api/cron/crm?send=1|esterno"
  "indexnow|/api/cron/indexnow|esterno"
)

if [ "$ANCHE_ESTERNI" = "1" ] && [ -z "$SOLO" ]; then
  echo "⚠️  --anche-esterni include l'INVIO EMAIL ai clienti e la notifica ai"
  echo "    motori di ricerca."
  if tty_utilizzabile; then
    echo "    Scrivi INVIA per confermare (altro = annulla):"
    IFS= read -r conferma </dev/tty
  else
    # Senza terminale la conferma non si puo' chiedere a voce. Un invio di massa
    # non deve mai partire per assenza di domanda: si esige una dichiarazione
    # esplicita nell'ambiente, altrimenti si annulla.
    conferma="${CONFERMO_INVIO_ESTERNI:-}"
    if [ "$conferma" != "INVIA" ]; then
      echo "    Nessun terminale per confermare. Se e' davvero cio' che vuoi:" >&2
      echo "    CONFERMO_INVIO_ESTERNI=INVIA ./scripts/lancia-cron.sh --anche-esterni" >&2
      exit 1
    fi
  fi
  [ "$conferma" = "INVIA" ] || { echo "annullato."; exit 1; }
fi

echo "base: $BASE"
printf '%-18s %-34s %-6s %s\n' NOME PERCORSO HTTP ESITO
printf '%.0s─' {1..78}; echo

falliti=0
for riga in "${ENDPOINT[@]}"; do
  IFS='|' read -r nome percorso gruppo <<< "$riga"
  [ -n "$SOLO" ] && [ "$nome" != "$SOLO" ] && continue
  if [ -z "$SOLO" ] && [ "$gruppo" = "esterno" ] && [ "$ANCHE_ESTERNI" != "1" ]; then
    printf '%-18s %-34s %-6s %s\n' "$nome" "$percorso" "--" "saltato (esterno)"
    continue
  fi

  inizio=$(date +%s)
  # --max-time generoso: /api/predictions/refresh ha maxDuration 300.
  corpo=$(curl -sS --max-time 310 -w '\n%{http_code}' \
            -H "Authorization: Bearer ${CRON_SECRET}" "${BASE}${percorso}" 2>&1)
  http=$(printf '%s' "$corpo" | tail -n1)
  testo=$(printf '%s' "$corpo" | sed '$d')
  durata=$(( $(date +%s) - inizio ))

  case "$http" in
    200) esito="ok (${durata}s)" ;;
    401) esito="NON AUTORIZZATO — segreto errato?"; falliti=$((falliti+1)) ;;
    "")  esito="nessuna risposta (timeout?)"; falliti=$((falliti+1)) ;;
    *)   esito="HTTP $http"; falliti=$((falliti+1)) ;;
  esac
  printf '%-18s %-34s %-6s %s\n' "$nome" "$percorso" "$http" "$esito"

  # del corpo si mostra solo l'essenziale: questi endpoint rispondono JSON e
  # stamparlo intero renderebbe illeggibile il giro.
  if [ "$http" = "200" ] && [ -n "$testo" ]; then
    printf '%s' "$testo" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
def righe(x, pre=""):
    if isinstance(x, dict):
        for k, v in x.items():
            if isinstance(v, (dict, list)):
                yield from righe(v, f"{pre}{k}.")
            elif v not in (None, 0, False, "", []):
                yield f"{pre}{k}={v}"
out = list(righe(d))[:8]
if out:
    print("      " + "  ".join(out))
' 2>/dev/null
  fi
done

printf '%.0s─' {1..78}; echo
if [ "$falliti" -gt 0 ]; then
  echo "$falliti endpoint non hanno risposto 200."
  exit 1
fi
echo "tutti ok. Il cron automatico di Vercel resta invariato."
