import { motion } from "framer-motion";
import { Button } from "./Button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center"
    >
      <p className="text-red-400 font-medium mb-3">{message}</p>
      {onRetry && <Button variant="danger" onClick={onRetry}>Retry</Button>}
    </motion.div>
  );
}
