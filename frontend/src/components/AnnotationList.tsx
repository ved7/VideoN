import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { cn, ui } from "../lib/ui";
import { formatDuration } from "../lib/utils";
import type { Annotation, AnnotationType } from "../types/api";

interface AnnotationListProps {
  annotations: Annotation[];
  currentTime: number;
  onJump: (seconds: number) => void;
  onSave: (annotation: Annotation, payload: { note: string; tags: string[] }) => Promise<void>;
  onDelete: (annotationId: string) => Promise<void>;
}

type AnnotationSortKey = "timestamp" | "recent" | "tagged";
type AnnotationTypeFilter = "ALL" | AnnotationType;
type AutoSaveState = "idle" | "typing" | "saving" | "saved";

function parseTagInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .slice(0, 12);
}

function sameTags(left: string[], right: string[]) {
  return left.join("|") === right.join("|");
}

export function AnnotationList({
  annotations,
  currentTime,
  onJump,
  onSave,
  onDelete,
}: AnnotationListProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedType, setSelectedType] = useState<AnnotationTypeFilter>("ALL");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<AnnotationSortKey>("timestamp");
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  const availableTags = useMemo(
    () =>
      Array.from(new Set(annotations.flatMap((annotation) => annotation.tags)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [annotations],
  );

  const visibleAnnotations = useMemo(() => {
    const filtered = annotations.filter((annotation) => {
      const matchesSearch =
        !deferredSearch ||
        annotation.note.toLowerCase().includes(deferredSearch) ||
        annotation.tags.some((tag) => tag.includes(deferredSearch));
      const matchesType = selectedType === "ALL" || annotation.annotation_type === selectedType;
      const matchesTag = selectedTag === "ALL" || annotation.tags.includes(selectedTag);
      return matchesSearch && matchesType && matchesTag;
    });

    filtered.sort((left, right) => {
      if (sortKey === "recent") {
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }
      if (sortKey === "tagged") {
        if (right.tags.length !== left.tags.length) {
          return right.tags.length - left.tags.length;
        }
      }
      return left.timestamp_seconds - right.timestamp_seconds;
    });

    return filtered;
  }, [annotations, deferredSearch, selectedTag, selectedType, sortKey]);

  return (
    <section className={cn(ui.panel, "space-y-6 p-6 sm:p-7")}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className={ui.eyebrow}>Annotations</p>
          <h2 className={ui.sectionTitle}>{annotations.length} captured moments</h2>
          <p className={`${ui.body} mt-2`}>
            Search by note or tag, filter by annotation type, and keep edits synced automatically.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
          <input
            className={ui.input}
            placeholder="Search notes or tags"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <select
            className={ui.input}
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as AnnotationTypeFilter)}
          >
            <option value="ALL">All types</option>
            <option value="TIMESTAMP">Timestamp notes</option>
            <option value="FRAME">Frame notes</option>
          </select>
          <select
            className={ui.input}
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as AnnotationSortKey)}
          >
            <option value="timestamp">Sort by timestamp</option>
            <option value="recent">Sort by recent edits</option>
            <option value="tagged">Sort by tag count</option>
          </select>
        </div>
      </div>

      {availableTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            className={cn(
              ui.tertiaryButton,
              selectedTag === "ALL" && "bg-[#007AFF] text-white ring-0 hover:bg-[#007AFF]",
            )}
            type="button"
            onClick={() => setSelectedTag("ALL")}
          >
            All tags
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              className={cn(
                ui.tertiaryButton,
                selectedTag === tag && "bg-[#007AFF] text-white ring-0 hover:bg-[#007AFF]",
              )}
              type="button"
              onClick={() => setSelectedTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}

      {annotations.length === 0 ? (
        <p className={ui.subtleText}>
          Start the video and add your first annotation. Interval-generated placeholders will also appear here.
        </p>
      ) : visibleAnnotations.length === 0 ? (
        <div className={cn(ui.secondaryPanel, "px-6 py-8 text-center")}>
          <p className="text-base font-medium tracking-[-0.02em] text-[#1D1D1F]">No annotations match these filters</p>
          <p className={`${ui.body} mt-2`}>Try clearing search, type, or tag filters to see more captured moments.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleAnnotations.map((annotation) => (
            <AnnotationListItem
              key={annotation.id}
              annotation={annotation}
              isActive={Math.abs(annotation.timestamp_seconds - currentTime) < 1}
              onDelete={onDelete}
              onJump={onJump}
              onSave={onSave}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface AnnotationListItemProps {
  annotation: Annotation;
  isActive: boolean;
  onJump: (seconds: number) => void;
  onSave: (annotation: Annotation, payload: { note: string; tags: string[] }) => Promise<void>;
  onDelete: (annotationId: string) => Promise<void>;
}

function AnnotationListItem({
  annotation,
  isActive,
  onJump,
  onSave,
  onDelete,
}: AnnotationListItemProps) {
  const [noteValue, setNoteValue] = useState(annotation.note);
  const [tagInput, setTagInput] = useState(annotation.tags.join(", "));
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const saveSequenceRef = useRef(0);

  const parsedTags = useMemo(() => parseTagInput(tagInput), [tagInput]);
  const hasChanges = noteValue !== annotation.note || !sameTags(parsedTags, annotation.tags);

  useEffect(() => {
    setNoteValue(annotation.note);
    setTagInput(annotation.tags.join(", "));
    setAutoSaveState("idle");
  }, [annotation.note, annotation.tags]);

  useEffect(() => {
    if (!hasChanges || autoSaveState === "saving") {
      return;
    }

    setAutoSaveState("typing");
    const sequence = saveSequenceRef.current + 1;
    const timeoutId = window.setTimeout(() => {
      void persistChanges(sequence, noteValue, parsedTags);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [annotation.note, annotation.tags, autoSaveState, hasChanges, noteValue, parsedTags]);

  async function persistChanges(sequence: number, note: string, tags: string[]) {
    saveSequenceRef.current = sequence;
    setAutoSaveState("saving");
    setItemError(null);
    try {
      await onSave(annotation, { note, tags });
      if (saveSequenceRef.current !== sequence) {
        return;
      }
      setAutoSaveState("saved");
      window.setTimeout(() => {
        if (saveSequenceRef.current === sequence) {
          setAutoSaveState("idle");
        }
      }, 1400);
    } catch (error) {
      if (saveSequenceRef.current === sequence) {
        setAutoSaveState("idle");
      }
      setItemError(error instanceof Error ? error.message : "Could not update annotation");
    }
  }

  async function handleSaveNow() {
    await persistChanges(saveSequenceRef.current + 1, noteValue, parsedTags);
  }

  async function handleDelete() {
    setIsDeleting(true);
    setItemError(null);
    try {
      await onDelete(annotation.id);
    } catch (error) {
      setItemError(error instanceof Error ? error.message : "Could not delete annotation");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article
      className={cn(
        ui.secondaryPanel,
        "space-y-4 p-5 transition duration-200 ease-out",
        isActive && "ring-2 ring-[#007AFF]/15 shadow-[0_18px_44px_rgba(0,122,255,0.08)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <button
          className="text-left text-[22px] font-medium tracking-[-0.03em] text-[#1D1D1F] transition duration-200 ease-out hover:text-[#007AFF]"
          type="button"
          onClick={() => onJump(annotation.timestamp_seconds)}
        >
          {formatDuration(annotation.timestamp_seconds)}
        </button>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-full bg-[#F2F2F5] px-3 py-1 text-xs font-medium text-[#6E6E73]">
            {annotation.annotation_type}
          </span>
          <span className="rounded-full bg-[#F2F2F5] px-3 py-1 text-xs font-medium text-[#6E6E73]">
            {annotation.origin}
          </span>
          {annotation.frame_number !== null ? (
            <span className="rounded-full bg-[#F2F2F5] px-3 py-1 text-xs font-medium text-[#6E6E73]">
              Frame {annotation.frame_number}
            </span>
          ) : null}
        </div>
      </div>

      <button
        className="group relative block w-full overflow-hidden rounded-[24px] bg-[#EEF2F8] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
        type="button"
        onClick={() => onJump(annotation.timestamp_seconds)}
      >
        {annotation.snapshot_url ? (
          <img
            alt={`Video snapshot at ${formatDuration(annotation.timestamp_seconds)}`}
            className="aspect-video h-full w-full object-cover transition duration-300 ease-out group-hover:scale-[1.01]"
            loading="lazy"
            src={annotation.snapshot_url}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-[linear-gradient(180deg,#F5F6FA,#E9ECF3)]">
            <span className="text-sm font-medium text-[#6E6E73]">Generating snapshot...</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/18 via-black/5 to-transparent opacity-80" />
      </button>

      <textarea
        className={ui.textarea}
        placeholder="Add context for this moment"
        rows={3}
        value={noteValue}
        onChange={(event) => setNoteValue(event.target.value)}
      />

      <div className="space-y-2">
        <label className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#6E6E73]" htmlFor={`tags-${annotation.id}`}>
          Tags
        </label>
        <input
          className={ui.input}
          id={`tags-${annotation.id}`}
          placeholder="bug, pacing, b-roll"
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {parsedTags.length > 0 ? (
            parsedTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#EAF3FF] px-3 py-1 text-xs font-medium text-[#007AFF]"
              >
                #{tag}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#6E6E73]">Add tags to make this annotation easier to filter.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className={ui.secondaryButton}
          disabled={!hasChanges || autoSaveState === "saving"}
          type="button"
          onClick={() => void handleSaveNow()}
        >
          {autoSaveState === "saving" ? "Saving..." : "Save now"}
        </button>
        <button
          className={cn(ui.tertiaryButton, "text-[#C9342B]")}
          disabled={isDeleting}
          type="button"
          onClick={() => void handleDelete()}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
        <span className="text-sm text-[#6E6E73]">
          {autoSaveState === "typing"
            ? "Autosave in progress..."
            : autoSaveState === "saving"
              ? "Saving changes..."
              : autoSaveState === "saved"
                ? "Saved"
                : "Autosaves after you pause typing."}
        </span>
      </div>

      {itemError ? <p className={ui.errorText}>{itemError}</p> : null}
    </article>
  );
}
