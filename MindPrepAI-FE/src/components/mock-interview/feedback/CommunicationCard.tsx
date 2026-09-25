import type { AttemptView, CommunicationAnalysis } from "../../../types/mockFeedback";
import { fmtDuration } from "./format";

const NA = <span className="text-gray-500">Not available</span>;

/** Speaking / delivery analysis. Any metric that could not be measured says so instead of guessing. */
export function CommunicationCard({ comm, answerType }: { comm: CommunicationAnalysis; answerType: AttemptView["answerType"] }) {
  const rows: Array<{ label: string; value: React.ReactNode; hint?: string }> = [
    {
      label: comm.durationSource === "recording" ? "Speaking duration" : "Time on question",
      value: comm.durationSeconds !== null ? fmtDuration(comm.durationSeconds) : NA,
      hint: comm.durationSource === "time_on_question" ? "includes thinking time" : undefined,
    },
    { label: "Words", value: comm.wordCount },
    { label: "Filler words", value: comm.fillerWords.count, hint: comm.fillerWords.items.slice(0, 3).map((i) => `${i.word} ×${i.count}`).join(", ") || undefined },
    { label: "Repeated phrases", value: comm.repeatedPhrases.count, hint: comm.repeatedPhrases.items.slice(0, 2).join(", ") || undefined },
    {
      label: `Long pauses (${comm.longPauses?.thresholdSeconds ?? 2}s+)`,
      value: comm.longPauses ? comm.longPauses.count : NA,
      hint: answerType === "text" ? "typed answer" : undefined,
    },
    {
      label: "Speaking rate",
      value: comm.speakingRate ? `${comm.speakingRate.label} · ${comm.speakingRate.wpm} wpm` : NA,
      hint: answerType === "text" ? "typed answer" : undefined,
    },
  ];

  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-700 p-4">
      <h5 className="text-sm font-semibold text-white mb-3">Speaking Analysis</h5>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">{r.label}</dt>
            <dd className="text-sm font-semibold text-white mt-0.5">{r.value}</dd>
            {r.hint && <dd className="text-[11px] text-gray-500">{r.hint}</dd>}
          </div>
        ))}
      </dl>
      <div className={`mt-3 rounded-lg px-3 py-2 border ${comm.flagged ? "bg-yellow-500/10 border-yellow-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
        <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-0.5">Feedback</p>
        <p className={`text-sm leading-relaxed ${comm.flagged ? "text-yellow-100" : "text-emerald-100"}`}>“{comm.feedback}”</p>
      </div>
      {comm.notes.map((n, i) => (
        <p key={i} className="mt-2 text-[11px] text-gray-500">{n}</p>
      ))}
    </div>
  );
}
