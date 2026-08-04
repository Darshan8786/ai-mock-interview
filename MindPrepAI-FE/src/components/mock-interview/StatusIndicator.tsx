import { motion } from "framer-motion";

interface StatusItem {
  label: string;
  active: boolean;
  color?: string;
}

interface StatusIndicatorProps {
  items: StatusItem[];
}

export function StatusIndicator({ items }: StatusIndicatorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            item.active
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          <motion.div
            animate={{ scale: item.active ? [1, 1.2, 1] : 1 }}
            transition={{ repeat: item.active ? Infinity : 0, duration: 2 }}
            className={`w-2 h-2 rounded-full ${
              item.active ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          {item.label}
        </motion.div>
      ))}
    </div>
  );
}
