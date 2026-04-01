import type {
  Annotation,
  MultipartUploadInitiateResponse,
  MultipartUploadPartUrlResponse,
  SummaryResponse,
  VideoDetail,
  VideoListItem,
} from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const OPENAI_API_KEY_HEADER = "X-OpenAI-API-Key";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text || response.statusText;
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      detail = parsed.detail ?? detail;
    } catch {
      // Preserve the raw response body when the error payload is not JSON.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchVideos() {
  return request<VideoListItem[]>("/videos");
}

export async function fetchVideo(videoId: string) {
  return request<VideoDetail>(`/videos/${videoId}`);
}

export async function deleteVideo(videoId: string) {
  return request<void>(`/videos/${videoId}`, {
    method: "DELETE",
  });
}

export async function uploadLocalVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<VideoDetail> {
  const init = await request<MultipartUploadInitiateResponse>("/videos/uploads/initiate", {
    method: "POST",
    body: JSON.stringify({
      file_name: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    }),
  });

  const totalParts = Math.ceil(file.size / init.part_size_bytes);
  const completedParts: Array<{ part_number: number; etag: string }> = [];
  let nextPartNumber = 1;
  let uploadedBytes = 0;

  const uploadWorker = async () => {
    while (nextPartNumber <= totalParts) {
      const currentPartNumber = nextPartNumber;
      nextPartNumber += 1;

      const start = (currentPartNumber - 1) * init.part_size_bytes;
      const end = Math.min(start + init.part_size_bytes, file.size);
      const chunk = file.slice(start, end);

      const { url } = await request<MultipartUploadPartUrlResponse>(`/videos/${init.video_id}/uploads/part-url`, {
        method: "POST",
        body: JSON.stringify({
          upload_id: init.upload_id,
          part_number: currentPartNumber,
        }),
      });

      const uploadResponse = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: chunk,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Storage rejected part ${currentPartNumber}`);
      }

      const etag =
        uploadResponse.headers.get("etag")?.replace(/"/g, "") ??
        uploadResponse.headers.get("ETag")?.replace(/"/g, "");

      if (!etag) {
        throw new Error("Storage upload did not expose an ETag header. Check bucket CORS configuration.");
      }

      completedParts.push({ part_number: currentPartNumber, etag });
      uploadedBytes += end - start;
      onProgress?.(uploadedBytes / file.size);
    }
  };

  try {
    const workerCount = Math.min(4, totalParts);
    await Promise.all(Array.from({ length: workerCount }, () => uploadWorker()));
  } catch (error) {
    await request<void>(`/videos/${init.video_id}/uploads`, {
      method: "DELETE",
    }).catch(() => undefined);
    throw error;
  }

  return request<VideoDetail>(`/videos/${init.video_id}/uploads/complete`, {
    method: "POST",
    body: JSON.stringify({
      upload_id: init.upload_id,
      parts: completedParts.sort((a, b) => a.part_number - b.part_number),
    }),
  });
}

export async function importVideoFromUrl(sourceUrl: string, name?: string) {
  return request<VideoDetail>("/videos/import-url", {
    method: "POST",
    body: JSON.stringify({
      source_url: sourceUrl,
      name: name || null,
    }),
  });
}

export async function createAnnotation(
  videoId: string,
  payload: {
    annotation_type: "TIMESTAMP" | "FRAME";
    timestamp_seconds: number;
    frame_number?: number;
    note: string;
    tags?: string[];
    origin?: "MANUAL" | "INTERVAL";
    is_placeholder?: boolean;
  },
) {
  return request<Annotation>(`/videos/${videoId}/annotations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAnnotation(
  annotationId: string,
  payload: {
    note?: string;
    tags?: string[];
    timestamp_seconds?: number;
    frame_number?: number;
    is_placeholder?: boolean;
  },
) {
  return request<Annotation>(`/annotations/${annotationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAnnotation(annotationId: string) {
  return request<void>(`/annotations/${annotationId}`, {
    method: "DELETE",
  });
}

export async function generateIntervalAnnotations(videoId: string, intervalSeconds: number) {
  return request<{ interval_seconds: number; created_annotations: Annotation[] }>(
    `/videos/${videoId}/annotations/intervals`,
    {
      method: "POST",
      body: JSON.stringify({ interval_seconds: intervalSeconds }),
    },
  );
}

export async function generateSummary(videoId: string, options?: { openAiApiKey?: string | null }) {
  return request<SummaryResponse>(`/videos/${videoId}/summary`, {
    method: "POST",
    headers: options?.openAiApiKey
      ? {
          [OPENAI_API_KEY_HEADER]: options.openAiApiKey,
        }
      : undefined,
  });
}
