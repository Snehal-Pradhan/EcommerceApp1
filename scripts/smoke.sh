#!/usr/bin/env bash
#
# Post-deploy smoke test. This is the gate between "the pipeline finished" and
# "users get the release".
#
# Two halves, because there are two ways a deploy can be broken:
#
#   * The API can be up but unable to serve (no schema, empty catalogue, an
#     authorisation guard that has regressed). Those are steps 1-5, and they
#     deliberately check /ready rather than /health, because /ready verifies the
#     database actually answers. A container that is running but broken is the
#     failure mode that matters, and /health alone would wave it through.
#
#   * The API can be perfectly healthy while nothing is reachable in a browser.
#     A front-end image listening on the wrong port, an admin panel the proxy
#     never routes, or two apps swapped in the proxy config all leave every API
#     check green. Those are steps 6-8, and they exist because a release reached
#     production with a storefront that returned 502 on every page while the
#     health endpoint was happily returning 200.
#
# Usage: smoke.sh [base_url] [label] [storefront|admin]
#   smoke.sh http://localhost      "Storefront" storefront
#   smoke.sh http://localhost:8081 "Admin"     admin
#
# Exit:  0 = healthy, 1 = failed

set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
LABEL="${2:-Service}"
APP_KIND="${3:-storefront}"

# The two apps have distinct <title>s, so a swapped proxy config is detectable.
case "$APP_KIND" in
  storefront) EXPECTED_TITLE="Storefront"; DEEP_LINK="/products";    ASSET_HINT="/assets/" ;;
  admin)      EXPECTED_TITLE="Store Admin"; DEEP_LINK="/orders";     ASSET_HINT="/assets/" ;;
  *) printf 'Unknown app kind: %s (expected storefront or admin)\n' "$APP_KIND" >&2; exit 1 ;;
esac

MAX_ATTEMPTS="${SMOKE_MAX_ATTEMPTS:-10}"
RETRY_DELAY="${SMOKE_RETRY_DELAY:-3}"

log()  { printf '  %s\n' "$*"; }
pass() { printf '  \033[32mPASS\033[0m %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[31m %s\n' "$*"; exit 1; }

printf 'Smoke test against %s (%s)\n' "$BASE_URL" "$LABEL"

# --- 1. wait for readiness, with retries so a slow start is not a failure ----
printf '\n[1/8] Waiting for readiness (up to %s attempts)\n' "$MAX_ATTEMPTS"
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
printf '\n[2/8] Liveness\n'
curl -fsS --max-time 5 "${BASE_URL}/health" >/dev/null || fail "/health did not respond"
pass "/health is up"

# --- 3. the catalogue actually returns data ---------------------------------
printf '\n[3/8] Catalogue\n'
products=$(curl -fsS --max-time 10 "${BASE_URL}/api/v1/products" || true)
[ -n "$products" ] || fail "/api/v1/products returned nothing"
count=$(printf '%s' "$products" | grep -o '"id"' | wc -l | tr -d ' ')
log "  catalogue returned ${count} product(s)"
[ "$count" -gt 0 ] || fail "catalogue is empty (did the seed job run?)"

# --- 4. auth actually works (not just reachable) ----------------------------
printf '\n[4/8] Authentication\n'
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
printf '\n[5/8] Authorisation\n'
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${BASE_URL}/api/v1/admin/stats")
case "$code" in
  401|403) pass "anonymous request to /admin/stats rejected (${code})" ;;
  *)       fail "/admin/stats returned ${code} to an anonymous caller" ;;
esac

# --- 6. the web container's own nginx is serving ----------------------------
# Answered by the app's own config with no upstream involved, so this passes
# only when that container is up and listening on the port the proxy dials.
# This is the check that catches an image listening somewhere other than where
# the proxy expects - a 502 on every page while the API stays perfectly green.
printf '\n[6/8] Web container is serving\n'
body=$(curl -fsS --max-time 5 "${BASE_URL}/healthz" || true)
[ "$body" = "ok" ] || fail "/healthz did not return 'ok' from ${LABEL} (got '${body}')"
pass "${LABEL} container answers /healthz"

# --- 7. the right app is being served ---------------------------------------
printf '\n[7/8] Correct app on this origin\n'
html=$(curl -fsS --max-time 10 "${BASE_URL}/" || true)
[ -n "$html" ] || fail "${BASE_URL}/ returned no HTML"
printf '%s' "$html" | grep -q "<title>${EXPECTED_TITLE}</title>" \
  || fail "${BASE_URL}/ served the wrong app (expected <title>${EXPECTED_TITLE}</title>)"
printf '%s' "$html" | grep -q 'id="root"' || fail "${BASE_URL}/ is not the app shell (no #root)"
pass "${LABEL} app shell served with the expected title"

# --- 8. client-side routing survives the proxy ------------------------------
# A deep link must return the SPA shell, not a 404. This is what proves the
# proxy passes paths through rather than only serving the index at /, and it
# is also what fails loudly if the admin panel is ever mounted under an /admin/
# prefix that its basename-less BrowserRouter cannot match.
printf '\n[8/8] Deep link through the proxy\n'
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${BASE_URL}${DEEP_LINK}")
[ "$code" = "200" ] || fail "${DEEP_LINK} returned ${code} (expected 200) - client-side routing is broken"
deep_html=$(curl -fsS --max-time 10 "${BASE_URL}${DEEP_LINK}" || true)
printf '%s' "$deep_html" | grep -q "<title>${EXPECTED_TITLE}</title>" \
  || fail "${DEEP_LINK} did not return the app shell"
pass "${DEEP_LINK} serves the SPA shell"

printf '\n\033[32mSmoke test passed for %s.\033[0m\n' "$LABEL"
