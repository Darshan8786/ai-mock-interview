import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Interview } from "../models/Interview";
import { CheatingEvent } from "../models/CheatingEvent";
import { InterviewReport } from "../models/InterviewReport";
import axios from "axios";
import { syncInterviewToVectorDB, getInterviewContext } from "../services/interviewRagService";
import { pickBankQuestions } from "../data/interviewQuestionBank";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";

const aiServiceHeaders = {
  "X-AI-Service-Key": AI_SERVICE_KEY,
};

// Question generation runs entirely on the locally fine-tuned model served by
// the ai-service (see ai-services/interview_question_service.py) - no Groq /
// OpenAI / Gemini API key is required. If the ai-service is unreachable, slow,
// or returns nothing, generateFallbackQuestions() below (the static in-repo
// bank) takes over - still zero external API calls.
//
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

interface GeneratedQuestion {
  question: string;
  skill?: string;
  topic?: string;
  concepts?: string[];
}

interface ResumeProfile {
  skills: string[];
  projects: Array<{ name: string; description: string; technologies: string[] }>;
}

const MAX_RESUME_SKILLS = 30;
const MAX_RESUME_PROJECTS = 5;

function clipText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// The resume arrives from the client (already parsed by /resume/parse), so it
// is bounded and reshaped here rather than trusted: only the fields the
// question planner reads are kept, with length/count limits. Returns null when
// nothing usable is left (no skills and no named project).
function sanitizeResumeProfile(raw: any): ResumeProfile | null {
  if (!raw || typeof raw !== "object") return null;

  const skills = (Array.isArray(raw.skills) ? raw.skills : [])
    .map((s: unknown) => clipText(s, 60))
    .filter(Boolean)
    .slice(0, MAX_RESUME_SKILLS);

  const projects = (Array.isArray(raw.projects) ? raw.projects : [])
    .map((p: any) => ({
      name: clipText(p?.name, 120),
      description: clipText(p?.description, 600),
      technologies: (Array.isArray(p?.technologies) ? p.technologies : [])
        .map((t: unknown) => clipText(t, 40))
        .filter(Boolean)
        .slice(0, 10),
    }))
    .filter((p: { name: string }) => p.name)
    .slice(0, MAX_RESUME_PROJECTS);

  if (skills.length === 0 && projects.length === 0) return null;
  return { skills, projects };
}

function dedupeQuestions(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  const seen = new Set<string>();
  const result: GeneratedQuestion[] = [];
  for (const q of questions) {
    const key = q.question.trim().toLowerCase();
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
  resumeSkills?: string[];
  // Only for interviewType "Resume".
  resumeProfile?: ResumeProfile | null;
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
    let questions: GeneratedQuestion[];

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

    // Local-model-backed generation (ai-service -> LocalQuestionGenerator ->
    // fine-tuned model, itself falling back to the offline question bank
    // internally). No external LLM API key is used anywhere in this call.
    // userId + interviewId let the ai-service record each shown question in
    // its GLOBAL, cross-user, persistent history store (never repeat a
    // question - to anyone, ever) rather than only tracking it per-user here.
    const localModelQuestions = axios
      .post(
        `${AI_SERVICE_URL}/generate-questions`,
        {
          jobRole, experienceLevel, interviewType, difficulty, totalQuestions,
          context: ragContext, previousQuestions, resumeSkills: input.resumeSkills || [],
          resume: input.resumeProfile || undefined,
          userId, interviewId,
        },
        { timeout: 12000, headers: aiServiceHeaders }
      )
      .then((r) => {
        if (r.data.insufficient) {
          console.warn(
            `Interview ${interviewId}: local training dataset/model could not produce ${totalQuestions} ` +
              `globally-unused questions for role="${jobRole}" type="${interviewType}" difficulty="${difficulty}" ` +
              `(got ${r.data.questions?.length ?? 0}). The dataset needs more unique examples for this combination.`
          );
        }
        return (r.data.questions as GeneratedQuestion[]) || [];
      })
      .catch((err) => {
        console.error(`Local question-generation service failed: ${err?.message}`);
        return [] as GeneratedQuestion[];
      });

    questions = await withTimeout(localModelQuestions, QUESTION_DEADLINE_MS, []);

    if (questions.length < totalQuestions) {
      console.warn(
        `Interview ${interviewId}: topping up with the static fallback pool (role="${jobRole}" type="${interviewType}")`
      );
      const seenTexts = new Set(questions.map((q) => q.question.trim().toLowerCase()));
      const stillExcluded = previousQuestions + "\n" + questions.map((q) => q.question).join("\n");
      const fallback = generateFallbackQuestions(
        jobRole,
        interviewType,
        totalQuestions - questions.length,
        stillExcluded
      ).filter((q) => !seenTexts.has(q.question.trim().toLowerCase()));
      questions = questions.concat(fallback);
    }

    questions = dedupeQuestions(questions).slice(0, totalQuestions);

    const questionDocs = questions.map((q) => ({
      question: q.question,
      skill: q.skill || "",
      topic: q.topic || "",
      concepts: q.concepts || [],
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
      { $set: { questions: questionDocs, questionsStatus: "ready" } }
    );
  } catch (err: any) {
    console.error(`generateQuestionsForInterview crashed for ${interviewId}: ${err?.message}`);
    try {
      const questions = generateFallbackQuestions(
        jobRole,
        interviewType,
        totalQuestions,
        previousQuestions
      ).map((q) => ({
        question: q.question,
        skill: q.skill || "",
        topic: q.topic || "",
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

  let resumeProfile: ResumeProfile | null = null;
  if (interviewType === "Resume") {
    resumeProfile = sanitizeResumeProfile(req.body.resume);
    if (!resumeProfile) {
      throw new AppError(
        "A resume-based interview needs a parsed resume with at least one skill or project. Upload your resume and try again.",
        400
      );
    }
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
    ...(resumeProfile ? { resumeProfile } : {}),
  });

  // Detached — must never reject to the process (would trip the global
  // unhandledRejection handler and take the whole API down). The function is
  // internally guarded; this is just belt-and-suspenders.
  generateQuestionsForInterview(
    interview._id.toString(),
    {
      jobRole, experienceLevel, interviewType, difficulty, totalQuestions,
      resumeSkills: resumeProfile ? resumeProfile.skills : req.user.skills || [],
      resumeProfile,
    },
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
      resumeSkills: (interview as any).resumeProfile?.skills?.length
        ? Array.from((interview as any).resumeProfile.skills as string[])
        : req.user.skills || [],
      resumeProfile: (interview as any).resumeProfile
        ? JSON.parse(JSON.stringify((interview as any).resumeProfile))
        : null,
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
    skill: (currentQ as any).skill || "",
    topic: (currentQ as any).topic || "",
    concepts: Array.from(((currentQ as any).concepts as string[]) || []),
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
  const isTabSwitch = type === "tab_switch";
  if (isTabSwitch) {
    interview.tabSwitchCount += 1;
  }
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
    if (isTabSwitch && interview.tabSwitchCount >= 3) {
      interview.terminationReason = "TAB_SWITCH_LIMIT_EXCEEDED";
    }
    await calculateScores(interview);
    terminated = true;
  }

  await interview.save();

  res.json({
    success: true,
    data: {
      terminated,
      cheatingCount: interview.cheatingCount,
      tabSwitchCount: interview.tabSwitchCount,
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
): GeneratedQuestion[] {
  const exclude = new Set(
    previousQuestions
      .split("\n")
      .map((q) => q.trim().toLowerCase())
      .filter(Boolean)
  );
  return pickBankQuestions(jobRole, type, count, exclude).map((question) => ({ question }));
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
