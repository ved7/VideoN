from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.annotation import AnnotationOrigin, AnnotationType


class AnnotationRead(BaseModel):
    id: UUID
    video_id: UUID
    annotation_type: AnnotationType
    origin: AnnotationOrigin
    timestamp_seconds: float
    frame_number: int | None
    snapshot_url: str | None = None
    note: str
    tags: list[str] = Field(default_factory=list)
    is_placeholder: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnnotationCreate(BaseModel):
    annotation_type: AnnotationType
    timestamp_seconds: float = Field(ge=0)
    frame_number: int | None = Field(default=None, ge=0)
    note: str = Field(default="", max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=12)
    origin: AnnotationOrigin = AnnotationOrigin.MANUAL
    is_placeholder: bool = False


class AnnotationUpdate(BaseModel):
    note: str | None = Field(default=None, max_length=4000)
    tags: list[str] | None = Field(default=None, max_length=12)
    timestamp_seconds: float | None = Field(default=None, ge=0)
    frame_number: int | None = Field(default=None, ge=0)
    is_placeholder: bool | None = None


class IntervalSlotRequest(BaseModel):
    interval_seconds: float = Field(gt=0, le=600)


class IntervalSlotResponse(BaseModel):
    interval_seconds: float
    created_annotations: list[AnnotationRead]


AnnotationKind = Literal["TIMESTAMP", "FRAME"]
