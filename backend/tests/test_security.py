"""Unit tests for password hashing and JWT helpers.

No database, no HTTP client: these exercise app.security directly.
"""

from __future__ import annotations

import jwt
import pytest

from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password_roundtrip():
    hashed = hash_password("Password123")
    assert hashed != "Password123"
    assert verify_password("Password123", hashed)
    assert not verify_password("WrongPassword", hashed)


def test_hash_password_rejects_long_passwords():
    with pytest.raises(ValueError):
        hash_password("x" * 73)


def test_verify_password_rejects_garbage_hash():
    assert verify_password("Password123", "not-a-hash") is False


def test_access_token_decodes_with_subject_and_role():
    token = create_access_token(user_id=42, role="admin")
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["role"] == "admin"
    assert payload["type"] == "access"


def test_refresh_token_cannot_be_used_as_access_token():
    token = create_refresh_token(user_id=42)
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(token, expected_type="access")


def test_decode_token_rejects_garbage():
    with pytest.raises(jwt.PyJWTError):
        decode_token("garbage.token.value")
