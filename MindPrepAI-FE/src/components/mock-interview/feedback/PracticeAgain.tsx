import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useMicrophone } from "../../../hooks/useMicrophone";
import { reattemptQuestion } from "../../../services/mockInterviewApi";
import type { AttemptView, Comparison, QuestionSummary } from "../../../types/mockFeedback";

export interface ReattemptResult {
  attempt: AttemptView;
  attempts: AttemptView[];
  comparison: Comparison;
  summary: QuestionSummary;
}

interface Props {
  interviewId: string;
  questionId: string;
  question: string;
  nextAttemptNumber: number;
  onSaved: (result: ReattemptResult) => void;
  onCancel: () => void;
}

/**
 * Practice Again: answer the SAME question once more. The interview's own answer and scores are never
 * touched - this only adds a new attempt with its own answer, transcript, scores, feedback and timestamp.
 * (Practice is outside the proctored session, so no camera/full-screen rules apply here.)
 */
export function PracticeAgain({ interviewId, questionId, question, nextAttemptNumber, onSaved, onCancel }: Props) {
  const mic = useMicrophone();
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const micSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  // Spoken words flow into the box while recording (the candidate can still fix them before submitting).
  useEffect(() => {
    if (mode === "voice" && mic.transcript) setText(mic.transcript);
  }, [mic.transcript, mode]);

  useEffect(() => {
    return () => {
      mic.stopRecording();
      mic.resetRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleVoice = async () => {
    setError(null);
    if (mic.isRecording) {
      mic.stopRecording();
      return;
    }
    mic.resetRecording();
    setText("");
    const ok = await mic.startRecording();
    if (ok) setMode("voice");
    else setError("Could not access the microphone. You can type your answer instead.");
  };

  const submit = async () => {
    const answer = text.trim();
    if (!answer || busy) return;
    if (mic.isRecording) mic.stopRecording();
    setBusy(true);
    setError(null);
    try {
      const speech = mic.getSpeechMetrics();
      const squash = (t: string) => t.replace(/\s+/g, " ").trim();
      const spoken = !!speech && !!mic.transcript && squash(answer) === squash(mic.transcript);
      const res = await reattemptQuestion(interviewId, questionId, {
        answer,
        answerType: spoken ? "voice" : "text",
        timeTaken: Math.round((Date.now() - startedAt.current) / 1000),
        ...(spoken && speech ? { speech } : {}),
      });
      if (!res?.success) throw new Error(res?.message || "Could not save this attempt");
      mic.resetRecording();
      onSaved(res.data as ReattemptResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this attempt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <h5 className="text-sm font-semibold text-emerald-300">Practice — attempt {nextAttemptNumber}</h5>
        <span className="text-[11px] text-gray-500">Your interview answer and score stay unchanged</span>
      </div>
      <p className="text-sm text-white mb-3 leading-relaxed">{question}</p>

      <div className="flex gap-2 mb-2">
        {micSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            disabled={busy}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              mic.isRecording
                ? "bg-red-500/20 text-red-300 border-red-500/50 animate-pulse"
                : "bg-gray-700/50 text-gray-300 border-gray-600 hover:border-gray-500"
            }`}
          >
            {mic.isRecording ? `🔴 Stop (${mic.recordingDuration}s)` : "🎤 Speak your answer"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (mic.isRecording) mic.stopRecording();
            setMode("text");
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
            mode === "text" && !mic.isRecording
              ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
              : "bg-gray-700/50 text-gray-300 border-gray-600"
          }`}
        >
          ⌨️ Type
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        rows={5}
        maxLength={20000}
        aria-label="Your answer"
        placeholder={mode === "voice" ? "Your speech will appear here…" : "Type your improved answer here…"}
        className="w-full bg-gray-800/70 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-y disabled:opacity-60"
      />
      {mic.isRecording && !mic.transcript && (
        <p className="text-[11px] text-gray-500 mt-1">
          Listening… if your browser has no speech recognition the text box stays empty; you can type instead.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-400" role="alert">{error}</p>}

      <div className="flex gap-2 mt-3">
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
        >
          {busy ? "Evaluating…" : "Submit attempt"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}
