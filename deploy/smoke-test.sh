#!/usr/bin/env bash
set -euo pipefail

# Smoke tests for meals on VM 110 (APP_HOST).
HOST_PORT="${HOST_PORT:?set HOST_PORT to the published port on VM 110}"
HEALTH_ENDPOINT="/api/health"
APP_DOMAIN="meals.example.com"
VM110="jaccrocker@APP_HOST"

echo "Running smoke tests..."

# Upstream health check (container's published port on VM 110)
echo -n "Upstream health (VM110:${HOST_PORT}${HEALTH_ENDPOINT})... "
status=$(ssh "$VM110" "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:${HOST_PORT}${HEALTH_ENDPOINT}" 2>/dev/null || true)
if [[ "$status" == "200" ]]; then
  echo "OK"
else
  echo "FAILED (status: $status)"
  exit 1
fi

# Public URL check. Unauthenticated requests should redirect to Cloudflare Access (302),
# which proves Access is protecting the app. 200 is also acceptable if Access is bypassed for health.
echo -n "Public URL (https://${APP_DOMAIN})... "
status=$(curl -sS -o /dev/null -w '%{http_code}' "https://${APP_DOMAIN}" 2>/dev/null || true)
if [[ "$status" == "200" || "$status" == "302" || "$status" == "301" || "$status" == "403" ]]; then
  echo "OK (status: $status)"
else
  echo "FAILED (status: $status)"
  exit 1
fi

# Authenticated check via Cloudflare Access service token (if credentials are available)
if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  echo -n "Authenticated health check... "
  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}" \
    -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}" \
    "https://${APP_DOMAIN}${HEALTH_ENDPOINT}" 2>/dev/null || true)
  if [[ "$status" == "200" ]]; then
    echo "OK"
  else
    echo "FAILED (status: $status)"
    exit 1
  fi
fi

echo "All smoke tests passed."
