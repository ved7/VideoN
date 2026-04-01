from __future__ import annotations

import datetime as dt
import math
import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.annotation import Annotation, AnnotationOrigin, AnnotationType
from app.models.video import Video, VideoSourceType, VideoStatus
from app.schemas.annotation import AnnotationCreate, AnnotationRead, AnnotationUpdate, IntervalSlotRequest, IntervalSlotResponse
from app.schemas.video import (
    MultipartUploadCompleteRequest,
    MultipartUploadInitiateRequest,
    MultipartUploadInitiateResponse,
    MultipartUploadPartRequest,
    MultipartUploadPartUrlResponse,
    PublicUrlImportRequest,
    SummaryResponse,
    VideoDetail,
    VideoListItem,
)
from app.services.health import run_readiness_checks
from app.services.storage import storage_service
from app.services.summary import build_summary, build_summary_fingerprint
from app.services.video_processing import extract_frame
from app.tasks.video_tasks import import_video_from_public_url, process_uploaded_video

router = APIRouter()


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def normalize_tags(tags: list[str] | None) -> list[str]:
    if not tags:
        return []

    normalized: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        cleaned = " ".join(tag.strip().split())
        if not cleaned:
            continue
        lowered = cleaned.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        normalized.append(lowered)
        if len(normalized) == 12:
            break
    return normalized


def serialize_tags(tags: list[str] | None) -> str:
    return "\n".join(normalize_tags(tags))


def parse_tags(raw_tags: str | None) -> list[str]:
    if not raw_tags:
        return []
    return [tag for tag in normalize_tags(raw_tags.splitlines()) if tag]


def get_video_or_404(db: Session, video_id: UUID, include_annotations: bool = False) -> Video:
    query = select(Video).where(Video.id == video_id)
    if include_annotations:
        query = query.options(selectinload(Video.annotations))
    video = db.scalar(query)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    return video


def ensure_annotation_snapshot(video: Video, annotation: Annotation) -> str | None:
    if annotation.is_placeholder or not video.storage_key:
        return None

    snapshot_key = storage_service.build_annotation_snapshot_key(str(video.id), str(annotation.id))
    if storage_service.object_exists(snapshot_key):
        return storage_service.generate_download_url(snapshot_key)

    try:
        source_url = storage_service.generate_internal_download_url(video.storage_key)
        with tempfile.TemporaryDirectory() as temp_dir:
            local_snapshot_path = str(Path(temp_dir) / f"{annotation.id}.jpg")
            if not extract_frame(source_url, local_snapshot_path, annotation.timestamp_seconds):
                return None
            storage_service.upload_file(local_snapshot_path, snapshot_key, "image/jpeg")
        return storage_service.generate_download_url(snapshot_key)
    except Exception:  # pragma: no cover - snapshot generation should not break API reads/writes
        return None


def serialize_annotation(annotation: Annotation, video: Video) -> AnnotationRead:
    return AnnotationRead(
        id=annotation.id,
        video_id=annotation.video_id,
        annotation_type=annotation.annotation_type,
        origin=annotation.origin,
        timestamp_seconds=annotation.timestamp_seconds,
        frame_number=annotation.frame_number,
        snapshot_url=ensure_annotation_snapshot(video, annotation),
        note=annotation.note,
        tags=parse_tags(annotation.tags),
        is_placeholder=annotation.is_placeholder,
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
    )


def serialize_video_detail(video: Video) -> VideoDetail:
    can_stream = video.status in {VideoStatus.PROCESSING, VideoStatus.READY}
    playback_url = storage_service.generate_download_url(video.storage_key) if video.storage_key and can_stream else None
    poster_url = storage_service.generate_download_url(video.poster_key) if video.poster_key else None
    return VideoDetail(
        id=video.id,
        name=video.name,
        source_type=video.source_type,
        status=video.status,
        duration_seconds=video.duration_seconds,
        size_bytes=video.size_bytes,
        created_at=video.created_at,
        uploaded_at=video.uploaded_at,
        summary=video.summary,
        failure_reason=video.failure_reason,
        fps=video.fps,
        total_frames=video.total_frames,
        playback_url=playback_url,
        poster_url=poster_url,
        annotations=[serialize_annotation(annotation, video) for annotation in sorted(video.annotations, key=lambda item: item.timestamp_seconds)],
    )


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def readiness_check() -> dict[str, object]:
    result = run_readiness_checks()
    if result.status != "ok":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": result.status, "checks": result.checks},
        )
    return {"status": result.status, "checks": result.checks}


@router.get("/videos", response_model=list[VideoListItem])
def list_videos(db: Session = Depends(get_db)) -> list[Video]:
    return list(db.scalars(select(Video).order_by(Video.created_at.desc())))


@router.post("/videos/uploads/initiate", response_model=MultipartUploadInitiateResponse, status_code=status.HTTP_201_CREATED)
def initiate_multipart_upload(payload: MultipartUploadInitiateRequest, db: Session = Depends(get_db)) -> MultipartUploadInitiateResponse:
    video = Video(
        name=payload.file_name,
        source_type=VideoSourceType.LOCAL_UPLOAD,
        status=VideoStatus.UPLOADING,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
    )
    db.add(video)
    db.flush()
    storage_key = storage_service.build_video_key(str(video.id), payload.file_name)
    upload_id = storage_service.initiate_multipart_upload(storage_key, payload.content_type)
    video.storage_key = storage_key
    video.multipart_upload_id = upload_id
    db.add(video)
    db.commit()
    return MultipartUploadInitiateResponse(
        video_id=video.id,
        upload_id=upload_id,
        storage_key=storage_key,
        part_size_bytes=storage_service.transfer_config.multipart_chunksize,
    )


@router.post("/videos/{video_id}/uploads/part-url", response_model=MultipartUploadPartUrlResponse)
def get_upload_part_url(video_id: UUID, payload: MultipartUploadPartRequest, db: Session = Depends(get_db)) -> MultipartUploadPartUrlResponse:
    video = get_video_or_404(db, video_id)
    if video.multipart_upload_id != payload.upload_id or not video.storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload session is not valid anymore")
    url = storage_service.generate_upload_part_url(video.storage_key, payload.upload_id, payload.part_number)
    return MultipartUploadPartUrlResponse(url=url)


@router.post("/videos/{video_id}/uploads/complete", response_model=VideoDetail)
def complete_multipart_upload(video_id: UUID, payload: MultipartUploadCompleteRequest, db: Session = Depends(get_db)) -> VideoDetail:
    video = get_video_or_404(db, video_id, include_annotations=True)
    if video.multipart_upload_id != payload.upload_id or not video.storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload session is not valid anymore")
    storage_service.complete_multipart_upload(
        video.storage_key,
        payload.upload_id,
        [{"ETag": part.etag, "PartNumber": part.part_number} for part in payload.parts],
    )
    video.multipart_upload_id = None
    video.uploaded_at = utc_now()
    video.status = VideoStatus.PROCESSING
    video.failure_reason = None
    db.add(video)
    db.commit()
    db.refresh(video)
    process_uploaded_video.delay(str(video.id))
    return serialize_video_detail(video)


@router.delete("/videos/{video_id}/uploads")
def abort_multipart_upload(video_id: UUID, db: Session = Depends(get_db)) -> Response:
    video = get_video_or_404(db, video_id)
    if video.storage_key and video.multipart_upload_id:
        storage_service.abort_multipart_upload(video.storage_key, video.multipart_upload_id)
    db.delete(video)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/videos/import-url", response_model=VideoDetail, status_code=status.HTTP_201_CREATED)
def import_video_from_url(payload: PublicUrlImportRequest, db: Session = Depends(get_db)) -> VideoDetail:
    fallback_name = storage_service.derive_filename_from_url(str(payload.source_url))
    video = Video(
        name=payload.name or fallback_name,
        source_type=VideoSourceType.PUBLIC_URL,
        status=VideoStatus.PROCESSING,
        source_url=str(payload.source_url),
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    import_video_from_public_url.delay(str(video.id), str(payload.source_url))
    return serialize_video_detail(video)


@router.get("/videos/{video_id}", response_model=VideoDetail)
def get_video(video_id: UUID, db: Session = Depends(get_db)) -> VideoDetail:
    video = get_video_or_404(db, video_id, include_annotations=True)
    return serialize_video_detail(video)


@router.delete("/videos/{video_id}")
def delete_video(video_id: UUID, db: Session = Depends(get_db)) -> Response:
    video = get_video_or_404(db, video_id, include_annotations=True)

    if video.storage_key and video.multipart_upload_id:
        storage_service.abort_multipart_upload(video.storage_key, video.multipart_upload_id)

    # Each video owns a dedicated storage prefix, so clearing it removes the
    # source file, poster, and generated annotation snapshots together.
    storage_service.delete_prefix(f"videos/{video.id}/")

    db.delete(video)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/videos/{video_id}/annotations", response_model=AnnotationRead, status_code=status.HTTP_201_CREATED)
def create_annotation(video_id: UUID, payload: AnnotationCreate, db: Session = Depends(get_db)) -> AnnotationRead:
    video = get_video_or_404(db, video_id)
    frame_number = payload.frame_number
    if payload.annotation_type == AnnotationType.FRAME and frame_number is None:
        if not video.fps:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Frame annotations require video FPS metadata or an explicit frame number",
            )
        frame_number = max(0, math.floor(payload.timestamp_seconds * video.fps))

    annotation = Annotation(
        video_id=video.id,
        annotation_type=payload.annotation_type,
        origin=payload.origin,
        timestamp_seconds=payload.timestamp_seconds,
        frame_number=frame_number,
        note=payload.note,
        tags=serialize_tags(payload.tags),
        is_placeholder=payload.is_placeholder,
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return serialize_annotation(annotation, video)


@router.patch("/annotations/{annotation_id}", response_model=AnnotationRead)
def update_annotation(annotation_id: UUID, payload: AnnotationUpdate, db: Session = Depends(get_db)) -> AnnotationRead:
    annotation = db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")

    video = get_video_or_404(db, annotation.video_id)

    if payload.note is not None:
        annotation.note = payload.note
    if payload.tags is not None:
        annotation.tags = serialize_tags(payload.tags)
    if payload.timestamp_seconds is not None:
        annotation.timestamp_seconds = payload.timestamp_seconds
    if payload.frame_number is not None:
        annotation.frame_number = payload.frame_number
    if payload.is_placeholder is not None:
        annotation.is_placeholder = payload.is_placeholder

    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return serialize_annotation(annotation, video)


@router.delete("/annotations/{annotation_id}")
def delete_annotation(annotation_id: UUID, db: Session = Depends(get_db)) -> Response:
    annotation = db.get(Annotation, annotation_id)
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    db.delete(annotation)
    db.commit()
    if annotation.video_id:
        snapshot_key = storage_service.build_annotation_snapshot_key(str(annotation.video_id), str(annotation.id))
        if storage_service.object_exists(snapshot_key):
            storage_service.delete_object(snapshot_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/videos/{video_id}/annotations/intervals", response_model=IntervalSlotResponse)
def create_interval_annotations(video_id: UUID, payload: IntervalSlotRequest, db: Session = Depends(get_db)) -> IntervalSlotResponse:
    video = get_video_or_404(db, video_id, include_annotations=True)
    if not video.duration_seconds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interval annotations can only be generated once processing has finished and duration is available",
        )

    existing_timestamps = {round(annotation.timestamp_seconds, 3) for annotation in video.annotations}
    created_annotations: list[Annotation] = []
    current_second = 0.0
    while current_second <= video.duration_seconds:
        rounded = round(current_second, 3)
        if rounded not in existing_timestamps:
            frame_number = math.floor(rounded * video.fps) if video.fps else None
            created = Annotation(
                video_id=video.id,
                annotation_type=AnnotationType.TIMESTAMP,
                origin=AnnotationOrigin.INTERVAL,
                timestamp_seconds=rounded,
                frame_number=frame_number,
                note="",
                tags="",
                is_placeholder=True,
            )
            db.add(created)
            created_annotations.append(created)
            existing_timestamps.add(rounded)
        current_second += payload.interval_seconds

    db.commit()
    for annotation in created_annotations:
        db.refresh(annotation)
    return IntervalSlotResponse(
        interval_seconds=payload.interval_seconds,
        created_annotations=[serialize_annotation(annotation, video) for annotation in created_annotations],
    )


@router.post("/videos/{video_id}/summary", response_model=SummaryResponse)
def generate_summary(video_id: UUID, request: Request, db: Session = Depends(get_db)) -> SummaryResponse:
    video = get_video_or_404(db, video_id, include_annotations=True)
    session_api_key = request.headers.get("x-openai-api-key")
    sorted_annotations = sorted(video.annotations, key=lambda item: item.timestamp_seconds)
    fingerprint = build_summary_fingerprint(sorted_annotations)

    if video.summary and video.summary_fingerprint == fingerprint:
        return SummaryResponse(summary=video.summary)

    summary = build_summary(
        video,
        sorted_annotations,
        api_key=session_api_key,
    )
    video.summary = summary
    video.summary_fingerprint = fingerprint
    db.add(video)
    db.commit()
    return SummaryResponse(summary=summary)
