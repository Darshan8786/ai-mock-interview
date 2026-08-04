import type { Request, Response } from "express";
import multer from "multer";
import 'dotenv/config';
import OpenAI, { toFile } from "openai";

const upload = multer({ storage: multer.memoryStorage() });
export const voiceUploadMiddleware = upload.single("file");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getMaxPointsForIndex(index: number): number {
  return index === 2 ? 10 : 20; // first two technical, third one-liner
}

export async function evaluateRoleAnswer(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    const { question, index, role, sessionId } = req.body as {
      question?: string;
      index?: string;
      role?: string;
      sessionId?: string;
    };

    if (!file) return res.status(400).json({ error: "Audio file is required" });
    if (!question) return res.status(400).json({ error: "Question is required" });

    const questionIndex = Number(index ?? 0);
    const maxPoints = getMaxPointsForIndex(isNaN(questionIndex) ? 0 : questionIndex);

    // 1) Transcribe via Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(file.buffer, file.originalname || "audio.webm"),
      model: "whisper-1",
      response_format: "text",
      temperature: 0,
    } as any);

    const transcriptText = typeof transcription === 'string' ? transcription : (transcription as any).text || (transcription as any);

    // 2) Score with GPT-4o-mini using a concise rubric to minimize tokens
    const system = `You are an interview evaluator. Return a strict JSON with keys: score (integer 0-${maxPoints}), feedback (<=2 short sentences).`;
    const user = `Role: ${role || "Unknown"}\nMax score: ${maxPoints}\nQuestion: ${question}\nCandidate answer transcript: ${transcriptText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 150,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let parsed: { score?: number; feedback?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { score: 0, feedback: "Unable to parse evaluation." };
    }

    const score = Math.max(0, Math.min(maxPoints, Number(parsed.score ?? 0)));
    const feedback = parsed.feedback || "";

    return res.json({
      sessionId,
      index: questionIndex,
      transcript: transcriptText,
      score,
      feedback,
    });
  } catch (err: any) {
    console.error("evaluateRoleAnswer error", err?.response?.data || err?.message || err);
    return res.status(500).json({ error: "Failed to evaluate answer" });
  }
}

// Finalize: simply persist the total score with role; do not store audio or transcripts
import { InterviewScoreModel } from "../../db";

export async function finalizeRoleInterview(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { role, scores, sessionId } = req.body as { role?: string; scores?: number[]; sessionId?: string };
    if (!role) return res.status(400).json({ error: "Role is required" });
    if (!Array.isArray(scores) || scores.length !== 3) return res.status(400).json({ error: "Expected 3 scores" });

    const total = scores.reduce((a, b) => a + (Number.isFinite(b) ? Number(b) : 0), 0);
    // enforce max 50 (20 + 20 + 10)
    const cappedTotal = Math.max(0, Math.min(50, total));

    const doc = await InterviewScoreModel.create({
      userId,
      role,
      scores,
      total: cappedTotal,
      sessionId,
    });

    return res.json({
      role,
      scores,
      total: cappedTotal,
      id: doc._id,
    });
  } catch (err: any) {
    console.error("finalizeRoleInterview error", err?.message || err);
    return res.status(500).json({ error: "Failed to finalize interview" });
  }
}



export async function evaluateCompanyAnswer(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    const { question, index, company, sessionId } = req.body as {
      question?: string;
      index?: string;
      company?: string;
      sessionId?: string;
    };

    if (!file) return res.status(400).json({ error: "Audio file is required" });
    if (!question) return res.status(400).json({ error: "Question is required" });

    const questionIndex = Number(index ?? 0);
    const maxPoints = getMaxPointsForIndex(isNaN(questionIndex) ? 0 : questionIndex);

    // 1) Transcribe via Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(file.buffer, file.originalname || "audio.webm"),
      model: "whisper-1",
      response_format: "text",
      temperature: 0,
    } as any);

    const transcriptText = typeof transcription === 'string' ? transcription : (transcription as any).text || (transcription as any);

    // 2) Score with GPT-4o-mini using a concise rubric to minimize tokens
    const system = `You are an interview evaluator. Return a strict JSON with keys: score (integer 0-${maxPoints}), feedback (<=2 short sentences).`;
    const user = `Company: ${company || "Unknown"}\nMax score: ${maxPoints}\nQuestion: ${question}\nCandidate answer transcript: ${transcriptText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 150,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let parsed: { score?: number; feedback?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { score: 0, feedback: "Unable to parse evaluation." };
    }

    const score = Math.max(0, Math.min(maxPoints, Number(parsed.score ?? 0)));
    const feedback = parsed.feedback || "";

    return res.json({
      sessionId,
      index: questionIndex,
      transcript: transcriptText,
      score,
      feedback,
    });
  } catch (err: any) {
    console.error("evaluateCompanyAnswer error", err?.response?.data || err?.message || err);
    return res.status(500).json({ error: "Failed to evaluate answer" });
  }
}

export async function finalizeCompanyInterview(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { company, scores, sessionId } = req.body as { company?: string; scores?: number[]; sessionId?: string };
    if (!company) return res.status(400).json({ error: "Company is required" });
    if (!Array.isArray(scores) || scores.length !== 3) return res.status(400).json({ error: "Expected 3 scores" });

    const total = scores.reduce((a, b) => a + (Number.isFinite(b) ? Number(b) : 0), 0);
    // enforce max 50 (20 + 20 + 10)
    const cappedTotal = Math.max(0, Math.min(50, total));

    const doc = await InterviewScoreModel.create({
      userId,
      company,
      scores,
      total: cappedTotal,
      sessionId,
    });

    return res.json({
      company,
      scores,
      total: cappedTotal,
      id: doc._id,
    });
  } catch (err: any) {
    console.error("finalizeCompanyInterview error", err?.message || err);
    return res.status(500).json({ error: "Failed to finalize interview" });
  }
}

export async function evaluateSubjectAnswer(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    const { question, index, subject, sessionId } = req.body as {
      question?: string;
      index?: string;
      subject?: string;
      sessionId?: string;
    };

    if (!file) return res.status(400).json({ error: "Audio file is required" });
    if (!question) return res.status(400).json({ error: "Question is required" });

    const questionIndex = Number(index ?? 0);
    const maxPoints = getMaxPointsForIndex(isNaN(questionIndex) ? 0 : questionIndex);

    // 1) Transcribe via Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(file.buffer, file.originalname || "audio.webm"),
      model: "whisper-1",
      response_format: "text",
      temperature: 0,
    } as any);

    const transcriptText = typeof transcription === 'string' ? transcription : (transcription as any).text || (transcription as any);

    // 2) Score with GPT-4o-mini using a concise rubric to minimize tokens
    const system = `You are an interview evaluator. Return a strict JSON with keys: score (integer 0-${maxPoints}), feedback (<=2 short sentences).`;
    const user = `Subject: ${subject || "Unknown"}\nMax score: ${maxPoints}\nQuestion: ${question}\nCandidate answer transcript: ${transcriptText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 150,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let parsed: { score?: number; feedback?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { score: 0, feedback: "Unable to parse evaluation." };
    }

    const score = Math.max(0, Math.min(maxPoints, Number(parsed.score ?? 0)));
    const feedback = parsed.feedback || "";

    return res.json({
      sessionId,
      index: questionIndex,
      transcript: transcriptText,
      score,
      feedback,
    });
  } catch (err: any) {
    console.error("evaluateSubjectAnswer error", err?.response?.data || err?.message || err);
    return res.status(500).json({ error: "Failed to evaluate answer" });
  }
}

export async function finalizeSubjectInterview(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { subject, scores, sessionId } = req.body as { subject?: string; scores?: number[]; sessionId?: string };
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    if (!Array.isArray(scores) || scores.length !== 3) return res.status(400).json({ error: "Expected 3 scores" });

    const total = scores.reduce((a, b) => a + (Number.isFinite(b) ? Number(b) : 0), 0);
    // enforce max 50 (20 + 20 + 10)
    const cappedTotal = Math.max(0, Math.min(50, total));

    const doc = await InterviewScoreModel.create({
      userId,
      subject,
      scores,
      total: cappedTotal,
      sessionId,
    });

    return res.json({
      subject,
      scores,
      total: cappedTotal,
      id: doc._id,
    });
  } catch (err: any) {
    console.error("finalizeSubjectInterview error", err?.message || err);
    return res.status(500).json({ error: "Failed to finalize interview" });
  }
}