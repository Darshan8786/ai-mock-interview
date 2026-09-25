import { motion, AnimatePresence } from "framer-motion";

interface FullscreenGuardModalProps {
  /** Which violation to warn about (1-based). 0 = none. */
  warningCount: number;
  /** True once the limit is hit — swaps to the termination view. */
  terminated: boolean;
  maxCount?: number;
  /** Re-enter fullscreen (must run from this button's click: browsers require a user gesture). */
  onReturn: () => void;
  /** Set when the browser refused to re-enter fullscreen, so the reason is visible. */
  enterFailed?: boolean;
}

const WARNING_COPY: Record<number, string> = {
  1: "Warning 1/3: Please return to full-screen mode.",
  2: "Warning 2/3: Leaving full-screen again will terminate the interview.",
};

/**
 * Blocking fullscreen-violation modal for the interview room. Same visual language
 * and intent as TabSwitchGuardModal: it requires an explicit action, so the
 * candidate cannot carry on in a window.
 */
export function FullscreenGuardModal({
  warningCount,
  terminated,
  maxCount = 3,
  onReturn,
  enterFailed = false,
}: FullscreenGuardModalProps) {
  const open = terminated || warningCount > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="alertdialog"
          aria-live="assertive"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              terminated
                ? "bg-red-950/95 border-red-500/60 shadow-red-500/20"
                : "bg-gray-900/95 border-yellow-500/50 shadow-yellow-500/10"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  terminated ? "bg-red-500/20" : "bg-yellow-500/20"
                }`}
              >
                <svg
                  className={`w-6 h-6 ${terminated ? "text-red-400" : "text-yellow-400"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </div>
              <h2 className={`text-lg font-bold tracking-wide ${terminated ? "text-red-300" : "text-yellow-300"}`}>
                {terminated ? "INTERVIEW TERMINATED" : "FULL-SCREEN REQUIRED"}
              </h2>
            </div>

            {terminated ? (
              <div className="space-y-2">
                <p className="text-white font-medium">You left full-screen mode {maxCount} times.</p>
                <p className="text-gray-300 text-sm">Your interview has been terminated. Preparing your result…</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <p className="text-sm font-semibold text-yellow-300">
                  Warning {warningCount}/{maxCount}
                </p>
                <p className="text-white text-sm">
                  {WARNING_COPY[warningCount] ?? `Warning ${warningCount}/${maxCount}: Please return to full-screen mode.`}
                </p>
                {enterFailed && (
                  <p className="text-xs text-red-300">
                    Your browser did not allow full-screen. Click the button again, or press F11 / use the browser
                    menu to go full-screen.
                  </p>
                )}
              </div>
            )}

            {!terminated && (
              <button
                onClick={onReturn}
                autoFocus
                className="w-full px-4 py-3 rounded-xl font-semibold transition-all bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/30"
              >
                Return to Full Screen
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
