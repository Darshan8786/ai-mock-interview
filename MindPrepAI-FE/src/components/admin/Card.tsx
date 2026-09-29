import type { ReactNode } from "react";
import { GRADIENTS, gradientFor } from "./gradients";

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, actions, children, className = "" }: CardProps) {
  const g = GRADIENTS[gradientFor(title || "card")];
  return (
    <div className={`relative overflow-hidden glass rounded-2xl p-5 ${className}`}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${g}`} />
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2.5">
            {title && <span className={`w-2.5 h-2.5 shrink-0 rounded-full gloss-sm bg-gradient-to-br ${g}`} />}
            <div>
              {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
