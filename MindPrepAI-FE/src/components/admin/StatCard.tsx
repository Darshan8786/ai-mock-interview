import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** Legacy dark-theme tint class (e.g. "bg-blue-500/15"); mapped to a light tint below. */
  color: string;
  trend?: string;
  trendUp?: boolean;
}

const TINTS: Record<string, string> = {
  blue: "bg-indigo-50 text-indigo-600",
  purple: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  cyan: "bg-cyan-50 text-cyan-600",
  red: "bg-rose-50 text-rose-600",
  green: "bg-emerald-50 text-emerald-600",
  yellow: "bg-amber-50 text-amber-600",
  amber: "bg-amber-50 text-amber-600",
};

export function StatCard({ label, value, icon, color, trend, trendUp }: StatCardProps) {
  const hue = Object.keys(TINTS).find((h) => color.includes(h)) || "blue";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 h-full">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center [&_svg]:text-current [&_svg]:w-[18px] [&_svg]:h-[18px] ${TINTS[hue]}`}>
            {icon}
          </div>
        </div>
        <p className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight">{value}</p>
        {trend && (
          <p className={`text-xs font-medium mt-2 ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>
            {trendUp ? "▲" : "▼"} {trend}
          </p>
        )}
      </div>
    </motion.div>
  );
}
