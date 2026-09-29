import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { GRADIENTS, type GradientName } from "./gradients";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** Colour hint such as "bg-violet-50"; the hue picks the card gradient. */
  color: string;
  trend?: string;
  trendUp?: boolean;
}

const HUES: [string, GradientName][] = [
  ["indigo", "indigo"],
  ["purple", "violet"],
  ["emerald", "deep"],
  ["cyan", "soft"],
  ["red", "violet"],
  ["green", "indigo"],
];

export function StatCard({ label, value, icon, color, trend, trendUp }: StatCardProps) {
  const g = HUES.find(([h]) => color.includes(h))?.[1] || "indigo";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} className="h-full">
      <div className={`gloss rounded-2xl p-5 h-full text-white bg-gradient-to-br ${GRADIENTS[g]}`}>
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/15" />
        <div className="absolute -right-2 -bottom-10 w-20 h-20 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-white/90">{label}</p>
          <div className="w-10 h-10 shrink-0 rounded-xl gloss-sm bg-white/20 ring-1 ring-white/40 flex items-center justify-center [&_svg]:!text-white [&_svg]:w-5 [&_svg]:h-5">
            {icon}
          </div>
        </div>
        <p className="relative text-3xl font-bold mt-3 tracking-tight drop-shadow-sm">{value}</p>
        {trend && (
          <p className="relative text-xs font-medium mt-2 text-white/90">
            {trendUp ? "▲" : "▼"} {trend}
          </p>
        )}
      </div>
    </motion.div>
  );
}
