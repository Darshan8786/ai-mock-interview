import type { AnswerStructure } from "../../../types/mockFeedback";
import { scoreText } from "./format";

/** How the answer was built, against the structure that suits THIS question type. */
export function AnswerStructureCard({ structure }: { structure: AnswerStructure }) {
  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-700 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold text-white">Answer Structure</h5>
          <p className="text-xs text-gray-500 mt-0.5">{structure.label}</p>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${scoreText(structure.score)}`}>{structure.score}%</span>
      </div>

      {/* Flow: found parts are lit, missing parts are dashed */}
      <ol className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2" aria-label={structure.framework}>
        {structure.elements.map((e, i) => (
          <li key={e.key} className="flex items-center gap-1">
            <span
              title={e.found ? e.evidence : "Not found in your answer"}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                e.found
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "border-dashed border-red-500/50 text-red-300 bg-red-500/5"
              }`}
            >
              {e.found ? "✓" : "✗"} {e.label}
            </span>
            {i < structure.elements.length - 1 && <span className="text-gray-600" aria-hidden>→</span>}
          </li>
        ))}
      </ol>

      {structure.elements.some((e) => e.found && e.evidence) && (
        <details className="mt-3 group">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">Where I found each part</summary>
          <ul className="mt-2 space-y-1.5">
            {structure.elements
              .filter((e) => e.found && e.evidence)
              .map((e) => (
                <li key={e.key} className="text-xs text-gray-400">
                  <span className="text-emerald-400">{e.label}:</span> <em className="text-gray-300">“{e.evidence}”</em>
                </li>
              ))}
          </ul>
        </details>
      )}

      {structure.missing.length > 0 && (
        <p className="mt-3 text-sm text-gray-300">
          <span className="text-red-400 font-medium">Missing:</span> {structure.missing.join(", ")}
        </p>
      )}
      <div className="mt-3 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-blue-300/70 mb-0.5">Recommended</p>
        <p className="text-sm text-blue-100 leading-relaxed">“{structure.recommendation}”</p>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">Detected from wording cues in your answer; it shows what the answer contains, not whether it is correct.</p>
    </div>
  );
}
