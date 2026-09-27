/**
 * Shape guard for ai-service tech records (regression test for a malformed response being stored and shown).
 * Run:  npx tsx --test src/controllers/techAdaptiveController.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isWellFormedTechRecord, publicQuestion } from "./techAdaptiveController";

const mcq = { id: "java_001", topic: "OOP", question: "Which keyword creates a subclass?", question_type: "MCQ",
  options: ["extends", "implements", "super", "this"], correct_option: 0, answer: "extends", explanation: "..." };

test("accepts well-formed records of each kind", () => {
  assert.equal(isWellFormedTechRecord(mcq), true);
  assert.equal(isWellFormedTechRecord({ id: "x", topic: "T", question: "Explain GC.", question_type: "Conceptual", answer: "Reclaims memory" }), true);
});

test("rejects malformed records (the fake-AI e2e case and friends)", () => {
  assert.equal(isWellFormedTechRecord({ question: "Explain Java collections.", source: "model" }), false);
  assert.equal(isWellFormedTechRecord({ ...mcq, options: "a, b, c, d" }), false);
  assert.equal(isWellFormedTechRecord({ ...mcq, correct_option: 7 }), false);
  assert.equal(isWellFormedTechRecord({ ...mcq, question_type: "Essay" }), false);
  assert.equal(isWellFormedTechRecord({ ...mcq, question: "   " }), false);
  assert.equal(isWellFormedTechRecord({ id: "x", topic: "T", question: "Explain GC.", question_type: "Conceptual", answer: "" }), false);
  assert.equal(isWellFormedTechRecord(null), false);
});

test("public question never carries the answer key", () => {
  const pub: any = publicQuestion({ record: { ...mcq, fixed_code: "x", expected_solution: "y" }, topic: "OOP", difficulty: "Easy", questionType: "MCQ" }, 0);
  for (const k of ["answer", "correct_option", "explanation", "fixed_code", "expected_solution"]) assert.equal(k in pub, false, k);
  assert.deepEqual(pub.options, mcq.options);
});
