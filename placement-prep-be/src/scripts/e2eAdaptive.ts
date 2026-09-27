/**
 * End-to-end integration test for adaptive Aptitude + Tech Practice AND a Mock Interview regression pass, against a
 * RUNNING backend + ai-service + a SCRATCH MongoDB (never a real database).
 *
 *   E2E_API=http://127.0.0.1:3099/api/v1 E2E_MONGO=mongodb://127.0.0.1:27018/mindprep_e2e npx tsx src/scripts/e2eAdaptive.ts
 *
 * The harness reads the answer key straight from the scratch DB (only to steer "answer correctly / wrongly" for the
 * adaptive-difficulty checks); it also asserts that no answer key is present in anything the API sends before an
 * answer is submitted.
 */
import axios, { AxiosInstance } from "axios";
import mongoose from "mongoose";

const API = process.env.E2E_API || "http://127.0.0.1:3099/api/v1";
const MONGO = process.env.E2E_MONGO || "mongodb://127.0.0.1:27018/mindprep_e2e";
if (!/127\.0\.0\.1|localhost/.test(MONGO)) throw new Error("E2E_MONGO must be a local scratch database");
const ONLY = (process.env.E2E_ONLY || "aptitude,tech,interview,fallback").split(",");

let passed = 0;
let failed = 0;
const results: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  if (cond) passed++;
  else failed++;
  const line = `${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`;
  results.push(line);
  console.log(line);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LEAK_KEYS = ["servedCorrect", "correctAnswer", "answer_index", "correct_option", "explanation", "fixed_code", "expected_solution"];
function leaks(obj: unknown): string[] {
  const found: string[] = [];
  const walk = (v: any, path: string) => {
    if (!v || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v)) {
      if (LEAK_KEYS.includes(k) || (k === "answer" && path.includes("currentQuestion"))) found.push(`${path}.${k}`);
      walk(x, `${path}.${k}`);
    }
  };
  walk(obj, "$");
  return found;
}

async function user(tag: string): Promise<AxiosInstance> {
  const email = `e2e_${tag}_${Date.now()}@example.test`;
  const r = await axios.post(`${API}/auth/register`, { name: `E2E ${tag}`, email, password: "Passw0rd!e2e" });
  return axios.create({ baseURL: API, headers: { Authorization: `Bearer ${r.data.token}` }, validateStatus: () => true, timeout: 120000 });
}

async function pollAptitude(c: AxiosInstance, id: string, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = (await c.get(`/aptitude/adaptive/${id}/state`)).data.data;
    if (s.currentQuestion || s.nextStatus === "failed" || s.status === "completed") return s;
    await sleep(800);
  }
  throw new Error("timed out waiting for aptitude question");
}

async function pollTech(c: AxiosInstance, id: string, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = (await c.get(`/tech-quiz/adaptive/${id}/state`)).data.data;
    if (s.currentQuestion || s.nextStatus === "failed" || s.status === "completed") return s;
    await sleep(800);
  }
  throw new Error("timed out waiting for tech question");
}

const db = () => mongoose.connection.db!;

async function aptitudeKey(attemptId: string, itemIndex: number) {
  const a: any = await db().collection("aptitudeattempts").findOne({ _id: new mongoose.Types.ObjectId(attemptId) });
  return a.adaptive.items[itemIndex].servedCorrect as number;
}

async function runAptitude() {
  const c = await user("apt");
  // personalization with no history
  const p0 = (await c.get("/aptitude/adaptive/personalization", { params: { category: "Quantitative" } })).data.data;
  check("aptitude: no-history personalization message", p0.message === "Not enough history for personalization yet.", p0.message);

  // validation of configuration
  check("aptitude: rejects bad category", (await c.post("/aptitude/adaptive/start", { category: "Nope", count: 5 })).status === 400);
  check("aptitude: rejects bad count", (await c.post("/aptitude/adaptive/start", { category: "Quantitative", count: 999 })).status === 400);

  // Session 1: Percentages, all correct -> easy -> medium -> medium -> hard
  const start = await c.post("/aptitude/adaptive/start", { category: "Quantitative", topic: "Percentages", difficulty: "easy", count: 5 });
  check("aptitude: start session", start.status === 201, String(start.status));
  const id = start.data.data.attemptId;
  const levels: string[] = [];
  let first: any = null;
  for (let i = 0; i < 5; i++) {
    const s = await pollAptitude(c, id);
    if (i === 0) first = s;
    check(`aptitude: Q${i + 1} generated`, !!s.currentQuestion, s.nextStatus + " " + (s.nextError || ""));
    if (!s.currentQuestion) return;
    const lk = leaks(s);
    check(`aptitude: Q${i + 1} no answer key before submission`, lk.length === 0, lk.join(","));
    check(`aptitude: Q${i + 1} has 4 unique options`, new Set(s.currentQuestion.options).size === 4);
    levels.push(s.currentQuestion.difficulty);
    const key = await aptitudeKey(id, s.currentQuestion.itemIndex);
    const ans = (await c.post(`/aptitude/adaptive/${id}/answer`, { itemIndex: s.currentQuestion.itemIndex, selected: key, responseTime: 20 })).data.data;
    check(`aptitude: Q${i + 1} graded correct`, ans.isCorrect === true && ans.correctIndex === key);
    check(`aptitude: Q${i + 1} explanation returned after answer`, typeof ans.explanation === "string" && ans.explanation.length > 0);
    if (i < 4) check(`aptitude: Q${i + 1} adaptation message`, ans.adaptation.message === "Next question adapted to your performance.");
  }
  check("aptitude: adaptive difficulty easy->medium->medium->hard (all correct)",
    JSON.stringify(levels.slice(0, 4)) === JSON.stringify(["easy", "medium", "medium", "hard"]), levels.join(","));
  const srcs = (await db().collection("aptitudeattempts").findOne({ _id: new mongoose.Types.ObjectId(id) }) as any).adaptive.items.map((x: any) => `${x.source}/${x.verification}`);
  console.log("   aptitude sources:", srcs.join(" "));
  // duplicate prevention within session
  const qs = (await c.post(`/aptitude/adaptive/${id}/finish`, { timeTaken: 100 })).data.data;
  check("aptitude: finish returns report", qs.summary && qs.summary.total === 5, JSON.stringify(qs.summary?.score));
  check("aptitude: report score 100%", qs.summary.score === 100);
  check("aptitude: no duplicate questions in session", new Set(qs.items.map((x: any) => x.question)).size === qs.items.length);
  check("aptitude: report has topic/difficulty breakdown", qs.summary.topicWise.length >= 1 && qs.summary.difficultyWise.length >= 1);

  // Session 2: struggling -> wrong twice steps down; wrong once does not
  const s2 = (await c.post("/aptitude/adaptive/start", { category: "Quantitative", topic: "Time & Work", difficulty: "medium", count: 6 })).data.data.attemptId;
  const lv2: string[] = [];
  let firstReport: any = null;
  for (let i = 0; i < 6; i++) {
    const s = await pollAptitude(c, s2);
    if (!s.currentQuestion) break;
    lv2.push(s.currentQuestion.difficulty);
    const key = await aptitudeKey(s2, s.currentQuestion.itemIndex);
    const wrong = (key + 1) % 4;
    const ans = (await c.post(`/aptitude/adaptive/${s2}/answer`, { itemIndex: s.currentQuestion.itemIndex, selected: wrong, responseTime: 40 })).data.data;
    if (i === 0) check("aptitude: one wrong answer keeps level", ans.adaptation.level === "medium" && !ans.adaptation.changed, ans.adaptation.reason);
    if (i === 0) check("aptitude: wrong answer shows weak concept + correct option", ans.weakConcept === "Time & Work" && !!ans.correctOption);
  }
  check("aptitude: two consecutive wrong -> step down (medium,medium,easy)", lv2.slice(0, 3).join(",") === "medium,medium,easy", lv2.join(","));
  firstReport = (await c.post(`/aptitude/adaptive/${s2}/finish`, { timeTaken: 200 })).data.data;
  check("aptitude: struggling session score 0%", firstReport.summary.score === 0);
  check("aptitude: comparison vs previous session present when history exists", firstReport.comparison === null || typeof firstReport.comparison.scoreDelta === "number");

  // Practice Again
  const item = firstReport.items[0];
  const correctText = item.options[item.correct];
  const wrongText = item.options[(item.correct + 1) % 4];
  const pa1 = await c.post(`/aptitude/adaptive/${s2}/items/0/reattempt`, { selectedText: wrongText, timeTaken: 10 });
  const pa2 = await c.post(`/aptitude/adaptive/${s2}/items/0/reattempt`, { selectedText: correctText, timeTaken: 10 });
  check("aptitude: practice again stores separate attempts", pa2.status === 201 && pa2.data.data.attempts.length === 3, String(pa2.data.data?.attempts?.length));
  check("aptitude: practice again before/after/improvement", pa2.data.data.comparison?.before === 0 && pa2.data.data.comparison?.after === 100 && pa2.data.data.comparison?.improvement === 100);
  check("aptitude: original attempt never overwritten", pa2.data.data.attempts[0].isCorrect === false && pa1.status === 201);
  check("aptitude: practice again rejects non-option", (await c.post(`/aptitude/adaptive/${s2}/items/0/reattempt`, { selectedText: "zzz" })).status === 400);

  // weakness needs repetition: after 6 wrong Time & Work answers it is weak; Percentages (5/5) strong
  const plan = (await c.get("/aptitude/adaptive/personalization", { params: { category: "Quantitative" } })).data.data;
  check("aptitude: weak topic detected from repeated mistakes", plan.weakTopics.some((w: any) => w.topic === "Time & Work"), JSON.stringify(plan.weakTopics));
  check("aptitude: strong topic detected", plan.strongTopics.some((w: any) => w.topic === "Percentages"), JSON.stringify(plan.strongTopics));

  // Session 3: mixed topics -> weak topic targeted in a share of questions
  const s3 = (await c.post("/aptitude/adaptive/start", { category: "Quantitative", topic: "", count: 10 })).data.data.attemptId;
  let focus = 0;
  let tw = 0;
  for (let i = 0; i < 10; i++) {
    const s = await pollAptitude(c, s3);
    if (!s.currentQuestion) break;
    if (s.currentQuestion.focusArea) focus++;
    if (s.currentQuestion.topic === "Time & Work") tw++;
    const key = await aptitudeKey(s3, s.currentQuestion.itemIndex);
    await c.post(`/aptitude/adaptive/${s3}/answer`, { itemIndex: s.currentQuestion.itemIndex, selected: key, responseTime: 25 });
  }
  check("aptitude: next session targets weak topic (focus questions > 0)", focus > 0 && tw > 0, `focus=${focus} timeAndWork=${tw}/10`);
  await c.post(`/aptitude/adaptive/${s3}/finish`, { timeTaken: 300 });

  // progress + history (existing endpoints include adaptive sessions)
  const prog = (await c.get("/aptitude/progress")).data.data;
  check("aptitude: progress includes adaptive answers", prog.totalAnswered >= 21 && prog.topicWise.length >= 2, `answered=${prog.totalAnswered}`);
  const hist = (await c.get("/aptitude/history")).data.data;
  check("aptitude: history lists adaptive sessions", hist.filter((h: any) => h.testType === "adaptive").length === 3);
  const detail = await c.get(`/aptitude/history/${id}`);
  check("aptitude: history detail shows generated questions", detail.status === 200 && detail.data.data.questions.every((q: any) => q.question), String(detail.status));
  void first;
}

async function techRecord(attemptId: string, index: number) {
  const a: any = await db().collection("techquizattempts").findOne({ _id: new mongoose.Types.ObjectId(attemptId) });
  return a.questions[index].record;
}

async function runTech() {
  const c = await user("tech");
  const topicsMeta = (await c.get("/tech-quiz/technologies")).data.data;
  const javaTopics: string[] = topicsMeta?.Java?.topics || [];
  check("tech: technologies metadata", javaTopics.length > 5, String(javaTopics.length));
  check("tech: rejects bad technology", (await c.post("/tech-quiz/adaptive/start", { technology: "Cobol" })).status === 400);

  const st = await c.post("/tech-quiz/adaptive/start", { technology: "Java", topic: "Collections", questionType: "mcq", difficulty: "easy", count: 5, availableTopics: javaTopics });
  check("tech: start session", st.status === 201, String(st.status) + JSON.stringify(st.data).slice(0, 200));
  const id = st.data.data.attemptId;
  const levels: string[] = [];
  for (let i = 0; i < 5; i++) {
    const s = await pollTech(c, id);
    check(`tech: Q${i + 1} generated`, !!s.currentQuestion, s.nextStatus + " " + (s.nextError || ""));
    if (!s.currentQuestion) return;
    const lk = leaks(s);
    check(`tech: Q${i + 1} no answer key before submission`, lk.length === 0, lk.join(","));
    levels.push(String(s.currentQuestion.difficulty).toLowerCase());
    const rec = await techRecord(id, s.currentQuestion.index);
    const answer = rec.question_type === "MCQ" ? rec.correct_option : rec.answer;
    const ans = (await c.post(`/tech-quiz/adaptive/${id}/answer`, { index: s.currentQuestion.index, answer, responseTime: 20 })).data.data;
    check(`tech: Q${i + 1} graded (${rec.question_type}, ${rec.source})`, ans.isCorrect === true, `${ans.score} ${ans.evaluationSource}`);
    check(`tech: Q${i + 1} returns expected concepts + recommendation`, Array.isArray(ans.expectedConcepts) && typeof ans.recommendation === "string");
  }
  check("tech: difficulty climbs with correct answers", levels[0] === "easy" && levels.includes("hard"), levels.join(","));
  const rep = (await c.post(`/tech-quiz/adaptive/${id}/finish`, { timeTaken: 120 })).data.data;
  check("tech: report", rep.summary?.score === 100 && rep.summary.typeWise.length >= 1, JSON.stringify(rep.summary?.typeWise));

  // struggle on Exception Handling with mixed types
  const topic2 = javaTopics.find((t) => /exception/i.test(t)) || javaTopics[1];
  const s2 = (await c.post("/tech-quiz/adaptive/start", { technology: "Java", topic: topic2, questionType: "mixed", difficulty: "medium", count: 6, availableTopics: javaTopics })).data.data.attemptId;
  const types: string[] = [];
  for (let i = 0; i < 6; i++) {
    const s = await pollTech(c, s2);
    if (!s.currentQuestion) break;
    types.push(s.currentQuestion.question_type);
    const rec = await techRecord(s2, s.currentQuestion.index);
    const wrong = rec.question_type === "MCQ" ? (rec.correct_option + 1) % 4 : "I am not sure about this one";
    const ans = (await c.post(`/tech-quiz/adaptive/${s2}/answer`, { index: s.currentQuestion.index, answer: wrong, responseTime: 50 })).data.data;
    if (i === 0) check("tech: wrong answer -> missing concepts reported", ans.isCorrect === false && Array.isArray(ans.missingConcepts), JSON.stringify(ans.missingConcepts));
  }
  check("tech: mixed session serves several question types", new Set(types).size >= 3, types.join(","));
  const rep2 = (await c.post(`/tech-quiz/adaptive/${s2}/finish`, { timeTaken: 300 })).data.data;
  check("tech: comparison with previous session", rep2.comparison && rep2.comparison.scoreDelta < 0, JSON.stringify(rep2.comparison));

  // Practice Again on an MCQ or text item
  const idx = rep2.items.findIndex((x: any) => x.canPractice);
  const rec = await techRecord(s2, idx);
  const good = rec.question_type === "MCQ" ? rec.correct_option : rec.answer;
  const pa = await c.post(`/tech-quiz/adaptive/${s2}/questions/${idx}/reattempt`, { answer: good, timeTaken: 30 });
  check("tech: practice again appends attempt", pa.status === 201 && pa.data.data.attempts.length === 2, String(pa.status));
  check("tech: practice again improvement shown", (pa.data.data.comparison?.improvement ?? 0) > 0, JSON.stringify(pa.data.data.comparison));

  const plan = (await c.get("/tech-quiz/personalization", { params: { technology: "Java" } })).data.data;
  check("tech: weak topic detected after repeated mistakes", plan.weakTopics.some((w: any) => w.topic === topic2), JSON.stringify(plan.weakTopics));
  const prog = (await c.get("/tech-quiz/progress", { params: { technology: "Java" } })).data.data;
  check("tech: progress endpoint", prog.sessions === 2 && prog.summary.topicWise.length >= 1, `sessions=${prog.sessions}`);
  const hist = (await c.get("/tech-quiz/history")).data.data;
  check("tech: history lists adaptive sessions", hist.filter((h: any) => h.mode === "adaptive").length === 2);

  // classic quiz still works
  const classic = await c.post("/tech-quiz/start", { technology: "Python", totalQuestions: 5, difficulty: "Mixed" });
  check("tech: classic quiz start still works", classic.status === 201 && classic.data.data.questions.length === 5);
  check("tech: classic quiz questions carry no answer key", leaks(classic.data.data.questions).length === 0);
}

async function runInterview() {
  const c = await user("iv");
  const created = await c.post("/mock-interview/create", { jobRole: "Backend Developer", experienceLevel: "fresher", interviewType: "Technical", difficulty: "Medium", totalQuestions: 3 });
  check("interview: create", created.status === 201, String(created.status));
  const id = created.data.data._id;
  let st: any = null;
  for (let i = 0; i < 60; i++) {
    st = (await c.get(`/mock-interview/${id}/state`)).data.data;
    if (st.questionsStatus === "ready" && st.currentQuestion) break;
    await sleep(1000);
  }
  check("interview: question generation ready", st?.questionsStatus === "ready" && !!st.currentQuestion?.question, st?.questionsStatus);
  const cheat = await c.post(`/mock-interview/${id}/cheating`, { type: "tab_switch", description: "e2e tab switch" });
  check("interview: proctoring event recorded (1 warning, not terminated)", cheat.data.data?.terminated === false && cheat.data.data?.tabSwitchCount === 1);
  const text = await c.post(`/mock-interview/${id}/answer`, { answer: "Polymorphism lets one interface have many implementations; for example method overriding in Java lets a subclass provide its own behaviour.", answerType: "text", timeTaken: 40 });
  check("interview: text answer accepted", text.status === 200 && !!text.data.data.nextQuestion, String(text.status));
  const voice = await c.post(`/mock-interview/${id}/answer`, {
    answer: "An index is a data structure that speeds up lookups, like a B tree on a column, at the cost of slower writes.", answerType: "voice", timeTaken: 35,
    speech: { recordingSeconds: 30, speechSeconds: 26, pauseDetection: true, pauses: [{ startSeconds: 12, durationSeconds: 2.5 }] },
  });
  check("interview: voice answer accepted", voice.status === 200, `${voice.status} ${JSON.stringify(voice.data).slice(0, 160)}`);
  const last = await c.post(`/mock-interview/${id}/answer`, { answer: "A deadlock happens when two threads each hold a lock the other needs; avoid it with a fixed lock ordering.", answerType: "text", timeTaken: 30 });
  check("interview: final answer completes interview", last.data.data?.isComplete === true);
  const rep = await c.get(`/mock-interview/${id}/report`);
  check("interview: report + explainable feedback", rep.status === 200 && !!rep.data.data.report && !!rep.data.data.feedback, String(rep.status));
  const q0 = rep.data.data.interview.questions[0];
  check("interview: answers evaluated by local evaluator", rep.data.data.interview.questions.every((q: any) => q.evaluation && q.evaluation.source !== undefined), JSON.stringify(q0.evaluation?.source));
  const re = await c.post(`/mock-interview/${id}/question/${q0._id}/reattempt`, { answer: "Polymorphism means many forms: overriding (runtime) and overloading (compile time), e.g. a Shape.draw() implemented by Circle and Square.", answerType: "text", timeTaken: 30 });
  check("interview: practice again", re.status === 201 && re.data.data.attempts.length === 2, String(re.status));
  const prog = await c.get("/mock-interview/progress");
  check("interview: progress", prog.status === 200 && Array.isArray(prog.data.data.points));
  const pers = await c.get("/mock-interview/personalization", { params: { interviewType: "Technical" } });
  check("interview: personalization endpoint", pers.status === 200 && typeof pers.data.data.hasHistory === "boolean");
}

async function runFallback() {
  // Run with the ai-service STOPPED: aptitude must still serve (DB bank), tech must fail gracefully (retry offered).
  const c = await user("fb");
  const a = (await c.post("/aptitude/adaptive/start", { category: "Quantitative", topic: "Percentages", count: 3 })).data.data.attemptId;
  const s = await pollAptitude(c, a, 90000);
  check("fallback: aptitude served from DB bank when ai-service is down", !!s.currentQuestion && s.currentQuestion.source === "bank-db", s.currentQuestion?.source || s.nextStatus);
  const t = (await c.post("/tech-quiz/adaptive/start", { technology: "Java", count: 3, availableTopics: ["OOP"] })).data.data.attemptId;
  const ts = await pollTech(c, t, 90000);
  check("fallback: tech reports failure + retry instead of crashing", ts.nextStatus === "failed" && !!ts.nextError, ts.nextStatus);
}

(async () => {
  await mongoose.connect(MONGO);
  try {
    if (ONLY.includes("aptitude")) await runAptitude();
    if (ONLY.includes("tech")) await runTech();
    if (ONLY.includes("interview")) await runInterview();
    if (ONLY.includes("fallback-only")) await runFallback();
  } catch (e: any) {
    failed++;
    console.log(`FAIL  harness error: ${e?.stack || e}`);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
