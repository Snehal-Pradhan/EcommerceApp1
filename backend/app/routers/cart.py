"""Shopping cart, owned by the authenticated user."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import CartItem, Product, User
from app.schemas import CartItemCreate, CartItemOut, CartItemUpdate, CartOut

router = APIRouter(prefix="/cart", tags=["cart"])


def _to_out(item: CartItem) -> CartItemOut:
    price = item.product.price
    return CartItemOut(
        id=item.id,
        product_id=item.product_id,
        name=item.product.name,
        price=price,
        image_url=item.product.image_url,
        quantity=item.quantity,
        line_total=(price * item.quantity).quantize(Decimal("0.01")),
        stock=item.product.stock,
    )


def _cart_for(user: User, db: DbSession) -> CartOut:
    stmt = select(CartItem).where(CartItem.user_id == user.id).order_by(CartItem.id)
    items = list(db.scalars(stmt))
    outs = [_to_out(i) for i in items]
    subtotal = sum((o.line_total for o in outs), start=Decimal("0.00"))
    return CartOut(
        items=outs,
        subtotal=subtotal.quantize(Decimal("0.01")),
        item_count=sum(o.quantity for o in outs),
    )


@router.get("", response_model=CartOut)
def get_cart(user: CurrentUser, db: DbSession) -> CartOut:
    return _cart_for(user, db)


@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
def add_item(payload: CartItemCreate, user: CurrentUser, db: DbSession) -> CartOut:
    product = db.get(Product, payload.product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    existing = db.scalar(
        select(CartItem).where(
            CartItem.user_id == user.id, CartItem.product_id == product.id
        )
    )

    new_quantity = payload.quantity + (existing.quantity if existing else 0)
    if new_quantity > product.stock:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only {product.stock} in stock",
        )

    if existing:
        existing.quantity = new_quantity
    else:
        db.add(CartItem(user_id=user.id, product_id=product.id, quantity=payload.quantity))

    db.commit()
    return _cart_for(user, db)


@router.put("/items/{product_id}", response_model=CartOut)
def update_item(
    product_id: int, payload: CartItemUpdate, user: CurrentUser, db: DbSession
) -> CartOut:
    item = db.scalar(
        select(CartItem).where(CartItem.user_id == user.id, CartItem.product_id == product_id)
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in your cart")

    if payload.quantity > item.product.stock:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only {item.product.stock} in stock",
        )

    item.quantity = payload.quantity
    db.commit()
    return _cart_for(user, db)


@router.delete("/items/{product_id}", response_model=CartOut)
def remove_item(product_id: int, user: CurrentUser, db: DbSession) -> CartOut:
    item = db.scalar(
        select(CartItem).where(CartItem.user_id == user.id, CartItem.product_id == product_id)
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in your cart")
    db.delete(item)
    db.commit()
    return _cart_for(user, db)


@router.delete("", response_model=CartOut)
def clear_cart(user: CurrentUser, db: DbSession) -> CartOut:
    for item in db.scalars(select(CartItem).where(CartItem.user_id == user.id)):
        db.delete(item)
    db.commit()
    return _cart_for(user, db)
