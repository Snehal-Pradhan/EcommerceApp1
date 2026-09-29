"""Application configuration.

All settings are environment-driven so the exact same image can run in local dev,
CI, and production. Secrets are never given a usable default in production: the
validator below refuses to boot rather than silently shipping a known key.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# A known-bad sentinel. The validator below refuses to boot production while
# this value is still in place, which is the entire point of it.
INSECURE_DEVELOPMENT_SECRET = "dev-only-insecure-secret-change-me"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Service identity -------------------------------------------------
    app_name: str = "Store API"
    environment: str = Field(default="development")
    debug: bool = Field(default=False)

    # --- HTTP -------------------------------------------------------------
    # Containers must listen on all interfaces to be reachable from outside.
    host: str = Field(default="0.0.0.0")  # noqa: S104
    port: int = Field(default=8000)

    # --- Database ---------------------------------------------------------
    # Driver is pinned explicitly to psycopg (v3). SQLAlchemy 2.x will happily
    # guess, and guessing differently between environments is how you end up
    # with "No module named psycopg2" in production only.
    database_url: str = Field(
        default="postgresql+psycopg://store:store@localhost:5432/store"
    )
    db_pool_size: int = Field(default=5)
    db_max_overflow: int = Field(default=10)
    db_echo: bool = Field(default=False)

    # --- Auth -------------------------------------------------------------
    secret_key: str = Field(default=INSECURE_DEVELOPMENT_SECRET)
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)
    refresh_token_expire_days: int = Field(default=14)

    # --- CORS -------------------------------------------------------------
    # Comma-separated in the environment. Empty means "no cross-origin access",
    # which is the correct default; the browser same-origin policy is the norm.
    cors_origins: str = Field(default="")

    # --- Redis (optional cache) ------------------------------------------
    redis_url: str = Field(default="redis://localhost:6379/0")

    # --- Uploads ----------------------------------------------------------
    upload_dir: str = Field(default="uploads")
    max_upload_bytes: int = Field(default=5 * 1024 * 1024)
    allowed_image_types: str = Field(default="image/jpeg,image/png,image/webp,image/gif")

    @model_validator(mode="after")
    def _reject_insecure_production(self) -> Settings:
        """Fail closed instead of booting with a publicly known secret."""
        if self.environment.lower() in {"production", "prod"}:
            if self.secret_key == INSECURE_DEVELOPMENT_SECRET:
                raise ValueError(
                    "SECRET_KEY is still the development placeholder. Refusing to "
                    "start in production with a known key."
                )
            if len(self.secret_key) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters in production."
                )
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def allowed_image_mime_types(self) -> set[str]:
        return {t.strip() for t in self.allowed_image_types.split(",") if t.strip()}

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
