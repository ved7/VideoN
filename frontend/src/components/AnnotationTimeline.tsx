import type { Annotation } from "../types/api";
import { cn } from "../lib/ui";

interface AnnotationTimelineProps {
  annotations: Annotation[];
  duration: number;
  currentTime: number;
  onJump: (seconds: number) => void;
}

export function AnnotationTimeline({
  annotations,
  duration,
  currentTime,
  onJump,
}: AnnotationTimelineProps) {
  if (duration <= 0) {
    return null;
  }

  return (
    <div className="relative mt-3 h-5">
      {annotations.map((annotation) => {
        const left = `${(annotation.timestamp_seconds / duration) * 100}%`;
        const isActive = Math.abs(annotation.timestamp_seconds - currentTime) < 1;
        return (
          <button
            key={annotation.id}
            className={cn(
              "absolute top-0 h-5 w-1.5 -translate-x-1/2 rounded-full bg-[#007AFF]/30 transition duration-200 ease-out hover:bg-[#007AFF]/55",
              isActive && "bg-[#007AFF]",
            )}
            style={{ left }}
            title={annotation.note || `Jump to ${annotation.timestamp_seconds.toFixed(2)}s`}
            type="button"
            onClick={() => onJump(annotation.timestamp_seconds)}
          />
        );
      })}
    </div>
  );
}
