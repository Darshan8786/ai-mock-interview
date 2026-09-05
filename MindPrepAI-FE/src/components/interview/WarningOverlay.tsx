import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface WarningOverlayProps {
  warnings: any[];
  cheatingCount: number;
  maxViolations: number;
  onDismiss: () => void;
}

export function WarningOverlay({ warnings, cheatingCount, maxViolations, onDismiss }: WarningOverlayProps) {
  useEffect(() => {
    if (warnings.length > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [warnings, onDismiss]);

  return (
    <AnimatePresence>
      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md pointer-events-none"
        >
          <div className="bg-red-500/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl shadow-red-500/20 border border-red-400">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Proctoring Warning</h3>
                <div className="mt-1 space-y-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-sm opacity-90">• {w.message}</p>
                  ))}
                </div>
                <p className="text-xs font-semibold mt-3 text-red-100 bg-black/20 inline-block px-2 py-1 rounded">
                  Violation {cheatingCount} of {maxViolations}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
