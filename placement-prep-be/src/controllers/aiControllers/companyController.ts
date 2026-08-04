import { getQuestionsForCompany } from "./companyQuestionController";

import type { Request, Response } from "express";
import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy-key" });

export async function companyController(req: Request, res: Response) {
  const { input } = req.body;

  if (!input || !input.trim()) {
    return res.status(400).json({ error: "Input not provided" });
  }

  try {
    const prompt = `Check if "${input}" is a valid company (Google, Tech Mahindra etc.) that provides tech jobs today. Reply only with "VALID" or "INVALID". Reject vague inputs.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    });

    const answer = completion.choices[0]?.message?.content?.trim().toUpperCase();

    if (answer !== "VALID") {
      return res.status(400).json({ error: "Not a proper role" });
    }

    console.log("Valid Company Received:", input);
    const { questions } = await getQuestionsForCompany(input);
    res.json({ company: input, questions });
  } catch (err) {
    console.error("OpenAI validation error:", err);
    res.status(500).json({ error: "AI validation failed" });
  }
}

