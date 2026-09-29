"""FastAPI application factory and entrypoint."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import api_router

settings = get_settings()
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
)
logger = logging.getLogger("store")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="E-commerce API: catalogue, cart, orders, and admin.",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    # CORS is opt-in. The default is an empty allow-list, meaning no cross-origin
    # browser access at all. This is the opposite of the common
    # allow_origins=["*"] default, which lets any website on the internet call
    # your authenticated API from a user's browser.
    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
        )
        logger.info("CORS enabled for origins: %s", settings.allowed_origins)
    else:
        logger.info("CORS disabled (no origins configured)")

    app.include_router(api_router)

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/health",
            "ready": "/ready",
        }

    return app


app = create_app()
