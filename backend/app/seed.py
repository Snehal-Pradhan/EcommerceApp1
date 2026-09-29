"""Deterministic seed data for local development and tests.

Idempotent: running it twice does not duplicate rows. Passwords for the demo
accounts are fixed and deliberately obvious, because these accounts exist only
in local/test data and must never be seeded into a real environment.
"""

from __future__ import annotations

import argparse
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal, create_all
from app.models import Product, User, UserRole
from app.security import hash_password

DEMO_PASSWORD = "Password123"

PRODUCTS: list[dict] = [
    {
        "sku": "ELEC-1001",
        "name": "Wireless Headphones",
        "description": "Over-ear headphones with active noise cancellation and 30-hour battery.",
        "price": Decimal("99.99"),
        "category": "Electronics",
        "stock": 50,
        "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
    },
    {
        "sku": "ELEC-1002",
        "name": "Smart Watch",
        "description": "Fitness tracking watch with heart-rate sensing and GPS.",
        "price": Decimal("199.99"),
        "category": "Electronics",
        "stock": 30,
        "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600",
    },
    {
        "sku": "CLTH-2001",
        "name": "Canvas Backpack",
        "description": "Durable 20L canvas backpack for commuting and day trips.",
        "price": Decimal("45.99"),
        "category": "Clothing",
        "stock": 25,
        "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600",
    },
    {
        "sku": "CLTH-2002",
        "name": "Cotton Tote Bag",
        "description": "Heavyweight organic cotton tote, reinforced handles.",
        "price": Decimal("18.50"),
        "category": "Clothing",
        "stock": 80,
        "image_url": "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=600",
    },
    {
        "sku": "SPORT-3001",
        "name": "Running Shoes",
        "description": "Neutral-cushion running shoes with a breathable engineered mesh.",
        "price": Decimal("129.99"),
        "category": "Sports",
        "stock": 40,
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
    },
    {
        "sku": "SPORT-3002",
        "name": "Yoga Mat",
        "description": "6mm non-slip natural rubber mat.",
        "price": Decimal("29.99"),
        "category": "Sports",
        "stock": 60,
        "image_url": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600",
    },
    {
        "sku": "HOME-4001",
        "name": "Pour-Over Coffee Maker",
        "description": "Borosilicate glass carafe with a stainless steel filter.",
        "price": Decimal("34.00"),
        "category": "Home & Kitchen",
        "stock": 4,
        "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600",
    },
    {
        "sku": "HOME-4002",
        "name": "Ceramic Mug Set",
        "description": "Set of four 350ml stoneware mugs, dishwasher safe.",
        "price": Decimal("42.00"),
        "category": "Home & Kitchen",
        "stock": 55,
        "image_url": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600",
    },
    {
        "sku": "ELEC-1003",
        "name": "Bluetooth Speaker",
        "description": "Rugged portable speaker with 360-degree sound.",
        "price": Decimal("59.99"),
        "category": "Electronics",
        "stock": 35,
        "image_url": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600",
    },
    {
        "sku": "ELEC-1004",
        "name": "Laptop Stand",
        "description": "Adjustable aluminium stand, folds flat.",
        "price": Decimal("39.99"),
        "category": "Electronics",
        "stock": 20,
        "image_url": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600",
    },
    {
        "sku": "HOME-4003",
        "name": "Cast Iron Skillet",
        "description": "26cm pre-seasoned cast iron pan.",
        "price": Decimal("49.00"),
        "category": "Home & Kitchen",
        "stock": 22,
        "image_url": "https://images.unsplash.com/photo-1584990347449-a9d0ec2b1e0e?w=600",
    },
    {
        "sku": "CLTH-2003",
        "name": "Merino Wool Socks",
        "description": "Cushioned crew socks, three pairs.",
        "price": Decimal("28.00"),
        "category": "Clothing",
        "stock": 70,
        "image_url": "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=600",
    },
]

USERS: list[dict] = [
    {
        "email": "admin@example.com",
        "name": "Store Admin",
        "password": DEMO_PASSWORD,
        "role": UserRole.ADMIN.value,
    },
    {
        "email": "customer@example.com",
        "name": "Test Customer",
        "password": DEMO_PASSWORD,
        "role": UserRole.CUSTOMER.value,
    },
]


def seed(db: Session) -> dict[str, int]:
    created_users = 0
    created_products = 0

    for spec in USERS:
        exists = db.scalar(select(User).where(User.email == spec["email"]))
        if exists is None:
            db.add(
                User(
                    email=spec["email"],
                    name=spec["name"],
                    password_hash=hash_password(spec["password"]),
                    role=spec["role"],
                )
            )
            created_users += 1

    for spec in PRODUCTS:
        exists = db.scalar(select(Product).where(Product.sku == spec["sku"]))
        if exists is None:
            db.add(Product(**spec))
            created_products += 1

    db.commit()
    return {
        "users_created": created_users,
        "products_created": created_products,
        "users_total": db.scalar(select(func.count(User.id))) or 0,
        "products_total": db.scalar(select(func.count(Product.id))) or 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the database with demo data")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop all tables first. Destroys every row.",
    )
    args = parser.parse_args()

    if args.reset:
        from app.database import Base, engine

        print("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)

    create_all()
    with SessionLocal() as db:
        summary = seed(db)

    print("Seed complete:")
    for key, value in summary.items():
        print(f"  {key}: {value}")
    print(f"\n  admin    -> admin@example.com / {DEMO_PASSWORD}")
    print(f"  customer -> customer@example.com / {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
