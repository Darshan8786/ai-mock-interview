import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** Colour hint such as "bg-violet-50"; its hue tints the icon chip. */
  color: string;
  trend?: string;
  trendUp?: boolean;
}

const TINTS: [string, string][] = [
  ["indigo", "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"],
  ["purple", "bg-violet-500/10 text-violet-600 dark:text-violet-300"],
  ["violet", "bg-violet-500/10 text-violet-600 dark:text-violet-300"],
  ["emerald", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"],
  ["green", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"],
  ["cyan", "bg-sky-500/10 text-sky-600 dark:text-sky-300"],
  ["blue", "bg-sky-500/10 text-sky-600 dark:text-sky-300"],
  ["amber", "bg-amber-500/10 text-amber-600 dark:text-amber-300"],
  ["red", "bg-rose-500/10 text-rose-600 dark:text-rose-300"],
];

export function StatCard({ label, value, icon, color, trend, trendUp }: StatCardProps) {
  const tint = TINTS.find(([h]) => color.includes(h))?.[1] || TINTS[0][1];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full">
      <div className="h-full rounded-xl bg-surface border border-line shadow-card p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted">{label}</p>
          <span className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5 [&_svg]:!text-current ${tint}`}>
            {icon}
          </span>
        </div>
        <p className="text-3xl font-bold text-fg mt-2 tracking-tight">{value}</p>
        {trend && (
          <p className={`text-xs font-medium mt-2 ${trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {trendUp ? "▲" : "▼"} {trend}
          </p>
        )}
      </div>
    </motion.div>
  );
}
