# Store

A three-tier e-commerce application built to be deployed by a CI/CD pipeline:
React storefront, React admin panel, FastAPI API, PostgreSQL, Redis.

It exists as the demo workload for a CI/CD series, so the parts a pipeline
touches are first-class: three independently built images, two health
endpoints, a real test suite, a post-deploy smoke test, and pinned dependencies
throughout.

```
storefront  React 18 + Vite  ─┐
                              ├─►  API  FastAPI  ─►  PostgreSQL 16
admin       React 18 + Vite  ─┘         │            Redis 7
                                        │
                              /health    │    /ready
                              (liveness) │    (readiness)
```

## Quick start

### Docker (recommended)

```bash
cp .env.example .env
# set SECRET_KEY to any string of 32+ characters
docker compose up --build
```

| Service    | URL                            |
| ---------- | ------------------------------ |
| Storefront | http://localhost:3000          |
| Admin      | http://localhost:5173          |
| API docs   | http://localhost:8000/docs     |
| API health | http://localhost:8000/health   |

Demo accounts, created by the `seed` service:

| Role     | Email                  | Password      |
| -------- | ---------------------- | ------------- |
| Customer | `customer@example.com` | `Password123` |
| Admin    | `admin@example.com`    | `Password123` |

### Local, without Docker

Needs Python 3.11+, Node 20+, PostgreSQL, and Redis already running.

```bash
# 1. Databases
createuser -s store --pwprompt            # password: store
createdb -O store store

# 2. API
python3.11 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
(cd backend && .venv/bin/python -m app.seed)
./scripts/dev.sh start

./scripts/dev.sh status
./scripts/dev.sh stop
```

## Layout

```
backend/     FastAPI app, tests, Dockerfile
frontend/    Storefront (Vite), nginx.conf.template, Dockerfile
admin/       Admin panel (Vite), nginx.conf.template, Dockerfile
scripts/     dev.sh (run locally), smoke.sh (post-deploy gate)
infra/       reserved for Terraform (later in the series)
```

## The API

All endpoints live under `/api/v1` except the two probes, which stay at the root
because infrastructure expects them at a fixed path.

| Area      | Endpoints                                                        |
| --------- | ---------------------------------------------------------------- |
| Health    | `GET /health`, `GET /ready`                                      |
| Auth      | `POST /auth/signup`, `/login`, `/refresh`, `/logout`, `GET /auth/me` |
| Products  | `GET /products`, `/categories`, `/featured`, `/{id}`             |
| Cart      | `GET /cart`, `POST/PUT/DELETE /cart/items`                       |
| Orders    | `POST /orders`, `GET /orders`, `GET /orders/{id}`                |
| Favorites | `GET /favorites`, `POST/DELETE /favorites/{product_id}`          |
| Admin     | `GET /admin/stats`, CRUD `/admin/products`, `/admin/orders`      |
| Uploads   | `POST /uploads/images`, `GET /uploads/images/{filename}`         |

## Two health endpoints, on purpose

This is the single most useful thing in the repo for a CI/CD series, so it is
worth stating plainly.

`/health` is **liveness**: is this process running? It touches nothing outside
the process. `/ready` is **readiness**: can it actually serve traffic? It
executes `SELECT 1` against the database.

They must be different endpoints because the two callers want opposite
behaviour:

- A **restart policy** or **liveness probe** should use `/health`. If liveness
  depends on the database, a 30-second database blip makes the orchestrator
  kill every healthy application container at once, turning a small dependency
  problem into a full outage.
- **Traffic gating** and the **post-deploy smoke test** should use `/ready`. A
  container can be up and serving 500s on every request because it booted before
  the database was reachable. `/health` would happily wave that through.

`scripts/smoke.sh` uses `/ready`, and also asserts that a customer token is
rejected by the admin API. A smoke test that only checks "did the port open" is
not a gate, it is a formality.

## Development

```bash
# API
cd backend
.venv/bin/ruff check .                                    # lint
DATABASE_URL=postgresql+psycopg://store:store@localhost:5432/store_test \
  .venv/bin/python -m pytest                              # 35 tests

# Frontends
cd frontend && npm run dev      # http://localhost:3000
cd admin    && npm run dev      # http://localhost:5173
```

Tests run against real PostgreSQL, not SQLite. SQLite accepts things Postgres
rejects and vice versa, so testing on SQLite hides exactly the bugs worth
catching. Point `DATABASE_URL` at a `store_test` database.

## Security notes

Decisions worth stating, because each one is a deliberate trade rather than an
accident.

**Dependencies are fully pinned, including transitive ones.** `requirements.txt`
is a `pip freeze` of a set that was verified against the test suite, and the
Dockerfiles install with `npm ci` against a committed lockfile. This is not
fastidiousness. While building the app this series' predecessor, three separate
runtime failures came from unpinned dependencies: a `psycopg2`/`psycopg3` dialect
mismatch, a `postcss` 8.5 release breaking Tailwind 3, and an ESLint plugin
regression. All three passed locally and broke on a clean machine. Builds must
be reproducible; a pipeline that tests floating versions tests nothing.

**The app refuses to start in production without a real secret.** With
`ENVIRONMENT=production`, `config.py` raises if `SECRET_KEY` is missing, is
still the development placeholder, or is under 32 characters. A missing secret
is a boot failure, not a silently insecure deployment.

**CORS is opt-in and never wildcard.** The default allow-list is empty, meaning
no cross-origin browser access. The common `allow_origins=["*"]` default lets
any website on the internet call your authenticated API from a signed-in user's
browser.

**Money is `Numeric(12,2)`, never `float`.** Binary floating point cannot
represent `0.10`, so float totals drift by cents. `tests/test_store.py` asserts
exact order arithmetic to keep it that way.

**Passwords use `bcrypt` directly, not `passlib`.** passlib 1.7.x has had no
release in years and its bcrypt 4.x shim is a recurring source of broken auth.
Bcrypt's 72-byte limit is enforced rather than silently truncating, which would
make two different long passwords identical.

**Login failures are indistinguishable.** Unknown email and wrong password
return the same status and the same message, so the endpoint cannot be used to
enumerate accounts.

**Refresh tokens cannot be used as access tokens.** The `type` claim is
validated, and `401` responses never reveal whether a token was forged, expired,
or of the wrong type.

**Order placement locks the cart rows.** `SELECT ... FOR UPDATE of=cart_items`
inside the transaction, so two concurrent checkouts cannot both read the same
cart and oversell stock. The `of=` clause is required because eager loading
adds an outer join and Postgres refuses `FOR UPDATE` on the nullable side.

**Products are soft-deleted.** Deactivating keeps the foreign key from
historical order items intact; hard-deleting breaks order history.

**Uploads are validated defensively.** Content type allow-list, size enforced
while streaming rather than after buffering, random stored filename, and the
client's filename is never used as a path. Reads reject any filename containing
a separator.

**Admin routes require an admin role.** A regression test enumerates the whole
admin surface and asserts none of it answers an anonymous caller. That test
exists because during development the `CurrentAdmin` dependency was defined and
then never attached to the routes: every admin endpoint was reachable without
authentication, and the tests caught it on the first run.

**Containers run as non-root, as `app` (1001) and `nginx` (101).** Build
tooling stays in the builder stage. The frontend runtime image is 22 MB and
contains only static files, with no Node.js and no `node_modules`.

## What is deliberately not here

- **No cloud storage.** Product images are external URLs and uploads go to the
  local disk. Object storage belongs in the infrastructure post.
- **No refresh-token revocation.** Stateless JWTs cannot be revoked without a
  deny-list; `/auth/logout` clears the client and documents the gap.
- **No rate limiting.** Belongs at the edge (WAF or ALB), not in the app.
- **No EKS, no Kubernetes.** The deploy target for the series is Elastic
  Beanstalk.
