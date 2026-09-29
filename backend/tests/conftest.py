"""Pytest fixtures.

Tests run against a real PostgreSQL database (a dedicated ``store_test`` one),
not SQLite. SQLite would happily accept things Postgres rejects and vice
versa, so testing on SQLite hides exactly the bugs worth catching.
"""

from __future__ import annotations

import os

# Must be set before app.config is imported anywhere.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://store:store@localhost:5432/store_test"
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-anywhere-else-0123456789")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Base as ModelsBase  # noqa: F401
from app.security import hash_password


@pytest.fixture(scope="session", autouse=True)
def _schema() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _clean_state():
    """Truncate every table after each test.

    The schema is created once per session, so without this a cart left behind
    by one test is still there in the next one. Order-dependent passes are the
    worst kind of test flake: they pass locally and fail in CI.
    """
    yield
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE order_items, orders, cart_items, favorites, "
                "products, users RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def db() -> Session:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seeded(db: Session) -> dict:
    """Insert a known admin, customer, and two products."""
    from app.models import Product, User, UserRole

    for spec in (
        ("admin@example.com", "Admin", UserRole.ADMIN.value),
        ("cust@example.com", "Customer", UserRole.CUSTOMER.value),
    ):
        email, name, role = spec
        if db.query(User).filter(User.email == email).first() is None:
            db.add(
                User(
                    email=email,
                    name=name,
                    password_hash=hash_password("Password123"),
                    role=role,
                )
            )

    if db.query(Product).count() == 0:
        db.add_all(
            [
                Product(
                    sku="T-001",
                    name="Test Widget",
                    description="A widget",
                    price=10.00,
                    category="Tools",
                    stock=100,
                ),
                Product(
                    sku="T-002",
                    name="Test Gadget",
                    description="A gadget",
                    price=25.50,
                    category="Tools",
                    stock=10,
                ),
            ]
        )
    db.commit()
    return {"admin": "admin@example.com", "customer": "cust@example.com"}


def auth_header(client: TestClient, email: str, password: str = "Password123") -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
