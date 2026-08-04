import { motion, AnimatePresence } from "framer-motion";

interface WarningOverlayProps {
  warnings: string[];
  cheatingCount: number;
  maxViolations: number;
  onDismiss: (warning: string) => void;
}

export function WarningOverlay({
  warnings,
  cheatingCount,
  maxViolations,
  onDismiss,
}: WarningOverlayProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm space-y-2">
      <AnimatePresence>
        {warnings.slice(0, 3).map((warning, i) => (
          <motion.div
            key={`${warning}-${i}`}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`rounded-xl p-3 border shadow-xl backdrop-blur-sm ${
              cheatingCount >= maxViolations
                ? "bg-red-500/20 border-red-500/40"
                : "bg-yellow-500/20 border-yellow-500/40"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg mt-0.5">
                {cheatingCount >= maxViolations ? "🚫" : "⚠️"}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  cheatingCount >= maxViolations ? "text-red-300" : "text-yellow-300"
                }`}>
                  {warning}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 bg-gray-700/50 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        cheatingCount >= maxViolations
                          ? "bg-red-500"
                          : "bg-yellow-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (cheatingCount / maxViolations) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {cheatingCount}/{maxViolations}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onDismiss(warning)}
                className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
