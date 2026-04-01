import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { AnnotationComposer } from "../components/AnnotationComposer";
import { AnnotationList } from "../components/AnnotationList";
import { SummaryPanel } from "../components/SummaryPanel";
import { VideoPlayerPanel } from "../components/VideoPlayerPanel";
import {
  createAnnotation,
  deleteAnnotation,
  fetchVideo,
  generateIntervalAnnotations,
  generateSummary,
  updateAnnotation,
} from "../lib/api";
import { useOpenAiSession } from "../lib/openai-session";
import { cn, ui } from "../lib/ui";
import { formatBytes, formatDate, formatDuration } from "../lib/utils";
import type { Annotation, VideoDetail, VideoListItem } from "../types/api";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || ["input", "textarea", "select", "button"].includes(tagName);
}

export function VideoDetailsPage() {
  const { videoId = "" } = useParams();
  const queryClient = useQueryClient();
  const { openAiApiKey } = useOpenAiSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [stablePlaybackUrl, setStablePlaybackUrl] = useState<string | null>(null);
  const [stablePosterUrl, setStablePosterUrl] = useState<string | null>(null);

  const videoQuery = useQuery({
    queryKey: ["video", videoId],
    queryFn: () => fetchVideo(videoId),
    enabled: Boolean(videoId),
    refetchInterval: (query) => {
      const video = query.state.data;
      return video && video.status !== "READY" ? 5000 : false;
    },
  });

  function sortAnnotations(annotations: Annotation[]) {
    return [...annotations].sort((left, right) => left.timestamp_seconds - right.timestamp_seconds);
  }

  function updateVideoCache(
    updater: (current: VideoDetail) => VideoDetail,
    options?: { syncSummary?: string | null },
  ) {
    queryClient.setQueryData<VideoDetail>(["video", videoId], (current) =>
      current ? updater(current) : current,
    );

    if (options && "syncSummary" in options) {
      queryClient.setQueryData<VideoListItem[]>(["videos"], (current) =>
        current?.map((item) =>
          item.id === videoId ? { ...item, summary: options.syncSummary ?? null } : item,
        ) ?? current,
      );
    }
  }

  const createAnnotationMutation = useMutation({
    mutationFn: async ({
      type,
      note,
      tags,
    }: {
      type: "TIMESTAMP" | "FRAME";
      note: string;
      tags: string[];
    }) => {
      const fps = videoQuery.data?.fps ?? null;
      const frameNumber = type === "FRAME" && fps ? Math.floor(currentTime * fps) : undefined;
      return createAnnotation(videoId, {
        annotation_type: type,
        timestamp_seconds: currentTime,
        frame_number: frameNumber,
        note,
        tags,
      });
    },
    onSuccess: (createdAnnotation) => {
      updateVideoCache((current) => ({
        ...current,
        annotations: sortAnnotations([...current.annotations, createdAnnotation]),
      }));
    },
  });

  const generateIntervalsMutation = useMutation({
    mutationFn: (intervalSeconds: number) => generateIntervalAnnotations(videoId, intervalSeconds),
    onSuccess: (result) => {
      updateVideoCache((current) => {
        const annotationMap = new Map(current.annotations.map((annotation) => [annotation.id, annotation]));
        result.created_annotations.forEach((annotation) => {
          annotationMap.set(annotation.id, annotation);
        });
        return {
          ...current,
          annotations: sortAnnotations(Array.from(annotationMap.values())),
        };
      });
    },
  });

  const updateAnnotationMutation = useMutation({
    mutationFn: ({
      annotation,
      payload,
    }: {
      annotation: Annotation;
      payload: { note: string; tags: string[] };
    }) =>
      updateAnnotation(annotation.id, {
        note: payload.note,
        tags: payload.tags,
        is_placeholder: payload.note.trim().length === 0 ? annotation.is_placeholder : false,
      }),
    onSuccess: (updatedAnnotation) => {
      updateVideoCache((current) => ({
        ...current,
        annotations: sortAnnotations(
          current.annotations.map((annotation) =>
            annotation.id === updatedAnnotation.id ? updatedAnnotation : annotation,
          ),
        ),
      }));
    },
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: async (annotationId: string) => {
      await deleteAnnotation(annotationId);
      return annotationId;
    },
    onSuccess: (annotationId) => {
      updateVideoCache((current) => ({
        ...current,
        annotations: current.annotations.filter((annotation) => annotation.id !== annotationId),
      }));
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: () => generateSummary(videoId, { openAiApiKey }),
    onSuccess: ({ summary }) => {
      updateVideoCache(
        (current) => ({
          ...current,
          summary,
        }),
        { syncSummary: summary },
      );
    },
  });

  const sortedAnnotations = useMemo(
    () =>
      [...(videoQuery.data?.annotations ?? [])].sort(
        (left, right) => left.timestamp_seconds - right.timestamp_seconds,
      ),
    [videoQuery.data?.annotations],
  );

  function seekTo(seconds: number, options?: { play?: boolean }) {
    const upperBound = playerDuration || videoQuery.data?.duration_seconds || seconds;
    const nextTime = Math.max(0, Math.min(seconds, upperBound));

    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
      if (options?.play ?? true) {
        void videoRef.current.play().catch(() => undefined);
      } else {
        videoRef.current.pause();
      }
    }

    setCurrentTime(nextTime);
  }

  function jumpTo(seconds: number) {
    seekTo(seconds, { play: true });
  }

  function stepFrame(delta: number) {
    const fps = videoQuery.data?.fps;
    if (!fps) {
      return;
    }
    seekTo(currentTime + delta / fps, { play: false });
  }

  useEffect(() => {
    setStablePlaybackUrl(null);
    setStablePosterUrl(null);
  }, [videoId]);

  useEffect(() => {
    if (videoQuery.data?.playback_url) {
      setStablePlaybackUrl((current) => current ?? videoQuery.data?.playback_url ?? null);
    }
    if (videoQuery.data?.poster_url) {
      setStablePosterUrl((current) => current ?? videoQuery.data?.poster_url ?? null);
    }
  }, [videoQuery.data?.playback_url, videoQuery.data?.poster_url]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        seekTo(currentTime - 5, { play: false });
        return;
      }

      if (event.key === "l" || event.key === "L") {
        event.preventDefault();
        seekTo(currentTime + 5, { play: false });
        return;
      }

      if (event.shiftKey && event.key === "ArrowLeft") {
        event.preventDefault();
        stepFrame(-1);
        return;
      }

      if (event.shiftKey && event.key === "ArrowRight") {
        event.preventDefault();
        stepFrame(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, playerDuration, videoQuery.data?.fps]);

  if (videoQuery.isLoading) {
    return (
      <div className={cn(ui.panel, "px-8 py-12 text-center")}>
        <p className="text-lg font-medium tracking-[-0.02em] text-[#1D1D1F]">Loading video details...</p>
      </div>
    );
  }

  if (videoQuery.isError || !videoQuery.data) {
    return (
      <div className={cn(ui.panel, "space-y-4 px-8 py-10")}>
        <p className={ui.errorText}>{(videoQuery.error as Error)?.message ?? "Video not found"}</p>
        <Link className={ui.tertiaryButton} to="/">
          Back to library
        </Link>
      </div>
    );
  }

  const video = videoQuery.data;
  const playerVideo = {
    ...video,
    playback_url: stablePlaybackUrl ?? video.playback_url,
    poster_url: stablePosterUrl ?? video.poster_url,
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cn(ui.secondaryPanel, "p-5")}>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#6E6E73]">Uploaded</p>
          <p className="mt-2 text-[18px] font-medium tracking-[-0.025em] text-[#1D1D1F]">
            {video.uploaded_at ? formatDate(video.uploaded_at) : "Pending"}
          </p>
        </div>
        <div className={cn(ui.secondaryPanel, "p-5")}>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#6E6E73]">Duration</p>
          <p className="mt-2 text-[18px] font-medium tracking-[-0.025em] text-[#1D1D1F]">
            {formatDuration(video.duration_seconds)}
          </p>
        </div>
        <div className={cn(ui.secondaryPanel, "p-5")}>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#6E6E73]">File size</p>
          <p className="mt-2 text-[18px] font-medium tracking-[-0.025em] text-[#1D1D1F]">
            {formatBytes(video.size_bytes)}
          </p>
        </div>
        <div className={cn(ui.secondaryPanel, "p-5")}>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#6E6E73]">Frames</p>
          <p className="mt-2 text-[18px] font-medium tracking-[-0.025em] text-[#1D1D1F]">
            {video.total_frames ?? "Pending"}
          </p>
        </div>
      </section>

      {video.failure_reason ? <p className={ui.errorText}>{video.failure_reason}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)] xl:items-start">
        <VideoPlayerPanel
          currentTime={currentTime}
          duration={playerDuration}
          video={playerVideo}
          onJump={jumpTo}
          onMetadataLoaded={(element) => {
            setPlayerDuration(element.duration);
            setCurrentTime(element.currentTime);
          }}
          onSeek={(seconds) => seekTo(seconds, { play: false })}
          onStepFrame={stepFrame}
          onTimeUpdate={(element) => setCurrentTime(element.currentTime)}
          onVideoMounted={(element) => {
            videoRef.current = element;
          }}
        />

        <div className="xl:self-start">
          <AnnotationComposer
            busy={
              createAnnotationMutation.isPending || generateIntervalsMutation.isPending || video.status !== "READY"
            }
            currentTime={currentTime}
            fps={video.fps}
            onCreate={async (type, note, tags) => {
              await createAnnotationMutation.mutateAsync({ type, note, tags });
            }}
            onGenerateIntervals={async (interval) => {
              await generateIntervalsMutation.mutateAsync(interval);
            }}
          />
        </div>
      </div>

      <SummaryPanel
        busy={generateSummaryMutation.isPending}
        summary={video.summary}
        onGenerate={async () => {
          await generateSummaryMutation.mutateAsync();
        }}
      />

      <AnnotationList
        annotations={sortedAnnotations}
        currentTime={currentTime}
        onDelete={async (annotationId) => {
          await deleteAnnotationMutation.mutateAsync(annotationId);
        }}
        onJump={jumpTo}
        onSave={async (annotation, payload) => {
          await updateAnnotationMutation.mutateAsync({ annotation, payload });
        }}
      />
    </div>
  );
}
