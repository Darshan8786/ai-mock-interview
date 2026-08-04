import { motion, AnimatePresence } from "framer-motion";

interface CheatingWarningProps {
  message: string | null;
  count: number;
  maxCount: number;
  onDismiss?: () => void;
}

export function CheatingWarning({
  message,
  count,
  maxCount,
  onDismiss,
}: CheatingWarningProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -50, x: "-50%" }}
          className="fixed top-4 left-1/2 z-50 min-w-[320px]"
        >
          <div className="bg-red-500/90 backdrop-blur-md text-white rounded-xl shadow-2xl border border-red-400/50 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Cheating Detected</p>
                <p className="text-sm text-red-100 mt-0.5">{message}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold">
                    {count}/{maxCount}
                  </span>
                </div>
                <p className="text-[10px] text-red-200 mt-1">
                  {count >= maxCount
                    ? "Interview will be terminated"
                    : `${maxCount - count} more violation${
                        maxCount - count > 1 ? "s" : ""
                      } will terminate the interview`}
                </p>
              </div>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
