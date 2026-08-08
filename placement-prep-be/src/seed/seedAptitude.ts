import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { AptitudeQuestion } from "../models/AptitudeQuestion.js";
import { AptitudeTopic } from "../models/AptitudeTopic.js";
import { AptitudeTestConfig } from "../models/AptitudeTestConfig.js";
import { AptitudeAttempt } from "../models/AptitudeAttempt.js";
import { AptitudeQuestionHistory } from "../models/AptitudeQuestionHistory.js";
import { aptitudeTopics } from "../data/aptitudeTopics.js";
import { quantSeed1 } from "../data/quantSeed1.js";
import { quantSeed2 } from "../data/quantSeed2.js";
import { logicalSeed1 } from "../data/logicalSeed1.js";
import { logicalSeed2 } from "../data/logicalSeed2.js";
import { verbalSeed1 } from "../data/verbalSeed1.js";
import { verbalSeed2 } from "../data/verbalSeed2.js";
import { diSeed2 } from "../data/diSeed2.js";
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

const ALL_SEEDS: SeedQuestion[] = [
  ...quantSeed1,
  ...quantSeed2,
  ...logicalSeed1,
  ...logicalSeed2,
  ...verbalSeed1,
  ...verbalSeed2,
  ...diSeed2,
];

async function seedTopics() {
  let created = 0;
  const catalogKeys = new Set(aptitudeTopics.map((t) => `${t.category}::${t.name}`));
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
  const stale = await AptitudeTopic.find({ isActive: true });
  for (const t of stale) {
    if (!catalogKeys.has(`${t.category}::${t.name}`)) {
      t.isActive = false;
      t.questionCount = 0;
      await t.save();
    }
  }
  return created;
}

/** Wipe questions + student history/attempts, then insert the full 1,000-question bank. */
async function seedQuestions() {
  const wipedQ = await AptitudeQuestion.deleteMany({});
  const wipedH = await AptitudeQuestionHistory.deleteMany({});
  const wipedA = await AptitudeAttempt.deleteMany({});
  const inserted = await AptitudeQuestion.insertMany(ALL_SEEDS.map(toMongoDoc));
  return {
    inserted: inserted.length,
    wipedQ: wipedQ.deletedCount,
    wipedH: wipedH.deletedCount,
    wipedA: wipedA.deletedCount,
  };
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
  const defaults: any[] = [
    {
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
    },
    {
      title: "Quantitative Aptitude Test",
      description: "Mock drawn only from Quantitative Aptitude topics.",
      category: "Quantitative",
      topics: [],
      difficulty: "",
      questionCount: 15,
      durationMinutes: 15,
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      shuffle: true,
      isActive: true,
    },
    {
      title: "Logical Reasoning Test",
      description: "Mock drawn only from Logical Reasoning topics.",
      category: "Logical Reasoning",
      topics: [],
      difficulty: "",
      questionCount: 15,
      durationMinutes: 15,
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      shuffle: true,
      isActive: true,
    },
    {
      title: "Verbal Ability Test",
      description: "Mock drawn only from Verbal Ability topics.",
      category: "Verbal Ability",
      topics: [],
      difficulty: "",
      questionCount: 15,
      durationMinutes: 15,
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      shuffle: true,
      isActive: true,
    },
    {
      title: "Data Interpretation Test",
      description: "Mock drawn only from Data Interpretation topics.",
      category: "Data Interpretation",
      topics: [],
      difficulty: "",
      questionCount: 10,
      durationMinutes: 15,
      marksPerQuestion: 1,
      negativeMarksPerQuestion: 0.25,
      passingScore: 50,
      shuffle: true,
      isActive: true,
    },
  ];
  let created = 0;
  for (const d of defaults) {
    const existing = await AptitudeTestConfig.findOne({ title: d.title });
    if (!existing) {
      await AptitudeTestConfig.create(d);
      created++;
    }
  }
  if (created) console.log(`📋 Created ${created} default test configs`);
}

export async function seedAptitude() {
  await connectDB();

  const topicCount = await seedTopics();
  const result = await seedQuestions();
  const touched = await syncTopicCounts();
  await seedDefaults();

  const total = await AptitudeQuestion.countDocuments({ isActive: true });
  console.log("\n✅ Aptitude seed complete");
  console.log(`   Topics: ${aptitudeTopics.length} (${topicCount} new, ${touched} counts synced)`);
  console.log(`   Wiped questions: ${result.wipedQ}, history: ${result.wipedH}, attempts: ${result.wipedA}`);
  console.log(`   Inserted: ${result.inserted}`);
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
