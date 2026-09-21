import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { submitTechQuizAnswer, finishTechQuiz } from "../services/techQuizApi";
import type { AnswerResult, StartTechQuizResult, TechQuestionDTO } from "../services/techQuizApi";

// Every correct answer, score, and explanation shown here comes back from
// the local dataset via the backend/ai-service - this page never decides
// correctness itself, it only renders what the server already graded.
function questionInputKind(q: TechQuestionDTO): "mcq" | "code" | "text" {
  if (q.question_type === "MCQ") return "mcq";
  if (["Coding", "Programming Problem", "SQL Query", "Debugging"].includes(q.question_type)) return "code";
  return "text";
}

export function TechQuizSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = (location.state as { result: StartTechQuizResult } | null)?.result;

  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [finishing, setFinishing] = useState(false);
  const startTime = useRef(Date.now());

  const questions = result?.questions || [];
  const current = questions[index];
  const kind = useMemo(() => (current ? questionInputKind(current) : "text"), [current]);
  const isLast = index >= questions.length - 1;

  if (!result || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No active quiz session found.</p>
          <button
            onClick={() => navigate("/tech-practice")}
            className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium"
          >
            Back to Technical Practice
          </button>
        </div>
      </div>
    );
  }

  const currentAnswer = kind === "mcq" ? selectedOption : textAnswer;
  const canSubmit = kind === "mcq" ? selectedOption !== null : textAnswer.trim().length > 0;

  const handleSubmitAnswer = async () => {
    if (!canSubmit || submitting || feedback) return;
    setSubmitting(true);
    try {
      const res = await submitTechQuizAnswer(result.attemptId, {
        questionId: current.id,
        answer: currentAnswer,
      });
      setFeedback(res);
    } catch {
      setFeedback({
        isCorrect: false,
        score: 0,
        correctAnswer: "",
        explanation: "Could not reach the local evaluator - this question was not scored.",
        answeredCount: index,
        totalQuestions: questions.length,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (isLast) {
      setFinishing(true);
      try {
        const timeTaken = Math.floor((Date.now() - startTime.current) / 1000);
        const finalResult = await finishTechQuiz(result.attemptId, { timeTaken });
        navigate("/tech-practice/result", { state: { result: finalResult } });
      } catch {
        navigate("/tech-practice/result", { state: { result: null } });
      }
      return;
    }
    setIndex((i) => i + 1);
    setSelectedOption(null);
    setTextAnswer("");
    setFeedback(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">{result.technology} Practice</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {current.topic} · {current.difficulty} · {current.question_type}
            </p>
          </div>
        </div>

        {result.repeatedCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-300 text-xs mb-6">
            You've seen most/all of the {result.technology} question bank at this difficulty - {result.repeatedCount}{" "}
            question{result.repeatedCount > 1 ? "s" : ""} in this set repeat from an earlier session.
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700"
          >
            <p className="text-lg text-white font-medium mb-5 whitespace-pre-wrap">{current.question}</p>

            {current.code_snippet && (
              <pre className="bg-black/40 rounded-xl p-4 text-sm text-emerald-300 overflow-x-auto mb-5 font-mono">
                {current.code_snippet}
              </pre>
            )}
            {current.buggy_code && (
              <pre className="bg-black/40 rounded-xl p-4 text-sm text-red-300 overflow-x-auto mb-5 font-mono">
                {current.buggy_code}
              </pre>
            )}
            {current.schema_context && (
              <pre className="bg-black/40 rounded-xl p-4 text-sm text-blue-300 overflow-x-auto mb-5 font-mono">
                {current.schema_context}
              </pre>
            )}
            {current.starter_code && (
              <pre className="bg-black/40 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto mb-5 font-mono">
                {current.starter_code}
              </pre>
            )}

            {kind === "mcq" && (
              <div className="space-y-3 mb-2">
                {current.options?.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const showCorrectness = !!feedback;
                  const isTheCorrectOne = showCorrectness && opt === feedback.correctAnswer;
                  return (
                    <button
                      key={idx}
                      disabled={!!feedback}
                      onClick={() => setSelectedOption(idx)}
                      className={`w-full text-left px-5 py-3.5 rounded-xl text-sm font-medium transition-all border-2 ${
                        showCorrectness
                          ? isTheCorrectOne
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                            : isSelected
                            ? "bg-red-500/20 text-red-400 border-red-500/50"
                            : "bg-gray-700/30 text-gray-400 border-gray-700"
                          : isSelected
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                          : "bg-gray-700/50 text-gray-300 border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      <span className="mr-3 font-mono text-xs opacity-60">{String.fromCharCode(65 + idx)}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {kind === "code" && (
              <textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                disabled={!!feedback}
                rows={8}
                placeholder="Write your solution / query / fix here…"
                className="w-full bg-black/30 border border-gray-600 rounded-xl p-4 text-sm text-white font-mono resize-none focus:outline-none focus:border-emerald-500/50 disabled:opacity-70"
              />
            )}

            {kind === "text" && (
              <textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                disabled={!!feedback}
                rows={4}
                placeholder="Type your answer…"
                className="w-full bg-black/30 border border-gray-600 rounded-xl p-4 text-sm text-white resize-none focus:outline-none focus:border-emerald-500/50 disabled:opacity-70"
              />
            )}

            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-5 rounded-xl p-4 border ${
                  feedback.isCorrect ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
                }`}
              >
                <p className={`text-sm font-semibold mb-1 ${feedback.isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                  {feedback.isCorrect ? "Correct" : "Not quite"} {typeof feedback.score === "number" && `(${feedback.score}%)`}
                </p>
                {feedback.correctAnswer && kind !== "mcq" && (
                  <p className="text-sm text-white mb-2">
                    <span className="text-gray-400">Correct answer: </span>
                    <span className="whitespace-pre-wrap font-mono">{feedback.correctAnswer}</span>
                  </p>
                )}
                {feedback.explanation && <p className="text-sm text-gray-300">{feedback.explanation}</p>}
              </motion.div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              {!feedback ? (
                <>
                  <button
                    onClick={handleNext}
                    disabled={submitting || finishing}
                    className="px-6 py-2.5 bg-gray-700/50 text-gray-300 rounded-xl border border-gray-600 hover:border-gray-500 transition-all disabled:opacity-50 font-medium"
                  >
                    {finishing ? "Scoring…" : isLast ? "Skip & Finish →" : "Next Question →"}
                  </button>
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!canSubmit || submitting}
                    className="px-6 py-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50 font-medium"
                  >
                    {submitting ? "Checking…" : "Submit Answer"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={finishing}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-60"
                >
                  {finishing ? "Scoring…" : isLast ? "Finish & See Results" : "Next Question →"}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
