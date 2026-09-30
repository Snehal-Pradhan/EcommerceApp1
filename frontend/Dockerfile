# syntax=docker/dockerfile:1
#
# EXPERIMENT: hardened runtime. The nginx stage uses a Chainguard (Wolfi) image:
# no shell, no wget, runs as non-root 65532, near-zero CVE surface.
#
# What that costs, and why this Dockerfile diverges from admin/Dockerfile:
#
#   1. No shell means no envsubst entrypoint, so the config cannot be rendered
#      at container start. It is rendered at BUILD time instead (in the builder
#      stage, which still has a shell), from the same nginx.conf.template. The
#      consequence: the backend address is baked in, so this image is bound to
#      the compose network's service name. The runtime BACKEND_HOST/BACKEND_PORT
#      environment variables are ignored by this image.
#   2. No wget means no in-image HEALTHCHECK. Health moves to the platform
#      (compose can declare its own healthcheck if needed).
#   3. No RUN is possible in the runtime stage at all - there is no shell to run
#      it with. The image ships pre-writable log and pid paths for uid 65532.
#   4. The rendered config overwrites the image's own
#      /etc/nginx/conf.d/nginx.default.conf rather than adding a second file:
#      both listen on 8080, and nginx refuses to start on a duplicate listen.
#
#   5. cgr.dev/chainguard/nginx:latest is a MUTABLE tag - the free tier offers
#      nothing else, which conflicts with the pinned-versions discipline used
#      everywhere else in this repo. That is the real price of the free tier.

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

LABEL org.opencontainers.image.title="store-frontend" \
      org.opencontainers.image.description="Storefront: static bundle served by hardened nginx" \
      org.opencontainers.image.source="https://github.com/Snehal-Pradhan/Ecom-demo-app"

COPY --from=builder /app/dist /usr/share/nginx/html

# Same filename as the image's own default server, so it replaces it instead of
# colliding on listen 8080.
COPY --from=builder /app/nginx.default.conf /etc/nginx/conf.d/nginx.default.conf

EXPOSE 8080

# No USER (the image already runs as 65532), no HEALTHCHECK (no wget), and no
# CMD/ENTRYPOINT: the image's own `nginx -c /etc/nginx/nginx.conf ...` is used.
