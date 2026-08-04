import { getQuestionsForSubject } from "./subjectQuestionController";

import type { Request, Response } from "express";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy-key" });

export async function subjectController(req: Request, res: Response) {
  const { input } = req.body;

  if (!input || !input.trim()) {
    return res.status(400).json({ error: "Input not provided" });
  }

  try {
    const prompt = `Is "${input}" a valid academic subject (DBMS, OS, Software Engineering, Networks, OOPS, Python)? Reply only with VALID or INVALID. NOTE: It should be a Computer Science subject`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    });

    const answer = completion.choices[0]?.message?.content?.trim().toUpperCase();

    if (answer !== "VALID") {
      return res.status(400).json({ error: "Not a proper subject" });
    }

    console.log("Valid Subject Received:", input);
    const { questions } = await getQuestionsForSubject(input);
    res.json({ subject: input, questions });
  } catch (err) {
    console.error("OpenAI validation error:", err);
    res.status(500).json({ error: "AI validation failed" });
  }
}

