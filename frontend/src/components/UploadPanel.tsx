import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { importVideoFromUrl, uploadLocalVideo } from "../lib/api";
import { cn, ui } from "../lib/ui";

interface UploadPanelProps {
  onSuccess: () => void;
  compact?: boolean;
}

export function UploadPanel({ onSuccess, compact = false }: UploadPanelProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [urlValue, setUrlValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const panelClass = cn(ui.secondaryPanel, "flex flex-col p-5 sm:p-6");
  const surfaceClass =
    "mt-5 flex flex-1 flex-col rounded-[28px] bg-white/74 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-white/70";
  const inputClass = cn(ui.input, "px-5 py-4");
  const uploadDropZoneClass =
    "mt-10 flex min-h-[420px] flex-col items-center justify-center rounded-[34px] border-[3px] border-dashed px-8 py-10 text-center transition duration-200 ease-out";
  const localSecondaryButtonClass =
    "inline-flex h-16 w-full items-center justify-center rounded-full bg-[#F1F1F3] px-8 text-[17px] font-semibold tracking-[-0.03em] text-[#1D1D1F] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition duration-200 ease-out hover:scale-[1.01] hover:bg-[#ECECEF] focus:outline-none focus:ring-4 focus:ring-[#007AFF]/10 disabled:pointer-events-none disabled:opacity-60";
  const localPrimaryButtonClass =
    "inline-flex h-16 w-full items-center justify-center rounded-full bg-[#007AFF] px-8 text-[17px] font-semibold tracking-[-0.03em] text-white shadow-[0_16px_32px_rgba(0,122,255,0.22)] transition duration-200 ease-out hover:scale-[1.01] hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-[#007AFF]/18 disabled:pointer-events-none disabled:opacity-60";

  function setChosenFile(file: File | null) {
    setSelectedFile(file);
    setUploadError(null);
    setUploadProgress(0);
  }

  async function handleLocalUpload() {
    if (!selectedFile) {
      setUploadError("Choose a video file first.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const video = await uploadLocalVideo(selectedFile, setUploadProgress);
      onSuccess();
      navigate(`/videos/${video.id}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleImport() {
    if (!urlValue.trim()) {
      setImportError("Paste a public video URL first.");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const video = await importVideoFromUrl(urlValue.trim(), nameValue.trim() || undefined);
      onSuccess();
      navigate(`/videos/${video.id}`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section
      className={cn(
        compact ? "grid gap-4 xl:grid-cols-[1.02fr,0.98fr] xl:items-start" : "grid gap-4 lg:grid-cols-[1.02fr,0.98fr]",
        !compact && ui.panel,
        !compact && "p-4 sm:p-5",
      )}
    >
      <div className={panelClass}>
        {!compact ? (
          <div className="max-w-2xl">
            <p className={ui.eyebrow}>Upload</p>
            <h2 className={ui.sectionTitle}>Large-file ingestion designed to stay fast and calm.</h2>
            <p className={`${ui.body} mt-3`}>
              Local uploads use direct multipart transfer to object storage, while remote imports keep your annotation workflow moving without manual file handling.
            </p>
          </div>
        ) : null}

        <div className={cn("max-w-lg", compact ? "" : "mt-1")}>
          {compact ? <p className={ui.eyebrow}>Local upload</p> : null}
          <h3 className="mt-2 text-[24px] font-medium tracking-[-0.03em] text-[#1D1D1F]">Drop a file to start</h3>
          <p className="mt-2 text-[14px] leading-6 text-[#6E6E73]">
            Files upload directly to storage in multipart chunks so large videos stay fast and reliable.
          </p>
        </div>

        <div
          className={cn(
            uploadDropZoneClass,
            "bg-[#FBFBFD]",
            compact && "mt-8 min-h-[350px] px-7 py-8 xl:min-h-[360px]",
            isDragging
              ? "scale-[1.01] border-[#8DBAFF] bg-[#F7FAFF] shadow-[0_24px_50px_rgba(0,122,255,0.1)]"
              : "border-[#D4D7DF] hover:border-[#BCC9E6]",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            const relatedTarget = event.relatedTarget;
            if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
              return;
            }
            setIsDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isDragging) {
              setIsDragging(true);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            setChosenFile(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          <div className={cn("flex items-center justify-center rounded-full bg-[#DCEAFF] text-[#007AFF]", compact ? "h-24 w-24 xl:h-20 xl:w-20" : "h-28 w-28")}>
            <svg aria-hidden="true" className={cn(compact ? "h-9 w-9 xl:h-8 xl:w-8" : "h-11 w-11")} fill="none" viewBox="0 0 24 24">
              <path
                d="M12 16V6m0 0-4 4m4-4 4 4M6 17.5a3.5 3.5 0 0 0 .5 7h11a3.5 3.5 0 0 0 .26-6.99A5 5 0 0 0 8.5 15"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
              />
            </svg>
          </div>
          <p className={cn("font-semibold tracking-[-0.04em] text-[#1D1D1F]", compact ? "mt-6 text-[21px] sm:text-[22px]" : "mt-8 text-[24px] sm:text-[25px]")}>
            Drag and drop your video
          </p>
          <p className={cn("max-w-[430px] text-[#6E6E73]", compact ? "mt-3 text-[14px] leading-6 sm:text-[15px]" : "mt-4 text-[15px] leading-7 sm:text-[16px]")}>
            Drop a file here for direct multipart upload, or choose one manually. This flow is tuned for large MP4 and MOV files.
          </p>

          <input
            accept="video/*"
            className="hidden"
            ref={fileInputRef}
            type="file"
            onChange={(event) => {
              setChosenFile(event.target.files?.[0] ?? null);
            }}
          />

          <div className={cn("grid w-full max-w-[600px] gap-4 sm:grid-cols-[0.9fr,1.1fr]", compact ? "mt-7 max-w-[520px]" : "mt-10")}>
            <button
              className={cn(localSecondaryButtonClass, compact && "h-14 text-[16px]")}
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </button>
            <button
              className={cn(localPrimaryButtonClass, compact && "h-14 text-[16px]")}
              disabled={isUploading}
              type="button"
              onClick={handleLocalUpload}
            >
              {isUploading ? "Uploading..." : "Upload Video"}
            </button>
          </div>

          {selectedFile ? (
            <div className={cn("inline-flex max-w-full items-center rounded-full bg-[#EFF5FF] px-4 py-2.5 text-sm text-[#1D1D1F] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]", compact ? "mt-4" : "mt-5")}>
              <span className="truncate font-medium">{selectedFile.name}</span>
            </div>
          ) : null}

          {isUploading ? (
            <div className={cn("w-full max-w-[340px]", compact ? "mt-4" : "mt-5")}>
              <div className="h-2 overflow-hidden rounded-full bg-black/8">
                <div
                  className="h-full rounded-full bg-[#007AFF] transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-[#6E6E73]">Uploading {Math.round(uploadProgress * 100)}%</p>
            </div>
          ) : null}
        </div>

        {uploadError ? <p className={cn(ui.errorText, "mt-4")}>{uploadError}</p> : null}
      </div>

      <div className={panelClass}>
        <div className="max-w-lg">
          <p className={ui.eyebrow}>Import</p>
          <h3 className="mt-2 text-[24px] font-medium tracking-[-0.03em] text-[#1D1D1F]">Import from a public video URL</h3>
          <p className="mt-2 text-[14px] leading-6 text-[#6E6E73]">
            Paste a directly accessible video URL and optionally give it a cleaner display name before import.
          </p>
        </div>

        <div className={cn(surfaceClass, "px-6 py-6 sm:px-7 sm:py-7", compact && "min-h-0")}>
          <div className="max-w-[400px]">
            <p className="text-[20px] font-medium tracking-[-0.03em] text-[#1D1D1F]">Paste your video URL</p>
            <p className="mt-3 text-[14px] leading-6 text-[#6E6E73]">
              Start a background import from a direct MP4 or MOV link and move into review as soon as processing completes.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <input
              className={inputClass}
              placeholder="https://example.com/video.mp4"
              value={urlValue}
              onChange={(event) => {
                setUrlValue(event.target.value);
                setImportError(null);
              }}
            />
            <input
              className={inputClass}
              placeholder="Optional display name"
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
            />
          </div>

          {importError ? <p className={cn(ui.errorText, "mt-4")}>{importError}</p> : null}

          <div className="mt-6 flex">
            <button
              className={cn(ui.primaryButton, "w-full sm:w-auto")}
              disabled={isImporting}
              type="button"
              onClick={handleImport}
            >
              {isImporting ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
