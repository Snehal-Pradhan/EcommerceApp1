# syntax=docker/dockerfile:1
#
# EXPERIMENT (now adopted): hardened runtime, same idea as the web apps.
# The builder is Chainguard's -dev variant (it has a shell and pip, same
# Python 3.14 as the runtime); the runtime is the minimal variant: no shell,
# no package manager, non-root 65532.
#
# What "no shell in the runtime" costs here - each is worked around below:
#
#   1. No RUN in the runtime stage. So: no useradd (the image's own 65532
#      user is used), no `mkdir uploads` (the directory is created in the
#      builder and copied with the right ownership).
#   2. No `sh -c`, so the CMD cannot expand ${PORT}. A python -c one-liner
#      reads the environment instead, keeping the "PORT comes from the
#      environment, never hardcoded" rule (Elastic Beanstalk sets PORT=80).
#   3. No curl, so no in-image HEALTHCHECK. The healthcheck moves to the
#      platform: docker-compose.yml now declares one for the api service,
#      same as it already did for db.
#   4. The venv is built by -dev, whose /usr/bin/python3.14 is the same
#      binary the runtime has, so the venv's symlinks resolve.
#   5. cgr.dev/chainguard/python:latest is a MUTABLE tag (free tier), like
#      the web images.

ARG PYTHON_IMAGE=cgr.dev/chainguard/python:latest-dev
ARG RUNTIME_IMAGE=cgr.dev/chainguard/python:latest

# ----------------------------------------------------------------- builder --
FROM ${PYTHON_IMAGE} AS builder

# The -dev image defaults to the non-root 65532, who cannot write /opt. This
# is a build stage: it runs as root, installs into /opt, and is thrown away.
USER root

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

# Lockfile first, on its own layer: editing app code must not reinstall packages.
COPY requirements.txt .

# A venv rather than system site-packages, so the runtime stage copies one
# self-contained directory instead of reconstructing an environment.
#
# No compiler is needed: every pin resolves to a wheel - psycopg-binary
# bundles its own libpq, bcrypt ships prebuilt hashes. Verified against
# Chainguard's Python 3.14.
#
# pip is deleted in the same layer. A package installer is not something a
# running server should carry.
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install -r requirements.txt \
 && rm -rf /opt/venv/lib/python*/site-packages/pip* /opt/venv/bin/pip*

# Runtime has no shell, so this directory cannot be created there. The
# placeholder file is copied along; it is inert.
RUN mkdir -p /srv/uploads && touch /srv/uploads/.keep

# ----------------------------------------------------------------- runtime --
FROM ${RUNTIME_IMAGE} AS runtime

LABEL org.opencontainers.image.title="store-api" \
      org.opencontainers.image.description="FastAPI backend: catalogue, cart, orders, admin" \
      org.opencontainers.image.source="https://github.com/Snehal-Pradhan/Ecom-demo-app"

COPY --from=builder /opt/venv /opt/venv

# PYTHONUNBUFFERED stops stdout being block-buffered when not attached to a TTY.
# Without it the app appears to produce no logs in production and appears to hang.
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /srv
# Only app/ is copied. Tests, .venv, and caches never enter the image.
# 65532 is the image's built-in non-root user; --chown replaces the
# useradd+chown steps the no-shell runtime cannot perform.
COPY --chown=65532:65532 app ./app

# The app writes uploaded images here. Under a read-only root filesystem this is
# the one path that has to be a mounted volume.
COPY --from=builder --chown=65532:65532 /srv/uploads /srv/uploads

EXPOSE 8000

# /health, not /ready. Readiness queries the database, and a health check that
# fails on a dependency makes the orchestrator restart every healthy API
# container at once - turning a brief database blip into a full outage that also
# hammers the database with a reconnect storm on the way up.
#
# The healthcheck itself is declared in docker-compose.yml: this image has no
# shell and no curl, so it cannot carry one, but every service that depends on
# the api (frontend, admin) waits on compose's condition: service_healthy.

# PORT comes from the environment, never hardcoded: Elastic Beanstalk sets
# PORT=80 and routes to whatever port the app listens on, so a hardcoded 8000
# works locally and 502s on EB. Without a shell the environment cannot be
# expanded in CMD, so uvicorn is started from python, which can read it.
#
# The base image's entrypoint is /usr/bin/python, which cannot see the venv's
# site-packages. The entrypoint is replaced with the venv's own interpreter -
# same /usr/bin/python3.14 binary underneath, but with the venv activated.
ENTRYPOINT ["/opt/venv/bin/python"]
CMD ["-c", "import os, uvicorn; uvicorn.run('app.main:app', host='0.0.0.0', port=int(os.environ.get('PORT', '8000')))"]
