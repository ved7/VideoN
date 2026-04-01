from __future__ import annotations

from dataclasses import dataclass

import redis
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine
from app.services.storage import storage_service

settings = get_settings()


@dataclass(slots=True)
class HealthCheckResult:
    status: str
    checks: dict[str, str]


def check_database() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def check_redis() -> None:
    client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=5, socket_timeout=5)
    try:
        client.ping()
    finally:
        client.close()


def check_storage() -> None:
    if not storage_service.bucket_exists():
        raise RuntimeError(f"S3 bucket '{settings.s3_bucket_name}' is not reachable")


def run_readiness_checks() -> HealthCheckResult:
    checks: dict[str, str] = {}
    failures = False

    for name, checker in (
        ("database", check_database),
        ("redis", check_redis),
        ("storage", check_storage),
    ):
        try:
            checker()
            checks[name] = "ok"
        except Exception as exc:  # pragma: no cover - defensive health boundary
            checks[name] = f"error: {exc}"
            failures = True

    return HealthCheckResult(status="error" if failures else "ok", checks=checks)
