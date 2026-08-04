import { BACKEND_URL } from "../config/config";

const AI_SERVICE_URL = "http://localhost:8000";
const AI_SERVICE_KEY = "mindprep-ai-key-2026";

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

export async function terminateInterview(id: string) {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mock-interview/${id}/terminate`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );
  return res.json();
}

export async function getInterviewReport(id: string) {
  const res = await fetch(`${BACKEND_URL}/api/v1/mock-interview/${id}/report`, {
    headers: getAuthHeaders(),
  });
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
