/**
 * Unit tests for the adaptive Aptitude / Tech Practice logic (pure functions only).
 * Run:  npx tsx --test src/services/adaptiveEngine.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  AnswerSignal,
  NOT_ENOUGH_HISTORY,
  attemptComparison,
  buildPlan,
  chooseTopic,
  nextDifficulty,
  summarize,
  toLevel,
} from "./adaptiveEngine";

const a = (difficulty: any, correct: boolean, topic = "Percentages", responseTime = 30): AnswerSignal => ({
  topic, difficulty, correct, responseTime, expectedTime: 60,
});

test("spec example: easy correct -> medium, medium x2 correct -> hard", () => {
  const h: AnswerSignal[] = [a("easy", true)];
  assert.equal(nextDifficulty("easy", h).level, "medium");
  h.push(a("medium", true));
  assert.equal(nextDifficulty("medium", h).level, "medium");
  h.push(a("medium", true));
  assert.equal(nextDifficulty("medium", h).level, "hard");
});

test("one accidental mistake never changes the level", () => {
  const d = nextDifficulty("medium", [a("medium", true), a("medium", false)]);
  assert.equal(d.level, "medium");
  assert.equal(d.changed, false);
});

test("two consecutive mistakes step down", () => {
  const d = nextDifficulty("medium", [a("medium", false), a("medium", false)]);
  assert.equal(d.level, "easy");
  assert.equal(d.direction, "down");
});

test("slow correct answers do not count toward moving up", () => {
  const d = nextDifficulty("medium", [a("medium", true, "x", 200), a("medium", true, "x", 200)]);
  assert.equal(d.level, "medium");
});

test("answers from before a level change are not reused", () => {
  // two correct at easy, then one correct at medium -> still medium (needs two at medium)
  const d = nextDifficulty("medium", [a("easy", true), a("easy", true), a("medium", true)]);
  assert.equal(d.level, "medium");
});

test("hard and easy are clamped", () => {
  assert.equal(nextDifficulty("hard", [a("hard", true), a("hard", true)]).level, "hard");
  assert.equal(nextDifficulty("easy", [a("easy", false), a("easy", false)]).level, "easy");
});

test("plan needs history, and weakness needs repeated evidence", () => {
  assert.equal(buildPlan([{ topic: "P&L", correct: false }]).message, NOT_ENOUGH_HISTORY);
  const rows = [
    ...Array(4).fill({ topic: "Profit Loss & Discount", correct: false }),
    { topic: "Profit Loss & Discount", correct: true },
    ...Array(5).fill({ topic: "Percentages", correct: true }),
    { topic: "Time & Work", correct: false }, // one miss only -> not weak
  ];
  const plan = buildPlan(rows);
  assert.deepEqual(plan.weakTopics.map((w) => w.topic), ["Profit Loss & Discount"]);
  assert.deepEqual(plan.strongTopics.map((s) => s.topic), ["Percentages"]);
  assert.equal(plan.targetedShare, 0.6);
});

test("chooseTopic: in-session repeated misses are followed up", () => {
  const c = chooseTopic({
    candidates: ["A", "B", "C"],
    items: [{ topic: "B", answered: true, correct: false }, { topic: "A", answered: true, correct: true }, { topic: "B", answered: true, correct: false }],
    rand: () => 0.99,
  });
  assert.equal(c.topic, "B");
  assert.equal(c.focus, true);
});

test("chooseTopic: ~60% weak targeting from history", () => {
  const plan = buildPlan([...Array(5).fill({ topic: "Weak", correct: false }), ...Array(5).fill({ topic: "Ok", correct: true })]);
  let targeted = 0;
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1000; i++) {
    if (chooseTopic({ candidates: ["Weak", "Ok", "Other"], plan, items: [], rand }).focus) targeted++;
  }
  assert.ok(targeted > 520 && targeted < 680, `targeted ${targeted}`);
});

test("summary + practice-again comparison", () => {
  const s = summarize([
    { topic: "A", difficulty: "easy", answered: true, correct: true, score: 100, responseTime: 20 },
    { topic: "A", difficulty: "medium", answered: true, correct: false, score: 0, responseTime: 40 },
    { topic: "B", difficulty: "medium", answered: false, correct: false, score: 0 },
  ]);
  assert.equal(s.score, 33);
  assert.equal(s.accuracy, 50);
  assert.equal(s.avgResponseTime, 30);
  const cmp = attemptComparison([
    { attemptNumber: 1, score: 40, isCorrect: false },
    { attemptNumber: 2, score: 80, isCorrect: true },
  ]);
  assert.deepEqual(cmp, { beforeAttempt: 1, afterAttempt: 2, before: 40, after: 80, improvement: 40 });
  assert.equal(attemptComparison([{ attemptNumber: 1, score: 40, isCorrect: false }]), null);
  assert.equal(toLevel("advanced"), "hard");
});
