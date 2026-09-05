import { motion, AnimatePresence } from "framer-motion";
import { QuestionCard } from "../mock-interview/QuestionCard";
import type { Question, QuestionsStatus, InterviewErrorKind } from "../../hooks/useInterview";

interface QuestionPanelProps {
  questionsStatus: QuestionsStatus;
  currentQuestion: Question | null;
  loading: boolean;
  error: string | null;
  errorKind: InterviewErrorKind;
  genTakingLong: boolean;
  questionIndex: number;
  totalQuestions: number;
  onRetry: () => void;

  // Answer box
  answerMode: "voice" | "text";
  onSelectTextMode: () => void;
  onVoiceToggle: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
  recordingDuration: number;
  textAnswer: string;
  onTextAnswerChange: (v: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}

/**
 * The question system, rendered as a sibling of the proctoring panel.
 *
 * All of its states — generating / failed / ready — are local to question
 * generation. Nothing here starts, stops, or touches the webcam or the
 * proctoring WebSocket. A failure in this panel is fully contained: the user
 * gets an error + Retry, and proctoring keeps running next to it.
 */
export function QuestionPanel({
  questionsStatus,
  currentQuestion,
  loading,
  error,
  errorKind,
  genTakingLong,
  questionIndex,
  totalQuestions,
  onRetry,
  answerMode,
  onSelectTextMode,
  onVoiceToggle,
  isRecording,
  isTranscribing,
  recordingDuration,
  textAnswer,
  onTextAnswerChange,
  onSubmit,
  onSkip,
}: QuestionPanelProps) {
  const isGenerating =
    !currentQuestion && (questionsStatus === "generating" || (loading && !error));
  const isFailed = !currentQuestion && (questionsStatus === "failed" || (!!error && !loading));

  return (
    <div className="lg:col-span-2 space-y-4">
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 space-y-4"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-bounce" />
            <span className="text-gray-300 text-sm font-medium ml-1">
              Generating your interview questions…
            </span>
          </div>
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-gray-700 rounded-full w-3/4" />
            <div className="h-4 bg-gray-700 rounded-full w-full" />
            <div className="h-4 bg-gray-700 rounded-full w-5/6" />
            <div className="h-4 bg-gray-700 rounded-full w-2/3" />
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Video proctoring is already active — you can stay in the camera frame while
            this loads.
          </p>
          {genTakingLong && (
            <div className="border-t border-gray-700 pt-4 space-y-3">
              <p className="text-amber-400 text-xs">
                This is taking longer than usual. The AI service may be busy.
              </p>
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
              >
                Restart question generation
              </button>
            </div>
          )}
        </motion.div>
      )}

      {isFailed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center space-y-4"
        >
          <div className="w-14 h-14 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-red-400 font-semibold text-lg">
              {errorKind === "auth"
                ? "AI service authentication error"
                : "Unable to generate the next question"}
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              {error || "Question generation did not complete."}
            </p>
            <p className="text-gray-500 text-xs mt-2">
              {errorKind === "auth"
                ? "An administrator needs to check the AI provider key configured on the server."
                : "Retry — the system falls back to a standard question set automatically. Video proctoring is unaffected."}
            </p>
          </div>
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
          >
            Retry
          </button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {currentQuestion && (
          <QuestionCard
            key={questionIndex}
            question={currentQuestion.question}
            questionNumber={questionIndex + 1}
            totalQuestions={totalQuestions}
          />
        )}
      </AnimatePresence>

      {error && currentQuestion && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {currentQuestion && (
        <motion.div
          key={`answer-${questionIndex}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
        >
          <div className="flex gap-2 mb-4">
            <button
              onClick={onVoiceToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                isRecording
                  ? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse"
                  : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
              }`}
            >
              {isRecording ? "🔴 Recording..." : "🎤 Voice"}
            </button>
            <button
              onClick={onSelectTextMode}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                answerMode === "text" && !isRecording
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                  : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
              }`}
            >
              ⌨️ Text
            </button>
          </div>

          {answerMode === "text" && (
            <textarea
              value={textAnswer}
              onChange={(e) => onTextAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full h-32 bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          )}

          {answerMode === "voice" && (
            <>
              {isRecording ? (
                <div className="bg-gray-700/30 rounded-xl border border-gray-600 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-600">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-gray-300 text-sm">
                      Recording... {recordingDuration}s
                    </span>
                    {isTranscribing && (
                      <span className="text-emerald-400 text-sm ml-auto animate-pulse">
                        Transcribing...
                      </span>
                    )}
                  </div>
                  <textarea
                    value={textAnswer}
                    onChange={(e) => onTextAnswerChange(e.target.value)}
                    readOnly={isTranscribing}
                    placeholder="Your speech will appear here..."
                    className="w-full h-32 bg-transparent px-4 py-3 text-white placeholder-gray-500 focus:outline-none resize-none"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-700/30 rounded-xl px-4 py-3">
                  <span className="text-gray-300 text-sm">
                    Click "Voice" to start, then speak your answer. It will be
                    transcribed into text.
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={onSubmit}
              disabled={loading || (!textAnswer && !isRecording && answerMode === "text")}
              className="flex-1 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Answer"}
            </button>
            <button
              onClick={onSkip}
              disabled={loading}
              className="px-6 py-3 bg-gray-700/50 text-gray-300 rounded-xl font-medium border border-gray-600 hover:border-gray-500 transition-all"
            >
              Skip
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
