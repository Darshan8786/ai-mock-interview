/**
 * Exports the chatbot's training data and held-out test sets as JSON so the
 * neural model in ai-services/chatbot can be trained on exactly the same data
 * (and scored on exactly the same tests) as the TF-IDF model.
 *
 *   npm run export:chatbot
 *
 * Test sets are exported separately from training data and are never read by
 * the trainer — only by the evaluation step.
 */
import fs from "fs";
import path from "path";
import { knowledgeBase } from "../services/chatbot/trainer";
import { intents, outOfScope } from "../services/chatbot/intents";
import { validationSet } from "../services/chatbot/validationSet";
import { evalSet } from "../services/chatbot/evalSet";
import { evalSetFresh } from "../services/chatbot/evalSetFresh";
import { evalSetCold3 } from "../services/chatbot/evalSetCold3";
import { OOS_TARGET } from "../services/chatbot/types";

const outDir = path.resolve(__dirname, "../../../ai-services/chatbot/data");
fs.mkdirSync(outDir, { recursive: true });

const train: { target: string; text: string }[] = [];
for (const e of knowledgeBase) {
  for (const q of e.questions) train.push({ target: e.id, text: q });
  train.push({ target: e.id, text: e.title });
}
for (const i of intents) for (const q of i.questions) train.push({ target: i.id, text: q });
for (const q of outOfScope) train.push({ target: OOS_TARGET, text: q });

const write = (name: string, data: unknown) =>
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 1));

write("train.json", train);
write("validation.json", validationSet);
write("test1.json", evalSet);
write("test2.json", evalSetFresh);
write("test3.json", evalSetCold3);

console.log(`✅ exported to ${path.relative(process.cwd(), outDir)}`);
console.log(`   train: ${train.length} phrasings over ${new Set(train.map((t) => t.target)).size} targets`);
console.log(`   validation ${validationSet.length} · test1 ${evalSet.length} · test2 ${evalSetFresh.length} · test3 ${evalSetCold3.length}`);
