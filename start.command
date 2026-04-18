#!/usr/bin/env bash
# Double-click this file to boot RealtorAI.
# Kills anything on the server (8787) and client (8000) ports, then starts both.
set -e
cd "$(dirname "$0")"
echo "==> freeing ports 8787 and 8000"
lsof -ti:8787,8000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
echo "==> installing deps (first run only)"
npm install --no-audit --no-fund --omit=optional --loglevel=error
echo "==> launching server + client"
echo "    server → http://localhost:8787"
echo "    client → http://localhost:8000"
npm run dev
