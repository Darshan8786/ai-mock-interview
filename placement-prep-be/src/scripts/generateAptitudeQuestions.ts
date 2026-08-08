import "dotenv/config";
import mongoose from "mongoose";
import OpenAI from "openai";
import { connectDB } from "../config/db.js";
import { AptitudeQuestion } from "../models/AptitudeQuestion.js";
import { aptitudeTopics } from "../data/aptitudeTopics.js";

// ── Config ─────────────────────────────────────────────────
const TARGET_PER_TOPIC = Number(process.env.APT_TARGET || 50);
const BATCH = 16;                // questions generated per LLM call
const CONCURRENCY = 3;           // topics processed in parallel
const MIN_GAP_MS = 15000;        // global min time between LLM calls (rate-limit pacing)
const VERIFY_EVERY = 1;          // verify every Nth batch (skipped batches are flagged unverified)
const DIFF_SPLIT = ["beginner", "beginner", "intermediate", "intermediate", "intermediate", "advanced", "advanced"];
const DIFF_TIME: Record<string, number> = { beginner: 50, intermediate: 65, advanced: 85 };

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy-key",
  baseURL: "https://api.groq.com/openai/v1",
});

const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const MAX_RETRIES = 3;
let lastCallAt = 0;
let callLock: Promise<unknown> = Promise.resolve();

/** Serializes every LLM request through a single chain so workers cannot burst. */
function pacedCall<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const sinceLast = Date.now() - lastCallAt;
    if (sinceLast < MIN_GAP_MS) await sleep(MIN_GAP_MS - sinceLast);
    lastCallAt = Date.now();
    return await fn();
  };
  const result = callLock.then(run, run);
  callLock = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripFence(raw: string): string {
  return raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

async function chatJSON(messages: any[]): Promise<any> {
  let lastErr: any = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const completion = await pacedCall(() =>
        groq.chat.completions.create({
          model: MODEL,
          messages,
          temperature: 0.8,
          response_format: { type: "json_object" },
        })
      );
      const raw = completion.choices[0]?.message?.content || "";
      return JSON.parse(stripFence(raw));
    } catch (err: any) {
      lastErr = err;
      if (err?.status === 429) {
        const wait = 15000 * (attempt + 1);
        console.log(`   ⏳ rate-limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
      } else {
        await sleep(3000 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

interface GenQ {
  q: string;
  opts: string[];
  a: number;
  exp: string;
}

// ── Few-shot exemplars (the "training set" the generator mimics) ──
async function getExemplars(category: string, topic: string): Promise<string> {
  const exs = await AptitudeQuestion.find({
    category,
    topic,
    isActive: true,
    $or: [{ source: "hand" }, { verified: true }],
  })
    .sort({ createdAt: 1 })
    .limit(2)
    .lean();

  const fallback = await AptitudeQuestion.find({
    category,
    isActive: true,
    $or: [{ source: "hand" }, { verified: true }],
  })
    .sort({ createdAt: 1 })
    .limit(2)
    .lean();

  const pool = exs.length >= 2 ? exs : fallback;
  return pool
    .map(
      (q: any) =>
        `Q: ${q.question}\nOptions: ${q.options.map((o: string, i: number) => `${i}) ${o}`).join(" | ")}\nCorrect index: ${q.correctAnswer}\nExplanation: ${q.explanation}`
    )
    .join("\n\n");
}

async function generateBatch(
  category: string,
  topic: string,
  description: string,
  examples: string,
  count: number
): Promise<GenQ[]> {
  const prompt = `You are an expert aptitude test author for Indian campus placements (TCS, Infosys, Wipro, Accenture style).

Create ${count} UNIQUE multiple-choice questions for:
- Category: ${category}
- Topic: ${topic}
- Topic scope: ${description}

Rules:
- Exactly 4 options per question, exactly one correct.
- Difficulty mix: use the pattern beginner, beginner, intermediate, intermediate, intermediate, advanced, advanced (cycled for the batch).
- Questions must be self-contained, realistic, placement-exam standard, and age-appropriate for final-year students.
- Never reuse numbers/story from the examples; use them ONLY as a style guide.
- Provide a short step-by-step explanation for each answer.

High-quality examples (style reference only):
${examples}

Respond ONLY with a JSON object like:
{"questions":[{"q":"question text","opts":["A","B","C","D"],"a":0,"exp":"explanation"}, ...]}`;

  const res = await chatJSON([
    { role: "system", content: "You generate accurate aptitude questions. Always return valid JSON." },
    { role: "user", content: prompt },
  ]);

  const list: any[] = Array.isArray(res) ? res : res?.questions;
  if (!Array.isArray(list)) return [];

  return list
    .map((item: any) => ({
      q: typeof item?.q === "string" ? item.q.trim() : "",
      opts: Array.isArray(item?.opts)
        ? item.opts.map((o: any) => String(o).trim()).filter(Boolean).slice(0, 4)
        : [],
      a: typeof item?.a === "number" ? item.a : -1,
      exp: typeof item?.exp === "string" ? item.exp.trim() : "",
    }))
    .filter(
      (g) =>
        g.q.length > 5 &&
        g.opts.length === 4 &&
        g.a >= 0 &&
        g.a < 4 &&
        new Set(g.opts.map((o: string) => o.toLowerCase())).size === 4
    );
}

// ── Self-verification pass (the quality gate) ──
async function verifyBatch(items: GenQ[]): Promise<{ ok: boolean; a: number; exp: string }[]> {
  if (items.length === 0) return [];
  const input = items.map((g) => ({ q: g.q, opts: g.opts, a: g.a, exp: g.exp }));
  const prompt = `For each question below, check whether the stated correct answer index "a" is genuinely correct. Fix any wrong answers.

Rules:
- "ok" = true if the original answer index is correct.
- If wrong, set "a" to the correct index and rewrite "exp" as a correct explanation; "ok" = false.
- If correct, keep "a" and "exp" unchanged.

Input:
${JSON.stringify(input)}

Respond ONLY with a JSON object:
{"checks":[{"ok":true,"a":0,"exp":"unchanged explanation"}, ...]}`;

  try {
    const res = await chatJSON([
      { role: "system", content: "You are a rigorous aptitude answer verifier. Return valid JSON." },
      { role: "user", content: prompt },
    ]);
    const checks: any[] = Array.isArray(res) ? res : res?.checks;
    if (!Array.isArray(checks)) return items.map((g) => ({ ok: false, a: g.a, exp: g.exp }));

    return items.map((g, i) => {
      const c = checks[i];
      if (!c || typeof c !== "object") return { ok: false, a: g.a, exp: g.exp };
      const a = Number.isInteger(c.a) && c.a >= 0 && c.a < 4 ? c.a : g.a;
      return {
        ok: c.ok === true,
        a,
        exp: typeof c.exp === "string" && c.exp.trim() ? c.exp.trim() : g.exp,
      };
    });
  } catch (err) {
    console.error("   verify call failed:", (err as any)?.message);
    return items.map((g) => ({ ok: false, a: g.a, exp: g.exp }));
  }
}

async function fillTopic(category: string, topic: string, description: string): Promise<number> {
  const existing = await AptitudeQuestion.countDocuments({ category, topic, isActive: true });
  let needed = TARGET_PER_TOPIC - existing;
  if (needed <= 0) return 0;

  console.log(`\n▶ ${category} / ${topic}: ${existing}/${TARGET_PER_TOPIC} present, generating ${needed}`);
  const examples = await getExemplars(category, topic);
  let created = 0;
  let staleRounds = 0;
  let batchNo = 0;

  while (needed > 0) {
    if (staleRounds >= 4) {
      console.log(`   ⚠ stopped early for ${topic} (4 consecutive empty/duplicate batches)`);
      break;
    }
    const batchSize = Math.min(BATCH, needed);
    let items: GenQ[] = [];
    try {
      items = await generateBatch(category, topic, description, examples, batchSize);
    } catch (err) {
      console.error(`   generation failed for batch (${topic}):`, (err as any)?.message);
      await sleep(5000);
      continue;
    }

    if (items.length === 0) {
      staleRounds++;
      console.log("   empty batch (quality filter), retrying...");
      await sleep(3000);
      continue;
    }

    // Dedupe against the DB + within the batch.
    const existingTexts = await AptitudeQuestion.find({
      category,
      topic,
      isActive: true,
      question: { $in: items.map((g) => g.q) },
    }).distinct("question");
    const seenInBatch = new Set<string>();
    const fresh = items
      .filter((g) => {
        const key = g.q.toLowerCase().trim();
        if (existingTexts.includes(g.q) || seenInBatch.has(key)) return false;
        seenInBatch.add(key);
        return true;
      })
      .slice(0, needed);

    if (fresh.length === 0) {
      staleRounds++;
      continue;
    }
    staleRounds = 0;
    batchNo++;

    // Self-verification quality gate (sampled to respect the API rate limit).
    const checks =
      batchNo % VERIFY_EVERY === 0
        ? await verifyBatch(fresh)
        : fresh.map((g) => ({ ok: false, a: g.a, exp: g.exp }));

    const docs = fresh.map((g, i) => {
      const diff = DIFF_SPLIT[(existing + created + i) % DIFF_SPLIT.length];
      return {
        category,
        topic,
        subtopic: "",
        difficulty: diff,
        companyTags: [],
        question: g.q,
        options: g.opts,
        correctAnswer: checks[i]?.a ?? g.a,
        explanation: checks[i]?.exp || g.exp,
        estimatedTime: DIFF_TIME[diff],
        source: "ai" as const,
        verified: checks[i]?.ok === true,
        isActive: true,
      };
    });

    try {
      await AptitudeQuestion.insertMany(docs);
    } catch (err: any) {
      if (err?.code === 11000) {
        // Duplicate key on a subset — insert one by one, skipping dupes.
        for (const d of docs) {
          try {
            await AptitudeQuestion.create(d);
            created++;
          } catch (inner: any) {
            if (inner?.code !== 11000) console.error("   insert error:", inner?.message);
          }
        }
      } else {
        console.error("   insertMany error:", err?.message);
      }
      needed -= created;
      continue;
    }

    created += docs.length;
    needed -= docs.length;
    const verifiedCount = checks.filter((c) => c.ok).length;
    console.log(
      `   +${docs.length} (verified ${verifiedCount}/${docs.length}) → ${existing + created}/${TARGET_PER_TOPIC}`
    );
    await sleep(500); // gentle pacing
  }

  return created;
}

async function main() {
  await connectDB();

  const args = process.argv.slice(2);
  const topicFilter = args.indexOf("--topic") >= 0 ? args[args.indexOf("--topic") + 1] : "";
  const onlyTopic = topicFilter
    ? aptitudeTopics.filter((t) => t.name.toLowerCase().includes(topicFilter.toLowerCase()))
    : aptitudeTopics;

  const queue = [...onlyTopic];
  const results: Record<string, number> = {};
  let next = 0;

  const worker = async () => {
    while (next < queue.length) {
      const t = queue[next++];
      try {
        results[`${t.category}/${t.name}`] = await fillTopic(t.category, t.name, t.description);
      } catch (err) {
        console.error(`  ✗ error on ${t.name}:`, (err as any)?.message);
        results[`${t.category}/${t.name}`] = -1;
      }
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const total = await AptitudeQuestion.countDocuments({ isActive: true });
  const bySource = await AptitudeQuestion.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$source", count: { $sum: 1 } } },
  ]);
  const below = await AptitudeQuestion.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { category: "$category", topic: "$topic" }, count: { $sum: 1 } } },
    { $match: { count: { $lt: TARGET_PER_TOPIC } } },
  ]);

  console.log("\n✅ Generation pass complete");
  console.log(`   Total active questions: ${total}`);
  console.log(`   By source: ${bySource.map((s) => `${s._id}=${s.count}`).join(", ")}`);
  console.log(`   Topics still below ${TARGET_PER_TOPIC}: ${below.length} (${below.map((b) => `${b._id.topic}:${b.count}`).join(", ")})`);
  console.log("   Re-run `npm run gen:aptitude` to top up the remaining.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
