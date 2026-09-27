/**
 * ADD-ONLY seed for the company-wise aptitude questions (at least 200 per company).
 *
 *   npm run seed:company
 *
 * Reads src/data/companyTemplateQuestions.json (generated + answer-verified by
 * ai-services/scripts/generate_company_questions.py) and inserts the questions that are not in the database yet
 * (matched by question text). It NEVER deletes or edits existing questions, student history or attempts, and running
 * it again changes nothing - safe on a live database. Students never get a repeat: company practice already excludes
 * every question a student has been shown (AptitudeQuestionHistory) until that company's pool is exhausted.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { AptitudeQuestion } from "../models/AptitudeQuestion.js";
import { AptitudeTopic } from "../models/AptitudeTopic.js";

interface CompanyQuestion {
  category: string;
  topic: string;
  difficulty: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  estimatedTime: number;
  company: string;
}

const COMPANY_STYLES: Record<string, string> = {
  TCS: "tcs-style",
  Infosys: "infosys-style",
  Wipro: "wipro-style",
  Accenture: "accenture-style",
};
const DATA_FILE = path.resolve(__dirname, "../data/companyTemplateQuestions.json");

export async function upsertCompanyQuestions(): Promise<{ inserted: number; skipped: number; perCompany: Record<string, number> }> {
  const rows: CompanyQuestion[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  // Already present = same text, ACTIVE and tagged for that company. (An inactive adaptive-session copy of the same text
  // does not count - it is not in any company pool.)
  const present = await AptitudeQuestion.find({ question: { $in: rows.map((r) => r.question) }, isActive: true })
    .select("question companyTags").lean();
  const existing = new Set(present.flatMap((d: any) => (d.companyTags || []).map((t: any) => `${t.name}|${d.question}`)));
  const fresh = rows.filter((r) => !existing.has(`${r.company}|${r.question}`));
  if (fresh.length) {
    await AptitudeQuestion.insertMany(
      fresh.map((r) => ({
        category: r.category,
        topic: r.topic,
        subtopic: "",
        difficulty: r.difficulty,
        companyTags: [{ name: r.company, style: COMPANY_STYLES[r.company] || "general" }],
        question: r.question,
        options: r.options,
        correctAnswer: r.correctAnswer,
        explanation: r.explanation,
        estimatedTime: r.estimatedTime || 60,
        source: "template",
        verified: true,
        verification: "deterministic",
        isActive: true,
      }))
    );
  }
  // keep the per-topic counts shown/used by the dashboard in sync (only counts are touched)
  const counts = await AptitudeQuestion.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { category: "$category", topic: "$topic" }, count: { $sum: 1 } } },
  ]);
  for (const c of counts) {
    await AptitudeTopic.updateOne({ category: c._id.category, name: c._id.topic }, { $set: { questionCount: c.count } });
  }
  const perCompany = await AptitudeQuestion.aggregate([
    { $match: { isActive: true } },
    { $unwind: "$companyTags" },
    { $group: { _id: "$companyTags.name", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  return {
    inserted: fresh.length,
    skipped: rows.length - fresh.length,
    perCompany: Object.fromEntries(perCompany.map((p: any) => [p._id, p.n])),
  };
}

if (process.argv[1]?.endsWith("seedCompanyQuestions.ts") || process.argv[1]?.endsWith("seedCompanyQuestions.js")) {
  (async () => {
    await connectDB();
    const r = await upsertCompanyQuestions();
    console.log(`\n✅ Company questions: inserted ${r.inserted}, already present ${r.skipped}`);
    for (const [company, n] of Object.entries(r.perCompany)) console.log(`   ${company.padEnd(10)} ${n}`);
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("❌ Company seed failed:", err);
    process.exit(1);
  });
}
