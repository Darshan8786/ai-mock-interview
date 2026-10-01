import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { getTechnologies, startTechQuiz } from "../services/techQuizApi";
import type { TechnologyMeta } from "../services/techQuizApi";
import { AdaptiveTechCard } from "../components/adaptive/AdaptiveSetupCards";
import { Chip, ModuleHero, Panel, Segmented } from "../components/module/ModuleKit";
import { labelCls } from "../components/module/styles";
import { FloatingCard } from "../components/3d/FloatingCard";

// Technology -> file extension, shown on the picker tiles.
const TECH_FILES: Record<string, string> = {
  Python: ".py", Java: ".java", SQL: ".sql", "C++": ".cpp", C: ".c",
  HTML: ".html", CSS: ".css", JavaScript: ".js", React: ".jsx", "Node.js": ".mjs",
};

const DIFFICULTIES = ["Mixed", "Easy", "Medium", "Hard"];
const COUNTS = [5, 10, 20];

export function TechQuizSetup() {
  const navigate = useNavigate();
  const [technologies, setTechnologies] = useState<Record<string, TechnologyMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const [technology, setTechnology] = useState("Python");
  const [difficulty, setDifficulty] = useState("Mixed");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<"adaptive" | "classic">("adaptive");

  useEffect(() => {
    getTechnologies()
      .then((data) => {
        setTechnologies(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load the local question dataset. Make sure the ai-service and backend are running.");
        setLoading(false);
      });
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setError("");
    try {
      const result = await startTechQuiz({ technology, difficulty, totalQuestions: count });
      navigate("/tech-practice/quiz", { state: { result } });
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || "Could not start the quiz. Please try again.");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const meta = technologies[technology];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <ModuleHero
        kind="tech"
        kicker="// practice/tech"
        title="Tech Practice"
        description="Verified, locally trained questions for each technology: MCQ, conceptual, output prediction, debugging and coding. No external AI is used to generate or grade them."
        stats={[
          { label: "technologies", value: Object.keys(TECH_FILES).length },
          { label: "topics", value: meta?.topics.length ?? "—" },
          { label: "q types", value: meta ? Object.keys(meta.by_question_type || {}).length : "—" },
        ]}
      />

      {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-sm">{error}</div>}

      <Panel kicker="// select(technology)" title="Choose a technology">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(TECH_FILES).map(([tech, ext]) => {
            const active = technology === tech;
            return (
              <FloatingCard key={tech} intensity={7}>
                <button
                  onClick={() => setTechnology(tech)}
                  aria-pressed={active}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    active ? "bg-accent-soft border-accent/40" : "bg-surface-2/60 border-line hover:border-accent/40"
                  }`}
                >
                  <span className={`font-mono text-lg font-semibold ${active ? "text-accent-fg" : "text-subtle"}`}>{ext}</span>
                  <span className={`block mt-1 text-sm font-semibold ${active ? "text-accent-fg" : "text-fg"}`}>{tech}</span>
                </button>
              </FloatingCard>
            );
          })}
        </div>
      </Panel>

      <Panel className="mt-6" kicker={`// ${TECH_FILES[technology] ?? ""} session`} title={`Practise ${technology}`}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "adaptive", label: "AI adaptive session", hint: "One question at a time; difficulty and topics adapt to you" },
            { value: "classic", label: "Classic quiz", hint: "A fixed set of verified questions, scored at the end" },
          ]}
        />

        <div className="mt-6">
          {mode === "adaptive" ? (
            <AdaptiveTechCard technology={technology} topics={meta?.topics || []} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className={labelCls}>difficulty</p>
                  <div className="flex flex-wrap gap-2">
                    {DIFFICULTIES.map((d) => (
                      <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
                        {d}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={labelCls}>questions</p>
                  <div className="flex flex-wrap gap-2">
                    {COUNTS.map((c) => (
                      <Chip key={c} active={count === c} onClick={() => setCount(c)}>
                        {c}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              {meta && (
                <div className="mt-6 rounded-xl bg-surface-2/60 border border-line p-4">
                  <p className={labelCls}>// topics covered</p>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.topics.map((t) => (
                      <span key={t} className="text-[11px] px-2 py-1 rounded-md bg-surface border border-line text-fg-2">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleStart}
                disabled={starting}
                className="mt-6 w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                {starting ? "Preparing questions…" : `Start ${technology} quiz →`}
              </button>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
