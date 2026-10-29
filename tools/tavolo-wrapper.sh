#!/usr/bin/env bash
# `tavolo` nel PATH: si installa in ~/.local/bin/tavolo (docs/tavolo.md).
# Esegue tools/tavolo del repo agentic-markets, cercato in quest'ordine:
#   1. $TAVOLO_REPO, se impostato (se e' sbagliato e' un errore, non si ripiega)
#   2. la vetrina ~/Desktop/agentic-markets, se ha gia' tools/tavolo
#   3. un worktree della vetrina sul branch feat/tavolo-claude-codex (prima del merge)
set -u
VETRINA="$HOME/Desktop/agentic-markets"
BRANCH="feat/tavolo-claude-codex"

if [ -n "${TAVOLO_REPO:-}" ]; then
  if [ ! -f "$TAVOLO_REPO/tools/tavolo" ]; then
    echo "tavolo: TAVOLO_REPO=$TAVOLO_REPO non contiene tools/tavolo" >&2
    exit 2
  fi
  repo="$TAVOLO_REPO"
elif [ -f "$VETRINA/tools/tavolo" ]; then
  repo="$VETRINA"
else
  repo=""
  if [ -d "$VETRINA" ]; then
    wt=""
    while IFS= read -r riga; do
      case "$riga" in
        "worktree "*) wt="${riga#worktree }" ;;
        "branch refs/heads/$BRANCH") [ -f "$wt/tools/tavolo" ] && repo="$wt" && break ;;
      esac
    done < <(git -C "$VETRINA" worktree list --porcelain 2>/dev/null)
  fi
  if [ -z "$repo" ]; then
    echo "tavolo: repo non trovato. Cercato: \$TAVOLO_REPO (non impostato), $VETRINA/tools/tavolo," >&2
    echo "        un worktree sul branch $BRANCH. Imposta TAVOLO_REPO=<repo agentic-markets>." >&2
    exit 2
  fi
fi
exec python3 "$repo/tools/tavolo" "$@"
