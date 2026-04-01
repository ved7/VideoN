from __future__ import annotations

import datetime as dt
import subprocess
import tempfile
from pathlib import Path
from uuid import UUID

import requests
from botocore.exceptions import BotoCoreError, ClientError
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.video import Video, VideoStatus
from app.services.storage import storage_service
from app.services.video_processing import extract_poster, probe_video
from app.tasks.celery_app import celery_app

settings = get_settings()

RETRYABLE_TASK_EXCEPTIONS = (requests.RequestException, BotoCoreError, ClientError, subprocess.TimeoutExpired)


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _build_http_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=settings.http_retry_max_attempts,
        read=settings.http_retry_max_attempts,
        connect=settings.http_retry_max_attempts,
        backoff_factor=0.5,
        allowed_methods=frozenset({"GET", "HEAD"}),
        status_forcelist=(408, 429, 500, 502, 503, 504),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def _mark_video_failed(video_id: UUID, reason: str) -> None:
    with SessionLocal() as db:
        video = db.get(Video, video_id)
        if not video:
            return
        video.status = VideoStatus.FAILED
        video.failure_reason = reason
        db.add(video)
        db.commit()


@celery_app.task(bind=True, max_retries=3, name="video_tasks.process_uploaded_video")
def process_uploaded_video(self, video_id: str) -> None:
    parsed_id = UUID(video_id)
    with SessionLocal() as db:
        video = db.get(Video, parsed_id)
        if not video or not video.storage_key:
            return
        video.status = VideoStatus.PROCESSING
        video.failure_reason = None
        db.add(video)
        db.commit()

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            local_video_path = str(Path(temp_dir) / "video")
            local_poster_path = str(Path(temp_dir) / "poster.jpg")
            storage_service.download_file(video.storage_key, local_video_path)
            metadata = probe_video(local_video_path)
            poster_key = None
            if extract_poster(local_video_path, local_poster_path):
                poster_key = storage_service.build_poster_key(video_id)
                storage_service.upload_file(local_poster_path, poster_key, "image/jpeg")

        with SessionLocal() as db:
            video = db.get(Video, parsed_id)
            if not video:
                return
            video.duration_seconds = metadata.duration_seconds
            video.fps = metadata.fps
            video.total_frames = metadata.total_frames
            video.poster_key = poster_key
            video.status = VideoStatus.READY
            video.failure_reason = None
            db.add(video)
            db.commit()
    except RETRYABLE_TASK_EXCEPTIONS as exc:  # pragma: no cover - defensive operational boundary
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=min(60, 5 * (2 ** self.request.retries)))
        _mark_video_failed(parsed_id, str(exc))
    except Exception as exc:  # pragma: no cover - defensive operational boundary
        _mark_video_failed(parsed_id, str(exc))


@celery_app.task(bind=True, max_retries=3, name="video_tasks.import_video_from_public_url")
def import_video_from_public_url(self, video_id: str, source_url: str) -> None:
    parsed_id = UUID(video_id)
    with SessionLocal() as db:
        video = db.get(Video, parsed_id)
        if not video:
            return
        try:
            file_name = video.name or storage_service.derive_filename_from_url(source_url)
            content_type = storage_service.infer_content_type(file_name, "video/mp4")
            key = storage_service.build_video_key(video_id, file_name)
            with _build_http_session() as session:
                with session.get(
                    source_url,
                    stream=True,
                    timeout=(settings.http_connect_timeout_seconds, settings.http_read_timeout_seconds),
                ) as response:
                    response.raise_for_status()
                    response.raw.decode_content = True
                    storage_service.upload_stream(response.raw, key, content_type)
                    size_header = response.headers.get("content-length")
            video.storage_key = key
            video.content_type = content_type
            video.size_bytes = int(size_header) if size_header and size_header.isdigit() else video.size_bytes
            video.status = VideoStatus.PROCESSING
            video.failure_reason = None
            video.uploaded_at = utc_now()
            db.add(video)
            db.commit()
        except RETRYABLE_TASK_EXCEPTIONS as exc:  # pragma: no cover - network/storage failure path
            db.rollback()
            if self.request.retries < self.max_retries:
                raise self.retry(exc=exc, countdown=min(60, 5 * (2 ** self.request.retries)))
            video.status = VideoStatus.FAILED
            video.failure_reason = str(exc)
            db.add(video)
            db.commit()
            return
        except Exception as exc:  # pragma: no cover - network/storage failure path
            db.rollback()
            video.status = VideoStatus.FAILED
            video.failure_reason = str(exc)
            db.add(video)
            db.commit()
            return

    process_uploaded_video.delay(video_id)
