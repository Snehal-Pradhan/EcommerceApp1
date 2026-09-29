#!/usr/bin/env bash
#
# Post-deploy smoke test.
#
# This is the gate between "the pipeline finished" and "users get the release".
# It deliberately checks /ready, not /health: /ready verifies the database
# actually answers, so a container that booted but cannot serve is caught.
# A container that is running but broken is the failure mode that matters, and
# /health alone would wave it through.
#
# Usage: smoke.sh [base_url]
# Exit:  0 = healthy, 1 = failed

set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
MAX_ATTEMPTS="${SMOKE_MAX_ATTEMPTS:-10}"
RETRY_DELAY="${SMOKE_RETRY_DELAY:-3}"

log()  { printf '  %s\n' "$*"; }
pass() { printf '  \033[32mPASS\033[0m %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$*"; exit 1; }

printf 'Smoke test against %s\n' "$BASE_URL"

# --- 1. wait for readiness, with retries so a slow start is not a failure ----
printf '\n[1/5] Waiting for readiness (up to %s attempts)\n' "$MAX_ATTEMPTS"
ready=0
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if curl -fsS --max-time 5 "${BASE_URL}/ready" >/dev/null 2>&1; then
    ready=1
    pass "ready on attempt ${attempt}"
    break
  fi
  log "  attempt ${attempt}/${MAX_ATTEMPTS}: not ready yet"
  sleep "$RETRY_DELAY"
done
[ "$ready" -eq 1 ] || fail "service never became ready"

# --- 2. liveness ------------------------------------------------------------
printf '\n[2/5] Liveness\n'
curl -fsS --max-time 5 "${BASE_URL}/health" >/dev/null || fail "/health did not respond"
pass "/health is up"

# --- 3. the catalogue actually returns data ---------------------------------
printf '\n[3/5] Catalogue\n'
products=$(curl -fsS --max-time 10 "${BASE_URL}/api/v1/products" || true)
[ -n "$products" ] || fail "/api/v1/products returned nothing"
count=$(printf '%s' "$products" | grep -o '"id"' | wc -l | tr -d ' ')
log "  catalogue returned ${count} product(s)"
[ "$count" -gt 0 ] || fail "catalogue is empty"

# --- 4. auth actually works (not just reachable) ----------------------------
printf '\n[4/5] Authentication\n'
token=$(curl -fsS --max-time 10 -X POST "${BASE_URL}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@example.com","password":"Password123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || true)

if [ -z "$token" ]; then
  log "  no seeded demo account; skipping authenticated checks"
else
  pass "logged in with the seeded demo account"

  # The admin area must reject a customer token. If this ever returns 200, the
  # authorisation guard has regressed and the release must not ship.
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "${BASE_URL}/api/v1/admin/stats" -H "Authorization: Bearer ${token}")
  [ "$code" = "403" ] || fail "customer reached /admin/stats (expected 403, got ${code})"
  pass "customer is blocked from the admin area (403)"
fi

# --- 5. the admin area is not open to the anonymous -------------------------
printf '\n[5/5] Authorisation\n'
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${BASE_URL}/api/v1/admin/stats")
case "$code" in
  401|403) pass "anonymous request to /admin/stats rejected (${code})" ;;
  *)       fail "/admin/stats returned ${code} to an anonymous caller" ;;
esac

printf '\n\033[32mSmoke test passed.\033[0m\n'
