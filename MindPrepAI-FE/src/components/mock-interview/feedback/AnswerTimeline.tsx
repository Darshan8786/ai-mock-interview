import type { TimelineEvent } from "../../../types/mockFeedback";
import { fmtClock } from "./format";

const DOT: Record<TimelineEvent["kind"], { cls: string; icon: string; sr: string }> = {
  good: { cls: "bg-emerald-500", icon: "🟢", sr: "Good" },
  warn: { cls: "bg-yellow-400", icon: "🟡", sr: "Watch" },
  bad: { cls: "bg-red-500", icon: "🔴", sr: "Missing" },
};

interface Props {
  events: TimelineEvent[];
  /** Length of the recording in seconds - only when it was actually measured. */
  durationSeconds: number | null;
  durationIsRecording: boolean;
}

/**
 * Answer-quality timeline. Markers on the track sit at their real position in the transcript (fraction of
 * the words). Clock times are shown only for audio-measured pauses; we never turn word positions into
 * invented timestamps.
 */
export function AnswerTimeline({ events, durationSeconds, durationIsRecording }: Props) {
  if (events.length === 0) return null;
  const placed = events.filter((e) => e.position !== null);
  const timed = events.filter((e) => e.position === null && e.atSeconds !== null);
  const unplaced = events.filter((e) => e.position === null && e.atSeconds === null);
  const hasClock = durationIsRecording && durationSeconds !== null;

  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-700 p-4">
      <h5 className="text-sm font-semibold text-white mb-3">Answer Quality Timeline</h5>

      <div className="flex justify-between text-[11px] text-gray-500 mb-1 tabular-nums">
        <span>{hasClock ? "00:00" : "Start of answer"}</span>
        <span>{hasClock ? fmtClock(durationSeconds!) : "End of answer"}</span>
      </div>
      <div className="relative h-6 mb-4" role="img" aria-label="Positions of feedback markers along your answer">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-gray-700 rounded" />
        {placed.map((e, i) => (
          <span
            key={i}
            title={`${e.label} (${Math.round((e.position ?? 0) * 100)}% into the answer)`}
            className={`absolute top-1/2 w-3 h-3 -translate-y-1/2 -translate-x-1/2 rounded-full ring-2 ring-gray-900 ${DOT[e.kind].cls}`}
            style={{ left: `${Math.min(98, Math.max(2, (e.position ?? 0) * 100))}%` }}
          />
        ))}
      </div>

      <ul className="space-y-1.5">
        {[...placed, ...timed].map((e, i) => (
          <Row key={i} e={e} where={e.position !== null ? `${Math.round(e.position * 100)}% into answer` : `at ${fmtClock(e.atSeconds!)}`} />
        ))}
        {unplaced.map((e, i) => (
          <Row key={`u${i}`} e={e} where="not found in the answer" />
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-gray-500">
        {hasClock
          ? "Pause times are measured from the recording; other markers are positioned by where they occur in your transcript."
          : "Markers are positioned by where they occur in your answer text. Exact timestamps need a voice recording, so none are shown."}
      </p>
    </div>
  );
}

function Row({ e, where }: { e: TimelineEvent; where: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span aria-hidden>{DOT[e.kind].icon}</span>
      <span className="sr-only">{DOT[e.kind].sr}:</span>
      <span className="text-gray-200">{e.label}</span>
      <span className="ml-auto shrink-0 text-[11px] text-gray-500 pt-0.5">{where}</span>
    </li>
  );
}
