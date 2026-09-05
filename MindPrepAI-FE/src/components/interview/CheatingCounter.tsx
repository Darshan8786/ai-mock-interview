import { motion } from "framer-motion";

interface CheatingCounterProps {
  count: number;
  maxCount: number;
}

export function CheatingCounter({ count, maxCount }: CheatingCounterProps) {
  const isDanger = count >= maxCount - 1;
  
  return (
    <div className={`rounded-xl p-4 border transition-all ${
      count === 0 
        ? "bg-gray-800/50 border-gray-700" 
        : isDanger 
          ? "bg-red-500/10 border-red-500/50" 
          : "bg-yellow-500/10 border-yellow-500/50"
    }`}>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Violations
        </h4>
        <span className={`text-xs font-bold px-2 py-1 rounded-md ${
          count === 0 
            ? "bg-gray-700 text-gray-300" 
            : isDanger
              ? "bg-red-500/20 text-red-400"
              : "bg-yellow-500/20 text-yellow-400"
        }`}>
          {count} / {maxCount}
        </span>
      </div>
      
      <div className="flex gap-1 h-2">
        {Array.from({ length: maxCount }).map((_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{
              backgroundColor: i < count 
                ? (isDanger ? "#ef4444" : "#eab308") 
                : "#374151"
            }}
            className="flex-1 rounded-full"
          />
        ))}
      </div>
      
      {count > 0 && (
        <p className={`text-xs mt-2 ${isDanger ? "text-red-400" : "text-yellow-400"}`}>
          {isDanger ? "Warning: Interview will be terminated on next violation!" : "Please follow interview rules."}
        </p>
      )}
    </div>
  );
}
