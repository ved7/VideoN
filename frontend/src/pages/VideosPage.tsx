import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { UploadPanel } from "../components/UploadPanel";
import { VideoCard } from "../components/VideoCard";
import { deleteVideo, fetchVideos } from "../lib/api";
import { cn, ui } from "../lib/ui";
import type { VideoListItem } from "../types/api";

export function VideosPage() {
  const queryClient = useQueryClient();
  const videosQuery = useQuery({
    queryKey: ["videos"],
    queryFn: fetchVideos,
    refetchInterval: (query) => {
      const videos = query.state.data ?? [];
      return videos.some((video) => video.status === "UPLOADING" || video.status === "PROCESSING") ? 5000 : false;
    },
  });
  const deleteVideoMutation = useMutation({
    mutationFn: async (video: VideoListItem) => {
      await deleteVideo(video.id);
      return video.id;
    },
    onSuccess: (deletedVideoId) => {
      queryClient.setQueryData<VideoListItem[]>(["videos"], (current) =>
        current?.filter((video) => video.id !== deletedVideoId) ?? current,
      );
      queryClient.removeQueries({ queryKey: ["video", deletedVideoId] });
    },
  });

  const heroHighlights = ["Multi-GB uploads", "Frame-aware notes", "Summary ready"];

  async function handleDeleteVideo(video: VideoListItem) {
    const shouldDelete = window.confirm(`Delete "${video.name}" from the library? This will remove its video file, snapshots, and annotations.`);
    if (!shouldDelete) {
      return;
    }

    await deleteVideoMutation.mutateAsync(video);
  }

  return (
    <div className="space-y-8">
      <section className={cn(ui.panel, "p-3 sm:p-4 lg:p-5")}>
        <div className="grid gap-4 xl:grid-cols-[0.84fr,1.16fr] xl:items-start">
          <div className="relative overflow-hidden rounded-[34px] px-7 py-8 sm:px-9 sm:py-9 xl:min-h-[400px]">
            <div className="absolute inset-0 rounded-[34px] bg-[radial-gradient(circle_at_top_left,_rgba(0,122,255,0.14),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.96),transparent_26%),linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.62))]" />
            <div className="absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-[#007AFF]/[0.045] blur-3xl" />

            <div className="relative flex h-full flex-col justify-between gap-10">
              <div className="max-w-[560px]">
                <div className="inline-flex items-center rounded-full bg-white/72 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-[#6E6E73] shadow-[0_10px_26px_rgba(15,23,42,0.05)] ring-1 ring-white/80">
                  VideoN workspace
                </div>

                <h1 className="mt-6 max-w-[11ch] text-[clamp(2.7rem,4.2vw,4.35rem)] font-medium leading-[0.94] tracking-[-0.065em] text-[#1D1D1F]">
                  <span className="block">Upload videos.</span>
                  <span className="block">Annotate precisely.</span>
                  <span className="block">Generate insights.</span>
                </h1>

                <p className="mt-6 max-w-[490px] text-[16px] leading-7 text-[#6E6E73] sm:text-[17px]">
                  Large-file review, frame-aware notes, and clean summaries in one calm workspace from first upload to final insight.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {heroHighlights.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full bg-white/72 px-4 py-2 text-[13px] font-medium tracking-[-0.01em] text-[#3A3A3C] shadow-[0_10px_24px_rgba(15,23,42,0.05)] ring-1 ring-white/75"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <UploadPanel compact onSuccess={() => void videosQuery.refetch()} />
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={ui.eyebrow}>Library</p>
            <h2 className={ui.sectionTitle}>Recent videos</h2>
            <p className={`${ui.body} mt-2 max-w-2xl`}>
              Every upload stays available here with processing state, duration, and quick access to the annotation workspace.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full bg-white/75 px-4 py-2 text-sm text-[#6E6E73] shadow-[0_10px_20px_rgba(15,23,42,0.05)] ring-1 ring-white/70">
            {(videosQuery.data ?? []).length} video{(videosQuery.data ?? []).length === 1 ? "" : "s"}
          </div>
        </div>

        {videosQuery.isLoading ? <p className={ui.subtleText}>Loading videos...</p> : null}
        {videosQuery.isError ? <p className={ui.errorText}>{(videosQuery.error as Error).message}</p> : null}
        {deleteVideoMutation.isError ? (
          <p className={ui.errorText}>
            {(deleteVideoMutation.error as Error).message || "Could not delete the selected video."}
          </p>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(videosQuery.data ?? []).map((video) => (
            <VideoCard
              key={video.id}
              deleting={deleteVideoMutation.isPending && deleteVideoMutation.variables?.id === video.id}
              video={video}
              onDelete={(selectedVideo) => {
                void handleDeleteVideo(selectedVideo);
              }}
            />
          ))}
        </div>

        {videosQuery.data?.length === 0 ? (
          <div className={cn(ui.panel, "px-8 py-10 text-center")}>
            <p className="text-lg font-medium tracking-[-0.02em] text-[#1D1D1F]">No videos yet</p>
            <p className={`${ui.body} mt-2`}>
              Start with a local upload or a public MP4 URL and the library will populate automatically.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
