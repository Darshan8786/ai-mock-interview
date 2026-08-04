import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from "react";
import { motion } from "framer-motion";

interface TimerProps {
  totalSeconds?: number;
  onTimeUp?: () => void;
  label?: string;
}

export interface TimerHandle {
  reset: () => void;
  getElapsed: () => number;
}

export const Timer = forwardRef<TimerHandle, TimerProps>(
  ({ totalSeconds = 120, onTimeUp, label = "Question Timer" }, ref) => {
    const [remaining, setRemaining] = useState(totalSeconds);
    const [isRunning, setIsRunning] = useState(true);
    const elapsedRef = useRef(0);
    const startTimeRef = useRef(Date.now());

    useImperativeHandle(ref, () => ({
      reset: () => {
        setRemaining(totalSeconds);
        setIsRunning(true);
        elapsedRef.current = 0;
        startTimeRef.current = Date.now();
      },
      getElapsed: () => elapsedRef.current,
    }));

    useEffect(() => {
      if (!isRunning) return;

      const interval = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsRunning(false);
            onTimeUp?.();
            return 0;
          }
          return prev - 1;
        });
        elapsedRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
      }, 1000);

      return () => clearInterval(interval);
    }, [isRunning, onTimeUp]);

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const progress = remaining / totalSeconds;
    const isWarning = remaining <= 30;
    const isCritical = remaining <= 10;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-gray-700"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-medium">{label}</span>
          <motion.span
            key={remaining}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className={`font-mono text-xl font-bold tabular-nums ${
              isCritical ? "text-red-400" : isWarning ? "text-yellow-400" : "text-white"
            }`}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </motion.span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full transition-colors duration-300 ${
              isCritical ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-emerald-500"
            }`}
            initial={{ width: "100%" }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </motion.div>
    );
  }
);

Timer.displayName = "Timer";
