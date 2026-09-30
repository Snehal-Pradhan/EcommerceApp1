# syntax=docker/dockerfile:1
#
# Structurally identical to admin/Dockerfile: a Vite + React app compiles to
# static files, so the runtime is nginx and carries no Node. The only differences
# are the label and which source directory is copied.
#
# The duplication is deliberate for now - two readable Dockerfiles beat one
# parameterised one while you are still learning what the parts do. Once both are
# stable the real fix is a shared base image or a single root Dockerfile with
# build args, not copy-paste that drifts.

ARG NODE_IMAGE=node:22.23.3-alpine3.24
ARG NGINX_IMAGE=nginx:1.31.2-alpine

# ----------------------------------------------------------------- builder --
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# Lockfile first: keeps `npm ci` cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

# No NODE_ENV=production here - it would skip devDependencies and the build
# would fail with "vite: not found".
COPY . .
RUN npm run build

# ----------------------------------------------------------------- runtime --
FROM ${NGINX_IMAGE} AS runtime

LABEL org.opencontainers.image.title="store-frontend" \
      org.opencontainers.image.description="Storefront: static bundle served by nginx" \
      org.opencontainers.image.source="https://github.com/Snehal-Pradhan/Ecom-demo-app"

COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Rendered at container start, so one image works in any environment.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d

# chown must precede USER; the config dir is written by the entrypoint.
RUN touch /var/run/nginx.pid \
 && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

USER nginx
EXPOSE 8080

# Hits /healthz, which nginx answers without the backend. Checking the API here
# would restart healthy containers during a dependency outage.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
