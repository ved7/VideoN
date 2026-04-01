import { cn, ui } from "../lib/ui";
import { formatDuration } from "../lib/utils";
import type { VideoDetail } from "../types/api";
import { AnnotationTimeline } from "./AnnotationTimeline";
import { StatusBadge } from "./StatusBadge";

interface VideoPlayerPanelProps {
  video: VideoDetail;
  currentTime: number;
  duration: number;
  onJump: (seconds: number) => void;
  onSeek: (seconds: number) => void;
  onStepFrame: (delta: number) => void;
  onVideoMounted: (element: HTMLVideoElement | null) => void;
  onTimeUpdate: (element: HTMLVideoElement) => void;
  onMetadataLoaded: (element: HTMLVideoElement) => void;
}

export function VideoPlayerPanel({
  video,
  currentTime,
  duration,
  onJump,
  onSeek,
  onStepFrame,
  onVideoMounted,
  onTimeUpdate,
  onMetadataLoaded,
}: VideoPlayerPanelProps) {
  return (
    <section className={cn(ui.panel, "p-6 sm:p-7")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={ui.eyebrow}>Video</p>
          <p className="mt-2 truncate text-[15px] font-medium tracking-[-0.02em] text-[#1D1D1F] sm:text-[16px]">
            {video.name}
          </p>
        </div>
        <StatusBadge status={video.status} />
      </div>

      {video.playback_url ? (
        <>
          <div className="mt-6 overflow-hidden rounded-[28px] bg-[#0E0E11] shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <video
              className="block h-auto max-h-[70vh] w-full bg-black"
              controls
              poster={video.poster_url ?? undefined}
              ref={onVideoMounted}
              src={video.playback_url}
              onLoadedMetadata={(event) => onMetadataLoaded(event.currentTarget)}
              onTimeUpdate={(event) => onTimeUpdate(event.currentTarget)}
            />
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between text-sm text-[#6E6E73]">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration || video.duration_seconds)}</span>
            </div>
            <input
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-[#007AFF]"
              max={duration || video.duration_seconds || 0}
              min={0}
              step={0.05}
              type="range"
              value={currentTime}
              onChange={(event) => onSeek(Number(event.target.value))}
            />
            <AnnotationTimeline
              annotations={video.annotations}
              currentTime={currentTime}
              duration={duration || video.duration_seconds || 0}
              onJump={onJump}
            />
          </div>
        </>
      ) : (
        <div className="mt-6 grid min-h-[320px] place-items-center rounded-[28px] bg-white/65 px-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_14px_40px_rgba(15,23,42,0.05)]">
          <p className="max-w-md text-[15px] leading-7 text-[#6E6E73]">
            This video is still being processed. The page will refresh automatically once playback metadata is ready.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button className={ui.tertiaryButton} type="button" onClick={() => onJump(Math.max(0, currentTime - 5))}>
          Back 5s
        </button>
        <button className={ui.tertiaryButton} type="button" onClick={() => onJump(currentTime + 5)}>
          Forward 5s
        </button>
        <button
          className={ui.tertiaryButton}
          disabled={!video.fps}
          type="button"
          onClick={() => onStepFrame(-1)}
        >
          Prev Frame
        </button>
        <button
          className={ui.tertiaryButton}
          disabled={!video.fps}
          type="button"
          onClick={() => onStepFrame(1)}
        >
          Next Frame
        </button>
        <button className={ui.tertiaryButton} type="button" onClick={() => onJump(0)}>
          Start Over
        </button>
      </div>

      <p className="mt-4 text-sm leading-6 text-[#6E6E73]">
        Shortcuts: <span className="font-medium text-[#1D1D1F]">J / L</span> for +/- 5s,{" "}
        <span className="font-medium text-[#1D1D1F]">Shift + Left/Right</span> for frame stepping.
      </p>
    </section>
  );
}
