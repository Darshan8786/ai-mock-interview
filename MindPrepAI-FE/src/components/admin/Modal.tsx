import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.97, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            className={`glass !bg-white/90 rounded-2xl overflow-hidden w-full ${sizes[size]} max-h-[90vh] flex flex-col shadow-2xl shadow-indigo-900/20`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 gloss !shadow-none bg-gradient-to-r from-indigo-600 via-violet-600 to-violet-600">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto text-slate-700">{children}</div>
            {footer && (
              <div className="px-6 py-3.5 border-t border-white bg-indigo-50/50 flex justify-end gap-2">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
