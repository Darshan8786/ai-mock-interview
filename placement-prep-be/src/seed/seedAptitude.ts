import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { AptitudeQuestion } from "../models/AptitudeQuestion.js";
import { AptitudeTopic } from "../models/AptitudeTopic.js";
import { AptitudeTestConfig } from "../models/AptitudeTestConfig.js";
import { aptitudeTopics } from "../data/aptitudeTopics.js";
import { quantSeed } from "../data/quantSeed.js";
import { logicalSeed } from "../data/logicalSeed.js";
import { verbalSeed } from "../data/verbalSeed.js";
import { diSeed } from "../data/diSeed.js";
import { SeedQuestion } from "../data/seedTypes.js";

const COMPANY_STYLES: Record<string, string> = {
  TCS: "tcs-style",
  Infosys: "infosys-style",
  Wipro: "wipro-style",
  Accenture: "accenture-style",
};

const toCompanyTags = (names: string[] = []) =>
  names.map((name) => ({
    name,
    style: COMPANY_STYLES[name] || "general",
  }));

const toMongoDoc = (s: SeedQuestion) => ({
  category: s.cat,
  topic: s.topic,
  subtopic: s.subtopic || "",
  difficulty: s.diff,
  companyTags: toCompanyTags(s.tags),
  question: s.q,
  options: s.opts,
  correctAnswer: s.a,
  explanation: s.exp,
  estimatedTime: s.time || 60,
  isActive: true,
});

async function seedTopics() {
  let created = 0;
  for (let i = 0; i < aptitudeTopics.length; i++) {
    const t = aptitudeTopics[i];
    const existing = await AptitudeTopic.findOne({
      category: t.category,
      name: t.name,
    });
    if (!existing) {
      await AptitudeTopic.create({ ...t, order: i });
      created++;
    } else {
      existing.description = t.description;
      existing.order = i;
      await existing.save();
    }
  }
  return created;
}

async function seedQuestions(seed: SeedQuestion[]) {
  let inserted = 0;
  let updated = 0;
  for (const s of seed) {
    const existing = await AptitudeQuestion.findOne({
      category: s.cat,
      question: s.q,
    });
    if (existing) {
      existing.set(toMongoDoc(s));
      await existing.save();
      updated++;
    } else {
      await AptitudeQuestion.create(toMongoDoc(s));
      inserted++;
    }
  }
  return { inserted, updated };
}

async function syncTopicCounts() {
  const counts = await AptitudeQuestion.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { category: "$category", topic: "$topic" }, count: { $sum: 1 } } },
  ]);
  let touched = 0;
  for (const c of counts) {
    const res = await AptitudeTopic.updateOne(
      { category: c._id.category, name: c._id.topic },
      { $set: { questionCount: c.count } }
    );
    if (res.modifiedCount || res.matchedCount) touched++;
  }
  return touched;
}

async function seedDefaults() {
  const existing = await AptitudeTestConfig.findOne({ title: "Full Mock Aptitude Test" });
  if (!existing) {
    await AptitudeTestConfig.create({
      title: "Full Mock Aptitude Test",
      description:
        "Timed full-length aptitude mock drawn from all four categories. Perfect for placement practice.",
      category: "",
      topics: [],
      difficulty: "",
      questionCount: 20,
      durationMinutes: 20,
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      shuffle: true,
      isActive: true,
    });
    console.log("📋 Created default test config: Full Mock Aptitude Test");
  }
}

export async function seedAptitude() {
  await connectDB();

  const topicCount = await seedTopics();
  const quant = await seedQuestions(quantSeed);
  const logical = await seedQuestions(logicalSeed);
  const verbal = await seedQuestions(verbalSeed);
  const di = await seedQuestions(diSeed);
  const touched = await syncTopicCounts();
  await seedDefaults();

  const total = await AptitudeQuestion.countDocuments({ isActive: true });
  console.log("\n✅ Aptitude seed complete");
  console.log(`   Topics: ${aptitudeTopics.length} (${topicCount} new, ${touched} counts synced)`);
  console.log(`   Questions inserted/updated → Quantitative ${quant.inserted}/${quant.updated}, Logical ${logical.inserted}/${logical.updated}, Verbal ${verbal.inserted}/${verbal.updated}, DI ${di.inserted}/${di.updated}`);
  console.log(`   Total active questions: ${total}`);

  await mongoose.disconnect();
}

// Allow standalone run: npm run seed:aptitude
if (process.argv[1]?.endsWith("seedAptitude.ts") || process.argv[1]?.endsWith("seedAptitude.js")) {
  seedAptitude().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
}
