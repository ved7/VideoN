import { useState } from "react";

import { cn, ui } from "../lib/ui";
import { formatDuration } from "../lib/utils";

interface AnnotationComposerProps {
  currentTime: number;
  fps: number | null;
  onCreate: (type: "TIMESTAMP" | "FRAME", note: string, tags: string[]) => Promise<void>;
  onGenerateIntervals: (interval: number) => Promise<void>;
  busy: boolean;
}

const intervalChoices = [1, 5, 10, 30];

function parseTagInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .slice(0, 12);
}

export function AnnotationComposer({
  currentTime,
  fps,
  onCreate,
  onGenerateIntervals,
  busy,
}: AnnotationComposerProps) {
  const [note, setNote] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedInterval, setSelectedInterval] = useState(5);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(type: "TIMESTAMP" | "FRAME") {
    setError(null);
    try {
      await onCreate(type, note, parseTagInput(tagInput));
      setNote("");
      setTagInput("");
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Could not save annotation");
    }
  }

  async function handleGenerateIntervals() {
    setError(null);
    try {
      await onGenerateIntervals(selectedInterval);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Could not generate interval annotations");
    }
  }

  return (
    <section className={cn(ui.panel, "space-y-6 p-6 sm:p-7")}>
      <div>
        <p className={ui.eyebrow}>Annotate</p>
        <h2 className={ui.sectionTitle}>Capture precise moments</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={cn(ui.tertiaryPanel, "p-5")}>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#6E6E73]">Current timestamp</p>
          <p className="mt-2 text-[22px] font-medium tracking-[-0.03em] text-[#1D1D1F]">{formatDuration(currentTime)}</p>
        </div>
        <div className={cn(ui.tertiaryPanel, "p-5")}>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#6E6E73]">Current frame</p>
          <p className="mt-2 text-[22px] font-medium tracking-[-0.03em] text-[#1D1D1F]">
            {fps ? Math.floor(currentTime * fps) : "Unavailable"}
          </p>
        </div>
      </div>

      <textarea
        className={ui.textarea}
        placeholder="Describe what matters at this point in the video..."
        rows={5}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <div className="space-y-2">
        <label className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#6E6E73]" htmlFor="annotation-tags">
          Tags
        </label>
        <input
          className={ui.input}
          id="annotation-tags"
          placeholder="bug, dialogue, transition"
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
        />
        <p className={ui.subtleText}>Use comma-separated tags to organize and filter annotations later.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className={ui.primaryButton} disabled={busy} type="button" onClick={() => handleCreate("TIMESTAMP")}>
          Save Timestamp Note
        </button>
        <button
          className={ui.secondaryButton}
          disabled={busy || !fps}
          type="button"
          onClick={() => handleCreate("FRAME")}
        >
          Save Frame Note
        </button>
      </div>

      <div className={cn(ui.secondaryPanel, "space-y-4 p-5")}>
        <div>
          <h3 className="text-[22px] font-medium tracking-[-0.03em] text-[#1D1D1F]">Frame interval annotations</h3>
          <p className={`${ui.body} mt-2`}>
            Generate empty annotation slots at a fixed cadence so reviewers can work through the video systematically.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            className={cn(ui.input, "sm:max-w-[170px]")}
            value={selectedInterval}
            onChange={(event) => setSelectedInterval(Number(event.target.value))}
          >
            {intervalChoices.map((interval) => (
              <option key={interval} value={interval}>
                Every {interval}s
              </option>
            ))}
          </select>
          <button className={ui.tertiaryButton} disabled={busy} type="button" onClick={handleGenerateIntervals}>
            Generate Slots
          </button>
        </div>
      </div>

      {error ? <p className={ui.errorText}>{error}</p> : null}
    </section>
  );
}
