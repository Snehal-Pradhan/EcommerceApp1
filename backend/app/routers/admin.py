"""Admin operations. Every route here is behind the ``get_current_admin`` guard."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.deps import CurrentAdmin, DbSession, Paging
from app.models import Order, OrderStatus, Product, User
from app.schemas import (
    AdminStats,
    Message,
    OrderOut,
    OrderStatusUpdate,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])

LOW_STOCK_THRESHOLD = 5


@router.get("/stats", response_model=AdminStats)
def stats(_admin: CurrentAdmin, db: DbSession) -> AdminStats:
    total_products = db.scalar(select(func.count(Product.id))) or 0
    active_products = db.scalar(
        select(func.count(Product.id)).where(Product.is_active.is_(True))
    ) or 0
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_orders = db.scalar(select(func.count(Order.id))) or 0
    low_stock = db.scalar(
        select(func.count(Product.id)).where(
            Product.is_active.is_(True), Product.stock <= LOW_STOCK_THRESHOLD
        )
    ) or 0

    # Cancelled orders are excluded from revenue: they represent no money taken.
    revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.status != OrderStatus.CANCELLED.value
        )
    )

    by_status = dict(
        db.execute(
            select(Order.status, func.count(Order.id)).group_by(Order.status)
        ).all()
    )

    return AdminStats(
        total_products=total_products,
        active_products=active_products,
        total_users=total_users,
        total_orders=total_orders,
        revenue=Decimal(str(revenue or 0)).quantize(Decimal("0.01")),
        orders_by_status=by_status,
        low_stock_count=low_stock,
    )


# ----------------------------------------------------------------------- products
@router.get("/products", response_model=list[ProductOut])
def list_all_products(_admin: CurrentAdmin, db: DbSession, paging: Paging) -> list[Product]:
    """Includes inactive products, unlike the public catalogue."""
    stmt = select(Product).order_by(Product.id).limit(paging.limit).offset(paging.offset)
    return list(db.scalars(stmt))


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, _admin: CurrentAdmin, db: DbSession) -> Product:
    if db.scalar(select(Product).where(Product.sku == payload.sku)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists")

    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int, payload: ProductUpdate, _admin: CurrentAdmin, db: DbSession
) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", response_model=Message)
def deactivate_product(product_id: int, _admin: CurrentAdmin, db: DbSession) -> Message:
    """Soft delete. Hard-deleting a product would break the FK from historical
    order items, so products are deactivated and hidden from the catalogue."""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.is_active = False
    db.commit()
    return Message(detail=f"{product.name} is no longer listed")


# ------------------------------------------------------------------------ orders
@router.get("/orders", response_model=list[OrderOut])
def list_all_orders(_admin: CurrentAdmin, db: DbSession, paging: Paging) -> list[Order]:
    stmt = (
        select(Order)
        .options(joinedload(Order.items))
        .order_by(Order.id.desc())
        .limit(paging.limit)
        .offset(paging.offset)
    )
    return list(db.scalars(stmt).unique())


@router.put("/orders/{order_id}", response_model=OrderOut)
def update_order_status(
    order_id: int, payload: OrderStatusUpdate, _admin: CurrentAdmin, db: DbSession
) -> Order:
    order = db.scalar(
        select(Order).options(joinedload(Order.items)).where(Order.id == order_id)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    new_status = payload.status.value
    if new_status == order.status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Order is already {new_status}"
        )
    if new_status == OrderStatus.CANCELLED.value:
        # Cancelling returns the reserved stock to the catalogue.
        for item in order.items:
            if item.product_id is not None:
                product = db.get(Product, item.product_id)
                if product is not None:
                    product.stock += item.quantity

    order.status = new_status
    db.commit()
    db.refresh(order)
    return order
