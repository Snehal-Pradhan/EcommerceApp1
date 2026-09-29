"""Liveness and readiness endpoints.

These are deliberately two different things, and the distinction is the point
of the whole CI/CD series:

* ``/health``  - liveness. Answers "is this process running?" It touches nothing
  outside the process, so it cannot fail because a database is slow. This is
  what a load balancer, an Elastic Beanstalk health check, and a Kubernetes
  liveness probe should use. If liveness depends on the database, a brief
  database blip restarts every healthy application container at once.
* ``/ready``   - readiness. Answers "can this process serve traffic right now?"
  It verifies the database round-trips. This is what should gate traffic.

A smoke test should use ``/ready`` so it catches a container that booted but
cannot actually serve. A restart policy should use ``/health`` so it does not
restart healthy containers during a dependency outage.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.deps import DbSession

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness probe. No external dependencies by design."""
    return {"status": "ok"}


@router.get("/ready")
def ready(response: Response, db: DbSession) -> dict[str, str]:
    """Readiness probe. Verifies the database is actually reachable."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "unreachable", "detail": type(exc).__name__}
    return {"status": "ready", "database": "ok"}
