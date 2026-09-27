/**
 * Calls into the local ai-services question engine (question_engine.py). Service-to-service only: responses contain
 * the answer key and are never forwarded to a browser as-is. Every call is bounded and returns null on failure so the
 * caller can fall back (verified DB bank / exact grading) instead of failing the student's session.
 */
import axios from "axios";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";
const headers = { "X-AI-Service-Key": AI_SERVICE_KEY };
export const GENERATION_TIMEOUT_MS = Number(process.env.QUESTION_GENERATION_TIMEOUT_MS || 60000);

async function post<T>(path: string, body: unknown, timeout: number): Promise<T | null> {
  try {
    const res = await axios.post(`${AI_SERVICE_URL}${path}`, body, { timeout, headers });
    return res.data as T;
  } catch (err: any) {
    console.error(`[question-engine] ${path} failed: ${err?.response?.data?.error || err?.message}`);
    return null;
  }
}

export interface GeneratedAptitude {
  id: string;
  category: string;
  topic: string;
  difficulty: string;
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  estimated_time: number;
  companies: string[];
  source: "model" | "template" | "bank";
  verification: string;
  repeated: boolean;
  model_rejections: number;
  generation_ms: number;
}

export function generateAptitudeQuestion(body: {
  category: string; topic: string; difficulty: string; exclude: string[]; session: string[]; excludeIds?: string[];
}) {
  return post<GeneratedAptitude>("/aptitude/generate-question", body, GENERATION_TIMEOUT_MS);
}

export interface GeneratedTech {
  id: string;
  technology: string;
  topic: string;
  difficulty: string; // Easy | Medium | Hard
  question_type: string; // dataset type: MCQ | Conceptual | Output Prediction | ...
  question_kind: string; // mcq | conceptual | output_prediction | debugging | coding
  question: string;
  options?: string[];
  correct_option?: number;
  answer: string;
  explanation: string;
  keywords: string[];
  source: "model" | "bank";
  verification: string;
  repeated: boolean;
  [k: string]: unknown;
}

export function generateTechQuestion(body: {
  technology: string; topic: string; difficulty: string; questionType: string; exclude: string[]; session: string[]; excludeIds: string[];
}) {
  return post<GeneratedTech>("/tech-practice/generate-question", body, GENERATION_TIMEOUT_MS);
}

export interface TechEvaluation {
  isCorrect: boolean;
  score: number;
  correctAnswer: string;
  explanation: string;
  expectedConcepts?: string[];
  missingConcepts?: string[];
  matchedKeywords?: string[];
  recommendation?: string;
  testCases?: unknown;
  referenceFixedCode?: string;
  evaluationSource?: string;
}

export function evaluateTechRecord(record: unknown, answer: unknown) {
  return post<TechEvaluation>("/tech-practice/evaluate", { record, answer }, 15000);
}
