import { motion } from "framer-motion";

interface ScoreItem {
  label: string;
  score: number;
  color?: string;
}

interface ScoreCardProps {
  title: string;
  items: ScoreItem[];
}

export function ScoreCard({ title, items }: ScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
    >
      <h3 className="text-lg font-semibold text-white mb-5">{title}</h3>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-gray-400">{item.label}</span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-sm font-bold tabular-nums ${getScoreColor(item.score)}`}
              >
                {item.score}%
              </motion.span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.score}%` }}
                transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                className={`h-full rounded-full ${getBarColor(item.score)}`}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
