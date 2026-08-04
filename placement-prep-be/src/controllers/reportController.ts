import type { Request, Response } from "express";
import mongoose from "mongoose";
import OpenAI from "openai";
import { AttemptModel, InterviewScoreModel } from "../db";

type ScoreGroup = {
  category: string;
  score: number;
  sessionId?: string | null;
  createdAt: Date;
};

type ClassifiedType = "role" | "company" | "subject";

type ClassifiedScore = ScoreGroup & { type: ClassifiedType };

type SubjectBar = {
  subject: string;
  averageScore: number;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache classifications to avoid repeated OpenAI calls for the same label
const classificationCache = new Map<string, ClassifiedType>();

async function classifyCategory(label: string): Promise<ClassifiedType> {
  if (classificationCache.has(label)) {
    return classificationCache.get(label)!;
  }

  // Simple guardrail: if the label looks like a common subject keyword, short-circuit
  const lower = label.toLowerCase();
  const subjectHints = ["javascript", "java", "python", "os", "operating", "dbms", "database", "network", "dsa", "react"];
  if (subjectHints.some((hint) => lower.includes(hint))) {
    classificationCache.set(label, "subject");
    return "subject";
  }

  if (!process.env.OPENAI_API_KEY) {
    // No key available; default to subject
    classificationCache.set(label, "subject");
    return "subject";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `Classify the label "${label}" as one of: role, company, subject. Answer with a single word: role, company, or subject.` }],
      temperature: 0,
      max_tokens: 10,
    });
    const text = completion.choices[0]?.message?.content?.trim().toLowerCase() || "";
    const normalized: ClassifiedType =
      text.includes("role") ? "role" :
        text.includes("company") ? "company" :
          "subject";
    classificationCache.set(label, normalized);
    return normalized;
  } catch (err) {
    console.error("OpenAI classification error, defaulting to subject:", err);
    return "subject";
  }
}

export async function getPersonalizedReport(req: Request, res: Response) {
  // userId is attached by userMiddleware
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (req as any).userId as string | undefined;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const scores = await InterviewScoreModel.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const classifiedScores: ClassifiedScore[] = [];
    const subjectBuckets: Record<string, { total: number; count: number }> = {};

    // Collect unique labels that need AI classification
    const labelsNeedingClassification = new Set<string>();

    scores.forEach((score) => {
      if (!score.role && !score.company && score.subject) {
        labelsNeedingClassification.add(score.subject);
      }
    });

    // Classify missing labels using OpenAI (and cache)
    const classificationResults = new Map<string, ClassifiedType>();
    for (const label of labelsNeedingClassification) {
      const kind = await classifyCategory(label);
      classificationResults.set(label, kind);
    }

    scores.forEach((score) => {
      const attemptScore = Array.isArray(score.scores)
        ? score.scores.reduce((sum, n) => sum + Number(n || 0), 0)
        : typeof score.total === "number"
          ? score.total
          : 0;

      const base = {
        score: attemptScore,
        sessionId: score.sessionId ?? undefined,
        createdAt: (score.createdAt as Date) || new Date(),
      };

      if (score.subject) {
        const bucket = subjectBuckets[score.subject] || { total: 0, count: 0 };
        bucket.total += attemptScore;
        bucket.count += 1;
        subjectBuckets[score.subject] = bucket;
      }

      if (score.role) {
        classifiedScores.push({ ...base, category: score.role, type: "role" });
        return;
      }
      if (score.company) {
        classifiedScores.push({ ...base, category: score.company, type: "company" });
        return;
      }

      if (score.subject) {
        const kind = classificationResults.get(score.subject) || "subject";
        classifiedScores.push({ ...base, category: score.subject, type: kind });
      }
    });

    const subjectBars: SubjectBar[] = Object.entries(subjectBuckets).map(([subject, { total, count }]) => ({
      subject,
      averageScore: count ? Math.round(total / count) : 0,
    }));

    let attempts = { total: 0, correct: 0, accuracy: 0 };
    try {
      const [attemptStats] = await AttemptModel.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            correct: {
              $sum: {
                $cond: [{ $eq: ["$correct", true] }, 1, 0],
              },
            },
          },
        },
      ]);

      if (attemptStats) {
        const accuracy =
          attemptStats.total > 0
            ? Math.round((attemptStats.correct / attemptStats.total) * 100)
            : 0;
        attempts = {
          total: attemptStats.total,
          correct: attemptStats.correct,
          accuracy,
        };
      }
    } catch (aggErr) {
      console.error("Error aggregating attempts", aggErr);
    }

    return res.json({
      scores: classifiedScores,
      subjectBars,
      attempts,
    });
  } catch (error) {
    console.error("Error fetching personalized report:", error);
    return res.status(500).json({ error: "Failed to fetch report data" });
  }
}

export async function getSubjectAttempts(req: Request, res: Response) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (req as any).userId as string | undefined;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const subjectData = await AttemptModel.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$subject",
          correctCount: {
            $sum: {
              $cond: [{ $eq: ["$correct", true] }, 1, 0],
            },
          },
          totalCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formattedData = subjectData.map((item) => ({
      subject: item._id || "Unknown",
      correctCount: item.correctCount,
      totalCount: item.totalCount,
    }));

    return res.json({ subjectAttempts: formattedData });
  } catch (error) {
    console.error("Error fetching subject attempts:", error);
    return res.status(500).json({ error: "Failed to fetch subject attempts" });
  }
}
