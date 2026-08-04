import { useState, useCallback } from "react";
import { BACKEND_URL } from "../config/config";

export interface Question {
  question: string;
  index: number;
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

export interface InterviewConfig {
  jobRole: string;
  experienceLevel: string;
  interviewType: string;
  difficulty: string;
  totalQuestions: number;
}

export function useInterview() {
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvaluation, setLastEvaluation] = useState<Evaluation | null>(null);

  const getToken = useCallback(() => localStorage.getItem("token"), []);

  const startInterview = useCallback(async (config: InterviewConfig) => {
    setLoading(true);
    setError(null);

    try {
      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to start interview");

      const id = data.data._id;
      setInterviewId(id);

      if (data.data.questions && data.data.questions.length > 0) {
        setCurrentQuestion({
          question: data.data.questions[0].question,
          index: 0,
        });
      }

      return id;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const submitAnswer = useCallback(
    async (answer: string, answerType: "voice" | "text", timeTaken: number) => {
      if (!interviewId) return null;

      setLoading(true);
      setLastEvaluation(null);
      try {
        const token = getToken();
        const res = await fetch(
          `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/answer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ answer, answerType, timeTaken }),
          }
        );

        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Failed to submit answer");

        if (data.data.evaluation) {
          setLastEvaluation(data.data.evaluation);
        }

        if (data.data.nextQuestion) {
          setCurrentQuestion(data.data.nextQuestion);
        } else {
          setCurrentQuestion(null);
        }

        if (data.data.isComplete) {
          setIsComplete(true);
        }

        return data.data;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [interviewId, getToken]
  );

  const skipQuestion = useCallback(async () => {
    if (!interviewId) return null;

    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/skip`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to skip question");

      if (data.data.nextQuestion) {
        setCurrentQuestion(data.data.nextQuestion);
      } else {
        setCurrentQuestion(null);
      }

      if (data.data.isComplete) {
        setIsComplete(true);
      }

      return data.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [interviewId, getToken]);

  const terminateInterview = useCallback(async () => {
    if (!interviewId) return;

    try {
      const token = getToken();
      await fetch(
        `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/terminate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
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
      const res = await fetch(
        `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/report`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
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
    isComplete,
    loading,
    error,
    lastEvaluation,
    startInterview,
    submitAnswer,
    skipQuestion,
    terminateInterview,
    getReport,
    clearLastEvaluation,
  };
}
