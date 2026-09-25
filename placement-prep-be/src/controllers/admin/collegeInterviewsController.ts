import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import {
  CollegeInterview,
  COLLEGE_INTERVIEW_TYPES,
  COLLEGE_INTERVIEW_STATUSES,
  COLLEGE_DIFFICULTIES,
  PROGRAMMING_LANGUAGES,
  type CollegeInterviewStatus,
} from "../../models/CollegeInterview";
import {
  CollegeInterviewQuestion,
  QUESTION_TYPES,
  QUESTION_DIFFICULTIES,
} from "../../models/CollegeInterviewQuestion";
import { Interview } from "../../models/Interview";

/**
 * College-created interviews (admin side).
 *
 * SECURITY: every query is scoped by `req.user.college` — the college of the
 * authenticated admin, read from the database by the auth middleware. No college
 * id is ever accepted from the request. An interview that belongs to another
 * college is reported as "not found", the same as one that does not exist.
 */

const isObjectId = (v: unknown) => typeof v === "string" && mongoose.isValidObjectId(v);

function collegeOf(req: AuthRequest) {
  const college = req.user?.college;
  if (!college) {
    throw new AppError(
      "Your admin account is not linked to a college, so college interviews are unavailable.",
      403
    );
  }
  return college;
}

async function loadOwned(req: AuthRequest, id: string = req.params.id) {
  if (!isObjectId(id)) throw new AppError("Interview not found", 404);
  const interview = await CollegeInterview.findOne({ _id: id, college: collegeOf(req) });
  if (!interview) throw new AppError("Interview not found", 404);
  return interview;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ── input parsing ─────────────────────────────────────────

function parseInterviewInput(body: any, partial: boolean) {
  const out: Record<string, unknown> = {};
  const problems: string[] = [];
  const has = (k: string) => body?.[k] !== undefined;

  const text = (key: string, label: string, max: number, required: boolean) => {
    if (!has(key)) {
      if (required && !partial) problems.push(`${label} is required`);
      return;
    }
    const v = str(body[key], max);
    if (required && !v) problems.push(`${label} is required`);
    else out[key] = v;
  };
  const oneOf = (key: string, label: string, allowed: readonly string[], required: boolean) => {
    if (!has(key)) {
      if (required && !partial) problems.push(`${label} is required`);
      return;
    }
    if (!allowed.includes(body[key])) problems.push(`${label} must be one of: ${allowed.join(", ")}`);
    else out[key] = body[key];
  };
  const int = (key: string, label: string, min: number, max: number, required: boolean) => {
    if (!has(key)) {
      if (required && !partial) problems.push(`${label} is required`);
      return;
    }
    const n = Number(body[key]);
    if (!Number.isInteger(n) || n < min || n > max) problems.push(`${label} must be a whole number between ${min} and ${max}`);
    else out[key] = n;
  };

  text("name", "Interview name", 150, true);
  text("jobRole", "Job role", 120, true);
  oneOf("interviewType", "Interview type", COLLEGE_INTERVIEW_TYPES, true);
  oneOf("programmingLanguage", "Programming language", PROGRAMMING_LANGUAGES, false);
  oneOf("difficulty", "Difficulty", COLLEGE_DIFFICULTIES, true);
  text("description", "Description", 2000, false);
  int("questionCount", "Number of questions", 1, 50, true);
  int("timeLimit", "Time limit (minutes)", 1, 300, true);

  if (problems.length) throw new AppError(problems.join("; "), 400);
  return out;
}

function parseQuestionInput(body: any) {
  const problems: string[] = [];
  const questionType = body?.questionType;
  if (!QUESTION_TYPES.includes(questionType)) {
    problems.push(`Question type must be one of: ${QUESTION_TYPES.join(", ")}`);
  }
  const question = str(body?.question, 4000);
  if (question.length < 3) problems.push("Question text is required");

  const difficulty = body?.difficulty === undefined ? "Medium" : body.difficulty;
  if (!QUESTION_DIFFICULTIES.includes(difficulty)) {
    problems.push(`Difficulty must be one of: ${QUESTION_DIFFICULTIES.join(", ")}`);
  }
  const marks = body?.marks === undefined ? 1 : Number(body.marks);
  if (!Number.isFinite(marks) || marks < 0 || marks > 100) problems.push("Marks must be a number between 0 and 100");

  const options = (Array.isArray(body?.options) ? body.options : []).slice(0, 4).map((o: unknown) => str(o, 500));
  const correctAnswer = body?.correctAnswer === undefined || body.correctAnswer === null ? "" : body.correctAnswer;
  if (!["A", "B", "C", "D", ""].includes(correctAnswer)) problems.push("Correct answer must be A, B, C or D");

  if (problems.length) throw new AppError(problems.join("; "), 400);

  const isMcq = questionType === "MCQ";
  const isCoding = questionType === "Coding";
  return {
    questionType,
    question,
    topic: str(body?.topic, 120),
    difficulty,
    marks,
    // Fields that do not apply to the chosen type are cleared, so stale data can't leak in.
    options: isMcq ? options : [],
    correctAnswer: isMcq ? correctAnswer : "",
    expectedAnswer: isMcq ? "" : str(body?.expectedAnswer, 4000),
    evaluationCriteria: isMcq ? "" : str(body?.evaluationCriteria, 2000),
    codingConfig: {
      language: isCoding ? str(body?.codingConfig?.language, 30) : "",
      starterCode: isCoding ? str(body?.codingConfig?.starterCode, 4000) : "",
      expectedSolution: isCoding ? str(body?.codingConfig?.expectedSolution, 6000) : "",
    },
  };
}

// ── publish validation ────────────────────────────────────

/** Everything that must be true before students can see and start an interview. */
export function publishProblems(interview: any, questions: any[]): string[] {
  const problems: string[] = [];
  if (questions.length === 0) {
    problems.push("Add at least one question");
  } else if (questions.length !== interview.questionCount) {
    problems.push(
      `The interview is set to ${interview.questionCount} question(s) but ${questions.length} ${
        questions.length === 1 ? "is" : "are"
      } written — add or remove questions, or change "Number of questions"`
    );
  }
  questions.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    if (!q.question || q.question.trim().length < 3) problems.push(`${n}: question text is missing`);
    if (!(q.marks > 0)) problems.push(`${n}: marks must be greater than 0`);
    if (q.questionType === "MCQ") {
      const opts: string[] = q.options || [];
      if (opts.length !== 4 || opts.some((o) => !o)) problems.push(`${n}: all four options (A–D) are required`);
      else if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) problems.push(`${n}: options must be different`);
      if (!["A", "B", "C", "D"].includes(q.correctAnswer)) problems.push(`${n}: choose the correct answer`);
    } else if (["Technical", "Coding", "Subjective"].includes(q.questionType)) {
      // Needed so the existing local evaluator has something to grade against.
      if (!q.expectedAnswer && !q.evaluationCriteria) {
        problems.push(`${n}: add an expected answer or evaluation criteria`);
      }
    }
  });
  return problems;
}

// ── shaping ───────────────────────────────────────────────

async function withCounts(interviews: any[]) {
  if (!interviews.length) return [];
  const ids = interviews.map((i) => i._id);
  const counts = await CollegeInterviewQuestion.aggregate([
    { $match: { interview: { $in: ids } } },
    { $group: { _id: "$interview", n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c: any) => [String(c._id), c.n as number]));
  return interviews.map((i) => ({ ...(i.toObject ? i.toObject() : i), questionsAuthored: byId.get(String(i._id)) || 0 }));
}

// ── interviews ────────────────────────────────────────────

export const listCollegeInterviews = asyncHandler(async (req: AuthRequest, res: Response) => {
  const filter: Record<string, unknown> = { college: collegeOf(req) };
  const status = req.query.status;
  if (typeof status === "string" && (COLLEGE_INTERVIEW_STATUSES as readonly string[]).includes(status)) {
    filter.status = status;
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { jobRole: rx }];
  }
  const docs = await CollegeInterview.find(filter).sort({ createdAt: -1 });
  res.json({ status: "success", data: await withCounts(docs) });
});

export const createCollegeInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const college = collegeOf(req);
  const input = parseInterviewInput(req.body, false);
  const doc = await CollegeInterview.create({
    ...input,
    college, // from the authenticated admin, never from the body
    createdBy: req.user._id,
    status: "draft",
  });
  res.status(201).json({ status: "success", data: { ...doc.toObject(), questionsAuthored: 0 } });
});

export const getCollegeInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  const [questions, attemptRows] = await Promise.all([
    CollegeInterviewQuestion.find({ interview: interview._id }).sort({ order: 1 }),
    Interview.aggregate([
      { $match: { collegeInterview: interview._id } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);
  const attempts: Record<string, number> = { total: 0, completed: 0, terminated: 0, "in-progress": 0 };
  attemptRows.forEach((r: any) => {
    attempts[r._id] = r.n;
    attempts.total += r.n;
  });
  res.json({
    status: "success",
    data: { interview: { ...interview.toObject(), questionsAuthored: questions.length }, questions, attempts },
  });
});

export const updateCollegeInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  if (interview.status === "closed") {
    throw new AppError("This interview is closed. Reopen it before editing.", 409);
  }
  const input = parseInterviewInput(req.body, true);
  if (Object.keys(input).length === 0) throw new AppError("No valid fields provided", 400);

  if (interview.status === "published") {
    // Students can already see it: the edited version must still be publishable.
    const questions = await CollegeInterviewQuestion.find({ interview: interview._id }).sort({ order: 1 });
    const problems = publishProblems({ ...interview.toObject(), ...input }, questions.map((q: any) => q.toObject()));
    if (problems.length) throw new AppError(`Cannot save changes to a published interview: ${problems.join("; ")}`, 400);
  }
  interview.set(input);
  await interview.save();
  res.json({ status: "success", data: interview });
});

export const setCollegeInterviewStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  const target = req.body?.status as CollegeInterviewStatus;
  if (!(COLLEGE_INTERVIEW_STATUSES as readonly string[]).includes(target)) {
    throw new AppError(`Status must be one of: ${COLLEGE_INTERVIEW_STATUSES.join(", ")}`, 400);
  }
  if (target === "published") {
    const questions = await CollegeInterviewQuestion.find({ interview: interview._id }).sort({ order: 1 });
    const problems = publishProblems(interview.toObject(), questions.map((q: any) => q.toObject()));
    if (problems.length) {
      // 422 + the full list, so the editor can show every problem at once.
      return res.status(422).json({
        status: "fail",
        message: "This interview cannot be published yet.",
        problems,
      });
    }
    if (interview.status !== "published") interview.set("publishedAt", new Date());
  }
  interview.set("status", target);
  await interview.save();
  res.json({ status: "success", data: interview });
});

export const deleteCollegeInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  if (await Interview.exists({ collegeInterview: interview._id })) {
    throw new AppError("Students have already attempted this interview. Close it instead of deleting it.", 409);
  }
  await CollegeInterviewQuestion.deleteMany({ interview: interview._id });
  await interview.deleteOne();
  res.json({ status: "success", message: "Interview deleted" });
});

// ── questions ─────────────────────────────────────────────

function assertStructureEditable(interview: any) {
  if (interview.status === "closed") throw new AppError("This interview is closed. Reopen it before editing.", 409);
  if (interview.status !== "draft") {
    throw new AppError("Move the interview back to draft before adding or removing questions.", 409);
  }
}

async function resequence(interviewId: unknown) {
  const qs = await CollegeInterviewQuestion.find({ interview: interviewId }).sort({ order: 1, createdAt: 1 }).select("_id");
  if (qs.length) {
    await CollegeInterviewQuestion.bulkWrite(
      qs.map((q: any, i: number) => ({ updateOne: { filter: { _id: q._id }, update: { $set: { order: i + 1 } } } }))
    );
  }
}

const loadQuestion = async (interview: any, qid: string) => {
  if (!isObjectId(qid)) throw new AppError("Question not found", 404);
  const q = await CollegeInterviewQuestion.findOne({ _id: qid, interview: interview._id, college: interview.college });
  if (!q) throw new AppError("Question not found", 404);
  return q;
};

export const addCollegeQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  assertStructureEditable(interview);
  const input = parseQuestionInput(req.body);
  const count = await CollegeInterviewQuestion.countDocuments({ interview: interview._id });
  if (count >= 100) throw new AppError("An interview can have at most 100 questions", 400);
  const q = await CollegeInterviewQuestion.create({
    ...input,
    interview: interview._id,
    college: interview.college,
    order: count + 1,
  });
  res.status(201).json({ status: "success", data: q });
});

export const updateCollegeQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  if (interview.status === "closed") throw new AppError("This interview is closed. Reopen it before editing.", 409);
  const q = await loadQuestion(interview, req.params.qid);
  const input = parseQuestionInput({ ...q.toObject(), ...req.body });

  if (interview.status === "published") {
    const problems = publishProblems(interview.toObject(), [{ ...q.toObject(), ...input }]);
    // Only this question's own problems matter here (the count check is about the whole set).
    const own = problems.filter((p) => p.startsWith("Question 1"));
    if (own.length) throw new AppError(`Cannot save: ${own.join("; ").replace(/Question 1: /g, "")}`, 400);
  }
  q.set(input);
  await q.save();
  res.json({ status: "success", data: q });
});

export const deleteCollegeQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  assertStructureEditable(interview);
  const q = await loadQuestion(interview, req.params.qid);
  await q.deleteOne();
  await resequence(interview._id);
  res.json({ status: "success", message: "Question deleted" });
});

export const duplicateCollegeQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  assertStructureEditable(interview);
  const q = await loadQuestion(interview, req.params.qid);
  const { _id, createdAt, updatedAt, ...rest } = q.toObject() as any;
  // Placed right after the original; the resequence below makes the numbers contiguous.
  const copy = await CollegeInterviewQuestion.create({ ...rest, order: q.order + 0.5 });
  await resequence(interview._id);
  res.status(201).json({ status: "success", data: await CollegeInterviewQuestion.findById(copy._id) });
});

export const reorderCollegeQuestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await loadOwned(req);
  if (interview.status === "closed") throw new AppError("This interview is closed. Reopen it before editing.", 409);
  const ids: unknown = req.body?.order;
  const existing = await CollegeInterviewQuestion.find({ interview: interview._id }).select("_id");
  const existingIds = existing.map((e: any) => String(e._id));
  if (
    !Array.isArray(ids) ||
    ids.length !== existingIds.length ||
    new Set(ids.map(String)).size !== ids.length ||
    !ids.every((id) => existingIds.includes(String(id)))
  ) {
    throw new AppError("'order' must list every question of this interview exactly once", 400);
  }
  await CollegeInterviewQuestion.bulkWrite(
    ids.map((id: string, i: number) => ({
      updateOne: { filter: { _id: id, interview: interview._id }, update: { $set: { order: i + 1 } } },
    }))
  );
  const questions = await CollegeInterviewQuestion.find({ interview: interview._id }).sort({ order: 1 });
  res.json({ status: "success", data: questions });
});
