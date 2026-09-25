import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BACKEND_URL } from "../config/config";

interface CollegeInterviewCard {
  id: string;
  name: string;
  jobRole: string;
  interviewType: string;
  programmingLanguage: string;
  difficulty: string;
  description: string;
  questionCount: number;
  timeLimit: number;
  collegeName: string;
  attempt: { status: "in-progress" | "completed" | "terminated" | "pending"; sessionId: string } | null;
}

interface Payload {
  college: { id: string; name: string } | null;
  interviews: CollegeInterviewCard[];
}

const api = async (path: string, init: RequestInit = {}) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) throw new Error(body?.message || `Request failed: ${res.status}`);
  return body;
};

/**
 * "College Interviews" on the interview dashboard: interviews your college has
 * published. Starting one opens the EXISTING interview room with source "COLLEGE".
 */
export function CollegeInterviewsSection() {
  const navigate = useNavigate();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [colleges, setColleges] = useState<{ _id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState("");
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData((await api("/mock-interview/college-interviews")).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load college interviews");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Only fetch the college list when the student actually has to pick one.
  useEffect(() => {
    if (data && !data.college && colleges.length === 0) {
      api("/colleges")
        .then((r) => setColleges(r.data))
        .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load colleges"));
    }
  }, [data, colleges.length]);

  const join = async () => {
    if (!chosen) return;
    setJoining(true);
    setError(null);
    try {
      await api("/colleges/me", { method: "PUT", body: JSON.stringify({ collegeId: chosen }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set your college");
    } finally {
      setJoining(false);
    }
  };

  const start = (i: CollegeInterviewCard) =>
    navigate("/mock-interview/room", {
      state: {
        source: "COLLEGE",
        collegeInterviewId: i.id,
        name: i.name,
        collegeName: i.collegeName,
        description: i.description,
        jobRole: i.jobRole,
        interviewType: i.interviewType,
        difficulty: i.difficulty,
        programmingLanguage: i.programmingLanguage,
        totalQuestions: i.questionCount,
        timeLimitMinutes: i.timeLimit,
      },
    });

  const box = "bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8";

  if (!data && !error) {
    return <div className={`${box} text-gray-400 text-sm`}>Loading college interviews…</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={box}>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-white">College Interviews</h2>
        {data?.college && <span className="text-xs text-gray-400">{data.college.name}</span>}
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {data && !data.college && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            Choose your college to see the interviews it has prepared for you. You can only do this once — pick carefully.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select your college…</option>
              {colleges.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={join}
              disabled={!chosen || joining}
              className="px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-50"
            >
              {joining ? "Saving…" : "Confirm college"}
            </button>
          </div>
          {colleges.length === 0 && <p className="text-xs text-gray-500">No colleges are available yet.</p>}
        </div>
      )}

      {data?.college && data.interviews.length === 0 && (
        <p className="text-sm text-gray-400">No interviews have been published for your college yet. Check back later.</p>
      )}

      {data?.interviews.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.interviews.map((i) => {
            const st = i.attempt?.status;
            const finished = st === "completed" || st === "terminated";
            return (
              <div key={i.id} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 flex flex-col">
                <h3 className="text-white font-semibold text-lg leading-snug">{i.name}</h3>
                <p className="text-sm text-gray-400 mb-3">{i.collegeName}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
                  <dt className="text-gray-500">Role</dt><dd className="text-gray-200">{i.jobRole}</dd>
                  <dt className="text-gray-500">Type</dt><dd className="text-gray-200">{i.interviewType}</dd>
                  {i.programmingLanguage !== "None" && (<><dt className="text-gray-500">Language</dt><dd className="text-gray-200">{i.programmingLanguage}</dd></>)}
                  <dt className="text-gray-500">Questions</dt><dd className="text-gray-200">{i.questionCount}</dd>
                  <dt className="text-gray-500">Duration</dt><dd className="text-gray-200">{i.timeLimit} minutes</dd>
                </dl>
                <div className="mt-auto">
                  {finished ? (
                    <button
                      onClick={() => navigate(`/mock-interview/result/${i.attempt!.sessionId}`)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-500 transition-all"
                    >
                      {st === "terminated" ? "Terminated — View result" : "Completed — View result"}
                    </button>
                  ) : (
                    <button
                      onClick={() => start(i)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                    >
                      {st === "in-progress" ? "Resume Interview" : "Start Interview"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </motion.div>
  );
}
