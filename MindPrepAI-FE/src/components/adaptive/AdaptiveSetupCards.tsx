import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { getAptitudePlan, getTechPlan, startAdaptiveAptitude, startAdaptiveTech } from "../../services/adaptiveApi";
import type { Plan } from "../../services/adaptiveApi";
import { PlanCard } from "./AdaptiveUI";
import { labelCls, selectCls } from "../module/styles";
const DIFFS = [
  { v: "adaptive", l: "Adaptive (from my history)" },
  { v: "easy", l: "Start at Easy" },
  { v: "medium", l: "Start at Medium" },
  { v: "hard", l: "Start at Hard" },
];
const TIME_LIMITS = [0, 10, 20, 30];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>;
}

/** "AI Adaptive Practice" configuration for Aptitude (category -> difficulty -> count -> time limit). A session
 *  mixes all topics of the chosen category; topics are not offered individually. */
export function AdaptiveAptitudeCard() {
  const navigate = useNavigate();
  const categories = ["Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation"];
  const [category, setCategory] = useState("Quantitative");
  const topic = ""; // whole category, mixed topics
  const [difficulty, setDifficulty] = useState("adaptive");
  const [count, setCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAptitudePlan(category, topic).then((p) => !cancelled && setPlan(p)).catch(() => !cancelled && setPlan(null));
    return () => { cancelled = true; };
  }, [category, topic]);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const { attemptId } = await startAdaptiveAptitude({ category, topic, difficulty, count, timeLimitMinutes: timeLimit });
      navigate(`/aptitude/adaptive/${attemptId}`);
    } catch (e) {
      setError(isAxiosError(e) ? e.response?.data?.message || "Could not start the session." : "Could not start the session.");
      setBusy(false);
    }
  };

  return (
    <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Category">
            <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Difficulty">
            <select className={selectCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFFS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
            </select>
          </Field>
          <Field label="Questions">
            <select className={selectCls} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Time limit">
            <select className={selectCls} value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}>
              {TIME_LIMITS.map((n) => <option key={n} value={n}>{n ? `${n} min` : "None"}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4"><PlanCard plan={plan} /></div>
        {error && <p className="text-red-600 dark:text-red-400 text-sm mt-3">{error}</p>}
        <button onClick={start} disabled={busy}
          className="mt-5 w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-colors disabled:opacity-50">
          {busy ? "Starting…" : `Start adaptive ${category} session →`}
        </button>
    </div>
  );
}

const TECH_TYPES = [
  { v: "mixed", l: "Mixed types" },
  { v: "mcq", l: "MCQ" },
  { v: "conceptual", l: "Conceptual" },
  { v: "output_prediction", l: "Output prediction" },
  { v: "debugging", l: "Debugging" },
  { v: "coding", l: "Coding" },
];

/** Adaptive configuration for Tech Practice (technology is chosen in the page above). */
export function AdaptiveTechCard({ technology, topics }: { technology: string; topics: string[] }) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [questionType, setQuestionType] = useState("mixed");
  const [difficulty, setDifficulty] = useState("adaptive");
  const [count, setCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setTopic(""); }, [technology]);
  useEffect(() => {
    let cancelled = false;
    getTechPlan(technology, topic).then((p) => !cancelled && setPlan(p)).catch(() => !cancelled && setPlan(null));
    return () => { cancelled = true; };
  }, [technology, topic]);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const { attemptId } = await startAdaptiveTech({ technology, topic, questionType, difficulty, count, timeLimitMinutes: timeLimit, availableTopics: topics });
      navigate(`/tech-practice/adaptive/${attemptId}`);
    } catch (e) {
      setError(isAxiosError(e) ? e.response?.data?.message || "Could not start the session." : "Could not start the session.");
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Field label="Topic">
          <select className={selectCls} value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">All topics</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Question type">
          <select className={selectCls} value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
            {TECH_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </Field>
        <Field label="Difficulty">
          <select className={selectCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
        </Field>
        <Field label="Questions">
          <select className={selectCls} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Time limit">
          <select className={selectCls} value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}>
            {TIME_LIMITS.map((n) => <option key={n} value={n}>{n ? `${n} min` : "None"}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4"><PlanCard plan={plan} /></div>
      {error && <p className="text-red-600 dark:text-red-400 text-sm mt-3">{error}</p>}
      <button onClick={start} disabled={busy}
        className="mt-5 w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
        {busy ? "Starting…" : `Start adaptive ${technology} session →`}
      </button>
    </div>
  );
}
