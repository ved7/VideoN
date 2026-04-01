from __future__ import annotations

import datetime as dt
import uuid
from enum import Enum

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, Float, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class VideoStatus(str, Enum):
    UPLOADING = "UPLOADING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class VideoSourceType(str, Enum):
    LOCAL_UPLOAD = "LOCAL_UPLOAD"
    PUBLIC_URL = "PUBLIC_URL"


class Video(Base):
    __tablename__ = "videos"
    __table_args__ = (
        Index("ix_videos_created_at", "created_at"),
        Index("ix_videos_status_created_at", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[VideoSourceType] = mapped_column(SqlEnum(VideoSourceType, name="video_source_type"))
    status: Mapped[VideoStatus] = mapped_column(SqlEnum(VideoStatus, name="video_status"), default=VideoStatus.UPLOADING)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    multipart_upload_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_frames: Mapped[int | None] = mapped_column(nullable=True)
    poster_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    annotations = relationship(
        "Annotation",
        back_populates="video",
        cascade="all, delete-orphan",
        order_by="Annotation.timestamp_seconds",
    )
