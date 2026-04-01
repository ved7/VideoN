export type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
export type VideoSourceType = "LOCAL_UPLOAD" | "PUBLIC_URL";
export type AnnotationType = "TIMESTAMP" | "FRAME";
export type AnnotationOrigin = "MANUAL" | "INTERVAL";

export interface VideoListItem {
  id: string;
  name: string;
  source_type: VideoSourceType;
  status: VideoStatus;
  duration_seconds: number | null;
  size_bytes: number | null;
  created_at: string;
  uploaded_at: string | null;
  summary: string | null;
  failure_reason: string | null;
}

export interface Annotation {
  id: string;
  video_id: string;
  annotation_type: AnnotationType;
  origin: AnnotationOrigin;
  timestamp_seconds: number;
  frame_number: number | null;
  snapshot_url: string | null;
  note: string;
  tags: string[];
  is_placeholder: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoDetail extends VideoListItem {
  fps: number | null;
  total_frames: number | null;
  playback_url: string | null;
  poster_url: string | null;
  annotations: Annotation[];
}

export interface MultipartUploadInitiateResponse {
  video_id: string;
  upload_id: string;
  storage_key: string;
  part_size_bytes: number;
}

export interface MultipartUploadPartUrlResponse {
  url: string;
}

export interface SummaryResponse {
  summary: string;
}
