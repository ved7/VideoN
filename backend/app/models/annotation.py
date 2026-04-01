from __future__ import annotations

import uuid
from enum import Enum

from sqlalchemy import Boolean, Enum as SqlEnum, Float, ForeignKey, Index, Integer, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AnnotationType(str, Enum):
    TIMESTAMP = "TIMESTAMP"
    FRAME = "FRAME"


class AnnotationOrigin(str, Enum):
    MANUAL = "MANUAL"
    INTERVAL = "INTERVAL"


class Annotation(Base):
    __tablename__ = "annotations"
    __table_args__ = (
        Index("ix_annotations_video_timestamp", "video_id", "timestamp_seconds"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    annotation_type: Mapped[AnnotationType] = mapped_column(SqlEnum(AnnotationType, name="annotation_type"))
    origin: Mapped[AnnotationOrigin] = mapped_column(SqlEnum(AnnotationOrigin, name="annotation_origin"), default=AnnotationOrigin.MANUAL)
    timestamp_seconds: Mapped[float] = mapped_column(Float)
    frame_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(Text, default="")
    is_placeholder: Mapped[bool] = mapped_column(Boolean, default=False)

    video = relationship("Video", back_populates="annotations")
