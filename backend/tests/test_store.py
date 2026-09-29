"""Catalogue, cart, and the order lifecycle."""

from __future__ import annotations

from decimal import Decimal

from tests.conftest import auth_header


def test_product_list_is_public(client, seeded):
    response = client.get("/api/v1/products")
    assert response.status_code == 200
    assert len(response.json()) >= 2


def test_product_detail_and_404(client, seeded):
    listing = client.get("/api/v1/products").json()
    product_id = listing[0]["id"]
    assert client.get(f"/api/v1/products/{product_id}").status_code == 200
    assert client.get("/api/v1/products/99999999").status_code == 404


def test_categories_are_grouped(client, seeded):
    response = client.get("/api/v1/products/categories")
    assert response.status_code == 200
    assert any(row["category"] == "Tools" for row in response.json())


def test_search_treats_wildcards_literally(client, seeded):
    """'%' must not match everything, or search returns the whole catalogue."""
    assert client.get("/api/v1/products", params={"q": "%"}).json() == []
    assert client.get("/api/v1/products", params={"q": "Widget"}).json() != []


def test_add_to_cart_and_read_back(client, seeded):
    headers = auth_header(client, "cust@example.com")
    product_id = client.get("/api/v1/products").json()[0]["id"]

    response = client.post("/api/v1/cart/items", json={"product_id": product_id, "quantity": 2},
                           headers=headers)
    assert response.status_code == 201
    assert response.json()["item_count"] == 2

    assert client.get("/api/v1/cart", headers=headers).json()["item_count"] == 2


def test_adding_same_product_twice_merges_lines(client, seeded):
    headers = auth_header(client, "cust@example.com")
    product_id = client.get("/api/v1/products").json()[0]["id"]

    client.post(
        "/api/v1/cart/items", json={"product_id": product_id, "quantity": 1}, headers=headers
    )
    response = client.post("/api/v1/cart/items", json={"product_id": product_id, "quantity": 2},
                           headers=headers)
    assert response.json()["item_count"] == 3
    assert len(response.json()["items"]) == 1


def test_cart_rejects_more_than_stock(client, seeded):
    headers = auth_header(client, "cust@example.com")
    product = next(p for p in client.get("/api/v1/products").json() if p["sku"] == "T-002")
    response = client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": product["stock"] + 1},
        headers=headers,
    )
    assert response.status_code == 409


def test_carts_are_isolated_per_user(client, seeded):
    customer = auth_header(client, "cust@example.com")
    admin = auth_header(client, "admin@example.com")
    product_id = client.get("/api/v1/products").json()[0]["id"]

    client.post(
        "/api/v1/cart/items", json={"product_id": product_id, "quantity": 1}, headers=customer
    )
    assert client.get("/api/v1/cart", headers=admin).json()["items"] == []


def test_place_order_computes_totals_and_clears_cart(client, seeded):
    headers = auth_header(client, "cust@example.com")
    product = next(p for p in client.get("/api/v1/products").json() if p["sku"] == "T-001")
    client.post(
        "/api/v1/cart/items", json={"product_id": product["id"], "quantity": 2}, headers=headers
    )

    response = client.post(
        "/api/v1/orders",
        json={"shipping_address": {"name": "Cust", "line1": "1 Test St",
                                   "city": "Testville", "postcode": "12345"}},
        headers=headers,
    )
    assert response.status_code == 201
    order = response.json()

    assert order["subtotal"] == "20.00"        # 10.00 x 2
    assert order["tax"] == "1.60"              # 8%
    assert order["shipping"] == "9.99"         # under the free-shipping threshold
    assert order["total"] == "31.59"
    assert order["status"] == "pending"
    assert order["reference"].startswith("ORD-")

    assert client.get("/api/v1/cart", headers=headers).json()["items"] == []


def test_placing_an_order_decrements_stock(client, seeded):
    headers = auth_header(client, "cust@example.com")
    product = next(p for p in client.get("/api/v1/products").json() if p["sku"] == "T-001")
    before = product["stock"]

    client.post(
        "/api/v1/cart/items", json={"product_id": product["id"], "quantity": 3}, headers=headers
    )
    client.post(
        "/api/v1/orders",
        json={"shipping_address": {"name": "C", "line1": "L", "city": "C", "postcode": "1"}},
        headers=headers,
    )

    after = client.get(f"/api/v1/products/{product['id']}").json()["stock"]
    assert after == before - 3


def test_order_totals_are_exact_for_money(client, seeded):
    """0.1 + 0.2 != 0.3 in binary floating point. Decimal keeps cents honest."""
    headers = auth_header(client, "cust@example.com")
    product = next(p for p in client.get("/api/v1/products").json() if p["sku"] == "T-002")
    client.post(
        "/api/v1/cart/items", json={"product_id": product["id"], "quantity": 3}, headers=headers
    )

    order = client.post(
        "/api/v1/orders",
        json={"shipping_address": {"name": "C", "line1": "L", "city": "C", "postcode": "1"}},
        headers=headers,
    ).json()

    assert order["subtotal"] == "76.50"
    assert order["tax"] == "6.12"
    assert order["total"] == "92.61"
    assert Decimal(order["total"]) == (
        Decimal(order["subtotal"]) + Decimal(order["tax"]) + Decimal(order["shipping"])
    )


def test_empty_cart_cannot_be_ordered(client, seeded):
    headers = auth_header(client, "cust@example.com")
    response = client.post(
        "/api/v1/orders",
        json={"shipping_address": {"name": "C", "line1": "L", "city": "C", "postcode": "1"}},
        headers=headers,
    )
    assert response.status_code == 409


def test_users_only_see_their_own_orders(client, seeded):
    customer = auth_header(client, "cust@example.com")
    admin = auth_header(client, "admin@example.com")
    product_id = client.get("/api/v1/products").json()[0]["id"]
    client.post(
        "/api/v1/cart/items", json={"product_id": product_id, "quantity": 1}, headers=customer
    )
    order = client.post(
        "/api/v1/orders",
        json={"shipping_address": {"name": "C", "line1": "L", "city": "C", "postcode": "1"}},
        headers=customer,
    ).json()

    assert client.get(f"/api/v1/orders/{order['id']}", headers=customer).status_code == 200
    assert client.get(f"/api/v1/orders/{order['id']}", headers=admin).status_code == 404


def test_favorites_add_and_remove(client, seeded):
    headers = auth_header(client, "cust@example.com")
    product_id = client.get("/api/v1/products").json()[0]["id"]

    assert client.post(f"/api/v1/favorites/{product_id}", headers=headers).status_code == 201
    assert client.post(f"/api/v1/favorites/{product_id}", headers=headers).status_code == 409
    assert len(client.get("/api/v1/favorites", headers=headers).json()) == 1
    assert client.delete(f"/api/v1/favorites/{product_id}", headers=headers).status_code == 200
    assert client.get("/api/v1/favorites", headers=headers).json() == []


def test_admin_can_create_and_deactivate_a_product(client, seeded):
    admin = auth_header(client, "admin@example.com")

    created = client.post(
        "/api/v1/admin/products",
        json={"sku": "NEW-1", "name": "New Thing", "price": "12.00",
              "category": "Tools", "stock": 5},
        headers=admin,
    )
    assert created.status_code == 201
    product_id = created.json()["id"]

    assert client.post(
        "/api/v1/admin/products",
        json={"sku": "NEW-1", "name": "Dup", "price": "1.00", "category": "Tools"},
        headers=admin,
    ).status_code == 409

    assert client.delete(f"/api/v1/admin/products/{product_id}", headers=admin).status_code == 200
    # Soft-deleted: hidden from the public catalogue, still in the admin list.
    assert client.get(f"/api/v1/products/{product_id}").status_code == 404
    assert any(
        p["id"] == product_id for p in client.get("/api/v1/admin/products", headers=admin).json()
    )


def test_cancelling_an_order_restores_stock(client, seeded):
    admin = auth_header(client, "admin@example.com")
    customer = auth_header(client, "cust@example.com")

    product = next(p for p in client.get("/api/v1/products").json() if p["sku"] == "T-001")
    before = product["stock"]
    client.post(
        "/api/v1/cart/items", json={"product_id": product["id"], "quantity": 4}, headers=customer
    )
    order = client.post(
        "/api/v1/orders",
        json={"shipping_address": {"name": "C", "line1": "L", "city": "C", "postcode": "1"}},
        headers=customer,
    ).json()

    response = client.put(f"/api/v1/admin/orders/{order['id']}", json={"status": "cancelled"},
                          headers=admin)
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"

    after = client.get(f"/api/v1/products/{product['id']}").json()["stock"]
    assert after == before
