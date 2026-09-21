import mongoose from "mongoose";
import { AptitudeAttempt } from "../models/AptitudeAttempt";
import { AptitudeQuestionHistory } from "../models/AptitudeQuestionHistory";
import { TechQuizAttempt } from "../models/TechQuizAttempt";
import { Interview } from "../models/Interview";

/**
 * Per-student performance analytics, computed straight from the collections the
 * app writes to today (aptitude attempts + question history, tech quizzes and
 * mock interviews). No external services are involved.
 */

export interface AreaStat {
  name: string;
  /** Where the number comes from, so the UI/chatbot can say "aptitude" vs "tech". */
  source: "aptitude" | "tech" | "interview";
  /** Broader group, e.g. the aptitude category or the technology. */
  group: string;
  correct: number;
  total: number;
  accuracy: number;
}

export interface TrendPoint {
  date: string;
  score: number;
  label: string;
}

export interface StudentAnalytics {
  hasData: boolean;
  overview: {
    readiness: number | null;
    aptitudeTests: number;
    techQuizzes: number;
    interviews: number;
    totalQuestions: number;
    correctAnswers: number;
    overallAccuracy: number;
  };
  aptitude: {
    attempts: number;
    avgScore: number;
    bestScore: number;
    lastScore: number | null;
    categories: AreaStat[];
    topics: AreaStat[];
    trend: TrendPoint[];
  };
  techQuiz: {
    attempts: number;
    avgScore: number;
    bestScore: number;
    technologies: { technology: string; attempts: number; avgScore: number; bestScore: number }[];
    topics: AreaStat[];
    trend: TrendPoint[];
  };
  interview: {
    attempts: number;
    terminated: number;
    avgOverall: number;
    lastOverall: number | null;
    skills: { key: string; label: string; score: number }[];
    roles: { role: string; attempts: number; avgScore: number }[];
    improvementAreas: { text: string; count: number }[];
    trend: TrendPoint[];
  };
  weakAreas: AreaStat[];
  strengths: AreaStat[];
}

/** An area needs at least this many answered questions before it is judged weak/strong. */
const MIN_SAMPLE = 3;
export const WEAK_BELOW = 60;
export const STRONG_FROM = 75;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const avg = (nums: number[]) =>
  nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
const iso = (d: unknown) => (d ? new Date(d as any).toISOString() : new Date(0).toISOString());

export async function buildAnalytics(userId: mongoose.Types.ObjectId | string): Promise<StudentAnalytics> {
  const uid = new mongoose.Types.ObjectId(String(userId));

  const [aptAttempts, aptTopicRows, techAttempts, interviews] = await Promise.all([
    AptitudeAttempt.find({ user: uid, status: "completed" })
      .sort({ completedAt: 1 })
      .limit(200)
      .lean(),
    // Answered-question history grouped by topic: the only place topic-level
    // accuracy exists (attempts only keep 4 coarse category scores).
    AptitudeQuestionHistory.aggregate([
      { $match: { user: uid, answered: true } },
      { $lookup: { from: "aptitudequestions", localField: "question", foreignField: "_id", as: "q" } },
      { $unwind: "$q" },
      {
        $group: {
          _id: { topic: "$q.topic", category: "$q.category" },
          total: { $sum: 1 },
          correct: { $sum: { $cond: [{ $eq: ["$correct", true] }, 1, 0] } },
        },
      },
    ]),
    TechQuizAttempt.find({ user: uid, status: "completed" }).sort({ completedAt: 1 }).limit(200).lean(),
    Interview.find({ user: uid, status: { $in: ["completed", "terminated"] } })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean(),
  ]);

  // ── Aptitude ────────────────────────────────────────
  const categoryMap = new Map<string, { correct: number; total: number }>();
  aptAttempts.forEach((a: any) =>
    (a.categoryScores || []).forEach((c: any) => {
      if (!c.total) return;
      const cur = categoryMap.get(c.category) || { correct: 0, total: 0 };
      cur.correct += c.correct || 0;
      cur.total += c.total || 0;
      categoryMap.set(c.category, cur);
    })
  );
  const aptCategories: AreaStat[] = [...categoryMap.entries()]
    .map(([name, v]) => ({
      name,
      source: "aptitude" as const,
      group: name,
      correct: v.correct,
      total: v.total,
      accuracy: pct(v.correct, v.total),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const aptTopics: AreaStat[] = aptTopicRows
    .map((r: any) => ({
      name: r._id.topic || "Unknown",
      source: "aptitude" as const,
      group: r._id.category || "Aptitude",
      correct: r.correct,
      total: r.total,
      accuracy: pct(r.correct, r.total),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const aptScores = aptAttempts.map((a: any) => a.score || 0);
  const aptitude = {
    attempts: aptAttempts.length,
    avgScore: avg(aptScores),
    bestScore: aptScores.length ? Math.max(...aptScores) : 0,
    lastScore: aptScores.length ? aptScores[aptScores.length - 1] : null,
    categories: aptCategories,
    topics: aptTopics,
    trend: aptAttempts.map((a: any) => ({
      date: iso(a.completedAt || a.createdAt),
      score: a.score || 0,
      label: a.title || `${a.testType || "Aptitude"} test`,
    })),
  };

  // ── Tech quizzes ────────────────────────────────────
  const techTopicMap = new Map<string, { technology: string; topic: string; correct: number; total: number }>();
  const techMap = new Map<string, number[]>();
  techAttempts.forEach((t: any) => {
    techMap.set(t.technology, [...(techMap.get(t.technology) || []), t.score || 0]);
    (t.topicScores || []).forEach((ts: any) => {
      if (!ts.total) return;
      const key = `${t.technology}::${ts.topic}`;
      const cur = techTopicMap.get(key) || { technology: t.technology, topic: ts.topic, correct: 0, total: 0 };
      cur.correct += ts.correct || 0;
      cur.total += ts.total || 0;
      techTopicMap.set(key, cur);
    });
  });
  const techScores = techAttempts.map((t: any) => t.score || 0);
  const techQuiz = {
    attempts: techAttempts.length,
    avgScore: avg(techScores),
    bestScore: techScores.length ? Math.max(...techScores) : 0,
    technologies: [...techMap.entries()]
      .map(([technology, scores]) => ({
        technology,
        attempts: scores.length,
        avgScore: avg(scores),
        bestScore: Math.max(...scores),
      }))
      .sort((a, b) => b.attempts - a.attempts),
    topics: [...techTopicMap.values()]
      .map((v) => ({
        name: v.topic,
        source: "tech" as const,
        group: v.technology,
        correct: v.correct,
        total: v.total,
        accuracy: pct(v.correct, v.total),
      }))
      .sort((a, b) => a.accuracy - b.accuracy),
    trend: techAttempts.map((t: any) => ({
      date: iso(t.completedAt || t.createdAt),
      score: t.score || 0,
      label: `${t.technology} (${t.difficulty})`,
    })),
  };

  // ── Interviews ──────────────────────────────────────
  const done = interviews.filter((i: any) => i.status === "completed");
  const skillDefs: [string, string][] = [
    ["technicalScore", "Technical"],
    ["communicationScore", "Communication"],
    ["confidenceScore", "Confidence"],
    ["grammarScore", "Grammar"],
    ["fluencyScore", "Fluency"],
  ];
  const roleMap = new Map<string, number[]>();
  const improveMap = new Map<string, number>();
  done.forEach((i: any) => {
    roleMap.set(i.jobRole, [...(roleMap.get(i.jobRole) || []), i.overallScore || 0]);
    [...(i.areasToImprove || []), ...(i.weaknesses || [])].forEach((t: string) =>
      improveMap.set(t, (improveMap.get(t) || 0) + 1)
    );
  });
  const interview = {
    attempts: done.length,
    terminated: interviews.length - done.length,
    avgOverall: avg(done.map((i: any) => i.overallScore || 0)),
    lastOverall: done.length ? (done[done.length - 1] as any).overallScore || 0 : null,
    skills: done.length
      ? skillDefs.map(([key, label]) => ({ key, label, score: avg(done.map((i: any) => i[key] || 0)) }))
      : [],
    roles: [...roleMap.entries()]
      .map(([role, scores]) => ({ role, attempts: scores.length, avgScore: avg(scores) }))
      .sort((a, b) => b.attempts - a.attempts),
    improvementAreas: [...improveMap.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    trend: done.map((i: any) => ({
      date: iso(i.completedAt || i.createdAt),
      score: i.overallScore || 0,
      label: `${i.jobRole} (${i.interviewType})`,
    })),
  };

  // ── Cross-cutting: weak areas, strengths, readiness ──
  // Prefer fine-grained topics, but only those with enough answers to judge; when
  // none qualify yet (a few short practice sets) fall back to the coarser categories.
  const judgedTopics = aptTopics.filter((a) => a.total >= MIN_SAMPLE);
  const aptitudeAreas = judgedTopics.length ? judgedTopics : aptCategories;
  const judged = [...aptitudeAreas, ...techQuiz.topics].filter((a) => a.total >= MIN_SAMPLE);
  const weakAreas = judged
    .filter((a) => a.accuracy < WEAK_BELOW)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8);
  const strengths = judged
    .filter((a) => a.accuracy >= STRONG_FROM)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 8);

  // Readiness = mean of the areas the student has actually practised, so an
  // untouched area never drags the score down (and never inflates it either).
  const parts: number[] = [];
  if (aptitude.attempts) parts.push(aptitude.avgScore);
  if (techQuiz.attempts) parts.push(techQuiz.avgScore);
  if (interview.attempts) parts.push(interview.avgOverall);

  const totalQuestions = aptCategories.reduce((s, c) => s + c.total, 0) +
    techQuiz.topics.reduce((s, c) => s + c.total, 0);
  const correctAnswers = aptCategories.reduce((s, c) => s + c.correct, 0) +
    techQuiz.topics.reduce((s, c) => s + c.correct, 0);

  return {
    hasData: parts.length > 0,
    overview: {
      readiness: parts.length ? avg(parts) : null,
      aptitudeTests: aptitude.attempts,
      techQuizzes: techQuiz.attempts,
      interviews: interview.attempts,
      totalQuestions,
      correctAnswers,
      overallAccuracy: pct(correctAnswers, totalQuestions),
    },
    aptitude,
    techQuiz,
    interview,
    weakAreas,
    strengths,
  };
}
