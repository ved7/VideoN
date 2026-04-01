from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.models.video import VideoSourceType, VideoStatus
from app.schemas.annotation import AnnotationRead


class VideoListItem(BaseModel):
    id: UUID
    name: str
    source_type: VideoSourceType
    status: VideoStatus
    duration_seconds: float | None
    size_bytes: int | None
    created_at: datetime
    uploaded_at: datetime | None
    summary: str | None
    failure_reason: str | None

    model_config = {"from_attributes": True}


class VideoDetail(VideoListItem):
    fps: float | None
    total_frames: int | None
    playback_url: str | None = None
    poster_url: str | None = None
    annotations: list[AnnotationRead]


class MultipartUploadInitiateRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="video/mp4", max_length=255)
    size_bytes: int = Field(gt=0)


class MultipartUploadInitiateResponse(BaseModel):
    video_id: UUID
    upload_id: str
    storage_key: str
    part_size_bytes: int


class MultipartUploadPartRequest(BaseModel):
    upload_id: str = Field(min_length=1)
    part_number: int = Field(ge=1, le=10_000)


class MultipartUploadPartUrlResponse(BaseModel):
    url: str


class CompletedPart(BaseModel):
    part_number: int = Field(ge=1, le=10_000)
    etag: str = Field(min_length=1)


class MultipartUploadCompleteRequest(BaseModel):
    upload_id: str = Field(min_length=1)
    parts: list[CompletedPart] = Field(min_length=1)


class PublicUrlImportRequest(BaseModel):
    source_url: HttpUrl
    name: str | None = Field(default=None, max_length=255)


class SummaryResponse(BaseModel):
    summary: str
