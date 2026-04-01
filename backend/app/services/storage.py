from __future__ import annotations

import io
import mimetypes
from pathlib import Path
from typing import BinaryIO
from urllib.parse import urlparse

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError
from slugify import slugify

from app.core.config import get_settings

settings = get_settings()


class StorageService:
    def __init__(self) -> None:
        addressing_style = "path" if settings.s3_force_path_style else "virtual"
        base_kwargs = {
            "service_name": "s3",
            "region_name": settings.s3_region,
            "aws_access_key_id": settings.s3_access_key,
            "aws_secret_access_key": settings.s3_secret_key,
            "config": Config(
                signature_version="s3v4",
                connect_timeout=settings.s3_connect_timeout_seconds,
                read_timeout=settings.s3_read_timeout_seconds,
                max_pool_connections=settings.s3_max_pool_connections,
                retries={"max_attempts": settings.s3_retry_max_attempts, "mode": "standard"},
                s3={"addressing_style": addressing_style},
            ),
        }
        self.client = boto3.client(endpoint_url=settings.s3_endpoint_url, use_ssl=settings.s3_use_ssl, **base_kwargs)
        self.public_client = boto3.client(
            endpoint_url=settings.s3_public_endpoint_url,
            use_ssl=settings.s3_use_ssl,
            **base_kwargs,
        )
        self.transfer_config = TransferConfig(
            multipart_threshold=settings.upload_part_size_bytes,
            multipart_chunksize=settings.upload_part_size_bytes,
        )

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=settings.s3_bucket_name)
        except ClientError:
            create_kwargs = {"Bucket": settings.s3_bucket_name}
            if settings.s3_region != "us-east-1":
                create_kwargs["CreateBucketConfiguration"] = {"LocationConstraint": settings.s3_region}
            self.client.create_bucket(**create_kwargs)

    def bucket_exists(self) -> bool:
        try:
            self.client.head_bucket(Bucket=settings.s3_bucket_name)
        except (BotoCoreError, ClientError):
            return False
        return True

    def build_video_key(self, video_id: str, file_name: str) -> str:
        path = Path(file_name)
        stem = slugify(path.stem) or "video"
        suffix = path.suffix.lower() or ".mp4"
        return f"videos/{video_id}/{stem}{suffix}"

    def build_poster_key(self, video_id: str) -> str:
        return f"videos/{video_id}/poster.jpg"

    def build_annotation_snapshot_key(self, video_id: str, annotation_id: str) -> str:
        return f"videos/{video_id}/annotations/{annotation_id}.jpg"

    def infer_content_type(self, file_name: str, fallback: str = "application/octet-stream") -> str:
        guessed, _ = mimetypes.guess_type(file_name)
        return guessed or fallback

    def initiate_multipart_upload(self, key: str, content_type: str) -> str:
        response = self.client.create_multipart_upload(
            Bucket=settings.s3_bucket_name,
            Key=key,
            ContentType=content_type,
        )
        return response["UploadId"]

    def generate_upload_part_url(self, key: str, upload_id: str, part_number: int) -> str:
        return self.public_client.generate_presigned_url(
            ClientMethod="upload_part",
            Params={
                "Bucket": settings.s3_bucket_name,
                "Key": key,
                "UploadId": upload_id,
                "PartNumber": part_number,
            },
            ExpiresIn=settings.presigned_url_ttl_seconds,
        )

    def complete_multipart_upload(self, key: str, upload_id: str, parts: list[dict[str, str | int]]) -> None:
        self.client.complete_multipart_upload(
            Bucket=settings.s3_bucket_name,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={"Parts": sorted(parts, key=lambda part: int(part["PartNumber"]))},
        )

    def abort_multipart_upload(self, key: str, upload_id: str) -> None:
        self.client.abort_multipart_upload(
            Bucket=settings.s3_bucket_name,
            Key=key,
            UploadId=upload_id,
        )

    def generate_download_url(self, key: str) -> str:
        return self.public_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": key},
            ExpiresIn=settings.presigned_url_ttl_seconds,
        )

    def generate_internal_download_url(self, key: str) -> str:
        return self.client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": key},
            ExpiresIn=settings.presigned_url_ttl_seconds,
        )

    def object_exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=settings.s3_bucket_name, Key=key)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise
        return True

    def upload_file(self, path: str, key: str, content_type: str) -> None:
        self.client.upload_file(
            Filename=path,
            Bucket=settings.s3_bucket_name,
            Key=key,
            ExtraArgs={"ContentType": content_type},
            Config=self.transfer_config,
        )

    def upload_bytes(self, data: bytes, key: str, content_type: str) -> None:
        stream: BinaryIO = io.BytesIO(data)
        self.client.upload_fileobj(
            Fileobj=stream,
            Bucket=settings.s3_bucket_name,
            Key=key,
            ExtraArgs={"ContentType": content_type},
            Config=self.transfer_config,
        )

    def upload_stream(self, stream: BinaryIO, key: str, content_type: str) -> None:
        self.client.upload_fileobj(
            Fileobj=stream,
            Bucket=settings.s3_bucket_name,
            Key=key,
            ExtraArgs={"ContentType": content_type},
            Config=self.transfer_config,
        )

    def download_file(self, key: str, destination: str) -> None:
        self.client.download_file(
            Bucket=settings.s3_bucket_name,
            Key=key,
            Filename=destination,
            Config=self.transfer_config,
        )

    def delete_object(self, key: str) -> None:
        self.client.delete_object(Bucket=settings.s3_bucket_name, Key=key)

    def delete_prefix(self, prefix: str) -> None:
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=settings.s3_bucket_name, Prefix=prefix):
            contents = page.get("Contents", [])
            if not contents:
                continue
            self.client.delete_objects(
                Bucket=settings.s3_bucket_name,
                Delete={"Objects": [{"Key": item["Key"]} for item in contents], "Quiet": True},
            )

    def derive_filename_from_url(self, url: str) -> str:
        parsed = urlparse(url)
        name = Path(parsed.path).name
        return name or "remote-video.mp4"


storage_service = StorageService()
