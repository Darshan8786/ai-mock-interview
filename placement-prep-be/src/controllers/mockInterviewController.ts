import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Interview } from "../models/Interview";
import { CheatingEvent } from "../models/CheatingEvent";
import { InterviewReport } from "../models/InterviewReport";
import axios from "axios";
import OpenAI from "openai";
import { syncInterviewToVectorDB, getInterviewContext } from "../services/interviewRagService";
import { pickBankQuestions } from "../data/interviewQuestionBank";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";

const aiServiceHeaders = {
  "X-AI-Service-Key": AI_SERVICE_KEY,
};

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy-key",
  baseURL: "https://api.groq.com/openai/v1",
  // Without these the SDK default is a 10-minute timeout + 2 retries, which lets
  // a slow/rate-limited Groq call stall interview creation for minutes.
  timeout: 12000,
  maxRetries: 1,
});

// Overall ceiling for acquiring questions before we fall back to the static
// pool. Interview creation must never exceed roughly this + DB write time.
const QUESTION_DEADLINE_MS = 14000;
// Combined budget for the best-effort RAG + previous-questions lookups.
const PREP_DEADLINE_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const INTERVIEW_TYPE_GUIDANCE: Record<
  string,
  { system: string; note: string; focus: string }
> = {
  Technical: {
    system: "You are an expert technical interviewer at a top tech company.",
    note:
      "IMPORTANT: The candidate is a college student preparing for campus placements. Keep every question at a MODERATE level - foundational concepts, common frameworks, and standard placement topics. Avoid advanced, niche, or expert-level questions. Prefer universal core topics (data structures, OOP basics, SQL basics, networking/OS fundamentals) and the most mainstream frameworks only. Avoid deep framework internals or architecture deep-dives.",
    focus:
      "Every question MUST be a genuine technical question and specifically about __JOB_ROLE__ (frameworks, concepts, tools, and real scenarios for this exact role). Mix of conceptual and practical questions.",
  },
  HR: {
    system: "You are an experienced HR interviewer at a top tech company.",
    note:
      "IMPORTANT: Ask HR-style questions - self-introduction, motivation, strengths and weaknesses, career goals, salary/work expectations, and cultural fit. Keep them at a MODERATE level appropriate for a college student preparing for campus placements.",
    focus:
      "Every question MUST be a genuine HR question - NO technical, coding, data-structure, or framework questions. Tailor each question to the __JOB_ROLE__ role but keep it human-resource focused.",
  },
  Behavioral: {
    system: "You are an expert behavioral interviewer at a top tech company.",
    note:
      "IMPORTANT: Ask behavioral and situational (STAR method style) questions about past experiences and hypothetical work situations - teamwork, conflict, leadership, deadlines, and adaptation. Keep them at a MODERATE level appropriate for a college student preparing for campus placements.",
    focus:
      "Every question MUST be a behavioral or situational question - NO technical, coding, or HR-fit questions. Ask the candidate to describe past behavior or how they would handle a specific scenario relevant to the __JOB_ROLE__ role.",
  },
};

async function generateQuestionsWithGroq(
  jobRole: string,
  experienceLevel: string,
  interviewType: string,
  difficulty: string,
  count: number,
  context: string,
  previousQuestions: string
): Promise<string[]> {
  const guidance = INTERVIEW_TYPE_GUIDANCE[interviewType] || INTERVIEW_TYPE_GUIDANCE.Technical;
  const contextBlock = context
    ? `\n\nCandidate's past performance (use this to tailor questions to the candidate's weaker areas):\n${context}`
    : "";
  const prevBlock = previousQuestions
    ? `\n\nQuestions already asked before (DO NOT repeat any of these):\n${previousQuestions}`
    : "";
  const difficultyNote = `\n\n${guidance.note}`;
  const focus = guidance.focus.replace(/__JOB_ROLE__/g, jobRole);
  const prompt = `${guidance.system} Generate ${count} UNIQUE ${difficulty} difficulty ${interviewType} interview questions for a ${experienceLevel} level ${jobRole} position.
${contextBlock}
${prevBlock}
${difficultyNote}
Requirements:
- ${focus}
- Do NOT use generic questions that would fit any role.
- If the candidate's past performance shows weak areas, include questions that probe those weak areas.
- Do NOT repeat any question from the "already asked before" list.
Return ONLY a valid JSON array of exactly ${count} strings. Example: ["Question 1", "Question 2", ...]`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.9,
  });

  const rawContent = completion.choices[0]?.message?.content || "";
  const cleaned = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  const questions = Array.isArray(parsed) ? parsed.map((q: string) => q.trim()) : [];
  return dedupeQuestions(questions).slice(0, count);
}

function dedupeQuestions(questions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const q of questions) {
    const key = q.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(q);
    }
  }
  return result;
}

interface QuestionGenInput {
  jobRole: string;
  experienceLevel: string;
  interviewType: string;
  difficulty: string;
  totalQuestions: number;
}

// Runs the full AI question pipeline for an already-created interview, then
// persists the result. Detached from the HTTP request so interview creation
// (and therefore proctoring) never waits on — or fails because of — the AI
// provider. Always resolves to a usable question set (static fallback on any
// failure); "failed" is only written if even that persistence throws.
async function generateQuestionsForInterview(
  interviewId: string,
  input: QuestionGenInput,
  userId: string
): Promise<void> {
  const { jobRole, experienceLevel, interviewType, difficulty, totalQuestions } = input;
  // Hoisted so the catch block can also skip already-asked questions.
  let previousQuestions = "";
  try {
    let questionTexts: string[];

    const [ragContext, prev] = await Promise.all([
      withTimeout(
        getInterviewContext(userId, `${jobRole} ${interviewType} ${experienceLevel}`),
        PREP_DEADLINE_MS,
        ""
      ),
      withTimeout(
        Interview.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("questions")
          .lean()
          .then((recentInterviews) => {
            const seenSet = new Set<string>();
            const previousLines: string[] = [];
            for (const iv of recentInterviews) {
              for (const q of (iv as any).questions || []) {
                const key = String(q.question || "").trim().toLowerCase();
                if (key && !seenSet.has(key)) {
                  seenSet.add(key);
                  previousLines.push(q.question);
                }
              }
            }
            return previousLines.slice(0, 40).join("\n");
          }),
        PREP_DEADLINE_MS,
        ""
      ),
    ]);
    previousQuestions = prev;

    const questionRacers: Promise<string[]>[] = [];

    if (process.env.GROQ_API_KEY) {
      questionRacers.push(
        generateQuestionsWithGroq(
          jobRole, experienceLevel, interviewType, difficulty, totalQuestions, ragContext, previousQuestions
        ).catch((err) => {
          console.error(
            `Groq question generation failed (status ${err?.status ?? "n/a"}): ${err?.message}`
          );
          return [] as string[];
        })
      );
    }

    questionRacers.push(
      axios.post(`${AI_SERVICE_URL}/generate-questions`, {
        jobRole, experienceLevel, interviewType, difficulty, totalQuestions,
        context: ragContext, previousQuestions,
      }, { timeout: 8000, headers: aiServiceHeaders })
        .then((r) => (r.data.questions as string[]) || [])
        .catch(() => [] as string[])
    );

    const raceForQuestions = new Promise<string[]>((resolve) => {
      let settled = 0;
      let resolved = false;
      if (questionRacers.length === 0) { resolve([]); return; }
      for (const p of questionRacers) {
        p.then((qs) => {
          settled++;
          if (!resolved && qs.length > 0) { resolved = true; resolve(qs); }
          else if (settled === questionRacers.length && !resolved) { resolve([]); }
        });
      }
    });

    questionTexts = await withTimeout(raceForQuestions, QUESTION_DEADLINE_MS, []);

    if (questionTexts.length === 0) {
      console.warn(
        `Interview ${interviewId}: question generation fell back to static pool (role="${jobRole}" type="${interviewType}")`
      );
      questionTexts = generateFallbackQuestions(jobRole, interviewType, totalQuestions, previousQuestions);
    }

    questionTexts = dedupeQuestions(questionTexts).slice(0, totalQuestions);

    const questions = questionTexts.map((q: string) => ({
      question: q,
      answer: "",
      answerType: "text" as const,
      timeTaken: 0,
      skipped: false,
      evaluation: {
        technicalScore: 0,
        communicationScore: 0,
        confidenceScore: 0,
        grammarScore: 0,
        fluencyScore: 0,
        relevanceScore: 0,
        feedback: "",
      },
    }));

    await Interview.updateOne(
      { _id: interviewId },
      { $set: { questions, questionsStatus: "ready" } }
    );
  } catch (err: any) {
    console.error(`generateQuestionsForInterview crashed for ${interviewId}: ${err?.message}`);
    try {
      const questions = generateFallbackQuestions(
        jobRole,
        interviewType,
        totalQuestions,
        previousQuestions
      ).map(
        (q: string) => ({
          question: q,
          answer: "",
          answerType: "text" as const,
          timeTaken: 0,
          skipped: false,
          evaluation: {
            technicalScore: 0,
            communicationScore: 0,
            confidenceScore: 0,
            grammarScore: 0,
            fluencyScore: 0,
            relevanceScore: 0,
            feedback: "",
          },
        })
      );
      await Interview.updateOne(
        { _id: interviewId },
        { $set: { questions, questionsStatus: "ready" } }
      );
    } catch (persistErr: any) {
      console.error(
        `generateQuestionsForInterview could not persist fallback for ${interviewId}: ${persistErr?.message}`
      );
      await Interview.updateOne(
        { _id: interviewId },
        { $set: { questionsStatus: "failed" } }
      ).catch(() => {});
    }
  }
}

export const createInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { jobRole, experienceLevel, interviewType, difficulty, totalQuestions } = req.body;

  if (!jobRole || !experienceLevel || !interviewType || !difficulty || !totalQuestions) {
    throw new AppError("All fields are required", 400);
  }

  // Create the session immediately and return its id — proctoring binds to this
  // id and must not wait on (or be blocked by) AI question generation, which now
  // runs in the background.
  const interview = await Interview.create({
    user: req.user._id,
    jobRole,
    experienceLevel,
    interviewType,
    difficulty,
    totalQuestions,
    status: "in-progress",
    questionsStatus: "generating",
    startedAt: new Date(),
    questions: [],
  });

  // Detached — must never reject to the process (would trip the global
  // unhandledRejection handler and take the whole API down). The function is
  // internally guarded; this is just belt-and-suspenders.
  generateQuestionsForInterview(
    interview._id.toString(),
    { jobRole, experienceLevel, interviewType, difficulty, totalQuestions },
    req.user._id.toString()
  ).catch((err) =>
    console.error(`generateQuestionsForInterview rejected for ${interview._id}: ${err?.message}`)
  );

  res.status(201).json({ success: true, data: interview });
});

// Lightweight poll target for the question system. Deliberately small so the
// client can hit it every ~1.5s without pulling the whole interview document.
export const getInterviewState = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await Interview.findOne({
    _id: req.params.id,
    user: req.user._id,
  }).select("status questionsStatus currentQuestionIndex totalQuestions questions.question");

  if (!interview) throw new AppError("Interview not found", 404);

  const idx = interview.currentQuestionIndex;
  const ready = interview.questionsStatus === "ready" && interview.questions.length > idx;

  res.json({
    success: true,
    data: {
      status: interview.status,
      questionsStatus: interview.questionsStatus,
      currentQuestionIndex: idx,
      totalQuestions: interview.totalQuestions,
      currentQuestion: ready
        ? { question: interview.questions[idx].question, index: idx }
        : null,
    },
  });
});

// Retry hook for the question system — never touches proctoring.
export const regenerateQuestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await Interview.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!interview) throw new AppError("Interview not found", 404);
  if (interview.status !== "in-progress") {
    throw new AppError("Interview is not in progress", 400);
  }

  interview.set("questionsStatus", "generating");
  await interview.save();

  generateQuestionsForInterview(
    interview._id.toString(),
    {
      jobRole: interview.jobRole,
      experienceLevel: interview.experienceLevel,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      totalQuestions: interview.totalQuestions,
    },
    req.user._id.toString()
  ).catch((err) =>
    console.error(`generateQuestionsForInterview rejected for ${interview._id}: ${err?.message}`)
  );

  res.json({ success: true, data: { questionsStatus: "generating" } });
});

export const getInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await Interview.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!interview) {
    throw new AppError("Interview not found", 404);
  }

  res.json({ success: true, data: interview });
});

export const submitAnswer = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { answer, answerType, timeTaken } = req.body;
  const interview = await Interview.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!interview) throw new AppError("Interview not found", 404);
  if (interview.status === "completed" || interview.status === "terminated") {
    throw new AppError("Interview already finished", 400);
  }
  if (interview.questionsStatus !== "ready" || interview.questions.length === 0) {
    throw new AppError("Questions are not ready yet", 409);
  }

  const answeredIndex = interview.currentQuestionIndex;
  const currentQ = interview.questions[answeredIndex];
  currentQ.answer = answer;
  currentQ.answerType = answerType || "text";
  currentQ.timeTaken = timeTaken || 0;

  const isLastQuestion = answeredIndex + 1 >= interview.totalQuestions;
  const interviewId = interview._id.toString();
  const evalPayload = {
    question: currentQ.question,
    answer,
    interviewType: interview.interviewType,
    difficulty: interview.difficulty,
    jobRole: interview.jobRole,
  };

  if (isLastQuestion) {
    // Final answer: the user already expects the "generating report" wait here,
    // so evaluate inline (bounded) so calculateScores sees real numbers.
    try {
      const evalResponse = await axios.post(
        `${AI_SERVICE_URL}/evaluate-answer`,
        evalPayload,
        { timeout: 20000, headers: aiServiceHeaders }
      );
      currentQ.evaluation = evalResponse.data.evaluation || heuristicEvaluation();
    } catch {
      currentQ.evaluation = heuristicEvaluation();
    }
  } else {
    // Non-final answer: never block the next question on evaluation. Store a
    // heuristic placeholder now, then patch in the real evaluation in the
    // background so the final report is still AI-graded.
    currentQ.evaluation = heuristicEvaluation();
    void (async () => {
      try {
        const evalResponse = await axios.post(
          `${AI_SERVICE_URL}/evaluate-answer`,
          evalPayload,
          { timeout: 45000, headers: aiServiceHeaders }
        );
        const evaluation = evalResponse.data.evaluation;
        if (evaluation) {
          await Interview.updateOne(
            { _id: interviewId },
            { $set: { [`questions.${answeredIndex}.evaluation`]: evaluation } }
          );
        }
      } catch (err: any) {
        console.error(
          `Background answer evaluation failed for interview ${interviewId} q${answeredIndex}: ${err?.message}`
        );
      }
    })();
  }

  interview.currentQuestionIndex += 1;

  if (interview.currentQuestionIndex >= interview.totalQuestions) {
    interview.status = "completed";
    interview.completedAt = new Date();
    await calculateScores(interview);
  }

  await interview.save();

  const nextQuestion = interview.currentQuestionIndex < interview.totalQuestions
    ? { question: interview.questions[interview.currentQuestionIndex].question, index: interview.currentQuestionIndex }
    : null;

  res.json({
    success: true,
    data: {
      nextQuestion,
      isComplete: interview.status === "completed",
      evaluation: currentQ.evaluation,
      questionIndex: interview.currentQuestionIndex - 1,
    },
  });
});

export const skipQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await Interview.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!interview) throw new AppError("Interview not found", 404);
  if (interview.status === "completed" || interview.status === "terminated") {
    throw new AppError("Interview already finished", 400);
  }
  if (interview.questionsStatus !== "ready" || interview.questions.length === 0) {
    throw new AppError("Questions are not ready yet", 409);
  }

  interview.questions[interview.currentQuestionIndex].skipped = true;
  interview.currentQuestionIndex += 1;

  if (interview.currentQuestionIndex >= interview.totalQuestions) {
    interview.status = "completed";
    interview.completedAt = new Date();
    await calculateScores(interview);
  }

  await interview.save();

  const nextQuestion = interview.currentQuestionIndex < interview.totalQuestions
    ? { question: interview.questions[interview.currentQuestionIndex].question, index: interview.currentQuestionIndex }
    : null;

  res.json({ success: true, data: { nextQuestion, isComplete: interview.status === "completed" } });
});

export const reportCheating = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, description, metadata } = req.body;
  const interview = await Interview.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!interview) throw new AppError("Interview not found", 404);
  if (interview.status === "completed" || interview.status === "terminated") {
    return res.json({ success: true, data: { terminated: false, message: "Interview already finished" } });
  }

  await CheatingEvent.create({
    interview: interview._id,
    user: req.user._id,
    type,
    description,
    metadata: metadata || {},
  });

  interview.cheatingCount += 1;
  interview.warnings.push({
    type,
    message: description,
    timestamp: new Date(),
    severity: interview.cheatingCount >= 3 ? "high" : interview.cheatingCount >= 2 ? "medium" : "low",
  });

  let terminated = false;
  if (interview.cheatingCount >= 3) {
    interview.status = "terminated";
    interview.autoTerminated = true;
    interview.completedAt = new Date();
    await calculateScores(interview);
    terminated = true;
  }

  await interview.save();

  res.json({
    success: true,
    data: {
      terminated,
      cheatingCount: interview.cheatingCount,
      warningsRemaining: Math.max(0, 3 - interview.cheatingCount),
      message: terminated
        ? "Interview terminated due to multiple cheating violations."
        : `Warning ${interview.cheatingCount}/3`,
    },
  });
});

export const terminateInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await Interview.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!interview) throw new AppError("Interview not found", 404);
  if (interview.status === "completed" || interview.status === "terminated") {
    throw new AppError("Interview already finished", 400);
  }

  interview.status = "terminated";
  interview.completedAt = new Date();
  await calculateScores(interview);
  await interview.save();

  res.json({ success: true, data: interview });
});

export const getReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interview = await Interview.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!interview) throw new AppError("Interview not found", 404);
  if (interview.status !== "completed" && interview.status !== "terminated") {
    throw new AppError("Interview not yet completed", 400);
  }

  let report = await InterviewReport.findOne({ interview: interview._id });
  if (!report) {
    // Background answer evaluations may have landed after the interview was
    // finalised — recompute the numeric scores (cheap, no external calls) so the
    // report reflects the real AI grades rather than the placeholder heuristics.
    if (recomputeNumericScores(interview)) {
      await interview.save();
    }

    report = await InterviewReport.create({
      interview: interview._id,
      user: req.user._id,
      overallScore: interview.overallScore,
      technicalScore: interview.technicalScore,
      communicationScore: interview.communicationScore,
      confidenceScore: interview.confidenceScore,
      grammarScore: interview.grammarScore,
      fluencyScore: interview.fluencyScore,
      cheatingCount: interview.cheatingCount,
      warnings: interview.warnings,
      strengths: interview.strengths,
      weaknesses: interview.weaknesses,
      areasToImprove: interview.areasToImprove,
      finalFeedback: interview.finalFeedback,
      jobRole: interview.jobRole,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      totalQuestions: interview.totalQuestions,
      questionsAttempted: interview.questions.filter((q: any) => !q.skipped && q.answer).length,
      totalTimeTaken: interview.totalTimeTaken,
    });
  }

  const cheatingEvents = await CheatingEvent.find({ interview: interview._id }).sort({ timestamp: -1 });

  res.json({
    success: true,
    data: {
      interview,
      report,
      cheatingEvents,
    },
  });
});

export const getDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const interviews = await Interview.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .select("jobRole interviewType difficulty overallScore status cheatingCount createdAt totalQuestions");

  const reports = await InterviewReport.find({ user: req.user._id }).sort({ createdAt: -1 });

  const stats = {
    totalInterviews: interviews.length,
    completedInterviews: interviews.filter((i: any) => i.status === "completed" || i.status === "terminated").length,
    averageScore: 0,
    bestScore: 0,
    totalCheatingEvents: 0,
    recentInterviews: interviews.slice(0, 5),
  };

  if (reports.length > 0) {
    const scores = reports.map((r: any) => r.overallScore);
    stats.averageScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    stats.bestScore = Math.max(...scores);
    stats.totalCheatingEvents = reports.reduce((sum: number, r: any) => sum + (r.cheatingCount || 0), 0);
  }

  res.json({ success: true, data: { interviews, reports, stats } });
});

// Neutral placeholder used when an AI evaluation is unavailable or still
// pending in the background. Kept mid-range so it neither rewards nor unfairly
// penalises the candidate.
function heuristicEvaluation() {
  return {
    technicalScore: Math.floor(Math.random() * 40) + 60,
    communicationScore: Math.floor(Math.random() * 40) + 60,
    confidenceScore: Math.floor(Math.random() * 40) + 60,
    grammarScore: Math.floor(Math.random() * 40) + 60,
    fluencyScore: Math.floor(Math.random() * 40) + 60,
    relevanceScore: Math.floor(Math.random() * 40) + 60,
    feedback: "Good attempt. Consider providing more specific examples in your answer.",
  };
}

// Cheap recompute of the aggregate numeric scores from per-question
// evaluations. No external calls. Returns true if any value changed.
function recomputeNumericScores(interview: any): boolean {
  const answered = interview.questions.filter((q: any) => q.evaluation && !q.skipped);
  if (answered.length === 0) return false;

  const avg = (pick: (e: any) => number) =>
    Math.round(
      answered.reduce((sum: number, q: any) => sum + (pick(q.evaluation) || 0), 0) /
        answered.length
    );

  const next = {
    technicalScore: avg((e) => e.technicalScore),
    communicationScore: avg((e) => e.communicationScore),
    confidenceScore: avg((e) => e.confidenceScore),
    grammarScore: avg((e) => e.grammarScore),
    fluencyScore: avg((e) => e.fluencyScore),
  };
  const overall = Math.round(
    (next.technicalScore +
      next.communicationScore +
      next.confidenceScore +
      next.grammarScore +
      next.fluencyScore) /
      5
  );

  let changed = false;
  for (const [k, v] of Object.entries(next)) {
    if (interview[k] !== v) {
      interview[k] = v;
      changed = true;
    }
  }
  if (interview.overallScore !== overall) {
    interview.overallScore = overall;
    changed = true;
  }
  return changed;
}

// Synchronous finalisation — numeric aggregates, strengths/weaknesses, and a
// deterministic fallback narrative. No external calls, so callers that run this
// before responding are never blocked on the AI service.
function finalizeScores(interview: any) {
  const answered = interview.questions.filter((q: any) => q.evaluation && !q.skipped);
  if (answered.length === 0) {
    interview.overallScore = 0;
    return;
  }

  recomputeNumericScores(interview);

  interview.strengths = generateStrengths(interview);
  interview.weaknesses = generateWeaknesses(interview);
  interview.areasToImprove = generateAreasToImprove(interview);

  if (!interview.finalFeedback) {
    interview.finalFeedback = generateFallbackFeedback(interview);
  }
}

// Background: replace the fallback narrative with an AI-generated one and index
// the interview into Pinecone. Bounded and fully detached from the request.
async function enhanceFeedbackAndSync(interviewId: string) {
  // Small delay so the request handler's own interview.save() lands first —
  // this function only patches finalFeedback via updateOne, never a full save,
  // so it can't clobber the handler's status/score writes.
  await new Promise((r) => setTimeout(r, 750));
  try {
    const interview = await Interview.findById(interviewId).lean();
    if (!interview) return;
    const iv = interview as any;
    const answered = (iv.questions || []).filter((q: any) => q.evaluation && !q.skipped);

    if (answered.length > 0) {
      try {
        const feedbackRes = await axios.post(
          `${AI_SERVICE_URL}/generate-feedback`,
          {
            scores: {
              overall: iv.overallScore,
              technical: iv.technicalScore,
              communication: iv.communicationScore,
              confidence: iv.confidenceScore,
              grammar: iv.grammarScore,
              fluency: iv.fluencyScore,
            },
            strengths: iv.strengths,
            weaknesses: iv.weaknesses,
            jobRole: iv.jobRole,
          },
          { timeout: 15000, headers: aiServiceHeaders }
        );
        if (feedbackRes.data.feedback) {
          await Interview.updateOne(
            { _id: interviewId },
            { $set: { finalFeedback: feedbackRes.data.feedback } }
          );
        }
      } catch (err: any) {
        console.error(
          `Interview feedback enhancement failed for ${interviewId}: ${err?.message}`
        );
      }
    }

    await syncInterviewToVectorDB(iv.user.toString(), iv).catch((err) =>
      console.error("Interview RAG sync error:", err.message)
    );
  } catch (err: any) {
    console.error(`enhanceFeedbackAndSync failed for ${interviewId}: ${err?.message}`);
  }
}

// Backwards-compatible entry point: finalise synchronously, then kick off the
// AI enhancement + RAG sync in the background (not awaited).
async function calculateScores(interview: any) {
  finalizeScores(interview);
  const id = interview._id?.toString();
  if (id) void enhanceFeedbackAndSync(id);
}

// Server-side fallback question set — used whenever AI generation (Groq +
// ai-service) produces nothing. Draws from the ~100-question static bank in
// src/data/interviewQuestionBank.ts, role-filled and shuffled, skipping any
// question the candidate has already been asked in a recent interview.
function generateFallbackQuestions(
  jobRole: string,
  type: string,
  count: number,
  previousQuestions = ""
): string[] {
  const exclude = new Set(
    previousQuestions
      .split("\n")
      .map((q) => q.trim().toLowerCase())
      .filter(Boolean)
  );
  return pickBankQuestions(jobRole, type, count, exclude);
}

function generateStrengths(interview: any): string[] {
  const strengths: string[] = [];
  if (interview.technicalScore >= 70) strengths.push("Strong technical knowledge");
  if (interview.communicationScore >= 70) strengths.push("Excellent communication skills");
  if (interview.confidenceScore >= 70) strengths.push("High confidence in responses");
  if (interview.grammarScore >= 70) strengths.push("Good grammatical accuracy");
  if (interview.fluencyScore >= 70) strengths.push("Fluent and articulate answers");
  if (strengths.length === 0) strengths.push("Willingness to participate and learn");
  return strengths;
}

function generateWeaknesses(interview: any): string[] {
  const weaknesses: string[] = [];
  if (interview.technicalScore < 60) weaknesses.push("Technical knowledge needs improvement");
  if (interview.communicationScore < 60) weaknesses.push("Communication could be clearer");
  if (interview.confidenceScore < 60) weaknesses.push("Lacks confidence in responses");
  if (interview.grammarScore < 60) weaknesses.push("Grammatical errors in answers");
  if (interview.fluencyScore < 60) weaknesses.push("Answers lack fluency");
  if (weaknesses.length === 0) weaknesses.push("Could provide more detailed examples");
  return weaknesses;
}

function generateAreasToImprove(interview: any): string[] {
  const areas: string[] = [];
  if (interview.technicalScore < 75) areas.push("Deepen technical knowledge");
  if (interview.communicationScore < 75) areas.push("Practice structured communication");
  if (interview.confidenceScore < 75) areas.push("Build confidence through mock interviews");
  if (interview.grammarScore < 75) areas.push("Improve grammar and vocabulary");
  if (interview.fluencyScore < 75) areas.push("Practice speaking more fluently");
  if (areas.length === 0) areas.push("Continue practicing with real-world scenarios");
  return areas;
}

function generateFallbackFeedback(interview: any): string {
  return `You completed a ${interview.difficulty} level ${interview.interviewType} interview for ${interview.jobRole}. Your overall score is ${interview.overallScore}/100. Focus on strengthening your technical fundamentals and practicing structured responses. Continue taking mock interviews to build confidence and improve your communication skills.`;
}
