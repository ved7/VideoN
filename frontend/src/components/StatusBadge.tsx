import type { VideoStatus } from "../types/api";
import { cn } from "../lib/ui";

const statusLabelMap: Record<VideoStatus, string> = {
  UPLOADING: "Uploading",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
};

const statusClassMap: Record<VideoStatus, string> = {
  UPLOADING: "bg-[#EAF4FF] text-[#007AFF]",
  PROCESSING: "bg-[#EEF0F3] text-[#6E6E73]",
  READY: "bg-[#E8F3FF] text-[#007AFF]",
  FAILED: "bg-[#FFF1F0] text-[#C9342B]",
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
        statusClassMap[status],
      )}
    >
      {statusLabelMap[status]}
    </span>
  );
}
