from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "VideoN"
    environment: Literal["development", "test", "staging", "production"] = "development"
    api_prefix: str = "/api"
    log_level: str = "INFO"
    database_url: str = "postgresql+psycopg://postgres:postgres@db:5432/video_annotations"
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_pool_timeout_seconds: int = 30
    database_pool_recycle_seconds: int = 1800
    database_connect_timeout_seconds: int = 10
    redis_url: str = "redis://redis:6379/0"
    s3_endpoint_url: str = "http://minio:9000"
    s3_public_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_name: str = "video-assets"
    s3_region: str = "us-east-1"
    s3_use_ssl: bool = False
    s3_force_path_style: bool = True
    s3_create_bucket_on_startup: bool | None = None
    s3_connect_timeout_seconds: int = 10
    s3_read_timeout_seconds: int = 60
    s3_max_pool_connections: int = 20
    s3_retry_max_attempts: int = 5
    upload_part_size_mb: int = 10
    presigned_url_ttl_seconds: int = 86_400
    ffmpeg_bin: str = "ffmpeg"
    ffprobe_bin: str = "ffprobe"
    ffmpeg_timeout_seconds: int = 300
    ffprobe_timeout_seconds: int = 120
    http_connect_timeout_seconds: int = 10
    http_read_timeout_seconds: int = 120
    http_retry_max_attempts: int = 3
    cors_origins: str = "http://localhost:5173"
    frontend_base_url: str = "http://localhost:5173"
    openai_api_key: str | None = None
    openai_summary_model: str = "gpt-4.1-nano"
    openai_summary_timeout_seconds: float = 8.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def upload_part_size_bytes(self) -> int:
        return self.upload_part_size_mb * 1024 * 1024

    @property
    def should_create_bucket_on_startup(self) -> bool:
        if self.s3_create_bucket_on_startup is not None:
            return self.s3_create_bucket_on_startup
        return self.environment != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
