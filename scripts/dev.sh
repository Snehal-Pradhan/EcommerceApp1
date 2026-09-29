#!/usr/bin/env bash
#
# Run the whole stack locally with no Docker: PostgreSQL and Redis must already
# be running, then the API and both frontends start as background processes.
#
#   ./scripts/dev.sh start     start everything
#   ./scripts/dev.sh stop      stop the app processes (leaves the databases up)
#   ./scripts/dev.sh status    show what is listening
#   ./scripts/dev.sh logs      tail all three logs
#
# Docker is the supported path for reproducing CI exactly. This script exists
# because a container round-trip on every save is a slow inner loop.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/backend/.venv"
LOG_DIR="${TMPDIR:-/tmp}/store-dev"
API_PORT="${API_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
ADMIN_PORT="${ADMIN_PORT:-5173}"

mkdir -p "$LOG_DIR"

# A local-only secret. Production supplies its own and config.py refuses the
# placeholder when ENVIRONMENT is production.
DEV_SECRET="${SECRET_KEY:-local-dev-secret-at-least-32-characters-long}"

export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg://store:store@localhost:5432/store}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3000,http://localhost:5173}"
export ENVIRONMENT="${ENVIRONMENT:-development}"
export SECRET_KEY="$DEV_SECRET"

start_api() {
  [ -x "$VENV/bin/uvicorn" ] || { echo "Create the venv first: python3.11 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements-dev.txt"; exit 1; }
  echo "  api      -> http://localhost:$API_PORT"
  (cd "$ROOT/backend" && nohup "$VENV/bin/uvicorn" app.main:app \
     --host 127.0.0.1 --port "$API_PORT" >"$LOG_DIR/api.log" 2>&1 &)
}

start_frontend() {
  (cd "$ROOT/frontend" && PORT="$FRONTEND_PORT" VITE_API_PROXY_TARGET="http://localhost:$API_PORT" \
     nohup npm run dev >"$LOG_DIR/frontend.log" 2>&1 &)
  echo "  frontend -> http://localhost:$FRONTEND_PORT"
}

start_admin() {
  (cd "$ROOT/admin" && PORT="$ADMIN_PORT" VITE_API_PROXY_TARGET="http://localhost:$API_PORT" \
     nohup npm run dev >"$LOG_DIR/admin.log" 2>&1 &)
  echo "  admin    -> http://localhost:$ADMIN_PORT"
}

case "${1:-start}" in
  start)
    echo "Starting store..."
    start_api
    start_frontend
    start_admin
    echo
    echo "Logs in $LOG_DIR (api.log, frontend.log, admin.log)"
    echo "Seed demo data with: (cd backend && .venv/bin/python -m app.seed)"
    ;;
  stop)
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo "Stopped app processes. Databases left running."
    ;;
  status)
    for port in "$API_PORT" "$FRONTEND_PORT" "$ADMIN_PORT"; do
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://localhost:$port" 2>/dev/null || echo "---")
      printf '  :%s -> %s\n' "$port" "$code"
    done
    ;;
  logs)
    tail -f "$LOG_DIR"/*.log
    ;;
  *)
    echo "Usage: $0 {start|stop|status|logs}" >&2
    exit 1
    ;;
esac
