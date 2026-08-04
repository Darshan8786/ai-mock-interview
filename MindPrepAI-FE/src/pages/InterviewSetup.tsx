import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const jobRoles = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Cloud Architect",
  "Product Manager",
  "UI/UX Designer",
  "QA Engineer",
  "Security Engineer",
];

const experienceLevels = [
  { value: "fresher", label: "Fresher (0-1 yrs)" },
  { value: "junior", label: "Junior (1-3 yrs)" },
  { value: "mid", label: "Mid-Level (3-5 yrs)" },
  { value: "senior", label: "Senior (5-8 yrs)" },
  { value: "lead", label: "Lead (8+ yrs)" },
];

const interviewTypes = [
  { value: "Technical", label: "Technical", icon: "⚙️", desc: "Focus on technical skills and problem-solving" },
  { value: "HR", label: "HR", icon: "👥", desc: "Behavioral and cultural fit assessment" },
  { value: "Behavioral", label: "Behavioral", icon: "🧠", desc: "Soft skills and situational responses" },
];

const difficulties = [
  { value: "Easy", label: "Easy", color: "emerald" },
  { value: "Medium", label: "Medium", color: "amber" },
  { value: "Hard", label: "Hard", color: "red" },
];

export function InterviewSetup() {
  const navigate = useNavigate();
  const [jobRole, setJobRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [interviewType, setInterviewType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRoles = jobRoles.filter((r) =>
    r.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canStart = jobRole && experienceLevel && interviewType && difficulty;

  const handleStart = () => {
    if (!canStart) return;
    navigate("/mock-interview/room", {
      state: { jobRole, experienceLevel, interviewType, difficulty, totalQuestions },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent"
          >
            AI Mock Interview
          </motion.h1>
          <p className="text-gray-400 mt-3 text-lg">
            Practice with AI-powered interviews. Get real-time feedback and detailed reports.
          </p>
        </div>

        <div className="grid gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Job Role
            </label>
            <input
              type="text"
              placeholder="Search or type a role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors mb-3"
            />
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {filteredRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => { setJobRole(role); setSearchTerm(""); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    jobRole === role
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                      : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Experience Level
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {experienceLevels.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setExperienceLevel(level.value)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    experienceLevel === level.value
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                      : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Interview Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {interviewTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setInterviewType(type.value)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    interviewType === type.value
                      ? "bg-violet-500/20 border border-violet-500/50"
                      : "bg-gray-700/50 border border-gray-600 hover:border-gray-500"
                  }`}
                >
                  <span className="text-2xl">{type.icon}</span>
                  <p className={`font-semibold mt-1 ${
                    interviewType === type.value ? "text-violet-400" : "text-gray-200"
                  }`}>
                    {type.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{type.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Difficulty Level
            </label>
            <div className="flex gap-3">
              {difficulties.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                    difficulty === d.value
                      ? `bg-${d.color}-500/20 text-${d.color}-400 border border-${d.color}-500/50`
                      : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Number of Questions: <span className="text-emerald-400 font-bold">{totalQuestions}</span>
            </label>
            <input
              type="range"
              min={3}
              max={15}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>3</span>
              <span>15</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`px-10 py-4 rounded-2xl text-lg font-bold transition-all ${
                canStart
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              {canStart ? "Start Interview →" : "Complete All Fields"}
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
