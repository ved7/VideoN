from __future__ import annotations

import json
import math
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


@dataclass(slots=True)
class VideoMetadata:
    duration_seconds: float | None
    fps: float | None
    total_frames: int | None


def parse_frame_rate(rate: str | None) -> float | None:
    if not rate or rate in {"0/0", "N/A"}:
        return None
    if "/" in rate:
        numerator, denominator = rate.split("/", maxsplit=1)
        if float(denominator) == 0:
            return None
        return float(numerator) / float(denominator)
    return float(rate)


def probe_video(path: str) -> VideoMetadata:
    result = subprocess.run(
        [
            settings.ffprobe_bin,
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-print_format",
            "json",
            path,
        ],
        capture_output=True,
        text=True,
        check=True,
        timeout=settings.ffprobe_timeout_seconds,
    )
    payload = json.loads(result.stdout)
    streams = payload.get("streams", [])
    video_stream = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
    duration = payload.get("format", {}).get("duration") or video_stream.get("duration")
    duration_seconds = float(duration) if duration else None
    fps = parse_frame_rate(video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate"))
    frame_count = video_stream.get("nb_frames")
    if frame_count and str(frame_count).isdigit():
        total_frames = int(frame_count)
    elif duration_seconds and fps:
        total_frames = math.floor(duration_seconds * fps)
    else:
        total_frames = None
    return VideoMetadata(duration_seconds=duration_seconds, fps=fps, total_frames=total_frames)


def extract_poster(video_path: str, output_path: str) -> bool:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            settings.ffmpeg_bin,
            "-y",
            "-ss",
            "00:00:01.000",
            "-i",
            video_path,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            output_path,
        ],
        capture_output=True,
        text=True,
        timeout=settings.ffmpeg_timeout_seconds,
    )
    return result.returncode == 0


def extract_frame(source: str, output_path: str, timestamp_seconds: float) -> bool:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    safe_timestamp = max(timestamp_seconds, 0)
    result = subprocess.run(
        [
            settings.ffmpeg_bin,
            "-y",
            "-ss",
            f"{safe_timestamp:.3f}",
            "-i",
            source,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            output_path,
        ],
        capture_output=True,
        text=True,
        timeout=settings.ffmpeg_timeout_seconds,
    )
    if result.returncode == 0:
        return True

    if safe_timestamp <= 0.15:
        return False

    retry_result = subprocess.run(
        [
            settings.ffmpeg_bin,
            "-y",
            "-ss",
            f"{max(safe_timestamp - 0.15, 0):.3f}",
            "-i",
            source,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            output_path,
        ],
        capture_output=True,
        text=True,
        timeout=settings.ffmpeg_timeout_seconds,
    )
    return retry_result.returncode == 0
