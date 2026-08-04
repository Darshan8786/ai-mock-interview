import type { Request, Response } from "express";
import 'dotenv/config';
import OpenAI from 'openai';
import { getQuestionsForRole } from "./roleQuestionController";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key",
});

function isGibberish(input: string): boolean {
  const str = input.trim().toLowerCase();
  if (str.length < 3) return true;
  if (!/[a-z]/.test(str)) return true;
  if (!/[aeiou]/.test(str)) return true;
  if (/[^a-z\s\.\-]/.test(str)) return true;
  if (/^(.)\1+$/.test(str)) return true;
  return false;
}

function looksValidRole(input: string): boolean {
  const jobKeywords = ["developer", "engineer", "scientist", "architect", "analyst", "stack", "roles", "role", "engineering"];
  const techKeywords = ["react", "node", "python", "java", "dotnet", "angular", "mern", "data", "ai", "ml"];

  const lower = input.toLowerCase();
  const hasJob = jobKeywords.some(k => lower.includes(k));
  const hasTech = techKeywords.some(k => lower.includes(k));

  return hasTech && (hasJob || !hasJob);
}

export async function roleController(req: Request, res: Response) {
  const { input } = req.body;

  if (!input || !input.trim()) {
    return res.status(400).json({ error: "Input not provided" });
  }

  const cleanInput = input.trim();

  if (isGibberish(cleanInput)) {
    console.log("Rejected gibberish input:", cleanInput);
    return res.status(400).json({ error: "Input not meaningful" });
  }

  if (looksValidRole(cleanInput)) {
    console.log("Accepted locally:", cleanInput);

    // Now directly call roleQuestionController logic internally
    const questionsResponse = await getQuestionsForRole(cleanInput);
    return res.json({
      role: cleanInput,
      validatedBy: "local-check",
      ...questionsResponse, // merge question data
    });
  }

  try {
    console.log("Fallback to OpenAI validation for:", cleanInput);

    const prompt = `
    You are a strict Computer Science role validator.
    Determine if "${cleanInput}" is a valid CS job role (e.g., React Developer, .NET Developer, Data Scientist).
    Reply only with "VALID" or "INVALID".
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    });
    const answer = completion.choices[0]?.message?.content?.trim().toUpperCase();

    if (answer !== "VALID") {
      console.log("AI rejected role:", cleanInput, "| Answer:", answer);
      return res.status(400).json({ error: "Not a proper role" });
    }

    console.log("AI validated role:", cleanInput);

    //Fetch related questions from Pinecone/OpenAI before sending response
    const questionsResponse = await getQuestionsForRole(cleanInput);

    return res.json({
      role: cleanInput,
      validatedBy: "openai",
      ...questionsResponse, // merge question data
    });

  } catch (err) {
    console.error("AI validation failed:", err);
    return res.status(500).json({ error: "AI validation failed" });
  }
}
