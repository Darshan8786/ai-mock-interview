import { motion } from "framer-motion";

interface CheatingCounterProps {
  count: number;
  maxCount: number;
}

export function CheatingCounter({ count, maxCount }: CheatingCounterProps) {
  const severity = count === 0 ? "safe" : count >= maxCount ? "danger" : "warning";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-3 border ${
        severity === "safe"
          ? "bg-emerald-500/10 border-emerald-500/30"
          : severity === "warning"
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-red-500/10 border-red-500/30"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${
          severity === "safe"
            ? "text-emerald-400"
            : severity === "warning"
            ? "text-yellow-400"
            : "text-red-400"
        }`}>
          Integrity Status
        </span>
        <span className={`text-lg font-bold ${
          severity === "safe"
            ? "text-emerald-400"
            : severity === "warning"
            ? "text-yellow-400"
            : "text-red-400"
        }`}>
          {count}/{maxCount}
        </span>
      </div>
      <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (count / maxCount) * 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full rounded-full ${
            severity === "safe"
              ? "bg-emerald-500"
              : severity === "warning"
              ? "bg-yellow-500"
              : "bg-red-500"
          }`}
        />
      </div>
      <p className={`text-xs mt-1.5 ${
        severity === "safe"
          ? "text-emerald-400/70"
          : severity === "warning"
          ? "text-yellow-400/70"
          : "text-red-400/70"
      }`}>
        {severity === "safe"
          ? "No violations detected"
          : severity === "warning"
          ? "Violations detected - continue responsibly"
          : "Maximum violations reached"}
      </p>
    </motion.div>
  );
}
