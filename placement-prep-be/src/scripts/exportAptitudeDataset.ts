// Exports the in-repo aptitude seed banks to JSON for the local model's training pipeline
// (ai-services/interviewer_llm/training/build_multidomain_dataset.py). Read-only: no DB, no network.
//
//   npx tsx src/scripts/exportAptitudeDataset.ts
//
// Every seed array is exported (the ones seedAptitude.ts inserts AND the older legacy arrays), each record
// tagged with the array it came from; de-duplication, normalisation and answer verification happen in the
// Python cleaning step, not here.
import fs from "fs";
import path from "path";
import { quantSeed } from "../data/quantSeed";
import { quantSeed1 } from "../data/quantSeed1";
import { quantSeed2 } from "../data/quantSeed2";
import { logicalSeed } from "../data/logicalSeed";
import { logicalSeed1 } from "../data/logicalSeed1";
import { logicalSeed2 } from "../data/logicalSeed2";
import { verbalSeed } from "../data/verbalSeed";
import { verbalSeed1 } from "../data/verbalSeed1";
import { verbalSeed2 } from "../data/verbalSeed2";
import { diSeed } from "../data/diSeed";
import { diSeed2 } from "../data/diSeed2";
import { aptitudeTopics } from "../data/aptitudeTopics";
import { SeedQuestion } from "../data/seedTypes";

const SOURCES: Record<string, SeedQuestion[]> = {
  quantSeed, quantSeed1, quantSeed2, logicalSeed, logicalSeed1, logicalSeed2,
  verbalSeed, verbalSeed1, verbalSeed2, diSeed, diSeed2,
};

const out = path.resolve(__dirname, "../../../ai-services/training/data/aptitude_questions");
fs.mkdirSync(out, { recursive: true });

const records = Object.entries(SOURCES).flatMap(([source, rows]) =>
  rows.map((s, i) => ({
    id: `${source}-${String(i + 1).padStart(4, "0")}`,
    source,
    category: s.cat,
    topic: s.topic,
    subtopic: s.subtopic || "",
    difficulty: s.diff,
    question: s.q,
    options: s.opts,
    answer_index: s.a,
    explanation: s.exp,
    companies: s.tags || [],
    estimated_time: s.time || 60,
  }))
);

fs.writeFileSync(path.join(out, "seed_export.json"), JSON.stringify(records, null, 1), "utf-8");
fs.writeFileSync(path.join(out, "topic_catalog.json"), JSON.stringify(aptitudeTopics, null, 1), "utf-8");
console.log(`exported ${records.length} seed records from ${Object.keys(SOURCES).length} arrays -> ${out}`);
