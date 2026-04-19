#!/usr/bin/env bash
set -euo pipefail

# Verify the nx release pipeline end-to-end against a local Verdaccio registry.
# Does NOT modify git state or publish to the real npm registry.

ORIGINAL_NPM_CONFIG_REGISTRY="${npm_config_registry:-}"
LOCAL_REGISTRY="http://localhost:4873/"

cleanup() {
  echo "--- cleaning up ---"
  if [ -n "${VERDACCIO_PID:-}" ]; then
    kill "$VERDACCIO_PID" 2>/dev/null || true
  fi
  npm config delete registry --location=project 2>/dev/null || true
  rm -rf tmp/local-registry/storage
  echo "done."
}
trap cleanup EXIT

mkdir -p tmp/local-registry
echo "--- starting verdaccio on $LOCAL_REGISTRY ---"
npx nx local-registry &
VERDACCIO_PID=$!

# Wait for Verdaccio to be ready
for i in {1..30}; do
  if curl -fsS "$LOCAL_REGISTRY" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "$LOCAL_REGISTRY" >/dev/null 2>&1; then
  echo "verdaccio failed to start" >&2
  exit 1
fi

echo "--- building libs ---"
npx nx run-many -t build -p agent,render,chat

echo "--- dry-run version ---"
npx nx release version --dry-run

echo "--- dry-run publish against local registry ---"
npx nx release publish \
  --registry="$LOCAL_REGISTRY" \
  --tag=local-smoke \
  --dry-run

echo ""
echo "✅ release pipeline verified against local registry"
