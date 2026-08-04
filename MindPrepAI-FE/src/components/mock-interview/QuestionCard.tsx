import { motion } from "framer-motion";

interface QuestionCardProps {
  question: string;
  questionNumber: number;
  totalQuestions: number;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
}: QuestionCardProps) {
  return (
    <motion.div
      key={questionNumber}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gradient-to-br from-gray-800 to-gray-800/50 rounded-2xl p-6 border border-gray-700"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium">
          Question {questionNumber} of {totalQuestions}
        </span>
      </div>
      <p className="text-lg md:text-xl text-white font-medium leading-relaxed">
        {question}
      </p>
    </motion.div>
  );
}
