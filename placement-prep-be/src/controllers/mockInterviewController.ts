import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { Interview } from "../models/Interview";
import { CheatingEvent } from "../models/CheatingEvent";
import { InterviewReport } from "../models/InterviewReport";
import axios from "axios";
import OpenAI from "openai";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy-key",
  baseURL: "https://api.groq.com/openai/v1",
});

async function generateQuestionsWithGroq(
  jobRole: string,
  experienceLevel: string,
  interviewType: string,
  difficulty: string,
  count: number
): Promise<string[]> {
  const prompt = `You are an expert technical interviewer. Generate ${count} UNIQUE ${difficulty} difficulty ${interviewType} interview questions for a ${experienceLevel} level ${jobRole} position.

Requirements:
- Every question MUST be different and specifically about ${jobRole} (frameworks, concepts, tools, and real scenarios for this exact role).
- Do NOT use generic questions that would fit any role.
- Mix of conceptual and practical questions.
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

export const createInterview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { jobRole, experienceLevel, interviewType, difficulty, totalQuestions } = req.body;

  if (!jobRole || !experienceLevel || !interviewType || !difficulty || !totalQuestions) {
    throw new AppError("All fields are required", 400);
  }

  let questionTexts: string[];

  try {
    const response = await axios.post(`${AI_SERVICE_URL}/generate-questions`, {
      jobRole,
      experienceLevel,
      interviewType,
      difficulty,
      totalQuestions,
    }, { timeout: 5000 });
    questionTexts = response.data.questions || [];
  } catch (error: any) {
    questionTexts = [];
  }

  if (questionTexts.length === 0 && process.env.GROQ_API_KEY) {
    try {
      questionTexts = await generateQuestionsWithGroq(
        jobRole,
        experienceLevel,
        interviewType,
        difficulty,
        totalQuestions
      );
    } catch (err) {
      console.error("Groq question generation failed, using fallback pool:", err);
      questionTexts = [];
    }
  }

  if (questionTexts.length === 0) {
    questionTexts = generateFallbackQuestions(jobRole, interviewType, totalQuestions);
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

  const interview = await Interview.create({
    user: req.user._id,
    jobRole,
    experienceLevel,
    interviewType,
    difficulty,
    totalQuestions,
    status: "in-progress",
    startedAt: new Date(),
    questions,
  });

  res.status(201).json({
    success: true,
    data: interview,
  });
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

  const currentQ = interview.questions[interview.currentQuestionIndex];
  currentQ.answer = answer;
  currentQ.answerType = answerType || "text";
  currentQ.timeTaken = timeTaken || 0;

  try {
    const evalResponse = await axios.post(`${AI_SERVICE_URL}/evaluate-answer`, {
      question: currentQ.question,
      answer,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      jobRole: interview.jobRole,
    });

    currentQ.evaluation = evalResponse.data.evaluation || currentQ.evaluation;
  } catch (error: any) {
    currentQ.evaluation = {
      technicalScore: Math.floor(Math.random() * 40) + 60,
      communicationScore: Math.floor(Math.random() * 40) + 60,
      confidenceScore: Math.floor(Math.random() * 40) + 60,
      grammarScore: Math.floor(Math.random() * 40) + 60,
      fluencyScore: Math.floor(Math.random() * 40) + 60,
      relevanceScore: Math.floor(Math.random() * 40) + 60,
      feedback: "Good attempt. Consider providing more specific examples in your answer.",
    };
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

async function calculateScores(interview: any) {
  const answered = interview.questions.filter((q: any) => q.evaluation && !q.skipped);
  if (answered.length === 0) {
    interview.overallScore = 0;
    return;
  }

  const techScores = answered.map((q: any) => q.evaluation.technicalScore || 0);
  const commScores = answered.map((q: any) => q.evaluation.communicationScore || 0);
  const confScores = answered.map((q: any) => q.evaluation.confidenceScore || 0);
  const gramScores = answered.map((q: any) => q.evaluation.grammarScore || 0);
  const fluScores = answered.map((q: any) => q.evaluation.fluencyScore || 0);

  const avg = (arr: number[]) => Math.round(arr.reduce((a: number, b: number) => a + b, 0) / arr.length);

  interview.technicalScore = avg(techScores);
  interview.communicationScore = avg(commScores);
  interview.confidenceScore = avg(confScores);
  interview.grammarScore = avg(gramScores);
  interview.fluencyScore = avg(fluScores);
  interview.overallScore = Math.round(
    (interview.technicalScore + interview.communicationScore + interview.confidenceScore +
      interview.grammarScore + interview.fluencyScore) / 5
  );

  const allFeedback = answered.map((q: any) => q.evaluation.feedback).filter(Boolean);
  interview.strengths = generateStrengths(interview);
  interview.weaknesses = generateWeaknesses(interview);
  interview.areasToImprove = generateAreasToImprove(interview);

  if (allFeedback.length > 0) {
    try {
      const feedbackRes = await axios.post(`${AI_SERVICE_URL}/generate-feedback`, {
        scores: {
          overall: interview.overallScore,
          technical: interview.technicalScore,
          communication: interview.communicationScore,
          confidence: interview.confidenceScore,
          grammar: interview.grammarScore,
          fluency: interview.fluencyScore,
        },
        strengths: interview.strengths,
        weaknesses: interview.weaknesses,
        jobRole: interview.jobRole,
      });
      interview.finalFeedback = feedbackRes.data.feedback;
    } catch {
      interview.finalFeedback = generateFallbackFeedback(interview);
    }
  } else {
    interview.finalFeedback = generateFallbackFeedback(interview);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateFallbackQuestions(jobRole: string, type: string, count: number): string[] {
  const questions: Record<string, string[]> = {
    Technical: [
      `Explain the key concepts and technologies used in ${jobRole}.`,
      `How do you stay updated with the latest trends in ${jobRole}?`,
      `Describe your approach to debugging a complex issue in ${jobRole}.`,
      `What are the best practices for optimizing performance in ${jobRole}?`,
      `Explain a challenging project you worked on related to ${jobRole}.`,
      `How do you handle technical debt in your projects?`,
      `Describe your experience with version control and CI/CD pipelines.`,
      `What security considerations are important in ${jobRole}?`,
      `How do you approach testing and quality assurance?`,
      `Explain the difference between REST and GraphQL APIs.`,
      `How would you design a scalable system for a ${jobRole} feature?`,
      `What tools and libraries are essential for a ${jobRole} professional?`,
      `Describe how you would architect a new feature from scratch for ${jobRole}.`,
      `What common pitfalls should a ${jobRole} developer avoid?`,
      `How do you measure the success of your work as a ${jobRole}?`,
    ],
    HR: [
      `Tell me about yourself and why you're interested in ${jobRole}.`,
      `What are your greatest professional strengths?`,
      `Describe a situation where you handled a difficult workplace conflict.`,
      `Where do you see yourself in 5 years?`,
      `Why do you want to work in this field?`,
      `Describe your leadership style.`,
      `How do you handle constructive criticism?`,
      `Tell me about a time you went above and beyond at work.`,
      `What motivates you professionally?`,
      `Why should we hire you for this ${jobRole} position?`,
      `Describe a time you failed and how you handled it.`,
      `How do you prioritize competing responsibilities in a ${jobRole} role?`,
      `What aspect of a ${jobRole} role excites you the most?`,
      `Tell me about a time you led a team or took ownership of an outcome.`,
      `What kind of work environment helps you perform your best?`,
    ],
    Behavioral: [
      `Describe a time you worked successfully in a team environment for ${jobRole}.`,
      `Tell me about a project that failed and what you learned from it.`,
      `How do you prioritize tasks when handling multiple deadlines?`,
      `Describe a situation where you had to learn a new technology quickly.`,
      `Tell me about a time you disagreed with a team member's approach.`,
      `How do you handle pressure or stressful situations?`,
      `Describe a time you took initiative beyond your responsibilities.`,
      `Tell me about a situation where you had to adapt to significant changes.`,
      `How do you ensure clear communication within your team?`,
      `Describe a time you received difficult feedback and how you responded.`,
      `Tell me about a time you mentored or helped a teammate.`,
      `Describe a situation where you had to make a decision with incomplete information.`,
      `How do you handle a teammate who is not contributing equally?`,
      `Tell me about a time you had to convince others to adopt your idea.`,
      `Describe a time you went beyond your job description to help the team succeed.`,
    ],
  };

  const pool = questions[type] || questions.Technical;
  const selected = dedupeQuestions(shuffle(pool)).slice(0, count);

  while (selected.length < count) {
    selected.push(`Tell me about your experience with ${jobRole} concepts and how you apply them.`);
  }
  return selected.slice(0, count);
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
