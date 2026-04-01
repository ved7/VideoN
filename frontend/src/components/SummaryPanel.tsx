import { cn, ui } from "../lib/ui";

interface SummaryPanelProps {
  summary: string | null;
  busy: boolean;
  onGenerate: () => Promise<void>;
}

export function SummaryPanel({ summary, busy, onGenerate }: SummaryPanelProps) {
  return (
    <section className={cn(ui.panel, "space-y-6 p-6 sm:p-7")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className={ui.eyebrow}>Summary</p>
          <h2 className={ui.sectionTitle}>Generate an intelligent review summary</h2>
          <p className={`${ui.body} mt-2`}>
            Uses an LLM when configured, with an upgraded structured fallback so the output still reads clearly.
          </p>
        </div>

        <button className={cn(ui.secondaryButton, "lg:shrink-0")} disabled={busy} type="button" onClick={onGenerate}>
          {busy ? "Generating..." : "Generate Intelligent Summary"}
        </button>
      </div>

      <div className={cn(ui.secondaryPanel, "min-h-[220px] p-5")}>
        {summary ? (
          <pre className="whitespace-pre-wrap text-[15px] leading-7 text-[#1D1D1F]">{summary}</pre>
        ) : (
          <p className={ui.subtleText}>
            No summary yet. Generate one after adding a few annotations to get a stronger review narrative.
          </p>
        )}
      </div>
    </section>
  );
}
