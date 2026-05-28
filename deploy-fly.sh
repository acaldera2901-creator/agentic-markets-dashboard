#!/bin/bash
# deploy-fly.sh — first-time Fly.io setup + deploy
# Run: bash deploy-fly.sh
set -e

APP="agentic-markets-workers"

echo "=== Step 1: Check flyctl ==="
if ! command -v fly &>/dev/null; then
  echo "Installing flyctl..."
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi
fly version

echo ""
echo "=== Step 2: Auth ==="
fly auth whoami 2>/dev/null || fly auth login

echo ""
echo "=== Step 3: Create app (skip if exists) ==="
fly apps list | grep -q "$APP" && echo "App exists, skipping" || fly apps create "$APP" --org personal

echo ""
echo "=== Step 4: Create Upstash Redis ==="
fly ext upstash redis list 2>/dev/null | grep -q "agentic" \
  && echo "Redis exists, skipping" \
  || fly ext upstash redis create --name agentic-redis --org personal

echo ""
echo "=== Step 5: Import secrets ==="
if [ ! -f .env.fly ]; then
  echo "ERROR: .env.fly not found. Copy .env.fly.example, fill in secrets, then re-run."
  exit 1
fi
fly secrets import < .env.fly

echo ""
echo "=== Step 6: Create volume for logs ==="
fly volumes list -a "$APP" 2>/dev/null | grep -q "agents_logs" \
  && echo "Volume exists, skipping" \
  || fly volumes create agents_logs --region fra --size 1 -a "$APP"

echo ""
echo "=== Step 7: Deploy ==="
fly deploy --app "$APP" --remote-only

echo ""
echo "=== Done ==="
echo "Logs:   fly logs -a $APP"
echo "Status: fly status -a $APP"
echo "SSH:    fly ssh console -a $APP"
