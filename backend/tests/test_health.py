"""Health, readiness, and the liveness/readiness distinction."""

from __future__ import annotations


def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_reports_database(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


def test_root_advertises_both_probes(client):
    body = client.get("/").json()
    assert body["health"] == "/health"
    assert body["ready"] == "/ready"


def test_health_needs_no_auth(client):
    """Probes are called by infrastructure, which has no credentials."""
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 200
