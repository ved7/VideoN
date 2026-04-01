from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_runtime_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "annotations" not in table_names:
        return

    annotation_columns = {column["name"] for column in inspector.get_columns("annotations")}
    if "tags" not in annotation_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE annotations ADD COLUMN tags TEXT NOT NULL DEFAULT ''"))

    if "videos" in table_names:
        video_columns = {column["name"] for column in inspector.get_columns("videos")}
        if "summary_fingerprint" not in video_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE videos ADD COLUMN summary_fingerprint VARCHAR(64)"))

        video_indexes = {index["name"] for index in inspector.get_indexes("videos")}
        with engine.begin() as connection:
            if "ix_videos_created_at" not in video_indexes:
                connection.execute(text("CREATE INDEX ix_videos_created_at ON videos (created_at)"))
            if "ix_videos_status_created_at" not in video_indexes:
                connection.execute(text("CREATE INDEX ix_videos_status_created_at ON videos (status, created_at)"))

    annotation_indexes = {index["name"] for index in inspector.get_indexes("annotations")}
    if "ix_annotations_video_timestamp" not in annotation_indexes:
        with engine.begin() as connection:
            connection.execute(text("CREATE INDEX ix_annotations_video_timestamp ON annotations (video_id, timestamp_seconds)"))
