import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { isAxiosError } from "axios";
import { getTechnologies, startTechQuiz } from "../services/techQuizApi";
import type { TechnologyMeta } from "../services/techQuizApi";

const TECH_ICONS: Record<string, string> = {
  Python: "🐍", Java: "☕", SQL: "🗄️", "C++": "➕", C: "🔧",
  HTML: "📄", CSS: "🎨", JavaScript: "📜", React: "⚛️", "Node.js": "🟢",
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
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const meta = technologies[technology];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-1">Technical Practice</h1>
        <p className="text-gray-400 text-sm mb-8">
          Verified, locally-trained questions per technology — MCQ, coding, output prediction, debugging, and more. No external AI is used to generate or grade these.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm mb-6">{error}</div>
        )}

        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Technology</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.keys(TECH_ICONS).map((tech) => {
              const active = technology === tech;
              return (
                <button
                  key={tech}
                  onClick={() => setTechnology(tech)}
                  className={`rounded-xl p-4 border text-center transition-all ${
                    active
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                      : "bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <div className="text-2xl mb-1">{TECH_ICONS[tech]}</div>
                  <div className="text-sm font-medium">{tech}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Difficulty</h3>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    difficulty === d
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                      : "bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Number of Questions</h3>
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCount(c)}
                  className={`px-5 py-2 rounded-xl text-sm font-medium border transition-all ${
                    count === c
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                      : "bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {meta && (
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 mb-8">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              {technology} topics covered
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {meta.topics.map((t) => (
                <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-gray-700/60 text-gray-300">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
        >
          {starting ? "Preparing questions…" : `Start ${technology} Practice →`}
        </button>
      </motion.div>
    </div>
  );
}
