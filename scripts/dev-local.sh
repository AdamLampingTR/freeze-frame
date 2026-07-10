#!/usr/bin/env bash
# Bring up the full FreezeFrame local loop with one command, then open
# http://localhost:4280. Starts three things and tears them all down on Ctrl-C:
#
#   Azurite            skip-list Table Storage emulator (:10002)
#   func start         Azure Functions host / the /api backend  (:7071)
#   swa start          frontend dev server (:5173) + SWA proxy  (:4280)  ← open this
#
# Open :4280 (the SWA proxy), NOT :5173 — the /api routes only exist behind the
# proxy. See docs/conventions/local-dev.md for what each piece does and why.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." # repo root

# ---- prerequisites -------------------------------------------------------
need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "✗ missing '$1' — install with:  $2"
    exit 1
  }
}
need node "https://nodejs.org (Node 20+)"
need func "npm i -g azure-functions-core-tools@4"
need swa "npm i -g @azure/static-web-apps-cli"
need azurite "npm i -g azurite"

if [ ! -f api/local.settings.json ]; then
  echo "✗ api/local.settings.json is missing (it's gitignored — secrets live here)."
  echo "    cp api/local.settings.json.example api/local.settings.json"
  echo "  then fill in two read-only ADO PATs. See docs/conventions/local-dev.md."
  exit 1
fi

# ---- deps + api build ----------------------------------------------------
[ -d frontend/node_modules ] || { echo "→ installing frontend deps"; (cd frontend && npm install); }
[ -d api/node_modules ] || { echo "→ installing api deps"; (cd api && npm install); }
echo "→ building api"
# Guard explicitly: the script runs without `set -e` (so the readiness poll's
# `&& break` doesn't abort it), so a tsc failure here would otherwise start func
# against a stale/absent dist/ and surface as a confusing runtime error.
(cd api && npm run build) || {
  echo "✗ api build failed — fix the TypeScript errors above, then re-run."
  exit 1
}

# ---- start everything, clean up on exit ----------------------------------
pids=()
cleanup() {
  echo
  echo "→ stopping the local loop"
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
  # func/vite spawn child workers; free the ports so the next run is clean.
  for port in 7071 5173 4280 10000 10001 10002; do
    lsof -ti "tcp:$port" 2>/dev/null | xargs kill 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

AZ_DIR="${TMPDIR:-/tmp}/freezeframe-azurite"
mkdir -p "$AZ_DIR"
echo "→ starting Azurite (skip-list Table emulator)"
azurite --silent --location "$AZ_DIR" & pids+=($!)

echo "→ starting the Functions host on :7071"
(cd api && func start --port 7071) & pids+=($!)

echo "→ starting the frontend dev server on :5173"
(cd frontend && npm run dev -- --port 5173) & pids+=($!)

# Wait for BOTH the frontend (:5173) and the API (:7071, the slower cold start)
# to be listening before the proxy fronts them. `-o /dev/null` (not `-f`) so a
# 502 from the API still counts as "up" — we only care that it responds.
echo "→ waiting for the frontend (:5173) and API (:7071) to come up…"
for _ in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:5173 2>/dev/null &&
    curl -s -o /dev/null http://localhost:7071/api/skips 2>/dev/null; then
    break
  fi
  sleep 1
done

echo
echo "════════════════════════════════════════════════════════════"
echo "  Frontend (:5173) and API (:7071) are up."
echo "  Starting the SWA proxy — it serves everything at:"
echo "      →  http://localhost:4280   (open this, NOT :5173)"
echo "  Give it a few seconds to bind, then load the page."
echo "  Press Ctrl-C to stop everything."
echo "════════════════════════════════════════════════════════════"
echo

# Foreground: the SWA proxy (binds :4280). When it exits (Ctrl-C), the trap
# cleans up Azurite, func, and the dev server.
swa start http://localhost:5173 --api-devserver-url http://localhost:7071
