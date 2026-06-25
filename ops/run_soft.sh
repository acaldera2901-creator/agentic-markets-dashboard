#!/bin/bash
# #SOFT-MARKETS — predictor + settler mercati soft (corner/cartellini/falli).
# Lanciato da launchd io.maven.softmarkets.predict ogni 2h.
cd "$HOME/Desktop/agentic-markets" || exit 1
PY="$HOME/Desktop/agentic-markets/venv/bin/python"
"$PY" -m scripts.predict_soft_markets
"$PY" -m scripts.settle_soft_markets
