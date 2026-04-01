import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { useOpenAiSession } from "./lib/openai-session";
import { cn, ui } from "./lib/ui";
import { VideoDetailsPage } from "./pages/VideoDetailsPage";
import { VideosPage } from "./pages/VideosPage";

function maskApiKey(value: string | null) {
  if (!value) {
    return "No key added";
  }

  if (value.length <= 10) {
    return "Added for this session";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openAiApiKey, hasSessionApiKey, setSessionApiKey, clearSessionApiKey } = useOpenAiSession();
  const showBackButton = location.pathname !== "/";
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [draftApiKey, setDraftApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (!isKeyModalOpen) {
      return;
    }

    setDraftApiKey(openAiApiKey ?? "");
    setShowApiKey(false);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsKeyModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isKeyModalOpen, openAiApiKey]);

  function handleSaveSessionKey() {
    setSessionApiKey(draftApiKey);
    setIsKeyModalOpen(false);
  }

  function handleClearSessionKey() {
    clearSessionApiKey();
    setDraftApiKey("");
    setShowApiKey(false);
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,_rgba(0,122,255,0.12),transparent_38%),radial-gradient(circle_at_70%_12%,rgba(255,255,255,0.95),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.5),rgba(245,245,247,0))]" />

      <header className="sticky top-0 z-30 border-b border-white/50 bg-[#F5F5F7]/80 backdrop-blur-2xl">
        <div className={`${ui.container} flex items-center justify-between gap-4 py-4`}>
          <div className="flex min-w-0 items-center">
            {showBackButton ? (
              <button
                aria-label="Go back"
                className="mr-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#1D1D1F] shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-white/75 transition duration-200 ease-out hover:scale-[1.02] hover:bg-white"
                type="button"
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1);
                    return;
                  }
                  navigate("/");
                }}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path
                    d="m15 18-6-6 6-6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            ) : null}

            <Link className="flex min-w-0 items-center gap-3 transition duration-200 ease-out hover:opacity-80" to="/">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#1D1D1F] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(29,29,31,0.18)]">
                V
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium tracking-[-0.02em] text-[#1D1D1F]">VideoN</span>
                <span className="truncate text-sm text-[#6E6E73]">Precise video annotation</span>
              </span>
            </Link>
          </div>

          <button
            className={cn(
              ui.secondaryButton,
              "min-h-10 shrink-0 gap-3 px-4 py-2 text-left sm:px-5",
              hasSessionApiKey && "ring-[#007AFF]/15",
            )}
            type="button"
            onClick={() => setIsKeyModalOpen(true)}
          >
            <span className="text-sm font-medium text-[#1D1D1F]">OpenAI Key</span>
            <span
              className={cn(
                "hidden rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
                hasSessionApiKey ? "bg-[#007AFF]/10 text-[#007AFF]" : "bg-[#F2F2F5] text-[#6E6E73]",
              )}
            >
              {hasSessionApiKey ? "Session active" : "Session only"}
            </span>
          </button>
        </div>
      </header>

      <main className={`${ui.container} pb-20 pt-6 sm:pt-8`}>
        <Routes>
          <Route path="/" element={<VideosPage />} />
          <Route path="/videos/:videoId" element={<VideoDetailsPage />} />
        </Routes>
      </main>

      {isKeyModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6">
          <button
            aria-label="Close OpenAI key dialog"
            className="absolute inset-0 bg-[#1D1D1F]/18 backdrop-blur-sm"
            type="button"
            onClick={() => setIsKeyModalOpen(false)}
          />

          <div className={cn(ui.panel, "relative z-10 w-full max-w-[560px] p-6 sm:p-7")}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className={ui.eyebrow}>OpenAI API key</p>
                <h2 className="text-[28px] font-medium tracking-[-0.035em] text-[#1D1D1F]">
                  Use a key for this session only
                </h2>
                <p className={ui.body}>
                  This key is kept only in this browser tab&apos;s memory, sent only with summary requests, and
                  cleared on refresh or when the tab closes.
                </p>
              </div>

              <button
                aria-label="Close"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#6E6E73] shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-white/75 transition duration-200 ease-out hover:bg-white"
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <label className={ui.eyebrow} htmlFor="openai-api-key">
                OpenAI API key
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  autoCapitalize="off"
                  autoComplete="new-password"
                  autoCorrect="off"
                  className={cn(ui.input, "flex-1")}
                  id="openai-api-key"
                  placeholder="sk-..."
                  spellCheck={false}
                  type={showApiKey ? "text" : "password"}
                  value={draftApiKey}
                  onChange={(event) => setDraftApiKey(event.target.value)}
                />
                <button
                  className={cn(ui.tertiaryButton, "sm:min-w-[88px]")}
                  type="button"
                  onClick={() => setShowApiKey((current) => !current)}
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className={cn(ui.secondaryPanel, "mt-4 space-y-2 p-4")}>
              <p className="text-sm font-medium tracking-[-0.02em] text-[#1D1D1F]">Current session status</p>
              <p className={ui.subtleText}>{maskApiKey(openAiApiKey)}</p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                className={ui.tertiaryButton}
                disabled={!hasSessionApiKey}
                type="button"
                onClick={handleClearSessionKey}
              >
                Clear session key
              </button>

              <div className="flex flex-wrap gap-3">
                <button className={ui.tertiaryButton} type="button" onClick={() => setIsKeyModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className={ui.primaryButton}
                  disabled={draftApiKey.trim().length === 0}
                  type="button"
                  onClick={handleSaveSessionKey}
                >
                  Use for this session
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
