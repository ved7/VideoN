import { Link } from "react-router-dom";

import { formatBytes, formatDate, formatDuration } from "../lib/utils";
import { cn, ui } from "../lib/ui";
import type { VideoListItem } from "../types/api";
import { StatusBadge } from "./StatusBadge";

interface VideoCardProps {
  video: VideoListItem;
  deleting?: boolean;
  onDelete?: (video: VideoListItem) => void;
}

export function VideoCard({ video, deleting = false, onDelete }: VideoCardProps) {
  return (
    <article
      className={cn(
        ui.secondaryPanel,
        "flex h-full flex-col gap-6 p-6 transition duration-200 ease-out hover:bg-white/85 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={ui.eyebrow}>{video.source_type === "LOCAL_UPLOAD" ? "Local upload" : "Imported URL"}</p>
          <h3 className="mt-2 truncate text-[22px] font-medium tracking-[-0.03em] text-[#1D1D1F]">{video.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={video.status} />
          {onDelete ? (
            <button
              className={cn(ui.tertiaryButton, "min-h-10 px-3 text-[#C9342B] hover:bg-[#FFF1F0] hover:text-[#C9342B]")}
              disabled={deleting}
              type="button"
              onClick={() => onDelete(video)}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : null}
        </div>
      </div>

      <Link
        className="group flex flex-1 flex-col gap-6 transition duration-200 ease-out hover:-translate-y-0.5"
        to={`/videos/${video.id}`}
      >
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-[#6E6E73]">Created</dt>
            <dd className="mt-2 text-[#1D1D1F]">{formatDate(video.created_at)}</dd>
          </div>
          <div>
            <dt className="text-[#6E6E73]">Duration</dt>
            <dd className="mt-2 text-[#1D1D1F]">{formatDuration(video.duration_seconds)}</dd>
          </div>
          <div>
            <dt className="text-[#6E6E73]">Size</dt>
            <dd className="mt-2 text-[#1D1D1F]">{formatBytes(video.size_bytes)}</dd>
          </div>
        </dl>

        {video.failure_reason ? <p className={ui.errorText}>{video.failure_reason}</p> : null}
        {video.summary ? (
          <p className={ui.subtleText}>{video.summary}</p>
        ) : (
          <p className={ui.subtleText}>Open the video to annotate and generate a summary.</p>
        )}
      </Link>
    </article>
  );
}
