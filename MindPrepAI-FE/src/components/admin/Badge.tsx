import type { ReactNode } from "react";

export type BadgeTone = "gray" | "green" | "yellow" | "red" | "blue" | "purple";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  yellow: "bg-violet-100 text-violet-800 ring-violet-200",
  red: "bg-rose-100 text-rose-700 ring-rose-200",
  blue: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  purple: "bg-violet-100 text-violet-700 ring-violet-200",
};

export function Badge({ children, tone = "gray" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${tones[tone]}`}>
      {children}
    </span>
  );
}
