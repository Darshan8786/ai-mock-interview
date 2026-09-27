import type { ReactNode } from "react";
import { GRADIENTS, gradientFor } from "./gradients";

export function ChartCard({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  const g = GRADIENTS[gradientFor(title)];
  return (
    <div className={`relative overflow-hidden glass rounded-2xl p-5 ${className}`}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${g}`} />
      <div className="mb-4 flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 shrink-0 rounded-full gloss-sm bg-gradient-to-br ${g}`} />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}
