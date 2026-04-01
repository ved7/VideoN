export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const ui = {
  container: "mx-auto w-full max-w-[1440px] px-5 sm:px-6 lg:px-8 xl:px-10",
  panel:
    "rounded-[32px] bg-white/60 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-white/70 backdrop-blur-[20px]",
  secondaryPanel:
    "rounded-[28px] bg-white/72 shadow-[0_14px_40px_rgba(15,23,42,0.06)] ring-1 ring-white/70 backdrop-blur-xl",
  tertiaryPanel: "rounded-[24px] bg-white/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ring-1 ring-white/65",
  eyebrow: "text-[11px] font-medium uppercase tracking-[0.22em] text-[#6E6E73]",
  sectionTitle: "text-[28px] font-medium leading-tight tracking-[-0.035em] text-[#1D1D1F] sm:text-[34px]",
  body: "text-[15px] leading-7 text-[#6E6E73]",
  input:
    "w-full rounded-[18px] border border-white/50 bg-[#ECECEF]/85 px-4 py-3 text-[15px] text-[#1D1D1F] placeholder:text-[#8E8E93] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition duration-200 ease-out focus:bg-white focus:ring-4 focus:ring-[#007AFF]/14",
  textarea:
    "w-full rounded-[20px] border border-white/50 bg-[#ECECEF]/85 px-4 py-3 text-[15px] text-[#1D1D1F] placeholder:text-[#8E8E93] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition duration-200 ease-out focus:bg-white focus:ring-4 focus:ring-[#007AFF]/14",
  primaryButton:
    "inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#007AFF] px-5 text-[15px] font-medium text-white shadow-[0_12px_24px_rgba(0,122,255,0.22)] transition duration-200 ease-out hover:scale-[1.02] hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-[#007AFF]/20 disabled:pointer-events-none disabled:opacity-60",
  secondaryButton:
    "inline-flex min-h-11 items-center justify-center rounded-[14px] bg-white/85 px-5 text-[15px] font-medium text-[#1D1D1F] shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-white/70 transition duration-200 ease-out hover:scale-[1.02] hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#007AFF]/12 disabled:pointer-events-none disabled:opacity-60",
  tertiaryButton:
    "inline-flex min-h-11 items-center justify-center rounded-[14px] bg-white/50 px-4 text-[14px] font-medium text-[#1D1D1F] shadow-[0_8px_18px_rgba(15,23,42,0.05)] ring-1 ring-white/70 transition duration-200 ease-out hover:scale-[1.02] hover:bg-white/75 focus:outline-none focus:ring-4 focus:ring-[#007AFF]/10 disabled:pointer-events-none disabled:opacity-60",
  subtleText: "text-sm leading-6 text-[#6E6E73]",
  errorText: "text-sm leading-6 text-[#C9342B]",
} as const;
