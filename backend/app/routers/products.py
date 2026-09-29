"""Public product catalogue: browse, search, filter, and read products."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import DbSession, Paging
from app.models import Product
from app.schemas import CategoryOut, ProductOut

router = APIRouter(prefix="/products", tags=["products"])

ACTIVE = Product.is_active.is_(True)


@router.get("", response_model=list[ProductOut])
def list_products(
    db: DbSession,
    paging: Paging,
    q: str | None = Query(default=None, max_length=120, description="Free-text search"),
    category: str | None = Query(default=None, max_length=80),
) -> list[Product]:
    stmt = select(Product).where(ACTIVE)

    if q:
        # Escape LIKE metacharacters so a user searching for "100%" does not
        # accidentally match everything.
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(pattern, escape="\\"),
                Product.description.ilike(pattern, escape="\\"),
            )
        )
    if category:
        stmt = stmt.where(func.lower(Product.category) == category.lower())

    stmt = stmt.order_by(Product.id).limit(paging.limit).offset(paging.offset)
    return list(db.scalars(stmt))


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: DbSession) -> list[CategoryOut]:
    rows = db.execute(
        select(Product.category, func.count(Product.id))
        .where(ACTIVE)
        .group_by(Product.category)
        .order_by(Product.category)
    ).all()
    return [CategoryOut(category=name, product_count=count) for name, count in rows]


@router.get("/featured", response_model=list[ProductOut])
def featured(db: DbSession, limit: int = Query(default=8, ge=1, le=24)) -> list[Product]:
    stmt = select(Product).where(ACTIVE, Product.stock > 0).order_by(Product.id).limit(limit)
    return list(db.scalars(stmt))


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: DbSession) -> Product:
    product = db.get(Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product
