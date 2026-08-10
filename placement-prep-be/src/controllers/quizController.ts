import type { Request, Response } from "express";
import OpenAI from "openai";
import { QuizQuestion } from "../models/QuizQuestion";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy-key" });

const QUIZ_BATCH_SIZE = 5;

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateQuizQuestions(subject: string): Promise<GeneratedQuestion[]> {
  const system =
    "You are an expert quiz creator for computer science placement preparation.";

  const prompt = `Create exactly ${QUIZ_BATCH_SIZE} multiple-choice questions for the subject "${subject}".
Return ONLY a valid JSON object with a "questions" array. Each item must have:
- "question": string
- "options": array of exactly 4 strings
- "correctAnswer": exactly one of the 4 options, matching the option text character-for-character
Output only JSON.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content || "";
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed.questions) ? parsed.questions : [];

  return list
    .map((q: any) => ({
      question: String(q.question ?? "").trim(),
      options: Array.isArray(q.options) ? q.options.map((o: any) => String(o).trim()) : [],
      correctAnswer: String(q.correctAnswer ?? "").trim(),
    }))
    .filter(
      (q) =>
        q.question &&
        q.options.length === 4 &&
        q.correctAnswer &&
        q.options.includes(q.correctAnswer)
    );
}

export async function getQuizQuestions(req: Request, res: Response) {
  const userId = (req as any).userId;
  const subject = normalizeSubject(req.params.subject);

  if (!userId || !subject) {
    return res.status(400).json({ error: "Invalid subject" });
  }

  try {
    const unanswered = await QuizQuestion.find({ userId, subject, attempted: false }).lean();

    if (unanswered.length < QUIZ_BATCH_SIZE) {
      const generated = await generateQuizQuestions(subject);
      if (generated.length === 0) {
        return res
          .status(500)
          .json({ error: "OpenAI did not return valid questions. Please try again." });
      }
      await QuizQuestion.insertMany(
        generated.map((g) => ({ userId, subject, ...g }))
      );
    }

    const pool = await QuizQuestion.find({ userId, subject, attempted: false }).lean();
    const selected = pool.sort(() => Math.random() - 0.5).slice(0, QUIZ_BATCH_SIZE);

    res.json(
      selected.map((q) => ({
        _id: q._id,
        question: q.question,
        options: q.options,
      }))
    );
  } catch (err) {
    console.error("Error in getQuizQuestions:", err);
    res
      .status(500)
      .json({ error: "Failed to load quiz. Check OpenAI credits and try again." });
  }
}

export async function validateQuizAnswers(req: Request, res: Response) {
  const userId = (req as any).userId;
  const { subject, answers } = req.body as {
    subject?: string;
    answers?: Record<string, string>;
  };

  if (!subject || !answers || typeof answers !== "object") {
    return res.status(400).json({ error: "subject and answers are required" });
  }

  const qids = Object.keys(answers);
  if (qids.length === 0) {
    return res.status(400).json({ error: "No answers provided" });
  }

  const questions = await QuizQuestion.find({ _id: { $in: qids }, userId });
  const correctness: Record<string, boolean> = {};
  const correctAnswers: Record<string, string> = {};

  for (const q of questions) {
    const id = q._id.toString();
    correctness[id] = answers[id] === q.correctAnswer;
    correctAnswers[id] = q.correctAnswer;
  }

  res.json({ correctness, correctAnswers });
}

export async function recordQuizAttempt(req: Request, res: Response) {
  const userId = (req as any).userId;
  const { questionId, selectedOption, subject } = req.body as {
    questionId?: string;
    selectedOption?: string;
    subject?: string;
  };

  if (!questionId || !selectedOption || !subject) {
    return res
      .status(400)
      .json({ error: "questionId, selectedOption and subject are required" });
  }

  const question = await QuizQuestion.findOne({ _id: questionId, userId });
  if (!question) {
    return res.status(404).json({ error: "Question not found" });
  }
  if (question.attempted) {
    return res.status(409).json({ error: "Question already attempted" });
  }

  question.attempted = true;
  question.selectedAnswer = selectedOption;
  await question.save();
  res.json({ success: true });
}
