/**
 * Adaptive-session logic shared by Aptitude and Tech Practice (pure functions - no DB, no network).
 *
 * Mirrors the mock-interview rules in mockInterviewFeedback.ts: nothing is personalised from a single answer.
 *   - Difficulty: up after a run of correct (and not unusually slow) answers at the current level, down only after
 *     two consecutive mistakes - one accidental miss never changes the level.
 *   - Weak topic: at least MIN_TOPIC_SAMPLE answers and accuracy below WEAK_ACCURACY (repeated struggle).
 *   - Next session: ~60% of questions target weak topics, ~40% normal practice.
 * Every number is computed from stored answers; nothing is invented.
 */

export type Level = "easy" | "medium" | "hard";
export const LEVELS: Level[] = ["easy", "medium", "hard"];
export const MIN_TOPIC_SAMPLE = 3;
export const WEAK_ACCURACY = 60;
export const STRONG_ACCURACY = 75;
export const TARGETED_SHARE = 0.6;
export const MIN_HISTORY_FOR_PLAN = 5;
export const NOT_ENOUGH_HISTORY = "Not enough history for personalization yet.";

export function toLevel(value: unknown, fallback: Level = "medium"): Level {
  const v = String(value || "").toLowerCase();
  if (v === "easy" || v === "beginner") return "easy";
  if (v === "medium" || v === "intermediate") return "medium";
  if (v === "hard" || v === "advanced") return "hard";
  return fallback;
}

export interface AnswerSignal {
  topic: string;
  difficulty: Level;
  correct: boolean;
  responseTime?: number; // seconds
  expectedTime?: number; // seconds
}

export interface DifficultyDecision {
  level: Level;
  changed: boolean;
  direction: "up" | "down" | "same";
  reason: string;
}

const slow = (a: AnswerSignal) => !!a.expectedTime && !!a.responseTime && a.responseTime > 2 * a.expectedTime;

/** Next difficulty from the answers so far (oldest first). */
export function nextDifficulty(current: Level, answers: AnswerSignal[]): DifficultyDecision {
  const idx = LEVELS.indexOf(current);
  // trailing run at the current level only (answers before the last level change do not count twice)
  const run: AnswerSignal[] = [];
  for (let i = answers.length - 1; i >= 0 && answers[i].difficulty === current; i--) run.unshift(answers[i]);
  let correctStreak = 0;
  for (let i = run.length - 1; i >= 0 && run[i].correct && !slow(run[i]); i--) correctStreak++;
  let wrongStreak = 0;
  for (let i = run.length - 1; i >= 0 && !run[i].correct; i--) wrongStreak++;
  const last = answers[answers.length - 1];

  const needed = current === "easy" ? 1 : 2;
  if (correctStreak >= needed && idx < LEVELS.length - 1) {
    return {
      level: LEVELS[idx + 1], changed: true, direction: "up",
      reason: `${correctStreak} correct answer${correctStreak > 1 ? "s" : ""} in a row at ${current} - moving up to ${LEVELS[idx + 1]}.`,
    };
  }
  if (wrongStreak >= 2 && idx > 0) {
    return {
      level: LEVELS[idx - 1], changed: true, direction: "down",
      reason: `${wrongStreak} mistakes in a row at ${current} - stepping down to ${LEVELS[idx - 1]} to rebuild the concept.`,
    };
  }
  if (last && !last.correct) {
    return { level: current, changed: false, direction: "same", reason: `One mistake does not change the level - staying at ${current}.` };
  }
  if (last && last.correct && slow(last)) {
    return { level: current, changed: false, direction: "same", reason: `Correct, but slower than expected - staying at ${current}.` };
  }
  return { level: current, changed: false, direction: "same", reason: `Staying at ${current}.` };
}

export interface TopicStat {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avgResponseTime: number | null;
  mistakes: number;
  weak: boolean;
  strong: boolean;
}

export interface StatRow {
  topic: string;
  correct: boolean;
  responseTime?: number | null;
}

export function topicStats(rows: StatRow[]): TopicStat[] {
  const map = new Map<string, { n: number; c: number; times: number[] }>();
  for (const r of rows) {
    if (!r.topic) continue;
    const b = map.get(r.topic) || { n: 0, c: 0, times: [] };
    b.n++;
    if (r.correct) b.c++;
    if (typeof r.responseTime === "number" && r.responseTime > 0) b.times.push(r.responseTime);
    map.set(r.topic, b);
  }
  return Array.from(map.entries())
    .map(([topic, b]) => {
      const accuracy = Math.round((b.c / b.n) * 100);
      return {
        topic,
        attempts: b.n,
        correct: b.c,
        accuracy,
        avgResponseTime: b.times.length ? Math.round(b.times.reduce((a, x) => a + x, 0) / b.times.length) : null,
        mistakes: b.n - b.c,
        weak: b.n >= MIN_TOPIC_SAMPLE && accuracy < WEAK_ACCURACY,
        strong: b.n >= MIN_TOPIC_SAMPLE && accuracy >= STRONG_ACCURACY,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}

export interface PersonalizationPlan {
  hasHistory: boolean;
  answersConsidered: number;
  weakTopics: Array<{ topic: string; accuracy: number; attempts: number; mistakes: number }>;
  strongTopics: Array<{ topic: string; accuracy: number; attempts: number }>;
  targetedShare: number;
  message: string;
}

/** Plan for the next session from past answers. `allowed` limits it to the topics the session can ask about. */
export function buildPlan(rows: StatRow[], allowed?: string[]): PersonalizationPlan {
  const inScope = allowed && allowed.length ? rows.filter((r) => allowed.includes(r.topic)) : rows;
  const stats = topicStats(inScope);
  const plan: PersonalizationPlan = {
    hasHistory: inScope.length >= MIN_HISTORY_FOR_PLAN,
    answersConsidered: inScope.length,
    weakTopics: stats.filter((s) => s.weak).slice(0, 4).map(({ topic, accuracy, attempts, mistakes }) => ({ topic, accuracy, attempts, mistakes })),
    strongTopics: stats.filter((s) => s.strong).reverse().slice(0, 4).map(({ topic, accuracy, attempts }) => ({ topic, accuracy, attempts })),
    targetedShare: 0,
    message: NOT_ENOUGH_HISTORY,
  };
  if (!plan.hasHistory) return plan;
  if (plan.weakTopics.length === 0) {
    plan.message = "No repeatedly weak topic found in your history - this session is balanced practice.";
    return plan;
  }
  plan.targetedShare = TARGETED_SHARE;
  const names = plan.weakTopics.map((w) => `${w.topic} (${w.accuracy}% over ${w.attempts})`).join(", ");
  plan.message = `Your history shows repeated difficulty with ${names}. About ${Math.round(TARGETED_SHARE * 100)}% of this session targets these topics; the rest is normal practice.`;
  return plan;
}

export interface SessionItemLite {
  topic: string;
  answered: boolean;
  correct: boolean;
}

export interface TopicChoice {
  topic: string;
  focus: boolean;
  reason: string;
}

/**
 * Topic for the next question. Order: a user-fixed topic; a topic missed twice in THIS session and not yet recovered;
 * a weak history topic (with probability plan.targetedShare); otherwise normal rotation avoiding back-to-back repeats.
 */
export function chooseTopic(opts: {
  fixedTopic?: string;
  candidates: string[];
  plan?: PersonalizationPlan | null;
  items: SessionItemLite[];
  rand?: () => number;
}): TopicChoice {
  const rand = opts.rand || Math.random;
  const weakNames = new Set((opts.plan?.weakTopics || []).map((w) => w.topic));
  if (opts.fixedTopic) {
    return { topic: opts.fixedTopic, focus: weakNames.has(opts.fixedTopic), reason: "Topic chosen by you." };
  }
  const answered = opts.items.filter((i) => i.answered);
  const byTopic = new Map<string, SessionItemLite[]>();
  for (const i of answered) byTopic.set(i.topic, [...(byTopic.get(i.topic) || []), i]);
  for (const [topic, list] of byTopic) {
    if (!opts.candidates.includes(topic)) continue;
    const wrong = list.filter((i) => !i.correct).length;
    const lastTwo = list.slice(-2);
    if (wrong >= 2 && lastTwo.every((i) => !i.correct)) {
      return { topic, focus: true, reason: `You missed ${topic} twice in this session - one more to rebuild the concept.` };
    }
  }
  const weak = opts.candidates.filter((c) => weakNames.has(c));
  if (weak.length && opts.plan && rand() < opts.plan.targetedShare) {
    const topic = weak[Math.floor(rand() * weak.length)];
    const w = opts.plan.weakTopics.find((x) => x.topic === topic)!;
    return { topic, focus: true, reason: `Targeting a weak topic from your history (${w.accuracy}% over ${w.attempts} answers).` };
  }
  const last = opts.items[opts.items.length - 1]?.topic;
  const pool = opts.candidates.length > 1 ? opts.candidates.filter((c) => c !== last) : opts.candidates;
  const topic = pool[Math.floor(rand() * pool.length)];
  return { topic, focus: false, reason: "Normal practice rotation." };
}

// ── Reports ──────────────────────────────────────────────────────────────────
export interface ReportItem {
  topic: string;
  difficulty: Level;
  questionType?: string;
  answered: boolean;
  correct: boolean;
  score: number; // 0-100
  responseTime?: number | null;
}

export interface SessionSummary {
  total: number;
  answered: number;
  correct: number;
  score: number; // % of all questions
  accuracy: number; // % of answered questions
  avgResponseTime: number | null;
  averageDifficulty: Level | null;
  topicWise: TopicStat[];
  difficultyWise: Array<{ difficulty: Level; answered: number; correct: number; accuracy: number }>;
  typeWise: Array<{ questionType: string; answered: number; correct: number; accuracy: number }>;
  strongest: string[];
  weakest: string[];
  recommended: string[];
}

export function summarize(items: ReportItem[]): SessionSummary {
  const answered = items.filter((i) => i.answered);
  const correct = answered.filter((i) => i.correct).length;
  const times = answered.map((i) => i.responseTime).filter((t): t is number => typeof t === "number" && t > 0);
  const topicWise = topicStats(answered.map((i) => ({ topic: i.topic, correct: i.correct, responseTime: i.responseTime })));
  const group = <K extends string>(key: (i: ReportItem) => K) => {
    const m = new Map<K, { answered: number; correct: number }>();
    for (const i of answered) {
      const b = m.get(key(i)) || { answered: 0, correct: 0 };
      b.answered++;
      if (i.correct) b.correct++;
      m.set(key(i), b);
    }
    return Array.from(m.entries()).map(([k, b]) => ({ k, ...b, accuracy: Math.round((b.correct / b.answered) * 100) }));
  };
  const levelAvg = answered.length
    ? LEVELS[Math.round(answered.reduce((s, i) => s + LEVELS.indexOf(i.difficulty), 0) / answered.length)]
    : null;
  // Within ONE session a topic usually has 1-3 answers, so strongest/weakest here are relative (clearly labelled
  // in the UI as "this session"); the cross-session weak-topic rule (>= MIN_TOPIC_SAMPLE) is used for personalisation.
  const strongest = topicWise.filter((t) => t.accuracy >= STRONG_ACCURACY).reverse().slice(0, 3).map((t) => t.topic);
  const weakest = topicWise.filter((t) => t.accuracy < WEAK_ACCURACY).slice(0, 3).map((t) => t.topic);
  return {
    total: items.length,
    answered: answered.length,
    correct,
    score: items.length ? Math.round((correct / items.length) * 100) : 0,
    accuracy: answered.length ? Math.round((correct / answered.length) * 100) : 0,
    avgResponseTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    averageDifficulty: levelAvg,
    topicWise,
    difficultyWise: group((i) => i.difficulty).map(({ k, answered, correct, accuracy }) => ({ difficulty: k, answered, correct, accuracy })),
    typeWise: group((i) => (i.questionType || "mcq") as string).map(({ k, answered, correct, accuracy }) => ({ questionType: k, answered, correct, accuracy })),
    strongest,
    weakest,
    recommended: weakest.length ? weakest : topicWise.filter((t) => t.accuracy < 100).slice(0, 2).map((t) => t.topic),
  };
}

export function compareWithPrevious(current: { score: number; accuracy: number }, previous?: { score?: number; accuracy?: number } | null) {
  if (!previous) return null;
  return {
    previousScore: previous.score ?? 0,
    previousAccuracy: previous.accuracy ?? 0,
    scoreDelta: current.score - (previous.score ?? 0),
    accuracyDelta: current.accuracy - (previous.accuracy ?? 0),
  };
}

/** Practice Again: before (attempt 1) vs latest attempt. */
export function attemptComparison(attempts: Array<{ attemptNumber: number; score: number | null; isCorrect: boolean | null }>) {
  const graded = attempts.filter((a) => typeof a.score === "number");
  if (graded.length < 2) return null;
  const before = graded[0];
  const after = graded[graded.length - 1];
  return {
    beforeAttempt: before.attemptNumber,
    afterAttempt: after.attemptNumber,
    before: before.score as number,
    after: after.score as number,
    improvement: (after.score as number) - (before.score as number),
  };
}
