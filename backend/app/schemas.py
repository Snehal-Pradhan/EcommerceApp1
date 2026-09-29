"""Pydantic request/response schemas.

Response models exist so the API contract is explicit and so a column added to
a table later cannot silently start leaking through the API.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.models import OrderStatus, UserRole


def _validate_email(value: str) -> str:
    """Validate email syntax WITHOUT a DNS lookup.

    Pydantic's built-in ``EmailStr`` performs a deliverability check by default,
    which means an MX query per request. That makes the test suite slow, flaky,
    and dependent on outbound network access, and it would break in any CI
    runner without internet. Syntax validation is what an application needs.
    """
    try:
        validate_email(value, check_deliverability=False)
    except EmailNotValidError as exc:
        raise ValueError(str(exc)) from exc
    return value.strip().lower()


Email = Annotated[str, AfterValidator(_validate_email)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- auth
class SignupRequest(BaseModel):
    email: Email
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_not_trivial(cls, v: str) -> str:
        if v.isdigit() or v.isalpha():
            raise ValueError("password must mix letters and numbers")
        return v


class LoginRequest(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=72)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(ORMModel):
    id: int
    email: Email
    name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 - OAuth literal, not a secret
    expires_in: int


# ----------------------------------------------------------------------- catalog
class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    category: str = Field(min_length=1, max_length=80)
    image_url: str | None = Field(default=None, max_length=500)
    stock: int = Field(default=0, ge=0)


class ProductCreate(ProductBase):
    sku: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9._-]+$")


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    image_url: str | None = Field(default=None, max_length=500)
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductOut(ORMModel):
    id: int
    sku: str
    name: str
    description: str
    price: Decimal
    category: str
    image_url: str | None
    stock: int
    is_active: bool
    created_at: datetime


class CategoryOut(BaseModel):
    category: str
    product_count: int


# --------------------------------------------------------------------------- cart
class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=99)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=99)


class CartItemOut(ORMModel):
    id: int
    product_id: int
    name: str
    price: Decimal
    image_url: str | None
    quantity: int
    line_total: Decimal
    stock: int


class CartOut(BaseModel):
    items: list[CartItemOut]
    subtotal: Decimal
    item_count: int


# ------------------------------------------------------------------------- orders
class ShippingAddress(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    line1: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=80)
    postcode: str = Field(min_length=1, max_length=20)
    country: str = Field(default="US", min_length=2, max_length=80)


class OrderCreate(BaseModel):
    shipping_address: ShippingAddress


class OrderItemOut(ORMModel):
    id: int
    product_id: int | None
    name: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal


class OrderOut(ORMModel):
    id: int
    reference: str
    user_id: int
    status: OrderStatus
    subtotal: Decimal
    tax: Decimal
    shipping_cost: Decimal = Field(validation_alias="shipping", serialization_alias="shipping")
    total: Decimal
    shipping_name: str
    shipping_line1: str
    shipping_city: str
    shipping_postcode: str
    shipping_country: str
    created_at: datetime
    items: list[OrderItemOut]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ---------------------------------------------------------------------- favorites
class FavoriteOut(ORMModel):
    id: int
    product_id: int
    created_at: datetime
    product: ProductOut


# ------------------------------------------------------------------------- admin
class AdminStats(BaseModel):
    total_products: int
    active_products: int
    total_users: int
    total_orders: int
    revenue: Decimal
    orders_by_status: dict[str, int]
    low_stock_count: int


class Message(BaseModel):
    detail: str
