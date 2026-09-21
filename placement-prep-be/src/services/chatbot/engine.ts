import { buildAnalytics } from "../analyticsService";
import { decideRanked, rank, SUGGEST_MIN, type Decision, type Match } from "./matcher";
import { fuseDecisions } from "./fusion";
import { neuralRank } from "./neuralClient";
import { loadModel } from "./modelStore";
import { intents } from "./intents";
import { personalReply, reply, smalltalkReply, STARTER_SUGGESTIONS, type ChatReply, type ChatSuggestion } from "./responder";
import { knowledgeBase } from "./trainer";

const kbById = new Map(knowledgeBase.map((e) => [e.id, e]));
const intentById = new Map(intents.map((i) => [i.id, i]));

export const MAX_MESSAGE_LENGTH = 500;

/** Turn an entry into a clickable follow-up: label = title, prompt = a natural question. */
function toSuggestion(entryId: string): ChatSuggestion | null {
  const e = kbById.get(entryId);
  if (!e) return null;
  const q = e.questions[0];
  return { label: e.title, prompt: q.charAt(0).toUpperCase() + q.slice(1) + (q.endsWith("?") ? "" : "?") };
}

export interface ChatOutcome {
  reply: ChatReply;
  /** Whether the bot could not answer — worth logging so the KB can grow. */
  unanswered: boolean;
  topCandidate?: { target: string; score: number };
}

/**
 * Answer one message. Entirely local: retrieval over the trained model, plus
 * the student's own analytics for personal questions.
 */
export async function chat(rawMessage: string, userId: string): Promise<ChatOutcome> {
  const message = rawMessage.trim().slice(0, MAX_MESSAGE_LENGTH);

  // Keyword model: always available, strong against typos.
  const model = loadModel();
  const kRanked = rank(message, model);
  const kDecision = decideRanked(kRanked, {
    threshold: model.threshold,
    confidentThreshold: model.confidentThreshold,
    suggestMin: SUGGEST_MIN,
  });

  // Fine-tuned neural model: far better with paraphrases. If the AI service is
  // unreachable we simply use the keyword model, so the chatbot never goes offline.
  const neural = await neuralRank(message);
  if (!neural) {
    const outcome = await respond(userId, kRanked, kDecision, model.threshold * 0.85);
    outcome.reply.engine = "keyword";
    return outcome;
  }

  const nDecision = decideRanked(neural.ranked, {
    threshold: neural.threshold,
    confidentThreshold: neural.confidentThreshold,
    suggestMin: neural.threshold - neural.suggestMargin,
  });
  const decision = fuseDecisions(nDecision, kDecision);
  const rescuedByKeyword = decision === kDecision;
  const outcome = await respond(
    userId,
    rescuedByKeyword ? kRanked : neural.ranked,
    decision,
    rescuedByKeyword ? model.threshold * 0.85 : neural.threshold - 0.08
  );
  outcome.reply.engine = decision === nDecision ? "neural" : "hybrid";
  return outcome;
}

async function respond(
  userId: string,
  ranked: Match[],
  decision: Decision,
  relatedMin: number
): Promise<ChatOutcome> {
  const top = ranked[0] ? { target: ranked[0].target, score: Number(ranked[0].score.toFixed(3)) } : undefined;

  if (decision.kind === "answer") {
    const id = decision.match.target;

    const entry = kbById.get(id);
    if (entry) {
      // Related topics: other real matches that are also reasonably close.
      const related = ranked
        .filter((m) => m.target !== id && kbById.has(m.target) && m.score >= relatedMin)
        .slice(0, 2)
        .map((m) => toSuggestion(m.target))
        .filter((x): x is ChatSuggestion => !!x);
      return {
        reply: reply({
          kind: "knowledge",
          topic: entry.topic,
          answer: entry.answer,
          confident: decision.confident,
          suggestions: related,
        }),
        unanswered: false,
        topCandidate: top,
      };
    }

    const intent = intentById.get(id);
    if (intent?.kind === "personal") {
      const analytics = await buildAnalytics(userId);
      return { reply: personalReply(id, analytics), unanswered: false, topCandidate: top };
    }
    if (intent?.kind === "smalltalk") {
      return { reply: smalltalkReply(id), unanswered: false, topCandidate: top };
    }
  }

  if (decision.kind === "suggest") {
    const suggestions = decision.matches
      .map((m) => (intentById.has(m.target) ? starterFor(m.target) : toSuggestion(m.target)))
      .filter((x): x is ChatSuggestion => !!x);
    if (suggestions.length) {
      return {
        reply: reply({
          kind: "suggest",
          confident: false,
          answer: "I'm not completely sure what you're asking. Did you mean one of these?",
          suggestions,
        }),
        unanswered: true,
        topCandidate: top,
      };
    }
  }

  return {
    reply: reply({
      kind: "fallback",
      confident: false,
      answer:
        "I don't have a good answer for that yet. I can help with aptitude formulas and shortcuts, CS fundamentals (OS, DBMS, networks, DSA, OOP), " +
        "interview and resume tips, and your own performance. Try one of these:",
      suggestions: STARTER_SUGGESTIONS,
    }),
    unanswered: true,
    topCandidate: top,
  };
}

/** Personal intents have no KB entry; offer their canonical phrasing as a suggestion. */
function starterFor(intentId: string): ChatSuggestion | null {
  const intent = intentById.get(intentId);
  if (!intent || intent.kind !== "personal") return null;
  const q = intent.questions[0];
  return { label: q.charAt(0).toUpperCase() + q.slice(1), prompt: q.charAt(0).toUpperCase() + q.slice(1) + "?" };
}
