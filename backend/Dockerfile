# syntax=docker/dockerfile:1
#
# The frontend compiled down to static files and threw Node away. This is the
# opposite shape: the app keeps running, so the runtime needs a Python
# interpreter - but not pip, not a compiler, and not the source of the
# dependencies. The venv is copied as a self-contained unit.

ARG PYTHON_IMAGE=python:3.12-slim

# ----------------------------------------------------------------- builder --
FROM ${PYTHON_IMAGE} AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

# Lockfile first, on its own layer: editing app code must not reinstall packages.
COPY requirements.txt .

# A venv rather than system site-packages, so the runtime stage copies one
# self-contained directory instead of reconstructing an environment.
#
# No compiler is installed here and none is needed: every pin resolves to a
# manylinux wheel - psycopg-binary bundles its own libpq, bcrypt ships prebuilt
# hashes. If a future pin stops having a wheel, this is the stage that gains
# build-essential and libpq-dev, never the runtime stage.
#
# pip is deleted in the same layer. It costs ~13 MB and a package installer is
# not something a running server should carry.
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install -r requirements.txt \
 && rm -rf /opt/venv/lib/python*/site-packages/pip* /opt/venv/bin/pip*

# ----------------------------------------------------------------- runtime --
FROM ${PYTHON_IMAGE} AS runtime

LABEL org.opencontainers.image.title="store-api" \
      org.opencontainers.image.description="FastAPI backend: catalogue, cart, orders, admin" \
      org.opencontainers.image.source="https://github.com/Snehal-Pradhan/Ecom-demo-app"

# curl exists only for the HEALTHCHECK. A python -c urllib one-liner would drop
# the binary and its CVEs at the cost of readability.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Debian, not Alpine, so this is useradd/groupadd rather than busybox adduser.
# Alpine would be ~10 MB smaller but needs musl wheels, and "worked on Debian,
# broke on Alpine" is a recurring class of bug.
RUN groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid app --create-home --shell /usr/sbin/nologin app

COPY --from=builder /opt/venv /opt/venv

# PYTHONUNBUFFERED stops stdout being block-buffered when not attached to a TTY.
# Without it the app appears to produce no logs in production and appears to hang.
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /srv
# Only app/ is copied. Tests, .venv, and caches never enter the image.
COPY --chown=app:app app ./app

# The app writes uploaded images here. Under a read-only root filesystem this is
# the one path that has to be a mounted volume.
RUN mkdir -p /srv/uploads && chown app:app /srv/uploads

USER app
EXPOSE 8000

# /health, not /ready. Readiness queries the database, and a health check that
# fails on a dependency makes the orchestrator restart every healthy API
# container at once - turning a brief database blip into a full outage that also
# hammers the database with a reconnect storm on the way up.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

# PORT comes from the environment, never hardcoded: Elastic Beanstalk sets
# PORT=80 and routes to whatever port the app listens on, so a hardcoded 8000
# works locally and 502s on EB. `exec` keeps uvicorn as PID 1 so it receives
# SIGTERM directly and drains in-flight requests on stop.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
