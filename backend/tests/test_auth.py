"""Authentication, authorisation, and token handling."""

from __future__ import annotations

import pytest
from tests.conftest import auth_header


def test_signup_creates_user(client):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "New@Example.com", "name": "New", "password": "Password123"},
    )
    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"  # normalised to lowercase


def test_signup_rejects_duplicate_email(client, seeded):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "CUST@example.com", "name": "Dup", "password": "Password123"},
    )
    assert response.status_code == 409


@pytest.mark.parametrize(
    "password,reason",
    [
        ("short12", "too short"),
        ("alllettersonly", "no digits"),
        ("12345678", "no letters"),
    ],
)
def test_signup_rejects_weak_passwords(client, password, reason):
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": f"{reason}@example.com", "name": "X", "password": password},
    )
    assert response.status_code == 422


def test_login_returns_both_tokens(client, seeded):
    response = client.post(
        "/api/v1/auth/login", json={"email": "cust@example.com", "password": "Password123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_rejects_wrong_password(client, seeded):
    response = client.post(
        "/api/v1/auth/login", json={"email": "cust@example.com", "password": "WrongPass1"}
    )
    assert response.status_code == 401


def test_login_does_not_reveal_whether_email_exists(client, seeded):
    """A different code for unknown-email would let anyone enumerate accounts."""
    unknown = client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "Password123"}
    )
    wrong = client.post(
        "/api/v1/auth/login", json={"email": "cust@example.com", "password": "WrongPass1"}
    )
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]


def test_me_requires_a_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_rejects_garbage_token(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


def test_me_rejects_a_refresh_token_used_as_access_token(client, seeded):
    tokens = client.post(
        "/api/v1/auth/login", json={"email": "cust@example.com", "password": "Password123"}
    ).json()
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
    )
    assert response.status_code == 401


def test_refresh_issues_a_new_access_token(client, seeded):
    tokens = client.post(
        "/api/v1/auth/login", json={"email": "cust@example.com", "password": "Password123"}
    ).json()
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_admin_route_rejects_a_customer(client, seeded):
    headers = auth_header(client, "cust@example.com")
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 403


def test_admin_route_allows_an_admin(client, seeded):
    headers = auth_header(client, "admin@example.com")
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 200


def test_every_admin_route_rejects_anonymous_callers(client, seeded):
    """Regression guard.

    A dependency that is defined but never attached to a route fails open:
    the endpoint still works, it just has no protection. Assert on the full
    admin surface so a future route cannot be added without a guard.
    """

    admin_paths = [
        ("GET", "/api/v1/admin/stats", None),
        ("GET", "/api/v1/admin/products", None),
        (
            "POST",
            "/api/v1/admin/products",
            {"sku": "X", "name": "X", "price": "1.00", "category": "C"},
        ),
        ("PUT", "/api/v1/admin/products/1", {"name": "X"}),
        ("DELETE", "/api/v1/admin/products/1", None),
        ("GET", "/api/v1/admin/orders", None),
        ("PUT", "/api/v1/admin/orders/1", {"status": "cancelled"}),
    ]
    for method, path, body in admin_paths:
        response = client.request(method, path, json=body)
        assert response.status_code in (401, 403), (
            f"{method} {path} returned {response.status_code} without auth"
        )
