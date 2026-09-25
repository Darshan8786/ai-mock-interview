import type { EvaluationAnalysis } from "../../../types/mockFeedback";

function Card({ title, tone, icon, items, empty }: { title: string; tone: string; icon: string; items: string[]; empty: string }) {
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <h5 className="text-sm font-semibold text-white mb-2">{title}</h5>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t, i) => (
            <li key={i} className="text-sm text-gray-200 flex gap-2 leading-relaxed">
              <span aria-hidden>{icon}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Strengths / weaknesses / improvement actions / practice topics for one answer. */
export function StrengthWeaknessCards({ analysis }: { analysis: EvaluationAnalysis }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="Strengths" icon="✓" tone="bg-emerald-500/5 border-emerald-500/20" items={analysis.strengths} empty="No standout strengths were detected in this answer." />
        <Card title="Weaknesses" icon="△" tone="bg-amber-500/5 border-amber-500/20" items={analysis.weaknesses} empty="No specific weaknesses were detected." />
      </div>
      <Card title="How to improve" icon="→" tone="bg-blue-500/5 border-blue-500/20" items={analysis.improvements} empty="No specific actions to suggest." />
      {analysis.practiceTopics.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
          <h5 className="text-sm font-semibold text-white mb-2">Topics to practise</h5>
          <div className="flex flex-wrap gap-2">
            {analysis.practiceTopics.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
