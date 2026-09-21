import type { SparseVector } from "./nlp";

/** Target id of the trained "not something I can help with" class. */
export const OOS_TARGET = "__out_of_scope__";

/** One topic the chatbot can answer, with the phrasings it is trained on. */
export interface KbEntry {
  id: string;
  /** Shown to the user as the source chip, e.g. "Aptitude · Percentages". */
  topic: string;
  title: string;
  /** Training utterances. More diverse phrasings → better recall. */
  questions: string[];
  answer: string;
}

/**
 * Intents that are answered from the student's own data at request time
 * (weak areas, scores, ...) or are conversational (greeting, thanks).
 * Same shape as KbEntry minus a static answer.
 */
export interface IntentDef {
  id: string;
  kind: "personal" | "smalltalk";
  questions: string[];
}

export interface ModelExample {
  /** Id of the KbEntry or IntentDef this example belongs to. */
  target: string;
  vec: SparseVector;
}

/** The trained artefact written by scripts/trainChatbot.ts and loaded by the engine. */
export interface ChatbotModel {
  version: number;
  trainedAt: string;
  idf: Record<string, number>;
  examples: ModelExample[];
  /**
   * Weight given to words the model has never seen (see nlp.vectorize).
   * Tuned on the validation set by the trainer.
   */
  oovWeight: number;
  /** Bigram multiplier used when vectorising (tuned on the validation set). */
  bigramWeight: number;
  /** Minimum cosine similarity to trust a match; tuned on held-out data by the trainer. */
  threshold: number;
  /** Below this, an answer is shown with a "did you mean" style hedge. */
  confidentThreshold: number;
  stats: {
    entries: number;
    intents: number;
    examples: number;
    vocabulary: number;
    validationAccuracy: number;
    outOfScopeRejection: number;
  };
}
