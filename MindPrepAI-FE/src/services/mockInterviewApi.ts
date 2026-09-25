import { BACKEND_URL, AI_SERVICE_URL, AI_SERVICE_KEY } from "../config/config";
import type { SpeechMetrics } from "../types/mockFeedback";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getAIHeaders() {
  return {
    "Content-Type": "application/json",
    "X-AI-Service-Key": AI_SERVICE_KEY,
  };
}

export async function createInterview(config: {
  jobRole: string;
  experienceLevel: string;
  interviewType: string;
  difficulty: string;
  totalQuestions: number;
}) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/create`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getInterview(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/${id}`, {
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function submitAnswer(
  id: string,
  answer: string,
  answerType: "voice" | "text",
  timeTaken: number
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/${id}/answer`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ answer, answerType, timeTaken }),
  });
  return res.json();
}

export async function skipQuestion(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/${id}/skip`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function reportCheating(
  id: string,
  type: string,
  description: string,
  metadata?: any
) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mock-interview/${id}/cheating`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ type, description, metadata }),
    }
  );
  return res.json();
}

export type TerminationReason =
  | "FULLSCREEN_EXIT_LIMIT_EXCEEDED"
  | "TAB_SWITCH_LIMIT_EXCEEDED"
  | "TIME_LIMIT_REACHED";

export async function terminateInterview(id: string, reason?: TerminationReason) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mock-interview/${id}/terminate`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(reason ? { reason } : {}),
    }
  );
  return res.json();
}

/** Lightweight session state incl. the persisted proctoring counters (used to resume after a refresh). */
export async function getInterviewState(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/${id}/state`, {
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function getInterviewReport(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/${id}/report`, {
    headers: getAuthHeaders(),
  });
  return res.json();
}

/** Every attempt for one question (attempt 1 = the interview answer) plus the before/after comparison. */
export async function getQuestionHistory(id: string, questionId: string) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/${id}/question/${questionId}/history`, {
    headers: getAuthHeaders(),
  });
  return res.json();
}

/** Practice Again: a new attempt at the same question. Never overwrites earlier attempts. */
export async function reattemptQuestion(
  id: string,
  questionId: string,
  body: { answer: string; answerType: "voice" | "text"; timeTaken: number; speech?: SpeechMetrics }
) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/${id}/question/${questionId}/reattempt`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getProgress() {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/progress`, { headers: getAuthHeaders() });
  return res.json();
}

/** What the next interview of this type will be tailored to, from the candidate's own history. */
export async function getPersonalization(interviewType: string) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mock-interview/personalization?interviewType=${encodeURIComponent(interviewType)}`,
    { headers: getAuthHeaders() }
  );
  return res.json();
}

export async function getDashboard() {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/dashboard`, {
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function generateQuestions(config: {
  jobRole: string;
  experienceLevel: string;
  interviewType: string;
  difficulty: string;
  totalQuestions: number;
}) {
  const res = await fetch(`${AI_SERVICE_URL}/generate-questions`, {
    method: "POST",
    headers: getAIHeaders(),
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function evaluateAnswer(data: {
  question: string;
  answer: string;
  interviewType: string;
  difficulty: string;
  jobRole: string;
}) {
  const res = await fetch(`${AI_SERVICE_URL}/evaluate-answer`, {
    method: "POST",
    headers: getAIHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function textToSpeech(text: string): Promise<string | null> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/text-to-speech`, {
      method: "POST",
      headers: getAIHeaders(),
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return data.audio || null;
  } catch {
    return null;
  }
}

export async function speechToText(audioBase64: string): Promise<string | null> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/speech-to-text`, {
      method: "POST",
      headers: getAIHeaders(),
      body: JSON.stringify({ audio: audioBase64 }),
    });
    const data = await res.json();
    return data.text || null;
  } catch {
    return null;
  }
}

export async function analyzeFrame(imageBase64: string) {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/analyze-frame`, {
      method: "POST",
      headers: getAIHeaders(),
      body: JSON.stringify({ image: imageBase64 }),
    });
    return res.json();
  } catch {
    return {
      face_detected: true,
      multiple_faces: false,
      looking_direction: "center",
      looking_away: false,
      person_left: false,
      warnings: [],
    };
  }
}
