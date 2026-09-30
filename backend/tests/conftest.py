"""Shared pytest setup for the unit test suite.

The integration suite (HTTP + real PostgreSQL) was removed from CI by request.
These tests deliberately avoid the app's HTTP layer and the database: they
exercise pure functions only, so they run anywhere with no services.
"""

from __future__ import annotations

import os

# Must be set before app.config is imported anywhere.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-anywhere-else-0123456789")
