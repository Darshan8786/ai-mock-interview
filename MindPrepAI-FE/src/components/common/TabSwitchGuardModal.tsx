import { motion, AnimatePresence } from "framer-motion";

interface TabSwitchGuardModalProps {
  /** Current violation count (1-based) to show a warning for. 0/undefined = hidden. */
  warningCount: number;
  /** True once the limit has been hit - swaps to the termination view. */
  terminated: boolean;
  maxCount?: number;
  /** Dismiss a (non-terminal) warning and resume the test. */
  onReturn: () => void;
  /** Leave the terminated session for its result/dashboard page. */
  onGoToResult: () => void;
}

const WARNING_COPY: Record<number, string> = {
  1: "Warning 1/3: Leaving the test window is not allowed. Please return to the test.",
  2: "Warning 2/3: You have switched tabs twice. One more tab switch will terminate your test.",
};

/**
 * Blocking, unmissable tab-switch violation modal shared by the mock
 * interview and the aptitude test/session pages. Distinct from the ambient
 * proctoring toast (WarningOverlay/CheatingWarning) used for face-detection
 * violations - this one requires an explicit acknowledgement, matching the
 * deterrent intent of a hard 3-strikes tab-switch rule.
 */
export function TabSwitchGuardModal({
  warningCount,
  terminated,
  maxCount = 3,
  onReturn,
  onGoToResult,
}: TabSwitchGuardModalProps) {
  const open = terminated || warningCount > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className={`text-lg font-bold tracking-wide ${terminated ? "text-red-300" : "text-yellow-300"}`}>
                {terminated ? "TEST TERMINATED" : "TAB SWITCH WARNING"}
              </h2>
            </div>

            {terminated ? (
              <div className="space-y-2 mb-6">
                <p className="text-white font-medium">You switched tabs {maxCount} times.</p>
                <p className="text-gray-300 text-sm">Your test has been terminated.</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <p className="text-sm font-semibold text-yellow-300">
                  Warning {warningCount}/{maxCount}
                </p>
                <p className="text-white text-sm">
                  {WARNING_COPY[warningCount] ?? `Warning ${warningCount}/${maxCount}: Leaving the test window is not allowed.`}
                </p>
              </div>
            )}

            <button
              onClick={terminated ? onGoToResult : onReturn}
              className={`w-full px-4 py-3 rounded-xl font-semibold transition-all ${
                terminated
                  ? "bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                  : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/30"
              }`}
            >
              {terminated ? "Go to Result" : "Return to Test"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
