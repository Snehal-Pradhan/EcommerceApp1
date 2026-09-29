"""Router registry.

``api_router`` is the single object mounted by ``app.main``. Adding a router
here is the only step needed to expose a new module.
"""

from fastapi import APIRouter

from app.routers import admin, auth, cart, favorites, health, orders, products, uploads

api_router = APIRouter()

# Health and readiness stay at the root: load balancers, orchestrators, and
# container probes expect /health and /ready at a fixed, unversioned path.
api_router.include_router(health.router)

# Everything else lives under a versioned prefix, so a future /api/v2 can be
# mounted alongside this one without breaking existing clients.
API_PREFIX = "/api/v1"
for module in (auth, products, cart, orders, favorites, uploads, admin):
    api_router.include_router(module.router, prefix=API_PREFIX)

__all__ = ["api_router"]
