"""Favourites: a user's saved products."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.deps import CurrentUser, DbSession
from app.models import Favorite, Product
from app.schemas import FavoriteOut, Message

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteOut])
def list_favorites(user: CurrentUser, db: DbSession) -> list[Favorite]:
    stmt = (
        select(Favorite)
        .where(Favorite.user_id == user.id)
        .order_by(Favorite.id.desc())
    )
    return list(db.scalars(stmt))


@router.post("/{product_id}", response_model=FavoriteOut, status_code=status.HTTP_201_CREATED)
def add_favorite(product_id: int, user: CurrentUser, db: DbSession) -> Favorite:
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    favorite = Favorite(user_id=user.id, product_id=product_id)
    db.add(favorite)
    try:
        db.commit()
    except IntegrityError:
        # The unique constraint is the source of truth; two rapid clicks race.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Already in favourites"
        ) from None
    db.refresh(favorite)
    return favorite


@router.delete("/{product_id}", response_model=Message)
def remove_favorite(product_id: int, user: CurrentUser, db: DbSession) -> Message:
    favorite = db.scalar(
        select(Favorite).where(
            Favorite.user_id == user.id, Favorite.product_id == product_id
        )
    )
    if favorite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in favourites")
    db.delete(favorite)
    db.commit()
    return Message(detail="Removed from favourites")
