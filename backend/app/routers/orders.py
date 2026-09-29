"""Order placement and history.

Placing an order runs inside a single database transaction with the cart rows
locked ``FOR UPDATE``. Without the lock, two concurrent checkouts can both read
the same cart, both succeed, and oversell the stock they just "reserved".
"""

from __future__ import annotations

import secrets
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.deps import CurrentUser, DbSession
from app.models import CartItem, Order, OrderItem, OrderStatus
from app.schemas import OrderCreate, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])

TAX_RATE = Decimal("0.08")
SHIPPING_FLAT = Decimal("9.99")
FREE_SHIPPING_THRESHOLD = Decimal("100.00")


def _load(user_id: int, order_id: int, db: DbSession) -> Order:
    order = db.scalar(
        select(Order)
        .options(joinedload(Order.items))
        .where(Order.id == order_id, Order.user_id == user_id)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def place_order(payload: OrderCreate, user: CurrentUser, db: DbSession) -> Order:
    cart_items = list(
        db.scalars(
            select(CartItem)
            .where(CartItem.user_id == user.id)
            # Lock only the cart rows. The `of=` clause is required because
            # CartItem.product uses eager loading, which adds an outer join, and
            # PostgreSQL refuses FOR UPDATE on the nullable side of one.
            .with_for_update(of=CartItem)
        )
    )
    if not cart_items:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Your cart is empty")

    subtotal = Decimal("0.00")
    for item in cart_items:
        if item.product.stock < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"'{item.product.name}' only has {item.product.stock} left",
            )
        subtotal += item.product.price * item.quantity

    subtotal = subtotal.quantize(Decimal("0.01"))
    tax = (subtotal * TAX_RATE).quantize(Decimal("0.01"))
    shipping = (
        Decimal("0.00") if subtotal >= FREE_SHIPPING_THRESHOLD else SHIPPING_FLAT
    )
    total = (subtotal + tax + shipping).quantize(Decimal("0.01"))

    order = Order(
        reference=f"ORD-{secrets.token_hex(4).upper()}",
        user_id=user.id,
        status=OrderStatus.PENDING.value,
        subtotal=subtotal,
        tax=tax,
        shipping=shipping,
        total=total,
        shipping_name=payload.shipping_address.name,
        shipping_line1=payload.shipping_address.line1,
        shipping_city=payload.shipping_address.city,
        shipping_postcode=payload.shipping_address.postcode,
        shipping_country=payload.shipping_address.country,
    )
    db.add(order)
    db.flush()  # assign order.id before writing children

    for item in cart_items:
        product = item.product
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                name=product.name,               # snapshot: orders are history
                unit_price=product.price,        # and must not follow repricing
                quantity=item.quantity,
                line_total=(product.price * item.quantity).quantize(Decimal("0.01")),
            )
        )
        product.stock -= item.quantity
        db.delete(item)

    db.commit()
    return _load(user.id, order.id, db)


@router.get("", response_model=list[OrderOut])
def list_orders(user: CurrentUser, db: DbSession) -> list[Order]:
    stmt = (
        select(Order)
        .options(joinedload(Order.items))
        .where(Order.user_id == user.id)
        .order_by(Order.id.desc())
    )
    return list(db.scalars(stmt).unique())


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, user: CurrentUser, db: DbSession) -> Order:
    return _load(user.id, order_id, db)
