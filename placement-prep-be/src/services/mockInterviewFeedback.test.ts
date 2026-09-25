/**
 * Unit tests for the explainable mock-interview feedback logic (pure functions only - no DB, no network).
 * Run:  npx tsx --test src/services/mockInterviewFeedback.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  attemptViews,
  buildComparison,
  buildPerformanceSummary,
  buildPersonalization,
  buildProctoringSummary,
  buildProgress,
  buildWeaknessMap,
  fallbackEvaluation,
  parseAnswerBody,
  questionVerdict,
  sanitizeEvaluation,
  weaknessMapForInterview,
} from "./mockInterviewFeedback";

// ── helpers ────────────────────────────────────────────────────────────────
const scores = (n: number, extra: Record<string, unknown> = {}) => ({
  technicalScore: n,
  communicationScore: n,
  confidenceScore: n,
  grammarScore: n,
  fluencyScore: n,
  relevanceScore: n,
  feedback: "",
  ...extra,
});

const analysis = (over: Record<string, unknown> = {}) => ({
  version: 2,
  questionType: "technical",
  conceptSource: "topic-dataset",
  matchedConcepts: ["a"],
  missingConcepts: ["b"],
  structure: {
    type: "technical",
    label: "Technical explanation",
    framework: "Definition → Explanation → Example → Conclusion",
    score: 50,
    elements: [{ key: "definition", label: "Definition", found: true, evidence: "x is y", position: 0.1 }],
    missing: ["Example"],
    recommendation: "Add an example.",
  },
  communication: {
    wordCount: 60,
    durationSeconds: null,
    durationSource: null,
    durationLabel: null,
    fillerWords: { count: 3, items: [{ word: "like", count: 3 }] },
    repeatedPhrases: { count: 0, items: [] },
    hedgingPhrases: { count: 0, items: [] },
    longPauses: null,
    speakingRate: null,
    length: "appropriate",
    idealLength: { min: 35, max: 160 },
    feedback: "ok",
    flagged: false,
    notes: [],
  },
  timeline: [{ kind: "good", label: "Definition present", position: 0.1, atSeconds: null }],
  explanations: { technical: { score: 70, good: ["g"], missing: ["m"], improve: ["i"] } },
  strengths: ["s"],
  weaknesses: ["w"],
  improvements: ["i"],
  practiceTopics: ["DBMS: Normalization"],
  ...over,
});

const question = (o: Record<string, unknown> = {}) => ({
  _id: "q" + Math.random().toString(36).slice(2),
  question: "Explain normalization",
  skill: "DBMS",
  topic: "Normalization",
  answer: "some answer text here",
  answerType: "text",
  skipped: false,
  evaluation: { ...scores(70), source: "local" },
  attempts: [],
  ...o,
});

const interview = (questions: any[], o: Record<string, unknown> = {}) => ({
  _id: "iv" + Math.random().toString(36).slice(2),
  source: "AI",
  interviewType: "Technical",
  jobRole: "Backend Developer",
  overallScore: 70,
  createdAt: new Date("2026-01-01"),
  completedAt: new Date("2026-01-01"),
  questions,
  ...o,
});

// ── validation ─────────────────────────────────────────────────────────────
test("sanitizeEvaluation clamps scores, keeps a valid analysis, tags source", () => {
  const ev = sanitizeEvaluation({ ...scores(140), technicalScore: -5, structureScore: 61.6, analysis: analysis() })!;
  assert.equal(ev.technicalScore, 0);
  assert.equal(ev.communicationScore, 100);
  assert.equal(ev.structureScore, 62);
  assert.equal(ev.source, "local");
  assert.ok(ev.analysis);
});

test("sanitizeEvaluation rejects unusable core scores", () => {
  assert.equal(sanitizeEvaluation(null), null);
  assert.equal(sanitizeEvaluation({ technicalScore: "high" }), null);
  const { technicalScore: _drop, ...missingOne } = scores(50);
  assert.equal(sanitizeEvaluation(missingOne), null);
});

test("sanitizeEvaluation drops a malformed analysis but keeps the scores", () => {
  const ev = sanitizeEvaluation({ ...scores(80), analysis: { version: 2, structure: "nope" } })!;
  assert.equal(ev.technicalScore, 80);
  assert.equal(ev.analysis, undefined);
});

test("sanitizeEvaluation caps long strings/lists", () => {
  const long = "x".repeat(5000);
  const ev = sanitizeEvaluation({ ...scores(50), feedback: long, analysis: analysis({ strengths: Array(50).fill(long) }) })!;
  assert.equal(ev.feedback.length, 2000);
  assert.equal(ev.analysis!.strengths.length, 6);
  assert.equal(ev.analysis!.strengths[0].length, 300);
});

test("fallback evaluation is deterministic, flagged, and has no analysis", () => {
  const a = fallbackEvaluation();
  const b = fallbackEvaluation();
  assert.deepEqual(a, b);
  assert.equal(a.source, "fallback");
  assert.equal(a.analysis, undefined);
});

test("parseAnswerBody validates answer, type, time and speech", () => {
  const ok = parseAnswerBody({ answer: "hi", answerType: "voice", timeTaken: 12, speech: { recordingSeconds: 20, pauseDetection: true, pauses: [{ startSeconds: 3, durationSeconds: 2.5 }] } });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.speech?.pauses?.length, 1);
    assert.equal(ok.value.timeTaken, 12);
  }
  assert.equal(parseAnswerBody({ answer: "x".repeat(20001) }).ok, false);
  assert.equal(parseAnswerBody({ answer: "x", answerType: "video" }).ok, false);
  assert.equal(parseAnswerBody({ answer: "x", timeTaken: -3 }).ok, false);
});

test("speech metadata only counts for voice answers and is dropped (not an error) when unusable", () => {
  const text = parseAnswerBody({ answer: "x", answerType: "text", speech: { recordingSeconds: 30 } });
  assert.ok(text.ok && text.value.speech === undefined);
  const bad = parseAnswerBody({ answer: "x", answerType: "voice", speech: { recordingSeconds: "NaN" } });
  assert.ok(bad.ok && bad.value.speech === undefined);
  const noPauseDetection = parseAnswerBody({ answer: "x", answerType: "voice", speech: { recordingSeconds: 30, pauses: [{ startSeconds: 1, durationSeconds: 5 }] } });
  assert.ok(noPauseDetection.ok && noPauseDetection.value.speech && noPauseDetection.value.speech.pauses === undefined);
});

// ── verdicts ───────────────────────────────────────────────────────────────
test("questionVerdict levels and labels", () => {
  assert.equal(questionVerdict(question({ evaluation: { ...scores(85), source: "local" } })).level, "strong");
  assert.equal(questionVerdict(question({ evaluation: { ...scores(65), source: "local" } })).level, "improve");
  const weak = questionVerdict(question({ evaluation: { ...scores(30), source: "local" } }));
  assert.equal(weak.level, "weak");
  assert.equal(weak.label, "Weak technical explanation");
  assert.equal(questionVerdict(question({ skipped: true })).level, "skipped");
  assert.equal(questionVerdict(question({ evaluation: fallbackEvaluation() })).level, "pending");
  const project = questionVerdict(question({ skill: "Project", evaluation: { ...scores(90), source: "local" } }));
  assert.equal(project.label, "Excellent project explanation");
});

test("legacy evaluations (no source, no new fields) still produce verdicts", () => {
  const legacy = question({ evaluation: scores(80) });
  assert.equal(questionVerdict(legacy).level, "strong");
});

// ── attempts & comparison ──────────────────────────────────────────────────
test("attemptViews keeps attempt 1 as-is and orders practice attempts after it", () => {
  const iv = interview([]);
  const q: any = question({
    answeredAt: new Date("2026-02-01"),
    attempts: [
      { attemptNumber: 3, answer: "c", evaluation: { ...scores(90), source: "local" }, createdAt: new Date("2026-02-03") },
      { attemptNumber: 2, answer: "b", evaluation: { ...scores(80), source: "local" }, createdAt: new Date("2026-02-02") },
    ],
  });
  const views = attemptViews(iv, q);
  assert.deepEqual(views.map((v) => v.attemptNumber), [1, 2, 3]);
  assert.equal(views[0].answer, "some answer text here");
  assert.equal(views[0].timestampApproximate, false);
});

test("attempt 1 of a legacy record is flagged as an approximate timestamp", () => {
  const views = attemptViews(interview([]), question());
  assert.equal(views[0].timestampApproximate, true);
});

test("buildComparison only returns metrics present on 2+ attempts and computes deltas", () => {
  const attempts: any[] = [
    { attemptNumber: 1, evaluation: { ...scores(60), structureScore: 50, source: "local", analysis: analysis() } },
    { attemptNumber: 2, evaluation: { ...scores(80), structureScore: 76, source: "local", analysis: analysis({ communication: { ...analysis().communication, fillerWords: { count: 1, items: [] } } }) } },
  ];
  const { rows } = buildComparison(attempts);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(byKey.technical.delta, 20);
  assert.deepEqual(byKey.structure.values, [50, 76]);
  assert.equal(byKey.structure.delta, 26);
  assert.equal(byKey.fillerWords.delta, -2);
  assert.equal(byKey.fillerWords.lowerIsBetter, true);
  // completeness/clarity/conciseness exist on neither attempt -> not shown
  assert.equal(byKey.completeness, undefined);
  assert.equal(byKey.duration, undefined);
});

test("buildComparison never shows a metric only one attempt has", () => {
  const attempts: any[] = [
    { attemptNumber: 1, evaluation: { ...scores(60), source: "local" } }, // legacy: no structure
    { attemptNumber: 2, evaluation: { ...scores(80), structureScore: 70, source: "local" } },
  ];
  const keys = buildComparison(attempts).rows.map((r) => r.key);
  assert.ok(!keys.includes("structure"));
  assert.ok(keys.includes("technical"));
});

test("buildComparison ignores placeholder (fallback) attempts and mixed duration sources", () => {
  const rec = (src: string, secs: number) => analysis({ communication: { ...analysis().communication, durationSource: src, durationSeconds: secs } });
  const attempts: any[] = [
    { attemptNumber: 1, evaluation: { ...scores(60), source: "local", analysis: rec("recording", 40) } },
    { attemptNumber: 2, evaluation: fallbackEvaluation() },
    { attemptNumber: 3, evaluation: { ...scores(80), source: "local", analysis: rec("time_on_question", 55) } },
  ];
  const { attempts: used, rows } = buildComparison(attempts);
  assert.deepEqual(used, [1, 3]);
  assert.equal(rows.find((r) => r.key === "duration"), undefined); // recording vs time-on-question are not comparable
});

// ── performance summary ────────────────────────────────────────────────────
test("performance summary reports strongest/weakest from real averages", () => {
  const ev = (t: number, s: number) => ({ ...scores(70), technicalScore: t, structureScore: s, source: "local", analysis: analysis() });
  const iv = interview([question({ evaluation: ev(90, 40) }), question({ evaluation: ev(80, 50) })]);
  const p = buildPerformanceSummary(iv);
  assert.equal(p.strongest?.key, "technical");
  assert.equal(p.weakest?.key, "structure");
  assert.match(p.recommendation || "", /Definition → Explanation → Example → Conclusion/);
});

test("a newer metric is excluded when not every evaluated answer has it", () => {
  const withStructure = { ...scores(70), structureScore: 50, source: "local" };
  const iv = interview([question({ evaluation: withStructure }), question({ evaluation: { ...scores(70), source: "local" } })]);
  const keys = buildPerformanceSummary(iv).metrics.map((m) => m.key);
  assert.ok(!keys.includes("structure"));
});

// ── weakness map ───────────────────────────────────────────────────────────
test("weakness map: recurring topic weakness is found, one-off is not, strengths listed", () => {
  const ev = (t: number) => ({ ...scores(t), source: "local" });
  const iv = interview([
    question({ skill: "DBMS", topic: "Normalization", evaluation: ev(40) }),
    question({ skill: "DBMS", topic: "Normalization", evaluation: ev(50) }),
    question({ skill: "Python", topic: "Lists", evaluation: ev(92) }),
    question({ skill: "SQL", topic: "Joins", evaluation: ev(60) }), // one weak answer out of 4 total buckets -> alone: 1 of 1 = 100%
  ]);
  const map = weaknessMapForInterview(iv);
  const dbms = map.weaknesses.find((w) => w.label === "DBMS");
  assert.ok(dbms);
  assert.equal(dbms!.occurrences, 2);
  assert.deepEqual(dbms!.detail, ["Normalization"]);
  assert.ok(map.strengths.some((s) => s.label === "Python"));
  // heaviest first, and the heaviest is normalised to 100
  const weights = map.weaknesses.map((w) => w.weight);
  assert.deepEqual(weights, [...weights].sort((a, b) => b - a));
  assert.equal(weights[0], 100);
});

test("weakness map: a single weak answer among many is NOT a recurring weakness", () => {
  const ev = (t: number) => ({ ...scores(t), source: "local" });
  const iv = interview([
    question({ skill: "Java", topic: "A", evaluation: ev(40) }),
    question({ skill: "Java", topic: "B", evaluation: ev(90) }),
    question({ skill: "Java", topic: "C", evaluation: ev(90) }),
  ]);
  assert.equal(weaknessMapForInterview(iv).weaknesses.find((w) => w.label === "Java"), undefined);
});

test("weakness map ignores skipped, unanswered and fallback answers", () => {
  const iv = interview([
    question({ skipped: true, evaluation: { ...scores(0), source: "local" } }),
    question({ answer: "", evaluation: { ...scores(0), source: "local" } }),
    question({ evaluation: fallbackEvaluation() }),
  ]);
  const map = weaknessMapForInterview(iv);
  assert.equal(map.answersConsidered, 0);
  assert.deepEqual(map.weaknesses, []);
});

test("weakness map surfaces recurring answer-structure weakness across answers", () => {
  const ev = (s: number) => ({ ...scores(80), structureScore: s, source: "local" });
  const iv = interview([1, 2, 3, 4].map((i) => question({ skill: "Python", topic: "t" + i, evaluation: ev(i < 3 ? 40 : 90) })));
  const structure = weaknessMapForInterview(iv).weaknesses.find((w) => w.label === "Answer Structure");
  assert.ok(structure);
  assert.equal(structure!.occurrences, 2);
  assert.equal(structure!.total, 4);
});

// ── personalisation ────────────────────────────────────────────────────────
const weakDbmsHistory = () => [
  interview([
    question({ skill: "DBMS", topic: "Normalization", evaluation: { ...scores(40), source: "local" } }),
    question({ skill: "DBMS", topic: "Normalization", evaluation: { ...scores(45), source: "local" } }),
    question({ skill: "Python", topic: "Lists", evaluation: { ...scores(90), source: "local" } }),
  ]),
];

test("personalisation targets weak topics for Technical interviews using real history", () => {
  const p = buildPersonalization(weakDbmsHistory(), "Technical");
  assert.equal(p.hasHistory, true);
  assert.equal(p.focusAreas.length, 1);
  assert.deepEqual({ skill: p.focusAreas[0].skill, topic: p.focusAreas[0].topic }, { skill: "DBMS", topic: "Normalization" });
  assert.match(p.message, /difficulty with DBMS: Normalization/);
  assert.match(p.focusAreas[0].reason, /2 of 2/);
});

test("a single weak answer in a topic is not 'repeated struggle' - no tailoring", () => {
  const once = [interview([question({ skill: "DBMS", topic: "Normalization", evaluation: { ...scores(30), source: "local" } })])];
  const p = buildPersonalization(once, "Technical");
  assert.equal(p.hasHistory, true);
  assert.equal(p.focusAreas.length, 0);
  assert.equal(p.message, "");
});

test("weakness repeated across separate interviews counts", () => {
  const one = () => interview([question({ skill: "DBMS", topic: "ACID", evaluation: { ...scores(35), source: "local" } })]);
  const p = buildPersonalization([one(), one()], "Technical");
  assert.equal(p.focusAreas[0]?.skill, "DBMS");
  assert.equal(p.basedOnInterviews, 2);
});

test("personalisation makes no tailoring claim when nothing can be targeted (HR) or no history exists", () => {
  assert.equal(buildPersonalization(weakDbmsHistory(), "HR").focusAreas.length, 0);
  assert.equal(buildPersonalization(weakDbmsHistory(), "HR").message, "");
  const none = buildPersonalization([], "Technical");
  assert.equal(none.hasHistory, false);
  assert.equal(none.message, "");
});

test("personalisation ignores college interviews", () => {
  const college = weakDbmsHistory().map((iv) => ({ ...iv, source: "COLLEGE" }));
  assert.equal(buildPersonalization(college, "Technical").hasHistory, false);
});

test("weak project explanations: Resume interviews get project depth; others get a suggestion, not a false claim", () => {
  const weakProject = [
    interview([
      question({ skill: "Project", topic: "Shop", evaluation: { ...scores(40), source: "local" } }),
      question({ skill: "Project", topic: "Blog", evaluation: { ...scores(50), source: "local" } }),
    ]),
  ];
  const resume = buildPersonalization(weakProject, "Resume");
  assert.ok(resume.focusAreas.some((f) => f.skill === "Project"));
  assert.match(resume.message, /project-depth questions/);
  const technical = buildPersonalization(weakProject, "Technical");
  assert.equal(technical.focusAreas.length, 0);
  assert.equal(technical.message, "");
  assert.match(technical.suggestions[0], /Resume-based interview/);
});

test("non-question weaknesses become coaching, never claimed as applied to questions", () => {
  const ev = (s: number) => ({ ...scores(80), structureScore: s, source: "local" });
  const history = [interview([1, 2, 3].map((i) => question({ skill: "Python", topic: "t" + i, evaluation: ev(30) })))];
  const p = buildPersonalization(history, "Technical");
  assert.ok(p.coaching.some((c) => c.label === "Answer Structure"));
  assert.equal(p.focusAreas.length, 0);
});

// ── progress ───────────────────────────────────────────────────────────────
test("progress is chronological with per-metric improvement only where both ends exist", () => {
  const mk = (date: string, t: number, structure?: number) =>
    interview([question({ evaluation: { ...scores(t), ...(structure !== undefined ? { structureScore: structure } : {}), source: "local" } })], {
      completedAt: new Date(date),
      createdAt: new Date(date),
      overallScore: t,
    });
  const { points, improvement } = buildProgress([mk("2026-03-01", 76, 70), mk("2026-01-01", 61), mk("2026-02-01", 68)]);
  assert.deepEqual(points.map((p) => p.metrics.technical), [61, 68, 76]);
  const tech = improvement.find((i) => i.key === "technical")!;
  assert.equal(tech.delta, 15);
  // structure exists on one interview only -> no fabricated trend
  assert.equal(improvement.find((i) => i.key === "structure"), undefined);
});

test("progress with a single interview reports no improvement", () => {
  const { points, improvement } = buildProgress([interview([question()])]);
  assert.equal(points.length, 1);
  assert.deepEqual(improvement, []);
});

// ── proctoring ─────────────────────────────────────────────────────────────
test("proctoring summary states only recorded facts and discloses what is not stored", () => {
  const clean = buildProctoringSummary(interview([], { tabSwitchCount: 0, fullScreenExitCount: 0 }), []);
  assert.ok(clean.items.every((i) => i.status === "ok"));
  assert.ok(!clean.items.some((i) => /phone/i.test(i.label)));
  assert.match(clean.note, /not stored/);

  const noisy = buildProctoringSummary(
    interview([], { tabSwitchCount: 2, fullScreenExitCount: 3, autoTerminated: true, terminationReason: "FULLSCREEN_EXIT_LIMIT_EXCEEDED" }),
    [{ type: "copy" }, { type: "copy" }, { type: "tab_switch" }]
  );
  assert.ok(noisy.items.some((i) => i.label === "2 tab switches" && i.status === "warn"));
  assert.ok(noisy.items.some((i) => i.label === "3 full-screen exits" && i.status === "bad"));
  assert.ok(noisy.items.some((i) => i.label === "2 × copy"));
  assert.ok(noisy.items.some((i) => i.status === "bad" && /ended automatically/.test(i.label)));
});
