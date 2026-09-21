import fs from "fs";
import path from "path";
import { MODEL_VERSION, train } from "./trainer";
import type { ChatbotModel } from "./types";

/**
 * Where model.json lives. In dev (tsx) it sits next to this file; after `tsc`
 * the JSON is not copied into dist/, so also look in the source tree relative
 * to the working directory (the backend is always started from its root).
 */
const CANDIDATES = [
  path.resolve(__dirname, "model.json"),
  path.resolve(process.cwd(), "src/services/chatbot/model.json"),
];

let cached: { model: ChatbotModel; file: string | null; mtimeMs: number } | null = null;

function findFile(): string | null {
  return CANDIDATES.find((f) => fs.existsSync(f)) ?? null;
}

/**
 * Returns the trained model. Reloads automatically when model.json changes on
 * disk (so `npm run train:chatbot` takes effect without restarting the server).
 * If no usable file exists, trains in memory from the knowledge base — the bot
 * works out of the box, just without the on-disk cache.
 */
export function loadModel(): ChatbotModel {
  const file = findFile();
  const mtimeMs = file ? fs.statSync(file).mtimeMs : 0;
  if (cached && cached.file === file && cached.mtimeMs === mtimeMs) return cached.model;

  if (file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as ChatbotModel;
      if (parsed.version === MODEL_VERSION) {
        cached = { model: parsed, file, mtimeMs };
        return parsed;
      }
      console.warn("[chatbot] model.json is from an older version — retraining in memory");
    } catch (err) {
      console.warn("[chatbot] model.json unreadable — retraining in memory:", (err as Error).message);
    }
  } else {
    console.warn("[chatbot] model.json not found — training in memory (run `npm run train:chatbot`)");
  }

  const { model } = train();
  cached = { model, file, mtimeMs };
  return model;
}
