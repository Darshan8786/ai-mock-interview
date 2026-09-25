import { useState, useCallback, useRef, useEffect } from "react";
import { BACKEND_URL } from "../config/config";
import { fetchWithTimeout, messageForError, RequestError } from "../utils/fetchWithTimeout";
import type { SpeechMetrics } from "../types/mockFeedback";

export interface Question {
  question: string;
  index: number;
  // College-authored interviews only (never includes the answer key).
  type?: "MCQ" | "Technical" | "Coding" | "Behavioral" | "HR" | "Subjective";
  options?: string[];
  marks?: number;
  language?: string;
}

/** A question as sent by the server: either the session document or the /state payload. */
interface ServerQuestion {
  question: string;
  type?: Question["type"];
  questionType?: Question["type"];
  options?: string[];
  marks?: number;
  language?: string;
  skill?: string;
}

/** Shapes a session question (server doc or /state payload) into the client Question. */
function toQuestion(q: ServerQuestion, index: number): Question {
  const base: Question = { question: q.question, index };
  const type = q.type ?? q.questionType;
  if (type) {
    base.type = type;
    base.options = Array.from(q.options || []);
    base.marks = q.marks;
    base.language = q.language ?? q.skill ?? "";
  }
  return base;
}

// ── Active-interview pointer ────────────────────────────────────────────
// The interview id otherwise lives only in React state, so a page refresh used to
// abandon the session and start a fresh one (resetting every counter). Remembering
// the id (per tab, like the tab-switch counter) lets the room resume it instead.
const ACTIVE_KEY = "mindprep:activeInterview";
export interface ActiveInterviewPointer {
  id: string;
  /** Fingerprint of the config it was started with; resume is only offered for the same config. */
  configKey: string;
}
export function interviewConfigKey(c: {
  source?: string;
  collegeInterviewId?: string;
  jobRole?: string;
  interviewType?: string;
  difficulty?: string;
  totalQuestions?: number;
}) {
  return [c.source || "AI", c.collegeInterviewId || "", c.jobRole || "", c.interviewType || "", c.difficulty || "", c.totalQuestions || ""].join("|");
}
export function saveActiveInterview(p: ActiveInterviewPointer) {
  try {
    sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — resume just won't be offered */
  }
}
export function readActiveInterview(): ActiveInterviewPointer | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveInterviewPointer) : null;
  } catch {
    return null;
  }
}
export function clearActiveInterview() {
  try {
    sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export interface Evaluation {
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  grammarScore: number;
  fluencyScore: number;
  relevanceScore: number;
  feedback: string;
}

// The parts of an uploaded resume a resume-based interview is built from.
export interface ResumeProfile {
  skills: string[];
  projects: Array<{ name: string; description: string; technologies: string[] }>;
}

export interface InterviewConfig {
  jobRole: string;
  experienceLevel: string;
  interviewType: string;
  difficulty: string;
  totalQuestions: number;
  // Required by the server when interviewType is "Resume".
  resume?: ResumeProfile;
  // "COLLEGE": load the college's own questions instead of generating them.
  source?: "AI" | "RESUME" | "COLLEGE";
  collegeInterviewId?: string;
}

export type InterviewErrorKind = "timeout" | "auth" | "server" | "network" | "generic" | null;

// Question generation lifecycle — independent of the proctoring session.
export type QuestionsStatus = "generating" | "ready" | "failed" | null;

const CREATE_TIMEOUT_MS = 15000;
const ACTION_TIMEOUT_MS = 20000;
const READ_TIMEOUT_MS = 15000;
const STATE_POLL_INTERVAL_MS = 1500;
const STATE_POLL_TIMEOUT_MS = 10000;
const STATE_POLL_MAX_ATTEMPTS = 40; // ~60s ceiling

export function useInterview() {
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<InterviewErrorKind>(null);
  const [questionsStatus, setQuestionsStatus] = useState<QuestionsStatus>(null);
  const [lastEvaluation, setLastEvaluation] = useState<Evaluation | null>(null);

  // Remembered so retryStartInterview() can re-run create without the caller
  // having to pass the config again.
  const lastConfigRef = useRef<InterviewConfig | null>(null);

  const getToken = useCallback(() => localStorage.getItem("token"), []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorKind(null);
  }, []);

  const applyError = useCallback((err: unknown, fallback: string) => {
    setError(messageForError(err, fallback));
    if (err instanceof RequestError) {
      setErrorKind(err.kind === "http" ? "generic" : (err.kind as InterviewErrorKind));
    } else {
      setErrorKind("generic");
    }
  }, []);

  const startInterview = useCallback(
    async (config: InterviewConfig) => {
      setLoading(true);
      clearError();
      setCurrentQuestion(null);
      setQuestionsStatus("generating");
      lastConfigRef.current = config;

      try {
        const token = getToken();
        // This call now only creates the interview *session* and returns its id
        // almost immediately — question generation runs on the server in the
        // background and is tracked via the /state poll below. Proctoring binds
        // to the id returned here, independent of question generation.
        const res = await fetchWithTimeout(
          `${BACKEND_URL}/api/v1/mock-interview/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(config),
          },
          CREATE_TIMEOUT_MS
        );

        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Failed to start interview");

        const id = data.data._id;
        setInterviewId(id);
        setQuestionsStatus(data.data.questionsStatus || "generating");

        // Backwards-compatible: if the server ever returns questions inline.
        if (data.data.questions && data.data.questions.length > 0) {
          const idx = data.data.currentQuestionIndex || 0;
          const q = data.data.questions[idx] || data.data.questions[0];
          setCurrentQuestion(toQuestion(q, idx));
          setQuestionsStatus("ready");
        }

        return id;
      } catch (err) {
        applyError(err, "Failed to start interview");
        setQuestionsStatus("failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getToken, clearError, applyError]
  );

  // Poll the lightweight /state endpoint while questions are being generated in
  // the background. This is the ONLY thing that surfaces the first question —
  // it is completely separate from the proctoring session lifecycle.
  useEffect(() => {
    if (!interviewId || questionsStatus !== "generating") return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const token = getToken();
        const res = await fetchWithTimeout(
          `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/state`,
          { headers: { Authorization: `Bearer ${token}` } },
          STATE_POLL_TIMEOUT_MS
        );
        const data = await res.json();
        if (cancelled || !data.success) return;

        const st = data.data;
        if (st.questionsStatus === "ready" && st.currentQuestion) {
          setCurrentQuestion(toQuestion(st.currentQuestion, st.currentQuestion.index));
          setQuestionsStatus("ready");
          clearError();
        } else if (st.questionsStatus === "failed") {
          setError("Question generation failed on the server. You can retry.");
          setErrorKind("server");
          setQuestionsStatus("failed");
        } else if (attempts >= STATE_POLL_MAX_ATTEMPTS) {
          setError("Questions are taking too long to generate. Please retry.");
          setErrorKind("timeout");
          setQuestionsStatus("failed");
        }
      } catch (err) {
        // A single failed poll is not fatal — keep polling until the attempt
        // ceiling. Only surface an error once we give up.
        if (!cancelled && attempts >= STATE_POLL_MAX_ATTEMPTS) {
          applyError(err, "Unable to load interview questions");
          setQuestionsStatus("failed");
        }
      }
    };

    poll();
    const id = window.setInterval(poll, STATE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [interviewId, questionsStatus, getToken, clearError, applyError]);

  // Re-attach to an interview that is still in progress on the server (page refresh).
  // The question comes back through the normal /state poll, so nothing is regenerated.
  const resumeInterview = useCallback((id: string) => {
    clearError();
    setIsComplete(false);
    setCurrentQuestion(null);
    setInterviewId(id);
    setQuestionsStatus("generating");
  }, [clearError]);

  // Ask the server to regenerate questions for the existing session. Never
  // touches the proctoring socket or webcam.
  const regenerateQuestions = useCallback(async () => {
    if (!interviewId) {
      if (lastConfigRef.current) return startInterview(lastConfigRef.current);
      return null;
    }
    clearError();
    setCurrentQuestion(null);
    setQuestionsStatus("generating");
    try {
      const token = getToken();
      const res = await fetchWithTimeout(
        `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/regenerate-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
        ACTION_TIMEOUT_MS
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to regenerate questions");
      return interviewId;
    } catch (err) {
      applyError(err, "Failed to regenerate questions");
      setQuestionsStatus("failed");
      return null;
    }
  }, [interviewId, getToken, clearError, applyError, startInterview]);

  // Retry entry point for the question UI. Reuses the existing session if we
  // have one (regenerate); otherwise re-creates from the remembered config.
  const retryStartInterview = useCallback(async () => {
    if (interviewId) return regenerateQuestions();
    if (lastConfigRef.current) return startInterview(lastConfigRef.current);
    return null;
  }, [interviewId, regenerateQuestions, startInterview]);

  const submitAnswer = useCallback(
    async (answer: string, answerType: "voice" | "text", timeTaken: number, speech?: SpeechMetrics) => {
      if (!interviewId) return null;

      setLoading(true);
      setLastEvaluation(null);
      clearError();
      try {
        const token = getToken();
        const res = await fetchWithTimeout(
          `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/answer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ answer, answerType, timeTaken, ...(speech ? { speech } : {}) }),
          },
          ACTION_TIMEOUT_MS
        );

        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Failed to submit answer");

        if (data.data.evaluation) {
          setLastEvaluation(data.data.evaluation);
        }

        if (data.data.nextQuestion) {
          setCurrentQuestion(toQuestion(data.data.nextQuestion, data.data.nextQuestion.index));
        } else {
          setCurrentQuestion(null);
        }

        if (data.data.isComplete) {
          setIsComplete(true);
        }

        return data.data;
      } catch (err) {
        applyError(err, "Failed to submit answer");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [interviewId, getToken, clearError, applyError]
  );

  const skipQuestion = useCallback(async () => {
    if (!interviewId) return null;

    setLoading(true);
    clearError();
    try {
      const token = getToken();
      const res = await fetchWithTimeout(
        `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/skip`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
        ACTION_TIMEOUT_MS
      );

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to skip question");

      if (data.data.nextQuestion) {
        setCurrentQuestion(toQuestion(data.data.nextQuestion, data.data.nextQuestion.index));
      } else {
        setCurrentQuestion(null);
      }

      if (data.data.isComplete) {
        setIsComplete(true);
      }

      return data.data;
    } catch (err) {
      applyError(err, "Failed to skip question");
      return null;
    } finally {
      setLoading(false);
    }
  }, [interviewId, getToken, clearError, applyError]);

  const terminateInterview = useCallback(async (reason?: string) => {
    if (!interviewId) return;

    try {
      const token = getToken();
      await fetchWithTimeout(
        `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/terminate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(reason ? { reason } : {}),
        },
        READ_TIMEOUT_MS
      );
    } catch (err) {
      console.error("Failed to terminate:", err);
    }

    setIsComplete(true);
  }, [interviewId, getToken]);

  const getReport = useCallback(async () => {
    if (!interviewId) return null;

    try {
      const token = getToken();
      const res = await fetchWithTimeout(
        `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/report`,
        { headers: { Authorization: `Bearer ${token}` } },
        READ_TIMEOUT_MS
      );

      const data = await res.json();
      if (data.success) return data.data;
    } catch (err) {
      console.error("Failed to get report:", err);
    }
    return null;
  }, [interviewId, getToken]);

  const clearLastEvaluation = useCallback(() => setLastEvaluation(null), []);

  return {
    interviewId,
    currentQuestion,
    questionsStatus,
    isComplete,
    loading,
    error,
    errorKind,
    lastEvaluation,
    startInterview,
    resumeInterview,
    retryStartInterview,
    regenerateQuestions,
    submitAnswer,
    skipQuestion,
    terminateInterview,
    getReport,
    clearLastEvaluation,
    clearError,
  };
}
