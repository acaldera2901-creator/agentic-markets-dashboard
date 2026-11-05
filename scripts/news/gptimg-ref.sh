#!/usr/bin/env bash
# gptimg-ref — like ~/.local/bin/gptimg -r, plus reference images: `gptimg-ref -i photo.png -i crest.png "<prompt>" out.png`
# Passes each file to `codex exec --image`. Prompt first, then the flags (--image takes several values and would swallow the prompt).
set -euo pipefail
IMGS=()
while getopts "i:" opt; do case "$opt" in i) IMGS+=(--image "$OPTARG") ;; *) exit 2 ;; esac; done
shift $((OPTIND - 1))
[ $# -ge 2 ] || { echo "uso: gptimg-ref [-i file]... \"<prompt>\" out.png" >&2; exit 2; }
PROMPT="$1"; OUT="$2"
CODEX_BIN="${CODEX_BIN:-$HOME/.codex/plugins/.plugin-appserver/codex}"
[ -x "$CODEX_BIN" ] || CODEX_BIN="$(command -v codex || true)"
[ -n "$CODEX_BIN" ] && [ -x "$CODEX_BIN" ] || { echo "gptimg-ref: codex non trovato" >&2; exit 1; }
IMGDIR="$HOME/.codex/generated_images"; mkdir -p "$IMGDIR"
LOG="$(mktemp -t gptimgref)"; MARK="$(mktemp -t gptimgrefmark)"; trap 'rm -f "$LOG" "$MARK"' EXIT
"$CODEX_BIN" exec --skip-git-repo-check --sandbox workspace-write "Genera un'immagine: ${PROMPT}. Genera SOLO l'immagine." "${IMGS[@]}" >"$LOG" 2>&1 || { tail -20 "$LOG" >&2; exit 1; }
F="$(grep -oE "${IMGDIR}/[A-Za-z0-9-]+/[A-Za-z0-9._-]+\.png" "$LOG" | sort -u | tail -1 || true)"
# codex (0.12x) does not always print the path (measured 05/11): fall back to the newest png created after the start (gptimg-ref runs in SERIES, so it is ours)
[ -n "$F" ] && [ -f "$F" ] || F="$(find "$IMGDIR" -name '*.png' -newer "$MARK" -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1 || true)"
[ -n "$F" ] && [ -f "$F" ] || { echo "gptimg-ref: nessuna immagine generata" >&2; exit 1; }
cp "$F" "$OUT"; echo "$OUT"
