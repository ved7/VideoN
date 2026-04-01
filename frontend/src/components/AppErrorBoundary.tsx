import { Component, type ReactNode } from "react";

import { cn, ui } from "../lib/ui";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    console.error("Unhandled application error", error);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#F5F5F7] px-6 py-10 text-[#1D1D1F]">
        <div className="mx-auto max-w-3xl">
          <div className={cn(ui.panel, "px-8 py-12 text-center")}>
            <p className={ui.eyebrow}>Something went wrong</p>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.5rem)] font-medium tracking-[-0.05em] text-[#1D1D1F]">
              The workspace hit an unexpected error.
            </h1>
            <p className={`${ui.body} mx-auto mt-4 max-w-xl`}>
              Refreshing the page usually restores the current session. If the issue persists, reopen the workspace
              and try the action again.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                className={ui.primaryButton}
                type="button"
                onClick={() => window.location.reload()}
              >
                Reload workspace
              </button>
              <button
                className={ui.tertiaryButton}
                type="button"
                onClick={() => window.location.assign("/")}
              >
                Go to library
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
