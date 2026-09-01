#!/usr/bin/env bash
# Starts the Node service and runs a watchdog that polls /ok every 30s after
# a 60s startup grace. Three consecutive failures kill the server so
# Railway's restart-policy can recover. Same pattern as ag-ui-dev.
set -euo pipefail

PORT="${PORT:-8321}"
node server.mjs &
NODE_PID=$!

sleep 60  # startup grace
STRIKES=0
while kill -0 "${NODE_PID}" 2>/dev/null; do
  sleep 30
  if curl -fsS "http://127.0.0.1:${PORT}/ok" >/dev/null; then
    STRIKES=0
  else
    STRIKES=$((STRIKES + 1))
    echo "watchdog: strike ${STRIKES}/3" >&2
    if [ "${STRIKES}" -ge 3 ]; then
      echo "watchdog: 3 strikes, killing node (pid ${NODE_PID})" >&2
      kill "${NODE_PID}" || true
      exit 1
    fi
  fi
done
wait "${NODE_PID}"
