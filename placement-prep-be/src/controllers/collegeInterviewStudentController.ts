import { Response } from "express";
import mongoose from "mongoose";
import axios from "axios";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { College } from "../models/College";
import { User } from "../models/User";
import { Interview } from "../models/Interview";
import { CollegeInterview } from "../models/CollegeInterview";
import { CollegeInterviewQuestion } from "../models/CollegeInterviewQuestion";

/**
 * Student-facing side of college-created interviews.
 *
 * SECURITY: the student's college comes from the authenticated user record, never
 * from the request. Only PUBLISHED interviews of that college are visible, and
 * nothing here ever returns an answer key (correct option / expected answer /
 * evaluation criteria) — those stay on CollegeInterviewQuestion and are only
 * read server-side when grading.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";

// ── colleges (choose / view my college) ───────────────────

export const listColleges = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const colleges = await College.find().sort({ name: 1 }).select("name");
  res.json({ success: true, data: colleges });
});

export const getMyCollege = asyncHandler(async (req: AuthRequest, res: Response) => {
  const college = req.user.college ? await College.findById(req.user.college).select("name") : null;
  res.json({ success: true, data: college });
});

/**
 * A student joins a college once. Membership is self-declared (there is no
 * verification workflow in the app), so it is locked after the first choice — a
 * student cannot hop between colleges to read their interviews. Changing it later
 * is an admin action.
 */
export const setMyCollege = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user.role !== "user") throw new AppError("Only students choose a college here", 403);
  if (req.user.college) throw new AppError("Your college is already set. Ask an administrator to change it.", 409);

  const collegeId = req.body?.collegeId;
  if (typeof collegeId !== "string" || !mongoose.isValidObjectId(collegeId)) {
    throw new AppError("Choose a college", 400);
  }
  const college = await College.findById(collegeId).select("name");
  if (!college) throw new AppError("College not found", 404);

  // Conditional update: only sets it if still empty, so two racing requests can't both win.
  const updated = await User.findOneAndUpdate({ _id: req.user._id, college: null }, { college: college._id }, { new: true });
  if (!updated) throw new AppError("Your college is already set. Ask an administrator to change it.", 409);
  res.json({ success: true, data: college });
});

// ── list / details ────────────────────────────────────────

function publicShape(ci: any, collegeName: string) {
  return {
    id: ci._id,
    name: ci.name,
    jobRole: ci.jobRole,
    interviewType: ci.interviewType,
    programmingLanguage: ci.programmingLanguage,
    difficulty: ci.difficulty,
    description: ci.description,
    questionCount: ci.questionCount,
    timeLimit: ci.timeLimit,
    collegeName,
  };
}

export const listMyCollegeInterviews = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user.college) {
    return res.json({ success: true, data: { college: null, interviews: [] } });
  }
  const [college, interviews] = await Promise.all([
    College.findById(req.user.college).select("name"),
    CollegeInterview.find({ college: req.user.college, status: "published" }).sort({ publishedAt: -1 }),
  ]);

  const sessions = await Interview.find({
    user: req.user._id,
    collegeInterview: { $in: interviews.map((i: any) => i._id) },
  })
    .sort({ createdAt: -1 })
    .select("collegeInterview status");
  const sessionByInterview = new Map<string, any>();
  sessions.forEach((s: any) => {
    if (!sessionByInterview.has(String(s.collegeInterview))) sessionByInterview.set(String(s.collegeInterview), s);
  });

  res.json({
    success: true,
    data: {
      college: college ? { id: college._id, name: college.name } : null,
      interviews: interviews.map((ci: any) => {
        const s = sessionByInterview.get(String(ci._id));
        return {
          ...publicShape(ci, college?.name || ""),
          // Where this student stands: none | in-progress | completed | terminated
          attempt: s ? { status: s.status, sessionId: s._id } : null,
        };
      }),
    },
  });
});

export const getMyCollegeInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ci = await findVisible(req, req.params.id);
  const college = await College.findById(ci.college).select("name");
  res.json({ success: true, data: publicShape(ci, college?.name || "") });
});

async function findVisible(req: AuthRequest, id: string) {
  if (!mongoose.isValidObjectId(id) || !req.user.college) throw new AppError("Interview not found", 404);
  const ci = await CollegeInterview.findOne({ _id: id, college: req.user.college, status: "published" });
  // Drafts, closed interviews and other colleges' interviews are all just "not found".
  if (!ci) throw new AppError("Interview not found", 404);
  return ci;
}

// ── starting a session (called by the existing POST /mock-interview/create) ──

/**
 * Creates a regular `Interview` session (source "COLLEGE") from a published
 * college interview: the questions are snapshotted into the session so the
 * existing state / answer / skip / cheating / terminate / report flow applies
 * unchanged, and later edits by the admin never alter an attempt in progress.
 */
export async function startCollegeInterview(req: AuthRequest, res: Response) {
  const ci = await findVisible(req, String(req.body?.collegeInterviewId || ""));

  const previous = await Interview.findOne({ user: req.user._id, collegeInterview: ci._id }).sort({ createdAt: -1 });
  if (previous) {
    if (previous.status === "in-progress" || previous.status === "pending") {
      // Resume rather than create a second session (also stops a refresh from resetting counters).
      return res.status(200).json({ success: true, resumed: true, data: previous });
    }
    throw new AppError("You have already attempted this interview.", 409);
  }

  const questions = await CollegeInterviewQuestion.find({ interview: ci._id }).sort({ order: 1 }).limit(ci.questionCount);
  if (questions.length === 0 || questions.length !== ci.questionCount) {
    throw new AppError("This interview is not ready yet. Please contact your college.", 409);
  }

  const emptyEval = {
    technicalScore: 0, communicationScore: 0, confidenceScore: 0,
    grammarScore: 0, fluencyScore: 0, relevanceScore: 0, feedback: "",
  };

  const interview = await Interview.create({
    user: req.user._id,
    source: "COLLEGE",
    collegeInterview: ci._id,
    college: ci.college,
    jobRole: ci.jobRole,
    experienceLevel: "fresher",
    interviewType: ci.interviewType,
    difficulty: ci.difficulty,
    totalQuestions: questions.length,
    timeLimitMinutes: ci.timeLimit,
    status: "in-progress",
    questionsStatus: "ready", // nothing to generate
    startedAt: new Date(),
    questions: questions.map((q: any) => ({
      question: q.question,
      topic: q.topic,
      skill: ci.programmingLanguage === "None" ? "" : ci.programmingLanguage,
      collegeQuestion: q._id,
      questionType: q.questionType,
      options: q.options,
      marks: q.marks,
      answer: "",
      answerType: "text",
      timeTaken: 0,
      skipped: false,
      evaluation: emptyEval,
    })),
  });

  res.status(201).json({ success: true, data: interview });
}

// ── grading (called by the existing POST /mock-interview/:id/answer) ─────────

/** Turns the admin's free-text criteria into the concept list the local evaluator expects. */
function conceptsFrom(q: any): string[] {
  const fromCriteria = String(q.evaluationCriteria || "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromCriteria.length) return fromCriteria.slice(0, 15);
  // No explicit criteria: use the distinctive words of the expected answer.
  const stop = new Set(["the", "and", "for", "with", "that", "this", "are", "was", "you", "your", "from", "have", "has"]);
  return Array.from(
    new Set(
      String(q.expectedAnswer || q.codingConfig?.expectedSolution || "")
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((w) => w.length > 3 && !stop.has(w))
    )
  ).slice(0, 12);
}

/**
 * Grades one answer of a college interview and returns the standard evaluation
 * object. MCQs are graded exactly (no AI involved); the other types use the
 * existing local evaluator with the admin's criteria as the expected concepts.
 * The answer key is read here, server-side, and never leaves the server.
 */
export async function evaluateCollegeAnswer(interview: any, sessionQuestion: any, answer: string) {
  const key: any = await CollegeInterviewQuestion.findOne({
    _id: sessionQuestion.collegeQuestion,
    interview: interview.collegeInterview,
  });
  const base = { communicationScore: 70, confidenceScore: 70, grammarScore: 70, fluencyScore: 70, relevanceScore: 70 };
  if (!key) {
    return { ...base, technicalScore: 50, feedback: "This question could not be evaluated automatically." };
  }

  if (key.questionType === "MCQ") {
    const picked = String(answer || "").trim().toUpperCase().charAt(0);
    const correct = picked !== "" && picked === key.correctAnswer;
    return {
      ...base,
      technicalScore: correct ? 100 : 0,
      relevanceScore: correct ? 100 : 0,
      feedback: picked ? (correct ? "Correct." : "Incorrect.") : "No option was selected.",
    };
  }

  try {
    const r = await axios.post(
      `${AI_SERVICE_URL}/evaluate-answer`,
      {
        question: key.question,
        answer,
        interviewType: interview.interviewType === "Coding" || interview.interviewType === "Mixed" ? "Technical" : interview.interviewType,
        difficulty: key.difficulty || "Medium",
        jobRole: interview.jobRole,
        skill: sessionQuestion.skill || "",
        topic: key.topic || "",
        concepts: conceptsFrom(key),
      },
      { timeout: 20000, headers: { "X-AI-Service-Key": AI_SERVICE_KEY } }
    );
    if (r.data?.evaluation) return r.data.evaluation;
  } catch (err: any) {
    console.error(`College answer evaluation fell back to a neutral score: ${err?.message}`);
  }
  return { ...base, technicalScore: 50, feedback: "The answer was recorded; automatic evaluation was unavailable." };
}

/** True (and the session is finalised) once the college interview's overall time limit has passed. */
export function collegeTimeLimitExceeded(interview: any): boolean {
  if (interview.source !== "COLLEGE" || !interview.timeLimitMinutes || !interview.startedAt) return false;
  const graceMs = 30_000; // absorbs request latency so an answer sent at the buzzer still counts
  return Date.now() > new Date(interview.startedAt).getTime() + interview.timeLimitMinutes * 60_000 + graceMs;
}
