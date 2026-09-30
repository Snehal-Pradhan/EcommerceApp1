# syntax=docker/dockerfile:1
#
# EXPERIMENT (now adopted): hardened runtime, same as frontend/Dockerfile.
# Chainguard (Wolfi) nginx: no shell, no wget, non-root 65532, near-zero CVEs.
#
# Costs, identical to frontend/Dockerfile's - see its header for the full list:
# the config renders at BUILD time (the builder stage has the shell), so the
# backend address is baked in and the runtime BACKEND_HOST/BACKEND_PORT
# environment variables are ignored by this image; no in-image HEALTHCHECK; a
# mutable :latest tag because the free tier pins nothing.

ARG NODE_IMAGE=node:22.23.3-alpine3.24
ARG NGINX_IMAGE=cgr.dev/chainguard/nginx:latest

# ----------------------------------------------------------------- builder --
FROM ${NODE_IMAGE} AS builder

# Baked at build time because the hardened runtime has no shell to render with.
# Default matches the compose network's service name.
ARG BACKEND_ADDR=api:8000

WORKDIR /app

# Lockfile first: keeps `npm ci` cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

# No NODE_ENV=production here - it would skip devDependencies and the build
# would fail with "vite: not found".
COPY . .
RUN npm run build

# Render the server config from the template. The upstream line is rewritten
# wholesale (line after the upstream block) so the template's placeholders never
# appear in the sed program. Double quotes matter: BuildKit does not substitute
# ${ARG} inside single-quoted segments.
RUN sed -E "/upstream backend_upstream/{n;s|.*|    server ${BACKEND_ADDR};|}" \
      nginx.conf.template > nginx.default.conf \
 && grep -q "server ${BACKEND_ADDR};" nginx.default.conf

# ----------------------------------------------------------------- runtime --
FROM ${NGINX_IMAGE} AS runtime

LABEL org.opencontainers.image.title="store-admin" \
      org.opencontainers.image.source="https://github.com/Snehal-Pradhan/Ecom-demo-app"

COPY --from=builder /app/dist /usr/share/nginx/html

# Same filename as the image's own default server, so it replaces it instead of
# colliding on listen 8080.
COPY --from=builder /app/nginx.default.conf /etc/nginx/conf.d/nginx.default.conf

EXPOSE 8080

# No USER (the image already runs as 65532), no HEALTHCHECK (no wget), and no
# CMD/ENTRYPOINT: the image's own `nginx -c /etc/nginx/nginx.conf ...` is used.
