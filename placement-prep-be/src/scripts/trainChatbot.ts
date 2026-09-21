/**
 * Trains the local study chatbot and writes src/services/chatbot/model.json.
 *
 *   npm run train:chatbot
 *
 * Re-run after editing the knowledge base (src/services/chatbot/kb/*.ts) or the
 * intents. Purely offline: no API keys, no network, no GPU.
 */
import fs from "fs";
import path from "path";
import { knowledgeBase, train } from "../services/chatbot/trainer";
import { intents } from "../services/chatbot/intents";

const ids = [...knowledgeBase.map((e) => e.id), ...intents.map((i) => i.id)];
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) {
  console.error(`❌ Duplicate knowledge-base ids: ${[...new Set(dupes)].join(", ")}`);
  process.exit(1);
}

const thin = knowledgeBase.filter((e) => e.questions.length < 3);
if (thin.length) {
  console.warn(`⚠️  Entries with fewer than 3 training questions: ${thin.map((e) => e.id).join(", ")}`);
}

const started = Date.now();
const { model, report } = train();
const out = path.resolve(__dirname, "../services/chatbot/model.json");
fs.writeFileSync(out, JSON.stringify(model));

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`✅ Trained in ${Date.now() - started} ms → ${path.relative(process.cwd(), out)} (${kb} KB)`);
console.log(`   knowledge entries : ${model.stats.entries}`);
console.log(`   intents           : ${model.stats.intents}`);
console.log(`   training phrasings: ${model.stats.examples}`);
console.log(`   vocabulary        : ${model.stats.vocabulary}`);
console.log(`   validation answered right : ${(report.validationAccuracy * 100).toFixed(1)}%`);
console.log(`   validation off-topic declined: ${(report.outOfScopeRejection * 100).toFixed(1)}%`);
const p = report.params;
console.log(`   tuned: unknown-word weight ${p.oovWeight}, bigram weight ${p.bigramWeight}, answer-chunk weight ${p.chunkWeight}`);
console.log(`          threshold ${report.threshold} (confident ≥ ${report.confidentThreshold})`);
console.log("   top configurations tried (validation balanced accuracy):");
report.search.forEach((r) =>
  console.log(`     ${(r.balanced * 100).toFixed(1)}%  oov=${r.params.oovWeight} bigram=${r.params.bigramWeight} chunk=${r.params.chunkWeight} t=${r.threshold}`)
);
