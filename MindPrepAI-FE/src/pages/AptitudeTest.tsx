import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  getTestQuestions,
  getPracticeQuestions,
  submitAptitudeTest,
  submitPractice,
} from "../services/profileApi";
import type { AptitudeQuestionDTO } from "../services/profileApi";

const TAB_WARNING_LIMIT = 2;

const CATEGORY_COLORS: Record<string, string> = {
  Quantitative: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Logical Reasoning": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "Verbal Ability": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Data Interpretation": "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-gray-600/60 text-gray-300",
  intermediate: "bg-yellow-500/15 text-yellow-400",
  advanced: "bg-red-500/15 text-red-400",
};

export function AptitudeTest() {
  const navigate = useNavigate();
  const { testId } = useParams<{ testId: string }>();
  const [searchParams] = useSearchParams();

  const isPractice = !testId;

  const [questions, setQuestions] = useState<AptitudeQuestionDTO[]>([]);
  const [testMeta, setTestMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const tabWarningRef = useRef<number>(0);
  const startTime = useRef(Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = isPractice
      ? getPracticeQuestions({
          category: searchParams.get("category") || undefined,
          topic: searchParams.get("topic") || undefined,
          difficulty: searchParams.get("difficulty") || undefined,
          count: Number(searchParams.get("count")) || 10,
        })
      : getTestQuestions(testId!);

    load
      .then((data: any) => {
        if (cancelled) return;
        setQuestions(data.questions || []);
        setTestMeta(data.test || {});
        if (data.test?.durationMinutes) {
          setTimeLeft(data.test.durationMinutes * 60);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(
          "Could not load questions. Please ensure you are logged in and the backend is running."
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [testId, isPractice, searchParams]);

  useEffect(() => {
    if (isSubmitted || questions.length === 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted, questions.length]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !isSubmitted) {
        tabWarningRef.current += 1;
        setTabWarnings(tabWarningRef.current);
        setShowTabWarning(true);
        setTimeout(() => setShowTabWarning(false), 3000);

        if (tabWarningRef.current >= TAB_WARNING_LIMIT) {
          handleSubmit();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isSubmitted]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitted || questions.length === 0) return;
    setIsSubmitted(true);
    setSubmitting(true);

    const timeTaken = Math.floor((Date.now() - startTime.current) / 1000);

    try {
      const result = isPractice
        ? await submitPractice({
            answers: answersRef.current,
            timeTaken,
            tabWarnings: tabWarningRef.current,
            marksPerQuestion: 1,
            negativeMarksPerQuestion: 0,
          })
        : await submitAptitudeTest(testId!, {
            answers: answersRef.current,
            timeTaken,
            tabWarnings: tabWarningRef.current,
          });

      navigate("/aptitude/result", { state: { result } });
    } catch {
      navigate("/aptitude/result", {
        state: { result: null },
        replace: true,
      });
    }
  }, [isSubmitted, isPractice, testId, questions.length, navigate]);

  const selectAnswer = (optIdx: number) => {
    setAnswers((prev) => ({ ...prev, [questions[currentQ].id]: optIdx }));
  };

  const goToQuestion = (idx: number) => setCurrentQ(idx);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const answeredCount = Object.keys(answers).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Preparing your questions…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-4">{loadError}</p>
          <button
            onClick={() => navigate(isPractice ? "/aptitude" : "/aptitude")}
            className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
          >
            Back to Aptitude
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-4">No questions match this selection. Try widening your filters.</p>
          <button
            onClick={() => navigate("/aptitude")}
            className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
          >
            Back to Aptitude
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      <AnimatePresence>
        {showTabWarning && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-2xl"
          >
            ⚠ Tab Switch Detected! Warning {tabWarnings}/{TAB_WARNING_LIMIT}
            {tabWarnings >= TAB_WARNING_LIMIT && " - Test Terminated!"}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isPractice ? "Practice Session" : testMeta.title || "Aptitude Test"}
            </h1>
            {!isPractice && (
              <p className="text-xs text-gray-400 mt-0.5">
                +{testMeta.marksPerQuestion} per correct · −{testMeta.negativeMarksPerQuestion} per wrong · pass{" "}
                {testMeta.passingScore}%
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`px-4 py-2 rounded-xl font-mono text-lg font-bold ${
                timeLeft < 120 ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-white"
              }`}
            >
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-xl text-sm text-gray-400">
              {answeredCount}/{questions.length} answered
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700"
              >
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className="text-xs text-gray-500">
                    Q{currentQ + 1}/{questions.length}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[currentQuestion.category] || "bg-gray-600/60 text-gray-300"}`}>
                    {currentQuestion.category}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[currentQuestion.difficulty]}`}>
                    {currentQuestion.difficulty}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-400">
                    {currentQuestion.topic}
                  </span>
                </div>

                <p className="text-lg text-white font-medium mb-6">{currentQuestion.question}</p>

                <div className="space-y-3">
                  {currentQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectAnswer(idx)}
                      className={`w-full text-left px-5 py-3.5 rounded-xl text-sm font-medium transition-all ${
                        answers[currentQuestion.id] === idx
                          ? "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50"
                          : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      <span className="mr-3 font-mono text-xs opacity-60">{String.fromCharCode(65 + idx)}.</span>
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => currentQ > 0 && goToQuestion(currentQ - 1)}
                    disabled={currentQ === 0}
                    className="px-5 py-2.5 bg-gray-700/50 text-gray-300 rounded-xl border border-gray-600 hover:border-gray-500 disabled:opacity-40 transition-all"
                  >
                    ← Previous
                  </button>

                  {currentQ < questions.length - 1 ? (
                    <button
                      onClick={() => goToQuestion(currentQ + 1)}
                      className="px-5 py-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-60"
                    >
                      {submitting ? "Scoring…" : "Submit Test"}
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Question Navigator</h3>
              {Object.keys(CATEGORY_COLORS).map((cat) => {
                const catQs = questions
                  .map((q, idx) => ({ ...q, idx }))
                  .filter((q) => q.category === cat);
                if (catQs.length === 0) return null;
                return (
                  <div key={cat} className="mb-3">
                    <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {catQs.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => goToQuestion(q.idx)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                            currentQ === q.idx
                              ? "bg-emerald-500 text-white"
                              : answers[q.id] !== undefined
                              ? "bg-emerald-500/30 text-emerald-400"
                              : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                          }`}
                        >
                          {q.idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Tab Warnings</span>
                <span className={`text-sm font-bold ${tabWarnings >= TAB_WARNING_LIMIT ? "text-red-400" : "text-yellow-400"}`}>
                  {tabWarnings}/{TAB_WARNING_LIMIT}
                </span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${tabWarnings >= TAB_WARNING_LIMIT ? "bg-red-500" : "bg-yellow-500"}`}
                  style={{ width: `${(tabWarnings / TAB_WARNING_LIMIT) * 100}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full px-4 py-3 bg-red-500/10 text-red-400 rounded-xl font-medium border border-red-500/20 hover:bg-red-500/20 transition-all text-sm disabled:opacity-60"
            >
              {submitting ? "Scoring…" : "Submit Test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
